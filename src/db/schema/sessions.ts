import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import { repositories } from './repositories';
import { tasks } from './tasks';

export type SessionStatus = 'active' | 'paused' | 'completed' | 'abandoned';

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  repositoryId: text('repository_id').notNull(),
  status: text('status').$type<SessionStatus>().notNull().default('active'),
  startBranch: text('start_branch'),
  endBranch: text('end_branch'),
  startedAt: integer('started_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  endedAt: integer('ended_at', { mode: 'timestamp' }),
  lastActivity: integer('last_activity', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
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
