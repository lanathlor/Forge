import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FakeAIProvider } from '../providers/fake-provider';
import type { TaskExecutionOptions } from '../types';

describe('FakeAIProvider', () => {
  let provider: FakeAIProvider;

  beforeEach(() => {
    // Set up test environment
    process.env.FAKE_PROVIDER_DELAY_MS = '100';
    process.env.FAKE_PROVIDER_SIMULATE_ERRORS = 'false';
    process.env.FAKE_PROVIDER_ERROR_RATE = '0';

    provider = new FakeAIProvider();
  });

  describe('executeTask', () => {
    it('returns successful result with commit message prompt', async () => {
      const options: TaskExecutionOptions = {
        taskId: 'test-task-1',
        prompt: 'generate a commit message for these changes',
        workingDirectory: '/test/dir',
      };

      const result = await provider.executeTask(options);

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('feat(example):');
      expect(result.error).toBeUndefined();
    });

    it('returns code generation response for code prompts', async () => {
      const options: TaskExecutionOptions = {
        taskId: 'test-task-2',
        prompt: 'implement a function that adds two numbers',
        workingDirectory: '/test/dir',
      };

      const result = await provider.executeTask(options);

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('function');
      expect(result.output).toContain('javascript');
    });

    it('returns plan generation response for plan prompts', async () => {
      const options: TaskExecutionOptions = {
        taskId: 'test-task-3',
        prompt: 'create a plan for implementing user authentication',
        workingDirectory: '/test/dir',
      };

      const result = await provider.executeTask(options);

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('comprehensive plan');
      expect(result.output).toContain('Analyze requirements');
    });

    it('emits events during execution', async () => {
      const outputSpy = vi.fn();
      const completeSpy = vi.fn();

      provider.on('output', outputSpy);
      provider.on('complete', completeSpy);

      const options: TaskExecutionOptions = {
        taskId: 'test-task-4',
        prompt: 'test prompt',
        workingDirectory: '/test/dir',
      };

      await provider.executeTask(options);

      expect(outputSpy).toHaveBeenCalledWith({
        taskId: 'test-task-4',
        output: expect.any(String),
        timestamp: expect.any(Date),
      });

      expect(completeSpy).toHaveBeenCalledWith({
        taskId: 'test-task-4',
        result: expect.objectContaining({
          exitCode: 0,
          output: expect.any(String),
        }),
      });
    });

    it('simulates errors when configured', async () => {
      process.env.FAKE_PROVIDER_SIMULATE_ERRORS = 'true';
      process.env.FAKE_PROVIDER_ERROR_RATE = '1.0'; // Always error

      const errorProvider = new FakeAIProvider();
      const failedSpy = vi.fn();
      errorProvider.on('failed', failedSpy);

      const options: TaskExecutionOptions = {
        taskId: 'test-task-5',
        prompt: 'test prompt',
        workingDirectory: '/test/dir',
      };

      await expect(errorProvider.executeTask(options)).rejects.toThrow(
        'Simulated provider error for testing'
      );
      expect(failedSpy).toHaveBeenCalled();
    });
  });

  describe('executeWithStream', () => {
    it('streams output character by character', async () => {
      const chunks: string[] = [];
      const onChunk = (text: string) => chunks.push(text);

      const result = await provider.executeWithStream(
        'test streaming prompt',
        '/test/dir',
        onChunk
      );

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join('')).toBe(result + ' '); // Extra space from streaming
      expect(result.trim()).toBe(result);
    });

    it('handles errors in streaming mode', async () => {
      process.env.FAKE_PROVIDER_SIMULATE_ERRORS = 'true';
      process.env.FAKE_PROVIDER_ERROR_RATE = '1.0';

      const errorProvider = new FakeAIProvider();
      const onChunk = vi.fn();

      await expect(
        errorProvider.executeWithStream('test', '/test/dir', onChunk)
      ).rejects.toThrow('Simulated streaming error for testing');
    });
  });

  describe('executeOneShot', () => {
    it('returns response without streaming', async () => {
      const result = await provider.executeOneShot(
        'generate commit message',
        '/test/dir'
      );

      expect(result).toContain('feat(example):');
      expect(result).toContain('simulated commit message');
    });

    it('handles timeouts', async () => {
      const result = await provider.executeOneShot(
        'test prompt',
        '/test/dir',
        1000 // 1 second timeout
      );

      expect(result).toBeDefined();
    });

    it('handles errors in one-shot mode', async () => {
      process.env.FAKE_PROVIDER_SIMULATE_ERRORS = 'true';
      process.env.FAKE_PROVIDER_ERROR_RATE = '1.0';

      const errorProvider = new FakeAIProvider();

      await expect(
        errorProvider.executeOneShot('test', '/test/dir')
      ).rejects.toThrow('Simulated one-shot execution error for testing');
    });
  });

  describe('cancel', () => {
    it('emits cancelled event', async () => {
      const cancelledSpy = vi.fn();
      provider.on('cancelled', cancelledSpy);

      await provider.cancel('test-task-id');

      expect(cancelledSpy).toHaveBeenCalledWith({
        taskId: 'test-task-id',
      });
    });
  });

  describe('response routing', () => {
    it('routes commit message prompts correctly', async () => {
      const result = await provider.executeOneShot(
        'git commit message',
        '/test'
      );
      expect(result).toContain('feat(example):');
    });

    it('routes code prompts correctly', async () => {
      const result = await provider.executeOneShot(
        'implement a function',
        '/test'
      );
      expect(result).toContain('function');
      expect(result).toContain('javascript');
    });

    it('routes plan prompts correctly', async () => {
      const result = await provider.executeOneShot(
        'create a strategy',
        '/test'
      );
      expect(result).toContain('comprehensive plan');
    });

    it('routes plan update prompts correctly', async () => {
      const result = await provider.executeOneShot(
        'update the plan with more detail',
        '/test'
      );
      expect(result).toContain('<UPDATES>');
      expect(result).toContain('update_phase');
    });

    it('routes error prompts correctly', async () => {
      const result = await provider.executeOneShot('this will fail', '/test');
      expect(result).toContain('encountered an error');
    });

    it('returns default response for unknown prompts', async () => {
      const result = await provider.executeOneShot('random prompt', '/test');
      expect(result).toContain('simulated AI response');
    });
  });

  describe('configuration', () => {
    it('respects delay configuration', async () => {
      process.env.FAKE_PROVIDER_DELAY_MS = '200';
      const delayProvider = new FakeAIProvider();

      const startTime = Date.now();
      await delayProvider.executeOneShot('test', '/test');
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(200);
    });

    it('handles zero delay', async () => {
      process.env.FAKE_PROVIDER_DELAY_MS = '0';
      const noDelayProvider = new FakeAIProvider();

      const startTime = Date.now();
      await noDelayProvider.executeOneShot('test', '/test');
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100);
    });
  });
});
