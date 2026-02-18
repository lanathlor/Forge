import { pgTable, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { plans } from './plans';
import { planTasks } from './plan-tasks';

export type PhaseStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'paused';
export type ExecutionMode = 'sequential' | 'parallel' | 'manual';

export const phases = pgTable('phases', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  planId: text('plan_id').notNull(),
  order: integer('order').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').$type<PhaseStatus>().notNull().default('pending'),
  executionMode: text('execution_mode')
    .$type<ExecutionMode>()
    .notNull()
    .default('sequential'),
  pauseAfter: boolean('pause_after').notNull().default(false),
  totalTasks: integer('total_tasks').notNull().default(0),
  completedTasks: integer('completed_tasks').notNull().default(0),
  failedTasks: integer('failed_tasks').notNull().default(0),
  startedAt: timestamp('started_at', { mode: 'date' }),
  completedAt: timestamp('completed_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { mode: 'date' })
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
