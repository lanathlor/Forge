import type { AIProvider } from './types';
import { AIProviderType } from './types';
import { ClaudeCodeProvider } from './providers/claude-code-provider';
import { FakeAIProvider } from './providers/fake-provider';
import { ClaudeSDKProvider } from './providers/claude-sdk-provider';
import { CodexSDKProvider } from './providers/codex-sdk-provider';

export function createAIProvider(): AIProvider {
  const providerType =
    (process.env.AI_PROVIDER as AIProviderType) || AIProviderType.CLAUDE_SDK;

  console.log(`[AIFactory] Creating AI provider: ${providerType}`);

  switch (providerType) {
    case AIProviderType.CLAUDE_CODE:
      return new ClaudeCodeProvider();

    case AIProviderType.CLAUDE_SDK:
      return new ClaudeSDKProvider();

    case AIProviderType.CODEX_SDK:
      return new CodexSDKProvider();

    case AIProviderType.FAKE:
      return new FakeAIProvider();

    default:
      throw new Error(`Unknown AI provider: ${providerType}`);
  }
}
