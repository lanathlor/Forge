import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tasks, type TaskStatus } from '@/db/schema/tasks';
import { sessions, type SessionStatus } from '@/db/schema/sessions';
import { plans, type PlanStatus } from '@/db/schema/plans';
import { qaGateResults, type QAGateStatus } from '@/db/schema/qa-gates';
import { desc, and, eq, gte, or } from 'drizzle-orm';
import type {
  ActivityItem,
  ActivityType,
  ActivityStatus,
} from '@/app/components/RecentActivity';

/* ============================================
   TYPES
   ============================================ */

interface ActivityMapping {
  type: ActivityType;
  status: ActivityStatus;
}

interface ActivityQueryParams {
  repositoryId?: string;
  limit: number;
  offset: number;
  since?: Date;
}

/* ============================================
   ACTIVITY TYPE MAPPING
   ============================================ */

const TASK_STATUS_MAP: Partial<Record<TaskStatus, ActivityMapping>> = {
  running: { type: 'task_started', status: 'info' },
  pre_flight: { type: 'task_started', status: 'info' },
  completed: { type: 'task_completed', status: 'success' },
  approved: { type: 'task_completed', status: 'success' },
  failed: { type: 'task_failed', status: 'error' },
  rejected: { type: 'task_failed', status: 'error' },
  qa_failed: { type: 'task_failed', status: 'error' },
  cancelled: { type: 'task_cancelled', status: 'warning' },
};

const SESSION_STATUS_MAP: Partial<Record<SessionStatus, ActivityMapping>> = {
  paused: { type: 'session_paused', status: 'warning' },
  completed: { type: 'session_ended', status: 'success' },
  abandoned: { type: 'session_ended', status: 'neutral' },
};

const PLAN_STATUS_MAP: Partial<Record<PlanStatus, ActivityMapping>> = {
  draft: { type: 'plan_created', status: 'info' },
  ready: { type: 'plan_created', status: 'info' },
  running: { type: 'plan_started', status: 'info' },
  completed: { type: 'plan_completed', status: 'success' },
  failed: { type: 'plan_failed', status: 'error' },
};

const QA_STATUS_MAP: Partial<Record<QAGateStatus, ActivityMapping>> = {
  passed: { type: 'qa_passed', status: 'success' },
  failed: { type: 'qa_failed', status: 'error' },
};

/* ============================================
   HELPER UTILITIES
   ============================================ */

function truncateText(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : text.slice(0, maxLength - 3) + '...';
}

function computeDuration(
  start: Date | null,
  end: Date | null
): number | undefined {
  return start && end
    ? new Date(end).getTime() - new Date(start).getTime()
    : undefined;
}

function sortByTimestamp(items: ActivityItem[]): ActivityItem[] {
  return items.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

function deduplicateActivities(items: ActivityItem[]): ActivityItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

/* ============================================
   TASK ACTIVITIES
   ============================================ */

function buildTaskStatusFilter() {
  return or(
    eq(tasks.status, 'running'),
    eq(tasks.status, 'completed'),
    eq(tasks.status, 'approved'),
    eq(tasks.status, 'failed'),
    eq(tasks.status, 'rejected'),
    eq(tasks.status, 'qa_failed'),
    eq(tasks.status, 'cancelled')
  );
}

function mapTaskToActivity(
  task: Awaited<ReturnType<typeof db.query.tasks.findMany>>[number]
): ActivityItem[] {
  const mapping = TASK_STATUS_MAP[task.status];
  if (!mapping) return [];
  return [
    {
      id: `task-${task.id}`,
      type: mapping.type,
      title: truncateText(task.prompt, 60),
      description: task.claudeOutput
        ? truncateText(task.claudeOutput, 100)
        : undefined,
      timestamp: (task.completedAt ?? task.updatedAt ?? task.createdAt).toISOString(),
      status: mapping.status,
      detailsLink: `/tasks/${task.id}`,
      metadata: {
        taskId: task.id,
        sessionId: task.sessionId,
        repositoryName: undefined,
        duration: computeDuration(task.startedAt, task.completedAt),
      },
    },
  ];
}

async function fetchTaskActivities(
  params: ActivityQueryParams
): Promise<ActivityItem[]> {
  const { repositoryId, limit, offset, since } = params;
  const statusFilter = buildTaskStatusFilter();
  const whereConditions = since
    ? and(statusFilter, gte(tasks.updatedAt, since))
    : statusFilter;

  const taskResults = await db.query.tasks.findMany({
    where: whereConditions,
    orderBy: [desc(tasks.updatedAt)],
    limit,
    offset,
    with: { session: { with: { repository: true } } },
  });

  const filtered = repositoryId
    ? taskResults.filter((t) => (t.session as { repository?: { id?: string } })?.repository?.id === repositoryId)
    : taskResults;

  return filtered.flatMap(mapTaskToActivity);
}

/* ============================================
   SESSION ACTIVITIES
   ============================================ */

async function fetchSessionActivities(
  params: ActivityQueryParams
): Promise<ActivityItem[]> {
  const { repositoryId, limit, offset, since } = params;

  const conditions = [];
  if (repositoryId) conditions.push(eq(sessions.repositoryId, repositoryId));
  if (since) conditions.push(gte(sessions.updatedAt, since));

  const sessionResults = await db.query.sessions.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(sessions.updatedAt)],
    limit,
    offset,
    with: { repository: true },
  });

  return sessionResults.flatMap((session) => {
    const isNew = session.createdAt.getTime() === session.updatedAt.getTime();
    const mapping = isNew
      ? { type: 'session_started' as const, status: 'info' as const }
      : SESSION_STATUS_MAP[session.status];
    if (!mapping) return [];

    return [
      {
        id: `session-${session.id}-${session.status}`,
        type: mapping.type,
        title: session.repository?.name ?? 'Unknown Repository',
        description: isNew
          ? 'New session started'
          : `Session ${session.status}`,
        timestamp: session.updatedAt.toISOString(),
        status: mapping.status,
        detailsLink: `/sessions/${session.id}`,
        metadata: {
          sessionId: session.id,
          repositoryName: session.repository?.name,
        },
      },
    ];
  });
}

