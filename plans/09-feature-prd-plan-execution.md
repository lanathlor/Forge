# Feature: PRD Plan Execution

## What is this feature?

A system that reads markdown plan files, breaks them into discrete steps, and executes each step with Claude sequentially - clearing context between steps to ensure focused execution and prevent context pollution.

## User Problem

**Without this feature**:
- Large tasks require manual breakdown
- Claude loses focus with too much context
- Hard to track progress through multi-step plans
- Can't resume partial plans
- No structured way to execute PRDs

**With this feature**:
- Write plan once in markdown
- Automatic step-by-step execution
- Context cleared between steps
- Track progress through plan
- Resume if interrupted
- QA gates run per step

## User Stories

### Story 1: Structured Execution
```
AS A developer
I WANT to create a multi-step plan in markdown
SO THAT Claude executes it methodically step-by-step
```

### Story 2: Context Isolation
```
AS A developer
I WANT context cleared between plan steps
SO THAT each step gets Claude's full focus
```

### Story 3: Progress Tracking
```
AS A developer
I WANT to see which steps are complete
SO THAT I can resume plans if interrupted
```

## User Flow

```
1. User creates plan file in repository
   File: .gatekeeper/plans/add-auth.md

   # Add Authentication

   ## Step 1: Create user model
   Create a User model with email, password hash, and timestamps

   ## Step 2: Add password hashing
   Install bcrypt and add password hashing utilities

   ## Step 3: Create auth middleware
   Add JWT-based authentication middleware

   ## Step 4: Add login endpoint
   Create POST /api/auth/login endpoint

   ## Step 5: Add protected routes
   Protect existing API routes with auth middleware

   ↓
2. User opens Gatekeeper dashboard
   ↓
3. User clicks "Execute Plan"
   ↓
4. Plan selector modal appears showing discovered plans:

   ┌────────────────────────────────────────┐
   │  Available Plans                       │
   ├────────────────────────────────────────┤
   │  📄 add-auth.md                        │
   │     5 steps • Not started              │
   │                                        │
   │  📄 refactor-api.md                    │
   │     3 steps • Step 2/3 complete       │
   │                                        │
   │  [Browse Files...]                     │
   └────────────────────────────────────────┘

   ↓
5. User selects "add-auth.md"
   ↓
6. Plan preview shown:

   ┌────────────────────────────────────────┐
   │  Plan: add-auth.md                     │
   ├────────────────────────────────────────┤
   │  Steps:                                │
   │  ☐ 1. Create user model                │
   │  ☐ 2. Add password hashing             │
   │  ☐ 3. Create auth middleware           │
   │  ☐ 4. Add login endpoint               │
   │  ☐ 5. Add protected routes             │
   │                                        │
   │  [Cancel]          [Start Execution]  │
   └────────────────────────────────────────┘

   ↓
7. User clicks "Start Execution"
   ↓
8. System creates PlanExecution record
   ↓
9. Step 1 begins:
   - Create new Task for Step 1
   - Send to Claude: "Create a User model with email, password hash, and timestamps"
   - Claude executes
   - QA gates run
   ↓
10. [If QA passes] → Step marked complete, continue to Step 2
    [If QA fails] → Claude re-invoked with error feedback (retry up to 3x)
    [If 3 retries fail] → Step marked failed, plan paused
    ↓
11. Before Step 2: CLEAR CONTEXT
    - End current Claude session
    - Start fresh Claude invocation
    ↓
12. Step 2 begins with clean context
    - Create new Task for Step 2
    - Send to Claude: "Install bcrypt and add password hashing utilities"
    - Repeat flow
    ↓
13. Continue until all steps complete
    ↓
14. Plan marked as complete:

    ┌────────────────────────────────────────┐
    │  ✅ Plan Complete: add-auth.md        │
    ├────────────────────────────────────────┤
    │  5/5 steps completed                   │
    │  Duration: 45m                         │
    │  Commits: 5                            │
    │                                        │
    │  [View Details]  [Start New Plan]     │
    └────────────────────────────────────────┘
```

## Plan File Format

### Markdown Structure
```markdown
# Plan Title

Optional description of what this plan accomplishes.

## Step 1: Short title
Detailed instructions for Claude. Be specific about:
- What to create/modify
- Expected behavior
- File locations (if known)
- Dependencies to install

## Step 2: Another step
Each ## heading becomes a step.
Steps execute sequentially.

## Step 3: Final step
You can use markdown formatting:
- Bullet points
- Code blocks
- **Bold** for emphasis

Note: Only ## (h2) headings are parsed as steps.
```

