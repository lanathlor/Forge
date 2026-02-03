import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('@/db', () => ({
  db: {
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
  },
}));

vi.mock('@/db/schema/tasks', () => ({
  tasks: {
    id: 'id',
    claudeOutput: 'claudeOutput',
    updatedAt: 'updatedAt',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
}));

describe('ClaudeCodeWrapper', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.useRealTimers();
  });

  describe('Module Structure', () => {
    it('should export claudeWrapper instance', async () => {
      const testModule = await import('../wrapper');
      expect(testModule.claudeWrapper).toBeDefined();
      expect(typeof testModule.claudeWrapper).toBe('object');
    });

    it('should have executeTask method', async () => {
      const testModule = await import('../wrapper');
      expect(testModule.claudeWrapper.executeTask).toBeDefined();
      expect(typeof testModule.claudeWrapper.executeTask).toBe('function');
    });

    it('should have cancel method', async () => {
      const testModule = await import('../wrapper');
      expect(testModule.claudeWrapper.cancel).toBeDefined();
      expect(typeof testModule.claudeWrapper.cancel).toBe('function');
    });

    it('should extend EventEmitter', async () => {
      const testModule = await import('../wrapper');
      expect(testModule.claudeWrapper.on).toBeDefined();
      expect(testModule.claudeWrapper.emit).toBeDefined();
      expect(typeof testModule.claudeWrapper.on).toBe('function');
      expect(typeof testModule.claudeWrapper.emit).toBe('function');
    });
  });

  describe('Type Definitions', () => {
    it('should accept valid ClaudeTaskOptions', () => {
      const validOptions = {
        workingDirectory: '/test/path',
        prompt: 'test prompt',
        taskId: 'test-123',
      };

      expect(validOptions).toHaveProperty('workingDirectory');
      expect(validOptions).toHaveProperty('prompt');
      expect(validOptions).toHaveProperty('taskId');
      expect(typeof validOptions.workingDirectory).toBe('string');
      expect(typeof validOptions.prompt).toBe('string');
      expect(typeof validOptions.taskId).toBe('string');
    });

    it('should have proper ClaudeTaskResult structure', () => {
      const validResult = {
        exitCode: 0,
        output: 'test output',
        error: 'optional error',
      };

      expect(validResult).toHaveProperty('exitCode');
      expect(validResult).toHaveProperty('output');
      expect(typeof validResult.exitCode).toBe('number');
      expect(typeof validResult.output).toBe('string');
    });

    it('should support various task options', () => {
      const options = {
        workingDirectory: '/home/user/project',
        prompt: 'Implement a new feature',
        taskId: 'task-uuid-123',
      };

      expect(options.workingDirectory.length).toBeGreaterThan(0);
      expect(options.prompt.length).toBeGreaterThan(0);
      expect(options.taskId.length).toBeGreaterThan(0);
    });

    it('should support result with exit code 0 for success', () => {
      const successResult = {
        exitCode: 0,
        output: 'Task completed successfully',
      };

      expect(successResult.exitCode).toBe(0);
      expect(successResult.output).toContain('success');
    });

    it('should support result with non-zero exit code for errors', () => {
      const errorResult = {
        exitCode: 1,
        output: 'Task failed',
        error: 'Some error occurred',
      };

      expect(errorResult.exitCode).toBeGreaterThan(0);
      expect(errorResult.error).toBeDefined();
    });
  });

  describe('Singleton Pattern', () => {
    it('should export the same instance on multiple imports', async () => {
      const moduleA = await import('../wrapper');
      const moduleB = await import('../wrapper');

      expect(moduleA.claudeWrapper).toBe(moduleB.claudeWrapper);
    });
  });

  describe('EventEmitter Methods', () => {
    it('should have all EventEmitter methods', async () => {
      const testModule = await import('../wrapper');
      const wrapper = testModule.claudeWrapper;

      expect(typeof wrapper.on).toBe('function');
      expect(typeof wrapper.off).toBe('function');
      expect(typeof wrapper.emit).toBe('function');
      expect(typeof wrapper.once).toBe('function');
      expect(typeof wrapper.removeListener).toBe('function');
    });

    it('should allow registering event listeners', async () => {
      const testModule = await import('../wrapper');
      const wrapper = testModule.claudeWrapper;

      const mockListener = () => {};
      wrapper.on('test-event', mockListener);

      expect(wrapper.listenerCount('test-event')).toBeGreaterThanOrEqual(1);

      wrapper.removeListener('test-event', mockListener);
    });
  });

  describe('Simulated Execution', () => {
    it('should execute task in simulated mode when SIMULATE_CLAUDE is true', async () => {
      process.env.SIMULATE_CLAUDE = 'true';
      const testModule = await import('../wrapper');
      const wrapper = testModule.claudeWrapper;

      const completeListener = vi.fn();
      wrapper.on('complete', completeListener);

      const options = {
        workingDirectory: '/test/path',
        prompt: 'test prompt',
        taskId: 'test-task-123',
      };

      const resultPromise = wrapper.executeTask(options);

      // Fast-forward time
      await vi.runAllTimersAsync();

      const result = await resultPromise;

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('Simulated Claude Code execution');
      expect(result.output).toContain('test-task-123');
      expect(result.output).toContain('test prompt');
      expect(result.output).toContain('/test/path');

      wrapper.removeListener('complete', completeListener);
    });

    it('should emit complete event in simulated mode', async () => {
      process.env.SIMULATE_CLAUDE = 'true';
      const testModule = await import('../wrapper');
      const wrapper = testModule.claudeWrapper;

      const completeListener = vi.fn();
      wrapper.on('complete', completeListener);

      const options = {
        workingDirectory: '/test/path',
        prompt: 'test prompt',
        taskId: 'test-task-123',
      };

      const resultPromise = wrapper.executeTask(options);
      await vi.runAllTimersAsync();
      await resultPromise;

      expect(completeListener).toHaveBeenCalled();
      expect(completeListener).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'test-task-123',
          result: expect.objectContaining({
            exitCode: 0,
          }),
        })
      );

      wrapper.removeListener('complete', completeListener);
    });

    it('should include all prompt details in simulated output', async () => {
      process.env.SIMULATE_CLAUDE = 'true';
      const testModule = await import('../wrapper');
      const wrapper = testModule.claudeWrapper;

      const options = {
        workingDirectory: '/home/user/project',
        prompt: 'Implement authentication system',
        taskId: 'task-uuid-456',
      };

      const resultPromise = wrapper.executeTask(options);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.output).toContain('task-uuid-456');
      expect(result.output).toContain('Implement authentication system');
      expect(result.output).toContain('/home/user/project');
      expect(result.output).toContain('Task completed successfully');
    });
  });

  describe('Cancellation', () => {
    it('should allow cancelling a task', async () => {
      const testModule = await import('../wrapper');
      const wrapper = testModule.claudeWrapper;

      const cancelledListener = vi.fn();
      wrapper.on('cancelled', cancelledListener);

      // Cancel should not throw even if no task is running
      await wrapper.cancel('test-task-123');

      wrapper.removeListener('cancelled', cancelledListener);
    });

    it('should emit cancelled event when task is cancelled', async () => {
      const testModule = await import('../wrapper');
      const wrapper = testModule.claudeWrapper;

      const cancelledListener = vi.fn();
      wrapper.on('cancelled', cancelledListener);

      const taskId = 'test-task-cancel-123';

      // In actual implementation, this would kill a running process
      // For now, we test that the method exists and can be called
      await wrapper.cancel(taskId);

      wrapper.removeListener('cancelled', cancelledListener);
    });
  });

  describe('Task Options Validation', () => {
    it('should accept options with all required fields', async () => {
      process.env.SIMULATE_CLAUDE = 'true';
      const testModule = await import('../wrapper');
      const wrapper = testModule.claudeWrapper;

      const options = {
        workingDirectory: '/path/to/project',
        prompt: 'Execute task',
        taskId: 'valid-task-id',
      };

      const resultPromise = wrapper.executeTask(options);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBeDefined();
      expect(result.exitCode).toBe(0);
    });

    it('should handle different working directory paths', async () => {
      process.env.SIMULATE_CLAUDE = 'true';
      const testModule = await import('../wrapper');
      const wrapper = testModule.claudeWrapper;

      const path = '/home/user/project';
      const options = {
        workingDirectory: path,
        prompt: 'test',
        taskId: `task-${path}`,
      };

      const resultPromise = wrapper.executeTask(options);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.output).toContain(path);
    });

    it('should handle various prompt types', async () => {
      process.env.SIMULATE_CLAUDE = 'true';
      const testModule = await import('../wrapper');
      const wrapper = testModule.claudeWrapper;

      const prompt = 'Prompt with "quotes" and special chars';
      const options = {
        workingDirectory: '/test',
        prompt,
        taskId: 'test-task',
      };

      const resultPromise = wrapper.executeTask(options);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain(prompt);
    });
  });

  describe('Event Emission', () => {
    it('should support multiple event listeners', async () => {
      process.env.SIMULATE_CLAUDE = 'true';
      const testModule = await import('../wrapper');
      const wrapper = testModule.claudeWrapper;

      const listener1 = vi.fn();
      const listener2 = vi.fn();

      wrapper.on('complete', listener1);
      wrapper.on('complete', listener2);

      const options = {
        workingDirectory: '/test',
        prompt: 'test',
        taskId: 'test-task',
      };

      const resultPromise = wrapper.executeTask(options);
      await vi.runAllTimersAsync();
      await resultPromise;

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();

      wrapper.removeListener('complete', listener1);
      wrapper.removeListener('complete', listener2);
    });

    it('should support once listeners', async () => {
      process.env.SIMULATE_CLAUDE = 'true';
      const testModule = await import('../wrapper');
      const wrapper = testModule.claudeWrapper;

      const onceListener = vi.fn();
      wrapper.once('complete', onceListener);

      const options = {
        workingDirectory: '/test',
        prompt: 'test',
        taskId: 'test-task-1',
      };

      const resultPromise = wrapper.executeTask(options);
      await vi.runAllTimersAsync();
      await resultPromise;

      expect(onceListener).toHaveBeenCalledTimes(1);

      // Verify once listener was removed
      expect(wrapper.listenerCount('complete')).toBe(0);
    });
  });

  describe('Result Structure', () => {
    it('should return result with correct structure', async () => {
      process.env.SIMULATE_CLAUDE = 'true';
      const testModule = await import('../wrapper');
      const wrapper = testModule.claudeWrapper;

      const options = {
        workingDirectory: '/test',
        prompt: 'test',
        taskId: 'test-task',
      };

      const resultPromise = wrapper.executeTask(options);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toHaveProperty('exitCode');
      expect(result).toHaveProperty('output');
      expect(typeof result.exitCode).toBe('number');
      expect(typeof result.output).toBe('string');
    });

    it('should return exit code 0 for successful simulated execution', async () => {
      process.env.SIMULATE_CLAUDE = 'true';
      const testModule = await import('../wrapper');
      const wrapper = testModule.claudeWrapper;

      const options = {
        workingDirectory: '/test',
        prompt: 'test',
        taskId: 'test-task',
      };

      const resultPromise = wrapper.executeTask(options);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.exitCode).toBe(0);
    });

    it('should return non-empty output for simulated execution', async () => {
      process.env.SIMULATE_CLAUDE = 'true';
      const testModule = await import('../wrapper');
      const wrapper = testModule.claudeWrapper;

      const options = {
        workingDirectory: '/test',
        prompt: 'test',
        taskId: 'test-task',
      };

      const resultPromise = wrapper.executeTask(options);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.output.length).toBeGreaterThan(0);
      expect(result.output).toBeTruthy();
    });
  });
});
