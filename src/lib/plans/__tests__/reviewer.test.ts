import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create mock functions
const mockClaudeWrapper = vi.hoisted(() => ({
  executeOneShot: vi.fn(),
}));

const mockGetContainerPath = vi.hoisted(() => vi.fn((path: string) => path));

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

  const mockWhere = vi.fn(() => ({}));
  const mockSet = vi.fn(() => ({ where: mockWhere }));
  const mockUpdate = vi.fn(() => ({ set: mockSet }));

  const mockDeleteWhere = vi.fn();
  const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }));

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
  plans: { id: 'id', repositoryId: 'repository_id' },
  phases: { id: 'id', planId: 'plan_id', order: 'order' },
  planTasks: {
    id: 'id',
    phaseId: 'phase_id',
    planId: 'plan_id',
    order: 'order',
  },
  planIterations: { id: 'id', planId: 'plan_id' },
}));

vi.mock('@/db/schema/repositories', () => ({
  repositories: { id: 'id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ field: a, value: b })),
  relations: vi.fn(),
}));

vi.mock('@/lib/claude/wrapper', () => ({
  claudeWrapper: mockClaudeWrapper,
}));

vi.mock('@/lib/qa-gates/command-executor', () => ({
  getContainerPath: mockGetContainerPath,
}));

describe('plans/reviewer', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Reset mock chain implementations
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ returning: mockValuesReturning });
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockWhere });
    mockDelete.mockReturnValue({ where: mockDeleteWhere });
    mockSelect.mockReturnValue({ from: mockSelectFrom });
    mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
    mockSelectWhere.mockReturnValue({
      orderBy: mockSelectOrderBy,
      limit: mockSelectLimit,
    });
    // mockSelectOrderBy returns a thenable so it can be awaited directly
    mockSelectOrderBy.mockResolvedValue([]);
    mockSelectLimit.mockResolvedValue([]);
  });

  describe('reviewPlan', () => {
    const mockPlan = {
      id: 'plan-1',
      repositoryId: 'repo-1',
      title: 'Test Plan',
      description: 'Test Description',
    };

    const mockRepository = {
      id: 'repo-1',
      name: 'test-repo',
      path: '/path/to/repo',
    };

    const mockPhases = [
      {
        id: 'phase-1',
        planId: 'plan-1',
        order: 1,
        title: 'Phase 1',
        description: 'First phase',
        executionMode: 'sequential',
        pauseAfter: false,
      },
    ];

    const mockTasks = [
      {
        id: 'task-1',
        phaseId: 'phase-1',
        planId: 'plan-1',
        order: 1,
        title: 'Task 1',
        description: 'First task',
        canRunInParallel: false,
        dependsOn: null,
      },
    ];

    it('should review a plan and return suggestions', async () => {
      const mockIteration = {
        id: 'iteration-1',
        planId: 'plan-1',
      };

      const claudeResponse = JSON.stringify([
        {
          type: 'add_task',
          target: 'Add testing task',
          reasoning: 'Missing test coverage',
          after: { title: 'Add tests', description: 'Write unit tests' },
        },
      ]);

      mockSelectLimit.mockResolvedValueOnce([mockPlan]);
      mockDb.query.repositories.findFirst.mockResolvedValueOnce(mockRepository);
      mockValuesReturning.mockResolvedValueOnce([mockIteration]);
      mockSelectOrderBy
        .mockResolvedValueOnce(mockPhases)
        .mockResolvedValueOnce(mockTasks);
      mockClaudeWrapper.executeOneShot.mockResolvedValueOnce(claudeResponse);

      const { reviewPlan } = await import('../reviewer');
      const result = await reviewPlan('plan-1', 'add_missing');

      expect(result.iterationId).toBe('iteration-1');
      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0]!.type).toBe('add_task');
    });

    it('should throw error when plan not found', async () => {
      mockSelectLimit.mockResolvedValueOnce([]);

      const { reviewPlan } = await import('../reviewer');

      await expect(reviewPlan('nonexistent', 'add_missing')).rejects.toThrow(
        'Plan not found: nonexistent'
      );
    });

    it('should throw error when repository not found', async () => {
      mockSelectLimit.mockResolvedValueOnce([mockPlan]);
      mockDb.query.repositories.findFirst.mockResolvedValueOnce(undefined);

      const { reviewPlan } = await import('../reviewer');

      await expect(reviewPlan('plan-1', 'add_missing')).rejects.toThrow(
        'Repository not found: repo-1'
      );
    });

    it('should handle empty suggestions array', async () => {
      const mockIteration = {
        id: 'iteration-1',
        planId: 'plan-1',
      };

      mockSelectLimit.mockResolvedValueOnce([mockPlan]);
      mockDb.query.repositories.findFirst.mockResolvedValueOnce(mockRepository);
      mockValuesReturning.mockResolvedValueOnce([mockIteration]);
      mockSelectOrderBy
        .mockResolvedValueOnce(mockPhases)
        .mockResolvedValueOnce(mockTasks);
      mockClaudeWrapper.executeOneShot.mockResolvedValueOnce('[]');

      const { reviewPlan } = await import('../reviewer');
      const result = await reviewPlan('plan-1', 'refine_descriptions');

      expect(result.suggestions).toEqual([]);
    });

    it('should parse response with markdown code blocks', async () => {
      const mockIteration = {
        id: 'iteration-1',
        planId: 'plan-1',
      };

      const claudeResponse = `\`\`\`json
[
  {
    "type": "modify_task",
    "target": "Improve task description",
    "reasoning": "Current description is too vague",
    "before": { "id": "task-1" },
    "after": { "id": "task-1", "description": "Better description" }
  }
]
\`\`\``;

      mockSelectLimit.mockResolvedValueOnce([mockPlan]);
      mockDb.query.repositories.findFirst.mockResolvedValueOnce(mockRepository);
      mockValuesReturning.mockResolvedValueOnce([mockIteration]);
      mockSelectOrderBy
        .mockResolvedValueOnce(mockPhases)
        .mockResolvedValueOnce(mockTasks);
      mockClaudeWrapper.executeOneShot.mockResolvedValueOnce(claudeResponse);

      const { reviewPlan } = await import('../reviewer');
      const result = await reviewPlan('plan-1', 'refine_descriptions');

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0]!.type).toBe('modify_task');
    });

    it('should throw error on invalid Claude response', async () => {
      const mockIteration = {
        id: 'iteration-1',
        planId: 'plan-1',
      };

      mockSelectLimit.mockResolvedValueOnce([mockPlan]);
      mockDb.query.repositories.findFirst.mockResolvedValueOnce(mockRepository);
      mockValuesReturning.mockResolvedValueOnce([mockIteration]);
      mockSelectOrderBy
        .mockResolvedValueOnce(mockPhases)
        .mockResolvedValueOnce(mockTasks);
      mockClaudeWrapper.executeOneShot.mockResolvedValueOnce('not valid json');

      const { reviewPlan } = await import('../reviewer');

      await expect(reviewPlan('plan-1', 'add_missing')).rejects.toThrow(
        'Failed to parse review suggestions'
      );
    });

    it('should throw error when response is not an array', async () => {
      const mockIteration = {
        id: 'iteration-1',
        planId: 'plan-1',
      };

      mockSelectLimit.mockResolvedValueOnce([mockPlan]);
      mockDb.query.repositories.findFirst.mockResolvedValueOnce(mockRepository);
      mockValuesReturning.mockResolvedValueOnce([mockIteration]);
      mockSelectOrderBy
        .mockResolvedValueOnce(mockPhases)
        .mockResolvedValueOnce(mockTasks);
      mockClaudeWrapper.executeOneShot.mockResolvedValueOnce(
        '{"type": "add_task"}'
      );

      const { reviewPlan } = await import('../reviewer');

      await expect(reviewPlan('plan-1', 'add_missing')).rejects.toThrow(
        'Response is not an array'
      );
    });

    it('should use correct prompt for optimize_order review type', async () => {
      const mockIteration = {
        id: 'iteration-1',
        planId: 'plan-1',
      };

      mockSelectLimit.mockResolvedValueOnce([mockPlan]);
      mockDb.query.repositories.findFirst.mockResolvedValueOnce(mockRepository);
      mockValuesReturning.mockResolvedValueOnce([mockIteration]);
      mockSelectOrderBy
        .mockResolvedValueOnce(mockPhases)
        .mockResolvedValueOnce(mockTasks);
      mockClaudeWrapper.executeOneShot.mockResolvedValueOnce('[]');

      const { reviewPlan } = await import('../reviewer');
      await reviewPlan('plan-1', 'optimize_order');

      expect(mockClaudeWrapper.executeOneShot).toHaveBeenCalledWith(
        expect.stringContaining('Review the order'),
        '/path/to/repo',
        60000
      );
    });

    it('should use correct prompt for break_down review type', async () => {
      const mockIteration = {
        id: 'iteration-1',
        planId: 'plan-1',
      };

      mockSelectLimit.mockResolvedValueOnce([mockPlan]);
      mockDb.query.repositories.findFirst.mockResolvedValueOnce(mockRepository);
      mockValuesReturning.mockResolvedValueOnce([mockIteration]);
      mockSelectOrderBy
        .mockResolvedValueOnce(mockPhases)
        .mockResolvedValueOnce(mockTasks);
      mockClaudeWrapper.executeOneShot.mockResolvedValueOnce('[]');

      const { reviewPlan } = await import('../reviewer');
      await reviewPlan('plan-1', 'break_down');

      expect(mockClaudeWrapper.executeOneShot).toHaveBeenCalledWith(
        expect.stringContaining('Identify tasks that are too complex'),
        '/path/to/repo',
        60000
      );
    });
  });

  describe('applySuggestions', () => {
    const mockIteration = {
      id: 'iteration-1',
      planId: 'plan-1',
      changes: JSON.stringify({
        reviewType: 'add_missing',
        suggestions: [
          {
            type: 'add_task',
            target: 'Add testing task',
            reasoning: 'Missing test coverage',
            after: {
              title: 'Add tests',
              description: 'Write unit tests',
              phaseId: 'phase-1',
            },
          },
          {
            type: 'modify_task',
            target: 'Improve task',
            reasoning: 'Better description',
            after: { id: 'task-1', description: 'Improved description' },
          },
        ],
      }),
    };

    it('should apply selected suggestions', async () => {
      mockSelectLimit.mockResolvedValueOnce([mockIteration]);
      mockValuesReturning.mockResolvedValue([{}]);

      const { applySuggestions } = await import('../reviewer');
      await applySuggestions('plan-1', 'iteration-1', [0]);

      expect(mockInsert).toHaveBeenCalled();
    });

    it('should throw error when iteration not found', async () => {
      mockSelectLimit.mockResolvedValueOnce([]);

      const { applySuggestions } = await import('../reviewer');

      await expect(
        applySuggestions('plan-1', 'nonexistent', [0])
      ).rejects.toThrow('Iteration not found: nonexistent');
    });

    it('should skip invalid suggestion indices', async () => {
      mockSelectLimit.mockResolvedValueOnce([mockIteration]);
      mockValuesReturning.mockResolvedValue([{}]);

      const { applySuggestions } = await import('../reviewer');
      // Index 10 is out of bounds, should be skipped
      await applySuggestions('plan-1', 'iteration-1', [10, -1]);

      // Should still update plan and record user edit
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should apply modify_task suggestion', async () => {
      mockSelectLimit.mockResolvedValueOnce([mockIteration]);
      mockValuesReturning.mockResolvedValue([{}]);

      const { applySuggestions } = await import('../reviewer');
      await applySuggestions('plan-1', 'iteration-1', [1]);

      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should apply reorder suggestion', async () => {
      const iterationWithReorder = {
        id: 'iteration-1',
        planId: 'plan-1',
        changes: JSON.stringify({
          reviewType: 'optimize_order',
          suggestions: [
            {
              type: 'reorder',
              target: 'Reorder tasks',
              reasoning: 'Better flow',
              after: {
                updates: [
                  { taskId: 'task-1', newOrder: 2 },
                  { taskId: 'task-2', newOrder: 1 },
                ],
              },
            },
          ],
        }),
      };

      mockSelectLimit.mockResolvedValueOnce([iterationWithReorder]);
      mockValuesReturning.mockResolvedValue([{}]);

      const { applySuggestions } = await import('../reviewer');
      await applySuggestions('plan-1', 'iteration-1', [0]);

      // Should have called update for reordering
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should apply add_phase suggestion', async () => {
      const iterationWithPhase = {
        id: 'iteration-1',
        planId: 'plan-1',
        changes: JSON.stringify({
          reviewType: 'add_missing',
          suggestions: [
            {
              type: 'add_phase',
              target: 'Add testing phase',
              reasoning: 'Need dedicated testing phase',
              after: { title: 'Testing', description: 'Run all tests' },
            },
          ],
        }),
      };

      mockSelectLimit.mockResolvedValueOnce([iterationWithPhase]);
      mockValuesReturning.mockResolvedValue([{}]);

      const { applySuggestions } = await import('../reviewer');
      await applySuggestions('plan-1', 'iteration-1', [0]);

      expect(mockInsert).toHaveBeenCalled();
    });

    it('should apply break_down_task suggestion', async () => {
      const iterationWithBreakdown = {
        id: 'iteration-1',
        planId: 'plan-1',
        changes: JSON.stringify({
          reviewType: 'break_down',
          suggestions: [
            {
              type: 'break_down_task',
              target: 'Break down complex task',
              reasoning: 'Task is too large',
              before: { id: 'task-1', phaseId: 'phase-1' },
              after: {
                tasks: [
                  { title: 'Subtask 1', description: 'First part' },
                  { title: 'Subtask 2', description: 'Second part' },
                ],
              },
            },
          ],
        }),
      };

      mockSelectLimit.mockResolvedValueOnce([iterationWithBreakdown]);
      mockValuesReturning.mockResolvedValue([{}]);

      const { applySuggestions } = await import('../reviewer');
      await applySuggestions('plan-1', 'iteration-1', [0]);

      // Should delete original task and insert new ones
      expect(mockDelete).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should throw error when modify_task suggestion has no id', async () => {
      const iterationWithInvalidModify = {
        id: 'iteration-1',
        planId: 'plan-1',
        changes: JSON.stringify({
          reviewType: 'refine_descriptions',
          suggestions: [
            {
              type: 'modify_task',
              target: 'Modify task',
              reasoning: 'Better description',
              after: { description: 'New description' }, // Missing id
            },
          ],
        }),
      };

      mockSelectLimit.mockResolvedValueOnce([iterationWithInvalidModify]);

      const { applySuggestions } = await import('../reviewer');

      await expect(
        applySuggestions('plan-1', 'iteration-1', [0])
      ).rejects.toThrow('Missing task ID in modify_task suggestion');
    });

    it('should handle phase reordering', async () => {
      const iterationWithPhaseReorder = {
        id: 'iteration-1',
        planId: 'plan-1',
        changes: JSON.stringify({
          reviewType: 'optimize_order',
          suggestions: [
            {
              type: 'reorder',
              target: 'Reorder phases',
              reasoning: 'Better flow',
              after: {
                updates: [
                  { phaseId: 'phase-1', newOrder: 2 },
                  { phaseId: 'phase-2', newOrder: 1 },
                ],
              },
            },
          ],
        }),
      };

      mockSelectLimit.mockResolvedValueOnce([iterationWithPhaseReorder]);
      mockValuesReturning.mockResolvedValue([{}]);

      const { applySuggestions } = await import('../reviewer');
      await applySuggestions('plan-1', 'iteration-1', [0]);

      expect(mockUpdate).toHaveBeenCalled();
    });
  });
});
