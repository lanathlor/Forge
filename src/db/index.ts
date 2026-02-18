import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { default as PgDefault } from 'postgres';
import type { drizzle as DrizzlePg } from 'drizzle-orm/postgres-js';
import Database from 'better-sqlite3';
import * as sqliteSchema from './schema';
import * as pgSchema from './pg-schema';

// Re-export schema types so callers can still import from '@/db'
export * from './schema';

let _db: BetterSQLite3Database<typeof sqliteSchema> | null = null;

function isPostgresUrl(url: string): boolean {
  return url.startsWith('postgres://') || url.startsWith('postgresql://');
}

/**
 * Patch SQLite schema columns so they work correctly with the PostgreSQL driver.
 *
 * SQLite stores timestamps as Unix-seconds integers and booleans as 0/1 integers.
 * The column objects have `mapToDriverValue` / `mapFromDriverValue` on their
 * prototype that performs those conversions. When the same column objects are used
 * with the postgres-js driver, postgres-js receives a plain number for a TIMESTAMP
 * parameter and calls `Buffer.from(number, 'utf8')`, which throws ERR_INVALID_ARG_TYPE.
 *
 * By adding own-property overrides we shadow the prototype methods for the lifetime
 * of this process (which only ever connects to one database type).
 */
function patchSchemaForPg(): void {
  for (const tableOrValue of Object.values(sqliteSchema)) {
    if (!tableOrValue || typeof tableOrValue !== 'object') continue;
    for (const col of Object.values(tableOrValue as object)) {
      if (!col || typeof col !== 'object') continue;
      const c = col as Record<string, unknown>;

      if (c.columnType === 'SQLiteTimestamp') {
        // mapToDriverValue: return ISO string so postgres-js handles it as a text
        // timestamp parameter regardless of which internal encoding path it uses.
        c.mapToDriverValue = (val: unknown): unknown => {
          if (val instanceof Date) return val.toISOString();
          return val;
        };
        // mapFromDriverValue: handle Date (from PG) or number (from SQLite raw reads)
        c.mapFromDriverValue = (val: unknown): unknown => {
          if (val instanceof Date) return val;
          if (typeof val === 'number') return new Date(val * 1000);
          if (typeof val === 'string') return new Date(val);
          return val;
        };
      } else if (c.columnType === 'SQLiteBoolean') {
        // mapToDriverValue: return boolean directly; postgres-js infers OID 16
        c.mapToDriverValue = (val: unknown): unknown => val;
        // mapFromDriverValue: handle boolean (from PG) or number (from SQLite raw reads)
        c.mapFromDriverValue = (val: unknown): unknown => {
          if (typeof val === 'boolean') return val;
          if (typeof val === 'number') return val === 1;
          return val;
        };
      }
    }
  }
}

function getDb(): BetterSQLite3Database<typeof sqliteSchema> {
  if (!_db) {
    const url = process.env.DATABASE_URL || './dev.db';

    if (isPostgresUrl(url)) {
      patchSchemaForPg();
      // Lazy-load postgres and drizzle-orm/postgres-js so that SQLite environments
      // do not require the postgres package to be installed.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pg = require('postgres') as typeof PgDefault;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { drizzle: drizzlePg } = require('drizzle-orm/postgres-js') as { drizzle: typeof DrizzlePg };
      // Cast to the SQLite type: the query API and inferred column types
      // (string, Date, boolean, number) are compatible between drivers,
      // so the rest of the codebase sees consistent TypeScript types.
      _db = drizzlePg(pg(url), {
        schema: pgSchema,
      }) as unknown as BetterSQLite3Database<typeof sqliteSchema>;
    } else {
      _db = drizzleSqlite(new Database(url), { schema: sqliteSchema });
    }
  }
  return _db;
}

export const db = new Proxy({} as BetterSQLite3Database<typeof sqliteSchema>, {
  get(_target, prop, receiver) {
    const realDb = getDb();
    const value = Reflect.get(realDb, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(realDb);
    }
    return value;
  },
});
