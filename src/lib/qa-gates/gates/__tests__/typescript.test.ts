import { describe, it, expect } from 'vitest';
import { parseTypescriptOutput } from '../typescript';

describe('TypeScript Gate Parser', () => {
  it('should parse successful TypeScript output', () => {
    const output = '';

    const result = parseTypescriptOutput(output);

    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should parse TypeScript errors', () => {
    const output = `
src/app/page.tsx(15,3): error TS2322: Type 'string' is not assignable to type 'number'.
src/lib/utils.ts(42,10): error TS2304: Cannot find name 'unknownVar'.
    `.trim();

    const result = parseTypescriptOutput(output);

    expect(result.passed).toBe(false);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toContain('src/app/page.tsx:15:3');
    expect(result.errors[0]).toContain('TS2322');
    expect(result.errors[0]).toContain("Type 'string' is not assignable to type 'number'");
    expect(result.errors[1]).toContain('src/lib/utils.ts:42:10');
    expect(result.errors[1]).toContain('TS2304');
  });

  it('should handle multiple errors in single file', () => {
    const output = `
src/app/page.tsx(10,5): error TS2322: Type error 1.
src/app/page.tsx(20,8): error TS2304: Type error 2.
src/app/page.tsx(30,1): error TS2345: Type error 3.
    `.trim();

    const result = parseTypescriptOutput(output);

    expect(result.passed).toBe(false);
    expect(result.errors).toHaveLength(3);
  });

  it('should handle output without error TS keyword', () => {
    const output = 'Some other output without TS errors';

    const result = parseTypescriptOutput(output);

    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should extract error code correctly', () => {
    const output = 'src/file.ts(5,10): error TS1234: Some error message.';

    const result = parseTypescriptOutput(output);

    expect(result.errors[0]).toContain('TS1234');
  });

  it('should handle complex file paths', () => {
    const output =
      'src/features/qa-gates/components/QAGateResults.tsx(25,15): error TS2345: Argument error.';

    const result = parseTypescriptOutput(output);

    expect(result.passed).toBe(false);
    expect(result.errors[0]).toContain(
      'src/features/qa-gates/components/QAGateResults.tsx:25:15'
    );
  });

  it('should return raw output if regex fails to match', () => {
    const output = 'error TS1234: but missing file location';

    const result = parseTypescriptOutput(output);

    expect(result.passed).toBe(false);
    expect(result.errors[0]).toBe(output);
  });
});
