'use client';

import { useState, useCallback, useEffect } from 'react';
import type { StuckDetectionConfig } from '@/lib/stuck-detection/types';

interface UseStuckDetectionConfigReturn {
  /** Current configuration */
  config: StuckDetectionConfig | null;
  /** Whether config is loading */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Update configuration */
  updateConfig: (config: Partial<StuckDetectionConfig>) => Promise<boolean>;
  /** Reset to defaults */
  resetConfig: () => Promise<boolean>;
  /** Refresh configuration from server */
  refresh: () => Promise<void>;
}

async function fetchConfigFromServer(): Promise<StuckDetectionConfig> {
  const response = await fetch('/api/stuck-detection-config');
  if (!response.ok) throw new Error('Failed to fetch configuration');
  const data = await response.json();
  return data.config;
}

async function updateConfigOnServer(
  newConfig: StuckDetectionConfig
): Promise<StuckDetectionConfig> {
  const response = await fetch('/api/stuck-detection-config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newConfig),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to update configuration');
  }
  return (await response.json()).config;
}

async function resetConfigOnServer(): Promise<StuckDetectionConfig> {
  const response = await fetch('/api/stuck-detection-config', {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to reset configuration');
  return (await response.json()).config;
}

type SetConfig = React.Dispatch<React.SetStateAction<StuckDetectionConfig | null>>;
type SetError = React.Dispatch<React.SetStateAction<string | null>>;

function useConfigFetcher(setConfig: SetConfig, setError: SetError, setLoading: React.Dispatch<React.SetStateAction<boolean>>) {
  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setConfig(await fetchConfigFromServer());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [setConfig, setError, setLoading]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);
  return fetchConfig;
}

function useConfigMutations(
  config: StuckDetectionConfig | null,
  setConfig: SetConfig,
  setError: SetError
) {
  const updateConfig = useCallback(async (updates: Partial<StuckDetectionConfig>): Promise<boolean> => {
    if (!config) return false;
    try {
      setError(null);
      setConfig(await updateConfigOnServer({ ...config, ...updates }));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [config, setConfig, setError]);

  const resetConfig = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      setConfig(await resetConfigOnServer());
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [setConfig, setError]);

  return { updateConfig, resetConfig };
}

/**
 * Hook for managing stuck detection configuration
 */
export function useStuckDetectionConfig(): UseStuckDetectionConfigReturn {
  const [config, setConfig] = useState<StuckDetectionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useConfigFetcher(setConfig, setError, setLoading);
  const { updateConfig, resetConfig } = useConfigMutations(config, setConfig, setError);

  return { config, loading, error, updateConfig, resetConfig, refresh: fetchConfig };
}

export default useStuckDetectionConfig;
