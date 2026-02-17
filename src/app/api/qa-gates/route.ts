import { NextResponse } from 'next/server';

/**
 * GET /api/qa-gates
 * Documentation endpoint - QA gates are now defined per-repository
 */
export async function GET() {
  return NextResponse.json({
    message: 'QA gates are now defined per-repository in .forge.json files',
    documentation: {
      endpoint:
        'Use GET /api/repositories/:id/qa-gates to get gates for a specific repository',
      configFile: '.forge.json in repository root',
      exampleLocation: '/examples/.forge.json.*',
      supportedLanguages: ['typescript', 'javascript', 'python', 'go', 'rust'],
    },
    schema: {
      version: 'string (optional, default: "1.0")',
      maxRetries: 'number (optional, default: 3)',
      qaGates: [
        {
          name: 'string (required)',
          enabled: 'boolean (default: true)',
          command: 'string (required)',
          timeout: 'number (milliseconds, default: 60000)',
          failOnError: 'boolean (default: true)',
          order: 'number (optional)',
        },
      ],
    },
  });
}
