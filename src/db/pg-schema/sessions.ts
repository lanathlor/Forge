import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { repositories } from './repositories';
import { tasks } from './tasks';

export type SessionStatus = 'active' | 'paused' | 'completed' | 'abandoned';

export const sessions = pgTable('sessions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  repositoryId: text('repository_id').notNull(),
  status: text('status').$type<SessionStatus>().notNull().default('active'),
  startBranch: text('start_branch'),
  endBranch: text('end_branch'),
  startedAt: timestamp('started_at', { mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date()),
  endedAt: timestamp('ended_at', { mode: 'date' }),
  lastActivity: timestamp('last_activity', { mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date()),
  createdAt: timestamp('created_at', { mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  repository: one(repositories, {
    fields: [sessions.repositoryId],
    references: [repositories.id],
  }),
  tasks: many(tasks),
}));

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
