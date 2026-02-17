import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAIProvider } from '../factory';
import { AIProviderType } from '../types';
import { ClaudeCodeProvider } from '../providers/claude-code-provider';
import { ClaudeSDKProvider } from '../providers/claude-sdk-provider';
import { CodexSDKProvider } from '../providers/codex-sdk-provider';
import { FakeAIProvider } from '../providers/fake-provider';

describe('AIProvider Factory', () => {
  beforeEach(() => {
    // Reset environment variables
    delete process.env.AI_PROVIDER;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  it('creates ClaudeCodeProvider by default', () => {
    const provider = createAIProvider();
    expect(provider).toBeInstanceOf(ClaudeCodeProvider);
  });

  it('creates ClaudeCodeProvider when AI_PROVIDER is claude-code', () => {
    process.env.AI_PROVIDER = AIProviderType.CLAUDE_CODE;
    const provider = createAIProvider();
    expect(provider).toBeInstanceOf(ClaudeCodeProvider);
  });

  it('creates FakeAIProvider when AI_PROVIDER is fake', () => {
    process.env.AI_PROVIDER = AIProviderType.FAKE;
    const provider = createAIProvider();
    expect(provider).toBeInstanceOf(FakeAIProvider);
  });

  it('creates ClaudeSDKProvider when AI_PROVIDER is claude-sdk', () => {
    process.env.AI_PROVIDER = AIProviderType.CLAUDE_SDK;
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const provider = createAIProvider();
    expect(provider).toBeInstanceOf(ClaudeSDKProvider);
  });

  it('creates CodexSDKProvider when AI_PROVIDER is codex-sdk', () => {
    process.env.AI_PROVIDER = AIProviderType.CODEX_SDK;
    process.env.OPENAI_API_KEY = 'test-key';
    const provider = createAIProvider();
    expect(provider).toBeInstanceOf(CodexSDKProvider);
  });

  it('throws error for unknown provider type', () => {
    process.env.AI_PROVIDER = 'unknown' as AIProviderType;
    expect(() => createAIProvider()).toThrow('Unknown AI provider: unknown');
  });

  it('throws error for ClaudeSDKProvider without API key', () => {
    process.env.AI_PROVIDER = AIProviderType.CLAUDE_SDK;
    expect(() => createAIProvider()).toThrow(
      'ANTHROPIC_API_KEY environment variable is required'
    );
  });

  it('throws error for CodexSDKProvider without API key', () => {
    process.env.AI_PROVIDER = AIProviderType.CODEX_SDK;
    expect(() => createAIProvider()).toThrow(
      'OPENAI_API_KEY environment variable is required'
    );
  });
});
