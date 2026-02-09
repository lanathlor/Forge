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
  private processes: Map<string, ChildProcess> = new Map();
  private outputs: Map<string, string[]> = new Map();

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
    console.log(`[ClaudeWrapper] Task ${taskId} - Working dir: ${workingDirectory}, Prompt: [${_prompt.length} chars]`);

    const childProcess = spawn(
      claudeCodePath,
      [
        '--dangerously-skip-permissions',
        '--print',
        '--output-format', 'stream-json',
        '--include-partial-messages',
        '--verbose',
      ],
      {
        cwd: workingDirectory,
        env: process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    // Store process in map
    this.processes.set(taskId, childProcess);
    this.outputs.set(taskId, []);

    console.log(`[ClaudeWrapper] Task ${taskId} - Process spawned with PID: ${childProcess.pid}`);
    this.setupProcessHandlers(taskId, childProcess, resolve, reject);

    // Write prompt to stdin and close stdin stream
    console.log(`[ClaudeWrapper] Task ${taskId} - Writing prompt to stdin...`);
    childProcess.stdin?.write(_prompt + '\n');
    childProcess.stdin?.end();
    console.log(`[ClaudeWrapper] Task ${taskId} - Prompt sent, stdin closed`);
  }

  private setupProcessHandlers(
    taskId: string,
    process: ChildProcess,
    resolve: (value: ClaudeTaskResult) => void,
    reject: (reason: Error) => void
  ) {
    console.log(`[ClaudeWrapper] Task ${taskId} - Setting up process handlers`);

    // Capture stdout (stream-json format)
    let buffer = '';
    process.stdout?.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.trim()) this.processOutputLine(line, taskId);
      }
    });

    // Capture stderr
    process.stderr?.on('data', (data) => {
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
    process.on('close', (exitCode) => {
      console.log(`[ClaudeWrapper] Task ${taskId} - Process closed with exit code: ${exitCode}`);

      const taskOutput = this.outputs.get(taskId) || [];
      const result: ClaudeTaskResult = {
        exitCode: exitCode || 0,
        output: taskOutput.join(''),
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

      this.cleanupTask(taskId);
    });

    // Handle errors
    process.on('error', (err) => {
      console.error(`[ClaudeWrapper] Task ${taskId} - Process error:`, err.message);
      this.emit('failed', { taskId, error: err.message });
      reject(err);
      this.cleanupTask(taskId);
    });

    console.log(`[ClaudeWrapper] Task ${taskId} - Process handlers setup complete`);
  }

  async cancel(taskId: string): Promise<void> {
    const process = this.processes.get(taskId);
    if (process) {
      console.log(`[ClaudeWrapper] Cancelling task ${taskId}, sending SIGTERM to PID ${process.pid}`);
      process.kill('SIGTERM');
      this.emit('cancelled', { taskId });
      this.cleanupTask(taskId);
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

  private cleanupTask(taskId: string): void {
    console.log(`[ClaudeWrapper] Cleaning up task ${taskId}`);
    this.processes.delete(taskId);
    this.outputs.delete(taskId);
  }

  private processOutputLine(line: string, taskId: string): void {
    try {
      const json = JSON.parse(line);
      this.handleJsonOutput(json, taskId);
    } catch (_error) {
      this.handleRawOutput(line, taskId);
    }
  }

  private handleJsonOutput(json: { type: string; event?: { type: string; delta?: { text?: string } }; subtype?: string; duration_ms?: number }, taskId: string): void {
    if (json.type === 'stream_event' && json.event?.type === 'content_block_delta') {
      const text = json.event.delta?.text;
      if (text) this.emitOutputText(text, taskId);
    } else if (json.type === 'system') {
      console.log(`[Claude System ${taskId}]`, json.subtype || 'init');
    } else if (json.type === 'result') {
      console.log(`[Claude Result ${taskId}]`, json.subtype, `(${json.duration_ms}ms)`);
    }
  }

  private handleRawOutput(line: string, taskId: string): void {
    console.log(`[Claude Raw ${taskId}]`, line);
    this.emitOutputText(line + '\n', taskId);
  }

  private emitOutputText(text: string, taskId: string): void {
    const taskOutput = this.outputs.get(taskId) || [];
    taskOutput.push(text);
    this.outputs.set(taskId, taskOutput);

    console.log(`[Claude Output ${taskId}]`, text);
    this.emit('output', { taskId, type: 'stdout', data: text, timestamp: new Date() });
    this.appendTaskOutput(taskId, text);
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
