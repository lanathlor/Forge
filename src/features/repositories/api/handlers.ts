import { NextResponse } from 'next/server';
import { db } from '@/db';
import {
  repositories,
  plans,
  phases,
  planTasks,
  planIterations,
  sessions,
  tasks,
  qaRuns,
  qaGateExecutions,
} from '@/db/schema';
import { discoverRepositories } from '../lib/scanner';
import { eq, desc } from 'drizzle-orm';

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

// Background refresh in progress flag
let refreshInProgress = false;

async function upsertRepository(
  repo: Awaited<ReturnType<typeof discoverRepositories>>[0]
) {
  await db
    .insert(repositories)
    .values({
      name: repo.name,
      path: repo.path,
      currentBranch: repo.currentBranch,
      lastCommitSha: repo.lastCommit.sha,
      lastCommitMsg: repo.lastCommit.message,
      lastCommitAuthor: repo.lastCommit.author,
      lastCommitTimestamp: repo.lastCommit.timestamp,
      isClean: repo.isClean,
      uncommittedFiles: JSON.stringify(repo.uncommittedFiles),
      lastScanned: new Date(),
    })
    .onConflictDoUpdate({
      target: repositories.path,
      set: {
        currentBranch: repo.currentBranch,
        lastCommitSha: repo.lastCommit.sha,
        lastCommitMsg: repo.lastCommit.message,
        lastCommitAuthor: repo.lastCommit.author,
        lastCommitTimestamp: repo.lastCommit.timestamp,
        isClean: repo.isClean,
        uncommittedFiles: JSON.stringify(repo.uncommittedFiles),
        lastScanned: new Date(),
        updatedAt: new Date(),
      },
    });
}

async function upsertDiscoveredRepos(
  discovered: Awaited<ReturnType<typeof discoverRepositories>>
) {
  console.log(
    `[Scanner] Upserting ${discovered.length} repositories to database...`
  );
  for (const repo of discovered) {
    console.log(`[Scanner] - Upserting: ${repo.name} (${repo.path})`);
    await upsertRepository(repo);
  }
  return new Set(discovered.map((r) => r.path));
}

async function deleteRepositoryPlans(repositoryId: string) {
  const repoPlans = await db
    .select()
    .from(plans)
    .where(eq(plans.repositoryId, repositoryId));

  for (const plan of repoPlans) {
    console.log(`[Scanner]   - Deleting associated plan: ${plan.title}`);
    await db.delete(planIterations).where(eq(planIterations.planId, plan.id));
    await db.delete(planTasks).where(eq(planTasks.planId, plan.id));
    await db.delete(phases).where(eq(phases.planId, plan.id));
    await db.delete(plans).where(eq(plans.id, plan.id));
  }
}

async function deleteRepositorySessions(repositoryId: string) {
  const repoSessions = await db
    .select()
    .from(sessions)
    .where(eq(sessions.repositoryId, repositoryId));

  for (const session of repoSessions) {
    console.log(`[Scanner]   - Deleting associated session: ${session.id}`);
    await db.delete(tasks).where(eq(tasks.sessionId, session.id));
    await db.delete(sessions).where(eq(sessions.id, session.id));
  }
}

async function deleteRepositoryQARuns(repositoryId: string) {
  const repoQARuns = await db
    .select()
    .from(qaRuns)
    .where(eq(qaRuns.repositoryId, repositoryId));

  for (const qaRun of repoQARuns) {
    console.log(`[Scanner]   - Deleting associated QA run: ${qaRun.id}`);
    await db
      .delete(qaGateExecutions)
      .where(eq(qaGateExecutions.runId, qaRun.id));
    await db.delete(qaRuns).where(eq(qaRuns.id, qaRun.id));
  }
}

async function removeStaleRepositories(discoveredPaths: Set<string>) {
  const allRepos = await db.select().from(repositories);
  const toDelete = allRepos.filter((repo) => !discoveredPaths.has(repo.path));

  if (toDelete.length > 0) {
    console.log(
      `[Scanner] Removing ${toDelete.length} stale repositories from database...`
    );
    for (const repo of toDelete) {
      console.log(`[Scanner] - Removing: ${repo.name} (${repo.path})`);

      // Delete all associated records to avoid foreign key constraint errors
      await deleteRepositoryPlans(repo.id);
      await deleteRepositorySessions(repo.id);
      await deleteRepositoryQARuns(repo.id);

      await db.delete(repositories).where(eq(repositories.id, repo.id));
    }
  }
  return toDelete.length;
}

