import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import { repositories } from './repositories';
import { phases } from './phases';
import { planTasks } from './plan-tasks';
import { planIterations } from './plan-iterations';

export type PlanStatus =
  | 'draft'
  | 'ready'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed';
export type PlanCreatedBy = 'user' | 'claude' | 'api';

export const plans = sqliteTable('plans', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  repositoryId: text('repository_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').$type<PlanStatus>().notNull().default('draft'),

  // Metadata
  createdBy: text('created_by')
    .$type<PlanCreatedBy>()
    .notNull()
    .default('user'),
  sourceFile: text('source_file'), // if imported from markdown

  // Execution state
  currentPhaseId: text('current_phase_id'),
  currentTaskId: text('current_task_id'),
  startingCommit: text('starting_commit'),

  // Stats
  totalPhases: integer('total_phases').notNull().default(0),
  completedPhases: integer('completed_phases').notNull().default(0),
  totalTasks: integer('total_tasks').notNull().default(0),
  completedTasks: integer('completed_tasks').notNull().default(0),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});

export const plansRelations = relations(plans, ({ one, many }) => ({
  repository: one(repositories, {
    fields: [plans.repositoryId],
    references: [repositories.id],
  }),
  phases: many(phases),
  tasks: many(planTasks),
  iterations: many(planIterations),
}));

export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;
