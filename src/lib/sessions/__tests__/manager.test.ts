import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Session } from '@/db/schema/sessions';

const mockExecAsync = vi.hoisted(() => vi.fn());
const mockGetContainerPath = vi.hoisted(() => vi.fn((path: string) => path));

vi.mock('@/lib/qa-gates/command-executor', () => ({
  execAsync: mockExecAsync,
  getContainerPath: mockGetContainerPath,
}));

// Create all mock functions inside vi.hoisted() to ensure proper initialization order
const {
  mockDb,
  mockUpdate,
  mockSet,
  mockWhere,
  mockReturning,
  mockInsert,
  mockValues,
  mockValuesReturning,
  mockDelete,
  mockDeleteWhere,
  mockSelect,
  mockSelectFrom,
  mockSelectWhere,
  mockSelectThen,
} = vi.hoisted(() => {
  const mockReturning = vi.fn();
  const mockWhere = vi.fn(() => ({ returning: mockReturning }));
  const mockSet = vi.fn(() => ({ where: mockWhere }));
  const mockUpdate = vi.fn(() => ({ set: mockSet }));

  const mockValuesReturning = vi.fn();
  const mockValues = vi.fn(() => ({ returning: mockValuesReturning }));
  const mockInsert = vi.fn(() => ({ values: mockValues }));

  const mockDeleteWhere = vi.fn();
  const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }));

  const mockSelectThen = vi.fn();
  const mockSelectWhere = vi.fn(() => ({ then: mockSelectThen }));
  const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }));
  const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));

  const mockDb = {
    query: {
      sessions: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      repositories: {
        findFirst: vi.fn(),
      },
      tasks: {
        findMany: vi.fn(),
      },
    },
    update: mockUpdate,
    insert: mockInsert,
    delete: mockDelete,
    select: mockSelect,
  };

  return {
    mockDb,
    mockUpdate,
    mockSet,
    mockWhere,
    mockReturning,
    mockInsert,
    mockValues,
    mockValuesReturning,
    mockDelete,
    mockDeleteWhere,
    mockSelect,
    mockSelectFrom,
    mockSelectWhere,
    mockSelectThen,
  };
});

vi.mock('@/db', () => ({
  db: mockDb,
}));

vi.mock('@/db/schema/sessions', () => ({
  sessions: { id: 'id', repositoryId: 'repository_id', status: 'status', lastActivity: 'last_activity' },
}));

vi.mock('@/db/schema/tasks', () => ({
  tasks: { id: 'id', sessionId: 'session_id' },
}));