/* ============================================
   PLAN ACTIVITIES
   ============================================ */

async function fetchPlanActivities(
  params: ActivityQueryParams
): Promise<ActivityItem[]> {
  const { repositoryId, limit, offset, since } = params;

  const conditions = [];
  if (repositoryId) conditions.push(eq(plans.repositoryId, repositoryId));
  if (since) conditions.push(gte(plans.updatedAt, since));

  const planResults = await db.query.plans.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(plans.updatedAt)],
    limit,
    offset,
    with: { repository: true },
  });

  return planResults.flatMap((plan) => {
    const mapping = PLAN_STATUS_MAP[plan.status];
    if (!mapping) return [];

    return [
      {
        id: `plan-${plan.id}-${plan.status}`,
        type: mapping.type,
        title: plan.title,
        description: plan.description ?? undefined,
        timestamp: plan.updatedAt.toISOString(),
        status: mapping.status,
        detailsLink: `/plans/${plan.id}`,
        metadata: {
          planId: plan.id,
          repositoryName: plan.repository?.name,
          duration: computeDuration(plan.startedAt, plan.completedAt),
        },
      },
    ];
  });
}

/* ============================================
   QA ACTIVITIES
   ============================================ */

async function fetchQAActivities(
  params: ActivityQueryParams
): Promise<ActivityItem[]> {
  const { limit, offset, since } = params;

  const statusFilter = or(
    eq(qaGateResults.status, 'passed'),
    eq(qaGateResults.status, 'failed')
  );
  const whereConditions = since
    ? and(statusFilter, gte(qaGateResults.completedAt, since))
    : statusFilter;

  const qaResults = await db.query.qaGateResults.findMany({
    where: whereConditions,
    orderBy: [desc(qaGateResults.completedAt)],
    limit,
    offset,
    with: { task: { with: { session: { with: { repository: true } } } } },
  });

  return qaResults.flatMap((qa) => {
    const mapping = QA_STATUS_MAP[qa.status];
    if (!mapping) return [];

    return [
      {
        id: `qa-${qa.id}`,
        type: mapping.type,
        title: qa.gateName,
        description: qa.output ? truncateText(qa.output, 100) : undefined,
        timestamp: (qa.completedAt ?? qa.createdAt).toISOString(),
        status: mapping.status,
        detailsLink: qa.task ? `/tasks/${qa.taskId}` : undefined,
        metadata: {
          taskId: qa.taskId,
          sessionId: qa.task?.sessionId,
          repositoryName: qa.task?.session?.repository?.name,
          duration: qa.duration ?? undefined,
          qaGateName: qa.gateName,
        },
      },
    ];
  });
}

/* ============================================
   FETCH & COMBINE ACTIVITIES
   ============================================ */

async function fetchAllActivities(
  params: ActivityQueryParams
): Promise<ActivityItem[]> {
  const perSourceParams = { ...params, limit: Math.ceil(params.limit * 1.5) };

  const [taskActivities, sessionActivities, planActivities, qaActivities] =
    await Promise.all([
      fetchTaskActivities(perSourceParams),
      fetchSessionActivities(perSourceParams),
      fetchPlanActivities(perSourceParams),
      fetchQAActivities(perSourceParams),
    ]);

  return [
    ...taskActivities,
    ...sessionActivities,
    ...planActivities,
    ...qaActivities,
  ];
}

function parseQueryParams(searchParams: URLSearchParams): ActivityQueryParams {
  return {
    repositoryId: searchParams.get('repositoryId') ?? undefined,
    limit: Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100),
    offset: parseInt(searchParams.get('offset') ?? '0', 10),
    since: searchParams.get('since')
      ? new Date(searchParams.get('since')!)
      : undefined,
  };
}

/* ============================================
   API ROUTE HANDLER
   ============================================ */

/**
 * GET /api/activity - Fetches chronological activity feed
 */
export async function GET(request: NextRequest) {
  try {
    const params = parseQueryParams(new URL(request.url).searchParams);
    const allActivities = await fetchAllActivities(params);
    const sorted = sortByTimestamp(deduplicateActivities(allActivities));
    const paginated = sorted.slice(0, params.limit);

    return NextResponse.json({
      items: paginated,
      hasMore: sorted.length > params.limit,
      total: sorted.length,
    });
  } catch (error) {
    console.error('Error fetching activity:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity' },
      { status: 500 }
    );
  }
}
