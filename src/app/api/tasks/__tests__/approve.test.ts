import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../[id]/approve/route';
import type { FileChange } from '@/db/schema/tasks';

// --- Mocks ---

const mockGenerateCommitMessage = vi.hoisted(() => vi.fn());
const mockGetDiffForFiles = vi.hoisted(() => vi.fn());
const mockTaskEvents = vi.hoisted(() => ({ emit: vi.fn() }));

vi.mock('@/lib/claude/commit-message', () => ({
  generateCommitMessage: mockGenerateCommitMessage,
}));

vi.mock('@/lib/git/diff', () => ({
  getDiffForFiles: mockGetDiffForFiles,
}));

vi.mock('@/lib/events/task-events', () => ({
  taskEvents: mockTaskEvents,
}));

const mockDb = vi.hoisted(() => ({
  query: {
    tasks: {
      findFirst: vi.fn(),
    },
  },
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(),
    })),
  })),
}));

vi.mock('@/db', () => ({ db: mockDb }));
vi.mock('@/db/schema/tasks', () => ({ tasks: { id: 'id' } }));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ field: a, value: b })),
}));

// --- Helpers ---

function makeRequest(id: string): [Request, { params: Promise<{ id: string }> }] {
  return [
    new Request(`http://localhost/api/tasks/${id}/approve`, { method: 'POST' }),
    { params: Promise.resolve({ id }) },
  ];
}

const filesChanged: FileChange[] = [
  { path: 'src/auth.ts', status: 'modified', additions: 10, deletions: 2, patch: '' },
];

const baseTask = {
  id: 'task-1',
  prompt: 'Fix auth bug',
  status: 'waiting_approval' as const,
  sessionId: 'session-1',
  startingCommit: 'abc123',
  diffContent: 'diff --git a/src/auth.ts b/src/auth.ts\n@@ -1 +1 @@\n-old\n+new',
  filesChanged,
  commitMessage: null,
  session: {
    repository: { path: '/repo' },
  },
};

// --- Tests ---

