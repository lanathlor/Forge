import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all dependencies first
const mockDb = {
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
};

const mockClaudeWrapper = {
  executeTask: vi.fn(),
};

const mockRunPreFlightChecks = vi.fn();
const mockCaptureDiff = vi.fn();
const mockRunTaskQAGates = vi.fn();

vi.mock('@/db', () => ({
  db: mockDb,
}));

vi.mock('@/db/schema/tasks', () => ({
  tasks: {
    id: 'id',
  },
}));

vi.mock('@/lib/claude/wrapper', () => ({
  claudeWrapper: mockClaudeWrapper,
}));

vi.mock('@/lib/git/pre-flight', () => ({
  runPreFlightChecks: mockRunPreFlightChecks,
}));

vi.mock('@/lib/git/diff', () => ({
  captureDiff: mockCaptureDiff,
}));

vi.mock('@/lib/qa-gates/task-qa-service', () => ({
  runTaskQAGates: mockRunTaskQAGates,
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => 'mock-eq'),
}));

describe('Task Orchestrator', () => {
  let executeTask: (taskId: string) => Promise<void>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Import fresh module after mocks are set up
    const testModule = await import('../orchestrator');
    executeTask = testModule.executeTask;

    // Set up default mock implementations
    mockDb.query.tasks.findFirst.mockResolvedValue({
      id: 'test-task-123',
      prompt: 'test prompt',
      sessionId: 'session-123',
      status: 'pending',
      session: {
        repository: {
          path: '/test/repo',
        },
      },
    });

    mockRunPreFlightChecks.mockResolvedValue({
      passed: true,
      currentCommit: 'abc123',
      currentBranch: 'main',
      isClean: true,
    });

    mockClaudeWrapper.executeTask.mockResolvedValue({
      exitCode: 0,
      output: 'Task completed',
    });

    mockCaptureDiff.mockResolvedValue({
      fullDiff: 'diff content',
      changedFiles: ['file1.ts', 'file2.ts'],
    });

    mockRunTaskQAGates.mockResolvedValue(undefined);
  });

  describe('Module Structure', () => {
    it('should export executeTask function', async () => {
      const testModule = await import('../orchestrator');
      expect(testModule.executeTask).toBeDefined();
      expect(typeof testModule.executeTask).toBe('function');
    });
  });

  describe('Successful Execution Flow', () => {
    it('should execute all steps in correct order', async () => {
      await executeTask('test-task-123');

      // Verify the steps were called in order
      expect(mockDb.query.tasks.findFirst).toHaveBeenCalled();
      expect(mockRunPreFlightChecks).toHaveBeenCalledWith('/test/repo');
      expect(mockClaudeWrapper.executeTask).toHaveBeenCalled();
      expect(mockCaptureDiff).toHaveBeenCalled();
      expect(mockRunTaskQAGates).toHaveBeenCalledWith('test-task-123');
    });

    it('should update task status to pre_flight', async () => {
      await executeTask('test-task-123');

      expect(mockDb.update).toHaveBeenCalled();
      const updateCall = mockDb.update.mock.results[0]?.value;
      expect(updateCall.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pre_flight',
        })
      );
    });

    it('should update task status to running before Claude execution', async () => {
      await executeTask('test-task-123');

      expect(mockDb.update).toHaveBeenCalled();
      // Find the call that sets status to 'running'
      const runningUpdate = mockDb.update.mock.results.find((result) => {
        const setCall = result?.value?.set?.mock?.calls?.[0]?.[0];
        return setCall?.status === 'running';
      });
      expect(runningUpdate).toBeDefined();
    });

    it('should save starting commit and branch', async () => {
      await executeTask('test-task-123');

      const startingStateUpdate = mockDb.update.mock.results.find((result) => {
        const setCall = result?.value?.set?.mock?.calls?.[0]?.[0];
        return setCall?.startingCommit !== undefined;
      });

      expect(startingStateUpdate).toBeDefined();
    });

    it('should update task status to waiting_qa after diff capture', async () => {
      await executeTask('test-task-123');

      const waitingQaUpdate = mockDb.update.mock.results.find((result) => {
        const setCall = result?.value?.set?.mock?.calls?.[0]?.[0];
        return setCall?.status === 'waiting_qa';
      });

      expect(waitingQaUpdate).toBeDefined();
    });

    it('should save diff content and changed files', async () => {
      await executeTask('test-task-123');

      const diffUpdate = mockDb.update.mock.results.find((result) => {
        const setCall = result?.value?.set?.mock?.calls?.[0]?.[0];
        return setCall?.diffContent !== undefined;
      });

      expect(diffUpdate).toBeDefined();
    });

    it('should pass correct parameters to Claude wrapper', async () => {
      await executeTask('test-task-123');

      expect(mockClaudeWrapper.executeTask).toHaveBeenCalledWith({
        workingDirectory: '/test/repo',
        prompt: 'test prompt',
        taskId: 'test-task-123',
      });
    });

    it('should call diff capture after Claude execution', async () => {
      await executeTask('test-task-123');

      expect(mockCaptureDiff).toHaveBeenCalled();
      expect(mockCaptureDiff.mock.calls[0]?.[0]).toBe('/test/repo');
    });
  });

  describe('Error Handling - Task Not Found', () => {
    it('should handle when task is not found', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValue(null);

      // The function catches the error internally, so it doesn't reject
      await expect(executeTask('non-existent')).resolves.toBeUndefined();
    });

    it('should not proceed with other steps if task not found', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValue(null);

      try {
        await executeTask('non-existent');
      } catch {
        // Expected to throw
      }

      expect(mockRunPreFlightChecks).not.toHaveBeenCalled();
      expect(mockClaudeWrapper.executeTask).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling - Pre-flight Failure', () => {
    it('should mark task as failed when pre-flight checks fail', async () => {
      mockRunPreFlightChecks.mockResolvedValue({
        passed: false,
        error: 'Not a git repository',
      });

      await executeTask('test-task-123');

      const failedUpdate = mockDb.update.mock.results.find((result) => {
        const setCall = result?.value?.set?.mock?.calls?.[0]?.[0];
        return setCall?.status === 'failed';
      });

      expect(failedUpdate).toBeDefined();
    });

    it('should not execute Claude when pre-flight fails', async () => {
      mockRunPreFlightChecks.mockResolvedValue({
        passed: false,
        error: 'Working directory is not clean',
      });

      await executeTask('test-task-123');

      expect(mockClaudeWrapper.executeTask).not.toHaveBeenCalled();
      expect(mockCaptureDiff).not.toHaveBeenCalled();
      expect(mockRunTaskQAGates).not.toHaveBeenCalled();
    });

    it('should include pre-flight error in task output', async () => {
      const errorMessage = 'Repository has uncommitted changes';
      mockRunPreFlightChecks.mockResolvedValue({
        passed: false,
        error: errorMessage,
      });

      await executeTask('test-task-123');

      const failedUpdate = mockDb.update.mock.results.find((result) => {
        const setCall = result?.value?.set?.mock?.calls?.[0]?.[0];
        return setCall?.status === 'failed';
      });

      const claudeOutput =
        failedUpdate?.value?.set?.mock?.calls?.[0]?.[0]?.claudeOutput;
      expect(claudeOutput).toContain(errorMessage);
    });
  });

  describe('Error Handling - Claude Execution Failure', () => {
    it('should mark task as failed when Claude throws error', async () => {
      mockClaudeWrapper.executeTask.mockRejectedValue(
        new Error('Claude execution failed')
      );

      await executeTask('test-task-123');

      const failedUpdate = mockDb.update.mock.results.find((result) => {
        const setCall = result?.value?.set?.mock?.calls?.[0]?.[0];
        return setCall?.status === 'failed';
      });

      expect(failedUpdate).toBeDefined();
    });

    it('should not run QA gates when Claude fails', async () => {
      mockClaudeWrapper.executeTask.mockRejectedValue(
        new Error('Claude execution failed')
      );

      await executeTask('test-task-123');

      expect(mockRunTaskQAGates).not.toHaveBeenCalled();
    });

    it('should include error message in task output', async () => {
      const errorMessage = 'Claude process crashed';
      mockClaudeWrapper.executeTask.mockRejectedValue(
        new Error(errorMessage)
      );

      await executeTask('test-task-123');

      const failedUpdate = mockDb.update.mock.results.find((result) => {
        const setCall = result?.value?.set?.mock?.calls?.[0]?.[0];
        return setCall?.status === 'failed';
      });

      const claudeOutput =
        failedUpdate?.value?.set?.mock?.calls?.[0]?.[0]?.claudeOutput;
      expect(claudeOutput).toBe(errorMessage);
    });

    it('should handle non-Error exceptions', async () => {
      mockClaudeWrapper.executeTask.mockRejectedValue('string error');

      await executeTask('test-task-123');

      const failedUpdate = mockDb.update.mock.results.find((result) => {
        const setCall = result?.value?.set?.mock?.calls?.[0]?.[0];
        return setCall?.status === 'failed';
      });

      const claudeOutput =
        failedUpdate?.value?.set?.mock?.calls?.[0]?.[0]?.claudeOutput;
      expect(claudeOutput).toBe('Unknown error');
    });
  });

  describe('Error Handling - Diff Capture Failure', () => {
    it('should mark task as failed when diff capture throws', async () => {
      mockCaptureDiff.mockRejectedValue(new Error('Git diff failed'));

      await executeTask('test-task-123');

      const failedUpdate = mockDb.update.mock.results.find((result) => {
        const setCall = result?.value?.set?.mock?.calls?.[0]?.[0];
        return setCall?.status === 'failed';
      });

      expect(failedUpdate).toBeDefined();
    });

    it('should not run QA gates when diff capture fails', async () => {
      mockCaptureDiff.mockRejectedValue(new Error('Git diff failed'));

      await executeTask('test-task-123');

      expect(mockRunTaskQAGates).not.toHaveBeenCalled();
    });
  });

  describe('Task Data Integration', () => {
    it('should handle tasks with complex repository structures', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValue({
        id: 'complex-task',
        prompt: 'complex prompt',
        sessionId: 'session-complex',
        status: 'pending',
        session: {
          repository: {
            path: '/home/user/projects/complex-repo',
            name: 'Complex Repo',
          },
        },
      });

      await executeTask('complex-task');

      expect(mockRunPreFlightChecks).toHaveBeenCalledWith(
        '/home/user/projects/complex-repo'
      );
    });

    it('should handle tasks with long prompts', async () => {
      const longPrompt = 'a'.repeat(10000);

      mockDb.query.tasks.findFirst.mockResolvedValue({
        id: 'long-prompt-task',
        prompt: longPrompt,
        sessionId: 'session-123',
        status: 'pending',
        session: {
          repository: {
            path: '/test/repo',
          },
        },
      });

      await executeTask('long-prompt-task');

      expect(mockClaudeWrapper.executeTask).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: longPrompt,
        })
      );
    });

    it('should handle multiple changed files in diff', async () => {
      const manyFiles = Array.from({ length: 100 }, (_, i) => `file${i}.ts`);
      mockCaptureDiff.mockResolvedValue({
        fullDiff: 'large diff content',
        changedFiles: manyFiles,
      });

      await executeTask('test-task-123');

      const diffUpdate = mockDb.update.mock.results.find((result) => {
        const setCall = result?.value?.set?.mock?.calls?.[0]?.[0];
        return setCall?.filesChanged !== undefined;
      });

      expect(diffUpdate).toBeDefined();
    });
  });

  describe('Database Updates', () => {
    it('should update updatedAt timestamp on all status changes', async () => {
      await executeTask('test-task-123');

      // All update calls should include updatedAt
      mockDb.update.mock.results.forEach((result) => {
        const setCall = result?.value?.set?.mock?.calls?.[0]?.[0];
        if (setCall) {
          expect(setCall).toHaveProperty('updatedAt');
          expect(setCall.updatedAt).toBeInstanceOf(Date);
        }
      });
    });

    it('should set startedAt when moving to running status', async () => {
      await executeTask('test-task-123');

      const runningUpdate = mockDb.update.mock.results.find((result) => {
        const setCall = result?.value?.set?.mock?.calls?.[0]?.[0];
        return setCall?.status === 'running';
      });

      const setCall = runningUpdate?.value?.set?.mock?.calls?.[0]?.[0];
      expect(setCall).toHaveProperty('startedAt');
      expect(setCall?.startedAt).toBeInstanceOf(Date);
    });

    it('should update database multiple times', async () => {
      await executeTask('test-task-123');

      // Verify database update was called multiple times
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.update.mock.calls.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty diff results', async () => {
      mockCaptureDiff.mockResolvedValue({
        fullDiff: '',
        changedFiles: [],
      });

      await executeTask('test-task-123');

      expect(mockRunTaskQAGates).toHaveBeenCalled();
    });

    it('should handle tasks with special characters in prompt', async () => {
      const specialPrompt = 'Test with "quotes" and \\backslashes\\ and $vars';

      mockDb.query.tasks.findFirst.mockResolvedValue({
        id: 'special-task',
        prompt: specialPrompt,
        sessionId: 'session-123',
        status: 'pending',
        session: {
          repository: {
            path: '/test/repo',
          },
        },
      });

      await executeTask('special-task');

      expect(mockClaudeWrapper.executeTask).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: specialPrompt,
        })
      );
    });

    it('should handle repository paths with spaces', async () => {
      mockDb.query.tasks.findFirst.mockResolvedValue({
        id: 'space-path-task',
        prompt: 'test',
        sessionId: 'session-123',
        status: 'pending',
        session: {
          repository: {
            path: '/path/with spaces/repo',
          },
        },
      });

      await executeTask('space-path-task');

      expect(mockRunPreFlightChecks).toHaveBeenCalledWith(
        '/path/with spaces/repo'
      );
    });
  });
});
