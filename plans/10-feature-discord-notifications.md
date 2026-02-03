# Feature: Discord Notifications

## What is this feature?

Real-time notifications sent to Discord channels when important events occur: task completion, QA gate failures, plan execution progress, and more.

## User Problem

**Without this feature**:
- Must watch dashboard constantly
- Miss important events
- Can't multitask while Claude works
- No team visibility
- Mobile monitoring difficult

**With this feature**:
- Get notified on Discord (desktop + mobile)
- Continue other work while Claude executes
- Team members stay informed
- Mobile-friendly notifications
- Historical event log in Discord

## User Stories

### Story 1: Task Completion Alerts
```
AS A developer
I WANT to receive Discord notifications when tasks complete
SO THAT I don't have to watch the dashboard
```

### Story 2: QA Failure Alerts
```
AS A developer
I WANT immediate notification when QA gates fail
SO THAT I can review and fix issues quickly
```

### Story 3: Team Visibility
```
AS A team lead
I WANT all team members to see task activity
SO THAT we have shared visibility into AI-assisted development
```

## User Flow

```
1. User configures Discord webhook in settings
   ↓
2. User starts a task
   ↓
3. [Event: Task Started]
   Discord notification sent:

   ┌────────────────────────────────────┐
   │  🤖 Gatekeeper Bot                 │
   │  Today at 2:30 PM                  │
   ├────────────────────────────────────┤
   │  📝 Task Started                   │
   │                                    │
   │  Repository: my-app                │
   │  Prompt: Add error handling to API │
   │                                    │
   │  [View Dashboard →]                │
   └────────────────────────────────────┘

   ↓
4. Claude works, QA gates run
   ↓
5. [Event: QA Failed]
   Discord notification sent:

   ┌────────────────────────────────────┐
   │  🤖 Gatekeeper Bot                 │
   │  Today at 2:35 PM                  │
   ├────────────────────────────────────┤
   │  ❌ QA Gates Failed (Retry 1/3)   │
   │                                    │
   │  Repository: my-app                │
   │  Task: Add error handling...       │
   │                                    │
   │  Failed Gates:                     │
   │  • TypeScript: 2 errors            │
   │                                    │
   │  Claude is retrying...             │
   │                                    │
   │  [View Details →]                  │
   └────────────────────────────────────┘

   ↓
6. [Event: QA Passed, Waiting Approval]
   Discord notification sent:

   ┌────────────────────────────────────┐
   │  🤖 Gatekeeper Bot                 │
   │  Today at 2:38 PM                  │
   ├────────────────────────────────────┤
   │  ⏸️ Awaiting Approval              │
   │                                    │
   │  Repository: my-app                │
   │  Task: Add error handling...       │
   │                                    │
   │  ✅ All QA gates passed           │
   │  📝 4 files changed               │
   │                                    │
   │  [Review & Approve →]              │
   └────────────────────────────────────┘

   ↓
7. User approves on dashboard
   ↓
8. [Event: Task Completed]
   Discord notification sent:

   ┌────────────────────────────────────┐
   │  🤖 Gatekeeper Bot                 │
   │  Today at 2:40 PM                  │
   ├────────────────────────────────────┤
   │  ✅ Task Completed                │
   │                                    │
   │  Repository: my-app                │
   │  Task: Add error handling...       │
   │                                    │
   │  Commit: a3f2c1d                   │
   │  Message: feat(api): add error...  │
   │  Files: 4 changed (+90, -15)      │
   │                                    │
   │  Duration: 10m                     │
   │                                    │
   │  [View Commit →]                   │
   └────────────────────────────────────┘
```

## Notification Types

### 1. Task Lifecycle
- **Task Started** - When task execution begins
- **Task Completed** - When task approved and committed
- **Task Rejected** - When user rejects changes
- **Task Failed** - When execution errors occur

### 2. QA Events
- **QA Running** - When gates start (optional, can be noisy)
- **QA Failed (Retrying)** - When gates fail but retrying
- **QA Failed (Final)** - When all retries exhausted
- **QA Passed** - When all gates pass

### 3. Plan Execution
- **Plan Started** - When plan execution begins
- **Plan Step Completed** - When each step finishes
- **Plan Step Failed** - When step fails after retries
- **Plan Completed** - When entire plan finishes

### 4. System Events
- **Session Started** - When new session begins
- **Session Ended** - When session closed (with summary)
- **Repository Scanned** - When new repos discovered

## Discord Embed Examples

