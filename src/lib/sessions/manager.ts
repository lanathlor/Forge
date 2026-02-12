import { db } from '@/db';
import { sessions, type Session, type SessionStatus } from '@/db/schema/sessions';
import { tasks, type Task, type FileChange } from '@/db/schema/tasks';
import { repositories } from '@/db/schema/repositories';
import { qaGateResults, type QAGateResult } from '@/db/schema/qa-gates';
import { eq, and, desc, lt, inArray } from 'drizzle-orm';
import { execAsync, getContainerPath } from '@/lib/qa-gates/command-executor';

export interface SessionWithTasks extends Session {
  tasks: Task[];
}

export interface SessionWithRepository extends Session {
  repository: {
    id: string;
    name: string;
    path: string;
    currentBranch: string | null;
  };
}

export interface SessionSummary {
  session: SessionWithRepository;
  stats: {
    totalTasks: number;
    completedTasks: number;
    rejectedTasks: number;
    failedTasks: number;
    filesChanged: number;
    commits: number;
    duration: number;
  };
}

export interface ListSessionsOptions {
  limit?: number;
  status?: SessionStatus;
  offset?: number;
}

/**
 * Get the active session for a repository, if one exists.
 * Updates the lastActivity timestamp when accessed.
 */
export async function getActiveSession(
  repositoryId: string
): Promise<Session | null> {
  const activeSession = await db.query.sessions.findFirst({
    where: and(
      eq(sessions.repositoryId, repositoryId),
      eq(sessions.status, 'active')
    ),
  });

  if (activeSession) {
    await db
      .update(sessions)
      .set({
        lastActivity: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, activeSession.id));
  }

  return activeSession ?? null;
}

/**
 * Create a new session for a repository.
 * Captures the current branch as the starting branch.
 */
export async function createSession(repositoryId: string): Promise<Session> {
  const repository = await db.query.repositories.findFirst({
    where: eq(repositories.id, repositoryId),
  });

  if (!repository) {
    throw new Error(`Repository not found: ${repositoryId}`);
  }

  const [session] = await db
    .insert(sessions)
    .values({
      repositoryId,
      status: 'active',
      startBranch: repository.currentBranch,
    })
    .returning();

  if (!session) {
    throw new Error('Failed to create session');
  }

  return session;
}

/**
 * Get or create an active session for a repository.
 * If an active session exists, returns it. Otherwise creates a new one.
 */
export async function getOrCreateActiveSession(
  repositoryId: string
): Promise<Session> {
  const existing = await getActiveSession(repositoryId);

  if (existing) {
    return existing;
  }

  return createSession(repositoryId);
}

/**
 * End a session, marking it as completed.
 * Captures the current branch as the ending branch.
 */
export async function endSession(sessionId: string): Promise<Session> {
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId),
  });

  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const repository = await db.query.repositories.findFirst({
    where: eq(repositories.id, session.repositoryId),
  });

  let endBranch: string | null = null;

  if (repository?.path) {
    try {
      const containerPath = getContainerPath(repository.path);
      const { stdout } = await execAsync('git branch --show-current', {
        cwd: containerPath,
        timeout: 5000,
      });
      endBranch = stdout.trim();
    } catch {
      endBranch = repository.currentBranch;
    }
  }

  const [updatedSession] = await db
    .update(sessions)
    .set({
      status: 'completed',
      endedAt: new Date(),
      endBranch,
      updatedAt: new Date(),
    })
    .where(eq(sessions.id, sessionId))
    .returning();

  if (!updatedSession) {
    throw new Error('Failed to update session');
  }

  return updatedSession;
}

/**
 * Pause a session.
 */
export async function pauseSession(sessionId: string): Promise<Session> {
  const [session] = await db
    .update(sessions)
    .set({
      status: 'paused',
      updatedAt: new Date(),
    })
    .where(eq(sessions.id, sessionId))
    .returning();

  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  return session;
}

/**
 * Resume a paused session.
 */
