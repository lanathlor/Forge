import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dbPath = process.env.DATABASE_URL || './dev.db';
const migrationsDir = path.join(__dirname, 'migrations');
const journalPath = path.join(migrationsDir, 'meta/_journal.json');

console.log('📦 Initializing database...');

const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create migrations tracking table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS __drizzle_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash TEXT NOT NULL UNIQUE,
    created_at INTEGER
  )
`);

// Read journal to get all migrations in order
const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8')) as {
  entries: Array<{ idx: number; tag: string; when: number }>;
};

// Get already-tracked migrations
const appliedRows = db
  .prepare('SELECT hash FROM __drizzle_migrations')
  .all() as Array<{ hash: string }>;
const applied = new Set(appliedRows.map((r) => r.hash));

// Bootstrap: if tracking table is empty but the DB already has tables from a
// previous run of the old init script, detect which migrations are already
// applied by inspecting the schema so we don't try to re-create existing objects.
if (applied.size === 0) {
  const hasRepositories = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='repositories'"
    )
    .get();

  if (hasRepositories) {
    console.log(
      '  Legacy database detected – bootstrapping migration history...'
    );

    const tableExists = (table: string): boolean =>
      !!db
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`
        )
        .get();

    const columnExists = (table: string, column: string): boolean =>
      !!(
        db
          .prepare(
            `SELECT name FROM pragma_table_info('${table}') WHERE name='${column}'`
          )
          .get() as { name: string } | undefined
      );

    // Map each migration tag to a predicate that returns true if it has
    // already been applied to the database.
    const alreadyApplied: Record<string, () => boolean> = {
      '0000_right_killmonger': () => tableExists('repositories'),
      '0001_loving_old_lace': () => tableExists('qa_runs'),
      '0002_loose_mother_askani': () =>
        columnExists('repositories', 'last_commit_author'),
      '0003_peaceful_grey_gargoyle': () => tableExists('plans'),
      '0004_flimsy_charles_xavier': () =>
        columnExists('plan_tasks', 'task_id'),
    };

    const bootstrap = db.transaction(() => {
      for (const entry of journal.entries) {
        const check = alreadyApplied[entry.tag];
        if (check && check()) {
          db.prepare(
            'INSERT OR IGNORE INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)'
          ).run(entry.tag, Date.now());
          applied.add(entry.tag);
          console.log(`  Marked as applied: ${entry.tag}`);
        }
      }
    });

    bootstrap();
  }
}

// Apply any migrations that haven't been applied yet
let newMigrations = 0;

for (const entry of journal.entries) {
  if (applied.has(entry.tag)) {
    continue;
  }

  const migrationFile = path.join(migrationsDir, `${entry.tag}.sql`);
  const sql = fs.readFileSync(migrationFile, 'utf-8');

  // Drizzle uses `--> statement-breakpoint` as a separator marker; splitting
  // on `;` still works because the marker starts with `--` (SQL comment).
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  console.log(`  Applying migration: ${entry.tag}`);

  const applyMigration = db.transaction(() => {
    for (const statement of statements) {
      db.exec(statement);
    }
    db.prepare(
      'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)'
    ).run(entry.tag, Date.now());
  });

  applyMigration();
  newMigrations++;
}

db.close();

if (newMigrations > 0) {
  console.log(`✅ Applied ${newMigrations} new migration(s)`);
} else {
  console.log('✅ Database is up to date');
}
console.log('   Location:', dbPath);

process.exit(0);
