import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { db } from '@/db';
import { tasks } from '@/db/schema/tasks';
import { eq } from 'drizzle-orm';

interface ClaudeTaskOptions {
  workingDirectory: string;
  prompt: string;
  taskId: string;
}

interface ClaudeTaskResult {
  exitCode: number;
  output: string;
  error?: string;
}

class ClaudeCodeWrapper extends EventEmitter {
  private process: ChildProcess | null = null;
  private output: string[] = [];

  /* eslint-disable max-lines-per-function */
  async executeTask(options: ClaudeTaskOptions): Promise<ClaudeTaskResult> {
    const { workingDirectory, prompt, taskId } = options;

    return new Promise((resolve, reject) => {
      // For now, we'll simulate Claude Code execution
      // In production, this would spawn the actual claude-code CLI
      const simulateClaudeCode = process.env.SIMULATE_CLAUDE === 'true';

      if (simulateClaudeCode) {
        return this.executeSimulated(taskId, prompt, workingDirectory, resolve);
      }

      return this.executeReal(
        taskId,
        prompt,
        workingDirectory,
        resolve,
        reject
      );
    });
  }

  private executeSimulated(
    taskId: string,
    prompt: string,
    workingDirectory: string,
    resolve: (value: ClaudeTaskResult) => void
  ) {
    setTimeout(() => {
      const mockOutput =
        `Simulated Claude Code execution for task ${taskId}\n` +
        `Prompt: ${prompt}\n` +
        `Working directory: ${workingDirectory}\n` +
        `Task completed successfully.`;

      this.appendTaskOutput(taskId, mockOutput);

      const result: ClaudeTaskResult = {
        exitCode: 0,
        output: mockOutput,
      };

      this.emit('complete', { taskId, result });
      resolve(result);
    }, 2000);
  }

  private executeReal(
    taskId: string,
    _prompt: string,
    workingDirectory: string,
    resolve: (value: ClaudeTaskResult) => void,
    reject: (reason: Error) => void
  ) {
    this.process = spawn(
      process.env.CLAUDE_CODE_PATH || 'claude-code',
      ['--working-directory', workingDirectory, '--prompt', _prompt],
      {
        cwd: workingDirectory,
        env: process.env,
      }
    );

    this.setupProcessHandlers(taskId, resolve, reject);
  }

  private setupProcessHandlers(
    taskId: string,
    resolve: (value: ClaudeTaskResult) => void,
    reject: (reason: Error) => void
  ) {
    // Capture stdout
    this.process?.stdout?.on('data', (data) => {
      const text = data.toString();
      this.output.push(text);

      this.emit('output', {
        taskId,
        type: 'stdout',
        data: text,
        timestamp: new Date(),
      });

      this.appendTaskOutput(taskId, text);
    });

    // Capture stderr
    this.process?.stderr?.on('data', (data) => {
      const text = data.toString();
      this.emit('error', {
        taskId,
        type: 'stderr',
        data: text,
        timestamp: new Date(),
      });

      this.appendTaskOutput(taskId, text);
    });

    // Handle completion
    this.process?.on('close', (exitCode) => {
      const result: ClaudeTaskResult = {
        exitCode: exitCode || 0,
        output: this.output.join(''),
      };

      if (exitCode === 0) {
        this.emit('complete', { taskId, result });
        resolve(result);
      } else {
        const error = `Claude exited with code ${exitCode}`;
        this.emit('failed', { taskId, error });
        reject(new Error(error));
      }

      this.cleanup();
    });

    // Handle errors
    this.process?.on('error', (err) => {
      this.emit('failed', { taskId, error: err.message });
      reject(err);
      this.cleanup();
    });
  }

  async cancel(taskId: string): Promise<void> {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.emit('cancelled', { taskId });
      this.cleanup();
    }
  }

  private async appendTaskOutput(
    taskId: string,
    output: string
  ): Promise<void> {
    try {
      const task = await db.query.tasks.findFirst({
        where: eq(tasks.id, taskId),
      });

      const existingOutput = task?.claudeOutput || '';
      await db
        .update(tasks)
        .set({
          claudeOutput: existingOutput + output,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, taskId));
    } catch (error) {
      console.error('Failed to append task output:', error);
    }
  }

  private cleanup(): void {
    this.process = null;
    this.output = [];
  }
}

// Singleton instance
export const claudeWrapper = new ClaudeCodeWrapper();