vi.mock('@/db/schema/repositories', () => ({
  repositories: { id: 'id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ field: a, value: b })),
  and: vi.fn((...args) => ({ type: 'and', conditions: args })),
  desc: vi.fn((a) => ({ type: 'desc', field: a })),
  lt: vi.fn((a, b) => ({ type: 'lt', field: a, value: b })),
}));

describe('sessions/manager', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    // Re-setup the mock chain after resetAllMocks clears implementations
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ returning: mockReturning });
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ returning: mockValuesReturning });
    mockDelete.mockReturnValue({ where: mockDeleteWhere });
    mockSelect.mockReturnValue({ from: mockSelectFrom });
    mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
    mockSelectWhere.mockReturnValue({ then: mockSelectThen });
  });

  describe('getActiveSession', () => {
    it('should return active session and update lastActivity', async () => {
      const mockSession: Partial<Session> = {
        id: 'session-1',
        repositoryId: 'repo-1',
        status: 'active',
      };

      mockDb.query.sessions.findFirst.mockResolvedValueOnce(mockSession);
      mockReturning.mockResolvedValueOnce([mockSession]);

      const { getActiveSession } = await import('../manager');
      const result = await getActiveSession('repo-1');

      expect(result).toEqual(mockSession);
      expect(mockDb.query.sessions.findFirst).toHaveBeenCalled();
    });

    it('should return null when no active session exists', async () => {
      mockDb.query.sessions.findFirst.mockResolvedValueOnce(undefined);

      const { getActiveSession } = await import('../manager');
      const result = await getActiveSession('repo-1');

      expect(result).toBeNull();
    });
  });

  describe('createSession', () => {
    it('should create a new session successfully', async () => {
      const mockRepository = {
        id: 'repo-1',
        name: 'test-repo',
        path: '/path/to/repo',
        currentBranch: 'main',
      };

      const mockSession: Partial<Session> = {
        id: 'session-1',
        repositoryId: 'repo-1',
        status: 'active',
        startBranch: 'main',
      };

      mockDb.query.repositories.findFirst.mockResolvedValueOnce(mockRepository);
      mockValuesReturning.mockResolvedValueOnce([mockSession]);

      const { createSession } = await import('../manager');
      const result = await createSession('repo-1');

      expect(result).toEqual(mockSession);
      expect(mockDb.query.repositories.findFirst).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should throw error when repository not found', async () => {
      mockDb.query.repositories.findFirst.mockResolvedValueOnce(undefined);

      const { createSession } = await import('../manager');

      await expect(createSession('nonexistent')).rejects.toThrow(
        'Repository not found: nonexistent'
      );
    });

    it('should throw error when session creation fails', async () => {
      const mockRepository = {
        id: 'repo-1',
        name: 'test-repo',
        path: '/path/to/repo',
        currentBranch: 'main',
      };

      mockDb.query.repositories.findFirst.mockResolvedValueOnce(mockRepository);
      mockValuesReturning.mockResolvedValueOnce([]);

      const { createSession } = await import('../manager');

      await expect(createSession('repo-1')).rejects.toThrow('Failed to create session');
    });
  });

  describe('getOrCreateActiveSession', () => {
    it('should return existing active session if available', async () => {
      const mockSession: Partial<Session> = {
        id: 'session-1',
        repositoryId: 'repo-1',
        status: 'active',
      };

      mockDb.query.sessions.findFirst.mockResolvedValueOnce(mockSession);
      mockReturning.mockResolvedValueOnce([mockSession]);

      const { getOrCreateActiveSession } = await import('../manager');
      const result = await getOrCreateActiveSession('repo-1');

      expect(result).toEqual(mockSession);
    });

    it('should create new session when none exists', async () => {
      const mockRepository = {
        id: 'repo-1',
        name: 'test-repo',
        path: '/path/to/repo',
        currentBranch: 'main',
      };

      const mockSession: Partial<Session> = {
        id: 'session-2',
        repositoryId: 'repo-1',
        status: 'active',
        startBranch: 'main',
      };

      mockDb.query.sessions.findFirst.mockResolvedValueOnce(undefined);
      mockDb.query.repositories.findFirst.mockResolvedValueOnce(mockRepository);
      mockValuesReturning.mockResolvedValueOnce([mockSession]);

      const { getOrCreateActiveSession } = await import('../manager');
      const result = await getOrCreateActiveSession('repo-1');

      expect(result).toEqual(mockSession);
    });
  });

  describe('endSession', () => {
    it('should end session successfully', async () => {
      const mockSession: Partial<Session> = {
        id: 'session-1',
        repositoryId: 'repo-1',
        status: 'active',
      };

      const mockRepository = {
        id: 'repo-1',
        name: 'test-repo',
        path: '/path/to/repo',
        currentBranch: 'main',
      };

      const updatedSession: Partial<Session> = {
        ...mockSession,
        status: 'completed',
        endBranch: 'main',
      };

      mockDb.query.sessions.findFirst.mockResolvedValueOnce(mockSession);
      mockDb.query.repositories.findFirst.mockResolvedValueOnce(mockRepository);
      mockExecAsync.mockResolvedValueOnce({ stdout: 'main\n', stderr: '' });
      mockReturning.mockResolvedValueOnce([updatedSession]);

      const { endSession } = await import('../manager');
      const result = await endSession('session-1');

      expect(result.status).toBe('completed');
    });

    it('should throw error when session not found', async () => {
      mockDb.query.sessions.findFirst.mockResolvedValueOnce(undefined);

      const { endSession } = await import('../manager');

      await expect(endSession('nonexistent')).rejects.toThrow(
        'Session not found: nonexistent'
      );
    });

    it('should use repository currentBranch when git command fails', async () => {
      const mockSession: Partial<Session> = {
        id: 'session-1',
        repositoryId: 'repo-1',
        status: 'active',
      };

      const mockRepository = {
        id: 'repo-1',
        name: 'test-repo',
        path: '/path/to/repo',
        currentBranch: 'fallback-branch',
      };

      const updatedSession: Partial<Session> = {
        ...mockSession,
        status: 'completed',
        endBranch: 'fallback-branch',
      };

      mockDb.query.sessions.findFirst.mockResolvedValueOnce(mockSession);
      mockDb.query.repositories.findFirst.mockResolvedValueOnce(mockRepository);
      mockExecAsync.mockRejectedValueOnce(new Error('Git error'));
      mockReturning.mockResolvedValueOnce([updatedSession]);

      const { endSession } = await import('../manager');
      const result = await endSession('session-1');

      expect(result).toEqual(updatedSession);
    });

    it('should throw error when update fails', async () => {
      const mockSession: Partial<Session> = {
        id: 'session-1',
        repositoryId: 'repo-1',
        status: 'active',
      };

      mockDb.query.sessions.findFirst.mockResolvedValueOnce(mockSession);
      mockDb.query.repositories.findFirst.mockResolvedValueOnce(null);
      mockReturning.mockResolvedValueOnce([]);

      const { endSession } = await import('../manager');

      await expect(endSession('session-1')).rejects.toThrow('Failed to update session');
    });
  });

  describe('pauseSession', () => {
    it('should pause session successfully', async () => {
      const pausedSession: Partial<Session> = {
        id: 'session-1',
        repositoryId: 'repo-1',
        status: 'paused',
      };

      mockReturning.mockResolvedValueOnce([pausedSession]);

      const { pauseSession } = await import('../manager');
      const result = await pauseSession('session-1');

      expect(result.status).toBe('paused');
    });

    it('should throw error when session not found', async () => {
      mockReturning.mockResolvedValueOnce([]);

      const { pauseSession } = await import('../manager');

      await expect(pauseSession('nonexistent')).rejects.toThrow(
        'Session not found: nonexistent'
      );
    });
  });

  describe('resumeSession', () => {
    it('should resume session successfully', async () => {
      const resumedSession: Partial<Session> = {
        id: 'session-1',
        repositoryId: 'repo-1',
        status: 'active',
      };

      mockReturning.mockResolvedValueOnce([resumedSession]);

      const { resumeSession } = await import('../manager');
      const result = await resumeSession('session-1');

      expect(result.status).toBe('active');
    });

    it('should throw error when session not found', async () => {
      mockReturning.mockResolvedValueOnce([]);

      const { resumeSession } = await import('../manager');

      await expect(resumeSession('nonexistent')).rejects.toThrow(
        'Session not found: nonexistent'
      );
    });
  });

  describe('getSessionSummary', () => {
    it('should return session summary with stats', async () => {
      const mockSession = {
        id: 'session-1',
        repositoryId: 'repo-1',
        status: 'completed',
        startedAt: new Date('2024-01-01T10:00:00Z'),
        endedAt: new Date('2024-01-01T12:00:00Z'),
        repository: {
          id: 'repo-1',
          name: 'test-repo',
          path: '/path/to/repo',
          currentBranch: 'main',
        },
      };

      const mockTasks = [
        {
          id: 'task-1',
          status: 'completed',
          filesChanged: [{ path: 'file1.ts' }],
          committedSha: 'sha1',
        },
        {
          id: 'task-2',
          status: 'rejected',
          filesChanged: [{ path: 'file2.ts' }],
          committedSha: null,
        },
        {
          id: 'task-3',
          status: 'failed',
          filesChanged: null,
          committedSha: null,
        },
      ];

      mockDb.query.sessions.findFirst.mockResolvedValueOnce(mockSession);
      mockDb.query.tasks.findMany.mockResolvedValueOnce(mockTasks);

      const { getSessionSummary } = await import('../manager');
      const result = await getSessionSummary('session-1');

      expect(result.stats.totalTasks).toBe(3);
      expect(result.stats.completedTasks).toBe(1);
      expect(result.stats.rejectedTasks).toBe(1);
      expect(result.stats.failedTasks).toBe(1);
      expect(result.stats.filesChanged).toBe(2);
      expect(result.stats.commits).toBe(1);
    });

    it('should throw error when session not found', async () => {
      mockDb.query.sessions.findFirst.mockResolvedValueOnce(undefined);

      const { getSessionSummary } = await import('../manager');

      await expect(getSessionSummary('nonexistent')).rejects.toThrow(
        'Session not found: nonexistent'
      );
    });

    it('should calculate duration for ongoing session', async () => {
      const now = Date.now();
      const mockSession = {
        id: 'session-1',
        repositoryId: 'repo-1',
        status: 'active',
        startedAt: new Date(now - 60000), // 1 minute ago
        endedAt: null,
        repository: {
          id: 'repo-1',
          name: 'test-repo',
          path: '/path/to/repo',
          currentBranch: 'main',
        },
      };

      mockDb.query.sessions.findFirst.mockResolvedValueOnce(mockSession);
      mockDb.query.tasks.findMany.mockResolvedValueOnce([]);

      const { getSessionSummary } = await import('../manager');
      const result = await getSessionSummary('session-1');

      expect(result.stats.duration).toBeGreaterThanOrEqual(60000);
    });
  });

  describe('listSessions', () => {
    it('should list sessions for a repository', async () => {
      const mockSessions = [
        { id: 'session-1', repositoryId: 'repo-1', status: 'active' },
        { id: 'session-2', repositoryId: 'repo-1', status: 'completed' },
      ];

      mockDb.query.sessions.findMany.mockResolvedValueOnce(mockSessions);

      const { listSessions } = await import('../manager');
      const result = await listSessions('repo-1');

      expect(result).toEqual(mockSessions);
      expect(result.length).toBe(2);
    });

    it('should respect limit and offset options', async () => {
      const mockSessions = [
        { id: 'session-1', repositoryId: 'repo-1', status: 'active' },
      ];

      mockDb.query.sessions.findMany.mockResolvedValueOnce(mockSessions);

      const { listSessions } = await import('../manager');
      const result = await listSessions('repo-1', { limit: 5, offset: 10 });

      expect(result).toEqual(mockSessions);
    });

    it('should filter by status when provided', async () => {
      const mockSessions = [
        { id: 'session-1', repositoryId: 'repo-1', status: 'active' },
      ];

      mockDb.query.sessions.findMany.mockResolvedValueOnce(mockSessions);

      const { listSessions } = await import('../manager');
      const result = await listSessions('repo-1', { status: 'active' });

      expect(result).toEqual(mockSessions);
    });
  });

  describe('listSessionsWithStats', () => {
    it('should list sessions with task counts', async () => {
      const mockSessions = [
        { id: 'session-1', repositoryId: 'repo-1', status: 'active' },
        { id: 'session-2', repositoryId: 'repo-1', status: 'completed' },
      ];

      mockDb.query.sessions.findMany.mockResolvedValueOnce(mockSessions);

      // Mock the select chain to return a thenable that resolves with rows
      // The actual code calls .then() on the result, so we need to mock the then function
      mockSelectThen
        .mockImplementationOnce((callback: (rows: { id: number }[]) => void) => {
          return Promise.resolve(callback([{ id: 1 }, { id: 2 }])); // 2 tasks for session-1
        })
        .mockImplementationOnce((callback: (rows: { id: number }[]) => void) => {
          return Promise.resolve(callback([{ id: 3 }])); // 1 task for session-2
        });

      const { listSessionsWithStats } = await import('../manager');
      const result = await listSessionsWithStats('repo-1');

      expect(result).toHaveLength(2);
      expect(result[0]!.taskCount).toBe(2);
      expect(result[1]!.taskCount).toBe(1);
    });
  });

  describe('abandonInactiveSessions', () => {
    it('should abandon inactive sessions', async () => {
      const inactiveSessions = [
        { id: 'session-1', repositoryId: 'repo-1', status: 'active' },
        { id: 'session-2', repositoryId: 'repo-1', status: 'active' },
      ];

      mockDb.query.sessions.findMany.mockResolvedValueOnce(inactiveSessions);
      mockReturning.mockResolvedValue([{ id: 'session-1' }, { id: 'session-2' }]);

      const { abandonInactiveSessions } = await import('../manager');
      const result = await abandonInactiveSessions(24 * 60 * 60 * 1000);

      expect(result).toBe(2);
    });

    it('should return 0 when no inactive sessions', async () => {
      mockDb.query.sessions.findMany.mockResolvedValueOnce([]);

      const { abandonInactiveSessions } = await import('../manager');
      const result = await abandonInactiveSessions();

      expect(result).toBe(0);
    });
  });

  describe('deleteSession', () => {
    it('should delete session and its tasks', async () => {
      mockDeleteWhere.mockResolvedValue(undefined);

      const { deleteSession } = await import('../manager');
      await deleteSession('session-1');

      expect(mockDelete).toHaveBeenCalled();
    });
  });

  describe('touchSession', () => {
    it('should update session last activity timestamp', async () => {
      mockReturning.mockResolvedValueOnce([{ id: 'session-1' }]);

      const { touchSession } = await import('../manager');
      await touchSession('session-1');

      expect(mockUpdate).toHaveBeenCalled();
    });
  });
});
