import { describe, it, expect } from 'vitest';
import { parseTestOutput } from '../tests';

describe('Tests Gate Parser', () => {
  it('should parse successful test output', () => {
    const output = `
 ✓ src/lib/utils.test.ts (5 tests) 125ms
 Test Files  3 passed (3)
      Tests  15 passed (15)
   Start at  10:30:00
   Duration  2.5s
    `.trim();

    const result = parseTestOutput(output);

    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should parse failed test output', () => {
    const output = `
 ✓ src/lib/utils.test.ts (5 tests) 125ms
 FAIL src/lib/qa-gates/runner.test.ts
 FAIL src/components/Button.test.tsx
 Test Files  1 passed, 2 failed (3)
      Tests  5 passed, 2 failed (7)
    `.trim();

    const result = parseTestOutput(output);

    expect(result.passed).toBe(false);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toContain('FAIL src/lib/qa-gates/runner.test.ts');
    expect(result.errors[1]).toContain('FAIL src/components/Button.test.tsx');
  });

  it('should handle Vitest output', () => {
    const output = `
 ✓ tests/unit/feature.test.ts (3)
 Test Files  5 passed (5)
      Tests  20 passed (20)
    `.trim();

    const result = parseTestOutput(output);

    expect(result.passed).toBe(true);
  });

  it('should handle Jest output', () => {
    const output = `
 PASS  src/__tests__/App.test.tsx
 PASS  src/__tests__/utils.test.ts
 Test Files  2 passed (2)
 Tests:       15 passed, 15 total
    `.trim();

    const result = parseTestOutput(output);

    expect(result.passed).toBe(true);
  });

  it('should detect failure without Test Files keyword', () => {
    const output = `
 PASS  src/__tests__/App.test.tsx
 Some output without FAIL keyword
    `.trim();

    const result = parseTestOutput(output);

    // Parser checks for "Test Files" keyword, so this should be considered a failure
    expect(result.passed).toBe(false);
  });

  it('should handle empty output', () => {
    const output = '';

    const result = parseTestOutput(output);

    expect(result.passed).toBe(false);
  });

  it('should extract all FAIL lines', () => {
    const output = `
 FAIL src/test1.ts
 FAIL src/test2.ts
 FAIL src/test3.ts
    `.trim();

    const result = parseTestOutput(output);

    expect(result.errors).toHaveLength(3);
  });
});
