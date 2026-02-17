import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  type MockedFunction,
  type MockInstance,
} from 'vitest';
import type { ChildProcess } from 'child_process';
import { ClaudeCodeProvider } from '../providers/claude-code-provider';
import type { TaskExecutionOptions } from '../types';

// Hoist the spawn mock so it can be referenced in vi.mock factory
const mockSpawnFn = vi.hoisted(() => vi.fn());

// Mock child_process
vi.mock('child_process', () => ({
  spawn: mockSpawnFn,
  default: {
    spawn: mockSpawnFn,
  },
}));

// Mock database
vi.mock('@/db', () => ({
  db: {
    query: {
      tasks: {
        findFirst: vi.fn(),
      },
    },
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn(),
      }),
    }),
  },
}));

vi.mock('@/db/schema/tasks', () => ({
  tasks: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
}));

describe('ClaudeCodeProvider', () => {
  let provider: ClaudeCodeProvider;
  let mockChildProcess: Partial<ChildProcess>;
  const mockSpawn = mockSpawnFn as unknown as MockedFunction<any>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset environment variables
    delete process.env.SIMULATE_CLAUDE;
    delete process.env.CLAUDE_CODE_PATH;

    // Create mock child process
    mockChildProcess = {
      pid: 12345,
      stdout: {
        on: vi.fn(),
      } as any,
      stderr: {
        on: vi.fn(),
      } as any,
      stdin: {
        write: vi.fn(),
        end: vi.fn(),
      } as any,
      on: vi.fn(),
      kill: vi.fn(),
    };

    mockSpawn.mockReturnValue(mockChildProcess as ChildProcess);

    provider = new ClaudeCodeProvider();
  });

  describe('executeTask', () => {
    it('executes in simulation mode when SIMULATE_CLAUDE is true', async () => {
      vi.useFakeTimers();
      process.env.SIMULATE_CLAUDE = 'true';

      const options: TaskExecutionOptions = {
        taskId: 'test-task-1',
        prompt: 'test prompt',
        workingDirectory: '/test/dir',
      };

      const completeSpy = vi.fn();
      provider.on('complete', completeSpy);

      const resultPromise = provider.executeTask(options);

      // Fast-forward time for simulation
      await vi.runAllTimersAsync();

      const result = await resultPromise;

      vi.useRealTimers();

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('Simulated Claude Code execution');
      expect(result.output).toContain('test-task-1');
      expect(completeSpy).toHaveBeenCalled();
    });

    it('spawns claude process in real mode', async () => {
      process.env.SIMULATE_CLAUDE = 'false';
      process.env.CLAUDE_CODE_PATH = '/usr/bin/claude';

      const options: TaskExecutionOptions = {
        taskId: 'test-task-2',
        prompt: 'test prompt',
        workingDirectory: '/test/dir',
      };

      provider.executeTask(options);

      expect(mockSpawn).toHaveBeenCalledWith(
        '/usr/bin/claude',
        [
          '--dangerously-skip-permissions',
          '--print',
          '--output-format',
          'stream-json',
          '--include-partial-messages',
          '--verbose',
        ],
        {
          cwd: '/test/dir',
          env: process.env,
          stdio: ['pipe', 'pipe', 'pipe'],
        }
      );

      expect(mockChildProcess.stdin?.write).toHaveBeenCalledWith(
        'test prompt\n'
      );
      expect(mockChildProcess.stdin?.end).toHaveBeenCalled();
    });

    it('handles process completion successfully', async () => {
      process.env.SIMULATE_CLAUDE = 'false';

      const options: TaskExecutionOptions = {
        taskId: 'test-task-3',
        prompt: 'test prompt',
        workingDirectory: '/test/dir',
      };

      const completeSpy = vi.fn();
      provider.on('complete', completeSpy);

      const resultPromise = provider.executeTask(options);

      // Simulate process completion
      const closeHandler = (
        mockChildProcess.on as MockedFunction<any>
      ).mock.calls.find((call) => call[0] === 'close')?.[1] as
        | ((code: number) => void)
        | undefined;

      if (closeHandler) {
        closeHandler(0); // Exit code 0
      }

      const result = await resultPromise;

      expect(result.exitCode).toBe(0);
      expect(completeSpy).toHaveBeenCalledWith({
        taskId: 'test-task-3',
        result: expect.objectContaining({
          exitCode: 0,
        }),
      });
    });

    it('handles process errors', async () => {
      process.env.SIMULATE_CLAUDE = 'false';

      const options: TaskExecutionOptions = {
        taskId: 'test-task-4',
        prompt: 'test prompt',
        workingDirectory: '/test/dir',
      };

      const failedSpy = vi.fn();
      provider.on('failed', failedSpy);

      const resultPromise = provider.executeTask(options);

      // Simulate process error
      const errorHandler = (
        mockChildProcess.on as MockedFunction<any>
      ).mock.calls.find((call) => call[0] === 'error')?.[1] as
        | ((err: Error) => void)
        | undefined;

      if (errorHandler) {
        errorHandler(new Error('Process failed'));
      }

      await expect(resultPromise).rejects.toThrow('Process failed');
      expect(failedSpy).toHaveBeenCalled();
    });
  });

  describe('executeWithStream', () => {
    it('executes in simulation mode with streaming', async () => {
      process.env.SIMULATE_CLAUDE = 'true';

      const chunks: string[] = [];
      const onChunk = (text: string) => chunks.push(text);

      const result = await provider.executeWithStream(
        'test streaming prompt',
        '/test/dir',
        onChunk
      );

      expect(chunks.length).toBeGreaterThan(0);
      expect(result).toContain('expand the plan');
      expect(result).toContain('<UPDATES>');
    });

    it('spawns process for real streaming execution', async () => {
      process.env.SIMULATE_CLAUDE = 'false';

      const onChunk = vi.fn();

      provider.executeWithStream('test prompt', '/test/dir', onChunk);

      expect(mockSpawn).toHaveBeenCalledWith(
        'claude',
        expect.arrayContaining(['--output-format', 'stream-json']),
        expect.objectContaining({
          cwd: '/test/dir',
          stdio: ['pipe', 'pipe', 'pipe'],
        })
      );
    });

    it('handles timeout in streaming mode', async () => {
      vi.useFakeTimers();
      process.env.SIMULATE_CLAUDE = 'false';

      const onChunk = vi.fn();

      const resultPromise = provider.executeWithStream(
        'test prompt',
        '/test/dir',
        onChunk,
        1000 // 1 second timeout
      );

      // Simulate timeout
      vi.advanceTimersByTime(1001);

      await expect(resultPromise).rejects.toThrow(
        'Streaming execution timed out after 1000ms'
      );
      vi.useRealTimers();
      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });
  });

  describe('executeOneShot', () => {
    it('executes in simulation mode', async () => {
      process.env.SIMULATE_CLAUDE = 'true';

      const result = await provider.executeOneShot(
        'generate commit message',
        '/test/dir'
      );

      expect(result).toContain('feat(example):');
      expect(result).toContain('simulated response');
    });

    it('spawns process for real one-shot execution', async () => {
      process.env.SIMULATE_CLAUDE = 'false';

      provider.executeOneShot('test prompt', '/test/dir');

      expect(mockSpawn).toHaveBeenCalledWith(
        'claude',
        ['--dangerously-skip-permissions', '--print'],
        expect.objectContaining({
          cwd: '/test/dir',
          stdio: ['pipe', 'pipe', 'pipe'],
        })
      );
    });

    it('handles timeout in one-shot mode', async () => {
      vi.useFakeTimers();
      process.env.SIMULATE_CLAUDE = 'false';

      const resultPromise = provider.executeOneShot(
        'test prompt',
        '/test/dir',
        1000 // 1 second timeout
      );

      // Simulate timeout
      vi.advanceTimersByTime(1001);

      await expect(resultPromise).rejects.toThrow(
        'One-shot execution timed out after 1000ms'
      );
      vi.useRealTimers();
      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });
  });

  describe('cancel', () => {
    it('cancels active process', async () => {
      process.env.SIMULATE_CLAUDE = 'false';

      const options: TaskExecutionOptions = {
        taskId: 'test-task-cancel',
        prompt: 'test prompt',
        workingDirectory: '/test/dir',
      };

      const cancelledSpy = vi.fn();
      provider.on('cancelled', cancelledSpy);

      provider.executeTask(options);
      await provider.cancel('test-task-cancel');

      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(cancelledSpy).toHaveBeenCalledWith({
        taskId: 'test-task-cancel',
      });
    });

    it('handles cancellation when no process is running', async () => {
      const cancelledSpy = vi.fn();
      provider.on('cancelled', cancelledSpy);

      await provider.cancel('non-existent-task');

      // Should not throw or call kill on non-existent process
      expect(mockChildProcess.kill).not.toHaveBeenCalled();
    });
  });

  describe('stream event handling', () => {
    it('processes text delta events', async () => {
      process.env.SIMULATE_CLAUDE = 'false';

      const options: TaskExecutionOptions = {
        taskId: 'test-stream-events',
        prompt: 'test prompt',
        workingDirectory: '/test/dir',
      };

      const outputSpy = vi.fn();
      provider.on('output', outputSpy);

      provider.executeTask(options);

      // Simulate stdout data with JSON stream events
      const stdoutHandler = (
        mockChildProcess.stdout?.on as MockedFunction<any>
      ).mock.calls.find((call) => call[0] === 'data')?.[1] as
        | ((data: Buffer) => void)
        | undefined;

      if (stdoutHandler) {
        const jsonEvent = JSON.stringify({
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            delta: {
              type: 'text_delta',
              text: 'Hello, world!',
            },
          },
        });
        stdoutHandler(Buffer.from(jsonEvent + '\n'));
      }

      expect(outputSpy).toHaveBeenCalledWith({
        taskId: 'test-stream-events',
        output: 'Hello, world!',
        timestamp: expect.any(Date),
      });
    });

    it('processes tool use events', async () => {
      process.env.SIMULATE_CLAUDE = 'false';

      const options: TaskExecutionOptions = {
        taskId: 'test-tool-events',
        prompt: 'test prompt',
        workingDirectory: '/test/dir',
      };

      const outputSpy = vi.fn();
      provider.on('output', outputSpy);

      provider.executeTask(options);

      // Simulate tool use event
      const stdoutHandler = (
        mockChildProcess.stdout?.on as MockedFunction<any>
      ).mock.calls.find((call) => call[0] === 'data')?.[1] as
        | ((data: Buffer) => void)
        | undefined;

      if (stdoutHandler) {
        const jsonEvent = JSON.stringify({
          type: 'stream_event',
          event: {
            type: 'content_block_start',
            content_block: {
              type: 'tool_use',
              name: 'read_file',
            },
          },
        });
        stdoutHandler(Buffer.from(jsonEvent + '\n'));
      }

      expect(outputSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'test-tool-events',
          output: expect.stringContaining('🔧 Tool: read_file'),
        })
      );
    });

    it('handles non-JSON stdout data', async () => {
      process.env.SIMULATE_CLAUDE = 'false';

      const options: TaskExecutionOptions = {
        taskId: 'test-plain-text',
        prompt: 'test prompt',
        workingDirectory: '/test/dir',
      };

      const outputSpy = vi.fn();
      provider.on('output', outputSpy);

      provider.executeTask(options);

      // Simulate plain text output
      const stdoutHandler = (
        mockChildProcess.stdout?.on as MockedFunction<any>
      ).mock.calls.find((call) => call[0] === 'data')?.[1] as
        | ((data: Buffer) => void)
        | undefined;

      if (stdoutHandler) {
        stdoutHandler(Buffer.from('Plain text output\n'));
      }

      expect(outputSpy).toHaveBeenCalledWith({
        taskId: 'test-plain-text',
        output: 'Plain text output',
        timestamp: expect.any(Date),
      });
    });
  });
});