describe('POST /api/tasks/[id]/approve', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockDb.update.mockReturnValue({
      set: vi.fn(() => ({ where: vi.fn() })),
    });
  });

  describe('validation', () => {
    it('returns 404 when task is not found', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce(null);

      const response = await POST(...makeRequest('missing-task'));
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBe('Task not found');
    });

    it('returns 400 when task status is not waiting_approval', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce({
        ...baseTask,
        status: 'running',
      });

      const response = await POST(...makeRequest('task-1'));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('running');
      expect(body.error).toContain('waiting_approval');
    });

    it('returns 400 for any non-waiting_approval status', async () => {
      for (const status of ['approved', 'failed', 'pending']) {
        vi.resetAllMocks();
        mockDb.query.tasks.findFirst.mockResolvedValueOnce({ ...baseTask, status });

        const response = await POST(...makeRequest('task-1'));
        expect(response.status).toBe(400);
      }
    });
  });

  describe('task with no file changes', () => {
    it('marks task approved and returns noChanges when filesChanged is null', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce({
        ...baseTask,
        filesChanged: null,
      });

      const response = await POST(...makeRequest('task-1'));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.noChanges).toBe(true);
    });

    it('marks task approved and returns noChanges when filesChanged is empty', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce({
        ...baseTask,
        filesChanged: [],
      });

      const response = await POST(...makeRequest('task-1'));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.noChanges).toBe(true);
    });

    it('updates task status to approved in DB', async () => {
      const whereMock = vi.fn();
      const setMock = vi.fn(() => ({ where: whereMock }));
      mockDb.update.mockReturnValueOnce({ set: setMock });
      mockDb.query.tasks.findFirst.mockResolvedValueOnce({
        ...baseTask,
        filesChanged: [],
      });

      await POST(...makeRequest('task-1'));

      expect(mockDb.update).toHaveBeenCalled();
      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'approved' })
      );
    });

    it('emits task:update event with approved status', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce({
        ...baseTask,
        filesChanged: [],
      });

      await POST(...makeRequest('task-1'));

      expect(mockTaskEvents.emit).toHaveBeenCalledWith('task:update', {
        sessionId: 'session-1',
        taskId: 'task-1',
        status: 'approved',
      });
    });

    it('does not call generateCommitMessage when no files changed', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce({
        ...baseTask,
        filesChanged: [],
      });

      await POST(...makeRequest('task-1'));

      expect(mockGenerateCommitMessage).not.toHaveBeenCalled();
    });
  });

  describe('task with file changes — diff content available', () => {
    it('calls generateCommitMessage with task data', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce(baseTask);
      mockGenerateCommitMessage.mockResolvedValueOnce('feat(auth): fix token validation');

      await POST(...makeRequest('task-1'));

      expect(mockGenerateCommitMessage).toHaveBeenCalledWith(
        baseTask.prompt,
        baseTask.filesChanged,
        baseTask.diffContent,
        '/repo'
      );
    });

    it('returns commit message and file stats in response', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce(baseTask);
      mockGenerateCommitMessage.mockResolvedValueOnce('feat(auth): fix token validation');

      const response = await POST(...makeRequest('task-1'));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.commitMessage).toBe('feat(auth): fix token validation');
      expect(body.stats.filesCount).toBe(1);
      expect(body.stats.insertions).toBe(10);
      expect(body.stats.deletions).toBe(2);
    });

    it('saves commitMessage to DB', async () => {
      const whereMock = vi.fn();
      const setMock = vi.fn(() => ({ where: whereMock }));
      mockDb.update.mockReturnValueOnce({ set: setMock });
      mockDb.query.tasks.findFirst.mockResolvedValueOnce(baseTask);
      mockGenerateCommitMessage.mockResolvedValueOnce('feat(auth): fix bug');

      await POST(...makeRequest('task-1'));

      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({ commitMessage: 'feat(auth): fix bug' })
      );
    });

    it('does not re-fetch diff when diffContent already stored', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce(baseTask);
      mockGenerateCommitMessage.mockResolvedValueOnce('feat: message');

      await POST(...makeRequest('task-1'));

      expect(mockGetDiffForFiles).not.toHaveBeenCalled();
    });
  });

  describe('task with file changes — diff content missing', () => {
    const taskWithoutDiff = { ...baseTask, diffContent: '' };

    it('regenerates diff from repo when startingCommit is available', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce(taskWithoutDiff);
      mockGetDiffForFiles.mockResolvedValueOnce('diff --git a/src/auth.ts b/src/auth.ts\n+new line');
      mockGenerateCommitMessage.mockResolvedValueOnce('feat(auth): add new line');

      await POST(...makeRequest('task-1'));

      expect(mockGetDiffForFiles).toHaveBeenCalledWith(
        '/repo',
        'abc123',
        filesChanged
      );
      expect(mockGenerateCommitMessage).toHaveBeenCalled();
    });

    it('persists regenerated diff to DB', async () => {
      const regeneratedDiff = 'diff --git a/src/auth.ts b/src/auth.ts\n+new';
      const whereMock = vi.fn();
      const setMock = vi.fn(() => ({ where: whereMock }));
      mockDb.update
        .mockReturnValueOnce({ set: setMock }) // diff persistence
        .mockReturnValueOnce({ set: vi.fn(() => ({ where: vi.fn() })) }); // commitMessage save
      mockDb.query.tasks.findFirst.mockResolvedValueOnce(taskWithoutDiff);
      mockGetDiffForFiles.mockResolvedValueOnce(regeneratedDiff);
      mockGenerateCommitMessage.mockResolvedValueOnce('feat: fix');

      await POST(...makeRequest('task-1'));

      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({ diffContent: regeneratedDiff })
      );
    });

    it('uses placeholder commit message when no startingCommit', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce({
        ...taskWithoutDiff,
        startingCommit: null,
      });

      const response = await POST(...makeRequest('task-1'));
      const body = await response.json();

      expect(mockGetDiffForFiles).not.toHaveBeenCalled();
      expect(mockGenerateCommitMessage).not.toHaveBeenCalled();
      expect(body.commitMessage).toContain('chore: update');
      expect(body.commitMessage).toContain('src/auth.ts');
    });

    it('uses placeholder commit message when diff regeneration fails', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce(taskWithoutDiff);
      mockGetDiffForFiles.mockRejectedValueOnce(new Error('git error'));

      const response = await POST(...makeRequest('task-1'));
      const body = await response.json();

      expect(mockGenerateCommitMessage).not.toHaveBeenCalled();
      expect(body.commitMessage).toContain('chore: update');
    });

    it('uses placeholder commit message when regenerated diff is empty', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce(taskWithoutDiff);
      mockGetDiffForFiles.mockResolvedValueOnce('');

      const response = await POST(...makeRequest('task-1'));
      const body = await response.json();

      expect(mockGenerateCommitMessage).not.toHaveBeenCalled();
      expect(body.commitMessage).toContain('chore: update');
    });

    it('placeholder message includes all changed file paths', async () => {
      const multiFileTask = {
        ...taskWithoutDiff,
        startingCommit: null,
        filesChanged: [
          { path: 'a.ts', status: 'modified' as const, additions: 1, deletions: 0, patch: '' },
          { path: 'b.ts', status: 'added' as const, additions: 5, deletions: 0, patch: '' },
        ],
      };
      mockDb.query.tasks.findFirst.mockResolvedValueOnce(multiFileTask);

      const response = await POST(...makeRequest('task-1'));
      const body = await response.json();

      expect(body.commitMessage).toContain('a.ts');
      expect(body.commitMessage).toContain('b.ts');
      expect(body.commitMessage).toContain('2 file(s)');
    });
  });

  describe('error handling', () => {
    it('returns 500 when generateCommitMessage throws', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce(baseTask);
      mockGenerateCommitMessage.mockRejectedValueOnce(new Error('AI unavailable'));

      const response = await POST(...makeRequest('task-1'));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toContain('AI unavailable');
    });

    it('returns 500 with generic message for non-Error throws', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce(baseTask);
      mockGenerateCommitMessage.mockRejectedValueOnce('string error');

      const response = await POST(...makeRequest('task-1'));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('Failed to generate commit message');
    });

    it('returns 500 when DB query throws', async () => {
      mockDb.query.tasks.findFirst.mockRejectedValueOnce(new Error('DB down'));

      const response = await POST(...makeRequest('task-1'));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toContain('DB down');
    });
  });
});
