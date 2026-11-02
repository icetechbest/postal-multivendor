'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

export type TToastVariant = 'success' | 'error' | 'info';

export interface IToast {
  id: number;
  message: string;
  variant: TToastVariant;
}

interface IToastContext {
  toasts: IToast[];
  showToast: (message: string, variant?: TToastVariant) => void;
  dismissToast: (id: number) => void;
}

const ToastContext = createContext<IToastContext | undefined>(undefined);

const VARIANT_CLASSES: Record<TToastVariant, string> = {
  success:
    'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100',
  error:
    'border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100',
  info: 'border-slate-300 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
};

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<IToast[]>([]);
  const counter = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: TToastVariant = 'info') => {
      counter.current += 1;
      const id = counter.current;
      setToasts((current) => [...current, { id, message, variant }]);
      window.setTimeout(() => dismissToast(id), 5000);
    },
    [dismissToast],
  );

  const value = useMemo(
    () => ({ toasts, showToast, dismissToast }),
    [toasts, showToast, dismissToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${VARIANT_CLASSES[toast.variant]}`}
            data-testid="toast"
            data-variant={toast.variant}
          >
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="shrink-0 opacity-60 transition hover:opacity-100"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): IToastContext => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
};
