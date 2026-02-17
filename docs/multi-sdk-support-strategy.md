# Multi-SDK Support Strategy

## Overview

This document outlines the strategy for supporting multiple AI SDKs in our application: **Codex SDK**, **Claude SDK**, and **Claude Code spawn**. The goal is to provide a unified interface layer with dependency injection based on environment variables to determine which implementation to use.

## Current State

Currently, the application uses Claude Code spawn via the `ClaudeCodeWrapper` class located in `src/lib/claude/wrapper.ts`. This wrapper:

- Spawns the Claude Code CLI as a child process
- Handles streaming JSON output from Claude Code
- Supports both real and simulated execution modes
- Provides methods for one-shot execution and streaming execution
- Manages task output and database persistence

## Target Architecture

### Interface Layer

We need to create a unified interface that abstracts the underlying SDK implementation:

```typescript
interface AIProvider {
  executeTask(options: TaskExecutionOptions): Promise<TaskResult>;
  executeWithStream(
    prompt: string,
    workingDirectory: string,
    onChunk: (text: string) => void,
    timeoutMs?: number
  ): Promise<string>;
  executeOneShot(
    prompt: string,
    workingDirectory: string,
    timeoutMs?: number
  ): Promise<string>;
  cancel(taskId: string): Promise<void>;
}
```

### Provider Implementations

1. **Claude Code Provider** (`ClaudeCodeProvider`)
   - Wraps the existing `ClaudeCodeWrapper` functionality
   - Maintains backward compatibility with current spawn-based approach
   - Handles CLI-based interaction and process management

2. **Claude SDK Provider** (`ClaudeSDKProvider`)
   - Uses Anthropic's Claude SDK for direct API integration
   - Implements streaming via SDK's native streaming capabilities
   - Handles authentication and rate limiting

3. **Codex SDK Provider** (`CodexSDKProvider`)
   - Integrates with OpenAI's Codex API
   - Adapts Codex responses to match our unified interface
   - Handles model selection and token management

4. **Fake Provider** (`FakeAIProvider`)
   - Provides hardcoded responses for testing and development
   - Simulates realistic AI interactions with predictable outputs
   - Supports all interface methods with configurable delays
   - Essential for unit testing and CI/CD pipelines

### Dependency Injection

Environment variable-based provider selection:

```typescript
export enum AIProviderType {
  CLAUDE_CODE = 'claude-code',
  CLAUDE_SDK = 'claude-sdk',
  CODEX_SDK = 'codex-sdk',
  FAKE = 'fake',
}

export function createAIProvider(): AIProvider {
  const providerType =
    (process.env.AI_PROVIDER as AIProviderType) || AIProviderType.CLAUDE_CODE;

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
```

### Configuration

Environment variables for provider selection and configuration:

```bash
# Provider Selection
AI_PROVIDER=claude-code|claude-sdk|codex-sdk|fake

# Claude Code (existing)
CLAUDE_CODE_PATH=claude
SIMULATE_CLAUDE=false

# Claude SDK
ANTHROPIC_API_KEY=your-key-here
CLAUDE_MODEL=claude-3-5-sonnet-20241022
CLAUDE_MAX_TOKENS=4096

# Codex SDK
OPENAI_API_KEY=your-key-here
CODEX_MODEL=code-davinci-002
CODEX_MAX_TOKENS=4096

# Fake Provider (for testing)
FAKE_PROVIDER_DELAY_MS=1000
FAKE_PROVIDER_SIMULATE_ERRORS=false
FAKE_PROVIDER_ERROR_RATE=0.1
```

## Implementation Plan

### Phase 1: Interface Abstraction

- [x] Create `AIProvider` interface with unified method signatures
- [x] Extract current `ClaudeCodeWrapper` logic into `ClaudeCodeProvider`
- [x] Implement `FakeAIProvider` for testing with hardcoded responses
- [x] Create factory function for provider instantiation
- [x] Update existing code to use the new interface

### Phase 2: Claude SDK Integration

- [x] Install and configure Anthropic Claude SDK
- [x] Implement `ClaudeSDKProvider` with streaming support
- [x] Add authentication and configuration handling
- [x] Test parity with Claude Code functionality

### Phase 3: Codex SDK Integration

