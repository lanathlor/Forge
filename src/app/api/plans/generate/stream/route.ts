/* eslint-disable max-lines-per-function */
import type { NextRequest } from 'next/server';
import { generatePlanFromDescription } from '@/lib/plans/generator';
import type { GenerationProgressEvent } from '@/lib/plans/generator';

/**
 * POST /api/plans/generate/stream
 *
 * Streaming version of plan generation. Returns a text/event-stream response
 * with SSE events at key milestones:
 *
 * - { type: 'status', message: '...' }   — human-readable status update
 * - { type: 'progress', percent: N }     — 0–100 progress indicator
 * - { type: 'chunk', content: '...' }    — token-level output from the LLM
 * - { type: 'done', planId: '...' }      — generation complete, plan persisted
 * - { type: 'error', message: '...' }    — unrecoverable error
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { repositoryId, title, description } = body as {
    repositoryId: string;
    title: string;
    description: string;
  };

  if (!repositoryId || !title || !description) {
    return new Response(
      JSON.stringify({ error: 'repositoryId, title and description are required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: GenerationProgressEvent) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        await generatePlanFromDescription(
          repositoryId,
          title,
          description,
          (event) => {
            send(event);
          }
        );
        // 'done' event is emitted by the generator itself
      } catch (error) {
        // If the generator threw (after emitting 'error'), send a final error
        // event in case the caller only relies on the stream.
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        send({ type: 'error', message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