export async function resumeSession(sessionId: string): Promise<Session> {
  const [session] = await db
    .update(sessions)
    .set({
      status: 'active',
      lastActivity: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(sessions.id, sessionId))
    .returning();

  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  return session;
}

/**
 * Get a detailed summary of a session including task statistics.
 */
/* eslint-disable max-lines-per-function */
export async function getSessionSummary(
  sessionId: string
): Promise<SessionSummary> {
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId),
    with: {
      repository: {
        columns: {
          id: true,
          name: true,
          path: true,
          currentBranch: true,
        },
      },
    },
  });

  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const sessionTasks = await db.query.tasks.findMany({
    where: eq(tasks.sessionId, sessionId),
  });

  const totalTasks = sessionTasks.length;
  const completedTasks = sessionTasks.filter(
    (t) => t.status === 'completed'
  ).length;
  const rejectedTasks = sessionTasks.filter(
    (t) => t.status === 'rejected'
  ).length;
  const failedTasks = sessionTasks.filter(
    (t) => t.status === 'failed' || t.status === 'qa_failed'
  ).length;

  // Count unique files changed across all tasks
  const allFiles = new Set<string>();
  sessionTasks.forEach((task) => {
    const files = task.filesChanged ?? [];
    files.forEach((f) => allFiles.add(f.path));
  });

  // Count commits (tasks that resulted in a commit)
  const commits = sessionTasks.filter((t) => t.committedSha).length;

  // Calculate duration in milliseconds
  const duration = session.endedAt
    ? session.endedAt.getTime() - session.startedAt.getTime()
    : Date.now() - session.startedAt.getTime();

  return {
    session: session as SessionWithRepository,
    stats: {
      totalTasks,
      completedTasks,
      rejectedTasks,
      failedTasks,
      filesChanged: allFiles.size,
      commits,
      duration,
    },
  };
}

export interface EnhancedTaskSummary {
  id: string;
  prompt: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  filesChanged: FileChange[];
  committedSha: string | null;
  commitMessage: string | null;
  qaResults: Array<{
    gateName: string;
    status: string;
    duration: number | null;
  }>;
}

export interface EnhancedSessionSummary extends SessionSummary {
  tasks: EnhancedTaskSummary[];
  qaStats: {
    totalRuns: number;
    passed: number;
    failed: number;
    passRate: number;
  };
  timeline: Array<{
    timestamp: string;
    type: 'session_start' | 'task_start' | 'task_complete' | 'task_fail' | 'session_end';
    label: string;
    taskId?: string;
  }>;
  totalAdditions: number;
  totalDeletions: number;
}

function groupQaByTask(allQaResults: QAGateResult[]): Map<string, QAGateResult[]> {
  const qaByTask = new Map<string, QAGateResult[]>();
  for (const result of allQaResults) {
    const existing = qaByTask.get(result.taskId) ?? [];
    existing.push(result);
    qaByTask.set(result.taskId, existing);
  }
  return qaByTask;
}

function buildEnhancedTasks(
  sessionTasks: Task[],
  qaByTask: Map<string, QAGateResult[]>
): EnhancedTaskSummary[] {
  return sessionTasks.map((t) => ({
    id: t.id,
    prompt: t.prompt,
    status: t.status,
    startedAt: t.startedAt?.toISOString() ?? null,
    completedAt: t.completedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    filesChanged: t.filesChanged ?? [],
    committedSha: t.committedSha,
    commitMessage: t.commitMessage,
    qaResults: (qaByTask.get(t.id) ?? []).map((qr) => ({
      gateName: qr.gateName,
      status: qr.status,
      duration: qr.duration,
    })),
  }));
}

function truncatePrompt(prompt: string): string {
  return prompt.length > 60 ? prompt.slice(0, 57) + '...' : prompt;
}

function buildTimeline(
  session: SessionWithRepository,
  sessionTasks: Task[]
): EnhancedSessionSummary['timeline'] {
  const timeline: EnhancedSessionSummary['timeline'] = [];

  timeline.push({
    timestamp: session.startedAt.toISOString(),
    type: 'session_start',
    label: 'Session started',
  });

  for (const t of sessionTasks) {
    if (t.startedAt) {
      timeline.push({
        timestamp: t.startedAt.toISOString(),
        type: 'task_start',
        label: truncatePrompt(t.prompt),
        taskId: t.id,
      });
    }
    if (t.completedAt) {
      const isFailed = t.status === 'failed' || t.status === 'qa_failed' || t.status === 'rejected';
      timeline.push({
        timestamp: t.completedAt.toISOString(),
        type: isFailed ? 'task_fail' : 'task_complete',
        label: truncatePrompt(t.prompt),
        taskId: t.id,
      });
    }
  }

  if (session.endedAt) {
    timeline.push({
      timestamp: session.endedAt.toISOString(),
      type: 'session_end',
      label: 'Session ended',
    });
  }

  timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return timeline;
}

