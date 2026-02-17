# Feature: QA Gate System

## What is this feature?

An automated quality assurance system that runs configurable checks (ESLint, TypeScript, tests, custom commands) after Claude completes a task, before allowing approval.

## User Problem

**Without this feature**:

- Manual testing after every Claude change
- Risk of broken code entering codebase
- Inconsistent quality standards
- Time wasted on preventable bugs

**With this feature**:

- Automatic quality checks
- Catch errors before review
- Enforce project standards
- Confidence in Claude's output

## User Stories

### Story 1: Automatic Quality Checks

```
AS A developer
I WANT automated checks to run after Claude finishes
SO THAT I don't have to manually test every change
```

### Story 2: Failed Gate Blocking

```
AS A developer
I WANT tasks with failing QA gates to be blocked from approval
SO THAT broken code never enters my repository
```

### Story 3: Configurable Gates

```
AS A developer
I WANT to configure which gates run and their settings
SO THAT I can adapt to project requirements
```

## User Flow

```
1. Claude completes task
   ↓
2. Task status → "waiting_qa"
   ↓
3. QA Gate Runner starts
   Status → "qa_running" (Attempt 1/3)
   ↓
4. Gates run sequentially (by order)

   Gate 1: ESLint
   ├─ Running... ⏳
   ├─ Command: pnpm eslint . --ext .ts,.tsx
   ├─ Duration: 3.2s
   └─ Result: ✅ PASSED (0 errors, 0 warnings)

   Gate 2: TypeScript
   ├─ Running... ⏳
   ├─ Command: pnpm tsc --noEmit
   ├─ Duration: 5.1s
   └─ Result: ❌ FAILED (2 type errors)

   Gate 3: Tests (skipped - previous gate failed)
   └─ Result: ⏭️ SKIPPED

   ↓

5. [If all gates pass]
   Task status → "waiting_approval"
   User can approve ✅

   [If any gate fails]
   ↓
6. QA RETRY LOGIC (Automatic):

   Attempt 1 failed → Claude re-invoked with error feedback
   ↓
   Status → "qa_running" (Attempt 2/3)
   ↓
   Prompt sent to Claude:
   "The previous implementation failed QA gates.
    Please fix the following errors:

    TypeScript:
    - src/api/routes.ts:15:3
      Property 'user' does not exist on Request

    Original task: [original prompt]"
   ↓
   Claude fixes code
   ↓
   QA gates run again (Attempt 2)
   ↓
   [If passes] → "waiting_approval" ✅
   [If fails] → Attempt 3/3
   ↓
   [If Attempt 3 fails]
   Task status → "qa_failed"
   User options:
   - Reject and revert
   - Manually fix and re-run gates
   - Override (with reason)
```

## UI Components

### QA Gate Results Panel

```
┌────────────────────────────────────────────────────┐
│  QA Gate Results                                   │
├────────────────────────────────────────────────────┤
│                                                    │
│  Overall Status: ❌ FAILED (1/3 passed)           │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │ ✅ ESLint                          3.2s     │ │
│  │    No errors or warnings found              │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │ ❌ TypeScript                      5.1s     │ │
│  │    2 type errors found                      │ │
│  │                                             │ │
│  │    src/api/routes.ts:45:12                  │ │
│  │    Error: Type 'string | undefined' is not │ │
│  │    assignable to type 'string'              │ │
│  │                                             │ │
│  │    src/lib/utils.ts:23:5                    │ │
│  │    Error: Property 'map' does not exist on │ │
│  │    type 'User | null'                       │ │
│  │                                             │ │
│  │    [View Full Output ▼]                     │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │ ⏭️ Tests                            -       │ │
│  │    Skipped (previous gate failed)           │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  [Re-run Gates]  [Override & Approve Anyway]      │
└────────────────────────────────────────────────────┘
```

### Gate Configuration UI (Settings)

```
┌────────────────────────────────────────────────────┐
│  QA Gate Configuration                             │
├────────────────────────────────────────────────────┤
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │ [✓] ESLint                     Order: 1     │ │
│  │     Command: pnpm eslint . --ext .ts,.tsx   │ │
│  │     Timeout: 60s                            │ │
│  │     [✓] Stop on failure                     │ │
│  │     [Edit] [Delete]                         │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │ [✓] TypeScript                 Order: 2     │ │
│  │     Command: pnpm tsc --noEmit              │ │
│  │     Timeout: 120s                           │ │
│  │     [✓] Stop on failure                     │ │
│  │     [Edit] [Delete]                         │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │ [ ] Tests                      Order: 3     │ │
│  │     Command: pnpm test                      │ │
│  │     Timeout: 300s                           │ │
│  │     [ ] Stop on failure                     │ │
│  │     [Edit] [Delete]                         │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  [+ Add Gate]                      [Save Changes] │
└────────────────────────────────────────────────────┘
```

