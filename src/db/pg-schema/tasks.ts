import { pgTable, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';
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
  oldPath?: string;
  patch: string;
}

export const tasks = pgTable('tasks', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  sessionId: text('session_id').notNull(),
  prompt: text('prompt').notNull(),
  status: text('status').$type<TaskStatus>().notNull().default('pending'),
  currentQAAttempt: integer('current_qa_attempt').default(1),
  claudeOutput: text('claude_output'),
  startingCommit: text('starting_commit'),
  startingBranch: text('starting_branch'),
  filesChanged: jsonb('files_changed').$type<FileChange[]>(),
  diffContent: text('diff_content'),
  committedSha: text('committed_sha'),
  commitMessage: text('commit_message'),
  rejectedAt: timestamp('rejected_at', { mode: 'date' }),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at', { mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date()),
  startedAt: timestamp('started_at', { mode: 'date' }),
  completedAt: timestamp('completed_at', { mode: 'date' }),
});

export const tasksRelations = relations(tasks, ({ one }) => ({
  session: one(sessions, {
    fields: [tasks.sessionId],
    references: [sessions.id],
  }),
}));

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