### Example: Feature Addition
```markdown
# Add User Profile Feature

This plan adds a complete user profile system.

## Step 1: Create profile database schema
Create a UserProfile table with Drizzle schema:
- userId (foreign key to users)
- bio (text)
- avatar_url (string)
- created_at, updated_at (timestamps)

Add migration and run it.

## Step 2: Create profile API endpoints
Create the following REST endpoints:
- GET /api/profile/:userId - Get user profile
- PUT /api/profile - Update own profile
- POST /api/profile/avatar - Upload avatar

Use our existing auth middleware.

## Step 3: Build profile UI components
Create React components:
- ProfileView (display profile)
- ProfileEdit (edit form)
- AvatarUpload (image upload)

Use shadcn/ui components for consistency.

## Step 4: Add profile route to app
Create /profile/[userId] page in Next.js app router.
Integrate the profile components.
```

## UI Components

### Plan Discovery Panel

```
┌─────────────────────────────────────────────────────┐
│  📋 Plans                                           │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Available Plans (3):                              │
│  ┌───────────────────────────────────────────────┐ │
│  │ 📄 add-auth.md                    [Execute]  │ │
│  │    5 steps • Not started                     │ │
│  ├───────────────────────────────────────────────┤ │
│  │ 📄 refactor-api.md                [Resume]   │ │
│  │    3 steps • 2/3 complete                    │ │
│  ├───────────────────────────────────────────────┤ │
│  │ 📄 add-tests.md                   [Execute]  │ │
│  │    8 steps • Not started                     │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  [+ Create New Plan]  [Browse Files]               │
└─────────────────────────────────────────────────────┘
```

### Plan Execution View

```
┌─────────────────────────────────────────────────────┐
│  Executing: add-auth.md                             │
│  Step 3/5 • 20m elapsed                            │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Progress:                                          │
│  ✅ Step 1: Create user model           (5m)      │
│  ✅ Step 2: Add password hashing        (7m)      │
│  🔄 Step 3: Create auth middleware      (8m)      │
│  ⏳ Step 4: Add login endpoint                    │
│  ⏳ Step 5: Add protected routes                  │
│                                                     │
│  Current Step Details:                             │
│  ┌───────────────────────────────────────────────┐ │
│  │ Step 3: Create auth middleware                │ │
│  │                                               │ │
│  │ Status: Running QA Gates                     │ │
│  │ Attempt: 1/3                                 │ │
│  │                                               │ │
│  │ Claude Output:                                │ │
│  │ > Created src/middleware/auth.ts              │ │
│  │ > Added JWT verification...                   │ │
│  │                                               │ │
│  │ QA Results:                                   │ │
│  │ ✅ ESLint passed                             │ │
│  │ 🔄 TypeScript checking...                    │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  [Pause Execution]  [Cancel Plan]                  │
└─────────────────────────────────────────────────────┘
```

### Plan Step Failed (Retry Logic)

```
┌─────────────────────────────────────────────────────┐
│  Step 3: Create auth middleware                     │
│  ❌ QA Failed - Retrying (Attempt 2/3)             │
├─────────────────────────────────────────────────────┤
│                                                     │
│  QA Gate Failures:                                 │
│  ❌ TypeScript (2 errors)                          │
│     src/middleware/auth.ts:15:3                    │
│     Property 'user' does not exist on Request      │
│                                                     │
│  Sending feedback to Claude:                       │
│  "The previous implementation failed QA gates.     │
│   Please fix the following errors:                 │
│   [error details]"                                 │
│                                                     │
│  Claude is now fixing the issues...                │
│  🔄 Attempt 2/3 in progress                        │
└─────────────────────────────────────────────────────┘
```

## Technical Implementation

### Plan File Parser

```typescript
// src/lib/plans/parser.ts

export interface PlanStep {
  stepNumber: number;
  title: string;
  content: string;
  raw: string;
}

export interface ParsedPlan {
  title: string;
  description?: string;
  steps: PlanStep[];
  filePath: string;
}

export function parsePlanFile(markdownContent: string, filePath: string): ParsedPlan {
  const lines = markdownContent.split('\n');

  let title = '';
  let description = '';
  const steps: PlanStep[] = [];
  let currentStep: Partial<PlanStep> | null = null;
  let inDescription = true;

  for (const line of lines) {
    // Parse title (# heading)
    if (line.startsWith('# ')) {
      title = line.substring(2).trim();
      inDescription = true;
      continue;
    }

    // Parse step (## heading)
    if (line.startsWith('## ')) {
      // Save previous step
      if (currentStep) {
        steps.push(currentStep as PlanStep);
      }

      inDescription = false;

      // Parse step title (format: "## Step N: Title" or just "## Title")
      const stepText = line.substring(3).trim();
      const stepMatch = stepText.match(/^Step (\d+):\s*(.+)$/);

      currentStep = {
        stepNumber: stepMatch ? parseInt(stepMatch[1]) : steps.length + 1,
        title: stepMatch ? stepMatch[2] : stepText,
        content: '',
        raw: line + '\n',
      };
      continue;
    }

    // Accumulate content
    if (currentStep) {
      currentStep.content += line + '\n';
      currentStep.raw += line + '\n';
    } else if (inDescription && line.trim()) {
      description += line + '\n';
    }
  }

  // Save last step
  if (currentStep) {
    steps.push(currentStep as PlanStep);
  }

  return {
    title,
    description: description.trim(),
    steps: steps.map((step, idx) => ({
      ...step,
      stepNumber: step.stepNumber || idx + 1,
      content: step.content.trim(),
    })),
    filePath,
  };
}
```

