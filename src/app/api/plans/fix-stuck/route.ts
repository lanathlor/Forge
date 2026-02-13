import { NextResponse } from 'next/server';
import { db } from '@/db';
import { plans, planTasks } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

type Plan = typeof plans.$inferSelect;
type PlanTask = typeof planTasks.$inferSelect;

function getTaskStats(tasks: PlanTask[]) {
  return {
    pending: tasks.filter(t => t.status === 'pending').length,
    running: tasks.filter(t => t.status === 'running').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    failed: tasks.filter(t => t.status === 'failed').length,
  };
}

async function fixCurrentTaskCompleted(plan: Plan) {
  await db
    .update(plans)
    .set({ status: 'paused', updatedAt: new Date() })
    .where(eq(plans.id, plan.id));
  return 'Current task completed but plan was failed';
}

async function fixNoFailedTasks(plan: Plan) {
  await db
    .update(plans)
    .set({ status: 'paused', currentTaskId: null, updatedAt: new Date() })
    .where(eq(plans.id, plan.id));
  return 'No failed tasks but plan was marked failed';
}

async function fixPlan(plan: Plan) {
  const tasks = await db.query.planTasks.findMany({
    where: eq(planTasks.planId, plan.id),
  });

  const taskStats = getTaskStats(tasks);
  let fixed = false;
  let reason = '';

  if (plan.currentTaskId) {
    const currentTask = tasks.find(t => t.id === plan.currentTaskId);
    if (currentTask?.status === 'completed') {
      reason = await fixCurrentTaskCompleted(plan);
      fixed = true;
    }
  }

  if (!fixed && taskStats.failed === 0 && taskStats.running === 0 && taskStats.pending > 0) {
    reason = await fixNoFailedTasks(plan);
    fixed = true;
  }

  return { planId: plan.id, title: plan.title, taskStats, fixed, reason };
}

export async function POST() {
  try {
    const recentPlans = await db
      .select()
      .from(plans)
      .orderBy(desc(plans.createdAt))
      .limit(10);

    const failedPlans = recentPlans.filter(p => p.status === 'failed');
    const results = await Promise.all(failedPlans.map(fixPlan));

    return NextResponse.json({
      success: true,
      checked: failedPlans.length,
      results,
    });
  } catch (error) {
    console.error('Error fixing stuck plans:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fix plans' },
      { status: 500 }
    );
  }
}
