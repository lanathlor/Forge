import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sessions } from '@/db/schema/sessions';
import { tasks } from '@/db/schema/tasks';
import { eq, desc } from 'drizzle-orm';
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
 * Fetch the current task for a session
 */
async function fetchCurrentTask(sessionId: string) {
  const latestTask = await db.query.tasks.findFirst({
    where: eq(tasks.sessionId, sessionId),
    orderBy: [desc(tasks.updatedAt)],
  });

  const terminalStatuses = ['completed', 'rejected', 'cancelled'];
  if (!latestTask || terminalStatuses.includes(latestTask.status)) {
    return null;
  }

  return {
    id: latestTask.id,
    prompt: formatTaskPrompt(latestTask.prompt),
    status: latestTask.status,
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

  const currentTask = session ? await fetchCurrentTask(session.id) : null;
  const sessionStatus = session?.status ?? null;
  const claudeStatus = getClaudeStatus(currentTask?.status ?? null, sessionStatus);

  return {
    repositoryId: repo.id,
    repositoryName: repo.name,
    sessionId: session?.id ?? null,
    sessionStatus,
    claudeStatus,
    currentTask,
    timeElapsed: calcTimeElapsed(session?.startedAt),
    lastActivity: getLastActivity(session?.lastActivity),
    needsAttention: checkNeedsAttention(claudeStatus),
  };
}

/**
 * REST endpoint for fetching multi-repo status (polling fallback)
 */
export async function GET() {
  try {
    const allRepos = await db.query.repositories.findMany({
      columns: { id: true, name: true },
    });

    const states = await Promise.all(
      allRepos.map((repo) => buildRepoSessionState(repo))
    );

    return NextResponse.json({
      repositories: states,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[multi-repo-status] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch repository status' },
      { status: 500 }
    );
  }
}
