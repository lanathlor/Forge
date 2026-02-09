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

    console.log(`[ClaudeWrapper] executeTask called for task ${taskId}`);
    console.log(`[ClaudeWrapper] Working directory: ${workingDirectory}`);
    console.log(`[ClaudeWrapper] Prompt length: ${prompt.length} chars`);

    return new Promise((resolve, reject) => {
      // For now, we'll simulate Claude Code execution
      // In production, this would spawn the actual claude-code CLI
      const simulateClaudeCode = process.env.SIMULATE_CLAUDE === 'true';

      console.log(`[ClaudeWrapper] SIMULATE_CLAUDE=${process.env.SIMULATE_CLAUDE}`);
      console.log(`[ClaudeWrapper] Using ${simulateClaudeCode ? 'simulated' : 'real'} execution`);

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
    console.log(`[ClaudeWrapper] Simulating Claude execution (2 second delay)...`);

    setTimeout(async () => {
      const mockOutput =
        `Simulated Claude Code execution for task ${taskId}\n` +
        `Prompt: ${prompt}\n` +
        `Working directory: ${workingDirectory}\n` +
        `Task completed successfully.`;

      console.log(`[ClaudeWrapper] Simulation complete, appending output`);
      await this.appendTaskOutput(taskId, mockOutput);

      const result: ClaudeTaskResult = {
        exitCode: 0,
        output: mockOutput,
      };

      this.emit('complete', { taskId, result });
      console.log(`[ClaudeWrapper] Resolving promise with exit code 0`);
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
    const claudeCodePath = process.env.CLAUDE_CODE_PATH || 'claude';
    console.log(`[ClaudeWrapper] Spawning Claude Code at: ${claudeCodePath}`);
    console.log(`[ClaudeWrapper] Working dir: ${workingDirectory}, Prompt: [${_prompt.length} chars]`);

    this.process = spawn(
      claudeCodePath,
      ['--dangerously-skip-permissions'],
      {
        cwd: workingDirectory,
        env: process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    console.log(`[ClaudeWrapper] Process spawned with PID: ${this.process.pid}`);
    this.setupProcessHandlers(taskId, resolve, reject);

    // Write prompt to stdin and close stdin stream
    console.log(`[ClaudeWrapper] Writing prompt to stdin...`);
    this.process.stdin?.write(_prompt + '\n');
    this.process.stdin?.end();
    console.log(`[ClaudeWrapper] Prompt sent, stdin closed`);
  }

  private setupProcessHandlers(
    taskId: string,
    resolve: (value: ClaudeTaskResult) => void,
    reject: (reason: Error) => void
  ) {
    console.log(`[ClaudeWrapper] Setting up process handlers for task ${taskId}`);

    // Capture stdout
    this.process?.stdout?.on('data', (data) => {
      const text = data.toString();
      this.output.push(text);

      // Log to backend console for real-time feedback
      console.log(`[Claude Output ${taskId}] ${text}`);

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

      // Log stderr to backend console
      console.error(`[Claude Error ${taskId}] ${text}`);

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
      console.log(`[ClaudeWrapper] Process closed for task ${taskId} with exit code: ${exitCode}`);

      const result: ClaudeTaskResult = {
        exitCode: exitCode || 0,
        output: this.output.join(''),
      };

      if (exitCode === 0) {
        console.log(`[ClaudeWrapper] Task ${taskId} completed successfully`);
        this.emit('complete', { taskId, result });
        resolve(result);
      } else {
        const error = `Claude exited with code ${exitCode}`;
        console.error(`[ClaudeWrapper] Task ${taskId} failed: ${error}`);
        this.emit('failed', { taskId, error });
        reject(new Error(error));
      }

      this.cleanup();
    });

    // Handle errors
    this.process?.on('error', (err) => {
      console.error(`[ClaudeWrapper] Process error for task ${taskId}:`, err.message);
      this.emit('failed', { taskId, error: err.message });
      reject(err);
      this.cleanup();
    });

    console.log(`[ClaudeWrapper] Process handlers setup complete, waiting for output...`);
  }

  async cancel(taskId: string): Promise<void> {
    if (this.process) {
      console.log(`[ClaudeWrapper] Cancelling task ${taskId}, sending SIGTERM to PID ${this.process.pid}`);
      this.process.kill('SIGTERM');
      this.emit('cancelled', { taskId });
      this.cleanup();
      console.log(`[ClaudeWrapper] Task ${taskId} cancelled and cleaned up`);
    } else {
      console.log(`[ClaudeWrapper] No active process to cancel for task ${taskId}`);
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
      const newLength = existingOutput.length + output.length;

      await db
        .update(tasks)
        .set({
          claudeOutput: existingOutput + output,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, taskId));

      console.log(`[ClaudeWrapper] Updated task ${taskId} output (${existingOutput.length} -> ${newLength} chars)`);
    } catch (error) {
      console.error(`[ClaudeWrapper] Failed to append task output for ${taskId}:`, error);
    }
  }

  private cleanup(): void {
    console.log(`[ClaudeWrapper] Cleaning up process and output buffer`);
    this.process = null;
    this.output = [];
  }

  /**
   * Execute a one-shot prompt with Claude Code CLI
   * Returns the output directly without storing to database
   * Useful for commit message generation and other quick tasks
   */
  async executeOneShot(
    prompt: string,
    workingDirectory: string,
    timeoutMs = 30000
  ): Promise<string> {
    const claudeCodePath = process.env.CLAUDE_CODE_PATH || 'claude';

    console.log(`[ClaudeWrapper] executeOneShot called`);
    console.log(`[ClaudeWrapper] Working directory: ${workingDirectory}`);
    console.log(`[ClaudeWrapper] Prompt length: ${prompt.length} chars`);

    // Check if we're in simulation mode
    const simulateClaudeCode = process.env.SIMULATE_CLAUDE === 'true';

    if (simulateClaudeCode) {
      console.log(`[ClaudeWrapper] Simulating one-shot execution...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return `feat(example): simulated commit message\n\nThis is a simulated response for testing.`;
    }

    return new Promise((resolve, reject) => {
      let output = '';
      let errorOutput = '';

      const timeout = setTimeout(() => {
        childProcess?.kill('SIGTERM');
        reject(new Error(`One-shot execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      console.log(`[ClaudeWrapper] Attempting to spawn: ${claudeCodePath}`);
      console.log(`[ClaudeWrapper] PATH: ${process.env.PATH}`);
      console.log(`[ClaudeWrapper] CWD: ${workingDirectory}`);

      const childProcess = spawn(
        claudeCodePath,
        ['--dangerously-skip-permissions'],
        {
          cwd: workingDirectory,
          env: process.env,
          stdio: ['pipe', 'pipe', 'pipe'],
        }
      );

      console.log(`[ClaudeWrapper] One-shot process spawned with PID: ${childProcess.pid}`);

      childProcess.stdout?.on('data', (data) => {
        output += data.toString();
      });

      childProcess.stderr?.on('data', (data) => {
        errorOutput += data.toString();
        console.error(`[ClaudeWrapper] One-shot stderr: ${data.toString()}`);
      });

      childProcess.on('close', (exitCode) => {
        clearTimeout(timeout);
        console.log(`[ClaudeWrapper] One-shot process closed with exit code: ${exitCode}`);

        if (exitCode === 0 && output.trim()) {
          console.log(`[ClaudeWrapper] One-shot output length: ${output.length}`);
          resolve(output.trim());
        } else {
          const error = errorOutput || `Claude Code exited with code ${exitCode}`;
          console.error(`[ClaudeWrapper] One-shot failed: ${error}`);
          reject(new Error(error));
        }
      });

      childProcess.on('error', (err) => {
        clearTimeout(timeout);
        console.error(`[ClaudeWrapper] One-shot process error:`, err);
        reject(err);
      });

      // Write prompt to stdin
      console.log(`[ClaudeWrapper] Writing prompt to stdin...`);
      childProcess.stdin?.write(prompt + '\n');
      childProcess.stdin?.end();
      console.log(`[ClaudeWrapper] Prompt sent, stdin closed`);
    });
  }
}

// Singleton instance
export const claudeWrapper = new ClaudeCodeWrapper();
