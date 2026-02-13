/* eslint-disable max-lines-per-function */
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { plans, phases, planTasks, planIterations } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { generatePlanFromDescription } from '@/lib/plans/generator';
import { reviewPlan, applySuggestions, type ReviewType } from '@/lib/plans/reviewer';
import { planExecutor } from '@/lib/plans/executor';

// ============================================================================
// Plans
// ============================================================================

/**
 * Enriches a plan with dynamically calculated metadata from actual tasks and phases.
 * This ensures the counts are always accurate even if DB fields get out of sync.
 */
async function enrichPlanWithCalculatedMetadata(plan: typeof plans.$inferSelect) {
  // Get actual phases count
  const allPhases = await db
    .select()
    .from(phases)
    .where(eq(phases.planId, plan.id));

  const completedPhasesCount = allPhases.filter(p => p.status === 'completed').length;

  // Get actual tasks count
  const allTasks = await db
    .select()
    .from(planTasks)
    .where(eq(planTasks.planId, plan.id));

  const completedTasksCount = allTasks.filter(t => t.status === 'completed').length;

  // Return plan with calculated metadata
  return {
    ...plan,
    totalPhases: allPhases.length,
    completedPhases: completedPhasesCount,
    totalTasks: allTasks.length,
    completedTasks: completedTasksCount,
  };
}

export async function handleGetPlans(repositoryId?: string) {
  try {
    const query = repositoryId
      ? db.select().from(plans).where(eq(plans.repositoryId, repositoryId)).orderBy(desc(plans.createdAt))
      : db.select().from(plans).orderBy(desc(plans.createdAt));

    const allPlans = await query;

    // Enrich each plan with calculated metadata
    const enrichedPlans = await Promise.all(
      allPlans.map(plan => enrichPlanWithCalculatedMetadata(plan))
    );

    return NextResponse.json({ plans: enrichedPlans });
  } catch (error) {
    console.error('Error fetching plans:', error);
    return NextResponse.json(
      { error: 'Failed to fetch plans' },
      { status: 500 }
    );
  }
}

export async function handleGetPlan(planId: string) {
  try {
    const [plan] = await db
      .select()
      .from(plans)
      .where(eq(plans.id, planId))
      .limit(1);

    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    // Load related data
    const planPhases = await db
      .select()
      .from(phases)
      .where(eq(phases.planId, planId))
      .orderBy(phases.order);

    const tasks = await db
      .select()
      .from(planTasks)
      .where(eq(planTasks.planId, planId))
      .orderBy(planTasks.order);

    const iterations = await db
      .select()
      .from(planIterations)
      .where(eq(planIterations.planId, planId))
      .orderBy(desc(planIterations.createdAt));

    // Enrich plan with calculated metadata from actual tasks and phases
    const enrichedPlan = await enrichPlanWithCalculatedMetadata(plan);

    return NextResponse.json({
      plan: enrichedPlan,
      phases: planPhases,
      tasks,
      iterations,
    });
  } catch (error) {
    console.error('Error fetching plan:', error);
    return NextResponse.json(
      { error: 'Failed to fetch plan' },
      { status: 500 }
    );
  }
}

export async function handleCreatePlan(data: {
  repositoryId: string;
  title: string;
  description?: string;
  createdBy?: 'user' | 'claude' | 'api';
}) {
  try {
    const [plan] = await db
      .insert(plans)
      .values({
        repositoryId: data.repositoryId,
        title: data.title,
        description: data.description,
        createdBy: data.createdBy || 'user',
        status: 'draft',
      })
      .returning();

    return NextResponse.json({ plan }, { status: 201 });
  } catch (error) {
    console.error('Error creating plan:', error);
    return NextResponse.json(
      { error: 'Failed to create plan' },
      { status: 500 }
    );
  }
}

