import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { repositories } from './repositories';

export type QARunStatus = 'running' | 'passed' | 'failed' | 'cancelled';
export type QAGateExecutionStatus =
  | 'pending'
  | 'running'
  | 'passed'
  | 'failed'
  | 'skipped';

export const qaRuns = pgTable('qa_runs', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  repositoryId: text('repository_id')
    .notNull()
    .references(() => repositories.id),
  status: text('status').$type<QARunStatus>().notNull(),
  startedAt: timestamp('started_at', { mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date()),
  completedAt: timestamp('completed_at', { mode: 'date' }),
  duration: integer('duration'),
});

export const qaGateExecutions = pgTable('qa_gate_executions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  runId: text('run_id')
    .notNull()
    .references(() => qaRuns.id),
  gateName: text('gate_name').notNull(),
  command: text('command').notNull(),
  status: text('status').$type<QAGateExecutionStatus>().notNull(),
  output: text('output'),
  error: text('error'),
  exitCode: integer('exit_code'),
  duration: integer('duration'),
  startedAt: timestamp('started_at', { mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date()),
  completedAt: timestamp('completed_at', { mode: 'date' }),
  order: integer('order').notNull(),
});

export const qaRunsRelations = relations(qaRuns, ({ one, many }) => ({
  repository: one(repositories, {
    fields: [qaRuns.repositoryId],
    references: [repositories.id],
  }),
  gateExecutions: many(qaGateExecutions),
}));

export const qaGateExecutionsRelations = relations(
  qaGateExecutions,
  ({ one }) => ({
    run: one(qaRuns, {
      fields: [qaGateExecutions.runId],
      references: [qaRuns.id],
    }),
  })
);

export type QARun = typeof qaRuns.$inferSelect;
export type NewQARun = typeof qaRuns.$inferInsert;
export type QAGateExecution = typeof qaGateExecutions.$inferSelect;
export type NewQAGateExecution = typeof qaGateExecutions.$inferInsert;