### Plan Discovery

```typescript
// src/lib/plans/discovery.ts

import fs from 'fs/promises';
import path from 'path';

const PLAN_DIRECTORY = '.gatekeeper/plans';

export async function discoverPlans(repoPath: string): Promise<ParsedPlan[]> {
  const plansDir = path.join(repoPath, PLAN_DIRECTORY);

  try {
    const files = await fs.readdir(plansDir);
    const mdFiles = files.filter(f => f.endsWith('.md'));

    const plans = await Promise.all(
      mdFiles.map(async (file) => {
        const filePath = path.join(plansDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        return parsePlanFile(content, filePath);
      })
    );

    return plans;
  } catch (error) {
    // Directory doesn't exist or is empty
    return [];
  }
}
```

### Plan Execution Engine

```typescript
// src/lib/plans/executor.ts

import { claudeWrapper } from '@/lib/claude/wrapper';
import { runQAGates } from '@/lib/qa-gates/runner';
import { commitChanges } from '@/lib/git/commit';

const MAX_RETRIES = 3;

export async function executePlan(planExecutionId: string): Promise<void> {
  const planExecution = await db.query.planExecutions.findFirst({
    where: eq(planExecutions.id, planExecutionId),
    with: {
      plan: true,
      steps: true,
      repository: true,
    },
  });

  if (!planExecution) throw new Error('Plan execution not found');

  const plan = parsePlanFile(planExecution.plan.content, planExecution.plan.filePath);

  for (const step of plan.steps) {
    await executeStep(planExecutionId, step);
  }

  // Mark plan as complete
  await db.update(planExecutions)
    .set({ status: 'completed', completedAt: new Date() })
    .where(eq(planExecutions.id, planExecutionId));
}

async function executeStep(
  planExecutionId: string,
  step: PlanStep
): Promise<void> {
  // Create step execution record
  const stepExecution = await db.insert(planStepExecutions).values({
    planExecutionId,
    stepNumber: step.stepNumber,
    stepTitle: step.title,
    stepContent: step.content,
    status: 'pending',
  }).returning();

  const stepId = stepExecution[0].id;
  let attempt = 0;
  let lastError: string | null = null;

  while (attempt < MAX_RETRIES) {
    attempt++;

    try {
      // Update status
      await db.update(planStepExecutions)
        .set({
          status: 'running',
          currentAttempt: attempt,
        })
        .where(eq(planStepExecutions.id, stepId));

      // Build prompt
      let prompt = step.content;

      // If retry, add error feedback
      if (attempt > 1 && lastError) {
        prompt = `The previous implementation failed QA gates. Please fix the following errors and try again:\n\n${lastError}\n\nOriginal task:\n${step.content}`;
      }

      // Execute with Claude (FRESH CONTEXT - new invocation)
      const result = await claudeWrapper.executeTask({
        workingDirectory: planExecution.repository.path,
        prompt,
        taskId: stepId,
      });

      // Capture diff
      const diff = await captureDiff(
        planExecution.repository.path,
        planExecution.startingCommit
      );

      // Run QA gates
      const qaResults = await runQAGates(
        stepId,
        planExecution.repository.path
      );

      // Check if QA passed
      const allPassed = qaResults.every(r => r.status === 'passed' || r.status === 'skipped');

      if (allPassed) {
        // QA passed! Commit and move to next step
        const commitMsg = await generateCommitMessage(diff.fullDiff, step.title);
        await commitChanges(
          planExecution.repository.path,
          diff.changedFiles.map(f => f.path),
          commitMsg
        );

        // Mark step complete
        await db.update(planStepExecutions)
          .set({
            status: 'completed',
            completedAt: new Date(),
          })
          .where(eq(planStepExecutions.id, stepId));

        // SUCCESS - break retry loop
        break;

      } else {
        // QA failed - prepare for retry
        const failedGates = qaResults.filter(r => r.status === 'failed');
        lastError = failedGates.map(g =>
          `${g.gateName}: ${g.errors?.join('\n')}`
        ).join('\n\n');

        if (attempt >= MAX_RETRIES) {
          // Max retries reached
          await db.update(planStepExecutions)
            .set({
              status: 'failed',
              failureReason: `QA gates failed after ${MAX_RETRIES} attempts:\n${lastError}`,
            })
            .where(eq(planStepExecutions.id, stepId));

          // Mark entire plan as failed
          await db.update(planExecutions)
            .set({ status: 'failed' })
            .where(eq(planExecutions.id, planExecutionId));

          throw new Error(`Step ${step.stepNumber} failed after ${MAX_RETRIES} attempts`);
        }

        // Will retry - loop continues
      }

    } catch (error) {
      // Execution error (not QA failure)
      await db.update(planStepExecutions)
        .set({
          status: 'failed',
          failureReason: error instanceof Error ? error.message : 'Unknown error',
        })
        .where(eq(planStepExecutions.id, stepId));

      throw error;
    }
  }
}
```

