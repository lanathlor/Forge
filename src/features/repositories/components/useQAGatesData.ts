import { useEffect, useState, useCallback } from 'react';
import type {
  QAGatesConfigData,
  QARunStatusData,
} from '../types/qa-gates';

interface UseQAGatesDataReturn {
  config: QAGatesConfigData | null;
  isLoading: boolean;
  error: string | null;
  runStatus: QARunStatusData | null;
  isRunning: boolean;
  fetchStatus: () => Promise<void>;
  runQAGates: () => Promise<void>;
}

function useQAGatesConfig(repositoryId: string) {
  const [config, setConfig] = useState<QAGatesConfigData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchConfig() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/repositories/${repositoryId}/qa-gates`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch QA gates configuration');
        }

        const data = await response.json();
        setConfig(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }

    fetchConfig();
  }, [repositoryId]);

  return { config, isLoading, error };
}

function useQAGatesStatus(
  repositoryId: string,
  configLoaded: boolean
) {
  const [runStatus, setRunStatus] = useState<QARunStatusData | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/repositories/${repositoryId}/qa-gates/status`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch QA gate status');
      }

      const data = await response.json();
      setRunStatus(data);
      setIsRunning(data.run?.status === 'running');
    } catch (err) {
      console.error('Error fetching status:', err);
    }
  }, [repositoryId]);

  useEffect(() => {
    if (configLoaded) {
      fetchStatus();
    }
  }, [configLoaded, fetchStatus]);

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      fetchStatus();
    }, 2000);

    return () => clearInterval(interval);
  }, [isRunning, fetchStatus]);

  return { runStatus, isRunning, fetchStatus };
}

function useQAGatesRunner(
  repositoryId: string,
  fetchStatus: () => Promise<void>
) {
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const runQAGates = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/repositories/${repositoryId}/qa-gates/run`,
        { method: 'POST' }
      );

      if (!response.ok) {
        throw new Error('Failed to start QA gates run');
      }

      setIsRunning(true);
      await fetchStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start QA gates';
      console.error('Error running QA gates:', err);
      setError(message);
    }
  }, [repositoryId, fetchStatus]);

  return { runQAGates, error, isRunning };
}

export function useQAGatesData(
  repositoryId: string
): UseQAGatesDataReturn {
  const { config, isLoading, error: configError } = useQAGatesConfig(repositoryId);
  const { runStatus, isRunning: statusRunning, fetchStatus } = useQAGatesStatus(
    repositoryId,
    !!config
  );
  const { runQAGates, error: runError, isRunning: runnerRunning } = useQAGatesRunner(
    repositoryId,
    fetchStatus
  );

  const isRunning = statusRunning || runnerRunning;
  const error = configError || runError;

  return {
    config,
    isLoading,
    error,
    runStatus,
    isRunning,
    fetchStatus,
    runQAGates,
  };
}