- [x] Install and configure OpenAI SDK
- [x] Implement `CodexSDKProvider` with response adaptation
- [x] Handle differences in prompt formatting and response structure
- [x] Test integration with existing task execution flows

### Phase 4: Testing & Validation

- [x] Create comprehensive tests for all providers
- [x] Validate feature parity across providers
- [x] Performance testing and optimization
- [x] Documentation and migration guides

## Benefits

1. **Flexibility**: Easy switching between different AI providers based on use case
2. **Scalability**: Can add new providers without changing core application logic
3. **Testing**: Easier to mock and test different AI interactions
4. **Cost Optimization**: Can choose most cost-effective provider for different tasks
5. **Reliability**: Fallback options if one provider is unavailable

## Considerations

### Compatibility

- Ensure all providers support the same core functionality (streaming, cancellation, etc.)
- Handle provider-specific features gracefully
- Maintain backward compatibility with existing Claude Code integration

### Error Handling

- Standardize error responses across providers
- Implement retry logic and fallback mechanisms
- Proper logging and monitoring for each provider

### Performance

- Compare latency and throughput across providers
- Implement caching where appropriate
- Monitor token usage and costs

### Security

- Secure API key management
- Audit logging for AI interactions
- Rate limiting and abuse prevention

## Migration Strategy

1. **Gradual Rollout**: Start with existing Claude Code as default
2. **Feature Flags**: Allow per-user or per-feature provider selection
3. **A/B Testing**: Compare provider performance in production
4. **Monitoring**: Track metrics across all providers
5. **Rollback Plan**: Easy reversion to previous implementation if issues arise

This multi-SDK approach provides the foundation for a more flexible and scalable AI integration while maintaining the robustness of our current Claude Code implementation.

## Fake Provider Implementation

The `FakeAIProvider` is crucial for testing and development workflows. It provides deterministic, hardcoded responses that simulate real AI interactions.

### Key Features

1. **Hardcoded Response Scenarios**

   ````typescript
   const FAKE_RESPONSES = {
     commitMessage:
       'feat(example): implement new feature\n\nThis is a simulated commit message for testing purposes.',
     codeGeneration:
       "```javascript\n// Simulated code generation\nfunction exampleFunction() {\n  return 'Hello, World!';\n}\n```",
     planGeneration:
       "I'll create a comprehensive plan for this task:\n\n1. Analyze requirements\n2. Design solution\n3. Implement code\n4. Test thoroughly",
     errorResponse:
       'I encountered an error while processing this request. Please check your input and try again.',
   };
   ````

2. **Configurable Behavior**
   - **Delays**: Simulate realistic response times with `FAKE_PROVIDER_DELAY_MS`
   - **Error Simulation**: Randomly inject failures based on `FAKE_PROVIDER_ERROR_RATE`
   - **Streaming**: Simulate character-by-character streaming for UI testing

3. **Prompt-Based Routing**
   ```typescript
   private getResponseForPrompt(prompt: string): string {
     if (prompt.includes('commit message') || prompt.includes('git commit')) {
       return FAKE_RESPONSES.commitMessage;
     }
     if (prompt.includes('implement') || prompt.includes('code')) {
       return FAKE_RESPONSES.codeGeneration;
     }
     if (prompt.includes('plan') || prompt.includes('strategy')) {
       return FAKE_RESPONSES.planGeneration;
     }
     return FAKE_RESPONSES.default;
   }
   ```

### Testing Benefits

1. **Unit Tests**: No external API calls, faster test execution
2. **CI/CD**: Reliable builds without API dependencies
3. **Development**: Consistent behavior during feature development
4. **Load Testing**: Test application performance without AI service limits
5. **Error Scenarios**: Predictable failure modes for error handling tests

### Example Usage

```typescript
// In test files
process.env.AI_PROVIDER = 'fake';
process.env.FAKE_PROVIDER_DELAY_MS = '100';
process.env.FAKE_PROVIDER_SIMULATE_ERRORS = 'false';

const provider = createAIProvider();
const result = await provider.executeOneShot(
  'Generate a commit message for these changes',
  '/path/to/repo'
);
// result will be the hardcoded commit message response
```

This fake provider ensures robust testing capabilities while maintaining the same interface as production providers.