function computeCodeChangeStats(sessionTasks: Task[]): { totalAdditions: number; totalDeletions: number } {
  let totalAdditions = 0;
  let totalDeletions = 0;
  for (const t of sessionTasks) {
    for (const f of t.filesChanged ?? []) {
      totalAdditions += f.additions;
      totalDeletions += f.deletions;
    }
  }
  return { totalAdditions, totalDeletions };
}

/**
 * Get an enhanced summary with full task details, QA stats, and timeline.
 */
export async function getEnhancedSessionSummary(
  sessionId: string
): Promise<EnhancedSessionSummary> {
  const baseSummary = await getSessionSummary(sessionId);

  const sessionTasks = await db.query.tasks.findMany({
    where: eq(tasks.sessionId, sessionId),
    orderBy: [desc(tasks.createdAt)],
  });

  const taskIds = sessionTasks.map((t) => t.id);
  const allQaResults: QAGateResult[] = taskIds.length > 0
    ? await db.query.qaGateResults.findMany({
        where: inArray(qaGateResults.taskId, taskIds),
      })
    : [];

  const qaByTask = groupQaByTask(allQaResults);
  const enhancedTasks = buildEnhancedTasks(sessionTasks, qaByTask);

  const totalRuns = allQaResults.length;
  const passed = allQaResults.filter((r) => r.status === 'passed').length;
  const failed = allQaResults.filter((r) => r.status === 'failed').length;
  const passRate = totalRuns > 0 ? Math.round((passed / totalRuns) * 100) : 0;

  const timeline = buildTimeline(baseSummary.session, sessionTasks);
  const { totalAdditions, totalDeletions } = computeCodeChangeStats(sessionTasks);

  return {
    ...baseSummary,
    tasks: enhancedTasks,
    qaStats: { totalRuns, passed, failed, passRate },
    timeline,
    totalAdditions,
    totalDeletions,
  };
}

/**
 * List sessions for a repository with optional filtering and pagination.
 */
export async function listSessions(
  repositoryId: string,
  options?: ListSessionsOptions
): Promise<Session[]> {
  const limit = options?.limit ?? 10;
  const offset = options?.offset ?? 0;

  let whereClause = eq(sessions.repositoryId, repositoryId);
  if (options?.status) {
    whereClause = and(
      eq(sessions.repositoryId, repositoryId),
      eq(sessions.status, options.status)
    )!;
  }

  return await db.query.sessions.findMany({
    where: whereClause,
    orderBy: [desc(sessions.startedAt)],
    limit,
    offset,
  });
}

/**
 * Get sessions with their task counts for display.
 */
export async function listSessionsWithStats(
  repositoryId: string,
  options?: ListSessionsOptions
): Promise<Array<Session & { taskCount: number }>> {
  const sessionsList = await listSessions(repositoryId, options);

  const sessionsWithStats = await Promise.all(
    sessionsList.map(async (session) => {
      const taskCount = await db
        .select()
        .from(tasks)
        .where(eq(tasks.sessionId, session.id))
        .then((rows) => rows.length);

      return {
        ...session,
        taskCount,
      };
    })
  );

  return sessionsWithStats;
}

/**
 * Abandon inactive sessions that haven't had activity for the specified threshold.
 */
export async function abandonInactiveSessions(
  inactivityThresholdMs: number = 24 * 60 * 60 * 1000
): Promise<number> {
  const threshold = new Date(Date.now() - inactivityThresholdMs);

  const inactiveSessions = await db.query.sessions.findMany({
    where: and(eq(sessions.status, 'active'), lt(sessions.lastActivity, threshold)),
  });

  for (const session of inactiveSessions) {
    await db
      .update(sessions)
      .set({
        status: 'abandoned',
        endedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, session.id));
  }

  return inactiveSessions.length;
}

/**
 * Delete a session and all its associated tasks.
 * Use with caution - this is a destructive operation.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  // First delete all tasks for this session
  await db.delete(tasks).where(eq(tasks.sessionId, sessionId));

  // Then delete the session
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

/**
 * Update session's last activity timestamp.
 * Called when any activity occurs in the session.
 */
export async function touchSession(sessionId: string): Promise<void> {
  await db
    .update(sessions)
    .set({
      lastActivity: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(sessions.id, sessionId));
}
