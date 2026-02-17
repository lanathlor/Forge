// import Anthropic from '@anthropic-ai/sdk';
import { Anthropic } from './anthropic-stub';
import { EventEmitter } from 'events';
import { db } from '@/db';
import { tasks } from '@/db/schema/tasks';
import { eq } from 'drizzle-orm';
import type { AIProvider, TaskExecutionOptions, TaskResult } from '../types';

export class ClaudeSDKProvider extends EventEmitter implements AIProvider {
  private anthropic: Anthropic;
  private activeTasks = new Map<string, AbortController>();

  constructor() {
    super();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }

    this.anthropic = new Anthropic({
      apiKey,
    });
  }

  async executeTask(options: TaskExecutionOptions): Promise<TaskResult> {
    const { workingDirectory, prompt, taskId } = options;

    console.log(`[ClaudeSDKProvider] executeTask called for task ${taskId}`);
    console.log(`[ClaudeSDKProvider] Working directory: ${workingDirectory}`);
    console.log(`[ClaudeSDKProvider] Prompt length: ${prompt.length} chars`);

    const abortController = new AbortController();
    this.activeTasks.set(taskId, abortController);

    try {
      const fullOutput = await this.processStreamingTask(taskId, prompt, abortController);

      const result: TaskResult = {
        exitCode: 0,
        output: fullOutput,
      };

      this.emit('complete', { taskId, result });
      console.log(`[ClaudeSDKProvider] Task ${taskId} completed successfully`);

      return result;
    } catch (error) {
      return this.handleTaskError(taskId, error);
    } finally {
      this.activeTasks.delete(taskId);
    }
  }

  private async processStreamingTask(
    taskId: string,
    prompt: string,
    abortController: AbortController
  ): Promise<string> {
    let fullOutput = '';

    const stream = await this.anthropic.messages.create(
      {
        model: this.getModel(),
        max_tokens: this.getMaxTokens(),
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        stream: true,
      },
      {
        signal: abortController.signal,
      }
    ) as AsyncIterable<{ type: string; delta: { type: string; text: string } }>;

    for await (const chunk of stream) {
      if (abortController.signal.aborted) {
        throw new Error('Task was cancelled');
      }

      if (
        chunk.type === 'content_block_delta' &&
        chunk.delta.type === 'text_delta'
      ) {
        const text = chunk.delta.text;
        fullOutput += text;

        // Emit output events for real-time streaming
        this.emit('output', { taskId, output: text, timestamp: new Date() });

        // Append to database
        await this.appendTaskOutput(taskId, text);
      }
    }

    return fullOutput;
  }

  private handleTaskError(taskId: string, error: unknown): TaskResult {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error(`[ClaudeSDKProvider] Task ${taskId} failed:`, errorMessage);

    this.emit('failed', { taskId, error: errorMessage });

    return {
      exitCode: 1,
      output: '',
      error: errorMessage,
    };
  }

  async executeWithStream(
    prompt: string,
    workingDirectory: string,
    onChunk: (text: string) => void,
    timeoutMs = 120000
  ): Promise<string> {
    console.log(`[ClaudeSDKProvider] executeWithStream called`);
    console.log(`[ClaudeSDKProvider] Working directory: ${workingDirectory}`);

    const abortController = new AbortController();

    // Set up timeout
    const timeout = setTimeout(() => {
      abortController.abort();
    }, timeoutMs);

    try {
      const fullOutput = await this.processStreamWithChunks(prompt, onChunk, abortController);

      console.log(
        `[ClaudeSDKProvider] Streaming complete, output length: ${fullOutput.length}`
      );
      return fullOutput;
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new Error(`Streaming execution timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async processStreamWithChunks(
    prompt: string,
    onChunk: (text: string) => void,
    abortController: AbortController
  ): Promise<string> {
    let fullOutput = '';

    const stream = await this.anthropic.messages.create(
      {
        model: this.getModel(),
        max_tokens: this.getMaxTokens(),
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        stream: true,
      },
      {
        signal: abortController.signal,
      }
    ) as AsyncIterable<{ type: string; delta: { type: string; text: string } }>;

    for await (const chunk of stream) {
      if (abortController.signal.aborted) {
        throw new Error('Stream aborted');
      }

      if (
        chunk.type === 'content_block_delta' &&
        chunk.delta.type === 'text_delta'
      ) {
        const text = chunk.delta.text;
        fullOutput += text;
        onChunk(text);
      }
    }

    return fullOutput;
  }

  async executeOneShot(
    prompt: string,
    workingDirectory: string,
    timeoutMs = 30000
  ): Promise<string> {
    console.log(`[ClaudeSDKProvider] executeOneShot called`);
    console.log(`[ClaudeSDKProvider] Working directory: ${workingDirectory}`);

    const abortController = new AbortController();

    // Set up timeout
    const timeout = setTimeout(() => {
      abortController.abort();
    }, timeoutMs);

    try {
      const response = await this.anthropic.messages.create(
        {
          model: this.getModel(),
          max_tokens: this.getMaxTokens(),
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        },
        {
          signal: abortController.signal,
        }
      ) as { content: Array<{ type: string; text: string }> };

      const content = response.content[0];
      if (content?.type === 'text') {
        console.log(
          `[ClaudeSDKProvider] One-shot complete, output length: ${content.text.length}`
        );
        return content.text;
      }

      throw new Error('Unexpected response format from Claude API');
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new Error(`One-shot execution timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async cancel(taskId: string): Promise<void> {
    console.log(`[ClaudeSDKProvider] Cancelling task ${taskId}`);

    const abortController = this.activeTasks.get(taskId);
    if (abortController) {
      abortController.abort();
      this.activeTasks.delete(taskId);
      this.emit('cancelled', { taskId });
      console.log(`[ClaudeSDKProvider] Task ${taskId} cancelled`);
    } else {
      console.log(`[ClaudeSDKProvider] No active task to cancel for ${taskId}`);
    }
  }

  private getModel(): string {
    return process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';
  }

  private getMaxTokens(): number {
    return parseInt(process.env.CLAUDE_MAX_TOKENS || '4096', 10);
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
        `[ClaudeSDKProvider] Updated task ${taskId} output (${existingOutput.length} -> ${newLength} chars)`
      );
    } catch (error) {
      console.error(
        `[ClaudeSDKProvider] Failed to append task output for ${taskId}:`,
        error
      );
    }
  }
}
