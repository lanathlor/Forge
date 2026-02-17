/* eslint-disable max-lines-per-function, complexity */
import type { NextRequest } from 'next/server';
import { db } from '@/db';
import { plans, phases, planTasks, planIterations } from '@/db/schema';
import { eq } from 'drizzle-orm';

interface RefinementUpdate {
  action:
    | 'update_phase'
    | 'update_task'
    | 'create_task'
    | 'create_phase'
    | 'delete_task';
  phaseOrder?: number;
  taskOrder?: number;
  updates?: Record<string, string>;
  task?: { title: string; description: string };
  phase?: { title: string; description: string };
  label: string;
}

type PhaseRow = {
  id: string;
  order: number;
  title: string;
  description: string | null;
};
type TaskRow = {
  id: string;
  phaseId: string;
  order: number;
  title: string;
  description: string;
};

/**
 * POST /api/plans/[id]/refine/apply
 *
 * Applies a subset of proposed refinement changes to a plan.
 * Used when the user accepts individual changes from the diff view.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: planId } = await params;
  const body = await request.json();
  const { changes, prompt } = body as {
    changes: RefinementUpdate[];
    prompt: string;
  };

  try {
    const [plan] = await db
      .select()
      .from(plans)
      .where(eq(plans.id, planId))
      .limit(1);

    if (!plan) {
      return Response.json({ error: 'Plan not found' }, { status: 404 });
    }

    const planPhases = await db
      .select()
      .from(phases)
      .where(eq(phases.planId, planId))
      .orderBy(phases.order);

    const tasks = await db
      .select()
      .from(planTasks)
      .where(eq(planTasks.planId, planId));

    let applied = 0;

    for (const change of changes) {
      const success = await applyChange(change, planPhases, tasks, planId);
      if (success) applied++;
    }

    if (applied > 0) {
      await db.insert(planIterations).values({
        planId,
        iterationType: 'refine',
        prompt,
        changes: JSON.stringify(changes),
        changedBy: 'claude',
      });
    }

    return Response.json({ applied, total: changes.length });
  } catch (error) {
    console.error('Error applying refinement changes:', error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to apply changes',
      },
      { status: 500 }
    );
  }
}

function findPhaseTask(phase: PhaseRow, tasks: TaskRow[], taskOrder: number) {
  return tasks
    .filter((t) => t.phaseId === phase.id)
    .sort((a, b) => a.order - b.order)[taskOrder - 1];
}

async function applyChange(
  change: RefinementUpdate,
  planPhases: PhaseRow[],
  tasks: TaskRow[],
  planId: string
): Promise<boolean> {
  const targetPhase = change.phaseOrder
    ? planPhases.find((p) => p.order === change.phaseOrder)
    : undefined;

  switch (change.action) {
    case 'update_phase': {
      if (!targetPhase || !change.updates) return false;
      await db
        .update(phases)
        .set({ ...change.updates, updatedAt: new Date() })
        .where(eq(phases.id, targetPhase.id));
      return true;
    }
    case 'update_task': {
      if (!targetPhase || !change.taskOrder || !change.updates) return false;
      const task = findPhaseTask(targetPhase, tasks, change.taskOrder);
      if (!task) return false;
      await db
        .update(planTasks)
        .set({ ...change.updates, updatedAt: new Date() })
        .where(eq(planTasks.id, task.id));
      return true;
    }
    case 'create_task': {
      if (!targetPhase || !change.task) return false;
      const maxOrder = Math.max(
        ...tasks
          .filter((t) => t.phaseId === targetPhase.id)
          .map((t) => t.order),
        0
      );
      await db
        .insert(planTasks)
        .values({
          phaseId: targetPhase.id,
          planId,
          ...change.task,
          order: maxOrder + 1,
        });
      return true;
    }
    case 'create_phase': {
      if (!change.phase) return false;
      const maxOrder = Math.max(...planPhases.map((p) => p.order), 0);
      await db
        .insert(phases)
        .values({
          planId,
          ...change.phase,
          order: maxOrder + 1,
          executionMode: 'sequential',
          pauseAfter: false,
        });
      return true;
    }
    case 'delete_task': {
      if (!targetPhase || !change.taskOrder) return false;
      const task = findPhaseTask(targetPhase, tasks, change.taskOrder);
      if (!task) return false;
      await db.delete(planTasks).where(eq(planTasks.id, task.id));
      return true;
    }
    default:
      return false;
  }
}
