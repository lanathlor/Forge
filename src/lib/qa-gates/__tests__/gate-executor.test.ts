import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeGate } from '../gate-executor';
import type { QAGateConfig } from '../config-loader';
import * as commandExecutor from '../command-executor';

// Mock dependencies
vi.mock('@/db', () => {
  const mockDb = {
    insert: vi.fn(() => mockDb),
    values: vi.fn(() => mockDb),
    returning: vi.fn(() => mockDb),
    get: vi.fn(),
    update: vi.fn(() => mockDb),
    set: vi.fn(() => mockDb),
    where: vi.fn(),
  };
  return { db: mockDb };
});

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((field, value) => ({ field, value })),
  relations: vi.fn(),
}));

vi.mock('../command-executor');

describe('Gate Executor', () => {
  const mockGate: QAGateConfig = {
    name: 'Test Gate',
    command: 'npm test',
    timeout: 30000,
    enabled: true,
    failOnError: true,
    order: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock getContainerPath to return the same path
    vi.spyOn(commandExecutor, 'getContainerPath').mockImplementation(
      (path) => path
    );
  });

  it('should execute gate successfully', async () => {
    const { db } = await import('@/db');
    const mockExecution = {
      id: 'exec-123',
      runId: 'run-123',
      gateName: 'Test Gate',
      status: 'running' as const,
    };

    // Mock database operations
    vi.mocked(db.get).mockResolvedValue(mockExecution);

    // Mock successful command execution
    vi.spyOn(commandExecutor, 'execAsync').mockResolvedValue({
      stdout: 'Test passed',
      stderr: '',
    });

    const result = await executeGate({
      runId: 'run-123',
      gate: mockGate,
      repoPath: '/test/repo',
    });

    expect(result).toEqual({
      id: mockExecution.id,
      gateName: mockGate.name,
      status: 'passed',
      duration: expect.any(Number),
    });

    expect(commandExecutor.execAsync).toHaveBeenCalledWith(mockGate.command, {
      cwd: '/test/repo',
      timeout: mockGate.timeout,
    });
  });

  it('should handle gate failure', async () => {
    const { db } = await import('@/db');
    const mockExecution = {
      id: 'exec-456',
      runId: 'run-123',
      gateName: 'Test Gate',
      status: 'running' as const,
    };

    // Mock database operations
    vi.mocked(db.get).mockResolvedValue(mockExecution);

    // Mock failed command execution
    const error = new Error('Command failed with exit code 1') as any;
    error.stdout = 'Some output';
    error.stderr = 'Error output';
    error.code = 1;

    vi.spyOn(commandExecutor, 'execAsync').mockRejectedValue(error);

    const result = await executeGate({
      runId: 'run-123',
      gate: mockGate,
      repoPath: '/test/repo',
    });

    expect(result).toEqual({
      id: mockExecution.id,
      gateName: mockGate.name,
      status: 'failed',
      duration: expect.any(Number),
    });
  });

  it('should use container path for execution', async () => {
    const { db } = await import('@/db');
    const mockExecution = {
      id: 'exec-789',
      runId: 'run-123',
      gateName: 'Test Gate',
      status: 'running' as const,
    };

    vi.mocked(db.get).mockResolvedValue(mockExecution);

    // Mock getContainerPath to transform the path
    vi.spyOn(commandExecutor, 'getContainerPath').mockReturnValue(
      '/workspace/repo'
    );

    vi.spyOn(commandExecutor, 'execAsync').mockResolvedValue({
      stdout: 'Success',
      stderr: '',
    });

    await executeGate({
      runId: 'run-123',
      gate: mockGate,
      repoPath: '/home/lanath/Work/repo',
    });

    expect(commandExecutor.getContainerPath).toHaveBeenCalledWith(
      '/home/lanath/Work/repo'
    );
    expect(commandExecutor.execAsync).toHaveBeenCalledWith(mockGate.command, {
      cwd: '/workspace/repo',
      timeout: mockGate.timeout,
    });
  });

  it('should create gate execution record before running', async () => {
    const { db } = await import('@/db');
    const mockExecution = {
      id: 'exec-new',
      runId: 'run-123',
      gateName: 'Test Gate',
      status: 'running' as const,
    };

    vi.mocked(db.get).mockResolvedValue(mockExecution);

    vi.spyOn(commandExecutor, 'execAsync').mockResolvedValue({
      stdout: 'Success',
      stderr: '',
    });

    await executeGate({
      runId: 'run-123',
      gate: mockGate,
      repoPath: '/test/repo',
    });

    expect(db.insert).toHaveBeenCalled();
    expect(db.values).toHaveBeenCalledWith({
      runId: 'run-123',
      gateName: mockGate.name,
      command: mockGate.command,
      status: 'running',
      order: mockGate.order,
    });
  });

  it('should update gate execution on success', async () => {
    const { db } = await import('@/db');
    const mockExecution = {
      id: 'exec-update',
      runId: 'run-123',
      gateName: 'Test Gate',
      status: 'running' as const,
    };

    vi.mocked(db.get).mockResolvedValue(mockExecution);

    vi.spyOn(commandExecutor, 'execAsync').mockResolvedValue({
      stdout: 'Test output',
      stderr: 'Warning message',
    });

    await executeGate({
      runId: 'run-123',
      gate: mockGate,
      repoPath: '/test/repo',
    });

    expect(db.update).toHaveBeenCalled();
    expect((db as any).set).toHaveBeenCalledWith({
      status: 'passed',
      output: 'Test output',
      error: 'Warning message',
      exitCode: 0,
      duration: expect.any(Number),
      completedAt: expect.any(Date),
    });
  });

  it('should update gate execution on failure', async () => {
    const { db } = await import('@/db');
    const mockExecution = {
      id: 'exec-fail',
      runId: 'run-123',
      gateName: 'Test Gate',
      status: 'running' as const,
    };

    vi.mocked(db.get).mockResolvedValue(mockExecution);

    const error = new Error('Command failed with exit code 2') as any;
    error.stdout = 'Output before failure';
    error.stderr = 'Error details';
    error.code = 2;

    vi.spyOn(commandExecutor, 'execAsync').mockRejectedValue(error);

    await executeGate({
      runId: 'run-123',
      gate: mockGate,
      repoPath: '/test/repo',
    });

    expect(db.update).toHaveBeenCalled();
    expect((db as any).set).toHaveBeenCalledWith({
      status: 'failed',
      output: 'Output before failure',
      error: 'Error details',
      exitCode: 2,
      duration: expect.any(Number),
      completedAt: expect.any(Date),
    });
  });

  it('should handle error without stdout', async () => {
    const { db } = await import('@/db');
    const mockExecution = {
      id: 'exec-no-output',
      runId: 'run-123',
      gateName: 'Test Gate',
      status: 'running' as const,
    };

    vi.mocked(db.get).mockResolvedValue(mockExecution);

    const error = new Error('Spawn error') as any;

    vi.spyOn(commandExecutor, 'execAsync').mockRejectedValue(error);

    const result = await executeGate({
      runId: 'run-123',
      gate: mockGate,
      repoPath: '/test/repo',
    });

    expect(result.status).toBe('failed');
    expect((db as any).set).toHaveBeenCalledWith({
      status: 'failed',
      output: null,
      error: 'Spawn error',
      exitCode: 1,
      duration: expect.any(Number),
      completedAt: expect.any(Date),
    });
  });

  it('should handle stderr in success case', async () => {
    const { db } = await import('@/db');
    const mockExecution = {
      id: 'exec-stderr',
      runId: 'run-123',
      gateName: 'Test Gate',
      status: 'running' as const,
    };

    vi.mocked(db.get).mockResolvedValue(mockExecution);

    vi.spyOn(commandExecutor, 'execAsync').mockResolvedValue({
      stdout: 'Success',
      stderr: '',
    });

    await executeGate({
      runId: 'run-123',
      gate: mockGate,
      repoPath: '/test/repo',
    });

    expect((db as any).set).toHaveBeenCalledWith(
      expect.objectContaining({
        error: null,
      })
    );
  });

  it('should measure execution duration accurately', async () => {
    const { db } = await import('@/db');
    const mockExecution = {
      id: 'exec-duration',
      runId: 'run-123',
      gateName: 'Test Gate',
      status: 'running' as const,
    };

    vi.mocked(db.get).mockResolvedValue(mockExecution);

    // Mock execAsync to take some time
    vi.spyOn(commandExecutor, 'execAsync').mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({ stdout: 'Done', stderr: '' });
          }, 100);
        })
    );

    const result = await executeGate({
      runId: 'run-123',
      gate: mockGate,
      repoPath: '/test/repo',
    });

    expect(result.duration).toBeGreaterThanOrEqual(90);
  });

  it('should use gate order in database record', async () => {
    const { db } = await import('@/db');
    const gateWithOrder: QAGateConfig = {
      ...mockGate,
      order: 5,
    };

    const mockExecution = {
      id: 'exec-order',
      runId: 'run-123',
      gateName: 'Test Gate',
      status: 'running' as const,
    };

    vi.mocked(db.get).mockResolvedValue(mockExecution);

    vi.spyOn(commandExecutor, 'execAsync').mockResolvedValue({
      stdout: 'Success',
      stderr: '',
    });

    await executeGate({
      runId: 'run-123',
      gate: gateWithOrder,
      repoPath: '/test/repo',
    });

    expect(db.values).toHaveBeenCalledWith(
      expect.objectContaining({
        order: 5,
      })
    );
  });
});
