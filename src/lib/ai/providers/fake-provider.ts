import { EventEmitter } from 'events';
import type { AIProvider, TaskExecutionOptions, TaskResult } from '../types';

const FAKE_RESPONSES = {
  commitMessage:
    'feat(example): implement new feature\n\nThis is a simulated commit message for testing purposes.',
  codeGeneration:
    "```javascript\n// Simulated code generation\nfunction exampleFunction() {\n  return 'Hello, World!';\n}\n```",
  planGeneration:
    "I'll create a comprehensive plan for this task:\n\n1. Analyze requirements\n2. Design solution\n3. Implement code\n4. Test thoroughly",
  planUpdate: `I'll expand the plan with more detail.

<UPDATES>
[
  {"action": "update_phase", "phaseOrder": 1, "updates": {"description": "Enhanced description with more specific implementation details and technical requirements."}}
]
</UPDATES>`,
  errorResponse:
    'I encountered an error while processing this request. Please check your input and try again.',
  default:
    'This is a simulated AI response for testing purposes. The prompt was processed successfully.',
};

export class FakeAIProvider extends EventEmitter implements AIProvider {
  private readonly delayMs: number;
  private readonly simulateErrors: boolean;
  private readonly errorRate: number;

  constructor() {
    super();
    this.delayMs = parseInt(process.env.FAKE_PROVIDER_DELAY_MS || '1000', 10);
    this.simulateErrors = process.env.FAKE_PROVIDER_SIMULATE_ERRORS === 'true';
    this.errorRate = parseFloat(process.env.FAKE_PROVIDER_ERROR_RATE || '0.1');
  }

  async executeTask(options: TaskExecutionOptions): Promise<TaskResult> {
    const { taskId, prompt } = options;

    console.log(`[FakeAIProvider] executeTask called for task ${taskId}`);
    console.log(`[FakeAIProvider] Prompt length: ${prompt.length} chars`);

    // Simulate processing delay
    await this.simulateDelay();

    // Potentially simulate an error
    if (this.shouldSimulateError()) {
      const error = 'Simulated provider error for testing';
      console.error(`[FakeAIProvider] Task ${taskId} failed: ${error}`);
      this.emit('failed', { taskId, error });
      throw new Error(error);
    }

    const response = this.getResponseForPrompt(prompt);

    // Emit output events to simulate real-time streaming
    this.emit('output', { taskId, output: response, timestamp: new Date() });

    const result: TaskResult = {
      exitCode: 0,
      output: response,
    };

    this.emit('complete', { taskId, result });
    console.log(`[FakeAIProvider] Task ${taskId} completed successfully`);

    return result;
  }

  async executeWithStream(
    prompt: string,
    workingDirectory: string,
    onChunk: (text: string) => void,
    timeoutMs = 120000
  ): Promise<string> {
    console.log(`[FakeAIProvider] executeWithStream called`);
    console.log(`[FakeAIProvider] Working directory: ${workingDirectory}`);
    console.log(`[FakeAIProvider] Timeout: ${timeoutMs}ms`);

    // Potentially simulate an error
    if (this.shouldSimulateError()) {
      throw new Error('Simulated streaming error for testing');
    }

    const response = this.getResponseForPrompt(prompt);

    // Simulate character-by-character streaming
    const words = response.split(' ');
    let fullOutput = '';

    for (const word of words) {
      const chunk = word + ' ';
      fullOutput += chunk;
      onChunk(chunk);

      // Small delay between words for realistic streaming
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    console.log(
      `[FakeAIProvider] Streaming complete, output length: ${fullOutput.length}`
    );
    return fullOutput.trim();
  }

  async executeOneShot(
    prompt: string,
    workingDirectory: string,
    timeoutMs = 30000
  ): Promise<string> {
    console.log(`[FakeAIProvider] executeOneShot called`);
    console.log(`[FakeAIProvider] Working directory: ${workingDirectory}`);
    console.log(`[FakeAIProvider] Timeout: ${timeoutMs}ms`);

    // Simulate processing delay
    await this.simulateDelay();

    // Potentially simulate an error
    if (this.shouldSimulateError()) {
      throw new Error('Simulated one-shot execution error for testing');
    }

    const response = this.getResponseForPrompt(prompt);
    console.log(
      `[FakeAIProvider] One-shot complete, output length: ${response.length}`
    );

    return response;
  }

  async cancel(taskId: string): Promise<void> {
    console.log(`[FakeAIProvider] Cancelling task ${taskId}`);
    this.emit('cancelled', { taskId });
    console.log(`[FakeAIProvider] Task ${taskId} cancelled`);
  }

  private getResponseForPrompt(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();

    // Check for commit message requests
    if (this.isCommitRequest(lowerPrompt)) {
      return FAKE_RESPONSES.commitMessage;
    }

    // Check for plan requests first (before code requests)
    if (this.isPlanRequest(lowerPrompt)) {
      return this.isPlanUpdateRequest(lowerPrompt)
        ? FAKE_RESPONSES.planUpdate
        : FAKE_RESPONSES.planGeneration;
    }

    // Check for code generation requests
    if (this.isCodeRequest(lowerPrompt)) {
      return FAKE_RESPONSES.codeGeneration;
    }

    // Check for error requests
    if (this.isErrorRequest(lowerPrompt)) {
      return FAKE_RESPONSES.errorResponse;
    }

    return FAKE_RESPONSES.default;
  }

  private isCommitRequest(prompt: string): boolean {
    return prompt.includes('commit message') || prompt.includes('git commit');
  }

  private isCodeRequest(prompt: string): boolean {
    return prompt.includes('implement') || prompt.includes('code') || prompt.includes('function');
  }

  private isPlanRequest(prompt: string): boolean {
    return prompt.includes('plan') || prompt.includes('strategy');
  }

  private isPlanUpdateRequest(prompt: string): boolean {
    return prompt.includes('update') || prompt.includes('expand') || prompt.includes('detail');
  }

  private isErrorRequest(prompt: string): boolean {
    return prompt.includes('error') || prompt.includes('fail');
  }

  private async simulateDelay(): Promise<void> {
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }
  }

  private shouldSimulateError(): boolean {
    if (!this.simulateErrors) {
      return false;
    }

    return Math.random() < this.errorRate;
  }
}
