/* eslint-disable max-lines-per-function */
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

console.log('📦 Initializing PostgreSQL database...');

const sql = postgres(url);

async function init() {
  // Create all tables using IF NOT EXISTS — idempotent, safe to re-run
  await sql`
    CREATE TABLE IF NOT EXISTS repositories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      current_branch TEXT,
      last_commit_sha TEXT,
      last_commit_msg TEXT,
      last_commit_author TEXT,
      last_commit_timestamp TIMESTAMP,
      is_clean BOOLEAN DEFAULT TRUE,
      uncommitted_files TEXT,
      last_scanned TIMESTAMP NOT NULL,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      repository_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      start_branch TEXT,
      end_branch TEXT,
      started_at TIMESTAMP NOT NULL,
      ended_at TIMESTAMP,
      last_activity TIMESTAMP NOT NULL,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      prompt TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      current_qa_attempt INTEGER DEFAULT 1,
      claude_output TEXT,
      starting_commit TEXT,
      starting_branch TEXT,
      files_changed JSONB,
      diff_content TEXT,
      committed_sha TEXT,
      commit_message TEXT,
      rejected_at TIMESTAMP,
      rejection_reason TEXT,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL,
      started_at TIMESTAMP,
      completed_at TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS qa_gate_configs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      enabled BOOLEAN DEFAULT TRUE,
      command TEXT NOT NULL,
      timeout INTEGER DEFAULT 60000,
      fail_on_error BOOLEAN DEFAULT TRUE,
      "order" INTEGER DEFAULT 0,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS qa_gate_results (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      gate_name TEXT NOT NULL,
      status TEXT NOT NULL,
      output TEXT,
      errors JSONB,
      duration INTEGER,
      created_at TIMESTAMP NOT NULL,
      completed_at TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS qa_runs (
      id TEXT PRIMARY KEY,
      repository_id TEXT NOT NULL REFERENCES repositories(id),
      status TEXT NOT NULL,
      started_at TIMESTAMP NOT NULL,
      completed_at TIMESTAMP,
      duration INTEGER
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS qa_gate_executions (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES qa_runs(id),
      gate_name TEXT NOT NULL,
      command TEXT NOT NULL,
      status TEXT NOT NULL,
      output TEXT,
      error TEXT,
      exit_code INTEGER,
      duration INTEGER,
      started_at TIMESTAMP NOT NULL,
      completed_at TIMESTAMP,
      "order" INTEGER NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      repository_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_by TEXT NOT NULL DEFAULT 'user',
      source_file TEXT,
      current_phase_id TEXT,
      current_task_id TEXT,
      starting_commit TEXT,
      total_phases INTEGER NOT NULL DEFAULT 0,
      completed_phases INTEGER NOT NULL DEFAULT 0,
      total_tasks INTEGER NOT NULL DEFAULT 0,
      completed_tasks INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL,
      started_at TIMESTAMP,
      completed_at TIMESTAMP
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS phases (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      "order" INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      execution_mode TEXT NOT NULL DEFAULT 'sequential',
      pause_after BOOLEAN NOT NULL DEFAULT FALSE,
      total_tasks INTEGER NOT NULL DEFAULT 0,
      completed_tasks INTEGER NOT NULL DEFAULT 0,
      failed_tasks INTEGER NOT NULL DEFAULT 0,
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS plan_tasks (
      id TEXT PRIMARY KEY,
      phase_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      "order" INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      depends_on JSONB,
      can_run_in_parallel BOOLEAN NOT NULL DEFAULT FALSE,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      last_qa_results JSONB,
      session_id TEXT,
      task_id TEXT,
      commit_sha TEXT,
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL,
      updated_at TIMESTAMP NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS plan_iterations (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      iteration_type TEXT NOT NULL,
      prompt TEXT,
      changes JSONB,
      changed_by TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL
    )
  `;

  console.log('✅ PostgreSQL schema is ready');
  await sql.end();
  process.exit(0);
}

init().catch((err) => {
  console.error('❌ PostgreSQL init failed:', err);
  process.exit(1);
});
