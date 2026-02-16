import { type KeyboardShortcut } from '@/shared/hooks';

/**
 * Create keyboard shortcuts for the dashboard
 */
// eslint-disable-next-line max-lines-per-function
export function createDashboardShortcuts(_handlers: {
  showShortcuts: () => void;
  goToTasks: () => void;
  goToPlans: () => void;
  goToQAGates: () => void;
  goToSummary: () => void;
  closePanel: () => void;
}): Omit<KeyboardShortcut, 'handler'>[] {
  return [
    {
      id: 'show-shortcuts',
      key: '?',
      shift: true,
      description: 'Show keyboard shortcuts',
      category: 'General',
      excludeInputs: true,
    },
    {
      id: 'go-to-tasks',
      key: '1',
      ctrl: true,
      description: 'Go to Tasks tab',
      category: 'Navigation',
      excludeInputs: true,
    },
    {
      id: 'go-to-plans',
      key: '2',
      ctrl: true,
      description: 'Go to Plans tab',
      category: 'Navigation',
      excludeInputs: true,
    },
    {
      id: 'go-to-qa-gates',
      key: '3',
      ctrl: true,
      description: 'Go to QA Gates tab',
      category: 'Navigation',
      excludeInputs: true,
    },
    {
      id: 'go-to-summary',
      key: '4',
      ctrl: true,
      description: 'Go to Summary tab',
      category: 'Navigation',
      excludeInputs: true,
    },
    {
      id: 'close-panel',
      key: 'Escape',
      description: 'Close panels and modals',
      category: 'General',
      excludeInputs: false,
    },
  ];
}

export function registerDashboardShortcuts(
  registerShortcut: (shortcut: KeyboardShortcut) => void,
  handlers: {
    showShortcuts: () => void;
    goToTasks: () => void;
    goToPlans: () => void;
    goToQAGates: () => void;
    goToSummary: () => void;
    closePanel: () => void;
  }
) {
  const shortcuts = createDashboardShortcuts(handlers);
  const handlerMap = [
    handlers.showShortcuts,
    handlers.goToTasks,
    handlers.goToPlans,
    handlers.goToQAGates,
    handlers.goToSummary,
    handlers.closePanel,
  ];

  shortcuts.forEach((shortcut, index) => {
    const handler = handlerMap[index];
    if (handler) {
      registerShortcut({
        ...shortcut,
        handler,
      });
    }
  });
}
