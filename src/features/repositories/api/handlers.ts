import { NextResponse } from 'next/server';
import { db } from '@/db';
import { repositories } from '@/db/schema';
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

    // Upsert each repository to database
    console.log(
      `[Scanner] Upserting ${discovered.length} repositories to database...`
    );
    const discoveredPaths = new Set(discovered.map((r) => r.path));
    for (const repo of discovered) {
      console.log(`[Scanner] - Upserting: ${repo.name} (${repo.path})`);
      await upsertRepository(repo);
    }

    // Delete repositories that no longer exist in the workspace
    const allRepos = await db.select().from(repositories);
    const toDelete = allRepos.filter((repo) => !discoveredPaths.has(repo.path));

    if (toDelete.length > 0) {
      console.log(
        `[Scanner] Removing ${toDelete.length} stale repositories from database...`
      );
      for (const repo of toDelete) {
        console.log(`[Scanner] - Removing: ${repo.name} (${repo.path})`);
        await db.delete(repositories).where(eq(repositories.id, repo.id));
      }
    }

    console.log(
      `[Scanner] ======================================== `
    );
    console.log(
      `[Scanner] Background scan complete: ${discovered.length} repositories found, ${toDelete.length} removed`
    );
    console.log(
      `[Scanner] ======================================== `
    );
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
