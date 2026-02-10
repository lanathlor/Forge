import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create mock functions
const mockGetOrCreateActiveSession = vi.hoisted(() => vi.fn());
const mockExecuteTask = vi.hoisted(() => vi.fn());

const {
  mockDb,
  mockInsert,
  mockValues,
  mockValuesReturning,
  mockUpdate,
  mockSet,
  mockWhere,
  mockSelect,
  mockSelectFrom,
  mockSelectWhere,
  mockSelectOrderBy,
  mockSelectLimit,
} = vi.hoisted(() => {
  const mockValuesReturning = vi.fn();
  const mockValues = vi.fn(() => ({ returning: mockValuesReturning }));
  const mockInsert = vi.fn(() => ({ values: mockValues }));

  // mockWhere returns a thenable for direct awaiting
  const mockWhere = vi.fn(() => Promise.resolve([]));
  const mockSet = vi.fn(() => ({ where: mockWhere }));
  const mockUpdate = vi.fn(() => ({ set: mockSet }));

  // Use flexible mock types to allow different return values
  const mockSelectLimit = vi.fn() as ReturnType<typeof vi.fn>;
  const mockSelectOrderBy = vi.fn() as ReturnType<typeof vi.fn>;
  const mockSelectWhere = vi.fn() as ReturnType<typeof vi.fn>;
  const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }));
  const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));

  const mockDb = {
    query: {
      repositories: {
        findFirst: vi.fn(),
      },
    },
    insert: mockInsert,
    update: mockUpdate,
    select: mockSelect,
  };

  return {
    mockDb,
    mockInsert,
    mockValues,
    mockValuesReturning,
    mockUpdate,
    mockSet,
    mockWhere,
    mockSelect,
    mockSelectFrom,
    mockSelectWhere,
    mockSelectOrderBy,
    mockSelectLimit,
  };
});

vi.mock('@/db', () => ({
  db: mockDb,
}));

vi.mock('@/db/schema', () => ({
  plans: { id: 'id', status: 'status' },
  phases: { id: 'id', planId: 'plan_id', order: 'order', status: 'status' },
  planTasks: { id: 'id', phaseId: 'phase_id', planId: 'plan_id', order: 'order', status: 'status' },
  tasks: { id: 'id', sessionId: 'session_id' },
}));

