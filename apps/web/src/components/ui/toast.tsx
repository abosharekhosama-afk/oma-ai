'use client';

import { useOmaFeedback } from '@oma/ui/controls';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

type ToastTone = 'default' | 'success' | 'danger';

type ToastApi = {
  push: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { notification } = useOmaFeedback();

  const push = useCallback(
    (message: string, tone: ToastTone = 'default') => {
      notification.open({
        title: message,
        type: tone === 'danger' ? 'error' : tone === 'success' ? 'success' : 'info',
      });
    },
    [notification],
  );

  const api = useMemo(() => ({ push }), [push]);

  return <ToastContext.Provider value={api}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast requires ToastProvider');
  return ctx;
}
