import type { QAGateConfig } from '@/db/schema/qa-gates';

export const typescriptGate: Partial<QAGateConfig> = {
  name: 'typescript',
  command: 'pnpm tsc --noEmit --pretty false',
  timeout: 120000,
  failOnError: true,
  order: 2,
};

/**
 * Parse TypeScript compiler output for structured errors
 */
export function parseTypescriptOutput(output: string): {
  passed: boolean;
  errors: string[];
} {
  if (!output.includes('error TS')) {
    return { passed: true, errors: [] };
  }

  const errorRegex = /(.+?)\((\d+),(\d+)\): error TS(\d+): (.+)/g;
  const errors: string[] = [];
  let match;

  while ((match = errorRegex.exec(output)) !== null) {
    const [, file, line, col, code, message] = match;
    errors.push(`${file}:${line}:${col} - TS${code}: ${message}`);
  }

  return {
    passed: false,
    errors: errors.length > 0 ? errors : [output],
  };
}
