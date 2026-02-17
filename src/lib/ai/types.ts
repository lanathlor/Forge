export interface TaskExecutionOptions {
  workingDirectory: string;
  prompt: string;
  taskId: string;
}

export interface TaskResult {
  exitCode: number;
  output: string;
  error?: string;
}

import type { EventEmitter } from 'events';

export interface AIProvider extends EventEmitter {
  executeTask(options: TaskExecutionOptions): Promise<TaskResult>;
  executeWithStream(
    prompt: string,
    workingDirectory: string,
    onChunk: (text: string) => void,
    timeoutMs?: number
  ): Promise<string>;
  executeOneShot(
    prompt: string,
    workingDirectory: string,
    timeoutMs?: number
  ): Promise<string>;
  cancel(taskId: string): Promise<void>;
}

export enum AIProviderType {
  CLAUDE_CODE = 'claude-code',
  CLAUDE_SDK = 'claude-sdk',
  CODEX_SDK = 'codex-sdk',
  FAKE = 'fake',
}
