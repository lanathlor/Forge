import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

// Mock NextResponse
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, init) => ({ data, status: init?.status || 200 })),
  },
}));

// Mock dependencies
const mockGeneratePlanFromDescription = vi.hoisted(() => vi.fn());
const mockReviewPlan = vi.hoisted(() => vi.fn());
const mockApplySuggestions = vi.hoisted(() => vi.fn());
const mockPlanExecutor = vi.hoisted(() => ({
  executePlan: vi.fn(),
  resumePlan: vi.fn(),
  cancelPlan: vi.fn(),
}));

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
  mockDelete,
  mockDeleteWhere,
} = vi.hoisted(() => {
  const mockValuesReturning = vi.fn();
  const mockValues = vi.fn(() => ({ returning: mockValuesReturning }));
  const mockInsert = vi.fn(() => ({ values: mockValues }));

  const mockWhere = vi.fn();
  const mockSet = vi.fn(() => ({ where: mockWhere }));
  const mockUpdate = vi.fn(() => ({ set: mockSet }));

  const mockDeleteWhere = vi.fn();
  const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }));

  // Use any type to allow flexible mock return values
  const mockSelectLimit = vi.fn() as ReturnType<typeof vi.fn>;
  const mockSelectOrderBy = vi.fn() as ReturnType<typeof vi.fn>;
  const mockSelectWhere = vi.fn() as ReturnType<typeof vi.fn>;
  const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere, orderBy: mockSelectOrderBy }));
  const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));

  const mockDb = {
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
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
    mockDelete,
    mockDeleteWhere,
  };
});

vi.mock('@/db', () => ({
  db: mockDb,
}));

vi.mock('@/db/schema', () => ({
  plans: { id: 'id', repositoryId: 'repository_id', createdAt: 'created_at' },
  phases: { id: 'id', planId: 'plan_id', order: 'order' },
  planTasks: { id: 'id', phaseId: 'phase_id', planId: 'plan_id', order: 'order' },
  planIterations: { id: 'id', planId: 'plan_id', createdAt: 'created_at' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ field: a, value: b })),
  desc: vi.fn((a) => ({ type: 'desc', field: a })),
}));

vi.mock('@/lib/plans/generator', () => ({
  generatePlanFromDescription: mockGeneratePlanFromDescription,
}));

vi.mock('@/lib/plans/reviewer', () => ({
  reviewPlan: mockReviewPlan,
  applySuggestions: mockApplySuggestions,
}));

vi.mock('@/lib/plans/executor', () => ({
  planExecutor: mockPlanExecutor,
}));

