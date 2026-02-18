import { pgTable, text, boolean, timestamp } from 'drizzle-orm/pg-core';

export const repositories = pgTable('repositories', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  path: text('path').notNull().unique(),
  currentBranch: text('current_branch'),
  lastCommitSha: text('last_commit_sha'),
  lastCommitMsg: text('last_commit_msg'),
  lastCommitAuthor: text('last_commit_author'),
  lastCommitTimestamp: timestamp('last_commit_timestamp', { mode: 'date' }),
  isClean: boolean('is_clean').default(true),
  uncommittedFiles: text('uncommitted_files'), // JSON string array
  lastScanned: timestamp('last_scanned', { mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date()),
  createdAt: timestamp('created_at', { mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Repository = typeof repositories.$inferSelect;
export type NewRepository = typeof repositories.$inferInsert;
