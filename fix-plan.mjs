/* eslint-disable no-undef */
import Database from 'better-sqlite3';

const db = new Database('./dev.db');

console.log('Checking plans...\n');

// Get all plans
const plans = db
  .prepare(
    'SELECT id, title, status, current_task_id as currentTaskId FROM plans ORDER BY created_at DESC LIMIT 10'
  )
  .all();

console.log('Recent plans:');
plans.forEach((p) => {
  console.log(`  ${p.id.substring(0, 8)}: "${p.title}" - ${p.status}`);
});

// Find failed plans
const failedPlans = plans.filter((p) => p.status === 'failed');

if (failedPlans.length === 0) {
  console.log('\nNo failed plans found.');
  process.exit(0);
}

console.log(`\n\nFound ${failedPlans.length} failed plan(s):\n`);

for (const plan of failedPlans) {
  console.log(`\n=== Plan: "${plan.title}" (${plan.id.substring(0, 8)}) ===`);

  // Get tasks for this plan
  const tasks = db
    .prepare(
      'SELECT id, title, status FROM plan_tasks WHERE plan_id = ? ORDER BY "order"'
    )
    .all(plan.id);

  const stats = {
    pending: tasks.filter((t) => t.status === 'pending').length,
    running: tasks.filter((t) => t.status === 'running').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    failed: tasks.filter((t) => t.status === 'failed').length,
  };

  console.log(
    `Tasks: ${stats.completed} completed, ${stats.failed} failed, ${stats.running} running, ${stats.pending} pending`
  );

  // Check current task
  if (plan.currentTaskId) {
    const currentTask = tasks.find((t) => t.id === plan.currentTaskId);
    if (currentTask) {
      console.log(
        `Current blocking task: "${currentTask.title}" - ${currentTask.status}`
      );

      if (currentTask.status === 'completed') {
        console.log(
          '⚠️  FIXING: Current task is completed but plan is failed!'
        );
        db.prepare(
          'UPDATE plans SET status = ?, updated_at = ? WHERE id = ?'
        ).run('paused', Date.now(), plan.id);
        console.log('✅ Fixed! Plan set to paused.');
      } else if (currentTask.status === 'failed') {
        console.log('Current task is failed, setting plan to paused...');
        db.prepare(
          'UPDATE plans SET status = ?, updated_at = ? WHERE id = ?'
        ).run('paused', Date.now(), plan.id);
        console.log('✅ Plan set to paused.');
      }
    }
  }

  // If no failed tasks but plan is failed, fix it
  if (stats.failed === 0 && stats.running === 0 && stats.pending > 0) {
    console.log('⚠️  FIXING: No failed tasks but plan is marked failed!');
    db.prepare(
      'UPDATE plans SET status = ?, current_task_id = NULL, updated_at = ? WHERE id = ?'
    ).run('paused', Date.now(), plan.id);
    console.log('✅ Fixed! Plan set to paused.');
  }
}

console.log('\n\nDone!');
db.close();
