import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, GET } from '../route';

const mockDb = vi.hoisted(() => ({
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(),
    })),
  })),
  query: {
    tasks: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/db', () => ({
  db: mockDb,
}));

vi.mock('@/db/schema/tasks', () => ({
  tasks: { id: 'id', sessionId: 'sessionId' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ field: a, value: b })),
}));

const mockExecuteTask = vi.hoisted(() => vi.fn());

vi.mock('@/lib/tasks/orchestrator', () => ({
  executeTask: mockExecuteTask,
}));

describe('tasks API route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/tasks', () => {
    it('should create a new task successfully', async () => {
      const mockTask = {
        id: 'task-123',
        sessionId: 'session-456',
        prompt: 'Fix authentication bug',
        status: 'pending',
        createdAt: new Date(),
      };

      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([mockTask]),
        }),
      });

      mockExecuteTask.mockResolvedValueOnce(undefined);

      const request = new Request('http://localhost/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'session-456',
          prompt: 'Fix authentication bug',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.task.id).toBe(mockTask.id);
      expect(data.task.sessionId).toBe(mockTask.sessionId);
      expect(data.task.prompt).toBe(mockTask.prompt);
      expect(data.task.status).toBe(mockTask.status);
      expect(mockExecuteTask).toHaveBeenCalledWith('task-123');
    });

    it('should return 400 when prompt is missing', async () => {
      const request = new Request('http://localhost/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'session-456',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required fields: sessionId and prompt');
    });

    it('should return 400 when sessionId is missing', async () => {
      const request = new Request('http://localhost/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Fix bug',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required fields: sessionId and prompt');
    });

    it('should return 500 when task creation fails', async () => {
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([]),
        }),
      });

      const request = new Request('http://localhost/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'session-456',
          prompt: 'Fix bug',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to create task');
    });

    it('should return 500 when database throws error', async () => {
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockRejectedValueOnce(new Error('DB error')),
        }),
      });

      const request = new Request('http://localhost/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'session-456',
          prompt: 'Fix bug',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to create task');
    });

    it('should not wait for task execution', async () => {
      const mockTask = {
        id: 'task-123',
        sessionId: 'session-456',
        prompt: 'Long task',
        status: 'pending',
      };

      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([mockTask]),
        }),
      });

      // Simulate slow task execution
      mockExecuteTask.mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(resolve, 10000))
      );

      const request = new Request('http://localhost/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'session-456',
          prompt: 'Long task',
        }),
      });

      const startTime = Date.now();
      const response = await POST(request);
      const elapsed = Date.now() - startTime;

      expect(response.status).toBe(200);
      // Response should be immediate, not waiting for task
      expect(elapsed).toBeLessThan(1000);
    });
  });

  describe('GET /api/tasks', () => {
    it('should return all tasks when no sessionId provided', async () => {
      const mockTasks = [
        { id: 'task-1', prompt: 'Task 1', status: 'completed' },
        { id: 'task-2', prompt: 'Task 2', status: 'pending' },
      ];

      mockDb.query.tasks.findMany.mockResolvedValueOnce(mockTasks);

      const request = new Request('http://localhost/api/tasks');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tasks).toEqual(mockTasks);
    });

    it('should filter tasks by sessionId when provided', async () => {
      const mockTasks = [
        { id: 'task-1', sessionId: 'session-123', prompt: 'Task 1' },
      ];

      mockDb.query.tasks.findMany.mockResolvedValueOnce(mockTasks);

      const request = new Request('http://localhost/api/tasks?sessionId=session-123');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tasks).toEqual(mockTasks);
    });

    it('should return empty array when no tasks found', async () => {
      mockDb.query.tasks.findMany.mockResolvedValueOnce([]);

      const request = new Request('http://localhost/api/tasks');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.tasks).toEqual([]);
    });

    it('should return 500 when database throws error', async () => {
      mockDb.query.tasks.findMany.mockRejectedValueOnce(new Error('DB error'));

      const request = new Request('http://localhost/api/tasks');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch tasks');
    });
  });
});
