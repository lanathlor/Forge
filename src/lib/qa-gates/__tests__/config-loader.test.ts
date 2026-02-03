import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import {
  loadRepositoryConfig,
  getEnabledGates,
  validateConfig,
  createExampleConfig,
  type AutobotConfig,
} from '../config-loader';

// Mock fs/promises
vi.mock('fs/promises', () => {
  return {
    default: {
      access: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
    },
  };
});

describe('QA Gate Config Loader', () => {
  const mockRepoPath = '/test/repo';
  const mockConfigPath = path.join(mockRepoPath, '.autobot.json');

  let mockAccess: ReturnType<typeof vi.fn>;
  let mockReadFile: ReturnType<typeof vi.fn>;
  let mockWriteFile: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Get fresh references to the mocked functions
    mockAccess = vi.mocked(fs.access);
    mockReadFile = vi.mocked(fs.readFile);
    mockWriteFile = vi.mocked(fs.writeFile);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadRepositoryConfig', () => {
    it('should load and parse valid config file', async () => {
      const validConfig: AutobotConfig = {
        version: '1.0',
        maxRetries: 3,
        qaGates: [
          {
            name: 'ESLint',
            enabled: true,
            command: 'pnpm eslint .',
            timeout: 60000,
            failOnError: true,
            order: 1,
          },
        ],
      };

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(JSON.stringify(validConfig));

      const result = await loadRepositoryConfig(mockRepoPath);

      expect(result).toEqual(validConfig);
      expect(mockAccess).toHaveBeenCalledWith(mockConfigPath);
      expect(mockReadFile).toHaveBeenCalledWith(mockConfigPath, 'utf-8');
    });

    it('should return default config when file does not exist', async () => {
      const error = new Error('ENOENT');
      (error as NodeJS.ErrnoException).code = 'ENOENT';
      mockAccess.mockRejectedValue(error);

      const result = await loadRepositoryConfig(mockRepoPath);

      expect(result.qaGates).toHaveLength(3); // Default config has 3 gates
      expect(result.maxRetries).toBe(3);
      expect(result.version).toBe('1.0');
    });

    it('should sort gates by order field', async () => {
      const unorderedConfig: AutobotConfig = {
        version: '1.0',
        maxRetries: 3,
        qaGates: [
          {
            name: 'Tests',
            enabled: true,
            command: 'pnpm test',
            timeout: 60000,
            failOnError: true,
            order: 3,
          },
          {
            name: 'ESLint',
            enabled: true,
            command: 'pnpm eslint .',
            timeout: 60000,
            failOnError: true,
            order: 1,
          },
          {
            name: 'TypeScript',
            enabled: true,
            command: 'pnpm tsc --noEmit',
            timeout: 60000,
            failOnError: true,
            order: 2,
          },
        ],
      };

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(JSON.stringify(unorderedConfig));

      const result = await loadRepositoryConfig(mockRepoPath);

      expect(result.qaGates[0]?.name).toBe('ESLint');
      expect(result.qaGates[1]?.name).toBe('TypeScript');
      expect(result.qaGates[2]?.name).toBe('Tests');
    });

    it('should handle invalid JSON gracefully', async () => {
      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue('invalid json {');

      // Suppress expected error console output
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await loadRepositoryConfig(mockRepoPath);

      // Should fall back to default config
      expect(result.qaGates).toHaveLength(3);
      expect(result.maxRetries).toBe(3);

      consoleError.mockRestore();
    });

    it('should handle invalid schema gracefully', async () => {
      const invalidConfig = {
        version: '1.0',
        qaGates: [
          {
            // Missing required 'name' field
            enabled: true,
            command: 'pnpm eslint .',
          },
        ],
      };

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(JSON.stringify(invalidConfig));

      // Suppress expected error console output
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await loadRepositoryConfig(mockRepoPath);

      // Should fall back to default config
      expect(result.qaGates).toHaveLength(3);

      consoleError.mockRestore();
    });

    it('should use default values for optional fields', async () => {
      const minimalConfig = {
        qaGates: [
          {
            name: 'ESLint',
            command: 'pnpm eslint .',
          },
        ],
      };

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(JSON.stringify(minimalConfig));

      const result = await loadRepositoryConfig(mockRepoPath);

      expect(result.qaGates[0]?.enabled).toBe(true); // Default
      expect(result.qaGates[0]?.timeout).toBe(60000); // Default
      expect(result.qaGates[0]?.failOnError).toBe(true); // Default
    });
  });

  describe('getEnabledGates', () => {
    it('should return only enabled gates', async () => {
      const config: AutobotConfig = {
        version: '1.0',
        maxRetries: 3,
        qaGates: [
          {
            name: 'ESLint',
            enabled: true,
            command: 'pnpm eslint .',
            timeout: 60000,
            failOnError: true,
          },
          {
            name: 'TypeScript',
            enabled: false,
            command: 'pnpm tsc --noEmit',
            timeout: 60000,
            failOnError: true,
          },
          {
            name: 'Tests',
            enabled: true,
            command: 'pnpm test',
            timeout: 60000,
            failOnError: true,
          },
        ],
      };

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(JSON.stringify(config));

      const result = await getEnabledGates(mockRepoPath);

      expect(result).toHaveLength(2);
      expect(result[0]?.name).toBe('ESLint');
      expect(result[1]?.name).toBe('Tests');
    });

    it('should return empty array when no gates are enabled', async () => {
      const config: AutobotConfig = {
        version: '1.0',
        maxRetries: 3,
        qaGates: [
          {
            name: 'ESLint',
            enabled: false,
            command: 'pnpm eslint .',
            timeout: 60000,
            failOnError: true,
          },
        ],
      };

      mockAccess.mockResolvedValue(undefined);
      mockReadFile.mockResolvedValue(JSON.stringify(config));

      const result = await getEnabledGates(mockRepoPath);

      expect(result).toHaveLength(0);
    });
  });

  describe('validateConfig', () => {
    it('should validate a correct config', () => {
      const validConfig = {
        version: '1.0',
        maxRetries: 3,
        qaGates: [
          {
            name: 'ESLint',
            enabled: true,
            command: 'pnpm eslint .',
            timeout: 60000,
            failOnError: true,
            order: 1,
          },
        ],
      };

      const result = validateConfig(validConfig);

      expect(result).toEqual(validConfig);
    });

    it('should throw error for invalid config', () => {
      const invalidConfig = {
        qaGates: [
          {
            // Missing required 'name' field
            command: 'pnpm eslint .',
          },
        ],
      };

      expect(() => validateConfig(invalidConfig)).toThrow();
    });

    it('should throw error when qaGates is not an array', () => {
      const invalidConfig = {
        qaGates: 'not an array',
      };

      expect(() => validateConfig(invalidConfig)).toThrow();
    });
  });

  describe('createExampleConfig', () => {
    it('should create typescript example config', async () => {
      mockWriteFile.mockResolvedValue(undefined);

      await createExampleConfig(mockRepoPath, 'typescript');

      expect(mockWriteFile).toHaveBeenCalledWith(
        mockConfigPath,
        expect.stringContaining('ESLint'),
        'utf-8'
      );
      expect(mockWriteFile).toHaveBeenCalledWith(
        mockConfigPath,
        expect.stringContaining('TypeScript'),
        'utf-8'
      );
    });

    it('should create python example config', async () => {
      mockWriteFile.mockResolvedValue(undefined);

      await createExampleConfig(mockRepoPath, 'python');

      expect(mockWriteFile).toHaveBeenCalledWith(
        mockConfigPath,
        expect.stringContaining('Ruff'),
        'utf-8'
      );
      expect(mockWriteFile).toHaveBeenCalledWith(
        mockConfigPath,
        expect.stringContaining('MyPy'),
        'utf-8'
      );
    });

    it('should create go example config', async () => {
      mockWriteFile.mockResolvedValue(undefined);

      await createExampleConfig(mockRepoPath, 'go');

      expect(mockWriteFile).toHaveBeenCalledWith(
        mockConfigPath,
        expect.stringContaining('Go Fmt'),
        'utf-8'
      );
    });

    it('should create rust example config', async () => {
      mockWriteFile.mockResolvedValue(undefined);

      await createExampleConfig(mockRepoPath, 'rust');

      expect(mockWriteFile).toHaveBeenCalledWith(
        mockConfigPath,
        expect.stringContaining('Clippy'),
        'utf-8'
      );
    });

    it('should create javascript example config', async () => {
      mockWriteFile.mockResolvedValue(undefined);

      await createExampleConfig(mockRepoPath, 'javascript');

      expect(mockWriteFile).toHaveBeenCalledWith(
        mockConfigPath,
        expect.stringContaining('ESLint'),
        'utf-8'
      );
    });
  });
});