describe('plans/api/handlers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Reset mock chain implementations
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ returning: mockValuesReturning });
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ returning: mockValuesReturning });
    mockDelete.mockReturnValue({ where: mockDeleteWhere });
    mockSelect.mockReturnValue({ from: mockSelectFrom });
    mockSelectFrom.mockReturnValue({ where: mockSelectWhere, orderBy: mockSelectOrderBy });
    mockSelectWhere.mockReturnValue({ orderBy: mockSelectOrderBy, limit: mockSelectLimit });
    mockSelectOrderBy.mockReturnValue({ limit: mockSelectLimit });
    mockSelectLimit.mockResolvedValue([]);
  });

  describe('handleGetPlans', () => {
    it('should return all plans when no repositoryId', async () => {
      const mockPlans = [{ id: 'plan-1' }, { id: 'plan-2' }];
      mockSelectOrderBy.mockResolvedValueOnce(mockPlans);

      const { handleGetPlans } = await import('../handlers');
      const result = await handleGetPlans();

      expect((result as any).data).toEqual({ plans: mockPlans });
    });

    it('should return filtered plans when repositoryId provided', async () => {
      const mockPlans = [{ id: 'plan-1', repositoryId: 'repo-1' }];
      mockSelectOrderBy.mockResolvedValueOnce(mockPlans);

      const { handleGetPlans } = await import('../handlers');
      const result = await handleGetPlans('repo-1');

      expect((result as any).data).toEqual({ plans: mockPlans });
    });

    it('should return error on failure', async () => {
      mockSelectOrderBy.mockRejectedValueOnce(new Error('DB error'));

      const { handleGetPlans } = await import('../handlers');
      const result = await handleGetPlans();

      expect((result as any).status).toBe(500);
      expect((result as any).data.error).toBe('Failed to fetch plans');
    });
  });

  describe('handleGetPlan', () => {
    it('should return plan with related data', async () => {
      const mockPlan = { id: 'plan-1', title: 'Test Plan' };
      const mockPhases = [{ id: 'phase-1' }];
      const mockTasks = [{ id: 'task-1' }];
      const mockIterations = [{ id: 'iter-1' }];

      mockSelectLimit.mockResolvedValueOnce([mockPlan]);
      // handleGetPlan uses .orderBy() which is directly awaited
      mockSelectOrderBy
        .mockResolvedValueOnce(mockPhases)
        .mockResolvedValueOnce(mockTasks)
        .mockResolvedValueOnce(mockIterations);

      const { handleGetPlan } = await import('../handlers');
      const result = await handleGetPlan('plan-1');

      expect((result as any).data).toEqual({
        plan: mockPlan,
        phases: mockPhases,
        tasks: mockTasks,
        iterations: mockIterations,
      });
    });

    it('should return 404 when plan not found', async () => {
      mockSelectLimit.mockResolvedValueOnce([]);

      const { handleGetPlan } = await import('../handlers');
      const result = await handleGetPlan('nonexistent');

      expect((result as any).status).toBe(404);
      expect((result as any).data.error).toBe('Plan not found');
    });

    it('should return error on failure', async () => {
      mockSelectLimit.mockRejectedValueOnce(new Error('DB error'));

      const { handleGetPlan } = await import('../handlers');
      const result = await handleGetPlan('plan-1');

      expect((result as any).status).toBe(500);
    });
  });

  describe('handleCreatePlan', () => {
    it('should create a new plan', async () => {
      const mockPlan = { id: 'plan-1', title: 'New Plan', status: 'draft' };
      mockValuesReturning.mockResolvedValueOnce([mockPlan]);

      const { handleCreatePlan } = await import('../handlers');
      const result = await handleCreatePlan({
        repositoryId: 'repo-1',
        title: 'New Plan',
      });

      expect((result as any).status).toBe(201);
      expect((result as any).data).toEqual({ plan: mockPlan });
    });

    it('should return error on failure', async () => {
      mockValuesReturning.mockRejectedValueOnce(new Error('DB error'));

      const { handleCreatePlan } = await import('../handlers');
      const result = await handleCreatePlan({
        repositoryId: 'repo-1',
        title: 'New Plan',
      });

      expect((result as any).status).toBe(500);
    });
  });

  describe('handleGeneratePlan', () => {
    it('should generate a plan using Claude', async () => {
      const mockPlan = { id: 'plan-1', title: 'Generated Plan' };
      const mockPhases = [{ id: 'phase-1' }];
      const mockTasks = [{ id: 'task-1' }];

      mockGeneratePlanFromDescription.mockResolvedValueOnce('plan-1');
      mockSelectLimit.mockResolvedValueOnce([mockPlan]);
      // handleGeneratePlan uses .orderBy() which is directly awaited
      mockSelectOrderBy
        .mockResolvedValueOnce(mockPhases)
        .mockResolvedValueOnce(mockTasks);

      const { handleGeneratePlan } = await import('../handlers');
      const result = await handleGeneratePlan({
        repositoryId: 'repo-1',
        title: 'Feature X',
        description: 'Build feature X',
      });

      expect((result as any).status).toBe(201);
      expect((result as any).data).toEqual({
        plan: mockPlan,
        phases: mockPhases,
        tasks: mockTasks,
      });
    });

    it('should return error when generation fails', async () => {
      mockGeneratePlanFromDescription.mockRejectedValueOnce(new Error('Generation failed'));

      const { handleGeneratePlan } = await import('../handlers');
      const result = await handleGeneratePlan({
        repositoryId: 'repo-1',
        title: 'Feature X',
        description: 'Build feature X',
      });

      expect((result as any).status).toBe(500);
      expect((result as any).data.error).toBe('Failed to generate plan');
    });
  });

  describe('handleUpdatePlan', () => {
    it('should update a plan', async () => {
      const mockPlan = { id: 'plan-1', title: 'Updated Plan' };
      mockValuesReturning.mockResolvedValueOnce([mockPlan]);

      const { handleUpdatePlan } = await import('../handlers');
      const result = await handleUpdatePlan('plan-1', { title: 'Updated Plan' });

      expect((result as any).data).toEqual({ plan: mockPlan });
    });

    it('should return 404 when plan not found', async () => {
      mockValuesReturning.mockResolvedValueOnce([]);

      const { handleUpdatePlan } = await import('../handlers');
      const result = await handleUpdatePlan('nonexistent', { title: 'New Title' });

      expect((result as any).status).toBe(404);
    });

    it('should return error on failure', async () => {
      mockValuesReturning.mockRejectedValueOnce(new Error('DB error'));

      const { handleUpdatePlan } = await import('../handlers');
      const result = await handleUpdatePlan('plan-1', { title: 'New Title' });

      expect((result as any).status).toBe(500);
    });
  });

  describe('handleDeletePlan', () => {
    it('should delete a plan and related data', async () => {
      mockDeleteWhere.mockResolvedValue(undefined);

      const { handleDeletePlan } = await import('../handlers');
      const result = await handleDeletePlan('plan-1');

      expect((result as any).data).toEqual({ success: true });
      expect(mockDelete).toHaveBeenCalledTimes(4); // iterations, tasks, phases, plans
    });

    it('should return error on failure', async () => {
      mockDeleteWhere.mockRejectedValueOnce(new Error('DB error'));

      const { handleDeletePlan } = await import('../handlers');
      const result = await handleDeletePlan('plan-1');

      expect((result as any).status).toBe(500);
    });
  });

  describe('handleGetPhases', () => {
    it('should return phases for a plan', async () => {
      const mockPhases = [{ id: 'phase-1' }, { id: 'phase-2' }];
      mockSelectOrderBy.mockResolvedValueOnce(mockPhases);

      const { handleGetPhases } = await import('../handlers');
      const result = await handleGetPhases('plan-1');

      expect((result as any).data).toEqual({ phases: mockPhases });
    });

    it('should return error on failure', async () => {
      mockSelectOrderBy.mockRejectedValueOnce(new Error('DB error'));

      const { handleGetPhases } = await import('../handlers');
      const result = await handleGetPhases('plan-1');

      expect((result as any).status).toBe(500);
    });
  });

  describe('handleCreatePhase', () => {
    it('should create a new phase', async () => {
      const mockPhase = { id: 'phase-1', title: 'New Phase' };
      mockValuesReturning.mockResolvedValueOnce([mockPhase]);

      const { handleCreatePhase } = await import('../handlers');
      const result = await handleCreatePhase({
        planId: 'plan-1',
        title: 'New Phase',
        order: 1,
      });

      expect((result as any).status).toBe(201);
      expect((result as any).data).toEqual({ phase: mockPhase });
    });

    it('should return error on failure', async () => {
      mockValuesReturning.mockRejectedValueOnce(new Error('DB error'));

      const { handleCreatePhase } = await import('../handlers');
      const result = await handleCreatePhase({
        planId: 'plan-1',
        title: 'New Phase',
        order: 1,
      });

      expect((result as any).status).toBe(500);
    });
  });

  describe('handleUpdatePhase', () => {
    it('should update a phase', async () => {
      const mockPhase = { id: 'phase-1', title: 'Updated Phase' };
      mockValuesReturning.mockResolvedValueOnce([mockPhase]);

      const { handleUpdatePhase } = await import('../handlers');
      const result = await handleUpdatePhase('phase-1', { title: 'Updated Phase' });

      expect((result as any).data).toEqual({ phase: mockPhase });
    });

    it('should return 404 when phase not found', async () => {
      mockValuesReturning.mockResolvedValueOnce([]);

      const { handleUpdatePhase } = await import('../handlers');
      const result = await handleUpdatePhase('nonexistent', { title: 'New Title' });

      expect((result as any).status).toBe(404);
    });
  });

  describe('handleDeletePhase', () => {
    it('should delete a phase and its tasks', async () => {
      const mockPhase = { id: 'phase-1', planId: 'plan-1' };
      mockSelectLimit.mockResolvedValueOnce([mockPhase]);
      mockDeleteWhere.mockResolvedValue(undefined);
      // First call to mockSelectWhere returns limit chain for the phase query
      // Second call returns remaining phases directly (thenable)
      mockSelectWhere
        .mockReturnValueOnce({ orderBy: mockSelectOrderBy, limit: mockSelectLimit })
        .mockResolvedValueOnce([]); // remaining phases query

      const { handleDeletePhase } = await import('../handlers');
      const result = await handleDeletePhase('phase-1');

      expect((result as any).data).toEqual({ success: true });
    });

    it('should return 404 when phase not found', async () => {
      mockSelectLimit.mockResolvedValueOnce([]);

      const { handleDeletePhase } = await import('../handlers');
      const result = await handleDeletePhase('nonexistent');

      expect((result as any).status).toBe(404);
    });
  });

  describe('handleGetTasks', () => {
    it('should return tasks for a phase', async () => {
      const mockTasks = [{ id: 'task-1' }, { id: 'task-2' }];
      mockSelectOrderBy.mockResolvedValueOnce(mockTasks);

      const { handleGetTasks } = await import('../handlers');
      const result = await handleGetTasks('phase-1');

      expect((result as any).data).toEqual({ tasks: mockTasks });
    });

    it('should return error on failure', async () => {
      mockSelectOrderBy.mockRejectedValueOnce(new Error('DB error'));

      const { handleGetTasks } = await import('../handlers');
      const result = await handleGetTasks('phase-1');

      expect((result as any).status).toBe(500);
    });
  });

  describe('handleCreateTask', () => {
    it('should create a new task', async () => {
      const mockTask = { id: 'task-1', title: 'New Task' };
      mockValuesReturning.mockResolvedValueOnce([mockTask]);
      mockSelectWhere.mockReturnValue({
        orderBy: mockSelectOrderBy,
        limit: mockSelectLimit,
      });
      mockSelectOrderBy.mockReturnValue({ limit: mockSelectLimit });
      mockSelectOrderBy.mockResolvedValue([]); // for phase and plan task counts

      const { handleCreateTask } = await import('../handlers');
      const result = await handleCreateTask({
        phaseId: 'phase-1',
        planId: 'plan-1',
        title: 'New Task',
        description: 'Task description',
        order: 1,
      });

      expect((result as any).status).toBe(201);
      expect((result as any).data).toEqual({ task: mockTask });
    });

    it('should return error on failure', async () => {
      mockValuesReturning.mockRejectedValueOnce(new Error('DB error'));

      const { handleCreateTask } = await import('../handlers');
      const result = await handleCreateTask({
        phaseId: 'phase-1',
        planId: 'plan-1',
        title: 'New Task',
        description: 'Task description',
        order: 1,
      });

      expect((result as any).status).toBe(500);
    });
  });

  describe('handleUpdateTask', () => {
    it('should update a task', async () => {
      const mockTask = { id: 'task-1', title: 'Updated Task' };
      mockValuesReturning.mockResolvedValueOnce([mockTask]);

      const { handleUpdateTask } = await import('../handlers');
      const result = await handleUpdateTask('task-1', { title: 'Updated Task' });

      expect((result as any).data).toEqual({ task: mockTask });
    });

    it('should return 404 when task not found', async () => {
      mockValuesReturning.mockResolvedValueOnce([]);

      const { handleUpdateTask } = await import('../handlers');
      const result = await handleUpdateTask('nonexistent', { title: 'New Title' });

      expect((result as any).status).toBe(404);
    });

    it('should handle dependsOn array serialization', async () => {
      const mockTask = { id: 'task-1', dependsOn: '["task-0"]' };
      mockValuesReturning.mockResolvedValueOnce([mockTask]);

      const { handleUpdateTask } = await import('../handlers');
      const result = await handleUpdateTask('task-1', { dependsOn: ['task-0'] });

      expect((result as any).data).toEqual({ task: mockTask });
    });
  });

  describe('handleDeleteTask', () => {
    it('should delete a task', async () => {
      const mockTask = { id: 'task-1', phaseId: 'phase-1', planId: 'plan-1' };
      mockSelectLimit.mockResolvedValueOnce([mockTask]);
      mockDeleteWhere.mockResolvedValue(undefined);
      mockSelectWhere.mockReturnValue({
        orderBy: mockSelectOrderBy,
        limit: mockSelectLimit,
      });
      mockSelectOrderBy.mockReturnValue({ limit: mockSelectLimit });
      mockSelectOrderBy.mockResolvedValue([]);

      const { handleDeleteTask } = await import('../handlers');
      const result = await handleDeleteTask('task-1');

      expect((result as any).data).toEqual({ success: true });
    });

    it('should return 404 when task not found', async () => {
      mockSelectLimit.mockResolvedValueOnce([]);

      const { handleDeleteTask } = await import('../handlers');
      const result = await handleDeleteTask('nonexistent');

      expect((result as any).status).toBe(404);
    });
  });

  describe('handleRetryTask', () => {
    it('should reset task for retry', async () => {
      const mockTask = { id: 'task-1', status: 'pending', attempts: 0 };
      mockValuesReturning.mockResolvedValueOnce([mockTask]);

      const { handleRetryTask } = await import('../handlers');
      const result = await handleRetryTask('task-1');

      expect((result as any).data).toEqual({ task: mockTask });
    });

    it('should return 404 when task not found', async () => {
      mockValuesReturning.mockResolvedValueOnce([]);

      const { handleRetryTask } = await import('../handlers');
      const result = await handleRetryTask('nonexistent');

      expect((result as any).status).toBe(404);
    });
  });

  describe('handleReviewPlan', () => {
    it('should review a plan', async () => {
      const mockResult = { iterationId: 'iter-1', suggestions: [] };
      mockReviewPlan.mockResolvedValueOnce(mockResult);

      const { handleReviewPlan } = await import('../handlers');
      const result = await handleReviewPlan({
        planId: 'plan-1',
        reviewType: 'add_missing',
      });

      expect((result as any).data).toEqual(mockResult);
    });

    it('should return error on failure', async () => {
      mockReviewPlan.mockRejectedValueOnce(new Error('Review failed'));

      const { handleReviewPlan } = await import('../handlers');
      const result = await handleReviewPlan({
        planId: 'plan-1',
        reviewType: 'add_missing',
      });

      expect((result as any).status).toBe(500);
      expect((result as any).data.error).toBe('Failed to review plan');
    });
  });

  describe('handleApplySuggestions', () => {
    it('should apply suggestions and return updated plan', async () => {
      const mockPlan = { id: 'plan-1' };
      const mockPhases = [{ id: 'phase-1' }];
      const mockTasks = [{ id: 'task-1' }];

      mockApplySuggestions.mockResolvedValueOnce(undefined);
      mockSelectLimit.mockResolvedValueOnce([mockPlan]);
      mockSelectOrderBy
        .mockResolvedValueOnce(mockPhases)
        .mockResolvedValueOnce(mockTasks);

      const { handleApplySuggestions } = await import('../handlers');
      const result = await handleApplySuggestions({
        planId: 'plan-1',
        iterationId: 'iter-1',
        suggestionIndices: [0, 1],
      });

      expect((result as any).data).toEqual({
        plan: mockPlan,
        phases: mockPhases,
        tasks: mockTasks,
      });
    });

    it('should return error on failure', async () => {
      mockApplySuggestions.mockRejectedValueOnce(new Error('Apply failed'));

      const { handleApplySuggestions } = await import('../handlers');
      const result = await handleApplySuggestions({
        planId: 'plan-1',
        iterationId: 'iter-1',
        suggestionIndices: [0],
      });

      expect((result as any).status).toBe(500);
    });
  });

  describe('handleExecutePlan', () => {
    it('should start plan execution', async () => {
      mockPlanExecutor.executePlan.mockResolvedValueOnce(undefined);

      const { handleExecutePlan } = await import('../handlers');
      const result = await handleExecutePlan('plan-1');

      expect((result as any).data.status).toBe('running');
      expect((result as any).data.message).toBe('Plan execution started');
    });
  });

  describe('handlePausePlan', () => {
    it('should pause a plan', async () => {
      const mockPlan = { id: 'plan-1', status: 'paused' };
      mockSelectLimit.mockResolvedValueOnce([mockPlan]);

      const { handlePausePlan } = await import('../handlers');
      const result = await handlePausePlan('plan-1');

      expect((result as any).data).toEqual({ plan: mockPlan });
    });

    it('should return error on failure', async () => {
      mockUpdate.mockImplementationOnce(() => {
        throw new Error('DB error');
      });

      const { handlePausePlan } = await import('../handlers');
      const result = await handlePausePlan('plan-1');

      expect((result as any).status).toBe(500);
    });
  });

  describe('handleResumePlan', () => {
    it('should resume plan execution', async () => {
      mockPlanExecutor.resumePlan.mockResolvedValueOnce(undefined);

      const { handleResumePlan } = await import('../handlers');
      const result = await handleResumePlan('plan-1');

      expect((result as any).data.status).toBe('running');
      expect((result as any).data.message).toBe('Plan execution resumed');
    });
  });

  describe('handleCancelPlan', () => {
    it('should cancel a plan', async () => {
      const mockPlan = { id: 'plan-1', status: 'failed' };
      mockPlanExecutor.cancelPlan.mockResolvedValueOnce(undefined);
      mockSelectLimit.mockResolvedValueOnce([mockPlan]);

      const { handleCancelPlan } = await import('../handlers');
      const result = await handleCancelPlan('plan-1');

      expect((result as any).data).toEqual({ plan: mockPlan });
    });

    it('should return error on failure', async () => {
      mockPlanExecutor.cancelPlan.mockRejectedValueOnce(new Error('Cancel failed'));

      const { handleCancelPlan } = await import('../handlers');
      const result = await handleCancelPlan('plan-1');

      expect((result as any).status).toBe(500);
    });
  });
});
