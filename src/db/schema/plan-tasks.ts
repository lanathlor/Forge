import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import { plans } from './plans';
import { phases } from './phases';

export type PlanTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export const planTasks = sqliteTable('plan_tasks', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  phaseId: text('phase_id').notNull(),
  planId: text('plan_id').notNull(), // denormalized for easier queries
  order: integer('order').notNull(), // 1, 2, 3... within phase
  title: text('title').notNull(),
  description: text('description').notNull(), // detailed instructions for Claude
  status: text('status').$type<PlanTaskStatus>().notNull().default('pending'),

  // Dependencies & parallelization
  dependsOn: text('depends_on', { mode: 'json' }).$type<string[]>(),
  canRunInParallel: integer('can_run_in_parallel', { mode: 'boolean' }).notNull().default(false),

  // Execution tracking
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  lastQaResults: text('last_qa_results', { mode: 'json' }),

  // Results
  sessionId: text('session_id'), // Session that executed this task
  taskId: text('task_id'), // Task ID in the sessions/tasks system (for timeline visibility)
  commitSha: text('commit_sha'),

  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
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
