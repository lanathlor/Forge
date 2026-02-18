import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getRepository,
  getLatestQARun,
  getGateExecutions,
  getQAGateStatus,
} from '../status-service';
import { db } from '@/db';

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    query: {
      repositories: {},
      qaRuns: {},
      qaGateExecutions: {},
    },
  },
}));

describe('Status Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getRepository', () => {
    it('should fetch repository by ID', async () => {
      const mockRepo = {
        id: 'repo-1',
        name: 'test-repo',
        path: '/path/to/repo',
      };

      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockRepo]),
      };

      vi.mocked(db.select).mockReturnValue(mockChain as any);

      const result = await getRepository('repo-1');

      expect(result).toEqual(mockRepo);
      expect(db.select).toHaveBeenCalled();
      expect(mockChain.limit).toHaveBeenCalled();
    });

    it('should return undefined when repository not found', async () => {
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(db.select).mockReturnValue(mockChain as any);

      const result = await getRepository('non-existent');

      expect(result).toBeUndefined();
    });

    it('should handle database errors', async () => {
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockRejectedValue(new Error('Database error')),
      };

      vi.mocked(db.select).mockReturnValue(mockChain as any);

      await expect(getRepository('repo-1')).rejects.toThrow('Database error');
    });
  });

  describe('getLatestQARun', () => {
    it('should fetch latest QA run for repository', async () => {
      const mockRun = {
        id: 'run-1',
        repositoryId: 'repo-1',
        status: 'passed',
        startedAt: new Date('2024-01-01'),
      };

      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockRun]),
      };

      vi.mocked(db.select).mockReturnValue(mockChain as any);

      const result = await getLatestQARun('repo-1');

      expect(result).toEqual(mockRun);
      expect(mockChain.orderBy).toHaveBeenCalled();
      expect(mockChain.limit).toHaveBeenCalled();
    });

    it('should return undefined when no runs exist', async () => {
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(db.select).mockReturnValue(mockChain as any);

      const result = await getLatestQARun('repo-1');

      expect(result).toBeUndefined();
    });

    it('should order by startedAt descending', async () => {
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(db.select).mockReturnValue(mockChain as any);

      await getLatestQARun('repo-1');

      expect(mockChain.orderBy).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockRejectedValue(new Error('DB connection failed')),
      };

      vi.mocked(db.select).mockReturnValue(mockChain as any);

      await expect(getLatestQARun('repo-1')).rejects.toThrow(
        'DB connection failed'
      );
    });
  });

  describe('getGateExecutions', () => {
    it('should fetch gate executions for a run', async () => {
      const mockExecutions = [
        {
          id: 'exec-1',
          runId: 'run-1',
          gateName: 'typescript',
          status: 'passed',
          order: 1,
        },
        {
          id: 'exec-2',
          runId: 'run-1',
          gateName: 'eslint',
          status: 'passed',
          order: 2,
        },
      ];

      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockExecutions),
      };

      vi.mocked(db.select).mockReturnValue(mockChain as any);

      const result = await getGateExecutions('run-1');

      expect(result).toEqual(mockExecutions);
      expect(mockChain.orderBy).toHaveBeenCalled();
    });

    it('should return empty array when no executions exist', async () => {
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(db.select).mockReturnValue(mockChain as any);

      const result = await getGateExecutions('run-1');

      expect(result).toEqual([]);
    });

    it('should order executions correctly', async () => {
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(db.select).mockReturnValue(mockChain as any);

      await getGateExecutions('run-1');

      expect(mockChain.orderBy).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockRejectedValue(new Error('Query failed')),
      };

      vi.mocked(db.select).mockReturnValue(mockChain as any);

      await expect(getGateExecutions('run-1')).rejects.toThrow('Query failed');
    });
  });

  describe('getQAGateStatus', () => {
    it('should return status with no run when no runs exist', async () => {
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(db.select).mockReturnValue(mockChain as any);

      const result = await getQAGateStatus('repo-1');

      expect(result).toEqual({
        hasRun: false,
        run: null,
        gates: [],
      });
    });

    it('should return status with run and gates when run exists', async () => {
      const mockRun = {
        id: 'run-1',
        repositoryId: 'repo-1',
        status: 'passed',
        startedAt: new Date('2024-01-01'),
      };

      const mockGates = [
        {
          id: 'exec-1',
          runId: 'run-1',
          gateName: 'typescript',
          status: 'passed',
          order: 1,
        },
      ];

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockRun]),
      };

      const gatesChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockGates),
      };

      vi.mocked(db.select)
        .mockReturnValueOnce(selectChain as any)
        .mockReturnValueOnce(gatesChain as any);

      const result = await getQAGateStatus('repo-1');

      expect(result).toEqual({
        hasRun: true,
        run: mockRun,
        gates: mockGates,
      });
    });

    it('should return empty gates array when run exists but no gates', async () => {
      const mockRun = {
        id: 'run-1',
        repositoryId: 'repo-1',
        status: 'passed',
        startedAt: new Date('2024-01-01'),
      };

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockRun]),
      };

      const gatesChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };

      vi.mocked(db.select)
        .mockReturnValueOnce(selectChain as any)
        .mockReturnValueOnce(gatesChain as any);

      const result = await getQAGateStatus('repo-1');

      expect(result).toEqual({
        hasRun: true,
        run: mockRun,
        gates: [],
      });
    });

    it('should handle database errors from getLatestQARun', async () => {
      const mockChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockRejectedValue(new Error('DB error')),
      };

      vi.mocked(db.select).mockReturnValue(mockChain as any);

      await expect(getQAGateStatus('repo-1')).rejects.toThrow('DB error');
    });

    it('should handle database errors from getGateExecutions', async () => {
      const mockRun = {
        id: 'run-1',
        repositoryId: 'repo-1',
        status: 'passed',
        startedAt: new Date('2024-01-01'),
      };

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockRun]),
      };

      const gatesChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockRejectedValue(new Error('Gates query failed')),
      };

      vi.mocked(db.select)
        .mockReturnValueOnce(selectChain as any)
        .mockReturnValueOnce(gatesChain as any);

      await expect(getQAGateStatus('repo-1')).rejects.toThrow(
        'Gates query failed'
      );
    });
  });
});
