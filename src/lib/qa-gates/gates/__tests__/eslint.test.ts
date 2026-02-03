import { describe, it, expect } from 'vitest';
import { parseEslintOutput } from '../eslint';

describe('ESLint Gate Parser', () => {
  it('should parse successful ESLint output', () => {
    const jsonOutput = JSON.stringify([
      {
        filePath: '/path/to/file.ts',
        messages: [],
        errorCount: 0,
        warningCount: 0,
      },
    ]);

    const result = parseEslintOutput(jsonOutput);

    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should parse ESLint output with errors', () => {
    const jsonOutput = JSON.stringify([
      {
        filePath: '/path/to/file.ts',
        messages: [
          {
            line: 10,
            column: 5,
            message: 'Unexpected console statement',
            ruleId: 'no-console',
          },
          {
            line: 20,
            column: 3,
            message: 'Missing return type',
            ruleId: '@typescript-eslint/explicit-function-return-type',
          },
        ],
        errorCount: 2,
        warningCount: 0,
      },
    ]);

    const result = parseEslintOutput(jsonOutput);

    expect(result.passed).toBe(false);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toContain('/path/to/file.ts:10:5');
    expect(result.errors[0]).toContain('Unexpected console statement');
    expect(result.errors[0]).toContain('no-console');
  });

  it('should parse ESLint output from multiple files', () => {
    const jsonOutput = JSON.stringify([
      {
        filePath: '/path/to/file1.ts',
        messages: [
          {
            line: 5,
            column: 2,
            message: 'Error 1',
            ruleId: 'rule-1',
          },
        ],
        errorCount: 1,
        warningCount: 0,
      },
      {
        filePath: '/path/to/file2.ts',
        messages: [
          {
            line: 15,
            column: 8,
            message: 'Error 2',
            ruleId: 'rule-2',
          },
        ],
        errorCount: 1,
        warningCount: 0,
      },
    ]);

    const result = parseEslintOutput(jsonOutput);

    expect(result.passed).toBe(false);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toContain('file1.ts:5:2');
    expect(result.errors[1]).toContain('file2.ts:15:8');
  });

  it('should handle invalid JSON gracefully', () => {
    const invalidJson = 'not valid json';

    const result = parseEslintOutput(invalidJson);

    expect(result.passed).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toBe(invalidJson);
  });

  it('should handle text output with "0 errors"', () => {
    const textOutput = '\n✨  Done in 2.5s\n0 errors, 0 warnings\n';

    const result = parseEslintOutput(textOutput);

    expect(result.passed).toBe(true);
  });

  it('should handle text output with errors', () => {
    const textOutput = '5 errors, 2 warnings found';

    const result = parseEslintOutput(textOutput);

    expect(result.passed).toBe(false);
    expect(result.errors[0]).toBe(textOutput);
  });
});
