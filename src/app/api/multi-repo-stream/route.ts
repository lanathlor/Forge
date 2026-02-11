import type { NextRequest } from 'next/server';
import { db } from '@/db';
import { repositories } from '@/db/schema/repositories';
import { sessions } from '@/db/schema/sessions';
import { tasks } from '@/db/schema/tasks';
import { eq, desc } from 'drizzle-orm';
import { taskEvents } from '@/lib/events/task-events';
import { getStuckDetector } from '@/lib/stuck-detection';
import type { ClaudeStatus, RepoSessionState } from '@/shared/hooks/useMultiRepoStream';

/**
 * Status mappings for task status to Claude status
 */
const THINKING_STATUSES = ['running', 'pre_flight', 'qa_running'];
const WRITING_STATUSES = ['waiting_qa', 'approved'];
const STUCK_STATUSES = ['failed', 'qa_failed'];

/**
 * Map task status to Claude status for UI display
 */
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

/**
 * Format task prompt for display (truncate if needed)
 */
function formatTaskPrompt(prompt: string): string {
  return prompt.length > 100 ? prompt.substring(0, 100) + '...' : prompt;
}

/**
 * Fetch the last task for a session (chronologically, by creation time)
 * Returns the most recent task regardless of its status, so the UI reflects
 * the actual last task in the timeline rather than an older stuck task.
 */
async function fetchLastTask(sessionId: string) {
  const lastTask = await db.query.tasks.findFirst({
    where: eq(tasks.sessionId, sessionId),
    orderBy: [desc(tasks.createdAt)],
  });

  if (!lastTask) {
    return null;
  }

  return {
    id: lastTask.id,
    prompt: formatTaskPrompt(lastTask.prompt),
    status: lastTask.status,
    progress: undefined,
  };
}

/** Calculate time elapsed since session started */
function calcTimeElapsed(startedAt: Date | null | undefined): number {
  return startedAt ? Date.now() - startedAt.getTime() : 0;
}

/** Get last activity timestamp or current time */
function getLastActivity(lastActivity: Date | null | undefined): string {
  return lastActivity?.toISOString() ?? new Date().toISOString();
}

/** Check if status requires attention */
function checkNeedsAttention(status: ClaudeStatus): boolean {
  return status === 'stuck' || status === 'waiting_input';
}

/**
 * Build repository session state from database records
 */
async function buildRepoSessionState(repo: { id: string; name: string }): Promise<RepoSessionState> {
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

/**
 * Fetch all repositories with their session states
 */
async function getAllRepoStates(): Promise<RepoSessionState[]> {
  const allRepos = await db.query.repositories.findMany({
    columns: { id: true, name: true },
  });
  const states = await Promise.all(allRepos.map((repo) => buildRepoSessionState(repo)));

  // Update stuck detector with all repo states
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

/** Encode SSE message */
function encodeSSE(encoder: TextEncoder, data: object): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

/** Send connected event */
function sendConnected(controller: ReadableStreamDefaultController, encoder: TextEncoder) {
  controller.enqueue(encodeSSE(encoder, { type: 'connected', timestamp: new Date().toISOString() }));
}

/** Send bulk update event */
function sendBulkUpdate(controller: ReadableStreamDefaultController, encoder: TextEncoder, states: RepoSessionState[]) {
  controller.enqueue(encodeSSE(encoder, { type: 'bulk_update', repositories: states, timestamp: new Date().toISOString() }));
}

/** Send repo update event */
function sendRepoUpdate(controller: ReadableStreamDefaultController, encoder: TextEncoder, state: RepoSessionState) {
  controller.enqueue(encodeSSE(encoder, { type: 'repo_update', repository: state, timestamp: new Date().toISOString() }));
}

/** Create task update handler */
function createTaskUpdateHandler(controller: ReadableStreamDefaultController, encoder: TextEncoder) {
  return async (data: { sessionId: string; taskId: string }) => {
    try {
      const session = await db.query.sessions.findFirst({
        where: eq(sessions.id, data.sessionId),
        columns: { repositoryId: true },
      });
      if (!session) return;

      const repo = await db.query.repositories.findFirst({
        where: eq(repositories.id, session.repositoryId),
        columns: { id: true, name: true },
      });
      if (!repo) return;

      const state = await buildRepoSessionState(repo);
      sendRepoUpdate(controller, encoder, state);

      // Update stuck detector with new state
      const detector = getStuckDetector();
      detector.updateRepoState({
        repositoryId: repo.id,
        repositoryName: repo.name,
        sessionId: state.sessionId,
        taskId: state.currentTask?.id ?? null,
        status: state.currentTask?.status ?? null,
        hasOutput: true,
        blockedQAGate: null,
      });
    } catch (error) {
      console.error('[multi-repo-stream] Error handling task update:', error);
    }
  };
}

/** Setup intervals for keep-alive and refresh */
function setupIntervals(controller: ReadableStreamDefaultController, encoder: TextEncoder) {
  const keepAliveInterval = setInterval(() => {
    try {
      controller.enqueue(encoder.encode(': keep-alive\n\n'));
    } catch {
      clearInterval(keepAliveInterval);
    }
  }, 30000);

  const refreshInterval = setInterval(async () => {
    try {
      const states = await getAllRepoStates();
      sendBulkUpdate(controller, encoder, states);
    } catch {
      // Ignore errors during refresh
    }
  }, 10000);

  return { keepAliveInterval, refreshInterval };
}

/**
 * Server-Sent Events endpoint for real-time multi-repo updates
 */
export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      sendConnected(controller, encoder);
      const initialStates = await getAllRepoStates();
      sendBulkUpdate(controller, encoder, initialStates);

      const onTaskUpdate = createTaskUpdateHandler(controller, encoder);
      taskEvents.on('task:update', onTaskUpdate);
      taskEvents.on('task:output', onTaskUpdate);

      const { keepAliveInterval, refreshInterval } = setupIntervals(controller, encoder);

      request.signal.addEventListener('abort', () => {
        clearInterval(keepAliveInterval);
        clearInterval(refreshInterval);
        taskEvents.off('task:update', onTaskUpdate);
        taskEvents.off('task:output', onTaskUpdate);
        try { controller.close(); } catch { /* already closed */ }
      });
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