## Technical Implementation

### Gate Runner Engine (with Retry Logic)

```typescript
// src/lib/qa-gates/runner.ts

import { exec } from 'child_process';
import { promisify } from 'util';
import { db } from '@/lib/db';
import { claudeWrapper } from '@/lib/claude/wrapper';
import { eq } from 'drizzle-orm';

const execAsync = promisify(exec);

const MAX_QA_RETRIES = 3;

interface GateResult {
  gateName: string;
  status: 'passed' | 'failed' | 'skipped';
  output: string;
  errors?: string[];
  duration: number;
}

export async function runQAGatesWithRetry(
  taskId: string,
  repoPath: string
): Promise<{ passed: boolean; attempt: number }> {
  let attempt = 0;

  while (attempt < MAX_QA_RETRIES) {
    attempt++;

    // Update task with current attempt
    await db
      .update(tasks)
      .set({
        status: 'qa_running',
        currentQAAttempt: attempt,
      })
      .where(eq(tasks.id, taskId));

    // Run QA gates
    const results = await runQAGates(taskId, repoPath);
    const allPassed = results.every(
      (r) => r.status === 'passed' || r.status === 'skipped'
    );

    if (allPassed) {
      // Success! Mark as waiting approval
      await db
        .update(tasks)
        .set({ status: 'waiting_approval' })
        .where(eq(tasks.id, taskId));

      return { passed: true, attempt };
    }

    // QA failed
    if (attempt >= MAX_QA_RETRIES) {
      // Max retries reached - final failure
      await db
        .update(tasks)
        .set({ status: 'qa_failed' })
        .where(eq(tasks.id, taskId));

      return { passed: false, attempt };
    }

    // Prepare error feedback for Claude
    const failedGates = results.filter((r) => r.status === 'failed');
    const errorFeedback = formatErrorFeedback(failedGates);

    // Get original task
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
    });

    // Re-invoke Claude with error feedback
    const retryPrompt = `The previous implementation failed QA gates. Please fix the following errors and try again:

${errorFeedback}

Original task:
${task!.prompt}`;

    // Execute Claude with retry prompt (FRESH INVOCATION)
    await claudeWrapper.executeTask({
      workingDirectory: repoPath,
      prompt: retryPrompt,
      taskId: taskId,
    });

    // Capture new diff
    const diff = await captureDiff(repoPath, task!.startingCommit!);
    await db
      .update(tasks)
      .set({
        diffContent: diff.fullDiff,
        filesChanged: diff.changedFiles,
      })
      .where(eq(tasks.id, taskId));

    // Loop continues to retry QA gates
  }

  return { passed: false, attempt: MAX_QA_RETRIES };
}

export async function runQAGates(
  taskId: string,
  repoPath: string
): Promise<GateResult[]> {
  // Get enabled gates (sorted by order)
  const gates = await db.query.qaGateConfigs.findMany({
    where: eq(qaGateConfigs.enabled, true),
    orderBy: (gates, { asc }) => [asc(gates.order)],
  });

  const results: GateResult[] = [];
  let shouldStop = false;

  // Run each gate sequentially
  for (const gate of gates) {
    if (shouldStop) {
      // Skip remaining gates if previous failed and failOnError is true
      results.push({
        gateName: gate.name,
        status: 'skipped',
        output: 'Skipped due to previous gate failure',
        duration: 0,
      });

      await createGateResult(taskId, gate.name, 'skipped', '', 0);
      continue;
    }

    // Run gate
    const result = await runSingleGate(gate, repoPath);
    results.push(result);

    // Store result in database
    await createGateResult(
      taskId,
      result.gateName,
      result.status,
      result.output,
      result.duration,
      result.errors
    );

    // Check if should stop
    if (result.status === 'failed' && gate.failOnError) {
      shouldStop = true;
    }
  }

  return results;
}

function formatErrorFeedback(failedGates: GateResult[]): string {
  return failedGates
    .map((gate) => {
      const errors = gate.errors || [gate.output];
      return `${gate.gateName} errors:\n${errors.join('\n')}`;
    })
    .join('\n\n');
}

async function runSingleGate(
  gate: QAGateConfig,
  repoPath: string
): Promise<GateResult> {
  const startTime = Date.now();

  try {
    const { stdout, stderr } = await execAsync(gate.command, {
      cwd: repoPath,
      timeout: gate.timeout,
      env: process.env,
    });

    const duration = Date.now() - startTime;

    // Success (exit code 0)
    return {
      gateName: gate.name,
      status: 'passed',
      output: stdout || 'No output',
      duration,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;

    // Failed (non-zero exit code or timeout)
    return {
      gateName: gate.name,
      status: 'failed',
      output: error.stdout || '',
      errors: parseErrors(error.stderr || error.stdout || error.message),
      duration,
    };
  }
}

function parseErrors(output: string): string[] {
  // Parse error output based on tool
  // ESLint, TypeScript, Jest have different formats
  const lines = output.split('\n').filter((line) => line.trim());

  // Simple parsing - just return non-empty lines
  // Can be enhanced per-gate for better error extraction
  return lines;
}

async function createGateResult(
  taskId: string,
  gateName: string,
  status: string,
  output: string,
  duration: number,
  errors?: string[]
): Promise<void> {
  await db.insert(qaGateResults).values({
    taskId,
    gateName,
    status,
    output,
    errors: JSON.stringify(errors || []),
    duration,
    completedAt: new Date(),
  });
}
```

