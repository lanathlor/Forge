import { spawn } from 'child_process';
import { existsSync, type Dirent } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import type { DiscoveredRepository } from '../types';

interface CommandError extends Error {
  stdout?: string;
  stderr?: string;
}

/**
 * Get the appropriate bash executable path
 * Tries multiple locations to support Docker/Alpine and NixOS
 */
function getBashPath(): string {
  const paths = [
    '/bin/bash', // Ubuntu / full Docker images
    '/run/current-system/sw/bin/bash', // NixOS
    '/bin/sh', // Alpine Linux (no bash by default)
    '/usr/bin/sh', // Some other environments
  ];

  for (const p of paths) {
    if (existsSync(p)) {
      return p;
    }
  }

  return 'sh'; // Final fallback to PATH
}

/**
 * Execute a command using spawn
 * Works in both Docker/Alpine and NixOS environments
 */
async function execAsync(
  command: string,
  options: { cwd: string }
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const bashPath = getBashPath();

    // Add git safe.directory configuration to trust all directories
    // This fixes "dubious ownership" errors when running as different user
    const env = {
      ...process.env,
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'safe.directory',
      GIT_CONFIG_VALUE_0: '*',
    };

    const child = spawn(bashPath, ['-c', command], {
      cwd: options.cwd,
      env,
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
        reject(error);
      }
    });
  });
}

export async function discoverRepositories(
  rootDir: string
): Promise<DiscoveredRepository[]> {
  console.log('[Scanner] Starting discoverRepositories with rootDir:', rootDir);

  const gitDirs = await findGitDirectories(rootDir);
  console.log(`[Scanner] Found ${gitDirs.length} .git directories:`, gitDirs);

  const repos = await Promise.all(
    gitDirs.map(async (gitDir) => {
      const repoPath = path.dirname(gitDir);
      const name = path.basename(repoPath);
      console.log(`[Scanner] Processing repository: ${name} at ${repoPath}`);

      try {
        const [currentBranch, lastCommit, isClean, uncommittedFiles] =
          await Promise.all([
            getCurrentBranch(repoPath),
            getLastCommit(repoPath),
            isWorkingDirectoryClean(repoPath),
            getUncommittedFiles(repoPath),
          ]);

        return {
          id: crypto.randomUUID(),
          name,
          path: repoPath,
          currentBranch,
          lastCommit,
          isClean,
          uncommittedFiles,
        };
      } catch (error) {
        console.error(`Error scanning ${repoPath}:`, error);
        return null;
      }
    })
  );

  return repos.filter((r) => r !== null) as DiscoveredRepository[];
}

function shouldIgnoreDirectory(name: string): boolean {
  return (
    name === 'node_modules' ||
    name.startsWith('.') ||
    name === 'vendor'
  );
}

async function processDirectoryEntry(
  entry: Dirent,
  rootDir: string,
  depth: number
): Promise<string[]> {
  if (!entry.isDirectory()) return [];

  const fullPath = path.join(rootDir, entry.name);

  if (entry.name === '.git') {
    console.log(`[Scanner] ✓ Found .git directory at ${fullPath}`);
    return [fullPath];
  }

  if (shouldIgnoreDirectory(entry.name)) {
    console.log(`[Scanner] ⊗ Skipping ignored directory: ${entry.name}`);
    return [];
  }

  console.log(`[Scanner] → Recursing into: ${fullPath}`);
  return await findGitDirectories(fullPath, depth + 1);
}

async function findGitDirectories(
  rootDir: string,
  depth: number = 0
): Promise<string[]> {
  if (depth > 10) {
    console.log(`[Scanner] Max depth (10) reached at ${rootDir}`);
    return [];
  }

  try {
    console.log(`[Scanner] Scanning directory (depth ${depth}): ${rootDir}`);
    const entries = await fs.readdir(rootDir, { withFileTypes: true });
    console.log(
      `[Scanner] Found ${entries.length} entries in ${rootDir}:`,
      entries.map((e) => `${e.name}${e.isDirectory() ? '/' : ''}`).join(', ')
    );

    const results = await Promise.all(
      entries.map((entry) => processDirectoryEntry(entry, rootDir, depth))
    );
    const gitDirs = results.flat();

    if (gitDirs.length > 0) {
      console.log(
        `[Scanner] Found ${gitDirs.length} git dir(s) in ${rootDir} at depth ${depth}`
      );
    }

    return gitDirs;
  } catch (error) {
    console.log(
      `[Scanner] ✗ Error reading ${rootDir}:`,
      error instanceof Error ? error.message : error
    );
    return [];
  }
}

async function getCurrentBranch(repoPath: string): Promise<string> {
  const result = await execAsync('git branch --show-current', {
    cwd: repoPath,
  });
  return result.stdout.trim();
}

async function getLastCommit(repoPath: string) {
  try {
    const [sha, message, author, timestamp] = await Promise.all([
      execAsync('git rev-parse HEAD', { cwd: repoPath }),
      execAsync('git log -1 --pretty=%B', { cwd: repoPath }),
      execAsync('git log -1 --pretty=%an', { cwd: repoPath }),
      execAsync('git log -1 --pretty=%at', { cwd: repoPath }),
    ]);

    return {
      sha: sha.stdout.trim(),
      message: message.stdout.trim(),
      author: author.stdout.trim(),
      timestamp: new Date(parseInt(timestamp.stdout.trim()) * 1000),
    };
  } catch {
    // No commits yet - return placeholder data
    return {
      sha: 'initial',
      message: 'No commits yet',
      author: 'Unknown',
      timestamp: new Date(),
    };
  }
}

async function isWorkingDirectoryClean(repoPath: string): Promise<boolean> {
  const result = await execAsync('git status --porcelain', {
    cwd: repoPath,
  });
  return result.stdout.trim() === '';
}

async function getUncommittedFiles(repoPath: string): Promise<string[]> {
  const result = await execAsync('git status --porcelain', {
    cwd: repoPath,
  });

  if (!result.stdout.trim()) return [];

  return result.stdout
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => line.substring(3));
}
