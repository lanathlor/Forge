import type { FileChange } from '@/db/schema/tasks';
import { claudeWrapper } from './wrapper';
import { getContainerPath } from '@/lib/qa-gates/command-executor';

const COMMIT_MESSAGE_GENERATION_TIMEOUT = 120000; // 2 minutes

// Common preamble patterns Claude uses before commit messages
const PREAMBLE_PATTERNS = [
  /^Now I have a complete/i,
  /^Now I have the full/i,
  /^Here'?s? (?:the|a) commit message/i,
  /^Let me (?:write|create|generate)/i,
  /^I'll (?:write|create|generate)/i,
  /^Based on the changes/i,
  /^Looking at (?:the|these) changes/i,
];

const CONVENTIONAL_COMMIT_REGEX = /^(feat|fix|refactor|docs|test|chore|style|perf|ci|build)(\(.+?\))?:/i;

function isPreambleLine(line: string): boolean {
  return PREAMBLE_PATTERNS.some(pattern => pattern.test(line));
}

/**
 * Extract the actual commit message from Claude's output, removing any preamble
 */
function extractCommitMessage(rawOutput: string): string {
  const lines = rawOutput.split('\n');
  let startIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? '';
    if (!line) continue;
    if (isPreambleLine(line)) continue;

    // Found a non-preamble line - check if it's a conventional commit or use as-is
    if (CONVENTIONAL_COMMIT_REGEX.test(line)) {
      startIndex = i;
      break;
    }
    // Non-preamble, non-conventional commit line - assume it's the message start
    startIndex = i;
    break;
  }

  const commitMessage = lines.slice(startIndex).join('\n').trim();
  if (!commitMessage) {
    console.warn('[extractCommitMessage] Failed to extract commit message, using raw output');
    return rawOutput.trim();
  }
  return commitMessage;
}

/**
 * Generate a commit message using Claude Code CLI based on the task prompt and diff
 */
export async function generateCommitMessage(
  taskPrompt: string,
  filesChanged: FileChange[],
  diffContent: string,
  repoPath: string
): Promise<string> {
  // Convert to container path if running in Docker
  const workingDirectory = getContainerPath(repoPath);

  // Construct the prompt for Claude
  const prompt = constructCommitMessagePrompt(taskPrompt, filesChanged, diffContent);

  console.log('[generateCommitMessage] Calling Claude Code CLI via wrapper...');
  console.log('[generateCommitMessage] Host path:', repoPath);
  console.log('[generateCommitMessage] Working directory:', workingDirectory);

  try {
    const rawOutput = await claudeWrapper.executeOneShot(
      prompt,
      workingDirectory,
      COMMIT_MESSAGE_GENERATION_TIMEOUT
    );

    console.log('[generateCommitMessage] Raw output from Claude:');
    console.log('[generateCommitMessage]', rawOutput.substring(0, 200));

    // Extract the actual commit message, removing Claude's preamble
    const commitMessage = extractCommitMessage(rawOutput);

    console.log('[generateCommitMessage] Successfully generated commit message');
    console.log('[generateCommitMessage] Message length:', commitMessage.length);
    console.log('[generateCommitMessage] First line:', commitMessage.split('\n')[0]);

    return commitMessage;
  } catch (error) {
    console.error('[generateCommitMessage] Error:', error);
    throw new Error(
      `Failed to generate commit message: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Construct the prompt for Claude Code to generate a commit message
 */
function constructCommitMessagePrompt(
  taskPrompt: string,
  filesChanged: FileChange[],
  diffContent: string
): string {
  const fileCount = filesChanged.length;
  const insertions = filesChanged.reduce((sum, f) => sum + f.additions, 0);
  const deletions = filesChanged.reduce((sum, f) => sum + f.deletions, 0);

  const filesChangedList = filesChanged
    .map((f) => `- ${f.path} (${f.status}, +${f.additions} -${f.deletions})`)
    .join('\n');

  return `Write a git commit message for the following changes.

Task Description: ${taskPrompt}

Files Changed (${fileCount}):
${filesChangedList}

Statistics: ${insertions} insertions(+), ${deletions} deletions(-)

Diff:
${diffContent.length > 8000 ? diffContent.substring(0, 8000) + '\n... (truncated)' : diffContent}

Requirements:
- Use conventional commits format: <type>(<scope>): <subject>
- Types: feat, fix, refactor, docs, test, chore, style, perf, ci, build
- First line under 72 characters
- Use imperative mood ("add" not "added")
- Don't capitalize first letter
- No period at end of subject
- Add blank line then body if change is complex

Examples:
feat(api): add error handling to user endpoints
fix(auth): resolve token expiration edge case
refactor(db): simplify query builder interface

Output ONLY the commit message text, nothing else. No markdown, no code blocks, no explanations.
Do NOT include any "Co-Authored-By" or "Co-authored-by" lines.`;
}
