/**
 * Next.js Instrumentation
 * This runs once when the server starts up
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Server startup - running cleanup tasks...');

    // Dynamically import to avoid issues during build
    const { planExecutor } = await import('@/lib/plans/executor');

    // Clean up any stuck tasks/plans from server restarts
    await planExecutor.cleanupStuckExecutions();

    console.log('[Instrumentation] Startup complete');
  }
}
