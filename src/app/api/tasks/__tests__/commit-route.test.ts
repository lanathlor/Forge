import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../[id]/commit/route';

// --- Mocks ---

const mockCommitTaskChanges = vi.hoisted(() => vi.fn());
const mockTaskEvents = vi.hoisted(() => ({ emit: vi.fn() }));

vi.mock('@/lib/git/commit', () => ({
  commitTaskChanges: mockCommitTaskChanges,
}));

vi.mock('@/lib/events/task-events', () => ({
  taskEvents: mockTaskEvents,
}));

// PlanExecutor is dynamically imported in the route; mock it so tests don't
// perform real DB operations. The resume path is verified via DB state
// (plan status set to 'running') rather than the executor call directly.
vi.mock('@/lib/plans/executor', () => ({
  PlanExecutor: vi.fn(() => ({ resumePlan: vi.fn() })),
}));

const mockDb = vi.hoisted(() => ({
  query: {
    tasks: { findFirst: vi.fn() },
    planTasks: { findFirst: vi.fn() },
  },
  update: vi.fn(() => ({
    set: vi.fn(() => ({ where: vi.fn() })),
  })),
}));

vi.mock('@/db', () => ({ db: mockDb }));

vi.mock('@/db/schema', () => ({
  tasks: { id: 'id' },
  planTasks: { id: 'planTaskId', taskId: 'taskId' },
  plans: { id: 'planId' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ field: a, value: b })),
}));

// --- Helpers ---

function makeRequest(id: string, body?: Record<string, unknown>): [Request, { params: Promise<{ id: string }> }] {
  return [
    new Request(`http://localhost/api/tasks/${id}/commit`, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      headers: body ? { 'Content-Type': 'application/json' } : {},
    }),
    { params: Promise.resolve({ id }) },
  ];
}

const baseTask = {
  id: 'task-1',
  prompt: 'Fix auth bug',
  status: 'waiting_approval' as const,
  sessionId: 'session-1',
  commitMessage: 'feat(auth): fix token validation',
  filesChanged: [
    { path: 'src/auth.ts', status: 'modified' as const, additions: 10, deletions: 2, patch: '' },
  ],
  session: {
    repository: { path: '/repo' },
  },
};

const commitResult = {
  sha: 'deadbeef',
  message: 'feat(auth): fix token validation',
  filesCommitted: ['src/auth.ts'],
  timestamp: new Date(),
};

// --- Tests ---

