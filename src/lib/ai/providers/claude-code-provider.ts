import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';

interface ProcessCallbacks {
  timeout: NodeJS.Timeout;
  resolve: (value: string) => void;
  reject: (reason: Error) => void;
}
import { EventEmitter } from 'events';
import { db } from '@/db';
import { tasks } from '@/db/schema/tasks';
import { eq } from 'drizzle-orm';
import type { AIProvider, TaskExecutionOptions, TaskResult } from '../types';

export class ClaudeCodeProvider extends EventEmitter implements AIProvider {
  private process: ChildProcess | null = null;
  private output: string[] = [];

  async executeTask(options: TaskExecutionOptions): Promise<TaskResult> {
    const { workingDirectory, prompt, taskId } = options;

    console.log(`[ClaudeCodeProvider] executeTask called for task ${taskId}`);
    console.log(`[ClaudeCodeProvider] Working directory: ${workingDirectory}`);
    console.log(`[ClaudeCodeProvider] Prompt length: ${prompt.length} chars`);

    return new Promise((resolve, reject) => {
      const simulateClaudeCode = process.env.SIMULATE_CLAUDE === 'true';

      console.log(
        `[ClaudeCodeProvider] SIMULATE_CLAUDE=${process.env.SIMULATE_CLAUDE}`
      );
      console.log(
        `[ClaudeCodeProvider] Using ${simulateClaudeCode ? 'simulated' : 'real'} execution`
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
    resolve: (value: TaskResult) => void
  ) {
    console.log(
      `[ClaudeCodeProvider] Simulating Claude execution (2 second delay)...`
    );

    setTimeout(async () => {
      const mockOutput =
        `Simulated Claude Code execution for task ${taskId}\n` +
        `Prompt: ${prompt}\n` +
        `Working directory: ${workingDirectory}\n` +
        `Task completed successfully.`;

      console.log(`[ClaudeCodeProvider] Simulation complete, appending output`);
      await this.appendTaskOutput(taskId, mockOutput);

      const result: TaskResult = {
        exitCode: 0,
        output: mockOutput,
      };

      this.emit('complete', { taskId, result });
      console.log(`[ClaudeCodeProvider] Resolving promise with exit code 0`);
      resolve(result);
    }, 2000);
  }

  private executeReal(
    taskId: string,
    _prompt: string,
    workingDirectory: string,
    resolve: (value: TaskResult) => void,
    reject: (reason: Error) => void
  ) {
    const claudeCodePath = process.env.CLAUDE_CODE_PATH || 'claude';
    console.log(
      `[ClaudeCodeProvider] Spawning Claude Code at: ${claudeCodePath}`
    );
    console.log(
      `[ClaudeCodeProvider] Working dir: ${workingDirectory}, Prompt: [${_prompt.length} chars]`
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
      `[ClaudeCodeProvider] Process spawned with PID: ${this.process.pid}`
    );
    this.setupProcessHandlers(taskId, resolve, reject);

    // Write prompt to stdin and close stdin stream
    console.log(`[ClaudeCodeProvider] Writing prompt to stdin...`);
    this.process.stdin?.write(_prompt + '\n');
    this.process.stdin?.end();
    console.log(`[ClaudeCodeProvider] Prompt sent, stdin closed`);
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
    resolve: (value: TaskResult) => void,
    reject: (reason: Error) => void
  ) {
    console.log(
      `[ClaudeCodeProvider] Setting up process handlers for task ${taskId}`
    );

    this.setupStdoutHandler(taskId);
    this.setupStderrHandler(taskId);
    this.setupCompletionHandler(taskId, resolve, reject);
    this.setupErrorHandler(taskId, reject);

    console.log(
      `[ClaudeCodeProvider] Process handlers setup complete, waiting for output...`
    );
  }

  private setupStdoutHandler(taskId: string) {
    this.process?.stdout?.on('data', (data) => {
      const text = data.toString();
      this.output.push(text);

      // Parse stream-json output and extract all relevant events
      const lines = text.split('\n').filter((line: string) => line.trim());
      for (const line of lines) {
        this.processStdoutLine(taskId, line);
      }
    });
  }

  private setupStderrHandler(taskId: string) {
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
  }

  private setupCompletionHandler(
    taskId: string,
    resolve: (value: TaskResult) => void,
    reject: (reason: Error) => void
  ) {
    this.process?.on('close', (exitCode) => {
      console.log(
        `[ClaudeCodeProvider] Process closed for task ${taskId} with exit code: ${exitCode}`
      );

      const result: TaskResult = {
        exitCode: exitCode || 0,
        output: this.output.join(''),
      };

      if (exitCode === 0) {
        console.log(
          `[ClaudeCodeProvider] Task ${taskId} completed successfully`
        );
        this.emit('complete', { taskId, result });
        resolve(result);
      } else {
        const error = `Claude exited with code ${exitCode}`;
        console.error(`[ClaudeCodeProvider] Task ${taskId} failed: ${error}`);
        this.emit('failed', { taskId, error });
        reject(new Error(error));
      }

      this.cleanup();
    });
  }

  private setupErrorHandler(
    taskId: string,
    reject: (reason: Error) => void
  ) {
    this.process?.on('error', (err) => {
      console.error(
        `[ClaudeCodeProvider] Process error for task ${taskId}:`,
        err.message
      );
      this.emit('failed', { taskId, error: err.message });
      reject(err);
      this.cleanup();
    });
  }

  async cancel(taskId: string): Promise<void> {
    if (this.process) {
      console.log(
        `[ClaudeCodeProvider] Cancelling task ${taskId}, sending SIGTERM to PID ${this.process.pid}`
      );
      this.process.kill('SIGTERM');
      this.emit('cancelled', { taskId });
      this.cleanup();
      console.log(
        `[ClaudeCodeProvider] Task ${taskId} cancelled and cleaned up`
      );
    } else {
      console.log(
        `[ClaudeCodeProvider] No active process to cancel for task ${taskId}`
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
        `[ClaudeCodeProvider] Updated task ${taskId} output (${existingOutput.length} -> ${newLength} chars)`
      );
    } catch (error) {
      console.error(
        `[ClaudeCodeProvider] Failed to append task output for ${taskId}:`,
        error
      );
    }
  }

  private cleanup(): void {
    console.log(`[ClaudeCodeProvider] Cleaning up process and output buffer`);
    this.process = null;
    this.output = [];
  }

  async executeWithStream(
    prompt: string,
    workingDirectory: string,
    onChunk: (text: string) => void,
    timeoutMs = 120000
  ): Promise<string> {
    console.log(`[ClaudeCodeProvider] executeWithStream called`);
    console.log(`[ClaudeCodeProvider] Working directory: ${workingDirectory}`);
    console.log(
      `[ClaudeCodeProvider] SIMULATE_CLAUDE env var: "${process.env.SIMULATE_CLAUDE}"`
    );

    const simulateClaudeCode = process.env.SIMULATE_CLAUDE === 'true';
    console.log(
      `[ClaudeCodeProvider] Using simulation mode: ${simulateClaudeCode}`
    );

    if (simulateClaudeCode) {
      return this.simulateStreamingExecution(onChunk);
    }

    return this.executeRealStreamingProcess(prompt, workingDirectory, onChunk, timeoutMs);
  }

  private async simulateStreamingExecution(onChunk: (text: string) => void): Promise<string> {
    console.log(`[ClaudeCodeProvider] Simulating streaming execution...`);
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

  private executeRealStreamingProcess(
    prompt: string,
    workingDirectory: string,
    onChunk: (text: string) => void,
    timeoutMs: number
  ): Promise<string> {
    const claudeCodePath = process.env.CLAUDE_CODE_PATH || 'claude';

    return new Promise((resolve, reject) => {
      const fullOutput = '';

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
        `[ClaudeCodeProvider] Streaming process spawned with PID: ${childProcess.pid}`
      );

      this.setupStreamingHandlers(childProcess, onChunk, fullOutput, { timeout, resolve, reject });

      // Write prompt to stdin
      childProcess.stdin?.write(prompt + '\n');
      childProcess.stdin?.end();
    });
  }

  private processStreamChunk(
    text: string,
    output: { value: string },
    onChunk: (text: string) => void
  ) {
    const lines = text.split('\n').filter((line: string) => line.trim());
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (
          parsed.type === 'stream_event' &&
          parsed.event?.type === 'content_block_delta' &&
          parsed.event?.delta?.type === 'text_delta'
        ) {
          const humanText = parsed.event.delta.text;
          output.value += humanText;
          onChunk(humanText);
        }
      } catch (_e) {
        // Not JSON, ignore
      }
    }
  }

  private setupStreamingHandlers(
    childProcess: ChildProcess,
    onChunk: (text: string) => void,
    fullOutput: string,
    callbacks: ProcessCallbacks
  ) {
    const { timeout, resolve, reject } = callbacks;
    const output = { value: fullOutput };
    let errorOutput = '';

    childProcess.stdout?.on('data', (data: Buffer) => {
      this.processStreamChunk(data.toString(), output, onChunk);
    });

    childProcess.stderr?.on('data', (data: Buffer) => {
      errorOutput += data.toString();
      console.error(`[ClaudeCodeProvider] Streaming stderr: ${data.toString()}`);
    });

    childProcess.on('close', (exitCode: number) => {
      clearTimeout(timeout);
      console.log(`[ClaudeCodeProvider] Streaming process closed with exit code: ${exitCode}`);
      if (exitCode === 0) {
        resolve(output.value);
      } else {
        const errorMsg = errorOutput || `Claude Code exited with code ${exitCode}`;
        console.error(`[ClaudeCodeProvider] Error details:`, errorMsg);
        reject(new Error(errorMsg));
      }
    });

    childProcess.on('error', (err: Error) => {
      clearTimeout(timeout);
      console.error(`[ClaudeCodeProvider] Streaming process error:`, err);
      reject(err);
    });
  }

  async executeOneShot(
    prompt: string,
    workingDirectory: string,
    timeoutMs = 30000
  ): Promise<string> {
    console.log(`[ClaudeCodeProvider] executeOneShot called`);
    console.log(`[ClaudeCodeProvider] Working directory: ${workingDirectory}`);
    console.log(`[ClaudeCodeProvider] Prompt length: ${prompt.length} chars`);

    const simulateClaudeCode = process.env.SIMULATE_CLAUDE === 'true';

    if (simulateClaudeCode) {
      return this.simulateOneShotExecution();
    }

    return this.executeRealOneShotProcess(prompt, workingDirectory, timeoutMs);
  }

  private async simulateOneShotExecution(): Promise<string> {
    console.log(`[ClaudeCodeProvider] Simulating one-shot execution...`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return `feat(example): simulated commit message\n\nThis is a simulated response for testing.`;
  }

  private executeRealOneShotProcess(
    prompt: string,
    workingDirectory: string,
    timeoutMs: number
  ): Promise<string> {
    const claudeCodePath = process.env.CLAUDE_CODE_PATH || 'claude';

    return new Promise((resolve, reject) => {
      const output = '';
      const errorOutput = '';

      const timeout = setTimeout(() => {
        childProcess?.kill('SIGTERM');
        reject(new Error(`One-shot execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.logProcessSpawn(claudeCodePath, workingDirectory);

      const childProcess = spawn(
        claudeCodePath,
        ['--dangerously-skip-permissions', '--print'],
        {
          cwd: workingDirectory,
          env: process.env,
          stdio: ['pipe', 'pipe', 'pipe'],
        }
      );

      console.log(
        `[ClaudeCodeProvider] One-shot process spawned with PID: ${childProcess.pid}`
      );

      this.setupOneShotHandlers(childProcess, output, errorOutput, { timeout, resolve, reject });

      // Write prompt to stdin
      this.writePromptToProcess(childProcess, prompt);
    });
  }

  private logProcessSpawn(claudeCodePath: string, workingDirectory: string) {
    console.log(
      `[ClaudeCodeProvider] Attempting to spawn: ${claudeCodePath}`
    );
    console.log(`[ClaudeCodeProvider] PATH: ${process.env.PATH}`);
    console.log(`[ClaudeCodeProvider] CWD: ${workingDirectory}`);
  }

  private setupOneShotHandlers(
    childProcess: ChildProcess,
    output: string,
    errorOutput: string,
    callbacks: ProcessCallbacks
  ) {
    const { timeout, resolve, reject } = callbacks;
    let processOutput = output;
    let processErrorOutput = errorOutput;

    childProcess.stdout?.on('data', (data: Buffer) => {
      processOutput += data.toString();
    });

    childProcess.stderr?.on('data', (data: Buffer) => {
      processErrorOutput += data.toString();
      console.error(
        `[ClaudeCodeProvider] One-shot stderr: ${data.toString()}`
      );
    });

    childProcess.on('close', (exitCode: number) => {
      clearTimeout(timeout);
      console.log(
        `[ClaudeCodeProvider] One-shot process closed with exit code: ${exitCode}`
      );

      if (exitCode === 0 && processOutput.trim()) {
        console.log(
          `[ClaudeCodeProvider] One-shot output length: ${processOutput.length}`
        );
        resolve(processOutput.trim());
      } else {
        const error =
          processErrorOutput || `Claude Code exited with code ${exitCode}`;
        console.error(`[ClaudeCodeProvider] One-shot failed: ${error}`);
        reject(new Error(error));
      }
    });

    childProcess.on('error', (err: Error) => {
      clearTimeout(timeout);
      console.error(`[ClaudeCodeProvider] One-shot process error:`, err);
      reject(err);
    });
  }

  private writePromptToProcess(childProcess: ChildProcess, prompt: string) {
    console.log(`[ClaudeCodeProvider] Writing prompt to stdin...`);
    childProcess.stdin?.write(prompt + '\n');
    childProcess.stdin?.end();
    console.log(`[ClaudeCodeProvider] Prompt sent, stdin closed`);
  }
}
