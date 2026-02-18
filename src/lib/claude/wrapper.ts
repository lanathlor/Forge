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

      console.log(
        `[ClaudeWrapper] SIMULATE_CLAUDE=${process.env.SIMULATE_CLAUDE}`
      );
      console.log(
        `[ClaudeWrapper] Using ${simulateClaudeCode ? 'simulated' : 'real'} execution`
      );

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
    console.log(
      `[ClaudeWrapper] Simulating Claude execution (2 second delay)...`
    );

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
    console.log(
      `[ClaudeWrapper] Working dir: ${workingDirectory}, Prompt: [${_prompt.length} chars]`
    );

    this.process = spawn(
      claudeCodePath,
      [
        '--dangerously-skip-permissions',
        '--print',
        '--output-format',
        'stream-json',
        '--include-partial-messages',
        '--verbose',
      ],
      {
        cwd: workingDirectory,
        env: process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    console.log(
      `[ClaudeWrapper] Process spawned with PID: ${this.process.pid}`
    );
    this.setupProcessHandlers(taskId, resolve, reject);

    // Write prompt to stdin and close stdin stream
    console.log(`[ClaudeWrapper] Writing prompt to stdin...`);
    this.process.stdin?.write(_prompt + '\n');
    this.process.stdin?.end();
    console.log(`[ClaudeWrapper] Prompt sent, stdin closed`);
  }

  private handleTextDelta(
    taskId: string,
    delta: Record<string, unknown>
  ): void {
    const humanText = delta.text as string;
    this.emitAndAppend(
      taskId,
      humanText,
      `[Claude Output ${taskId}] ${humanText}`
    );
  }

  private handleToolUse(
    taskId: string,
    contentBlock: Record<string, unknown>
  ): void {
    const toolName = (contentBlock.name as string) || 'unknown';
    const toolMessage = `\n🔧 Tool: ${toolName}\n`;
    this.emitAndAppend(
      taskId,
      toolMessage,
      `[Claude Tool ${taskId}] Using tool: ${toolName}`
    );
  }

  private handleInputJsonDelta(
    taskId: string,
    delta: Record<string, unknown>
  ): void {
    const inputDelta = delta.partial_json as string;
    this.emitAndAppend(
      taskId,
      inputDelta,
      `[Claude Tool Input ${taskId}] ${inputDelta}`
    );
  }

  private handleStreamEvent(
    taskId: string,
    event: Record<string, unknown>
  ): boolean {
    const delta = event.delta as Record<string, unknown> | undefined;
    const contentBlock = event.content_block as
      | Record<string, unknown>
      | undefined;

    if (event.type === 'content_block_delta') {
      if (delta?.type === 'text_delta') {
        this.handleTextDelta(taskId, delta);
        return true;
      }
      if (delta?.type === 'input_json_delta') {
        this.handleInputJsonDelta(taskId, delta);
        return true;
      }
    }

    if (
      event.type === 'content_block_start' &&
      contentBlock?.type === 'tool_use'
    ) {
      this.handleToolUse(taskId, contentBlock);
      return true;
    }

    return false;
  }

  private handleToolResult(
    taskId: string,
    parsed: Record<string, unknown>
  ): void {
    const toolName = (parsed.tool_name as string) || 'unknown';
    const isError = (parsed.is_error as boolean) || false;
    const resultPrefix = isError ? '❌ Tool Error' : '✓ Tool Complete';
    const toolResultMessage = `\n${resultPrefix}: ${toolName}\n`;
    this.emitAndAppend(
      taskId,
      toolResultMessage,
      `[Claude Tool Result ${taskId}] ${toolName} - ${isError ? 'error' : 'success'}`
    );
  }

  private handleParsedEvent(
    taskId: string,
    parsed: Record<string, unknown>
  ): void {
    if (parsed.type === 'stream_event') {
      const event = parsed.event as Record<string, unknown> | undefined;
      if (event) {
        this.handleStreamEvent(taskId, event);
      }
      return;
    }

    if (parsed.type === 'tool_result') {
      this.handleToolResult(taskId, parsed);
    }
  }

  private emitAndAppend(
    taskId: string,
    output: string,
    logMessage: string
  ): void {
    console.log(logMessage);
    this.emit('output', { taskId, output, timestamp: new Date() });
    this.appendTaskOutput(taskId, output);
  }

  private processStdoutLine(taskId: string, line: string): void {
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      this.handleParsedEvent(taskId, parsed);
    } catch (_e) {
      // Not JSON or parsing failed, treat as plain text
      this.emitAndAppend(taskId, line, `[Claude Output ${taskId}] ${line}`);
    }
  }

  private setupProcessHandlers(
    taskId: string,
    resolve: (value: ClaudeTaskResult) => void,
    reject: (reason: Error) => void
  ) {
    console.log(
      `[ClaudeWrapper] Setting up process handlers for task ${taskId}`
    );

    // Capture stdout
    this.process?.stdout?.on('data', (data) => {
      const text = data.toString();
      this.output.push(text);

      // Parse stream-json output and extract all relevant events
      const lines = text.split('\n').filter((line: string) => line.trim());
      for (const line of lines) {
        this.processStdoutLine(taskId, line);
      }
    });

    // Capture stderr
    this.process?.stderr?.on('data', (data) => {
      const text = data.toString();

      // Log stderr to backend console
      console.error(`[Claude Error ${taskId}] ${text}`);

      // Emit as 'output' instead of 'error' to avoid unhandled EventEmitter errors
      this.emit('output', {
        taskId,
        type: 'stderr',
        data: text,
        timestamp: new Date(),
      });

      this.appendTaskOutput(taskId, text);
    });

    // Handle completion
    this.process?.on('close', (exitCode) => {
      console.log(
        `[ClaudeWrapper] Process closed for task ${taskId} with exit code: ${exitCode}`
      );

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
      console.error(
        `[ClaudeWrapper] Process error for task ${taskId}:`,
        err.message
      );
      this.emit('failed', { taskId, error: err.message });
      reject(err);
      this.cleanup();
    });

    console.log(
      `[ClaudeWrapper] Process handlers setup complete, waiting for output...`
    );
  }

  async cancel(taskId: string): Promise<void> {
    if (this.process) {
      console.log(
        `[ClaudeWrapper] Cancelling task ${taskId}, sending SIGTERM to PID ${this.process.pid}`
      );
      this.process.kill('SIGTERM');
      this.emit('cancelled', { taskId });
      this.cleanup();
      console.log(`[ClaudeWrapper] Task ${taskId} cancelled and cleaned up`);
    } else {
      console.log(
        `[ClaudeWrapper] No active process to cancel for task ${taskId}`
      );
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

      console.log(
        `[ClaudeWrapper] Updated task ${taskId} output (${existingOutput.length} -> ${newLength} chars)`
      );
    } catch (error) {
      console.error(
        `[ClaudeWrapper] Failed to append task output for ${taskId}:`,
        error
      );
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
  /**
   * Execute Claude with streaming output via callback
   */
  async executeWithStream(
    prompt: string,
    workingDirectory: string,
    onChunk: (text: string) => void,
    timeoutMs = 120000
  ): Promise<string> {
    const claudeCodePath = process.env.CLAUDE_CODE_PATH || 'claude';

    console.log(`[ClaudeWrapper] executeWithStream called`);
    console.log(`[ClaudeWrapper] Working directory: ${workingDirectory}`);
    console.log(
      `[ClaudeWrapper] SIMULATE_CLAUDE env var: "${process.env.SIMULATE_CLAUDE}"`
    );
    console.log(
      `[ClaudeWrapper] All env keys:`,
      Object.keys(process.env).filter(
        (k) => k.includes('CLAUDE') || k.includes('SIMULATE')
      )
    );

    // Check if we're in simulation mode
    const simulateClaudeCode = process.env.SIMULATE_CLAUDE === 'true';
    console.log(`[ClaudeWrapper] Using simulation mode: ${simulateClaudeCode}`);

    if (simulateClaudeCode) {
      console.log(`[ClaudeWrapper] Simulating streaming execution...`);
      const mockResponse = `I'll expand the plan with more detail.

<UPDATES>
[
  {"action": "update_phase", "phaseOrder": 1, "updates": {"description": "Enhanced description with more specific implementation details and technical requirements."}}
]
</UPDATES>`;
      const words = mockResponse.split(' ');
      for (const word of words) {
        onChunk(word + ' ');
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return mockResponse;
    }

    return new Promise((resolve, reject) => {
      let fullOutput = '';

      const timeout = setTimeout(() => {
        childProcess?.kill('SIGTERM');
        reject(new Error(`Streaming execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      const childProcess = spawn(
        claudeCodePath,
        [
          '--dangerously-skip-permissions',
          '--print',
          '--output-format',
          'stream-json',
          '--include-partial-messages',
          '--verbose',
        ],
        {
          cwd: workingDirectory,
          env: process.env,
          stdio: ['pipe', 'pipe', 'pipe'],
        }
      );

      console.log(
        `[ClaudeWrapper] Streaming process spawned with PID: ${childProcess.pid}`
      );

      childProcess.stdout?.on('data', (data) => {
        const text = data.toString();
        const lines = text.split('\n').filter((line: string) => line.trim());

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);

            // Extract text from text_delta events
            if (
              parsed.type === 'stream_event' &&
              parsed.event?.type === 'content_block_delta' &&
              parsed.event?.delta?.type === 'text_delta'
            ) {
              const humanText = parsed.event.delta.text;
              fullOutput += humanText;
              onChunk(humanText);
            }
          } catch (_e) {
            // Not JSON, ignore
          }
        }
      });

      let errorOutput = '';

      childProcess.stderr?.on('data', (data) => {
        errorOutput += data.toString();
        console.error(`[ClaudeWrapper] Streaming stderr: ${data.toString()}`);
      });

      childProcess.on('close', (exitCode) => {
        clearTimeout(timeout);
        console.log(
          `[ClaudeWrapper] Streaming process closed with exit code: ${exitCode}`
        );

        if (exitCode === 0) {
          resolve(fullOutput);
        } else {
          const errorMsg =
            errorOutput || `Claude Code exited with code ${exitCode}`;
          console.error(`[ClaudeWrapper] Error details:`, errorMsg);
          reject(new Error(errorMsg));
        }
      });

      childProcess.on('error', (err) => {
        clearTimeout(timeout);
        console.error(`[ClaudeWrapper] Streaming process error:`, err);
        reject(err);
      });

      // Write prompt to stdin
      childProcess.stdin?.write(prompt + '\n');
      childProcess.stdin?.end();
    });
  }

  async executeOneShot(
    prompt: string,
    workingDirectory: string,
    timeoutMs = 30000,
    tools: string | null = null,
    signal?: AbortSignal
  ): Promise<string> {
    const claudeCodePath = process.env.CLAUDE_CODE_PATH || 'claude';

    console.log(`[ClaudeWrapper] executeOneShot called`);
    console.log(`[ClaudeWrapper] Working directory: ${workingDirectory}`);
    console.log(`[ClaudeWrapper] Prompt length: ${prompt.length} chars`);

    // Check if we're in simulation mode
    const simulateClaudeCode = process.env.SIMULATE_CLAUDE === 'true';

    if (simulateClaudeCode) {
      console.log(`[ClaudeWrapper] Simulating one-shot execution...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return `feat(example): simulated commit message\n\nThis is a simulated response for testing.`;
    }

    // Reject immediately if already aborted
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    return new Promise((resolve, reject) => {
      let output = '';
      let errorOutput = '';
      let childProcess: ReturnType<typeof spawn> | null = null;

      const cleanup = () => {
        clearTimeout(timeout);
        abortHandler && signal?.removeEventListener('abort', abortHandler);
      };

      const timeout = setTimeout(() => {
        childProcess?.kill('SIGTERM');
        cleanup();
        reject(new Error(`One-shot execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      // Wire up AbortSignal
      const abortHandler = () => {
        console.log(`[ClaudeWrapper] One-shot aborted via signal`);
        childProcess?.kill('SIGTERM');
        cleanup();
        reject(new DOMException('Aborted', 'AbortError'));
      };
      signal?.addEventListener('abort', abortHandler);

      console.log(`[ClaudeWrapper] Attempting to spawn: ${claudeCodePath}`);
      console.log(`[ClaudeWrapper] PATH: ${process.env.PATH}`);
      console.log(`[ClaudeWrapper] CWD: ${workingDirectory}`);

      const args = ['--dangerously-skip-permissions', '--print'];
      if (tools !== null) {
        args.push('--tools', tools);
      }
      console.log(`[ClaudeWrapper] One-shot args: ${args.join(' ')}`);

      childProcess = spawn(claudeCodePath, args, {
        cwd: workingDirectory,
        env: process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      console.log(
        `[ClaudeWrapper] One-shot process spawned with PID: ${childProcess.pid}`
      );

      childProcess.stdout?.on('data', (data) => {
        output += data.toString();
      });

      childProcess.stderr?.on('data', (data) => {
        errorOutput += data.toString();
        console.error(`[ClaudeWrapper] One-shot stderr: ${data.toString()}`);
      });

      childProcess.on('close', (exitCode) => {
        cleanup();
        console.log(
          `[ClaudeWrapper] One-shot process closed with exit code: ${exitCode}`
        );

        if (exitCode === 0 && output.trim()) {
          console.log(
            `[ClaudeWrapper] One-shot output length: ${output.length}`
          );
          resolve(output.trim());
        } else {
          const error =
            errorOutput || `Claude Code exited with code ${exitCode}`;
          console.error(`[ClaudeWrapper] One-shot failed: ${error}`);
          reject(new Error(error));
        }
      });

      childProcess.on('error', (err) => {
        cleanup();
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
