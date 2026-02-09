import { describe, it, expect, vi, beforeEach } from 'vitest';
import { orchestrateQAGates } from '../run-orchestrator';
import type { QAGateConfig } from '../config-loader';
import * as gateExecutor from '../gate-executor';

// Mock dependencies
vi.mock('@/db', () => {
  const mockDb = {
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

vi.mock('../gate-executor');

describe('Run Orchestrator', () => {
  const mockGates: QAGateConfig[] = [
    {
      name: 'TypeScript Check',
      command: 'tsc --noEmit',
      timeout: 30000,
      enabled: true,
      failOnError: true,
      order: 1,
    },
    {
      name: 'ESLint',
      command: 'eslint .',
      timeout: 30000,
      enabled: true,
      failOnError: true,
      order: 2,
    },
    {
      name: 'Tests',
      command: 'npm test',
      timeout: 60000,
      enabled: true,
      failOnError: true,
      order: 3,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should execute all enabled gates successfully', async () => {
    const { db } = await import('@/db');

    // Mock all gates passing
    vi.spyOn(gateExecutor, 'executeGate').mockResolvedValue({
      id: 'exec-id',
      gateName: 'Test Gate',
      status: 'passed',
      duration: 1000,
    });

    await orchestrateQAGates({
      runId: 'run-123',
      repoPath: '/test/repo',
      gates: mockGates,
    });

    // Should execute each gate
    expect(gateExecutor.executeGate).toHaveBeenCalledTimes(3);

    // Should update run status to passed
    expect(db.update).toHaveBeenCalled();
    expect((db as any).set).toHaveBeenCalledWith({
      status: 'passed',
      duration: expect.any(Number),
      completedAt: expect.any(Date),
    });
  });

  it('should stop execution when gate fails and failOnError is true', async () => {
    const { db } = await import('@/db');

    // First gate passes, second gate fails
    vi.spyOn(gateExecutor, 'executeGate')
      .mockResolvedValueOnce({
        id: 'exec-1',
        gateName: 'TypeScript Check',
        status: 'passed',
        duration: 1000,
      })
      .mockResolvedValueOnce({
        id: 'exec-2',
        gateName: 'ESLint',
        status: 'failed',
        duration: 500,
      });

    await orchestrateQAGates({
      runId: 'run-123',
      repoPath: '/test/repo',
      gates: mockGates,
    });

    // Should only execute two gates (stop after failure)
    expect(gateExecutor.executeGate).toHaveBeenCalledTimes(2);

    // Should update run status to failed
    expect((db as any).set).toHaveBeenCalledWith({
      status: 'failed',
      duration: expect.any(Number),
      completedAt: expect.any(Date),
    });
  });

  it('should continue execution when gate fails but failOnError is false', async () => {
    const { db } = await import('@/db');

    const gatesWithOptionalCheck: QAGateConfig[] = [
      {
        name: 'Required Check',
        command: 'npm test',
        timeout: 30000,
        enabled: true,
        failOnError: true,
        order: 1,
      },
      {
        name: 'Optional Check',
        command: 'npm run lint:optional',
        timeout: 30000,
        enabled: true,
        failOnError: false,
        order: 2,
      },
      {
        name: 'Final Check',
        command: 'npm run final',
        timeout: 30000,
        enabled: true,
        failOnError: true,
        order: 3,
      },
    ];

    // Second gate fails but has failOnError: false
    vi.spyOn(gateExecutor, 'executeGate')
      .mockResolvedValueOnce({
        id: 'exec-1',
        gateName: 'Required Check',
        status: 'passed',
        duration: 1000,
      })
      .mockResolvedValueOnce({
        id: 'exec-2',
        gateName: 'Optional Check',
        status: 'failed',
        duration: 500,
      })
      .mockResolvedValueOnce({
        id: 'exec-3',
        gateName: 'Final Check',
        status: 'passed',
        duration: 1000,
      });

    await orchestrateQAGates({
      runId: 'run-123',
      repoPath: '/test/repo',
      gates: gatesWithOptionalCheck,
    });

    // Should execute all three gates
    expect(gateExecutor.executeGate).toHaveBeenCalledTimes(3);

    // Should still pass since the failed gate had failOnError: false
    expect((db as any).set).toHaveBeenCalledWith({
      status: 'passed',
      duration: expect.any(Number),
      completedAt: expect.any(Date),
    });
  });

  it('should only execute enabled gates', async () => {
    const gatesWithDisabled: QAGateConfig[] = [
      {
        name: 'Enabled Gate 1',
        command: 'npm test',
        timeout: 30000,
        enabled: true,
        failOnError: true,
        order: 1,
      },
      {
        name: 'Disabled Gate',
        command: 'npm run disabled',
        timeout: 30000,
        enabled: false,
        failOnError: true,
        order: 2,
      },
      {
        name: 'Enabled Gate 2',
        command: 'npm run check',
        timeout: 30000,
        enabled: true,
        failOnError: true,
        order: 3,
      },
    ];

    vi.spyOn(gateExecutor, 'executeGate').mockResolvedValue({
      id: 'exec-id',
      gateName: 'Test Gate',
      status: 'passed',
      duration: 1000,
    });

    await orchestrateQAGates({
      runId: 'run-123',
      repoPath: '/test/repo',
      gates: gatesWithDisabled,
    });

    // Should only execute enabled gates (2 out of 3)
    expect(gateExecutor.executeGate).toHaveBeenCalledTimes(2);
  });

  it('should handle errors during execution', async () => {
    const { db } = await import('@/db');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock executeGate to throw an error
    vi.spyOn(gateExecutor, 'executeGate').mockRejectedValue(
      new Error('Unexpected error')
    );

    await orchestrateQAGates({
      runId: 'run-123',
      repoPath: '/test/repo',
      gates: mockGates,
    });

    // Should log error
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error executing QA gates:',
      expect.any(Error)
    );

    // Should update run status to failed
    expect((db as any).set).toHaveBeenCalledWith({
      status: 'failed',
      duration: expect.any(Number),
      completedAt: expect.any(Date),
    });

    consoleErrorSpy.mockRestore();
  });

  it('should pass correct parameters to executeGate', async () => {
    vi.spyOn(gateExecutor, 'executeGate').mockResolvedValue({
      id: 'exec-id',
      gateName: 'Test Gate',
      status: 'passed',
      duration: 1000,
    });

    const runId = 'run-456';
    const repoPath = '/my/repo/path';

    await orchestrateQAGates({
      runId,
      repoPath,
      gates: [mockGates[0]!],
    });

    expect(gateExecutor.executeGate).toHaveBeenCalledWith({
      runId,
      gate: mockGates[0]!,
      repoPath,
    });
  });

  it('should execute gates in order', async () => {
    const executionOrder: string[] = [];

    vi.spyOn(gateExecutor, 'executeGate').mockImplementation(
      async ({ gate }) => {
        executionOrder.push(gate.name);
        return {
          id: 'exec-id',
          gateName: gate.name,
          status: 'passed',
          duration: 100,
        };
      }
    );

    await orchestrateQAGates({
      runId: 'run-123',
      repoPath: '/test/repo',
      gates: mockGates,
    });

    expect(executionOrder).toEqual([
      'TypeScript Check',
      'ESLint',
      'Tests',
    ]);
  });

  it('should measure total duration correctly', async () => {
    const { db } = await import('@/db');

    vi.spyOn(gateExecutor, 'executeGate').mockImplementation(
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          id: 'exec-id',
          gateName: 'Test Gate',
          status: 'passed',
          duration: 50,
        };
      }
    );

    await orchestrateQAGates({
      runId: 'run-123',
      repoPath: '/test/repo',
      gates: [mockGates[0]!],
    });

    const setCall = vi.mocked((db as any).set).mock.calls[0][0] as any;
    // Allow for timing imprecision (setTimeout may resolve slightly early)
    expect(setCall.duration).toBeGreaterThanOrEqual(45);
  });

  it('should handle empty gate list', async () => {
    const { db } = await import('@/db');

    vi.spyOn(gateExecutor, 'executeGate').mockResolvedValue({
      id: 'exec-id',
      gateName: 'Test Gate',
      status: 'passed',
      duration: 1000,
    });

    await orchestrateQAGates({
      runId: 'run-123',
      repoPath: '/test/repo',
      gates: [],
    });

    // Should not execute any gates
    expect(gateExecutor.executeGate).not.toHaveBeenCalled();

    // Should still update run as passed
    expect((db as any).set).toHaveBeenCalledWith({
      status: 'passed',
      duration: expect.any(Number),
      completedAt: expect.any(Date),
    });
  });

  it('should handle all gates disabled', async () => {
    const { db } = await import('@/db');

    const allDisabledGates: QAGateConfig[] = mockGates.map((gate) => ({
      ...gate,
      enabled: false,
    }));

    vi.spyOn(gateExecutor, 'executeGate').mockResolvedValue({
      id: 'exec-id',
      gateName: 'Test Gate',
      status: 'passed',
      duration: 1000,
    });

    await orchestrateQAGates({
      runId: 'run-123',
      repoPath: '/test/repo',
      gates: allDisabledGates,
    });

    // Should not execute any gates
    expect(gateExecutor.executeGate).not.toHaveBeenCalled();

    // Should still update run as passed
    expect((db as any).set).toHaveBeenCalledWith({
      status: 'passed',
      duration: expect.any(Number),
      completedAt: expect.any(Date),
    });
  });
});