### Task Completed (Rich Embed)
```json
{
  "embeds": [{
    "title": "✅ Task Completed",
    "description": "**my-app** • Add error handling to API endpoints",
    "color": 5763719,
    "fields": [
      {
        "name": "Commit",
        "value": "`a3f2c1d`",
        "inline": true
      },
      {
        "name": "Duration",
        "value": "10m 32s",
        "inline": true
      },
      {
        "name": "Files Changed",
        "value": "4 files (+90, -15)",
        "inline": true
      },
      {
        "name": "Commit Message",
        "value": "```\nfeat(api): add error handling to endpoints\n\n- Wrap routes in try-catch\n- Add error middleware\n- Create error types\n```"
      }
    ],
    "footer": {
      "text": "Gatekeeper",
      "icon_url": "https://your-icon-url.com/icon.png"
    },
    "timestamp": "2024-01-15T14:40:00.000Z",
    "url": "https://gatekeeper.local/tasks/abc123"
  }]
}
```

### QA Failed (Warning Embed)
```json
{
  "embeds": [{
    "title": "❌ QA Gates Failed",
    "description": "**my-app** • Add error handling to API endpoints",
    "color": 15548997,
    "fields": [
      {
        "name": "Attempt",
        "value": "2/3",
        "inline": true
      },
      {
        "name": "Failed Gates",
        "value": "TypeScript",
        "inline": true
      },
      {
        "name": "Status",
        "value": "🔄 Claude is fixing errors...",
        "inline": false
      },
      {
        "name": "Errors",
        "value": "```\nsrc/api/routes.ts:15:3\nProperty 'user' does not exist on Request\n```"
      }
    ],
    "footer": {
      "text": "Gatekeeper",
      "icon_url": "https://your-icon-url.com/icon.png"
    },
    "timestamp": "2024-01-15T14:35:00.000Z",
    "url": "https://gatekeeper.local/tasks/abc123"
  }]
}
```

### Plan Progress (Info Embed)
```json
{
  "embeds": [{
    "title": "📋 Plan Progress",
    "description": "**my-app** • add-auth.md",
    "color": 3447003,
    "fields": [
      {
        "name": "Progress",
        "value": "3/5 steps",
        "inline": true
      },
      {
        "name": "Duration",
        "value": "20m",
        "inline": true
      },
      {
        "name": "Current Step",
        "value": "✅ Create auth middleware (Step 3)",
        "inline": false
      },
      {
        "name": "Remaining",
        "value": "• Add login endpoint\n• Add protected routes",
        "inline": false
      }
    ],
    "footer": {
      "text": "Gatekeeper",
      "icon_url": "https://your-icon-url.com/icon.png"
    },
    "timestamp": "2024-01-15T14:45:00.000Z"
  }]
}
```

## UI Components (Settings)

### Discord Configuration

```
┌─────────────────────────────────────────────────────┐
│  Discord Notifications                              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Webhook URL:                                       │
│  ┌───────────────────────────────────────────────┐ │
│  │ https://discord.com/api/webhooks/...          │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  [Test Connection]                                  │
│                                                     │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  Notification Settings:                            │
│                                                     │
│  Task Events:                                       │
│  ☑️ Task Started                                   │
│  ☑️ Task Completed                                 │
│  ☑️ Task Rejected                                  │
│  ☑️ Task Failed                                    │
│                                                     │
│  QA Events:                                         │
│  ☐ QA Running (can be noisy)                      │
│  ☑️ QA Failed (retrying)                           │
│  ☑️ QA Failed (final)                              │
│  ☑️ QA Passed                                      │
│                                                     │
│  Plan Events:                                       │
│  ☑️ Plan Started                                   │
│  ☑️ Plan Step Completed                            │
│  ☑️ Plan Failed                                    │
│  ☑️ Plan Completed                                 │
│                                                     │
│  System Events:                                     │
│  ☐ Session Started                                 │
│  ☑️ Session Ended (with summary)                   │
│  ☐ Repository Scanned                              │
│                                                     │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  Message Format:                                    │
│  ◉ Rich Embeds (recommended)                       │
│  ○ Simple Messages                                 │
│                                                     │
│  Include Dashboard Links:                          │
│  ☑️ Add links to dashboard in notifications        │
│                                                     │
│  [Save Settings]                                    │
└─────────────────────────────────────────────────────┘
```

## Technical Implementation

### Discord Client

```typescript
// src/lib/notifications/discord.ts

import type { EmbedBuilder } from '@/types/discord';

export class DiscordNotifier {
  private webhookUrl: string;

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl;
  }

  async sendEmbed(embed: EmbedBuilder): Promise<void> {
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          embeds: [embed],
        }),
      });

      if (!response.ok) {
        throw new Error(`Discord API error: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to send Discord notification:', error);
      // Don't throw - notifications shouldn't break main flow
    }
  }

  async sendSimpleMessage(content: string): Promise<void> {
    try {
      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });
    } catch (error) {
      console.error('Failed to send Discord notification:', error);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.sendSimpleMessage('✅ Gatekeeper connected successfully!');
      return true;
    } catch {
      return false;
    }
  }
}
```

### Embed Builders

```typescript
// src/lib/notifications/embeds.ts

