import type { NextRequest } from 'next/server';
import { db } from '@/db';
import { repositories } from '@/db/schema/repositories';
import { sessions } from '@/db/schema/sessions';
import { tasks } from '@/db/schema/tasks';
import { eq, desc } from 'drizzle-orm';
import { taskEvents, type PlanExecutionEvent } from '@/lib/events/task-events';
import {
  getStuckDetector,
  stuckEvents,
  type StuckEvent,
  type StuckStatus,
} from '@/lib/stuck-detection';
import type {
  ClaudeStatus,
  RepoSessionState,
} from '@/shared/hooks/useMultiRepoStream';

/**
 * Unified SSE Endpoint
 *
 * Consolidates all real-time event streams into a single connection:
 * - Multi-repo status updates (bulk_update, repo_update)
 * - Stuck detection events (stuck_detected, stuck_resolved, stuck_escalated, stuck_update)
 * - Task events (task_update, task_output, qa_gate_update)
 * - Health/heartbeat monitoring
 *
 * This reduces the number of open connections from 3 to 1, improving
 * resource usage and simplifying client-side connection management.
 */

/* ============================================
   STATUS MAPPING
   ============================================ */

const THINKING_STATUSES = ['running', 'pre_flight', 'qa_running'];
const WRITING_STATUSES = ['waiting_qa', 'approved'];
const STUCK_STATUSES = ['failed', 'qa_failed'];

function getClaudeStatus(
  taskStatus: string | null,
  sessionStatus: string | null
): ClaudeStatus {
  if (sessionStatus === 'paused') return 'paused';
  if (!taskStatus) return 'idle';
  if (THINKING_STATUSES.includes(taskStatus)) return 'thinking';
  if (WRITING_STATUSES.includes(taskStatus)) return 'writing';
  if (taskStatus === 'waiting_approval') return 'waiting_input';
  if (STUCK_STATUSES.includes(taskStatus)) return 'stuck';
  return 'idle';
}

/* ============================================
   DATA FETCHING
   ============================================ */

function formatTaskPrompt(prompt: string): string {
  return prompt.length > 100 ? prompt.substring(0, 100) + '...' : prompt;
}

async function fetchLastTask(sessionId: string) {
  const lastTask = await db.query.tasks.findFirst({
    where: eq(tasks.sessionId, sessionId),
    orderBy: [desc(tasks.createdAt)],
  });

  if (!lastTask) return null;

  return {
    id: lastTask.id,
    prompt: formatTaskPrompt(lastTask.prompt),
    status: lastTask.status,
    progress: undefined,
  };
}

function calcTimeElapsed(startedAt: Date | null | undefined): number {
  return startedAt ? Date.now() - startedAt.getTime() : 0;
}

function getLastActivity(lastActivity: Date | null | undefined): string {
  return lastActivity?.toISOString() ?? new Date().toISOString();
}

function checkNeedsAttention(status: ClaudeStatus): boolean {
  return status === 'stuck' || status === 'waiting_input';
}

async function buildRepoSessionState(repo: {
  id: string;
  name: string;
}): Promise<RepoSessionState> {
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.repositoryId, repo.id),
    orderBy: [desc(sessions.lastActivity)],
  });

  const lastTask = session ? await fetchLastTask(session.id) : null;
  const sessionStatus = session?.status ?? null;
  const claudeStatus = getClaudeStatus(lastTask?.status ?? null, sessionStatus);

  return {
    repositoryId: repo.id,
    repositoryName: repo.name,
    sessionId: session?.id ?? null,
    sessionStatus,
    claudeStatus,
    currentTask: lastTask,
    timeElapsed: calcTimeElapsed(session?.startedAt),
    lastActivity: getLastActivity(session?.lastActivity),
    needsAttention: checkNeedsAttention(claudeStatus),
  };
}