vi.mock('@/db/schema/repositories', () => ({
  repositories: { id: 'id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ field: a, value: b })),
}));

vi.mock('@/lib/sessions/manager', () => ({
  getOrCreateActiveSession: mockGetOrCreateActiveSession,
}));

vi.mock('@/lib/tasks/orchestrator', () => ({
  executeTask: mockExecuteTask,
}));

describe('plans/executor', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();

    // Reset mock chain implementations
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ returning: mockValuesReturning });
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockWhere });
    mockWhere.mockResolvedValue([]);
    mockSelect.mockReturnValue({ from: mockSelectFrom });
    mockSelectFrom.mockReturnValue({ where: mockSelectWhere });

    // Create a thenable result for mockSelectWhere that can be both chained AND awaited
    // This is needed because some queries chain .orderBy().limit() while others await .where() directly
    const createThenableWithChain = (resolvedValue: unknown[] = []) => ({
      orderBy: mockSelectOrderBy,
      limit: mockSelectLimit,
      then: (resolve: (value: unknown[]) => void) => Promise.resolve(resolvedValue).then(resolve),
    });
    mockSelectWhere.mockReturnValue(createThenableWithChain([]));
    mockSelectOrderBy.mockReturnValue({ limit: mockSelectLimit });
    mockSelectLimit.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('PlanExecutor.executePlan', () => {
    it('should throw error when plan not found', async () => {
      mockSelectLimit.mockResolvedValueOnce([]);

      const { PlanExecutor } = await import('../executor');
      const executor = new PlanExecutor();

      await expect(executor.executePlan('nonexistent')).rejects.toThrow(
        'Plan not found: nonexistent'
      );
    });

    it('should update plan status to running', async () => {
      const mockPlan = {
        id: 'plan-1',
        repositoryId: 'repo-1',
        status: 'draft',
        startedAt: null,
      };

      mockSelectLimit.mockResolvedValueOnce([mockPlan]);
      mockSelectOrderBy.mockResolvedValueOnce([]); // phases query

      const { PlanExecutor } = await import('../executor');
      const executor = new PlanExecutor();

      await executor.executePlan('plan-1');

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'running' }));
    });

    it('should execute phases in order and mark completed', async () => {
      const mockPlan = {
        id: 'plan-1',
        repositoryId: 'repo-1',
        status: 'draft',
        startedAt: null,
      };

      const mockPhases = [
        {
          id: 'phase-1',
          planId: 'plan-1',
          order: 1,
          title: 'Phase 1',
          status: 'pending',
          executionMode: 'sequential',
          pauseAfter: false,
        },
      ];

      const mockPhase = {
        id: 'phase-1',
        planId: 'plan-1',
        order: 1,
        status: 'pending',
        executionMode: 'sequential',
        pauseAfter: false,
        startedAt: null,
      };

      const completedPhase = { ...mockPhase, status: 'completed' };

      mockSelectLimit
        .mockResolvedValueOnce([mockPlan]) // initial plan fetch
        .mockResolvedValueOnce([mockPhase]); // phase fetch in executePhase
      mockSelectOrderBy
        .mockResolvedValueOnce(mockPhases) // phases for plan
        .mockResolvedValueOnce([]); // tasks for phase (empty)

      // For updatePlanCompletedPhases - need thenable that returns phases array when awaited directly
      mockSelectWhere.mockReturnValue({
        orderBy: mockSelectOrderBy,
        limit: mockSelectLimit,
        then: (resolve: (value: unknown[]) => void) => Promise.resolve([{ ...mockPhase, status: 'completed' }]).then(resolve),
      });

      const { PlanExecutor } = await import('../executor');
      const executor = new PlanExecutor();

      await executor.executePlan('plan-1');

      // Should update plan to completed
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should skip completed phases', async () => {
      const mockPlan = {
        id: 'plan-1',
        repositoryId: 'repo-1',
        status: 'draft',
        startedAt: null,
      };

      const mockPhases = [
        {
          id: 'phase-1',
          planId: 'plan-1',
          order: 1,
          title: 'Phase 1',
          status: 'completed', // Already completed
          executionMode: 'sequential',
          pauseAfter: false,
        },
      ];

      mockSelectLimit.mockResolvedValueOnce([mockPlan]);
      mockSelectOrderBy.mockResolvedValueOnce(mockPhases);

      const { PlanExecutor } = await import('../executor');
      const executor = new PlanExecutor();

      await executor.executePlan('plan-1');

      // Plan should be marked as completed
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
    });

    it('should mark plan as failed on error', async () => {
      const mockPlan = {
        id: 'plan-1',
        repositoryId: 'repo-1',
        status: 'draft',
        startedAt: null,
      };

      mockSelectLimit
        .mockResolvedValueOnce([mockPlan])
        .mockRejectedValueOnce(new Error('Database error'));
      mockSelectOrderBy.mockResolvedValueOnce([
        {
          id: 'phase-1',
          status: 'pending',
          executionMode: 'sequential',
          pauseAfter: false,
        },
      ]);

      const { PlanExecutor } = await import('../executor');
      const executor = new PlanExecutor();

      await expect(executor.executePlan('plan-1')).rejects.toThrow();
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
    });
  });

  describe('PlanExecutor.resumePlan', () => {
    it('should update plan status to running and continue execution', async () => {
      const mockPlan = {
        id: 'plan-1',
        repositoryId: 'repo-1',
        status: 'paused',
        startedAt: new Date(),
      };

      mockSelectLimit.mockResolvedValueOnce([mockPlan]);
      mockSelectOrderBy.mockResolvedValueOnce([]); // No remaining phases

      const { PlanExecutor } = await import('../executor');
      const executor = new PlanExecutor();

      await executor.resumePlan('plan-1');

      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'running' }));
    });
  });

  describe('PlanExecutor.cancelPlan', () => {
    it('should update plan status to failed', async () => {
      const { PlanExecutor } = await import('../executor');
      const executor = new PlanExecutor();

      await executor.cancelPlan('plan-1');

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
    });
  });

  describe('planExecutor singleton', () => {
    it('should export a singleton instance', async () => {
      const { planExecutor, PlanExecutor } = await import('../executor');

      expect(planExecutor).toBeInstanceOf(PlanExecutor);
    });
  });

  describe('executeTasksSequentially', () => {
    it('should skip completed and skipped tasks', async () => {
      const mockPlan = {
        id: 'plan-1',
        repositoryId: 'repo-1',
        status: 'draft',
        startedAt: null,
      };

      const mockPhase = {
        id: 'phase-1',
        planId: 'plan-1',
        order: 1,
        status: 'pending',
        executionMode: 'sequential',
        pauseAfter: false,
        startedAt: null,
      };

      const mockTasks = [
        {
          id: 'task-1',
          phaseId: 'phase-1',
          status: 'completed', // Already completed
        },
        {
          id: 'task-2',
          phaseId: 'phase-1',
          status: 'skipped', // Already skipped
        },
      ];

      mockSelectLimit
        .mockResolvedValueOnce([mockPlan])
        .mockResolvedValueOnce([mockPhase]);
      mockSelectOrderBy
        .mockResolvedValueOnce([mockPhase]) // phases
        .mockResolvedValueOnce(mockTasks); // tasks

      // For updatePlanCompletedPhases - need thenable that returns phases array when awaited directly
      mockSelectWhere.mockReturnValue({
        orderBy: mockSelectOrderBy,
        limit: mockSelectLimit,
        then: (resolve: (value: unknown[]) => void) => Promise.resolve([{ ...mockPhase, status: 'completed' }]).then(resolve),
      });

      const { PlanExecutor } = await import('../executor');
      const executor = new PlanExecutor();

      await executor.executePlan('plan-1');

      // No new tasks should be executed
      expect(mockGetOrCreateActiveSession).not.toHaveBeenCalled();
    });
  });

  describe('executeTasksInParallel', () => {
    it('should handle already completed parallel tasks', async () => {
      const mockPlan = {
        id: 'plan-1',
        repositoryId: 'repo-1',
        status: 'draft',
        startedAt: null,
      };

      const mockPhase = {
        id: 'phase-1',
        planId: 'plan-1',
        order: 1,
        status: 'pending',
        executionMode: 'parallel',
        pauseAfter: false,
        startedAt: null,
      };

      const mockTasks = [
        {
          id: 'task-1',
          phaseId: 'phase-1',
          planId: 'plan-1',
          status: 'completed',
          canRunInParallel: true,
          dependsOn: null,
        },
        {
          id: 'task-2',
          phaseId: 'phase-1',
          planId: 'plan-1',
          status: 'completed',
          canRunInParallel: true,
          dependsOn: '["task-1"]', // Depends on task-1
        },
      ];

      mockSelectLimit
        .mockResolvedValueOnce([mockPlan])
        .mockResolvedValueOnce([mockPhase]);
      mockSelectOrderBy
        .mockResolvedValueOnce([mockPhase]) // phases
        .mockResolvedValueOnce(mockTasks); // tasks

      // For updatePlanCompletedPhases - need thenable that returns phases array when awaited directly
      mockSelectWhere.mockReturnValue({
        orderBy: mockSelectOrderBy,
        limit: mockSelectLimit,
        then: (resolve: (value: unknown[]) => void) => Promise.resolve([{ ...mockPhase, status: 'completed' }]).then(resolve),
      });

      const { PlanExecutor } = await import('../executor');
      const executor = new PlanExecutor();

      await executor.executePlan('plan-1');

      // Both tasks are already completed, plan should complete
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
    });
  });

  describe('executeTasksManually', () => {
    it('should pause plan for manual approval', async () => {
      const mockPlan = {
        id: 'plan-1',
        repositoryId: 'repo-1',
        status: 'draft',
        startedAt: null,
      };

      const mockPhase = {
        id: 'phase-1',
        planId: 'plan-1',
        order: 1,
        status: 'pending',
        executionMode: 'manual',
        pauseAfter: false,
        startedAt: null,
      };

      const mockTasks = [
        {
          id: 'task-1',
          phaseId: 'phase-1',
          planId: 'plan-1',
          status: 'pending',
          canRunInParallel: false,
          dependsOn: null,
        },
      ];

      mockSelectLimit
        .mockResolvedValueOnce([mockPlan])
        .mockResolvedValueOnce([mockPhase]);
      mockSelectOrderBy
        .mockResolvedValueOnce([mockPhase]) // phases
        .mockResolvedValueOnce(mockTasks); // tasks

      const { PlanExecutor } = await import('../executor');
      const executor = new PlanExecutor();

      await executor.executePlan('plan-1');

      // Plan should be paused for manual approval
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'paused' }));
    });
  });

  describe('unknown execution mode', () => {
    it('should throw error for unknown execution mode', async () => {
      const mockPlan = {
        id: 'plan-1',
        repositoryId: 'repo-1',
        status: 'draft',
        startedAt: null,
      };

      const mockPhase = {
        id: 'phase-1',
        planId: 'plan-1',
        order: 1,
        status: 'pending',
        executionMode: 'unknown_mode', // Invalid mode
        pauseAfter: false,
        startedAt: null,
      };

      mockSelectLimit
        .mockResolvedValueOnce([mockPlan])
        .mockResolvedValueOnce([mockPhase]);
      mockSelectOrderBy
        .mockResolvedValueOnce([mockPhase]) // phases
        .mockResolvedValueOnce([]); // tasks

      const { PlanExecutor } = await import('../executor');
      const executor = new PlanExecutor();

      await expect(executor.executePlan('plan-1')).rejects.toThrow('Unknown execution mode');
    });
  });

  describe('phase not found', () => {
    it('should throw error when phase not found during execution', async () => {
      const mockPlan = {
        id: 'plan-1',
        repositoryId: 'repo-1',
        status: 'draft',
        startedAt: null,
      };

      const mockPhases = [
        {
          id: 'phase-1',
          planId: 'plan-1',
          order: 1,
          status: 'pending',
          executionMode: 'sequential',
          pauseAfter: false,
        },
      ];

      mockSelectLimit
        .mockResolvedValueOnce([mockPlan])
        .mockResolvedValueOnce([]); // Phase not found when fetching details
      mockSelectOrderBy.mockResolvedValueOnce(mockPhases);

      const { PlanExecutor } = await import('../executor');
      const executor = new PlanExecutor();

      await expect(executor.executePlan('plan-1')).rejects.toThrow('Phase not found');
    });
  });

  describe('pauseAfter functionality', () => {
    it('should pause plan after phase with pauseAfter=true', async () => {
      const mockPlan = {
        id: 'plan-1',
        repositoryId: 'repo-1',
        status: 'draft',
        startedAt: null,
      };

      const mockPhases = [
        {
          id: 'phase-1',
          planId: 'plan-1',
          order: 1,
          title: 'Phase 1',
          status: 'pending',
          executionMode: 'sequential',
          pauseAfter: true, // Should pause after
        },
      ];

      const mockPhase = {
        id: 'phase-1',
        planId: 'plan-1',
        order: 1,
        status: 'pending',
        executionMode: 'sequential',
        pauseAfter: true,
        startedAt: null,
      };

      mockSelectLimit
        .mockResolvedValueOnce([mockPlan])
        .mockResolvedValueOnce([mockPhase]);
      mockSelectOrderBy
        .mockResolvedValueOnce(mockPhases)
        .mockResolvedValueOnce([]); // No tasks

      // For updatePlanCompletedPhases - need thenable that returns phases array when awaited directly
      mockSelectWhere.mockReturnValue({
        orderBy: mockSelectOrderBy,
        limit: mockSelectLimit,
        then: (resolve: (value: unknown[]) => void) => Promise.resolve([{ ...mockPhase, status: 'completed' }]).then(resolve),
      });

      const { PlanExecutor } = await import('../executor');
      const executor = new PlanExecutor();

      await executor.executePlan('plan-1');

      // Plan should be paused
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'paused' }));
    });
  });
});
