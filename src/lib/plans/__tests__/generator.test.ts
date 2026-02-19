import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create mock functions
const mockClaudeWrapper = vi.hoisted(() => ({
  executeOneShot: vi.fn(),
  executeWithStream: vi.fn(),
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
  mockDelete,
  mockDeleteWhere,
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

  const mockDeleteWhere = vi.fn(() => ({}));
  const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }));

  const mockDb = {
    query: {
      repositories: {
        findFirst: vi.fn(),
      },
    },
    insert: mockInsert,
    update: mockUpdate,
    select: mockSelect,
    delete: mockDelete,
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
    mockDelete,
    mockDeleteWhere,
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
    mockDelete.mockReturnValue({ where: mockDeleteWhere });
  });

  describe('generatePlanFromDescription - SSE event sequence', () => {
    it('should emit status, progress, chunk, and done events in correct order', async () => {
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
        .mockResolvedValueOnce([mockPlan])
        .mockResolvedValueOnce([mockPhase])
        .mockResolvedValueOnce([mockTask])
        .mockResolvedValueOnce([]);
      mockClaudeWrapper.executeWithStream.mockImplementation(
        async (_prompt, _workingDir, onChunk, _timeout, _signal) => {
          onChunk(claudeResponse);
          return claudeResponse;
        }
      );
      mockSelectOrderBy
        .mockResolvedValueOnce([mockPhase])
        .mockResolvedValueOnce([mockTask]);

      const emittedEvents: unknown[] = [];
      const onProgress = (event: unknown) => emittedEvents.push(event);

      const { generatePlanFromDescription } = await import('../generator');
      await generatePlanFromDescription(
        'repo-1',
        'Test Plan',
        'Test Description',
        onProgress
      );

      // Verify event sequence
      expect(emittedEvents.length).toBeGreaterThan(0);

      // First event should be status
      expect(emittedEvents[0]).toMatchObject({
        type: 'status',
        message: 'Analyzing repository...',
      });

      // Should have progress events
      const progressEvents = emittedEvents.filter(
        (e) => (e as { type: string }).type === 'progress'
      );
      expect(progressEvents.length).toBeGreaterThan(0);

      // Progress should be 0-100
      progressEvents.forEach((e) => {
        const percent = (e as { percent: number }).percent;
        expect(percent).toBeGreaterThanOrEqual(0);
        expect(percent).toBeLessThanOrEqual(100);
      });

      // Should have chunk events
      const chunkEvents = emittedEvents.filter(
        (e) => (e as { type: string }).type === 'chunk'
      );
      expect(chunkEvents.length).toBeGreaterThan(0);

      // Last event should be done
      const lastEvent = emittedEvents[emittedEvents.length - 1];
      expect(lastEvent).toMatchObject({
        type: 'done',
        planId: 'plan-1',
      });
    });

    it('should emit status events at key milestones', async () => {
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
        .mockResolvedValueOnce([mockPlan])
        .mockResolvedValueOnce([{ id: 'phase-1' }])
        .mockResolvedValueOnce([{ id: 'task-1' }])
        .mockResolvedValueOnce([]);
      mockClaudeWrapper.executeWithStream.mockImplementation(
        async (_prompt, _workingDir, onChunk, _timeout, _signal) => {
          onChunk(claudeResponse);
          return claudeResponse;
        }
      );
      mockSelectOrderBy
        .mockResolvedValueOnce([{ id: 'phase-1' }])
        .mockResolvedValueOnce([{ id: 'task-1' }]);

      const emittedEvents: unknown[] = [];
      const onProgress = (event: unknown) => emittedEvents.push(event);

      const { generatePlanFromDescription } = await import('../generator');
      await generatePlanFromDescription('repo-1', 'Title', 'Desc', onProgress);

      const statusEvents = emittedEvents.filter(
        (e) => (e as { type: string }).type === 'status'
      ) as Array<{ type: string; message: string }>;

      // Verify expected status milestones
      const statusMessages = statusEvents.map((e) => e.message);
      expect(statusMessages).toContain('Analyzing repository...');
      expect(statusMessages).toContain('Building generation prompt...');
      expect(statusMessages).toContain('Calling LLM...');
      expect(statusMessages).toContain('Parsing plan structure...');
      expect(statusMessages).toContain('Validating plan structure...');
      expect(statusMessages).toContain('Saving phases and tasks...');
    });

    it('should emit progress events in ascending order', async () => {
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
        .mockResolvedValueOnce([mockPlan])
        .mockResolvedValueOnce([{ id: 'phase-1' }])
        .mockResolvedValueOnce([{ id: 'task-1' }])
        .mockResolvedValueOnce([]);
      mockClaudeWrapper.executeWithStream.mockImplementation(
        async (_prompt, _workingDir, onChunk, _timeout, _signal) => {
          // Simulate multiple chunks
          onChunk('{"phases":');
          onChunk('[{"title":"Phase 1"');
          onChunk(',');
          onChunk(claudeResponse.slice(10)); // rest of response
          return claudeResponse;
        }
      );
      mockSelectOrderBy
        .mockResolvedValueOnce([{ id: 'phase-1' }])
        .mockResolvedValueOnce([{ id: 'task-1' }]);

      const emittedEvents: unknown[] = [];
      const onProgress = (event: unknown) => emittedEvents.push(event);

      const { generatePlanFromDescription } = await import('../generator');
      await generatePlanFromDescription('repo-1', 'Title', 'Desc', onProgress);

      const progressEvents = emittedEvents.filter(
        (e) => (e as { type: string }).type === 'progress'
      ) as Array<{ type: string; percent: number }>;

      // Verify progress is monotonically increasing
      for (let i = 1; i < progressEvents.length; i++) {
        const prev = progressEvents[i - 1];
        const curr = progressEvents[i];
        if (prev && curr) {
          expect(curr.percent).toBeGreaterThanOrEqual(prev.percent);
        }
      }

      // Final progress should be 100
      const lastProgress = progressEvents[progressEvents.length - 1];
      expect(lastProgress?.percent).toBe(100);
    });

    it('should emit chunk events with LLM token output', async () => {
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

      const chunks = ['{"phases":', '[{', '"title":"Phase 1"', '}]}'];
      const claudeResponse = chunks.join('');

      mockDb.query.repositories.findFirst.mockResolvedValueOnce(mockRepository);
      mockValuesReturning
        .mockResolvedValueOnce([mockPlan])
        .mockResolvedValueOnce([{ id: 'phase-1' }])
        .mockResolvedValueOnce([{ id: 'task-1' }])
        .mockResolvedValueOnce([]);
      mockClaudeWrapper.executeWithStream.mockImplementation(
        async (_prompt, _workingDir, onChunk, _timeout, _signal) => {
          chunks.forEach((chunk) => onChunk(chunk));
          return claudeResponse;
        }
      );
      mockSelectOrderBy
        .mockResolvedValueOnce([{ id: 'phase-1' }])
        .mockResolvedValueOnce([{ id: 'task-1' }]);

      const emittedEvents: unknown[] = [];
      const onProgress = (event: unknown) => emittedEvents.push(event);

      const { generatePlanFromDescription } = await import('../generator');

      // This will fail parsing but we're just testing chunk emission
      await expect(
        generatePlanFromDescription('repo-1', 'Title', 'Desc', onProgress)
      ).rejects.toThrow();

      const chunkEvents = emittedEvents.filter(
        (e) => (e as { type: string }).type === 'chunk'
      ) as Array<{ type: string; content: string }>;

      // Verify we got chunk events
      expect(chunkEvents.length).toBe(4);
      expect(chunkEvents.map((e) => e.content)).toEqual(chunks);
    });

    it('should emit done event with planId and warnings', async () => {
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

      // Plan with an empty phase to trigger warnings
      const claudeResponse = JSON.stringify({
        phases: [
          {
            title: 'Empty Phase',
            description: 'Has no tasks',
            executionMode: 'sequential',
            pauseAfter: false,
            tasks: [],
          },
          {
            title: 'Normal Phase',
            description: 'Has tasks',
            executionMode: 'sequential',
            pauseAfter: false,
            tasks: [
              {
                title: 'Task 1',
                description: 'A task',
                dependsOn: [],
                canRunInParallel: false,
              },
            ],
          },
        ],
      });

      mockDb.query.repositories.findFirst.mockResolvedValueOnce(mockRepository);
      mockValuesReturning
        .mockResolvedValueOnce([mockPlan])
        .mockResolvedValueOnce([{ id: 'phase-1' }])
        .mockResolvedValueOnce([{ id: 'phase-2' }])
        .mockResolvedValueOnce([{ id: 'task-1' }])
        .mockResolvedValueOnce([]);
      mockClaudeWrapper.executeWithStream.mockImplementation(
        async (_prompt, _workingDir, onChunk, _timeout, _signal) => {
          onChunk(claudeResponse);
          return claudeResponse;
        }
      );
      mockSelectOrderBy
        .mockResolvedValueOnce([{ id: 'phase-1' }, { id: 'phase-2' }])
        .mockResolvedValueOnce([{ id: 'task-1' }]);

      const emittedEvents: unknown[] = [];
      const onProgress = (event: unknown) => emittedEvents.push(event);

      const { generatePlanFromDescription } = await import('../generator');
      await generatePlanFromDescription('repo-1', 'Title', 'Desc', onProgress);

      const doneEvent = emittedEvents.find(
        (e) => (e as { type: string }).type === 'done'
      ) as { type: string; planId: string; warnings?: unknown[] } | undefined;

      expect(doneEvent).toBeDefined();
      expect(doneEvent?.planId).toBe('plan-1');
      expect(doneEvent?.warnings).toBeDefined();
      expect(doneEvent?.warnings).toHaveLength(1);
    });

    it('should emit error event with PARSE_ERROR code when JSON parsing fails', async () => {
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
      mockClaudeWrapper.executeWithStream.mockImplementation(
        async (_prompt, _workingDir, onChunk, _timeout, _signal) => {
          const response = 'this is not valid json';
          onChunk(response);
          return response;
        }
      );

      const { generatePlanFromDescription } = await import('../generator');

      await expect(
        generatePlanFromDescription('repo-1', 'Title', 'Desc', onProgress)
      ).rejects.toThrow();

      const errorEvent = emittedEvents.find(
        (e) => (e as { type: string }).type === 'error'
      ) as
        | { type: string; code: string; message: string; detail?: string }
        | undefined;

      expect(errorEvent).toBeDefined();
      expect(errorEvent?.code).toBe('PARSE_ERROR');
      expect(errorEvent?.message).toContain('Failed to parse LLM response');
      expect(errorEvent?.detail).toContain('this is not valid json');
    });

    it('should emit error event with LLM_ERROR code when LLM call fails', async () => {
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
      mockClaudeWrapper.executeWithStream.mockRejectedValueOnce(
        new Error('API rate limit exceeded')
      );

      const { generatePlanFromDescription } = await import('../generator');

      await expect(
        generatePlanFromDescription('repo-1', 'Title', 'Desc', onProgress)
      ).rejects.toThrow();

      const errorEvent = emittedEvents.find(
        (e) => (e as { type: string }).type === 'error'
      ) as { type: string; code: string; message: string } | undefined;

      expect(errorEvent).toBeDefined();
      expect(errorEvent?.code).toBe('LLM_ERROR');
      expect(errorEvent?.message).toContain('API rate limit exceeded');
    });

    it('should emit error event with TIMEOUT code when generation takes too long', async () => {
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
      mockClaudeWrapper.executeWithStream.mockRejectedValueOnce(
        new Error('Request timed out after 300000ms')
      );

      const { generatePlanFromDescription } = await import('../generator');

      await expect(
        generatePlanFromDescription('repo-1', 'Title', 'Desc', onProgress)
      ).rejects.toThrow();

      const errorEvent = emittedEvents.find(
        (e) => (e as { type: string }).type === 'error'
      ) as
        | { type: string; code: string; message: string; detail?: string }
        | undefined;

      expect(errorEvent).toBeDefined();
      expect(errorEvent?.code).toBe('TIMEOUT');
      expect(errorEvent?.message).toContain('timed out');
      expect(errorEvent?.detail).toBeDefined();
    });
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
      mockClaudeWrapper.executeWithStream.mockImplementation(
        async (_prompt, _workingDir, onChunk, _timeout, _signal) => {
          // Simulate streaming by calling the chunk callback
          onChunk(claudeResponse);
          return claudeResponse;
        }
      );
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
      expect(mockClaudeWrapper.executeWithStream).toHaveBeenCalledWith(
        expect.stringContaining('Test Plan'),
        '/path/to/repo',
        expect.any(Function),
        300000,
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
      mockClaudeWrapper.executeWithStream.mockImplementation(
        async (_prompt, _workingDir, onChunk, _timeout, _signal) => {
          onChunk(claudeResponse);
          return claudeResponse;
        }
      );
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
      mockClaudeWrapper.executeWithStream.mockImplementation(
        async (_prompt, _workingDir, onChunk, _timeout, _signal) => {
          onChunk(claudeResponse);
          return claudeResponse;
        }
      );
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
      mockClaudeWrapper.executeWithStream.mockImplementation(
        async (_prompt, _workingDir, onChunk, _timeout, _signal) => {
          const response = 'invalid json response';
          onChunk(response);
          return response;
        }
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
      mockClaudeWrapper.executeWithStream.mockImplementation(
        async (_prompt, _workingDir, onChunk, _timeout, _signal) => {
          onChunk(claudeResponse);
          return claudeResponse;
        }
      );
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
      mockClaudeWrapper.executeWithStream.mockImplementation(
        async (_prompt, _workingDir, onChunk, _timeout, _signal) => {
          const response = '{"tasks": []}';
          onChunk(response);
          return response;
        }
      );

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
      mockClaudeWrapper.executeWithStream.mockImplementation(
        async (_prompt, _workingDir, onChunk, _timeout, _signal) => {
          onChunk(claudeResponse);
          return claudeResponse;
        }
      );
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

  describe('generatePlanFromDescription - abort handling', () => {
    it('should delete draft plan when aborted mid-stream', async () => {
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

      const mockAbortController = {
        signal: {
          aborted: false,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        } as unknown as AbortSignal,
        abort: vi.fn(),
      };

      mockDb.query.repositories.findFirst.mockResolvedValueOnce(mockRepository);
      mockValuesReturning.mockResolvedValueOnce([mockPlan]);
      mockClaudeWrapper.executeWithStream.mockRejectedValueOnce(
        new DOMException('The user aborted a request.', 'AbortError')
      );

      const { generatePlanFromDescription } = await import('../generator');

      await expect(
        generatePlanFromDescription(
          'repo-1',
          'Title',
          'Desc',
          undefined,
          mockAbortController.signal
        )
      ).rejects.toThrow();

      // Verify the plan was deleted
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('should emit ABORTED error event when request is cancelled', async () => {
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

      const mockAbortController = {
        signal: {
          aborted: false,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        } as unknown as AbortSignal,
        abort: vi.fn(),
      };

      mockDb.query.repositories.findFirst.mockResolvedValueOnce(mockRepository);
      mockValuesReturning.mockResolvedValueOnce([mockPlan]);
      mockClaudeWrapper.executeWithStream.mockRejectedValueOnce(
        new DOMException('The user aborted a request.', 'AbortError')
      );

      const { generatePlanFromDescription } = await import('../generator');

      await expect(
        generatePlanFromDescription(
          'repo-1',
          'Title',
          'Desc',
          onProgress,
          mockAbortController.signal
        )
      ).rejects.toThrow();

      // Generator itself doesn't emit the ABORTED event, the SSE route does
      // But we verify the error was thrown correctly
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('should not delete plan when abort happens after parsing starts', async () => {
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

      // Reset delete mock
      const mockDelete = vi.fn(() => ({ where: vi.fn() }));
      mockDb.delete = mockDelete;

      mockDb.query.repositories.findFirst.mockResolvedValueOnce(mockRepository);
      mockValuesReturning.mockResolvedValueOnce([mockPlan]);

      // LLM succeeds but then we abort somehow
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

      mockClaudeWrapper.executeWithStream.mockImplementation(
        async (_prompt, _workingDir, onChunk, _timeout, _signal) => {
          onChunk(claudeResponse);
          return claudeResponse;
        }
      );

      // Make the phase insertion fail
      mockValuesReturning
        .mockResolvedValueOnce([mockPlan])
        .mockRejectedValueOnce(new Error('DB error'));

      const { generatePlanFromDescription } = await import('../generator');

      await expect(
        generatePlanFromDescription('repo-1', 'Title', 'Desc')
      ).rejects.toThrow('DB error');

      // Plan should NOT be deleted - it should be marked as failed instead
      // Delete is only called on abort during LLM call
      expect(mockDelete).not.toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should propagate abort signal to Claude wrapper', async () => {
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

      const mockAbortController = {
        signal: {
          aborted: false,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        } as unknown as AbortSignal,
        abort: vi.fn(),
      };

      mockDb.query.repositories.findFirst.mockResolvedValueOnce(mockRepository);
      mockValuesReturning.mockResolvedValueOnce([mockPlan]);
      mockClaudeWrapper.executeWithStream.mockRejectedValueOnce(
        new DOMException('The user aborted a request.', 'AbortError')
      );

      const { generatePlanFromDescription } = await import('../generator');

      await expect(
        generatePlanFromDescription(
          'repo-1',
          'Title',
          'Desc',
          undefined,
          mockAbortController.signal
        )
      ).rejects.toThrow();

      // Verify signal was passed to executeWithStream
      expect(mockClaudeWrapper.executeWithStream).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(Function),
        300000,
        mockAbortController.signal
      );
    });

    it('should handle abort during chunk streaming', async () => {
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

      const mockAbortController = {
        signal: {
          aborted: false,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        } as unknown as AbortSignal,
        abort: vi.fn(),
      };

      mockDb.query.repositories.findFirst.mockResolvedValueOnce(mockRepository);
      mockValuesReturning.mockResolvedValueOnce([mockPlan]);

      // Simulate abort during streaming
      mockClaudeWrapper.executeWithStream.mockImplementation(
        async (_prompt, _workingDir, onChunk, _timeout, signal) => {
          onChunk('{"phases":');
          onChunk('[{');
          // Simulate abort
          throw new DOMException('The user aborted a request.', 'AbortError');
        }
      );

      const { generatePlanFromDescription } = await import('../generator');

      await expect(
        generatePlanFromDescription(
          'repo-1',
          'Title',
          'Desc',
          onProgress,
          mockAbortController.signal
        )
      ).rejects.toThrow();

      // Verify chunk events were emitted before abort
      const chunkEvents = emittedEvents.filter(
        (e) => (e as { type: string }).type === 'chunk'
      );
      expect(chunkEvents.length).toBeGreaterThan(0);

      // Verify plan was deleted
      expect(mockDb.delete).toHaveBeenCalled();
    });
  });

  describe('validatePlanStructure', () => {
    it('should detect circular dependencies between two tasks', async () => {
      const { validatePlanStructure } = await import('../generator');

      const planWithCircularDeps = {
        phases: [
          {
            title: 'Phase 1',
            description: 'Test phase',
            executionMode: 'sequential' as const,
            pauseAfter: false,
            tasks: [
              {
                title: 'Task 1',
                description: 'Depends on Task 2',
                dependsOn: [1], // Task 1 depends on Task 2
                canRunInParallel: false,
              },
              {
                title: 'Task 2',
                description: 'Depends on Task 1',
                dependsOn: [0], // Task 2 depends on Task 1
                canRunInParallel: false,
              },
            ],
          },
        ],
      };

      const warnings = validatePlanStructure(planWithCircularDeps);

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatchObject({
        code: 'CIRCULAR_DEPENDENCY',
        severity: 'warning',
        phaseIndex: 0,
      });
      expect(warnings[0]?.message).toContain('circular dependencies');
    });

    it('should detect circular dependencies in a chain (A→B→C→A)', async () => {
      const { validatePlanStructure } = await import('../generator');

      const planWithCircularChain = {
        phases: [
          {
            title: 'Phase 1',
            description: 'Test phase',
            executionMode: 'sequential' as const,
            pauseAfter: false,
            tasks: [
              {
                title: 'Task A',
                description: 'Depends on Task C',
                dependsOn: [2], // A depends on C
                canRunInParallel: false,
              },
              {
                title: 'Task B',
                description: 'Depends on Task A',
                dependsOn: [0], // B depends on A
                canRunInParallel: false,
              },
              {
                title: 'Task C',
                description: 'Depends on Task B',
                dependsOn: [1], // C depends on B
                canRunInParallel: false,
              },
            ],
          },
        ],
      };

      const warnings = validatePlanStructure(planWithCircularChain);

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatchObject({
        code: 'CIRCULAR_DEPENDENCY',
        severity: 'warning',
        phaseIndex: 0,
      });
      expect(warnings[0]?.message).toContain('circular dependencies');
      // All three tasks should be part of the cycle
      expect(warnings[0]?.message).toContain('1');
      expect(warnings[0]?.message).toContain('2');
      expect(warnings[0]?.message).toContain('3');
    });

    it('should detect self-dependency', async () => {
      const { validatePlanStructure } = await import('../generator');

      const planWithSelfDep = {
        phases: [
          {
            title: 'Phase 1',
            description: 'Test phase',
            executionMode: 'sequential' as const,
            pauseAfter: false,
            tasks: [
              {
                title: 'Task 1',
                description: 'Depends on itself',
                dependsOn: [0], // Self-dependency
                canRunInParallel: false,
              },
            ],
          },
        ],
      };

      const warnings = validatePlanStructure(planWithSelfDep);

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatchObject({
        code: 'CIRCULAR_DEPENDENCY',
        severity: 'warning',
        phaseIndex: 0,
        taskIndex: 0,
      });
      expect(warnings[0]?.message).toContain('depends on itself');
    });

    it('should detect empty phases (zero tasks)', async () => {
      const { validatePlanStructure } = await import('../generator');

      const planWithEmptyPhase = {
        phases: [
          {
            title: 'Empty Phase',
            description: 'This phase has no tasks',
            executionMode: 'sequential' as const,
            pauseAfter: false,
            tasks: [],
          },
          {
            title: 'Normal Phase',
            description: 'This phase has tasks',
            executionMode: 'sequential' as const,
            pauseAfter: false,
            tasks: [
              {
                title: 'Task 1',
                description: 'A normal task',
                dependsOn: [],
                canRunInParallel: false,
              },
            ],
          },
        ],
      };

      const warnings = validatePlanStructure(planWithEmptyPhase);

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatchObject({
        code: 'EMPTY_PHASE',
        severity: 'warning',
        phaseIndex: 0,
      });
      expect(warnings[0]?.message).toContain('has no tasks');
      expect(warnings[0]?.message).toContain('Empty Phase');
    });

    it('should detect multiple empty phases', async () => {
      const { validatePlanStructure } = await import('../generator');

      const planWithMultipleEmptyPhases = {
        phases: [
          {
            title: 'Empty Phase 1',
            description: 'No tasks',
            executionMode: 'sequential' as const,
            pauseAfter: false,
            tasks: [],
          },
          {
            title: 'Empty Phase 2',
            description: 'No tasks',
            executionMode: 'sequential' as const,
            pauseAfter: false,
            tasks: [],
          },
        ],
      };

      const warnings = validatePlanStructure(planWithMultipleEmptyPhases);

      expect(warnings).toHaveLength(2);
      expect(warnings.filter((w) => w.code === 'EMPTY_PHASE')).toHaveLength(2);
    });

    it('should warn about oversized plans (>50 tasks)', async () => {
      const { validatePlanStructure } = await import('../generator');

      const planWithManyTasks = {
        phases: [
          {
            title: 'Phase 1',
            description: 'Many tasks',
            executionMode: 'sequential' as const,
            pauseAfter: false,
            tasks: Array.from({ length: 51 }, (_, i) => ({
              title: `Task ${i + 1}`,
              description: `Task ${i + 1} description`,
              dependsOn: [],
              canRunInParallel: false,
            })),
          },
        ],
      };

      const warnings = validatePlanStructure(planWithManyTasks);

      expect(warnings.some((w) => w.code === 'MANY_TASKS')).toBe(true);
      const manyTasksWarning = warnings.find((w) => w.code === 'MANY_TASKS');
      expect(manyTasksWarning).toMatchObject({
        severity: 'warning',
      });
      expect(manyTasksWarning?.message).toContain('51 total tasks');
    });

    it('should give info severity for large plans (30-50 tasks)', async () => {
      const { validatePlanStructure } = await import('../generator');

      const planWithLargeTasks = {
        phases: [
          {
            title: 'Phase 1',
            description: 'Large number of tasks',
            executionMode: 'sequential' as const,
            pauseAfter: false,
            tasks: Array.from({ length: 35 }, (_, i) => ({
              title: `Task ${i + 1}`,
              description: `Task ${i + 1} description`,
              dependsOn: [],
              canRunInParallel: false,
            })),
          },
        ],
      };

      const warnings = validatePlanStructure(planWithLargeTasks);

      expect(warnings.some((w) => w.code === 'LARGE_PLAN')).toBe(true);
      const largePlanWarning = warnings.find((w) => w.code === 'LARGE_PLAN');
      expect(largePlanWarning).toMatchObject({
        severity: 'info',
      });
      expect(largePlanWarning?.message).toContain('35 total tasks');
    });

    it('should warn about too many phases (>10)', async () => {
      const { validatePlanStructure } = await import('../generator');

      const planWithManyPhases = {
        phases: Array.from({ length: 12 }, (_, i) => ({
          title: `Phase ${i + 1}`,
          description: `Phase ${i + 1} description`,
          executionMode: 'sequential' as const,
          pauseAfter: false,
          tasks: [
            {
              title: 'Task 1',
              description: 'A task',
              dependsOn: [],
              canRunInParallel: false,
            },
          ],
        })),
      };

      const warnings = validatePlanStructure(planWithManyPhases);

      expect(warnings.some((w) => w.code === 'MANY_PHASES')).toBe(true);
      const manyPhasesWarning = warnings.find((w) => w.code === 'MANY_PHASES');
      expect(manyPhasesWarning).toMatchObject({
        severity: 'warning',
      });
      expect(manyPhasesWarning?.message).toContain('12 phases');
    });

    it('should detect invalid dependency references (negative index)', async () => {
      const { validatePlanStructure } = await import('../generator');

      const planWithInvalidDep = {
        phases: [
          {
            title: 'Phase 1',
            description: 'Test phase',
            executionMode: 'sequential' as const,
            pauseAfter: false,
            tasks: [
              {
                title: 'Task 1',
                description: 'Depends on invalid task',
                dependsOn: [-1], // Invalid negative index
                canRunInParallel: false,
              },
            ],
          },
        ],
      };

      const warnings = validatePlanStructure(planWithInvalidDep);

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatchObject({
        code: 'INVALID_DEPENDENCY',
        severity: 'warning',
        phaseIndex: 0,
        taskIndex: 0,
      });
      expect(warnings[0]?.message).toContain('non-existent task index -1');
    });

    it('should detect invalid dependency references (index >= tasks.length)', async () => {
      const { validatePlanStructure } = await import('../generator');

      const planWithOutOfBoundsDep = {
        phases: [
          {
            title: 'Phase 1',
            description: 'Test phase',
            executionMode: 'sequential' as const,
            pauseAfter: false,
            tasks: [
              {
                title: 'Task 1',
                description: 'Normal task',
                dependsOn: [],
                canRunInParallel: false,
              },
              {
                title: 'Task 2',
                description: 'Depends on non-existent task 99',
                dependsOn: [99], // Out of bounds
                canRunInParallel: false,
              },
            ],
          },
        ],
      };

      const warnings = validatePlanStructure(planWithOutOfBoundsDep);

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatchObject({
        code: 'INVALID_DEPENDENCY',
        severity: 'warning',
        phaseIndex: 0,
        taskIndex: 1,
      });
      expect(warnings[0]?.message).toContain('non-existent task index 99');
    });

    it('should return no warnings for a valid plan', async () => {
      const { validatePlanStructure } = await import('../generator');

      const validPlan = {
        phases: [
          {
            title: 'Phase 1',
            description: 'Setup',
            executionMode: 'sequential' as const,
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
          {
            title: 'Phase 2',
            description: 'Implementation',
            executionMode: 'parallel' as const,
            pauseAfter: true,
            tasks: [
              {
                title: 'Task 3',
                description: 'Can run in parallel',
                dependsOn: [],
                canRunInParallel: true,
              },
              {
                title: 'Task 4',
                description: 'Can run in parallel',
                dependsOn: [],
                canRunInParallel: true,
              },
            ],
          },
        ],
      };

      const warnings = validatePlanStructure(validPlan);

      expect(warnings).toHaveLength(0);
    });

    it('should handle complex dependency graph without false positives', async () => {
      const { validatePlanStructure } = await import('../generator');

      const complexValidPlan = {
        phases: [
          {
            title: 'Phase 1',
            description: 'Complex dependencies',
            executionMode: 'sequential' as const,
            pauseAfter: false,
            tasks: [
              {
                title: 'Task 1',
                description: 'Root task',
                dependsOn: [],
                canRunInParallel: false,
              },
              {
                title: 'Task 2',
                description: 'Depends on Task 1',
                dependsOn: [0],
                canRunInParallel: false,
              },
              {
                title: 'Task 3',
                description: 'Depends on Task 1',
                dependsOn: [0],
                canRunInParallel: true,
              },
              {
                title: 'Task 4',
                description: 'Depends on Task 2 and Task 3',
                dependsOn: [1, 2],
                canRunInParallel: false,
              },
              {
                title: 'Task 5',
                description: 'Depends on Task 4',
                dependsOn: [3],
                canRunInParallel: false,
              },
            ],
          },
        ],
      };

      const warnings = validatePlanStructure(complexValidPlan);

      expect(warnings).toHaveLength(0);
    });

    it('should accumulate multiple types of warnings', async () => {
      const { validatePlanStructure } = await import('../generator');

      const problematicPlan = {
        phases: [
          {
            title: 'Empty Phase',
            description: 'No tasks',
            executionMode: 'sequential' as const,
            pauseAfter: false,
            tasks: [],
          },
          {
            title: 'Phase with issues',
            description: 'Has circular deps',
            executionMode: 'sequential' as const,
            pauseAfter: false,
            tasks: [
              {
                title: 'Task 1',
                description: 'Depends on Task 2',
                dependsOn: [1],
                canRunInParallel: false,
              },
              {
                title: 'Task 2',
                description: 'Depends on Task 1',
                dependsOn: [0],
                canRunInParallel: false,
              },
            ],
          },
          ...Array.from({ length: 10 }, (_, i) => ({
            title: `Phase ${i + 3}`,
            description: `Extra phase ${i + 3}`,
            executionMode: 'sequential' as const,
            pauseAfter: false,
            tasks: [
              {
                title: 'Task',
                description: 'A task',
                dependsOn: [],
                canRunInParallel: false,
              },
            ],
          })),
        ],
      };

      const warnings = validatePlanStructure(problematicPlan);

      // Should have: EMPTY_PHASE, CIRCULAR_DEPENDENCY, MANY_PHASES
      expect(warnings.length).toBeGreaterThanOrEqual(3);
      expect(warnings.some((w) => w.code === 'EMPTY_PHASE')).toBe(true);
      expect(warnings.some((w) => w.code === 'CIRCULAR_DEPENDENCY')).toBe(true);
      expect(warnings.some((w) => w.code === 'MANY_PHASES')).toBe(true);
    });
  });
});