async function getAllRepoStates(): Promise<RepoSessionState[]> {
  const allRepos = await db.query.repositories.findMany({
    columns: { id: true, name: true },
  });
  const states = await Promise.all(
    allRepos.map((repo) => buildRepoSessionState(repo))
  );

  const detector = getStuckDetector();
  for (const state of states) {
    detector.updateRepoState({
      repositoryId: state.repositoryId,
      repositoryName: state.repositoryName,
      sessionId: state.sessionId,
      taskId: state.currentTask?.id ?? null,
      status: state.currentTask?.status ?? null,
      hasOutput: false,
      blockedQAGate: null,
    });
  }

  return states;
}

/* ============================================
   SSE ENCODING
   ============================================ */

function encodeSSE(
  encoder: TextEncoder,
  eventType: string,
  data: object
): Uint8Array {
  return encoder.encode(
    `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`
  );
}

// Unused but kept for potential future use with non-named events
// function encodeSSEData(encoder: TextEncoder, data: object): Uint8Array {
//   return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
// }

/* ============================================
   EVENT HANDLERS
   ============================================ */

interface StreamContext {
  controller: ReadableStreamDefaultController;
  encoder: TextEncoder;
}

function sendEvent(ctx: StreamContext, eventType: string, data: object) {
  try {
    ctx.controller.enqueue(encodeSSE(ctx.encoder, eventType, data));
  } catch {
    // Stream closed
  }
}

function sendConnected(
  ctx: StreamContext,
  repoStates: RepoSessionState[],
  stuckStatus: StuckStatus
) {
  sendEvent(ctx, 'connected', {
    type: 'connected',
    timestamp: new Date().toISOString(),
    repositories: repoStates,
    stuckStatus,
    version: '2.0', // Unified stream version
  });
}

function sendBulkUpdate(ctx: StreamContext, states: RepoSessionState[]) {
  sendEvent(ctx, 'bulk_update', {
    type: 'bulk_update',
    repositories: states,
    timestamp: new Date().toISOString(),
  });
}

function sendRepoUpdate(ctx: StreamContext, state: RepoSessionState) {
  sendEvent(ctx, 'repo_update', {
    type: 'repo_update',
    repository: state,
    timestamp: new Date().toISOString(),
  });
}

function sendHeartbeat(ctx: StreamContext) {
  try {
    ctx.controller.enqueue(ctx.encoder.encode(`: heartbeat ${Date.now()}\n\n`));
  } catch {
    // Stream closed
  }
}

function sendKeepAlive(ctx: StreamContext) {
  sendEvent(ctx, 'keep_alive', {
    type: 'keep_alive',
    timestamp: new Date().toISOString(),
  });
}

/* ============================================
   HANDLER FACTORIES
   ============================================ */

async function fetchTaskUpdateContext(sessionId: string, taskId: string) {
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId),
    columns: { repositoryId: true },
  });
  if (!session) return null;

  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.id, session.repositoryId),
    columns: { id: true, name: true },
  });
  if (!repo) return null;

  const [state, task] = await Promise.all([
    buildRepoSessionState(repo),
    db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
      columns: { status: true, prompt: true },
    }),
  ]);

  return { repo, state, task };
}

function resolveTaskFields(
  task: { status: string; prompt: string } | undefined,
  currentTask: RepoSessionState['currentTask'],
) {
  return {
    status: task?.status ?? currentTask?.status ?? null,
    prompt: task?.prompt ?? currentTask?.prompt ?? null,
  };
}

function notifyStuckDetector(
  repo: { id: string; name: string },
  state: RepoSessionState,
) {
  getStuckDetector().updateRepoState({
    repositoryId: repo.id,
    repositoryName: repo.name,
    sessionId: state.sessionId,
    taskId: state.currentTask?.id ?? null,
    status: state.currentTask?.status ?? null,
    hasOutput: true,
    blockedQAGate: null,
  });
}