async function refreshRepositoriesCache() {
  if (refreshInProgress) {
    console.log('[Scanner] Repository refresh already in progress, skipping...');
    return;
  }

  try {
    refreshInProgress = true;
    const workspaceRoot = process.env.WORKSPACE_ROOT || '/home/lanath/Work';

    console.log('[Scanner] ========================================');
    console.log('[Scanner] Starting background repository scan');
    console.log('[Scanner] WORKSPACE_ROOT env var:', process.env.WORKSPACE_ROOT);
    console.log('[Scanner] Using workspace root:', workspaceRoot);
    console.log('[Scanner] ========================================');

    const discovered = await discoverRepositories(workspaceRoot);
    const discoveredPaths = await upsertDiscoveredRepos(discovered);
    const removedCount = await removeStaleRepositories(discoveredPaths);

    console.log('[Scanner] ======================================== ');
    console.log(
      `[Scanner] Background scan complete: ${discovered.length} repositories found, ${removedCount} removed`
    );
    console.log('[Scanner] ======================================== ');
  } catch (error) {
    console.error('Error in background repository refresh:', error);
  } finally {
    refreshInProgress = false;
  }
}

async function getCachedRepositories() {
  return await db
    .select()
    .from(repositories)
    .orderBy(desc(repositories.lastScanned));
}

function checkCacheFreshness(
  cachedRepos: (typeof repositories.$inferSelect)[]
) {
  return (
    cachedRepos.length > 0 &&
    cachedRepos[0]?.lastScanned &&
    Date.now() - cachedRepos[0].lastScanned.getTime() < CACHE_DURATION
  );
}

function returnFreshCache(cachedRepos: (typeof repositories.$inferSelect)[]) {
  console.log('Returning fresh cached repositories');
  return NextResponse.json({
    repositories: cachedRepos,
    cached: true,
    lastScanned: cachedRepos[0]?.lastScanned,
  });
}

function returnStaleCache(cachedRepos: (typeof repositories.$inferSelect)[]) {
  console.log('Returning stale cache, triggering background refresh');

  // Fire and forget background refresh
  refreshRepositoriesCache().catch((err) =>
    console.error('Background refresh failed:', err)
  );

  return NextResponse.json({
    repositories: cachedRepos,
    cached: true,
    stale: true,
    lastScanned: cachedRepos[0]?.lastScanned,
    refreshing: true,
  });
}

async function handleNoCache() {
  console.log('No cache found, performing full scan');
  await refreshRepositoriesCache();
  const allRepos = await db.select().from(repositories);

  return NextResponse.json({
    repositories: allRepos,
    cached: false,
  });
}

export async function handleGetRepositories() {
  try {
    const cachedRepos = await getCachedRepositories();
    const isCacheFresh = checkCacheFreshness(cachedRepos);

    // If cache is fresh, return immediately
    if (isCacheFresh && cachedRepos[0]?.lastScanned) {
      return returnFreshCache(cachedRepos);
    }

    // Cache is stale or empty
    if (cachedRepos.length > 0 && cachedRepos[0]?.lastScanned) {
      return returnStaleCache(cachedRepos);
    }

    // No cache exists, do a full scan
    return await handleNoCache();
  } catch (error) {
    console.error('Error discovering repositories:', error);
    return NextResponse.json(
      { error: 'Failed to discover repositories' },
      { status: 500 }
    );
  }
}

export async function handleGetRepository(id: string) {
  try {
    const [repository] = await db
      .select()
      .from(repositories)
      .where(eq(repositories.id, id))
      .limit(1);

    if (!repository) {
      return NextResponse.json(
        { error: 'Repository not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ repository });
  } catch (error) {
    console.error('Error fetching repository:', error);
    return NextResponse.json(
      { error: 'Failed to fetch repository' },
      { status: 500 }
    );
  }
}

export async function handleRescanRepositories() {
  try {
    // Trigger a fresh scan (bypasses cache)
    await refreshRepositoriesCache();

    // Return all from database
    const allRepos = await db.select().from(repositories);

    return NextResponse.json({
      repositories: allRepos,
      message: `Discovered ${allRepos.length} repositories`,
    });
  } catch (error) {
    console.error('Error rescanning repositories:', error);
    return NextResponse.json(
      { error: 'Failed to rescan repositories' },
      { status: 500 }
    );
  }
}
