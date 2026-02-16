'use client';

import { useEffect } from 'react';
import { useKeyboardShortcuts } from '@/shared/hooks';

/**
 * Register dashboard keyboard shortcuts
 */
export function useDashboardKeyboardShortcuts({
  handleTabChange,
  selectedTaskId,
  handleSelectTask,
  showShortcutsModal,
  setShowShortcutsModal,
  showHistoryModal,
  setShowHistoryModal,
  showSummaryModal,
  setShowSummaryModal,
  reviewPlanId,
  setReviewPlanId,
}: {
  handleTabChange: (tab: string) => void;
  selectedTaskId: string | null;
  handleSelectTask: (taskId: string | null) => void;
  showShortcutsModal: boolean;
  setShowShortcutsModal: (show: boolean) => void;
  showHistoryModal: boolean;
  setShowHistoryModal: (show: boolean) => void;
  showSummaryModal: boolean;
  setShowSummaryModal: (show: boolean) => void;
  reviewPlanId: string | null;
  setReviewPlanId: (id: string | null) => void;
}) {
  const { registerShortcut } = useKeyboardShortcuts();

  useEffect(() => {
    // Show shortcuts modal
    registerShortcut({
      id: 'show-shortcuts',
      key: '?',
      shift: true,
      description: 'Show keyboard shortcuts',
      category: 'General',
      handler: () => setShowShortcutsModal(true),
      excludeInputs: true,
    });

    // Tab navigation shortcuts
    registerShortcut({
      id: 'go-to-tasks',
      key: '1',
      ctrl: true,
      description: 'Go to Tasks tab',
      category: 'Navigation',
      handler: () => handleTabChange('tasks'),
      excludeInputs: true,
    });

    registerShortcut({
      id: 'go-to-plans',
      key: '2',
      ctrl: true,
      description: 'Go to Plans tab',
      category: 'Navigation',
      handler: () => handleTabChange('plans'),
      excludeInputs: true,
    });

    registerShortcut({
      id: 'go-to-qa-gates',
      key: '3',
      ctrl: true,
      description: 'Go to QA Gates tab',
      category: 'Navigation',
      handler: () => handleTabChange('qa-gates'),
      excludeInputs: true,
    });

    registerShortcut({
      id: 'go-to-summary',
      key: '4',
      ctrl: true,
      description: 'Go to Summary tab',
      category: 'Navigation',
      handler: () => handleTabChange('summary'),
      excludeInputs: true,
    });

    // Close panels/modals with Escape
    registerShortcut({
      id: 'close-panel',
      key: 'Escape',
      description: 'Close panels and modals',
      category: 'General',
      handler: () => {
        if (selectedTaskId) {
          handleSelectTask(null);
        } else if (showShortcutsModal) {
          setShowShortcutsModal(false);
        } else if (showHistoryModal) {
          setShowHistoryModal(false);
        } else if (showSummaryModal) {
          setShowSummaryModal(false);
        } else if (reviewPlanId) {
          setReviewPlanId(null);
        }
      },
      excludeInputs: false,
    });
  }, [
    registerShortcut,
    handleTabChange,
    selectedTaskId,
    handleSelectTask,
    showShortcutsModal,
    showHistoryModal,
    showSummaryModal,
    reviewPlanId,
    setShowShortcutsModal,
    setShowHistoryModal,
    setShowSummaryModal,
    setReviewPlanId,
  ]);
}
