// Temporary stub for openai when package is not installed
export class OpenAI {
  constructor(_options: unknown) {}

  chat = {
    completions: {
      create: async (_params: unknown, _options?: unknown): Promise<unknown> => {
        throw new Error('OpenAI SDK not installed');
      }
    }
  };
}

export default OpenAI;
