import type { NextRequest } from 'next/server';
import {
  getStuckDetector,
  StuckDetectionConfigSchema,
  DEFAULT_STUCK_CONFIG,
} from '@/lib/stuck-detection';

/**
 * GET - Retrieve current stuck detection configuration
 */
export async function GET() {
  const detector = getStuckDetector();
  const config = detector.getConfig();

  return Response.json({
    config,
    timestamp: new Date().toISOString(),
  });
}

/**
 * PUT - Update stuck detection configuration
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate the configuration
    const validatedConfig = StuckDetectionConfigSchema.parse(body);

    // Update the detector
    const detector = getStuckDetector();
    detector.updateConfig(validatedConfig);

    return Response.json({
      success: true,
      config: detector.getConfig(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[stuck-detection-config] Error:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return Response.json(
        { error: 'Invalid configuration', details: error.message },
        { status: 400 }
      );
    }

    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE - Reset configuration to defaults
 */
export async function DELETE() {
  const detector = getStuckDetector();
  detector.updateConfig(DEFAULT_STUCK_CONFIG);

  return Response.json({
    success: true,
    config: detector.getConfig(),
    message: 'Configuration reset to defaults',
    timestamp: new Date().toISOString(),
  });
}