const COLORS = {
  success: 5763719,  // Green
  error: 15548997,   // Red
  warning: 16776960, // Yellow
  info: 3447003,     // Blue
};

export function buildTaskCompletedEmbed(task: Task): EmbedBuilder {
  return {
    title: '✅ Task Completed',
    description: `**${task.repository.name}** • ${truncate(task.prompt, 100)}`,
    color: COLORS.success,
    fields: [
      {
        name: 'Commit',
        value: `\`${task.committedSha?.substring(0, 7)}\``,
        inline: true,
      },
      {
        name: 'Duration',
        value: formatDuration(task.createdAt, task.completedAt!),
        inline: true,
      },
      {
        name: 'Files Changed',
        value: `${task.filesChanged.length} files (+${task.insertions}, -${task.deletions})`,
        inline: true,
      },
      {
        name: 'Commit Message',
        value: `\`\`\`\n${truncate(task.commitMessage!, 200)}\n\`\`\``,
      },
    ],
    footer: {
      text: 'Gatekeeper',
      icon_url: process.env.GATEKEEPER_ICON_URL,
    },
    timestamp: new Date().toISOString(),
    url: `${process.env.DASHBOARD_URL}/tasks/${task.id}`,
  };
}

export function buildQAFailedEmbed(task: Task, attempt: number, errors: string[]): EmbedBuilder {
  return {
    title: '❌ QA Gates Failed',
    description: `**${task.repository.name}** • ${truncate(task.prompt, 100)}`,
    color: COLORS.error,
    fields: [
      {
        name: 'Attempt',
        value: `${attempt}/3`,
        inline: true,
      },
      {
        name: 'Status',
        value: attempt < 3 ? '🔄 Claude is fixing errors...' : '🛑 Max retries reached',
        inline: false,
      },
      {
        name: 'Errors',
        value: `\`\`\`\n${errors.slice(0, 3).join('\n')}\n\`\`\``,
      },
    ],
    footer: {
      text: 'Gatekeeper',
      icon_url: process.env.GATEKEEPER_ICON_URL,
    },
    timestamp: new Date().toISOString(),
    url: `${process.env.DASHBOARD_URL}/tasks/${task.id}`,
  };
}

export function buildPlanProgressEmbed(
  planExecution: PlanExecution,
  currentStep: PlanStep
): EmbedBuilder {
  return {
    title: '📋 Plan Progress',
    description: `**${planExecution.repository.name}** • ${planExecution.plan.title}`,
    color: COLORS.info,
    fields: [
      {
        name: 'Progress',
        value: `${currentStep.stepNumber}/${planExecution.totalSteps} steps`,
        inline: true,
      },
      {
        name: 'Duration',
        value: formatDuration(planExecution.startedAt, new Date()),
        inline: true,
      },
      {
        name: 'Current Step',
        value: `✅ ${currentStep.title} (Step ${currentStep.stepNumber})`,
        inline: false,
      },
    ],
    footer: {
      text: 'Gatekeeper',
      icon_url: process.env.GATEKEEPER_ICON_URL,
    },
    timestamp: new Date().toISOString(),
  };
}
```

### Notification Service

```typescript
// src/lib/notifications/service.ts

import { DiscordNotifier } from './discord';
import { buildTaskCompletedEmbed, buildQAFailedEmbed } from './embeds';

export class NotificationService {
  private discord: DiscordNotifier | null = null;
  private config: NotificationConfig;

  constructor() {
    this.loadConfig();
  }

  private async loadConfig(): Promise<void> {
    this.config = await db.query.notificationConfig.findFirst();

    if (this.config?.discordWebhookUrl) {
      this.discord = new DiscordNotifier(this.config.discordWebhookUrl);
    }
  }

  async notifyTaskCompleted(task: Task): Promise<void> {
    if (!this.config?.taskCompleted || !this.discord) return;

    const embed = buildTaskCompletedEmbed(task);
    await this.discord.sendEmbed(embed);
  }

  async notifyQAFailed(task: Task, attempt: number, errors: string[]): Promise<void> {
    if (!this.config?.qaFailed || !this.discord) return;

    const embed = buildQAFailedEmbed(task, attempt, errors);
    await this.discord.sendEmbed(embed);
  }

  async notifyPlanProgress(planExecution: PlanExecution, step: PlanStep): Promise<void> {
    if (!this.config?.planStepCompleted || !this.discord) return;

    const embed = buildPlanProgressEmbed(planExecution, step);
    await this.discord.sendEmbed(embed);
  }

  // ... more notification methods
}

