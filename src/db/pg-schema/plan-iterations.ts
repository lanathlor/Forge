import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { plans } from './plans';

export type IterationType = 'generation' | 'review' | 'refine' | 'user_edit';
export type ChangedBy = 'user' | 'claude';

export const planIterations = pgTable('plan_iterations', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  planId: text('plan_id').notNull(),
  iterationType: text('iteration_type').$type<IterationType>().notNull(),
  prompt: text('prompt'),
  changes: jsonb('changes'),
  changedBy: text('changed_by').$type<ChangedBy>().notNull(),
  createdAt: timestamp('created_at', { mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const planIterationsRelations = relations(planIterations, ({ one }) => ({
  plan: one(plans, {
    fields: [planIterations.planId],
    references: [plans.id],
  }),
}));

export type PlanIteration = typeof planIterations.$inferSelect;
export type NewPlanIteration = typeof planIterations.$inferInsert;
