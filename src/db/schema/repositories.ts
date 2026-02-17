import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const repositories = sqliteTable('repositories', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  path: text('path').notNull().unique(),
  currentBranch: text('current_branch'),
  lastCommitSha: text('last_commit_sha'),
  lastCommitMsg: text('last_commit_msg'),
  lastCommitAuthor: text('last_commit_author'),
  lastCommitTimestamp: integer('last_commit_timestamp', { mode: 'timestamp' }),
  isClean: integer('is_clean', { mode: 'boolean' }).default(true),
  uncommittedFiles: text('uncommitted_files'), // JSON string array
  lastScanned: integer('last_scanned', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Repository = typeof repositories.$inferSelect;
export type NewRepository = typeof repositories.$inferInsert;
