import type { FileChange } from '@/db/schema/tasks';
import { claudeWrapper } from './wrapper';
import { getContainerPath } from '@/lib/qa-gates/command-executor';

const COMMIT_MESSAGE_GENERATION_TIMEOUT = 30000; // 30 seconds

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
    const commitMessage = await claudeWrapper.executeOneShot(
      prompt,
      workingDirectory,
      COMMIT_MESSAGE_GENERATION_TIMEOUT
    );

    console.log('[generateCommitMessage] Successfully generated commit message');
    console.log('[generateCommitMessage] Message length:', commitMessage.length);

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

  return `Analyze the git diff below and write a specific, accurate commit message.

CRITICAL: Your commit message must accurately reflect what actually changed in the code.
Focus on the PRIMARY PURPOSE and IMPACT of these changes, not just listing files.

Task Context: ${taskPrompt}

Changed Files (${fileCount}): ${insertions} insertions, ${deletions} deletions
${filesChangedList}

Full Diff:
${diffContent.length > 8000 ? diffContent.substring(0, 8000) + '\n... (diff truncated)' : diffContent}

INSTRUCTIONS:
1. Read the diff carefully to understand what actually changed
2. Identify the main purpose: Is this fixing a bug? Adding a feature? Refactoring? Improving something?
3. Write a specific subject line that describes the actual change, not generic summaries
4. In the body, explain WHAT changed and WHY, with specific details from the diff
5. Use conventional commits format: <type>(<scope>): <subject>
6. Types: feat, fix, refactor, docs, test, chore, style, perf, ci, build
7. Subject line under 72 chars, imperative mood, lowercase, no period
8. Add body with bullet points for complex changes

GOOD examples (specific and actionable):
fix(commit): use heredoc for multiline commit messages
fix(git): add user.name and user.email config for container commits
feat(auth): add JWT token validation middleware
refactor(api): extract error handling into middleware layer

BAD examples (too vague, avoid these):
feat(docker): improve container setup
fix: update various files
chore: make improvements

Output ONLY the commit message. No markdown, no code blocks, no explanations.`;
}