describe('POST /api/tasks/[id]/commit', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockDb.update.mockReturnValue({
      set: vi.fn(() => ({ where: vi.fn() })),
    });
    mockDb.query.planTasks.findFirst.mockResolvedValue(null); // default: no plan task
  });

  describe('validation', () => {
    it('returns 404 when task is not found', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce(null);

      const response = await POST(...makeRequest('missing'));
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBe('Task not found');
    });

    it('returns 400 when task status is not waiting_approval', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce({
        ...baseTask,
        status: 'approved',
      });

      const response = await POST(...makeRequest('task-1'));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('approved');
    });

    it('returns 400 when filesChanged is null', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce({
        ...baseTask,
        filesChanged: null,
      });

      const response = await POST(...makeRequest('task-1'));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('No files changed to commit');
    });

    it('returns 400 when filesChanged is empty', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce({
        ...baseTask,
        filesChanged: [],
      });

      const response = await POST(...makeRequest('task-1'));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('No files changed to commit');
    });

    it('returns 400 when no commit message is available', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce({
        ...baseTask,
        commitMessage: null,
      });

      const response = await POST(...makeRequest('task-1'));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('No commit message');
    });
  });

  describe('commit message resolution', () => {
    it('uses stored commitMessage when no user-provided message', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce(baseTask);
      mockCommitTaskChanges.mockResolvedValueOnce(commitResult);

      const response = await POST(...makeRequest('task-1'));
      const body = await response.json();

      expect(mockCommitTaskChanges).toHaveBeenCalledWith(
        '/repo',
        baseTask.filesChanged,
        'feat(auth): fix token validation'
      );
      expect(body.commitMessage).toBe('feat(auth): fix token validation');
    });

    it('uses user-provided commitMessage when given', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce(baseTask);
      mockCommitTaskChanges.mockResolvedValueOnce(commitResult);

      const response = await POST(...makeRequest('task-1', { commitMessage: 'custom: my message' }));

      expect(mockCommitTaskChanges).toHaveBeenCalledWith(
        '/repo',
        baseTask.filesChanged,
        'custom: my message'
      );
    });

    it('user-provided message overrides stored commitMessage', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce(baseTask);
      mockCommitTaskChanges.mockResolvedValueOnce(commitResult);

      await POST(...makeRequest('task-1', { commitMessage: 'override message' }));

      expect(mockCommitTaskChanges).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        'override message'
      );
    });

    it('user-provided message is returned in response', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce(baseTask);
      mockCommitTaskChanges.mockResolvedValueOnce(commitResult);

      const response = await POST(...makeRequest('task-1', { commitMessage: 'override message' }));
      const body = await response.json();

      expect(body.commitMessage).toBe('override message');
    });
  });

  describe('successful commit', () => {
    beforeEach(() => {
      mockDb.query.tasks.findFirst.mockResolvedValue(baseTask);
      mockCommitTaskChanges.mockResolvedValue(commitResult);
    });

    it('returns 200 with commit details', async () => {
      const response = await POST(...makeRequest('task-1'));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.commitSha).toBe('deadbeef');
      expect(body.commitMessage).toBe('feat(auth): fix token validation');
      expect(body.filesCommitted).toEqual(['src/auth.ts']);
    });

    it('updates task status to approved in DB', async () => {
      const whereMock = vi.fn();
      const setMock = vi.fn(() => ({ where: whereMock }));
      mockDb.update.mockReturnValueOnce({ set: setMock });

      await POST(...makeRequest('task-1'));

      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'approved',
          committedSha: 'deadbeef',
        })
      );
    });

    it('emits task:update event with approved status', async () => {
      await POST(...makeRequest('task-1'));

      expect(mockTaskEvents.emit).toHaveBeenCalledWith('task:update', {
        sessionId: 'session-1',
        taskId: 'task-1',
        status: 'approved',
      });
    });
  });

  describe('plan task synchronization', () => {
    beforeEach(() => {
      mockDb.query.tasks.findFirst.mockResolvedValue(baseTask);
      mockCommitTaskChanges.mockResolvedValue(commitResult);
    });

    it('does nothing plan-related when no plan task exists', async () => {
      mockDb.query.planTasks.findFirst.mockResolvedValueOnce(null);

      let updateCallCount = 0;
      mockDb.update.mockImplementation(() => {
        updateCallCount++;
        return { set: vi.fn(() => ({ where: vi.fn() })) };
      });

      await POST(...makeRequest('task-1'));

      // Only one update: the task itself. No planTask or plan updates.
      expect(updateCallCount).toBe(1);
    });

    it('updates plan task to completed', async () => {
      const planTask = {
        id: 'pt-1',
        taskId: 'task-1',
        plan: { id: 'plan-1', status: 'running', currentTaskId: 'other-task' },
      };
      mockDb.query.planTasks.findFirst.mockResolvedValueOnce(planTask);

      await POST(...makeRequest('task-1'));

      expect(mockDb.update).toHaveBeenCalled();
    });

    it('does not set plan status to running when plan is already running', async () => {
      const planTask = {
        id: 'pt-1',
        taskId: 'task-1',
        plan: { id: 'plan-1', status: 'running', currentTaskId: 'pt-1' },
      };
      mockDb.query.planTasks.findFirst.mockResolvedValueOnce(planTask);

      const setMock = vi.fn(() => ({ where: vi.fn() }));
      mockDb.update.mockImplementation(() => ({ set: setMock }));

      await POST(...makeRequest('task-1'));

      const updateSets = (setMock.mock.calls as unknown[][]).map((args) => args[0]);
      expect(updateSets).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ status: 'running' })])
      );
    });

    it('sets plan status to running when plan was paused and currentTaskId matches', async () => {
      const planTask = {
        id: 'pt-1',
        taskId: 'task-1',
        plan: { id: 'plan-1', status: 'paused', currentTaskId: 'pt-1' },
      };
      mockDb.query.planTasks.findFirst.mockResolvedValueOnce(planTask);

      const setMock = vi.fn(() => ({ where: vi.fn() }));
      mockDb.update.mockImplementation(() => ({ set: setMock }));

      await POST(...makeRequest('task-1'));

      const updateSets = (setMock.mock.calls as unknown[][]).map((args) => args[0]);
      expect(updateSets).toEqual(
        expect.arrayContaining([expect.objectContaining({ status: 'running' })])
      );
    });

    it('sets plan status to running when plan was failed and currentTaskId matches', async () => {
      const planTask = {
        id: 'pt-1',
        taskId: 'task-1',
        plan: { id: 'plan-1', status: 'failed', currentTaskId: 'pt-1' },
      };
      mockDb.query.planTasks.findFirst.mockResolvedValueOnce(planTask);

      const setMock = vi.fn(() => ({ where: vi.fn() }));
      mockDb.update.mockImplementation(() => ({ set: setMock }));

      await POST(...makeRequest('task-1'));

      const updateSets = (setMock.mock.calls as unknown[][]).map((args) => args[0]);
      expect(updateSets).toEqual(
        expect.arrayContaining([expect.objectContaining({ status: 'running' })])
      );
    });

    it('does not set plan status to running when currentTaskId does not match plan task', async () => {
      const planTask = {
        id: 'pt-1',
        taskId: 'task-1',
        plan: { id: 'plan-1', status: 'paused', currentTaskId: 'different-pt' },
      };
      mockDb.query.planTasks.findFirst.mockResolvedValueOnce(planTask);

      const setMock = vi.fn(() => ({ where: vi.fn() }));
      mockDb.update.mockImplementation(() => ({ set: setMock }));

      await POST(...makeRequest('task-1'));

      const updateSets = (setMock.mock.calls as unknown[][]).map((args) => args[0]);
      expect(updateSets).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ status: 'running' })])
      );
    });

  });

  describe('error handling', () => {
    it('returns 500 when commitTaskChanges throws', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce(baseTask);
      mockCommitTaskChanges.mockRejectedValueOnce(new Error('git lock file'));

      const response = await POST(...makeRequest('task-1'));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toContain('git lock file');
    });

    it('returns 500 with generic message for non-Error throws', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce(baseTask);
      mockCommitTaskChanges.mockRejectedValueOnce('raw string error');

      const response = await POST(...makeRequest('task-1'));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('Failed to commit task');
    });

    it('returns 500 when DB update throws', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce(baseTask);
      mockCommitTaskChanges.mockResolvedValueOnce(commitResult);
      mockDb.update.mockImplementationOnce(() => {
        throw new Error('DB write failed');
      });

      const response = await POST(...makeRequest('task-1'));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toContain('DB write failed');
    });

    it('handles malformed request body gracefully', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce(baseTask);
      mockCommitTaskChanges.mockResolvedValueOnce(commitResult);

      // Malformed JSON body — route uses .catch(() => ({})) so this should default to empty body
      const [_, params] = makeRequest('task-1');
      const request = new Request('http://localhost/api/tasks/task-1/commit', {
        method: 'POST',
        body: 'not-json',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request, params);
      const body = await response.json();

      // Should use stored commitMessage, not fail
      expect(body.success).toBe(true);
    });
  });
});
