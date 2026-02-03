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
 * Convert host path to container path
 * Host: /home/lanath/Work/* -> Container: /workspace/*
 */
export function getContainerPath(hostPath: string): string {
  const workspaceRoot = process.env.WORKSPACE_ROOT || '/workspace';
  // If we're in a container and path starts with /home/lanath/Work
  if (hostPath.startsWith('/home/lanath/Work')) {
    return hostPath.replace('/home/lanath/Work', workspaceRoot);
  }
  return hostPath;
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
    const bashPath = getBashPath();
    const child = spawn(bashPath, ['-c', command], {
      cwd: options.cwd,
      env: process.env,
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
        resolve({ stdout, stderr });
      } else {
        const error: CommandError = new Error(
          `Command failed with exit code ${code}`
        );
        error.stdout = stdout;
        error.stderr = stderr;
        error.code = code;
        reject(error);
      }
    });
  });
}
