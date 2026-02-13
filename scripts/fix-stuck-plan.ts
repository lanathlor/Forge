import { db } from '../src/db';
import { plans, planTasks } from '../src/db/schema';
import { eq, desc } from 'drizzle-orm';

type Plan = typeof plans.$inferSelect;
type PlanTask = typeof planTasks.$inferSelect;

async function getRecentPlans() {
  return db
    .select()
    .from(plans)
    .orderBy(desc(plans.createdAt))
    .limit(5);
}

function getTaskStats(tasks: PlanTask[]) {
  return {
    pending: tasks.filter(t => t.status === 'pending').length,
    running: tasks.filter(t => t.status === 'running').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    failed: tasks.filter(t => t.status === 'failed').length,
  };
}

async function fixCurrentTaskCompleted(plan: Plan) {
  console.log('⚠️  ISSUE: Current task is completed but plan is still failed!');
  console.log('Fixing: Setting plan to paused so it can be resumed...');

  await db
    .update(plans)
    .set({ status: 'paused', updatedAt: new Date() })
    .where(eq(plans.id, plan.id));

  console.log('✅ Fixed! Plan is now paused. Auto-resume should trigger on next task completion.');
}

async function fixNoFailedTasks(plan: Plan) {
  console.log('⚠️  ISSUE: No failed tasks but plan is marked as failed. Should be paused or running.');
  console.log('Fixing: Setting plan to paused...');

  await db
    .update(plans)
    .set({ status: 'paused', currentTaskId: null, updatedAt: new Date() })
    .where(eq(plans.id, plan.id));

  console.log('✅ Fixed! Plan is now paused.');
}

async function fixPlan(plan: Plan) {
  console.log(`\n--- Plan: ${plan.title} ---`);

  const tasks = await db.query.planTasks.findMany({
    where: eq(planTasks.planId, plan.id),
  });

  const stats = getTaskStats(tasks);
  console.log(`Tasks: ${stats.completed} completed, ${stats.failed} failed, ${stats.running} running, ${stats.pending} pending`);

  if (plan.currentTaskId) {
    const currentTask = tasks.find(t => t.id === plan.currentTaskId);
    if (currentTask) {
      console.log(`Current blocking task: "${currentTask.title}" - Status: ${currentTask.status}`);
      if (currentTask.status === 'completed') {
        await fixCurrentTaskCompleted(plan);
      }
    }
  }

  if (stats.failed === 0 && stats.running === 0 && stats.pending > 0) {
    await fixNoFailedTasks(plan);
  }
}

async function main() {
  console.log('Checking for stuck plans...\n');

  const recentPlans = await getRecentPlans();

  console.log('Recent plans:');
  for (const plan of recentPlans) {
    console.log(`- ${plan.id}: "${plan.title}" - Status: ${plan.status}, CurrentTask: ${plan.currentTaskId || 'none'}`);
  }

  const failedPlans = recentPlans.filter(p => p.status === 'failed');

  if (failedPlans.length === 0) {
    console.log('\nNo failed plans found.');
    return;
  }

  console.log(`\nFound ${failedPlans.length} failed plan(s). Checking their tasks...`);

  for (const plan of failedPlans) {
    await fixPlan(plan);
  }

  console.log('\nDone!');
}

main().catch(console.error);
