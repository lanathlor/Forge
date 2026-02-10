import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getTaskWithRepo,
  clearOldResults,
  updateTaskStatus,
  runTaskQAGates,
} from '../task-qa-service';
import { db } from '@/db';
import { runQAGates } from '../runner';

vi.mock('@/db', () => ({
  db: {
    query: {
      tasks: {
        findFirst: vi.fn(),
      },
      planTasks: {
        findFirst: vi.fn(),
      },
    },
    delete: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../runner', () => ({
  runQAGates: vi.fn(),
}));

describe('Task QA Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTaskWithRepo', () => {
    it('should fetch task with repository information', async () => {
      const mockTask = {
        id: 'task-1',
        title: 'Test task',
        session: {
          id: 'session-1',
          repository: {
            id: 'repo-1',
            name: 'test-repo',
            path: '/path/to/repo',
          },
        },
      };

      vi.mocked(db.query.tasks.findFirst).mockResolvedValue(mockTask as any);

      const result = await getTaskWithRepo('task-1');

      expect(result).toEqual(mockTask);
      expect(db.query.tasks.findFirst).toHaveBeenCalled();
    });

    it('should return undefined when task not found', async () => {
      vi.mocked(db.query.tasks.findFirst).mockResolvedValue(undefined);

      const result = await getTaskWithRepo('non-existent');

      expect(result).toBeUndefined();
    });

    it('should handle database errors', async () => {
      vi.mocked(db.query.tasks.findFirst).mockRejectedValue(
        new Error('Database error')
      );

      await expect(getTaskWithRepo('task-1')).rejects.toThrow('Database error');
    });

    it('should include nested repository data', async () => {
      const mockTask = {
        id: 'task-1',
        session: {
          repository: {
            id: 'repo-1',
            path: '/test/path',
          },
        },
      };

      vi.mocked(db.query.tasks.findFirst).mockResolvedValue(mockTask as any);

      const result = await getTaskWithRepo('task-1');

      expect(result?.session.repository).toBeDefined();
      expect(result?.session.repository.path).toBe('/test/path');
    });
  });

  describe('clearOldResults', () => {
    it('should delete old QA gate results for a task', async () => {
      const mockDeleteChain = {
        where: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(db.delete).mockReturnValue(mockDeleteChain as any);

      await clearOldResults('task-1');

      expect(db.delete).toHaveBeenCalled();
      expect(mockDeleteChain.where).toHaveBeenCalled();
    });

    it('should handle deletion errors', async () => {
      const mockDeleteChain = {
        where: vi.fn().mockRejectedValue(new Error('Delete failed')),
      };

      vi.mocked(db.delete).mockReturnValue(mockDeleteChain as any);

      await expect(clearOldResults('task-1')).rejects.toThrow('Delete failed');
    });

    it('should complete successfully when no results exist', async () => {
      const mockDeleteChain = {
        where: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(db.delete).mockReturnValue(mockDeleteChain as any);

      await expect(clearOldResults('task-1')).resolves.not.toThrow();
    });
  });

  describe('updateTaskStatus', () => {
    it('should update task status to waiting_approval when all passed', async () => {
      const mockUpdateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(db.update).mockReturnValue(mockUpdateChain as any);
      vi.mocked(db.query.planTasks.findFirst).mockResolvedValue(undefined);

      await updateTaskStatus('task-1', true);

      expect(mockUpdateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'waiting_approval',
          updatedAt: expect.any(Date),
        })
      );
      expect(mockUpdateChain.where).toHaveBeenCalled();
    });

    it('should update task status to qa_failed when not all passed', async () => {
      const mockUpdateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(db.update).mockReturnValue(mockUpdateChain as any);

      await updateTaskStatus('task-1', false);

      expect(mockUpdateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'qa_failed',
          updatedAt: expect.any(Date),
        })
      );
    });

    it('should set updatedAt to current time', async () => {
      const beforeTime = new Date();
      const mockUpdateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };

      vi.mocked(db.update).mockReturnValue(mockUpdateChain as any);
      vi.mocked(db.query.planTasks.findFirst).mockResolvedValue(undefined);

      await updateTaskStatus('task-1', true);

      const afterTime = new Date();
      const setCall = mockUpdateChain.set.mock.calls[0]![0];
      expect(setCall.updatedAt.getTime()).toBeGreaterThanOrEqual(
        beforeTime.getTime()
      );
      expect(setCall.updatedAt.getTime()).toBeLessThanOrEqual(
        afterTime.getTime()
      );
    });

    it('should handle update errors', async () => {
      const mockUpdateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockRejectedValue(new Error('Update failed')),
      };

      vi.mocked(db.update).mockReturnValue(mockUpdateChain as any);
      vi.mocked(db.query.planTasks.findFirst).mockResolvedValue(undefined);

      await expect(updateTaskStatus('task-1', true)).rejects.toThrow(
        'Update failed'
      );
    });
  });

  describe('runTaskQAGates', () => {
    it('should throw error when task not found', async () => {
      vi.mocked(db.query.tasks.findFirst).mockResolvedValue(undefined);

      await expect(runTaskQAGates('task-1')).rejects.toThrow('Task not found');
    });

    it('should run QA gates and update status when all passed', async () => {
      const mockTask = {
        id: 'task-1',
        session: {
          repository: {
            path: '/test/repo',
          },
        },
      };

      const mockResults = [
        {
          gateName: 'typescript',
          status: 'passed' as const,
          output: 'success',
          duration: 100,
        },
        {
          gateName: 'eslint',
          status: 'passed' as const,
          output: 'success',
          duration: 150,
        },
      ];

      vi.mocked(db.query.tasks.findFirst).mockResolvedValue(mockTask as any);
      vi.mocked(db.query.planTasks.findFirst).mockResolvedValue(undefined);
      vi.mocked(runQAGates).mockResolvedValue(mockResults as any);

      const mockDeleteChain = {
        where: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(db.delete).mockReturnValue(mockDeleteChain as any);

      const mockUpdateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(db.update).mockReturnValue(mockUpdateChain as any);

      const result = await runTaskQAGates('task-1');

      expect(result.passed).toBe(true);
      expect(result.results).toEqual(mockResults);
      expect(runQAGates).toHaveBeenCalledWith('task-1', '/test/repo');
      expect(mockUpdateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'waiting_approval',
        })
      );
    });

    it('should update status to qa_failed when some gates fail', async () => {
      const mockTask = {
        id: 'task-1',
        session: {
          repository: {
            path: '/test/repo',
          },
        },
      };

      const mockResults = [
        {
          gateName: 'typescript',
          status: 'passed' as const,
          output: 'success',
          duration: 100,
        },
        {
          gateName: 'eslint',
          status: 'failed' as const,
          output: 'errors found',
          duration: 150,
        },
      ];

      vi.mocked(db.query.tasks.findFirst).mockResolvedValue(mockTask as any);
      vi.mocked(runQAGates).mockResolvedValue(mockResults as any);

      const mockDeleteChain = {
        where: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(db.delete).mockReturnValue(mockDeleteChain as any);

      const mockUpdateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(db.update).mockReturnValue(mockUpdateChain as any);

      const result = await runTaskQAGates('task-1');

      expect(result.passed).toBe(false);
      expect(mockUpdateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'qa_failed',
        })
      );
    });

    it('should treat skipped gates as passing', async () => {
      const mockTask = {
        id: 'task-1',
        session: {
          repository: {
            path: '/test/repo',
          },
        },
      };

      const mockResults = [
        {
          gateName: 'typescript',
          status: 'passed' as const,
          output: 'success',
          duration: 100,
        },
        {
          gateName: 'eslint',
          status: 'skipped' as const,
          output: 'skipped',
          duration: 0,
        },
      ];

      vi.mocked(db.query.tasks.findFirst).mockResolvedValue(mockTask as any);
      vi.mocked(db.query.planTasks.findFirst).mockResolvedValue(undefined);
      vi.mocked(runQAGates).mockResolvedValue(mockResults as any);

      const mockDeleteChain = {
        where: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(db.delete).mockReturnValue(mockDeleteChain as any);

      const mockUpdateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(db.update).mockReturnValue(mockUpdateChain as any);

      const result = await runTaskQAGates('task-1');

      expect(result.passed).toBe(true);
    });

    it('should clear old results before running new gates', async () => {
      const mockTask = {
        id: 'task-1',
        session: {
          repository: {
            path: '/test/repo',
          },
        },
      };

      const mockResults = [
        {
          gateName: 'typescript',
          status: 'passed' as const,
          output: 'success',
          duration: 100,
        },
      ];

      vi.mocked(db.query.tasks.findFirst).mockResolvedValue(mockTask as any);
      vi.mocked(db.query.planTasks.findFirst).mockResolvedValue(undefined);
      vi.mocked(runQAGates).mockResolvedValue(mockResults as any);

      const mockDeleteChain = {
        where: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(db.delete).mockReturnValue(mockDeleteChain as any);

      const mockUpdateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(db.update).mockReturnValue(mockUpdateChain as any);

      await runTaskQAGates('task-1');

      expect(db.delete).toHaveBeenCalled();
      expect(mockDeleteChain.where).toHaveBeenCalled();
    });

    it('should handle errors during QA gate execution', async () => {
      const mockTask = {
        id: 'task-1',
        session: {
          repository: {
            path: '/test/repo',
          },
        },
      };

      vi.mocked(db.query.tasks.findFirst).mockResolvedValue(mockTask as any);
      vi.mocked(runQAGates).mockRejectedValue(new Error('QA gates failed'));

      const mockDeleteChain = {
        where: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(db.delete).mockReturnValue(mockDeleteChain as any);

      await expect(runTaskQAGates('task-1')).rejects.toThrow('QA gates failed');
    });

    it('should return results array with all gate results', async () => {
      const mockTask = {
        id: 'task-1',
        session: {
          repository: {
            path: '/test/repo',
          },
        },
      };

      const mockResults = [
        {
          gateName: 'typescript',
          status: 'passed' as const,
          output: 'success',
          duration: 100,
        },
        {
          gateName: 'eslint',
          status: 'passed' as const,
          output: 'success',
          duration: 150,
        },
        {
          gateName: 'tests',
          status: 'passed' as const,
          output: 'all tests passed',
          duration: 200,
        },
      ];

      vi.mocked(db.query.tasks.findFirst).mockResolvedValue(mockTask as any);
      vi.mocked(db.query.planTasks.findFirst).mockResolvedValue(undefined);
      vi.mocked(runQAGates).mockResolvedValue(mockResults as any);

      const mockDeleteChain = {
        where: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(db.delete).mockReturnValue(mockDeleteChain as any);

      const mockUpdateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(db.update).mockReturnValue(mockUpdateChain as any);

      const result = await runTaskQAGates('task-1');

      expect(result.results).toHaveLength(3);
      expect(result.results).toEqual(mockResults);
    });
  });
});
