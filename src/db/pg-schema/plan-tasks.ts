import { pgTable, text, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { plans } from './plans';
import { phases } from './phases';

export type PlanTaskStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

export const planTasks = pgTable('plan_tasks', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  phaseId: text('phase_id').notNull(),
  planId: text('plan_id').notNull(),
  order: integer('order').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  status: text('status').$type<PlanTaskStatus>().notNull().default('pending'),
  dependsOn: jsonb('depends_on').$type<string[]>(),
  canRunInParallel: boolean('can_run_in_parallel').notNull().default(false),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  lastQaResults: jsonb('last_qa_results'),
  sessionId: text('session_id'),
  taskId: text('task_id'),
  commitSha: text('commit_sha'),
  startedAt: timestamp('started_at', { mode: 'date' }),
  completedAt: timestamp('completed_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const planTasksRelations = relations(planTasks, ({ one }) => ({
  phase: one(phases, {
    fields: [planTasks.phaseId],
    references: [phases.id],
  }),
  plan: one(plans, {
    fields: [planTasks.planId],
    references: [plans.id],
  }),
}));

export type PlanTask = typeof planTasks.$inferSelect;
export type NewPlanTask = typeof planTasks.$inferInsert;
