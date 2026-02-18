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
} = vi.hoisted(() => {
  const mockValuesReturning = vi.fn();
  const mockValues = vi.fn(() => ({ returning: mockValuesReturning }));
  const mockInsert = vi.fn(() => ({ values: mockValues }));

  const mockWhere = vi.fn(() => ({}));
  const mockSet = vi.fn(() => ({ where: mockWhere }));
  const mockUpdate = vi.fn(() => ({ set: mockSet }));

  const mockSelectOrderBy = vi.fn();
  const mockSelectWhere = vi.fn(() => ({ orderBy: mockSelectOrderBy }));
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
  };
});

vi.mock('@/db', () => ({
  db: mockDb,
}));

vi.mock('@/db/schema', () => ({
  plans: { id: 'id' },
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

describe('plans/generator', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Reset mock chain implementations
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ returning: mockValuesReturning });
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockSelectFrom });
    mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
    mockSelectWhere.mockReturnValue({ orderBy: mockSelectOrderBy });
  });

  describe('generatePlanFromDescription', () => {
    it('should generate a plan with phases and tasks from Claude response', async () => {
      const mockRepository = {
        id: 'repo-1',
        name: 'test-repo',
        path: '/path/to/repo',
      };

      const mockPlan = {
        id: 'plan-1',
        repositoryId: 'repo-1',
        title: 'Test Plan',
        description: 'Test Description',
        status: 'draft',
      };

      const mockPhase = {
        id: 'phase-1',
        planId: 'plan-1',
        order: 1,
        title: 'Phase 1',
      };

      const mockTask = {
        id: 'task-1',
        phaseId: 'phase-1',
        planId: 'plan-1',
        order: 1,
        title: 'Task 1',
      };

      const claudeResponse = JSON.stringify({
        phases: [
          {
            title: 'Phase 1',
            description: 'First phase',
            executionMode: 'sequential',
            pauseAfter: false,
            tasks: [
              {
                title: 'Task 1',
                description: 'First task',
                dependsOn: [],
                canRunInParallel: false,
              },
            ],
          },
        ],
      });

      mockDb.query.repositories.findFirst.mockResolvedValueOnce(mockRepository);
      mockValuesReturning
        .mockResolvedValueOnce([mockPlan]) // plan insert
        .mockResolvedValueOnce([mockPhase]) // phase insert
        .mockResolvedValueOnce([mockTask]) // task insert
        .mockResolvedValueOnce([]); // iteration insert
      mockClaudeWrapper.executeOneShot.mockResolvedValueOnce(claudeResponse);
      mockSelectOrderBy
        .mockResolvedValueOnce([mockPhase]) // phases select
        .mockResolvedValueOnce([mockTask]); // tasks select

      const { generatePlanFromDescription } = await import('../generator');
      const result = await generatePlanFromDescription(
        'repo-1',
        'Test Plan',
        'Test Description'
      );

      expect(result).toBe('plan-1');
      expect(mockClaudeWrapper.executeOneShot).toHaveBeenCalledWith(
        expect.stringContaining('Test Plan'),
        '/path/to/repo',
        300000,
        null,
        undefined
      );
    });

    it('should throw error when repository not found', async () => {
      mockDb.query.repositories.findFirst.mockResolvedValueOnce(undefined);

      const { generatePlanFromDescription } = await import('../generator');

      await expect(
        generatePlanFromDescription('nonexistent', 'Title', 'Desc')
      ).rejects.toThrow('Repository not found: nonexistent');
    });

    it('should throw error when plan creation fails', async () => {
      const mockRepository = {
        id: 'repo-1',
        name: 'test-repo',
        path: '/path/to/repo',
      };

      mockDb.query.repositories.findFirst.mockResolvedValueOnce(mockRepository);
      mockValuesReturning.mockResolvedValueOnce([]);

      const { generatePlanFromDescription } = await import('../generator');

      await expect(
        generatePlanFromDescription('repo-1', 'Title', 'Desc')
      ).rejects.toThrow('Failed to create plan');
    });

    it('should parse JSON from markdown code blocks', async () => {
      const mockRepository = {
        id: 'repo-1',
        name: 'test-repo',
        path: '/path/to/repo',
      };

      const mockPlan = {
        id: 'plan-1',
        repositoryId: 'repo-1',
        title: 'Test Plan',
        description: 'Test Description',
        status: 'draft',
      };

      const mockPhase = {
        id: 'phase-1',
        planId: 'plan-1',
        order: 1,
        title: 'Phase 1',
      };

      const mockTask = {
        id: 'task-1',
        phaseId: 'phase-1',
        planId: 'plan-1',
        order: 1,
        title: 'Task 1',
      };

      // Claude response wrapped in markdown code block
      const claudeResponse = `\`\`\`json
{
  "phases": [
    {
      "title": "Phase 1",
      "description": "First phase",
      "executionMode": "sequential",
      "pauseAfter": false,
      "tasks": [
        {
          "title": "Task 1",
          "description": "First task",
          "dependsOn": [],
          "canRunInParallel": false
        }
      ]
    }
  ]
}
\`\`\``;

      mockDb.query.repositories.findFirst.mockResolvedValueOnce(mockRepository);
      mockValuesReturning
        .mockResolvedValueOnce([mockPlan])
        .mockResolvedValueOnce([mockPhase])
        .mockResolvedValueOnce([mockTask])
        .mockResolvedValueOnce([]);
      mockClaudeWrapper.executeOneShot.mockResolvedValueOnce(claudeResponse);
      mockSelectOrderBy
        .mockResolvedValueOnce([mockPhase])
        .mockResolvedValueOnce([mockTask]);

      const { generatePlanFromDescription } = await import('../generator');
      const result = await generatePlanFromDescription(
        'repo-1',
        'Test Plan',
        'Test Description'
      );

      expect(result).toBe('plan-1');
    });

    it('should handle task dependencies correctly', async () => {
      const mockRepository = {
        id: 'repo-1',
        name: 'test-repo',
        path: '/path/to/repo',
      };

      const mockPlan = {
        id: 'plan-1',
        repositoryId: 'repo-1',
        title: 'Test Plan',
        description: 'Test Description',
        status: 'draft',
      };

      const mockPhase = {
        id: 'phase-1',
        planId: 'plan-1',
        order: 1,
        title: 'Phase 1',
      };

      const claudeResponse = JSON.stringify({
        phases: [
          {
            title: 'Phase 1',
            description: 'First phase',
            executionMode: 'sequential',
            pauseAfter: false,
            tasks: [
              {
                title: 'Task 1',
                description: 'First task',
                dependsOn: [],
                canRunInParallel: false,
              },
              {
                title: 'Task 2',
                description: 'Second task depends on first',
                dependsOn: [0],
                canRunInParallel: false,
              },
            ],
          },
        ],
      });

      mockDb.query.repositories.findFirst.mockResolvedValueOnce(mockRepository);
      mockValuesReturning
        .mockResolvedValueOnce([mockPlan])
        .mockResolvedValueOnce([mockPhase])
        .mockResolvedValueOnce([{ id: 'task-1' }])
        .mockResolvedValueOnce([{ id: 'task-2' }])
        .mockResolvedValueOnce([]);
      mockClaudeWrapper.executeOneShot.mockResolvedValueOnce(claudeResponse);
      mockSelectOrderBy
        .mockResolvedValueOnce([mockPhase])
        .mockResolvedValueOnce([{ id: 'task-1' }, { id: 'task-2' }]);

      const { generatePlanFromDescription } = await import('../generator');
      const result = await generatePlanFromDescription(
        'repo-1',
        'Test Plan',
        'Test Description'
      );

      expect(result).toBe('plan-1');
      // Verify update was called for dependencies
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should mark plan as failed when Claude response parsing fails', async () => {
      const mockRepository = {
        id: 'repo-1',
        name: 'test-repo',
        path: '/path/to/repo',
      };

      const mockPlan = {
        id: 'plan-1',
        repositoryId: 'repo-1',
        status: 'draft',
      };

      const emittedEvents: unknown[] = [];
      const onProgress = (event: unknown) => emittedEvents.push(event);

      mockDb.query.repositories.findFirst.mockResolvedValueOnce(mockRepository);
      mockValuesReturning.mockResolvedValueOnce([mockPlan]);
      mockClaudeWrapper.executeOneShot.mockResolvedValueOnce(
        'invalid json response'
      );

      const { generatePlanFromDescription } = await import('../generator');

      await expect(
        generatePlanFromDescription('repo-1', 'Title', 'Desc', onProgress)
      ).rejects.toThrow('Failed to parse plan structure');

      expect(mockUpdate).toHaveBeenCalled();

      // Verify a structured PARSE_ERROR event was emitted
      const errorEvent = emittedEvents.find(
        (e) => (e as { type: string }).type === 'error'
      ) as { type: string; code: string; detail?: string } | undefined;
      expect(errorEvent).toBeDefined();
      expect(errorEvent?.code).toBe('PARSE_ERROR');
      // detail should contain a snippet of the raw response
      expect(errorEvent?.detail).toContain('invalid json response');
    });

    it('should handle response with embedded JSON', async () => {
      const mockRepository = {
        id: 'repo-1',
        name: 'test-repo',
        path: '/path/to/repo',
      };

      const mockPlan = {
        id: 'plan-1',
        repositoryId: 'repo-1',
        title: 'Test Plan',
        description: 'Test Description',
        status: 'draft',
      };

      const mockPhase = {
        id: 'phase-1',
        planId: 'plan-1',
        order: 1,
        title: 'Phase 1',
      };

      const mockTask = {
        id: 'task-1',
        phaseId: 'phase-1',
        planId: 'plan-1',
        order: 1,
        title: 'Task 1',
      };

      // Claude response with extra text before/after JSON
      const claudeResponse = `Here is your plan: {"phases": [{"title": "Phase 1", "description": "First phase", "executionMode": "sequential", "pauseAfter": false, "tasks": [{"title": "Task 1", "description": "First task", "dependsOn": [], "canRunInParallel": false}]}]} Hope this helps!`;

      mockDb.query.repositories.findFirst.mockResolvedValueOnce(mockRepository);
      mockValuesReturning
        .mockResolvedValueOnce([mockPlan])
        .mockResolvedValueOnce([mockPhase])
        .mockResolvedValueOnce([mockTask])
        .mockResolvedValueOnce([]);
      mockClaudeWrapper.executeOneShot.mockResolvedValueOnce(claudeResponse);
      mockSelectOrderBy
        .mockResolvedValueOnce([mockPhase])
        .mockResolvedValueOnce([mockTask]);

      const { generatePlanFromDescription } = await import('../generator');
      const result = await generatePlanFromDescription(
        'repo-1',
        'Test Plan',
        'Test Description'
      );

      expect(result).toBe('plan-1');
    });

    it('should throw error when phases array is missing', async () => {
      const mockRepository = {
        id: 'repo-1',
        name: 'test-repo',
        path: '/path/to/repo',
      };

      const mockPlan = {
        id: 'plan-1',
        repositoryId: 'repo-1',
        status: 'draft',
      };

      const emittedEvents: unknown[] = [];
      const onProgress = (event: unknown) => emittedEvents.push(event);

      mockDb.query.repositories.findFirst.mockResolvedValueOnce(mockRepository);
      mockValuesReturning.mockResolvedValueOnce([mockPlan]);
      mockClaudeWrapper.executeOneShot.mockResolvedValueOnce('{"tasks": []}');

      const { generatePlanFromDescription } = await import('../generator');

      await expect(
        generatePlanFromDescription('repo-1', 'Title', 'Desc', onProgress)
      ).rejects.toThrow('Invalid plan structure: missing phases array');

      // Verify a structured PARSE_ERROR event was emitted with code
      const errorEvent = emittedEvents.find(
        (e) => (e as { type: string }).type === 'error'
      ) as { type: string; code: string } | undefined;
      expect(errorEvent).toBeDefined();
      expect(errorEvent?.code).toBe('PARSE_ERROR');
    });

    it('should handle multiple phases with tasks', async () => {
      const mockRepository = {
        id: 'repo-1',
        name: 'test-repo',
        path: '/path/to/repo',
      };

      const mockPlan = {
        id: 'plan-1',
        repositoryId: 'repo-1',
        title: 'Test Plan',
        description: 'Test Description',
        status: 'draft',
      };

      const claudeResponse = JSON.stringify({
        phases: [
          {
            title: 'Phase 1',
            description: 'First phase',
            executionMode: 'sequential',
            pauseAfter: false,
            tasks: [
              {
                title: 'Task 1',
                description: 'First task',
                dependsOn: [],
                canRunInParallel: false,
              },
            ],
          },
          {
            title: 'Phase 2',
            description: 'Second phase',
            executionMode: 'parallel',
            pauseAfter: true,
            tasks: [
              {
                title: 'Task 2',
                description: 'Second task',
                dependsOn: [],
                canRunInParallel: true,
              },
              {
                title: 'Task 3',
                description: 'Third task',
                dependsOn: [],
                canRunInParallel: true,
              },
            ],
          },
        ],
      });

      mockDb.query.repositories.findFirst.mockResolvedValueOnce(mockRepository);
      mockValuesReturning
        .mockResolvedValueOnce([mockPlan])
        .mockResolvedValueOnce([{ id: 'phase-1' }])
        .mockResolvedValueOnce([{ id: 'task-1' }])
        .mockResolvedValueOnce([{ id: 'phase-2' }])
        .mockResolvedValueOnce([{ id: 'task-2' }])
        .mockResolvedValueOnce([{ id: 'task-3' }])
        .mockResolvedValueOnce([]);
      mockClaudeWrapper.executeOneShot.mockResolvedValueOnce(claudeResponse);
      mockSelectOrderBy
        .mockResolvedValueOnce([{ id: 'phase-1' }, { id: 'phase-2' }])
        .mockResolvedValueOnce([
          { id: 'task-1' },
          { id: 'task-2' },
          { id: 'task-3' },
        ]);

      const { generatePlanFromDescription } = await import('../generator');
      const result = await generatePlanFromDescription(
        'repo-1',
        'Test Plan',
        'Test Description'
      );

      expect(result).toBe('plan-1');
    });
  });
});
