import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import { sessions } from './sessions';

export type TaskStatus =
  | 'pending'
  | 'pre_flight'
  | 'running'
  | 'waiting_qa'
  | 'qa_running'
  | 'qa_failed'
  | 'waiting_approval'
  | 'approved'
  | 'completed'
  | 'rejected'
  | 'failed'
  | 'cancelled';

export interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  oldPath?: string; // For renamed files
  patch: string; // Individual file diff
}

export const tasks = sqliteTable('tasks', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  sessionId: text('session_id').notNull(),
  prompt: text('prompt').notNull(),
  status: text('status').$type<TaskStatus>().notNull().default('pending'),

  // QA retry tracking
  currentQAAttempt: integer('current_qa_attempt').default(1),

  // Output
  claudeOutput: text('claude_output'),

  // Git state
  startingCommit: text('starting_commit'),
  startingBranch: text('starting_branch'),
  filesChanged: text('files_changed', { mode: 'json' }).$type<FileChange[]>(),
  diffContent: text('diff_content'),

  // Commit info
  committedSha: text('committed_sha'),
  commitMessage: text('commit_message'),

  // Rejection
  rejectedAt: integer('rejected_at', { mode: 'timestamp' }),
  rejectionReason: text('rejection_reason'),

  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});

export const tasksRelations = relations(tasks, ({ one }) => ({
  session: one(sessions, {
    fields: [tasks.sessionId],
    references: [sessions.id],
  }),
}));

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
