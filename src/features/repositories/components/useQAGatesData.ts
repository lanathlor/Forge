import { useEffect, useState, useCallback, useRef } from 'react';
import type {
  QAGate,
  QAGatesConfigData,
  QARunStatusData,
} from '../types/qa-gates';

interface UseQAGatesDataReturn {
  config: QAGatesConfigData | null;
  gates: QAGate[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  runStatus: QARunStatusData | null;
  isRunning: boolean;
  fetchStatus: () => Promise<void>;
  runQAGates: () => Promise<void>;
  updateGates: (gates: QAGate[]) => void;
  saveConfig: () => Promise<void>;
  toggleGate: (name: string, enabled: boolean) => void;
  deleteGate: (name: string) => void;
  addGate: (gate: QAGate) => void;
  reorderGates: (fromIndex: number, toIndex: number) => void;
}

async function fetchQAGatesConfig(repositoryId: string): Promise<QAGatesConfigData> {
  const response = await fetch(`/api/repositories/${repositoryId}/qa-gates`);
  if (!response.ok) throw new Error('Failed to fetch QA gates configuration');
  return response.json();
}

function useQAGatesConfig(repositoryId: string) {
  const [config, setConfig] = useState<QAGatesConfigData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const refetch = useCallback(() => {
    isMountedRef.current = true;
    setIsLoading(true);
    setError(null);

    const timeoutId = setTimeout(() => {
      if (isMountedRef.current) {
        setError('Request is taking longer than expected. The server might be slow.');
        setIsLoading(false);
      }
    }, 30000);

    fetchQAGatesConfig(repositoryId)
      .then((data) => {
        clearTimeout(timeoutId);
        if (isMountedRef.current) { setConfig(data); setIsLoading(false); }
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setIsLoading(false);
        }
      });

    return () => { isMountedRef.current = false; clearTimeout(timeoutId); };
  }, [repositoryId]);

  useEffect(() => {
    return refetch();
  }, [refetch]);

  return { config, isLoading, error, refetch };
}

async function fetchQAGateStatus(repositoryId: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(
      `/api/repositories/${repositoryId}/qa-gates/status`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error('Failed to fetch QA gate status');
    return await response.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name !== 'AbortError') {
      console.error('[QAGatesStatus] Error fetching status:', err);
    }
    return null;
  }
}

function useQAGatesStatus(repositoryId: string, configLoaded: boolean) {
  const [runStatus, setRunStatus] = useState<QARunStatusData | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const fetchStatus = useCallback(async () => {
    const data = await fetchQAGateStatus(repositoryId);
    if (data) {
      setRunStatus(data);
      setIsRunning(data.run?.status === 'running');
    }
  }, [repositoryId]);

  useEffect(() => {
    if (configLoaded) fetchStatus();
  }, [configLoaded, fetchStatus]);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(fetchStatus, 2000);
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(
        `/api/repositories/${repositoryId}/qa-gates/run`,
        {
          method: 'POST',
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error('Failed to start QA gates run');
      }

      setIsRunning(true);
      await fetchStatus();
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Request timed out - please try again');
      } else {
        const message = err instanceof Error ? err.message : 'Failed to start QA gates';
        console.error('Error running QA gates:', err);
        setError(message);
      }
    }
  }, [repositoryId, fetchStatus]);

  return { runQAGates, error, isRunning };
}

async function persistGatesConfig(repositoryId: string, config: QAGatesConfigData, gates: QAGate[]) {
  const body = {
    version: config.config.version,
    maxRetries: config.config.maxRetries,
    qaGates: gates,
  };
  const response = await fetch(
    `/api/repositories/${repositoryId}/qa-gates/save`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );
  if (!response.ok) throw new Error('Failed to save configuration');
}

function useGatesMutation(repositoryId: string, config: QAGatesConfigData | null) {
  const [gates, setGates] = useState<QAGate[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (config) { setGates(config.config.qaGates); }
  }, [config]);

  const updateGates = useCallback((newGates: QAGate[]) => { setGates(newGates); }, []);

  const toggleGate = useCallback((name: string, enabled: boolean) => {
    setGates(prev => prev.map(g => g.name === name ? { ...g, enabled } : g));
  }, []);

  const deleteGate = useCallback((name: string) => {
    setGates(prev => prev.filter(g => g.name !== name).map((g, i) => ({ ...g, order: i + 1 })));
  }, []);

  const addGate = useCallback((gate: QAGate) => {
    setGates(prev => [...prev, { ...gate, order: prev.length + 1 }]);
  }, []);

  const reorderGates = useCallback((fromIndex: number, toIndex: number) => {
    setGates(prev => {
      const items = [...prev];
      const [moved] = items.splice(fromIndex, 1);
      if (moved) items.splice(toIndex, 0, moved);
      return items.map((g, i) => ({ ...g, order: i + 1 }));
    });
  }, []);

  const saveConfig = useCallback(async () => {
    if (!config) return;
    setIsSaving(true);
    try {
      await persistGatesConfig(repositoryId, config, gates);
    } catch (err) {
      console.error('Error saving config:', err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [repositoryId, config, gates]);

  return { gates, isSaving, updateGates, toggleGate, deleteGate, addGate, reorderGates, saveConfig };
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
  const {
    gates, isSaving, updateGates, toggleGate, deleteGate, addGate, reorderGates, saveConfig,
  } = useGatesMutation(repositoryId, config);

  const isRunning = statusRunning || runnerRunning;
  const error = configError || runError;

  return {
    config,
    gates,
    isLoading,
    isSaving,
    error,
    runStatus,
    isRunning,
    fetchStatus,
    runQAGates,
    updateGates,
    saveConfig,
    toggleGate,
    deleteGate,
    addGate,
    reorderGates,
  };
}
