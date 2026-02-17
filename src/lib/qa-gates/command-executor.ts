import { spawn } from 'child_process';
import { existsSync } from 'fs';

export interface CommandError extends Error {
  stdout?: string;
  stderr?: string;
  code?: number | null;
}

export interface ExecOptions {
  cwd: string;
  timeout: number;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
}

/**
 * Get the appropriate bash executable path
 * Tries multiple locations to support Docker/Alpine and NixOS
 */
export function getBashPath(): string {
  const paths = [
    '/bin/bash', // Docker/Alpine/Ubuntu
    '/run/current-system/sw/bin/bash', // NixOS
    'bash', // Fallback to PATH
  ];

  for (const path of paths) {
    if (path === 'bash' || existsSync(path)) {
      return path;
    }
  }

  return 'bash'; // Final fallback
}

/**
 * Convert host path to container path (only if running in container)
 * Host: /home/lanath/Work/* -> Container: /workspace/*
 */
export function getContainerPath(hostPath: string): string {
  // Check if we're running in a Docker container
  // If WORKSPACE_ROOT is not set and /workspace doesn't exist, we're on the host
  const workspaceRoot = process.env.WORKSPACE_ROOT;

  // Only do path conversion if WORKSPACE_ROOT is explicitly set (indicating we're in a container)
  if (workspaceRoot && hostPath.startsWith('/home/lanath/Work')) {
    return hostPath.replace('/home/lanath/Work', workspaceRoot);
  }

  // Otherwise, return the original path (we're running on host)
  return hostPath;
}

function getGitSafeEnv() {
  return {
    ...process.env,
    GIT_CONFIG_COUNT: '3',
    GIT_CONFIG_KEY_0: 'safe.directory',
    GIT_CONFIG_VALUE_0: '*',
    GIT_CONFIG_KEY_1: 'user.name',
    GIT_CONFIG_VALUE_1: 'Forge',
    GIT_CONFIG_KEY_2: 'user.email',
    GIT_CONFIG_VALUE_2: 'forge@example.com',
  };
}

function createCommandError(
  code: number | null,
  stdout: string,
  stderr: string
): CommandError {
  const error: CommandError = new Error(
    `Command failed with exit code ${code}`
  );
  error.stdout = stdout;
  error.stderr = stderr;
  error.code = code;
  return error;
}

/**
 * Execute a command using spawn
 * Works in both Docker/Alpine and NixOS environments
 */
export async function execAsync(
  command: string,
  options: ExecOptions
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    console.log(`[execAsync] Running command: ${command}`);
    console.log(`[execAsync] Working directory: ${options.cwd}`);

    const child = spawn(getBashPath(), ['-c', command], {
      cwd: options.cwd,
      env: getGitSafeEnv(),
      timeout: options.timeout,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`[execAsync] Command succeeded`);
        resolve({ stdout, stderr });
      } else {
        console.error(`[execAsync] Command failed with exit code ${code}`);
        reject(createCommandError(code, stdout, stderr));
      }
    });
  });
}
