import type { QAGateConfig } from '@/db/schema/qa-gates';

export const eslintGate: Partial<QAGateConfig> = {
  name: 'eslint',
  command: 'pnpm eslint . --ext .ts,.tsx,.js,.jsx',
  timeout: 60000,
  failOnError: true,
  order: 1,
};

/**
 * Parse ESLint JSON output for structured errors
 */
export function parseEslintOutput(output: string): {
  passed: boolean;
  errors: string[];
} {
  try {
    const results = JSON.parse(output);
    const errorCount = results.reduce(
      (sum: number, file: { errorCount: number }) => sum + file.errorCount,
      0
    );

    if (errorCount === 0) {
      return { passed: true, errors: [] };
    }

    const errors = results.flatMap((file: {
      filePath: string;
      messages: Array<{
        line: number;
        column: number;
        message: string;
        ruleId: string;
      }>;
    }) =>
      file.messages.map(
        (msg) =>
          `${file.filePath}:${msg.line}:${msg.column} - ${msg.message} (${msg.ruleId})`
      )
    );

    return { passed: false, errors };
  } catch {
    // Fallback if JSON parsing fails
    return {
      passed: output.includes('0 errors'),
      errors: [output],
    };
  }
}
