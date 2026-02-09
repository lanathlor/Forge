import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, DELETE } from '../[id]/route';

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

vi.mock('@/db', () => ({
  db: mockDb,
}));

vi.mock('@/db/schema/tasks', () => ({
  tasks: { id: 'id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ field: a, value: b })),
}));

const mockClaudeWrapper = vi.hoisted(() => ({
  cancel: vi.fn(),
}));

vi.mock('@/lib/claude/wrapper', () => ({
  claudeWrapper: mockClaudeWrapper,
}));

describe('tasks/[id] API route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/tasks/:id', () => {
    it('should return task when found', async () => {
      const mockTask = {
        id: 'task-123',
        prompt: 'Fix bug',
        status: 'completed',
        session: {
          id: 'session-1',
          repository: {
            id: 'repo-1',
            name: 'test-repo',
          },
        },
      };

      mockDb.query.tasks.findFirst.mockResolvedValueOnce(mockTask);

      const request = new Request('http://localhost/api/tasks/task-123');
      const params = Promise.resolve({ id: 'task-123' });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.task).toEqual(mockTask);
    });

    it('should return 404 when task not found', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValueOnce(null);

      const request = new Request('http://localhost/api/tasks/nonexistent');
      const params = Promise.resolve({ id: 'nonexistent' });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Task not found');
    });

    it('should return 500 when database throws error', async () => {
      mockDb.query.tasks.findFirst.mockRejectedValueOnce(new Error('DB error'));

      const request = new Request('http://localhost/api/tasks/task-123');
      const params = Promise.resolve({ id: 'task-123' });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch task');
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    it('should cancel task successfully', async () => {
      mockClaudeWrapper.cancel.mockResolvedValueOnce(undefined);

      const request = new Request('http://localhost/api/tasks/task-123', {
        method: 'DELETE',
      });
      const params = Promise.resolve({ id: 'task-123' });

      const response = await DELETE(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockClaudeWrapper.cancel).toHaveBeenCalledWith('task-123');
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should return 500 when cancel fails', async () => {
      mockClaudeWrapper.cancel.mockRejectedValueOnce(new Error('Cancel failed'));

      const request = new Request('http://localhost/api/tasks/task-123', {
        method: 'DELETE',
      });
      const params = Promise.resolve({ id: 'task-123' });

      const response = await DELETE(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to cancel task');
    });

    it('should return 500 when database update fails', async () => {
      mockClaudeWrapper.cancel.mockResolvedValueOnce(undefined);
      mockDb.update.mockImplementationOnce(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockRejectedValueOnce(new Error('DB error')),
        })),
      }));

      const request = new Request('http://localhost/api/tasks/task-123', {
        method: 'DELETE',
      });
      const params = Promise.resolve({ id: 'task-123' });

      const response = await DELETE(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to cancel task');
    });
  });
});
