export interface QAGate {
  name: string;
  enabled: boolean;
  command: string;
  timeout: number;
  failOnError: boolean;
  order?: number;
}

export interface QAGatesConfigData {
  repository: {
    id: string;
    name: string;
    path: string;
  };
  config: {
    version: string;
    maxRetries: number;
    qaGates: QAGate[];
    hasCustomConfig: boolean;
  };
}

export interface QAGatesConfigProps {
  repositoryId: string;
}

export type QARunStatus = 'running' | 'passed' | 'failed' | 'cancelled';

export type QAGateExecutionStatus =
  | 'pending'
  | 'running'
  | 'passed'
  | 'failed'
  | 'skipped';

export interface QAGateExecutionResult {
  id: string;
  runId: string;
  gateName: string;
  command: string;
  status: QAGateExecutionStatus;
  output: string | null;
  error: string | null;
  exitCode: number | null;
  duration: number | null;
  startedAt: Date;
  completedAt: Date | null;
  order: number;
}

export interface QARunResult {
  id: string;
  repositoryId: string;
  status: QARunStatus;
  startedAt: Date;
  completedAt: Date | null;
  duration: number | null;
}

export interface QARunStatusData {
  hasRun: boolean;
  run: QARunResult | null;
  gates: QAGateExecutionResult[];
}
