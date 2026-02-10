'use client';

import { Provider } from 'react-redux';
import { store } from '@/store';
import { ToastProvider } from '@/shared/components/ui/toast';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <ToastProvider maxToasts={5} defaultDuration={5000}>
        {children}
      </ToastProvider>
    </Provider>
  );
}
