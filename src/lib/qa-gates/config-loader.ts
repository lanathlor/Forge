import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';

/**
 * Convert host path to container path
 * Host: /home/lanath/Work/* -> Container: /workspace/*
 */
function getContainerPath(hostPath: string): string {
  const workspaceRoot = process.env.WORKSPACE_ROOT || '/workspace';
  // If we're in a container and path starts with /home/lanath/Work
  if (hostPath.startsWith('/home/lanath/Work')) {
    return hostPath.replace('/home/lanath/Work', workspaceRoot);
  }
  return hostPath;
}

/**
 * Schema for a single QA gate configuration
 */
const QAGateConfigSchema = z.object({
  name: z.string(),
  enabled: z.boolean().default(true),
  command: z.string(),
  timeout: z.number().default(60000),
  failOnError: z.boolean().default(true),
  order: z.number().optional(),
});

/**
 * Schema for the .autobot.json configuration file
 */
const AutobotConfigSchema = z.object({
  qaGates: z.array(QAGateConfigSchema),
  maxRetries: z.number().default(3).optional(),
  version: z.string().default('1.0').optional(),
});

export type QAGateConfig = z.infer<typeof QAGateConfigSchema>;
export type AutobotConfig = z.infer<typeof AutobotConfigSchema>;

/**
 * Default configuration for repositories without .autobot.json
 */
const DEFAULT_CONFIG: AutobotConfig = {
  version: '1.0',
  maxRetries: 3,
  qaGates: [
    {
      name: 'ESLint',
      enabled: true,
      command: 'pnpm eslint . --ext .ts,.tsx,.js,.jsx',
      timeout: 60000,
      failOnError: true,
      order: 1,
    },
    {
      name: 'TypeScript',
      enabled: true,
      command: 'pnpm tsc --noEmit',
      timeout: 120000,
      failOnError: true,
      order: 2,
    },
    {
      name: 'Tests',
      enabled: false,
      command: 'pnpm test --run',
      timeout: 300000,
      failOnError: false,
      order: 3,
    },
  ],
};

async function loadConfigFromFile(configPath: string): Promise<AutobotConfig> {
  await fs.access(configPath);
  const configContent = await fs.readFile(configPath, 'utf-8');
  const config = AutobotConfigSchema.parse(JSON.parse(configContent));
  config.qaGates.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  return config;
}

function handleConfigError(error: unknown, configPath: string, containerPath: string): AutobotConfig {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
    console.log(`ℹ️ No .autobot.json found in ${containerPath}, using default config`);
    return DEFAULT_CONFIG;
  }
  if (error instanceof Error && error.message === 'Config load timeout') {
    console.error(`⏱️ Timeout loading config from ${configPath}, using default config`);
    return DEFAULT_CONFIG;
  }
  console.error(`❌ Error loading config from ${configPath}:`, error);
  return DEFAULT_CONFIG;
}

/**
 * Load QA gate configuration from repository's .autobot.json file with timeout
 */
export async function loadRepositoryConfig(
  repoPath: string
): Promise<AutobotConfig> {
  const containerPath = getContainerPath(repoPath);
  const configPath = path.join(containerPath, '.autobot.json');

  try {
    const result = await Promise.race([
      loadConfigFromFile(configPath),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Config load timeout')), 5000)
      ),
    ]);
    console.log(`✅ Loaded config from ${configPath}`);
    return result;
  } catch (error) {
    return handleConfigError(error, configPath, containerPath);
  }
}

/**
 * Get enabled QA gates from repository configuration
 */
export async function getEnabledGates(
  repoPath: string
): Promise<QAGateConfig[]> {
  const config = await loadRepositoryConfig(repoPath);
  return config.qaGates.filter((gate) => gate.enabled);
}

/**
 * Validate a configuration object without loading from file
 */
export function validateConfig(config: unknown): AutobotConfig {
  return AutobotConfigSchema.parse(config);
}

import { CONFIG_TEMPLATES } from './config-templates';

/**
 * Create an example .autobot.json file in a repository
 */
export async function createExampleConfig(
  repoPath: string,
  techStack: 'typescript' | 'javascript' | 'python' | 'go' | 'rust'
): Promise<void> {
  const config = CONFIG_TEMPLATES[techStack] || CONFIG_TEMPLATES.typescript;
  const configPath = path.join(repoPath, '.autobot.json');

  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
  console.log(`✅ Created example config at ${configPath}`);
}
