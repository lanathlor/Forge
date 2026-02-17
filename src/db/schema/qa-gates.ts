import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import { tasks } from './tasks';

export const qaGateConfigs = sqliteTable('qa_gate_configs', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull().unique(),
  enabled: integer('enabled', { mode: 'boolean' }).default(true),
  command: text('command').notNull(),
  timeout: integer('timeout').default(60000), // milliseconds
  failOnError: integer('fail_on_error', { mode: 'boolean' }).default(true),
  order: integer('order').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type QAGateStatus =
  | 'pending'
  | 'running'
  | 'passed'
  | 'failed'
  | 'skipped';

export const qaGateResults = sqliteTable('qa_gate_results', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  taskId: text('task_id').notNull(),
  gateName: text('gate_name').notNull(),
  status: text('status').$type<QAGateStatus>().notNull(),
  output: text('output'),
  errors: text('errors', { mode: 'json' }).$type<string[]>(),
  duration: integer('duration'), // milliseconds
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});

export const qaGateResultsRelations = relations(qaGateResults, ({ one }) => ({
  task: one(tasks, {
    fields: [qaGateResults.taskId],
    references: [tasks.id],
  }),
}));

export type QAGateConfig = typeof qaGateConfigs.$inferSelect;
export type NewQAGateConfig = typeof qaGateConfigs.$inferInsert;
export type QAGateResult = typeof qaGateResults.$inferSelect;
export type NewQAGateResult = typeof qaGateResults.$inferInsert;
