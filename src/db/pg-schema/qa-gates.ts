import { pgTable, text, boolean, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { tasks } from './tasks';

export const qaGateConfigs = pgTable('qa_gate_configs', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull().unique(),
  enabled: boolean('enabled').default(true),
  command: text('command').notNull(),
  timeout: integer('timeout').default(60000),
  failOnError: boolean('fail_on_error').default(true),
  order: integer('order').default(0),
  createdAt: timestamp('created_at', { mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type QAGateStatus =
  | 'pending'
  | 'running'
  | 'passed'
  | 'failed'
  | 'skipped';

export const qaGateResults = pgTable('qa_gate_results', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  taskId: text('task_id').notNull(),
  gateName: text('gate_name').notNull(),
  status: text('status').$type<QAGateStatus>().notNull(),
  output: text('output'),
  errors: jsonb('errors').$type<string[]>(),
  duration: integer('duration'),
  createdAt: timestamp('created_at', { mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date()),
  completedAt: timestamp('completed_at', { mode: 'date' }),
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
