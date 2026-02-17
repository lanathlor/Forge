// import OpenAI from 'openai';
import { OpenAI } from './openai-stub';
import { EventEmitter } from 'events';
import { db } from '@/db';
import { tasks } from '@/db/schema/tasks';
import { eq } from 'drizzle-orm';
import type { AIProvider, TaskExecutionOptions, TaskResult } from '../types';

export class CodexSDKProvider extends EventEmitter implements AIProvider {
  private openai: OpenAI;
  private activeTasks = new Map<string, AbortController>();

  constructor() {
    super();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.openai = new OpenAI({
      apiKey,
    });
  }

  async executeTask(options: TaskExecutionOptions): Promise<TaskResult> {
    const { workingDirectory, prompt, taskId } = options;

    console.log(`[CodexSDKProvider] executeTask called for task ${taskId}`);
    console.log(`[CodexSDKProvider] Working directory: ${workingDirectory}`);
    console.log(`[CodexSDKProvider] Prompt length: ${prompt.length} chars`);

    const abortController = new AbortController();
    this.activeTasks.set(taskId, abortController);

    try {
      const fullOutput = await this.processCodexStreamingTask(
        taskId,
        prompt,
        abortController
      );

      const result: TaskResult = {
        exitCode: 0,
        output: fullOutput,
      };

      this.emit('complete', { taskId, result });
      console.log(`[CodexSDKProvider] Task ${taskId} completed successfully`);

      return result;
    } catch (error) {
      return this.handleCodexTaskError(taskId, error);
    } finally {
      this.activeTasks.delete(taskId);
    }
  }

  private createCodexStream(prompt: string, signal: AbortSignal): Promise<AsyncIterable<{ choices: Array<{ delta: { content?: string } }> }>> {
    return this.openai.chat.completions.create(
      {
        model: this.getModel(),
        max_tokens: this.getMaxTokens(),
        messages: [
          {
            role: 'system',
            content:
              'You are Claude Code, a helpful AI assistant specialized in software development tasks. You have access to various tools and can help with coding, debugging, and project management.',
          },
          { role: 'user', content: prompt },
        ],
        stream: true,
        temperature: 0.1,
      },
      { signal }
    ) as Promise<AsyncIterable<{ choices: Array<{ delta: { content?: string } }> }>>;
  }

  private async processCodexStreamingTask(
    taskId: string,
    prompt: string,
    abortController: AbortController
  ): Promise<string> {
    let fullOutput = '';
    const stream = await this.createCodexStream(prompt, abortController.signal);

    for await (const chunk of stream) {
      if (abortController.signal.aborted) {
        throw new Error('Task was cancelled');
      }

      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullOutput += content;
        this.emit('output', { taskId, output: content, timestamp: new Date() });
        await this.appendTaskOutput(taskId, content);
      }
    }

    return fullOutput;
  }

  private handleCodexTaskError(taskId: string, error: unknown): TaskResult {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error(`[CodexSDKProvider] Task ${taskId} failed:`, errorMessage);

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
    console.log(`[CodexSDKProvider] executeWithStream called`);
    console.log(`[CodexSDKProvider] Working directory: ${workingDirectory}`);

    const abortController = new AbortController();

    // Set up timeout
    const timeout = setTimeout(() => {
      abortController.abort();
    }, timeoutMs);

    try {
      const fullOutput = await this.processCodexStreamWithChunks(
        prompt,
        onChunk,
        abortController,
        timeoutMs
      );

      console.log(
        `[CodexSDKProvider] Streaming complete, output length: ${fullOutput.length}`
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

  private async processCodexStreamWithChunks(
    prompt: string,
    onChunk: (text: string) => void,
    abortController: AbortController,
    timeoutMs: number
  ): Promise<string> {
    let fullOutput = '';

    const stream = await this.openai.chat.completions.create(
      {
        model: this.getModel(),
        max_tokens: this.getMaxTokens(),
        messages: [
          {
            role: 'system',
            content:
              'You are Claude Code, a helpful AI assistant specialized in software development tasks. You have access to various tools and can help with coding, debugging, and project management.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        stream: true,
        temperature: 0.1,
      },
      {
        signal: abortController.signal,
      }
    ) as AsyncIterable<{ choices: Array<{ delta: { content?: string } }> }>;

    for await (const chunk of stream) {
      if (abortController.signal.aborted) {
        throw new Error(`Streaming execution timed out after ${timeoutMs}ms`);
      }

      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullOutput += content;
        onChunk(content);
      }
    }

    return fullOutput;
  }

  async executeOneShot(
    prompt: string,
    workingDirectory: string,
    timeoutMs = 30000
  ): Promise<string> {
    console.log(`[CodexSDKProvider] executeOneShot called`);
    console.log(`[CodexSDKProvider] Working directory: ${workingDirectory}`);

    const abortController = new AbortController();

    // Set up timeout
    const timeout = setTimeout(() => {
      abortController.abort();
    }, timeoutMs);

    try {
      const response = await this.createCodexCompletion(prompt, abortController);
      const content = response.choices[0]?.message?.content;

      if (content) {
        console.log(
          `[CodexSDKProvider] One-shot complete, output length: ${content.length}`
        );
        return content;
      }

      throw new Error('Unexpected response format from OpenAI API');
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new Error(`One-shot execution timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async createCodexCompletion(prompt: string, abortController: AbortController): Promise<{ choices: Array<{ message: { content?: string } }> }> {
    return await this.openai.chat.completions.create(
      {
        model: this.getModel(),
        max_tokens: this.getMaxTokens(),
        messages: [
          {
            role: 'system',
            content:
              'You are Claude Code, a helpful AI assistant specialized in software development tasks. You have access to various tools and can help with coding, debugging, and project management.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
      },
      {
        signal: abortController.signal,
      }
    ) as Promise<{ choices: Array<{ message: { content?: string } }> }>;
  }

  async cancel(taskId: string): Promise<void> {
    console.log(`[CodexSDKProvider] Cancelling task ${taskId}`);

    const abortController = this.activeTasks.get(taskId);
    if (abortController) {
      abortController.abort();
      this.activeTasks.delete(taskId);
      this.emit('cancelled', { taskId });
      console.log(`[CodexSDKProvider] Task ${taskId} cancelled`);
    } else {
      console.log(`[CodexSDKProvider] No active task to cancel for ${taskId}`);
    }
  }

  private getModel(): string {
    // Use GPT-4 or GPT-3.5-turbo for code generation
    // Note: The original "code-davinci-002" Codex model is deprecated
    return process.env.CODEX_MODEL || 'gpt-4-turbo-preview';
  }

  private getMaxTokens(): number {
    return parseInt(process.env.CODEX_MAX_TOKENS || '4096', 10);
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
        `[CodexSDKProvider] Updated task ${taskId} output (${existingOutput.length} -> ${newLength} chars)`
      );
    } catch (error) {
      console.error(
        `[CodexSDKProvider] Failed to append task output for ${taskId}:`,
        error
      );
    }
  }
}
