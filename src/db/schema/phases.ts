import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import { plans } from './plans';
import { planTasks } from './plan-tasks';

export type PhaseStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused';
export type ExecutionMode = 'sequential' | 'parallel' | 'manual';

export const phases = sqliteTable('phases', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  planId: text('plan_id').notNull(),
  order: integer('order').notNull(), // 1, 2, 3...
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').$type<PhaseStatus>().notNull().default('pending'),

  // Execution configuration
  executionMode: text('execution_mode').$type<ExecutionMode>().notNull().default('sequential'),
  pauseAfter: integer('pause_after', { mode: 'boolean' }).notNull().default(false),

  // Stats
  totalTasks: integer('total_tasks').notNull().default(0),
  completedTasks: integer('completed_tasks').notNull().default(0),
  failedTasks: integer('failed_tasks').notNull().default(0),

  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const phasesRelations = relations(phases, ({ one, many }) => ({
  plan: one(plans, {
    fields: [phases.planId],
    references: [plans.id],
  }),
  tasks: many(planTasks),
}));

export type Phase = typeof phases.$inferSelect;
export type NewPhase = typeof phases.$inferInsert;