function createTaskUpdateHandler(ctx: StreamContext) {
  return async (data: { sessionId: string; taskId: string }) => {
    try {
      const result = await fetchTaskUpdateContext(data.sessionId, data.taskId);
      if (!result) return;
      const { repo, state, task } = result;
      const { status, prompt } = resolveTaskFields(task, state.currentTask);

      sendRepoUpdate(ctx, state);
      sendEvent(ctx, 'task_update', {
        type: 'task_update',
        sessionId: data.sessionId,
        taskId: data.taskId,
        status,
        prompt,
        repositoryId: repo.id,
        repository: state,
        timestamp: new Date().toISOString(),
      });
      notifyStuckDetector(repo, state);
    } catch (error) {
      console.error('[unified-sse] Error handling task update:', error);
    }
  };
}

function createStuckEventHandler(ctx: StreamContext, eventType: string) {
  return (event: StuckEvent) => {
    sendEvent(ctx, eventType, event);
  };
}

function createStuckStatusHandler(ctx: StreamContext) {
  return (status: StuckStatus) => {
    sendEvent(ctx, 'stuck_update', {
      status,
      timestamp: new Date().toISOString(),
    });
  };
}

function createQAGateHandler(ctx: StreamContext) {
  return (data: {
    sessionId: string;
    taskId: string;
    gateName: string;
    status: string;
  }) => {
    sendEvent(ctx, 'qa_gate_update', {
      type: 'qa_gate_update',
      ...data,
      timestamp: new Date().toISOString(),
    });
  };
}

function createTaskOutputHandler(ctx: StreamContext) {
  return (data: { sessionId: string; taskId: string; output: string }) => {
    sendEvent(ctx, 'task_output', {
      type: 'task_output',
      sessionId: data.sessionId,
      taskId: data.taskId,
      output: data.output,
      timestamp: new Date().toISOString(),
    });
  };
}

function createPlanExecutionHandler(ctx: StreamContext) {
  return (event: PlanExecutionEvent) => {
    sendEvent(ctx, 'plan_execution', event);
  };
}

/* ============================================
   INTERVALS
   ============================================ */

