import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import { repositories } from './repositories';

export type QARunStatus = 'running' | 'passed' | 'failed' | 'cancelled';
export type QAGateExecutionStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

export const qaRuns = sqliteTable('qa_runs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  repositoryId: text('repository_id').notNull().references(() => repositories.id),
  status: text('status').$type<QARunStatus>().notNull(),
  startedAt: integer('started_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  duration: integer('duration'), // milliseconds
});

export const qaGateExecutions = sqliteTable('qa_gate_executions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  runId: text('run_id').notNull().references(() => qaRuns.id),
  gateName: text('gate_name').notNull(),
  command: text('command').notNull(),
  status: text('status').$type<QAGateExecutionStatus>().notNull(),
  output: text('output'),
  error: text('error'),
  exitCode: integer('exit_code'),
  duration: integer('duration'), // milliseconds
  startedAt: integer('started_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  order: integer('order').notNull(),
});

export const qaRunsRelations = relations(qaRuns, ({ one, many }) => ({
  repository: one(repositories, {
    fields: [qaRuns.repositoryId],
    references: [repositories.id],
  }),
  gateExecutions: many(qaGateExecutions),
}));

export const qaGateExecutionsRelations = relations(qaGateExecutions, ({ one }) => ({
  run: one(qaRuns, {
    fields: [qaGateExecutions.runId],
    references: [qaRuns.id],
  }),
}));

export type QARun = typeof qaRuns.$inferSelect;
export type NewQARun = typeof qaRuns.$inferInsert;
export type QAGateExecution = typeof qaGateExecutions.$inferSelect;
export type NewQAGateExecution = typeof qaGateExecutions.$inferInsert;
