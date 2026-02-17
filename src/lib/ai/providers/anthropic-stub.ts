// Temporary stub for @anthropic-ai/sdk when package is not installed
export class Anthropic {
  constructor(_options: unknown) {}

  messages = {
    create: async (_params: unknown, _options?: unknown): Promise<unknown> => {
      throw new Error('Anthropic SDK not installed');
    }
  };
}

export default Anthropic;