### Built-in Gate Implementations

```typescript
// src/lib/qa-gates/gates/eslint.ts

export const eslintGate = {
  name: 'eslint',
  command: 'pnpm eslint . --ext .ts,.tsx,.js,.jsx --format json',
  timeout: 60000,
  failOnError: true,
  order: 1,

  parseOutput(output: string): { passed: boolean; errors: string[] } {
    try {
      const results = JSON.parse(output);
      const errorCount = results.reduce(
        (sum: number, file: any) => sum + file.errorCount,
        0
      );

      if (errorCount === 0) {
        return { passed: true, errors: [] };
      }

      const errors = results.flatMap((file: any) =>
        file.messages.map(
          (msg: any) =>
            `${file.filePath}:${msg.line}:${msg.column} - ${msg.message} (${msg.ruleId})`
        )
      );

      return { passed: false, errors };
    } catch {
      // Fallback if JSON parsing fails
      return { passed: output.includes('0 errors'), errors: [output] };
    }
  },
};
```

```typescript
// src/lib/qa-gates/gates/typescript.ts

export const typescriptGate = {
  name: 'typescript',
  command: 'pnpm tsc --noEmit --pretty false',
  timeout: 120000,
  failOnError: true,
  order: 2,

  parseOutput(output: string): { passed: boolean; errors: string[] } {
    if (!output.includes('error TS')) {
      return { passed: true, errors: [] };
    }

    const errorRegex = /(.+?)\((\d+),(\d+)\): error TS(\d+): (.+)/g;
    const errors: string[] = [];
    let match;

    while ((match = errorRegex.exec(output)) !== null) {
      const [_, file, line, col, code, message] = match;
      errors.push(`${file}:${line}:${col} - TS${code}: ${message}`);
    }

    return { passed: false, errors: errors.length > 0 ? errors : [output] };
  },
};
```

```typescript
// src/lib/qa-gates/gates/tests.ts

export const testsGate = {
  name: 'tests',
  command: 'pnpm test --run',
  timeout: 300000,
  failOnError: false, // Tests can fail but still allow approval (with warning)
  order: 3,

  parseOutput(output: string): { passed: boolean; errors: string[] } {
    // Detect Vitest/Jest output
    const passed = output.includes('Test Files') && !output.includes('FAIL');

    if (passed) {
      return { passed: true, errors: [] };
    }

    // Extract failed test names
    const failedTests = output.match(/FAIL .+/g) || [];
    return { passed: false, errors: failedTests };
  },
};
```

### Database Schema

```typescript
// src/db/schema.ts

export const qaGateConfigs = sqliteTable(
  'qa_gate_configs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text('name').notNull().unique(),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    command: text('command').notNull(),
    timeout: integer('timeout').notNull().default(60000),
    failOnError: integer('fail_on_error', { mode: 'boolean' })
      .notNull()
      .default(true),
    order: integer('order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(
      () => new Date()
    ),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
      () => new Date()
    ),
  },
  (table) => ({
    enabledOrderIdx: index('qa_gate_enabled_order_idx').on(
      table.enabled,
      table.order
    ),
  })
);

export const qaGateResults = sqliteTable(
  'qa_gate_results',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    gateName: text('gate_name').notNull(),
    status: text('status').notNull(), // pending, running, passed, failed, skipped
    output: text('output'),
    errors: text('errors'), // JSON string[]
    duration: integer('duration'),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(
      () => new Date()
    ),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
  },
  (table) => ({
    taskIdx: index('qa_gate_result_task_idx').on(table.taskId),
    gateNameIdx: index('qa_gate_result_gate_name_idx').on(table.gateName),
  })
);
```

### API Endpoints

**POST /api/tasks/:id/qa-gates/run**