export async function handleGeneratePlan(data: {
  repositoryId: string;
  title: string;
  description: string;
}) {
  try {
    const planId = await generatePlanFromDescription(
      data.repositoryId,
      data.title,
      data.description
    );

    // Fetch the complete plan with phases and tasks
    const [plan] = await db
      .select()
      .from(plans)
      .where(eq(plans.id, planId))
      .limit(1);

    const planPhases = await db
      .select()
      .from(phases)
      .where(eq(phases.planId, planId))
      .orderBy(phases.order);

    const tasks = await db
      .select()
      .from(planTasks)
      .where(eq(planTasks.planId, planId))
      .orderBy(planTasks.order);

    return NextResponse.json(
      {
        plan,
        phases: planPhases,
        tasks,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error generating plan:', error);
    return NextResponse.json(
      { error: 'Failed to generate plan', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function handleUpdatePlan(
  planId: string,
  data: {
    title?: string;
    description?: string;
    status?: 'draft' | 'ready' | 'running' | 'paused' | 'completed' | 'failed';
  }
) {
  try {
    const [updatedPlan] = await db
      .update(plans)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(plans.id, planId))
      .returning();

    if (!updatedPlan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ plan: updatedPlan });
  } catch (error) {
    console.error('Error updating plan:', error);
    return NextResponse.json(
      { error: 'Failed to update plan' },
      { status: 500 }
    );
  }
}

export async function handleDeletePlan(planId: string) {
  try {
    // Delete related data (cascade)
    await db.delete(planIterations).where(eq(planIterations.planId, planId));
    await db.delete(planTasks).where(eq(planTasks.planId, planId));
    await db.delete(phases).where(eq(phases.planId, planId));
    await db.delete(plans).where(eq(plans.id, planId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting plan:', error);
    return NextResponse.json(
      { error: 'Failed to delete plan' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Phases
// ============================================================================

export async function handleGetPhases(planId: string) {
  try {
    const planPhases = await db
      .select()
      .from(phases)
      .where(eq(phases.planId, planId))
      .orderBy(phases.order);

    return NextResponse.json({ phases: planPhases });
  } catch (error) {
    console.error('Error fetching phases:', error);
    return NextResponse.json(
      { error: 'Failed to fetch phases' },
      { status: 500 }
    );
  }
}

export async function handleCreatePhase(data: {
  planId: string;
  title: string;
  description?: string;
  order: number;
  executionMode?: 'sequential' | 'parallel' | 'manual';
  pauseAfter?: boolean;
}) {
  try {
    const [phase] = await db
      .insert(phases)
      .values({
        planId: data.planId,
        title: data.title,
        description: data.description,
        order: data.order,
        executionMode: data.executionMode || 'sequential',
        pauseAfter: data.pauseAfter || false,
        status: 'pending',
      })
      .returning();

    // Update plan's totalPhases count
    await db
      .update(plans)
      .set({
        totalPhases: db
          .select({ count: phases.id })
          .from(phases)
          .where(eq(phases.planId, data.planId))
          .limit(1) as unknown as number,
        updatedAt: new Date(),
      })
      .where(eq(plans.id, data.planId));

    return NextResponse.json({ phase }, { status: 201 });
  } catch (error) {
    console.error('Error creating phase:', error);
    return NextResponse.json(
      { error: 'Failed to create phase' },
      { status: 500 }
    );
  }
}

export async function handleUpdatePhase(
  phaseId: string,
  data: {
    title?: string;
    description?: string;
    order?: number;
    executionMode?: 'sequential' | 'parallel' | 'manual';
    pauseAfter?: boolean;
  }
) {
  try {
    const [updatedPhase] = await db
      .update(phases)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(phases.id, phaseId))
      .returning();

    if (!updatedPhase) {
      return NextResponse.json(
        { error: 'Phase not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ phase: updatedPhase });
  } catch (error) {
    console.error('Error updating phase:', error);
    return NextResponse.json(
      { error: 'Failed to update phase' },
      { status: 500 }
    );
  }
}

export async function handleDeletePhase(phaseId: string) {
  try {
    // Get phase to find planId
    const [phase] = await db
      .select()
      .from(phases)
      .where(eq(phases.id, phaseId))
      .limit(1);

    if (!phase) {
      return NextResponse.json(
        { error: 'Phase not found' },
        { status: 404 }
      );
    }

    // Delete related tasks
    await db.delete(planTasks).where(eq(planTasks.phaseId, phaseId));

    // Delete phase
    await db.delete(phases).where(eq(phases.id, phaseId));

    // Update plan's totalPhases count
    const remainingPhases = await db
      .select()
      .from(phases)
      .where(eq(phases.planId, phase.planId));

    await db
      .update(plans)
      .set({
        totalPhases: remainingPhases.length,
        updatedAt: new Date(),
      })
      .where(eq(plans.id, phase.planId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting phase:', error);
    return NextResponse.json(
      { error: 'Failed to delete phase' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Tasks
// ============================================================================

export async function handleGetTasks(phaseId: string) {
  try {
    const tasks = await db
      .select()
      .from(planTasks)
      .where(eq(planTasks.phaseId, phaseId))
      .orderBy(planTasks.order);

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

export async function handleCreateTask(data: {
  phaseId: string;
  planId: string;
  title: string;
  description: string;
  order: number;
  dependsOn?: string[];
  canRunInParallel?: boolean;
}) {
  try {
    const [task] = await db
      .insert(planTasks)
      .values({
        phaseId: data.phaseId,
        planId: data.planId,
        title: data.title,
        description: data.description,
        order: data.order,
        dependsOn: data.dependsOn || null,
        canRunInParallel: data.canRunInParallel || false,
        status: 'pending',
        attempts: 0,
      })
      .returning();

    // Update phase and plan task counts
    const phaseTasks = await db
      .select()
      .from(planTasks)
      .where(eq(planTasks.phaseId, data.phaseId));

    await db
      .update(phases)
      .set({
        totalTasks: phaseTasks.length,
        updatedAt: new Date(),
      })
      .where(eq(phases.id, data.phaseId));

    const planAllTasks = await db
      .select()
      .from(planTasks)
      .where(eq(planTasks.planId, data.planId));

    await db
      .update(plans)
      .set({
        totalTasks: planAllTasks.length,
        updatedAt: new Date(),
      })
      .where(eq(plans.id, data.planId));

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}

export async function handleUpdateTask(
  taskId: string,
  data: {
    title?: string;
    description?: string;
    order?: number;
    status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    dependsOn?: string[];
    canRunInParallel?: boolean;
  }
) {
  try {
    const updateData: Record<string, unknown> = { ...data, updatedAt: new Date() };

    // Handle dependsOn array serialization
    if (data.dependsOn !== undefined) {
      updateData.dependsOn = JSON.stringify(data.dependsOn);
    }

    const [updatedTask] = await db
      .update(planTasks)
      .set(updateData)
      .where(eq(planTasks.id, taskId))
      .returning();

    if (!updatedTask) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ task: updatedTask });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    );
  }
}

export async function handleDeleteTask(taskId: string) {
  try {
    // Get task to find phaseId and planId
    const [task] = await db
      .select()
      .from(planTasks)
      .where(eq(planTasks.id, taskId))
      .limit(1);

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Delete task
    await db.delete(planTasks).where(eq(planTasks.id, taskId));

    // Update phase task count
    const phaseTasks = await db
      .select()
      .from(planTasks)
      .where(eq(planTasks.phaseId, task.phaseId));

    await db
      .update(phases)
      .set({
        totalTasks: phaseTasks.length,
        updatedAt: new Date(),
      })
      .where(eq(phases.id, task.phaseId));

    // Update plan task count
    const planAllTasks = await db
      .select()
      .from(planTasks)
      .where(eq(planTasks.planId, task.planId));

    await db
      .update(plans)
      .set({
        totalTasks: planAllTasks.length,
        updatedAt: new Date(),
      })
      .where(eq(plans.id, task.planId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { status: 500 }
    );
  }
}

export async function handleRetryTask(taskId: string) {
  try {
    const [updatedTask] = await db
      .update(planTasks)
      .set({
        status: 'pending',
        attempts: 0,
        lastError: null,
        lastQaResults: null,
        taskId: null, // Clear old session task reference
        sessionId: null, // Clear old session reference
        updatedAt: new Date(),
      })
      .where(eq(planTasks.id, taskId))
      .returning();

    if (!updatedTask) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Get the plan and resume it if it's paused or failed
    const [plan] = await db
      .select()
      .from(plans)
      .where(eq(plans.id, updatedTask.planId))
      .limit(1);

    if (plan && (plan.status === 'paused' || plan.status === 'failed')) {
      // Resume the plan execution in the background
      await db
        .update(plans)
        .set({
          status: 'running',
          updatedAt: new Date(),
        })
        .where(eq(plans.id, plan.id));

      // Trigger plan execution
      planExecutor.executePlan(plan.id).catch((error) => {
        console.error(`Background plan execution failed for ${plan.id}:`, error);
      });

      console.log(`[RetryTask] Resumed plan ${plan.id} for task ${taskId}`);
    }

    return NextResponse.json({ task: updatedTask });
  } catch (error) {
    console.error('Error retrying task:', error);
    return NextResponse.json(
      { error: 'Failed to retry task' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Plan Review
// ============================================================================

export async function handleReviewPlan(data: {
  planId: string;
  reviewType: ReviewType;
  scope?: 'all' | 'phase' | 'task';
  targetId?: string;
}) {
  try {
    const result = await reviewPlan(
      data.planId,
      data.reviewType,
      data.scope || 'all',
      data.targetId
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error reviewing plan:', error);
    return NextResponse.json(
      {
        error: 'Failed to review plan',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function handleApplySuggestions(data: {
  planId: string;
  iterationId: string;
  suggestionIndices: number[];
}) {
  try {
    await applySuggestions(data.planId, data.iterationId, data.suggestionIndices);

    // Return updated plan
    const [plan] = await db
      .select()
      .from(plans)
      .where(eq(plans.id, data.planId))
      .limit(1);

    const planPhases = await db
      .select()
      .from(phases)
      .where(eq(phases.planId, data.planId))
      .orderBy(phases.order);

    const tasks = await db
      .select()
      .from(planTasks)
      .where(eq(planTasks.planId, data.planId))
      .orderBy(planTasks.order);

    return NextResponse.json({
      plan,
      phases: planPhases,
      tasks,
    });
  } catch (error) {
    console.error('Error applying suggestions:', error);
    return NextResponse.json(
      {
        error: 'Failed to apply suggestions',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// Plan Execution
// ============================================================================

export async function handleExecutePlan(planId: string) {
  try {
    // Start execution in background
    planExecutor.executePlan(planId).catch((error) => {
      console.error(`Background plan execution failed for ${planId}:`, error);
    });

    return NextResponse.json({
      status: 'running',
      message: 'Plan execution started',
    });
  } catch (error) {
    console.error('Error starting plan execution:', error);
    return NextResponse.json(
      {
        error: 'Failed to start plan execution',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function handlePausePlan(planId: string) {
  try {
    await db
      .update(plans)
      .set({
        status: 'paused',
        updatedAt: new Date(),
      })
      .where(eq(plans.id, planId));

    const [plan] = await db
      .select()
      .from(plans)
      .where(eq(plans.id, planId))
      .limit(1);

    return NextResponse.json({ plan });
  } catch (error) {
    console.error('Error pausing plan:', error);
    return NextResponse.json(
      { error: 'Failed to pause plan' },
      { status: 500 }
    );
  }
}

export async function handleResumePlan(planId: string) {
  try {
    // Resume execution in background
    planExecutor.resumePlan(planId).catch((error) => {
      console.error(`Background plan execution failed for ${planId}:`, error);
    });

    return NextResponse.json({
      status: 'running',
      message: 'Plan execution resumed',
    });
  } catch (error) {
    console.error('Error resuming plan:', error);
    return NextResponse.json(
      { error: 'Failed to resume plan' },
      { status: 500 }
    );
  }
}

export async function handleCancelPlan(planId: string) {
  try {
    await planExecutor.cancelPlan(planId);

    const [plan] = await db
      .select()
      .from(plans)
      .where(eq(plans.id, planId))
      .limit(1);

    return NextResponse.json({ plan });
  } catch (error) {
    console.error('Error cancelling plan:', error);
    return NextResponse.json(
      { error: 'Failed to cancel plan' },
      { status: 500 }
    );
  }
}
