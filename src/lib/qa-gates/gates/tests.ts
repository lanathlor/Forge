import type { QAGateConfig } from '@/db/schema/qa-gates';

export const testsGate: Partial<QAGateConfig> = {
  name: 'tests',
  command: 'pnpm test --run',
  timeout: 300000,
  failOnError: false, // Tests can fail but still allow approval (with warning)
  order: 3,
};

/**
 * Parse test runner output (Vitest/Jest) for structured errors
 */
export function parseTestOutput(output: string): {
  passed: boolean;
  errors: string[];
} {
  // Detect Vitest/Jest output
  const passed = output.includes('Test Files') && !output.includes('FAIL');

  if (passed) {
    return { passed: true, errors: [] };
  }

  // Extract failed test names
  const failedTests = output.match(/FAIL .+/g) || [];
  return { passed: false, errors: failedTests };
}
