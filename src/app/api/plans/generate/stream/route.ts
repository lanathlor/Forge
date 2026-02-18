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
 * - { type: 'status', message: '...' }                              — human-readable status update
 * - { type: 'progress', percent: N }                                — 0–100 progress indicator
 * - { type: 'chunk', content: '...' }                               — token-level output from the LLM
 * - { type: 'done', planId: '...' }                                 — generation complete, plan persisted
 * - { type: 'error', code: ErrorCode, message: '...', detail?: '...' } — unrecoverable error
 *
 * Error codes:
 *   TIMEOUT     – LLM call exceeded 5-minute budget; detail contains elapsed time.
 *   PARSE_ERROR – LLM response was not valid JSON; detail contains a raw snippet.
 *   LLM_ERROR   – AI provider returned an error or empty response.
 *   ABORTED     – Client cancelled the request via AbortController.
 *
 * The stream is always closed with a final SSE event (done or error), even on
 * error paths, so the client can reliably detect the end of generation.
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

  // Expose the client-disconnect signal so we can abort the in-flight
  // Anthropic request when the user closes the dialog.
  const { signal } = request;

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
          },
          signal
        );
        // 'done' event is emitted by the generator itself
      } catch (error) {
        // If the request was aborted (client closed the connection), emit an
        // ABORTED event so the client can reliably detect end-of-stream, then
        // close cleanly. (The client may already be gone but this is harmless.)
        if (error instanceof DOMException && error.name === 'AbortError') {
          console.log('[PlanStream] Client disconnected – generation aborted');
          send({ type: 'error', code: 'ABORTED', message: 'Generation was cancelled' });
          return;
        }

        // For other errors the generator has already emitted a structured error
        // event via the progress callback. We emit a fallback here only if the
        // error message doesn't look like it was already forwarded.
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        // The generator emits its own structured events; avoid double-emitting
        // by only sending a generic event for truly unexpected errors (those
        // not originating from generator's own emit calls).
        const alreadyEmitted =
          message.startsWith('LLM call failed:') ||
          message.startsWith('Failed to parse plan structure:') ||
          message.startsWith('LLM returned an empty response');

        if (!alreadyEmitted) {
          send({ type: 'error', code: 'LLM_ERROR', message });
        }
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
