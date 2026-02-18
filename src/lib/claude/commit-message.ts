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

const CONVENTIONAL_COMMIT_REGEX =
  /^(feat|fix|refactor|docs|test|chore|style|perf|ci|build)(\(.+?\))?:/i;

function isPreambleLine(line: string): boolean {
  return PREAMBLE_PATTERNS.some((pattern) => pattern.test(line));
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
    console.warn(
      '[extractCommitMessage] Failed to extract commit message, using raw output'
    );
    return rawOutput.trim();
  }
  return commitMessage;
}

async function invokeClaudeForCommitMessage(
  prompt: string,
  workingDirectory: string
): Promise<string> {
  // Pass tools='' to disable all tool use — commit message generation is pure
  // text generation and must not inspect the repo or run git commands.
  const rawOutput = await claudeWrapper.executeOneShot(prompt, workingDirectory, COMMIT_MESSAGE_GENERATION_TIMEOUT, '');
  console.log('[generateCommitMessage] Raw output from Claude:');
  console.log('[generateCommitMessage]', rawOutput.substring(0, 200));
  const commitMessage = extractCommitMessage(rawOutput);
  console.log('[generateCommitMessage] Successfully generated commit message');
  console.log('[generateCommitMessage] Message length:', commitMessage.length);
  console.log('[generateCommitMessage] First line:', commitMessage.split('\n')[0]);
  return commitMessage;
}

/**
 * Filter a full diff string to only include hunks for the specified files.
 * This prevents unrelated untracked files in the workspace from leaking
 * into the commit message prompt.
 */
function filterDiffToFiles(fullDiff: string, files: FileChange[]): string {
  const filePaths = new Set(files.map((f) => f.path));
  const sections = fullDiff.split(/(?=^diff --git )/m);
  return sections
    .filter((section) => {
      // Check the b/ path (destination), which is correct for both normal diffs
      // and --no-index diffs where a/ is /dev/null for new files.
      const match = section.match(/^diff --git .+? b\/(.+)/m);
      const path = match?.[1];
      return path !== undefined && filePaths.has(path);
    })
    .join('');
}

function logDiffFiles(label: string, diff: string): void {
  const files: string[] = [];
  for (const match of diff.matchAll(/^diff --git .+? b\/(.+)/gm)) {
    if (match[1]) files.push(match[1]);
  }
  console.log(`[generateCommitMessage] ${label}: [${files.join(', ') || '(none)'}]`);
}

export async function generateCommitMessage(
  taskPrompt: string,
  filesChanged: FileChange[],
  diffContent: string,
  repoPath: string
): Promise<string> {
  const workingDirectory = getContainerPath(repoPath);
  const filteredDiff = filterDiffToFiles(diffContent, filesChanged);

  console.log('[generateCommitMessage] filesChanged:', filesChanged.map((f) => f.path));
  logDiffFiles('diffContent files', diffContent);
  logDiffFiles('filteredDiff files (sent to AI)', filteredDiff || diffContent);

  const prompt = constructCommitMessagePrompt(taskPrompt, filesChanged, filteredDiff || diffContent);
  console.log('[generateCommitMessage] Calling Claude Code CLI via wrapper...');
  console.log('[generateCommitMessage] Working directory:', workingDirectory);

  try {
    return await invokeClaudeForCommitMessage(prompt, workingDirectory);
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

  return `You must write a git commit message. Do NOT use any tools. Do NOT run any commands. Do NOT read any files. Do NOT inspect the repository. Base your response SOLELY on the information provided below — nothing else.

TASK DESCRIPTION:
${taskPrompt}

FILES CHANGED (${fileCount}):
${filesChangedList}

STATISTICS: ${insertions} insertions(+), ${deletions} deletions(-)

DIFF (only these changes — ignore anything else in the repository):
${diffContent.length > 8000 ? diffContent.substring(0, 8000) + '\n... (truncated)' : diffContent}

REQUIREMENTS:
- Use conventional commits format: <type>(<scope>): <subject>
- Types: feat, fix, refactor, docs, test, chore, style, perf, ci, build
- First line under 72 characters
- Use imperative mood ("add" not "added")
- Don't capitalize first letter
- No period at end of subject
- Add blank line then body if the change is complex

EXAMPLES:
feat(blog): add project introduction post
fix(auth): resolve token expiration edge case
docs(readme): update installation instructions

Output ONLY the commit message text. No markdown, no code blocks, no explanations, no preamble.
Do NOT include any "Co-Authored-By" or "Co-authored-by" lines.`;
}
