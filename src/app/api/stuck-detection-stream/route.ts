import type { NextRequest } from 'next/server';
import { getStuckDetector, stuckEvents, type StuckEvent, type StuckStatus } from '@/lib/stuck-detection';

/**
 * Encode SSE message
 */
function encodeSSE(encoder: TextEncoder, eventType: string, data: object): Uint8Array {
  return encoder.encode(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
}

function createEventHandler(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  eventType: string
) {
  return (event: StuckEvent) => {
    try {
      controller.enqueue(encodeSSE(encoder, eventType, event));
    } catch {
      // Stream closed
    }
  };
}

function createStatusHandler(controller: ReadableStreamDefaultController, encoder: TextEncoder) {
  return (status: StuckStatus) => {
    try {
      controller.enqueue(encodeSSE(encoder, 'stuck_update', { status, timestamp: new Date().toISOString() }));
    } catch {
      // Stream closed
    }
  };
}

function setupIntervals(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  detector: ReturnType<typeof getStuckDetector>
) {
  const keepAliveInterval = setInterval(() => {
    try {
      controller.enqueue(encoder.encode(': keep-alive\n\n'));
    } catch {
      clearInterval(keepAliveInterval);
    }
  }, 30000);

  // Only send periodic updates every 30 seconds - real-time events are already pushed immediately
  const statusInterval = setInterval(() => {
    try {
      const status = detector.getStatus();
      controller.enqueue(encodeSSE(encoder, 'stuck_update', { status, timestamp: new Date().toISOString() }));
    } catch {
      clearInterval(statusInterval);
    }
  }, 30000);

  return { keepAliveInterval, statusInterval };
}

/**
 * Server-Sent Events endpoint for real-time stuck detection updates
 */
export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  const detector = getStuckDetector();

  const stream = new ReadableStream({
    start(controller) {
      const initialStatus = detector.getStatus();
      controller.enqueue(encodeSSE(encoder, 'connected', { status: initialStatus, timestamp: new Date().toISOString() }));

      const onStuckDetected = createEventHandler(controller, encoder, 'stuck_detected');
      const onStuckResolved = createEventHandler(controller, encoder, 'stuck_resolved');
      const onStuckEscalated = createEventHandler(controller, encoder, 'stuck_escalated');
      const onStuckUpdate = createStatusHandler(controller, encoder);

      stuckEvents.on('stuck:detected', onStuckDetected);
      stuckEvents.on('stuck:resolved', onStuckResolved);
      stuckEvents.on('stuck:escalated', onStuckEscalated);
      stuckEvents.on('stuck:update', onStuckUpdate);

      const { keepAliveInterval, statusInterval } = setupIntervals(controller, encoder, detector);

      request.signal.addEventListener('abort', () => {
        clearInterval(keepAliveInterval);
        clearInterval(statusInterval);
        stuckEvents.off('stuck:detected', onStuckDetected);
        stuckEvents.off('stuck:resolved', onStuckResolved);
        stuckEvents.off('stuck:escalated', onStuckEscalated);
        stuckEvents.off('stuck:update', onStuckUpdate);
        try { controller.close(); } catch { /* Already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

/**
 * POST endpoint for acknowledging alerts
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { repositoryId, action } = body;

    if (!repositoryId || !action) {
      return Response.json(
        { error: 'Missing repositoryId or action' },
        { status: 400 }
      );
    }

    const detector = getStuckDetector();

    switch (action) {
      case 'acknowledge': {
        const success = detector.acknowledgeAlert(repositoryId);
        return Response.json({ success, repositoryId });
      }
      default:
        return Response.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[stuck-detection-stream] POST error:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
