import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dbPath = process.env.DATABASE_URL || './dev.db';
const migrationFile = path.join(__dirname, 'migrations/0000_right_killmonger.sql');

console.log('📦 Initializing database...');

// Check if database exists
const dbExists = fs.existsSync(dbPath);

if (dbExists) {
  console.log('✅ Database already exists at:', dbPath);
  process.exit(0);
}

// Create new database
const db = new Database(dbPath);

// Read and execute migration
const migration = fs.readFileSync(migrationFile, 'utf-8');

// Split by statements and execute
const statements = migration
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

for (const statement of statements) {
  try {
    db.exec(statement);
  } catch (error) {
    console.error('Error executing statement:', statement);
    throw error;
  }
}

db.close();

console.log('✅ Database initialized successfully!');
console.log('   Location:', dbPath);

process.exit(0);