### Database Schema (Drizzle)

```typescript
// src/db/schema/plans.ts

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const plans = sqliteTable('plans', {
  id: text('id').primaryKey(),
  repositoryId: text('repository_id').notNull(),
  filePath: text('file_path').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(), // Full markdown content
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const planExecutions = sqliteTable('plan_executions', {
  id: text('id').primaryKey(),
  planId: text('plan_id').notNull(),
  repositoryId: text('repository_id').notNull(),
  sessionId: text('session_id'),
  status: text('status').notNull(), // pending, running, completed, failed, paused
  startingCommit: text('starting_commit'),
  currentStep: integer('current_step').default(0),
  totalSteps: integer('total_steps').notNull(),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});

export const planStepExecutions = sqliteTable('plan_step_executions', {
  id: text('id').primaryKey(),
  planExecutionId: text('plan_execution_id').notNull(),
  stepNumber: integer('step_number').notNull(),
  stepTitle: text('step_title').notNull(),
  stepContent: text('step_content').notNull(),
  status: text('status').notNull(), // pending, running, completed, failed
  currentAttempt: integer('current_attempt').default(1),
  failureReason: text('failure_reason'),
  taskId: text('task_id'), // Link to regular task
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});
```

### API Endpoints

**GET /api/plans?repositoryId=xxx**
```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const repositoryId = searchParams.get('repositoryId');

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.id, repositoryId),
  });

  const plans = await discoverPlans(repo.path);

  return Response.json({ plans });
}
```

**POST /api/plans/execute**
```typescript
export async function POST(request: Request) {
  const { planFilePath, repositoryId } = await request.json();

  // Create plan execution
  const execution = await db.insert(planExecutions).values({
    planId: generateId(),
    repositoryId,
    status: 'pending',
    // ... other fields
  }).returning();

  // Start execution (async)
  executePlan(execution[0].id).catch(console.error);

  return Response.json({ execution: execution[0] });
}
```

## Mobile Responsive Design

```css
/* Plan execution view - responsive */
.plan-execution {
  @apply grid grid-cols-1 lg:grid-cols-3 gap-4;
}

.plan-steps-list {
  @apply lg:col-span-1 order-1 lg:order-1;
}

.plan-current-step {
  @apply lg:col-span-2 order-2 lg:order-2;
}

/* On mobile, current step shows first */
@media (max-width: 1024px) {
  .plan-current-step {
    @apply order-1;
  }

  .plan-steps-list {
    @apply order-2;
  }
}
```

## Performance Considerations

- **Context Clearing**: Each step starts fresh Claude instance (no accumulated context)
- **Parallel Execution**: Steps MUST be sequential (no parallelization)
- **Retry Strategy**: Exponential backoff between retries (optional)
- **File Watching**: Plans directory watched for new/updated files

## Edge Cases

### Scenario: User Modifies Plan File During Execution
**Handling**: Execution continues with original parsed version, warn user

### Scenario: Step Fails After 3 Retries
**Handling**: Pause execution, allow user to manually fix, resume from failed step

### Scenario: Plan File Deleted
**Handling**: Show warning, mark execution as failed

### Scenario: Repository Dirty Before Step
**Handling**: Reject step execution, require clean state

## Acceptance Criteria

- [ ] Can discover plans in `.gatekeeper/plans/` directory
- [ ] Can parse markdown into steps
- [ ] Can execute steps sequentially
- [ ] Context cleared between steps (separate Claude invocations)
- [ ] QA gates run after each step
- [ ] Failed QA gates trigger retry (up to 3 times)
- [ ] Each successful step auto-commits
- [ ] Can resume paused plans
- [ ] Mobile-friendly plan execution UI
- [ ] Progress tracked in database

## Future Enhancements

- Plan templates library
- Visual plan editor (no markdown required)
- Plan branching (if step A succeeds, do B, else do C)
- Plan dependencies (step 3 requires step 1 output)
- Plan scheduling (execute at specific time)
- Plan sharing (export/import)
- AI-generated plans (describe feature, Claude writes plan)
