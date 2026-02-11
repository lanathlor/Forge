'use client';

import { Provider } from 'react-redux';
import { store } from '@/store';
import { ToastProvider } from '@/shared/components/ui/toast';
import { SSEProvider } from '@/shared/contexts/SSEContext';

/**
 * Default SSE connections to establish on app mount
 * Using unified endpoint that combines all streams
 */
const SSE_CONNECTIONS = [
  { id: 'unified', url: '/api/sse' },
];

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <SSEProvider autoConnect={SSE_CONNECTIONS}>
        <ToastProvider maxToasts={5} defaultDuration={5000}>
          {children}
        </ToastProvider>
      </SSEProvider>
    </Provider>
  );
}
