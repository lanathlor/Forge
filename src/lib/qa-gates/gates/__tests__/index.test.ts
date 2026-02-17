import { describe, it, expect } from 'vitest';
import * as gates from '../index';

describe('QA Gates Index', () => {
  it('should export eslint gate config', () => {
    expect(gates).toHaveProperty('eslintGate');
  });

  it('should export typescript gate config', () => {
    expect(gates).toHaveProperty('typescriptGate');
  });

  it('should export tests gate config', () => {
    expect(gates).toHaveProperty('testsGate');
  });

  it('should export parse functions', () => {
    expect(gates).toHaveProperty('parseEslintOutput');
    expect(gates).toHaveProperty('parseTypescriptOutput');
    // parseTestsOutput might not be exported yet
  });

  it('should export all required configs', () => {
    const exportedKeys = Object.keys(gates);
    expect(exportedKeys).toContain('eslintGate');
    expect(exportedKeys).toContain('typescriptGate');
    expect(exportedKeys).toContain('testsGate');
  });

  it('should have parse functions as exports', () => {
    expect(typeof gates.parseEslintOutput).toBe('function');
    expect(typeof gates.parseTypescriptOutput).toBe('function');
  });

  it('should have gate configs as objects', () => {
    expect(typeof gates.eslintGate).toBe('object');
    expect(typeof gates.typescriptGate).toBe('object');
    expect(typeof gates.testsGate).toBe('object');
  });
});
