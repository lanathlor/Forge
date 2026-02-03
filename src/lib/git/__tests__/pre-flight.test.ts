import { describe, it, expect } from 'vitest';
import type { PreFlightResult } from '../pre-flight';

describe('Pre-flight Checks', () => {
  describe('Module Structure', () => {
    it('should export runPreFlightChecks function', async () => {
      const testModule = await import('../pre-flight');
      expect(testModule.runPreFlightChecks).toBeDefined();
      expect(typeof testModule.runPreFlightChecks).toBe('function');
    });

    it('should have proper PreFlightResult type structure', () => {
      const validSuccessResult: PreFlightResult = {
        passed: true,
        currentCommit: 'abc123',
        currentBranch: 'main',
        isClean: true,
      };

      expect(validSuccessResult).toHaveProperty('passed');
      expect(validSuccessResult.passed).toBe(true);
      expect(typeof validSuccessResult.currentCommit).toBe('string');
      expect(typeof validSuccessResult.currentBranch).toBe('string');
      expect(typeof validSuccessResult.isClean).toBe('boolean');
    });

    it('should have proper PreFlightResult error structure', () => {
      const validErrorResult: PreFlightResult = {
        passed: false,
        error: 'Some error message',
      };

      expect(validErrorResult).toHaveProperty('passed');
      expect(validErrorResult.passed).toBe(false);
      expect(typeof validErrorResult.error).toBe('string');
    });

    it('should accept result with all optional fields', () => {
      const minimalResult: PreFlightResult = {
        passed: true,
      };

      expect(minimalResult).toHaveProperty('passed');
      expect(minimalResult.error).toBeUndefined();
      expect(minimalResult.currentCommit).toBeUndefined();
    });
  });

  describe('Type Definitions', () => {
    it('should define PreFlightResult with correct shape', () => {
      const result: PreFlightResult = {
        passed: true,
        error: 'optional',
        currentCommit: 'sha',
        currentBranch: 'main',
        isClean: false,
      };

      // Test that all expected properties exist
      expect('passed' in result).toBe(true);
      expect('error' in result).toBe(true);
      expect('currentCommit' in result).toBe(true);
      expect('currentBranch' in result).toBe(true);
      expect('isClean' in result).toBe(true);
    });

    it('should allow passed=false with error message', () => {
      const errorResult: PreFlightResult = {
        passed: false,
        error: 'Git repository not found',
      };

      expect(errorResult.passed).toBe(false);
      expect(errorResult.error).toBeTruthy();
    });

    it('should allow passed=true with git information', () => {
      const successResult: PreFlightResult = {
        passed: true,
        currentCommit: 'abc123def456',
        currentBranch: 'feature/test',
        isClean: true,
      };

      expect(successResult.passed).toBe(true);
      expect(successResult.currentCommit).toBeTruthy();
      expect(successResult.currentBranch).toBeTruthy();
      expect(typeof successResult.isClean).toBe('boolean');
    });
  });
});