// Singleton instance
export const notifications = new NotificationService();
```

### Integration with Task Orchestrator

```typescript
// src/lib/tasks/orchestrator.ts (updated)

import { notifications } from '@/lib/notifications/service';

export async function executeTask(taskId: string): Promise<void> {
  // ... existing code

  // Notify task started
  await notifications.notifyTaskStarted(task);

  try {
    const result = await claudeWrapper.executeTask({...});

    // Run QA gates with notifications
    await runQAGatesWithNotifications(taskId, repoPath);

  } catch (error) {
    await notifications.notifyTaskFailed(task, error.message);
  }
}

async function runQAGatesWithNotifications(
  taskId: string,
  repoPath: string
): Promise<void> {
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    attempt++;

    const results = await runQAGates(taskId, repoPath);
    const allPassed = results.every(r => r.status === 'passed');

    if (allPassed) {
      await notifications.notifyQAPassed(task);
      break;
    } else {
      const errors = results
        .filter(r => r.status === 'failed')
        .flatMap(r => r.errors || []);

      await notifications.notifyQAFailed(task, attempt, errors);

      if (attempt >= MAX_RETRIES) {
        // Final failure
        await notifications.notifyQAFailedFinal(task);
        break;
      }

      // Retry with error feedback
      // ...
    }
  }
}
```

### Database Schema (Drizzle)

```typescript
// src/db/schema/notifications.ts

export const notificationConfig = sqliteTable('notification_config', {
  id: text('id').primaryKey(),
  discordWebhookUrl: text('discord_webhook_url'),

  // Event toggles
  taskStarted: integer('task_started', { mode: 'boolean' }).default(true),
  taskCompleted: integer('task_completed', { mode: 'boolean' }).default(true),
  taskRejected: integer('task_rejected', { mode: 'boolean' }).default(true),
  taskFailed: integer('task_failed', { mode: 'boolean' }).default(true),

  qaRunning: integer('qa_running', { mode: 'boolean' }).default(false),
  qaFailed: integer('qa_failed', { mode: 'boolean' }).default(true),
  qaFailedFinal: integer('qa_failed_final', { mode: 'boolean' }).default(true),
  qaPassed: integer('qa_passed', { mode: 'boolean' }).default(true),

  planStarted: integer('plan_started', { mode: 'boolean' }).default(true),
  planStepCompleted: integer('plan_step_completed', { mode: 'boolean' }).default(true),
  planFailed: integer('plan_failed', { mode: 'boolean' }).default(true),
  planCompleted: integer('plan_completed', { mode: 'boolean' }).default(true),

  // Format
  useRichEmbeds: integer('use_rich_embeds', { mode: 'boolean' }).default(true),
  includeDashboardLinks: integer('include_dashboard_links', { mode: 'boolean' }).default(true),

  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
```

## Mobile Responsive Design

Notifications are Discord's responsibility, but settings page must be mobile-friendly:

```tsx
// Mobile-first settings layout
<div className="notification-settings">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div className="webhook-config col-span-full">
      {/* Webhook URL input */}
    </div>

    <div className="notification-toggles">
      <h3>Task Events</h3>
      {/* Checkboxes */}
    </div>

    <div className="notification-toggles">
      <h3>QA Events</h3>
      {/* Checkboxes */}
    </div>
  </div>
</div>
```

## Performance Considerations

- **Non-blocking**: Notifications sent asynchronously, don't block main flow
- **Error Handling**: Failed notifications logged but don't break execution
- **Rate Limiting**: Discord allows 30 messages/min per webhook
- **Batching**: Multiple rapid events can be batched (optional)

## Edge Cases

### Scenario: Discord Webhook Invalid
**Handling**: Log error, continue execution, show warning in settings

### Scenario: Network Error
**Handling**: Retry once, then log and continue

### Scenario: Rate Limit Hit
**Handling**: Queue messages, send when rate limit resets

### Scenario: Webhook Deleted
**Handling**: Detect 404, disable notifications, alert user

## Acceptance Criteria

- [ ] Can configure Discord webhook in settings
- [ ] Can toggle individual notification types
- [ ] Test connection button works
- [ ] Task completed notifications sent
- [ ] QA failed notifications sent with retry count
- [ ] Plan progress notifications sent
- [ ] Rich embeds formatted correctly
- [ ] Links to dashboard work
- [ ] Mobile-friendly settings page
- [ ] Notifications don't block main flow

## Future Enhancements

- Multiple Discord channels (errors → #alerts, success → #dev)
- Slack integration
- Email notifications
- SMS/phone notifications
- Custom notification templates
- Notification scheduling (quiet hours)
- @mention specific users on errors
- Notification digest (daily summary)
- Telegram integration
- MS Teams integration