function setupIntervals(
  ctx: StreamContext,
  detector: ReturnType<typeof getStuckDetector>
) {
  // Heartbeat every 15 seconds (more frequent for faster stale detection)
  const heartbeatInterval = setInterval(() => sendHeartbeat(ctx), 15000);

  // Keep-alive with named event every 30 seconds (for clients that need it)
  const keepAliveInterval = setInterval(() => sendKeepAlive(ctx), 30000);

  // Bulk refresh every 10 seconds
  const refreshInterval = setInterval(async () => {
    try {
      const states = await getAllRepoStates();
      sendBulkUpdate(ctx, states);
    } catch {
      // Ignore errors during refresh
    }
  }, 10000);

  // Stuck status update every 30 seconds
  const stuckStatusInterval = setInterval(() => {
    try {
      const status = detector.getStatus();
      sendEvent(ctx, 'stuck_update', {
        status,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Ignore
    }
  }, 30000);

  return {
    heartbeatInterval,
    keepAliveInterval,
    refreshInterval,
    stuckStatusInterval,
  };
}

/* ============================================
   STREAM SETUP HELPERS
   ============================================ */

interface TaskHandlers {
  onTaskUpdate: (data: { sessionId: string; taskId: string }) => Promise<void>;
  onTaskOutput: (data: {
    sessionId: string;
    taskId: string;
    output: string;
  }) => void;
  onQAGateUpdate: (data: {
    sessionId: string;
    taskId: string;
    gateName: string;
    status: string;
  }) => void;
  onPlanExecution: (event: PlanExecutionEvent) => void;
}

interface StuckHandlers {
  onStuckDetected: (event: StuckEvent) => void;
  onStuckResolved: (event: StuckEvent) => void;
  onStuckEscalated: (event: StuckEvent) => void;
  onStuckUpdate: (status: StuckStatus) => void;
}

function setupTaskHandlers(ctx: StreamContext): TaskHandlers {
  return {
    onTaskUpdate: createTaskUpdateHandler(ctx),
    onTaskOutput: createTaskOutputHandler(ctx),
    onQAGateUpdate: createQAGateHandler(ctx),
    onPlanExecution: createPlanExecutionHandler(ctx),
  };
}

function setupStuckHandlers(ctx: StreamContext): StuckHandlers {
  return {
    onStuckDetected: createStuckEventHandler(ctx, 'stuck_detected'),
    onStuckResolved: createStuckEventHandler(ctx, 'stuck_resolved'),
    onStuckEscalated: createStuckEventHandler(ctx, 'stuck_escalated'),
    onStuckUpdate: createStuckStatusHandler(ctx),
  };
}

function attachTaskListeners(handlers: TaskHandlers) {
  taskEvents.on('task:update', handlers.onTaskUpdate);
  taskEvents.on('task:output', handlers.onTaskOutput);
  taskEvents.on('qa:update', handlers.onQAGateUpdate);
  taskEvents.on('plan:execution', handlers.onPlanExecution);
}

function attachStuckListeners(handlers: StuckHandlers) {
  stuckEvents.on('stuck:detected', handlers.onStuckDetected);
  stuckEvents.on('stuck:resolved', handlers.onStuckResolved);
  stuckEvents.on('stuck:escalated', handlers.onStuckEscalated);
  stuckEvents.on('stuck:update', handlers.onStuckUpdate);
}

function createCleanupHandler(
  intervals: ReturnType<typeof setupIntervals>,
  taskHandlers: TaskHandlers,
  stuckHandlers: StuckHandlers,
  controller: ReadableStreamDefaultController
) {
  return () => {
    clearInterval(intervals.heartbeatInterval);
    clearInterval(intervals.keepAliveInterval);
    clearInterval(intervals.refreshInterval);
    clearInterval(intervals.stuckStatusInterval);

    taskEvents.off('task:update', taskHandlers.onTaskUpdate);
    taskEvents.off('task:output', taskHandlers.onTaskOutput);
    taskEvents.off('qa:update', taskHandlers.onQAGateUpdate);
    taskEvents.off('plan:execution', taskHandlers.onPlanExecution);

    stuckEvents.off('stuck:detected', stuckHandlers.onStuckDetected);
    stuckEvents.off('stuck:resolved', stuckHandlers.onStuckResolved);
    stuckEvents.off('stuck:escalated', stuckHandlers.onStuckEscalated);
    stuckEvents.off('stuck:update', stuckHandlers.onStuckUpdate);

    try {
      controller.close();
    } catch {
      /* Already closed */
    }
  };
}

/* ============================================
   MAIN ENDPOINT
   ============================================ */

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  const detector = getStuckDetector();

  const stream = new ReadableStream({
    async start(controller) {
      const ctx: StreamContext = { controller, encoder };
      const initialStates = await getAllRepoStates();
      sendConnected(ctx, initialStates, detector.getStatus());

      const taskHandlers = setupTaskHandlers(ctx);
      const stuckHandlers = setupStuckHandlers(ctx);
      attachTaskListeners(taskHandlers);
      attachStuckListeners(stuckHandlers);

      const intervals = setupIntervals(ctx, detector);
      const cleanup = createCleanupHandler(
        intervals,
        taskHandlers,
        stuckHandlers,
        controller
      );
      request.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

/**
 * POST endpoint for actions (e.g., acknowledging stuck alerts)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, repositoryId } = body;

    if (!action) {
      return Response.json({ error: 'Missing action' }, { status: 400 });
    }

    const detector = getStuckDetector();

    switch (action) {
      case 'acknowledge': {
        if (!repositoryId) {
          return Response.json(
            { error: 'Missing repositoryId' },
            { status: 400 }
          );
        }
        const success = detector.acknowledgeAlert(repositoryId);
        return Response.json({ success, repositoryId });
      }
      case 'ping': {
        return Response.json({
          success: true,
          timestamp: new Date().toISOString(),
          status: detector.getStatus(),
        });
      }
      default:
        return Response.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[unified-sse] POST error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
