import type { NextRequest } from 'next/server';
import { taskEvents } from '@/lib/events/task-events';

interface TaskUpdateEvent {
  sessionId: string;
  taskId: string;
  status?: string;
  [key: string]: unknown;
}

interface TaskOutputEvent {
  sessionId: string;
  taskId: string;
  output: string;
}

interface QAGateUpdateEvent {
  sessionId: string;
  taskId: string;
  gateName: string;
  status: string;
  [key: string]: unknown;
}

/**
 * Server-Sent Events endpoint for real-time task updates
 *
 * Usage: Connect via EventSource on client
 * Example: new EventSource('/api/stream?sessionId=abc123')
 */
/* eslint-disable max-lines-per-function */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return new Response('Missing sessionId', { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`
        )
      );

      // Event handlers for different event types
      const onTaskUpdate = (data: TaskUpdateEvent) => {
        if (data.sessionId === sessionId) {
          try {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'task_update',
                  ...data,
                  timestamp: new Date().toISOString()
                })}\n\n`
              )
            );
          } catch (error) {
            console.error('Error encoding task update:', error);
          }
        }
      };

      const onTaskOutput = (data: TaskOutputEvent) => {
        console.log(`[SSE] onTaskOutput called, sessionId: ${data.sessionId}, expected: ${sessionId}`);
        if (data.sessionId === sessionId) {
          console.log(`[SSE] Sending task_output to client, taskId: ${data.taskId}, output length: ${data.output?.length}`);
          try {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'task_output',
                  ...data,
                  timestamp: new Date().toISOString()
                })}\n\n`
              )
            );
            console.log(`[SSE] Successfully sent task_output event`);
          } catch (error) {
            console.error('Error encoding task output:', error);
          }
        } else {
          console.log(`[SSE] Skipping task_output, sessionId mismatch`);
        }
      };

      const onQAGateUpdate = (data: QAGateUpdateEvent) => {
        if (data.sessionId === sessionId) {
          try {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'qa_gate_update',
                  ...data,
                  timestamp: new Date().toISOString()
                })}\n\n`
              )
            );
          } catch (error) {
            console.error('Error encoding QA gate update:', error);
          }
        }
      };

      // Register listeners
      console.log(`[SSE] Registering listeners for sessionId: ${sessionId}`);
      taskEvents.on('task:update', onTaskUpdate);
      taskEvents.on('task:output', onTaskOutput);
      taskEvents.on('qa:update', onQAGateUpdate);
      console.log(`[SSE] Listeners registered. Total task:output listeners: ${taskEvents.listenerCount('task:output')}`);

      // Keep-alive ping every 30 seconds to prevent timeout
      const keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keep-alive\n\n'));
        } catch (_error) {
          console.error('Keep-alive failed, connection may be closed');
          clearInterval(keepAliveInterval);
        }
      }, 30000);

      // Cleanup when connection closes
      request.signal.addEventListener('abort', () => {
        clearInterval(keepAliveInterval);
        taskEvents.off('task:update', onTaskUpdate);
        taskEvents.off('task:output', onTaskOutput);
        taskEvents.off('qa:update', onQAGateUpdate);

        try {
          controller.close();
        } catch (_error) {
          // Controller already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
