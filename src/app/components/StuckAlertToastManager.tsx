'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useStuckDetection } from '@/shared/hooks/useStuckDetection';
import { useStuckDetectionConfig } from '@/shared/hooks/useStuckDetectionConfig';
import { useStuckToasts } from '@/shared/components/ui/toast';
import type { StuckAlert, StuckDetectionConfig } from '@/lib/stuck-detection/types';

export interface StuckAlertToastManagerProps {
  /** Callback when user clicks "View" on a stuck alert toast */
  onViewAlert?: (repositoryId: string, sessionId: string | null) => void;
}

/**
 * Play a beep sound using Web Audio API
 */
function playBeepSound(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (error) {
    console.warn('[StuckAlertToastManager] Could not play alert sound:', error);
  }
}

/**
 * Hook to play alert sounds when enabled
 */
function useAlertSound(config: StuckDetectionConfig | null) {
  return useCallback(() => {
    if (config?.enableSoundAlerts) {
      playBeepSound();
    }
  }, [config?.enableSoundAlerts]);
}

/**
 * Hook to create stuck alert handlers
 */
function useStuckAlertHandlers(
  config: StuckDetectionConfig | null,
  showStuckAlert: ReturnType<typeof useStuckToasts>['showStuckAlert'],
  resolveStuckAlert: ReturnType<typeof useStuckToasts>['resolveStuckAlert'],
  onViewAlert: StuckAlertToastManagerProps['onViewAlert'],
  playAlertSound: () => void
) {
  const previousAlertsRef = useRef<Map<string, StuckAlert>>(new Map());

  const handleStuckDetected = useCallback((alert: StuckAlert) => {
    if (!config?.enableToastNotifications) return;

    const viewAction = onViewAlert ? () => onViewAlert(alert.repositoryId, alert.sessionId) : undefined;
    showStuckAlert(alert.repositoryId, alert.repositoryName, alert.reason, alert.stuckDurationSeconds, viewAction);

    if (alert.severity === 'critical' || alert.severity === 'high') {
      playAlertSound();
    }

    previousAlertsRef.current.set(alert.repositoryId, alert);
  }, [config?.enableToastNotifications, showStuckAlert, onViewAlert, playAlertSound]);

  const handleStuckResolved = useCallback((alert: StuckAlert) => {
    resolveStuckAlert(alert.repositoryId);
    previousAlertsRef.current.delete(alert.repositoryId);
  }, [resolveStuckAlert]);

  const handleStuckEscalated = useCallback((alert: StuckAlert) => {
    if (!config?.enableToastNotifications) return;

    const viewAction = onViewAlert ? () => onViewAlert(alert.repositoryId, alert.sessionId) : undefined;
    showStuckAlert(alert.repositoryId, alert.repositoryName, alert.reason, alert.stuckDurationSeconds, viewAction);

    if (alert.severity === 'critical') {
      playAlertSound();
    }

    previousAlertsRef.current.set(alert.repositoryId, alert);
  }, [config?.enableToastNotifications, showStuckAlert, onViewAlert, playAlertSound]);

  // Cleanup on unmount
  useEffect(() => {
    const alertsMap = previousAlertsRef.current;
    return () => alertsMap.clear();
  }, []);

  return { handleStuckDetected, handleStuckResolved, handleStuckEscalated };
}

/**
 * StuckAlertToastManager - Manages instant toast notifications for stuck detection
 *
 * Listens to stuck detection events via SSE and shows instant toast notifications.
 */
export function StuckAlertToastManager({ onViewAlert }: StuckAlertToastManagerProps) {
  const { config } = useStuckDetectionConfig();
  const { showStuckAlert, resolveStuckAlert } = useStuckToasts();
  const playAlertSound = useAlertSound(config);

  const { handleStuckDetected, handleStuckResolved, handleStuckEscalated } = useStuckAlertHandlers(
    config,
    showStuckAlert,
    resolveStuckAlert,
    onViewAlert,
    playAlertSound
  );

  useStuckDetection({
    onStuckDetected: handleStuckDetected,
    onStuckResolved: handleStuckResolved,
    onStuckEscalated: handleStuckEscalated,
  });

  return null;
}

export default StuckAlertToastManager;
