'use client';

import { useState, useEffect, useCallback } from 'react';
import { useGetRepositoryQuery } from '@/features/repositories/store/repositoriesApi';

export interface PreflightCheck {
  id: string;
  label: string;
  status: 'checking' | 'pass' | 'fail' | 'warn';
  detail?: string;
}

interface UsePreflightChecksOptions {
  repositoryId: string;
  planId: string;
  enabled?: boolean;
}

function makeCheck(id: string, label: string): PreflightCheck {
  return { id, label, status: 'checking' };
}

 
function checkRepo(
  repoCheck: PreflightCheck,
  cleanCheck: PreflightCheck,
  repo: { name: string; isClean: boolean } | null | undefined
) {
  repoCheck.status = repo ? 'pass' : 'fail';
  repoCheck.detail = repo ? repo.name : 'Repository not found';

  if (repo) {
    cleanCheck.status = repo.isClean ? 'pass' : 'warn';
    cleanCheck.detail = repo.isClean
      ? 'No uncommitted changes'
      : 'Uncommitted changes detected';
  } else {
    cleanCheck.status = 'fail';
    cleanCheck.detail = 'Cannot check - repo not found';
  }
}

async function checkQaGates(gatesCheck: PreflightCheck, repositoryId: string) {
  try {
    const qaRes = await fetch(`/api/repositories/${repositoryId}/qa-gates`);
    if (qaRes.ok) {
      const qaData = await qaRes.json();
      const gateCount = qaData.config?.qaGates?.length || 0;
      gatesCheck.status = gateCount > 0 ? 'pass' : 'warn';
      gatesCheck.detail =
        gateCount > 0
          ? `${gateCount} gate${gateCount !== 1 ? 's' : ''} active`
          : 'No QA gates configured';
    } else {
      gatesCheck.status = 'warn';
      gatesCheck.detail = 'Could not load QA config';
    }
  } catch {
    gatesCheck.status = 'warn';
    gatesCheck.detail = 'QA check failed';
  }
}

async function checkPlanStatus(planCheck: PreflightCheck, planId: string) {
  try {
    const planRes = await fetch(`/api/plans/${planId}`);
    if (planRes.ok) {
      const planData = await planRes.json();
      const status = planData.plan?.status;
      if (status === 'ready') {
        planCheck.status = 'pass';
        planCheck.detail = `${planData.plan.totalTasks} tasks across ${planData.plan.totalPhases} phases`;
      } else if (status === 'draft') {
        planCheck.status = 'warn';
        planCheck.detail = 'Plan is still in draft - will be auto-readied';
      } else {
        planCheck.status = 'fail';
        planCheck.detail = `Plan status: ${status}`;
      }
    } else {
      planCheck.status = 'fail';
      planCheck.detail = 'Plan not found';
    }
  } catch {
    planCheck.status = 'fail';
    planCheck.detail = 'Could not verify plan';
  }
}

export function usePreflightChecks({
  repositoryId,
  planId,
  enabled = true,
}: UsePreflightChecksOptions) {
  const [checks, setChecks] = useState<PreflightCheck[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const { data: repoData } = useGetRepositoryQuery(repositoryId, {
    skip: !enabled,
  });

  const runChecks = useCallback(async () => {
    setIsChecking(true);

    const repoCheck = makeCheck('repo', 'Repository accessible');
    const cleanCheck = makeCheck('clean', 'Working tree clean');
    const gatesCheck = makeCheck('gates', 'QA gates configured');
    const planCheck = makeCheck('plan', 'Plan is ready');
    const results = [repoCheck, cleanCheck, gatesCheck, planCheck];
    setChecks([...results]);

    checkRepo(repoCheck, cleanCheck, repoData?.repository);
    setChecks([...results]);

    await checkQaGates(gatesCheck, repositoryId);
    setChecks([...results]);

    await checkPlanStatus(planCheck, planId);
    setChecks([...results]);

    setIsReady(
      results.every((r) => r.status === 'pass' || r.status === 'warn')
    );
    setIsChecking(false);
  }, [repositoryId, planId, repoData]);

  useEffect(() => {
    if (enabled) {
      runChecks();
    }
  }, [enabled, runChecks]);

  return { checks, isReady, isChecking, rerunChecks: runChecks };
}