```typescript
// Re-run QA gates manually

import { db } from '@/lib/db';
import { tasks, qaGateResults } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, params.id),
    with: {
      session: {
        with: {
          repository: true,
        },
      },
    },
  });

  if (!task) {
    return Response.json({ error: 'Task not found' }, { status: 404 });
  }

  const repoPath = task.session.repository.path;

  // Clear old results
  await db.delete(qaGateResults).where(eq(qaGateResults.taskId, task.id));

  // Run gates
  const results = await runQAGates(task.id, repoPath);

  return Response.json({ results });
}
```

**GET /api/qa-gates**

```typescript
// List all gate configurations

import { db } from '@/lib/db';
import { qaGateConfigs } from '@/db/schema';
import { asc } from 'drizzle-orm';

export async function GET() {
  const gates = await db
    .select()
    .from(qaGateConfigs)
    .orderBy(asc(qaGateConfigs.order));

  return Response.json({ gates });
}
```

**PUT /api/qa-gates/:id**

```typescript
// Update gate configuration

import { db } from '@/lib/db';
import { qaGateConfigs } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const data = await request.json();

  const [gate] = await db
    .update(qaGateConfigs)
    .set({
      name: data.name,
      enabled: data.enabled,
      command: data.command,
      timeout: data.timeout,
      failOnError: data.failOnError,
      order: data.order,
      updatedAt: new Date(),
    })
    .where(eq(qaGateConfigs.id, params.id))
    .returning();

  return Response.json({ gate });
}
```

### Seeding Default Gates

```typescript
// src/db/seed.ts

import { db } from '@/lib/db';
import { qaGateConfigs } from './schema';

async function main() {
  // Create default QA gates
  await db
    .insert(qaGateConfigs)
    .values([
      {
        name: 'eslint',
        enabled: true,
        command: 'pnpm eslint . --ext .ts,.tsx,.js,.jsx',
        timeout: 60000,
        failOnError: true,
        order: 1,
      },
      {
        name: 'typescript',
        enabled: true,
        command: 'pnpm tsc --noEmit',
        timeout: 120000,
        failOnError: true,
        order: 2,
      },
      {
        name: 'tests',
        enabled: false,
        command: 'pnpm test --run',
        timeout: 300000,
        failOnError: false,
        order: 3,
      },
    ])
    .onConflictDoNothing(); // Skip if already exist
}

main()
  .then(() => {
    console.log('Seed complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
```

## Performance Considerations

- **Sequential Execution**: Gates run one at a time to avoid resource contention
- **Timeout Protection**: Each gate has configurable timeout
- **Early Termination**: Stop on first failure (if configured)
- **Output Streaming**: Stream gate output to UI in real-time (future)
- **Caching**: Cache gate results per commit SHA (future)

## Edge Cases

### Scenario: Gate Command Not Found

**Handling**: Catch error, mark gate as failed with "Command not found" error

### Scenario: Gate Timeout

**Handling**: Kill process, mark as failed with "Timeout exceeded" error

### Scenario: All Gates Disabled

**Handling**: Skip QA phase entirely, go straight to waiting_approval

### Scenario: Gate Output Too Large

**Handling**: Truncate output to 10KB, store full output in file system

### Scenario: Repository Has No package.json

**Handling**: Gates using `pnpm` fail gracefully with clear error message

### Scenario: User Wants to Approve Despite Failed Gates

**Handling**: "Override" button with confirmation modal and reason input

## Acceptance Criteria

- [ ] QA gates run automatically after Claude completes task
- [ ] Gates execute in configured order
- [ ] Failed gates trigger automatic retry (up to 3 attempts)
- [ ] Claude re-invoked with error feedback on retry
- [ ] Gate results display current attempt (1/3, 2/3, 3/3)
- [ ] After 3 failed attempts, task marked "qa_failed"
- [ ] Failed gates block approval after all retries exhausted
- [ ] Gate results display with clear pass/fail status
- [ ] Errors show with file/line information
- [ ] User can manually re-run gates
- [ ] User can configure gates (enable/disable, timeout, command)
- [ ] User can override failed gates with reason
- [ ] Execution stops early if failOnError=true
- [ ] Default gates seed on first run
- [ ] Discord notifications sent on each retry attempt

## Dependencies

**Required for**:

- Approval workflow (gates must pass first)
- Quality assurance (main purpose)

**Depends on**:

- Task execution completed
- Repository has necessary tools (eslint, tsc, etc.)
- Git working directory preserved

## Future Enhancements

- Parallel gate execution (for independent gates)
- Per-gate retry logic
- Gate output streaming (real-time)
- Custom parsers per gate type
- Integration with external tools (SonarQube, etc.)
- Gate result caching by commit SHA
- Conditional gates (only run if certain files changed)
- Gate dependencies (run B only if A passes)
- Performance tracking (gate duration over time)
- Notifications on gate failure
