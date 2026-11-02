'use client';

import { useEffect, useRef } from 'react';

interface IModalProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  danger?: boolean;
}

/** Accessible modal dialog with basic focus handling and Escape support. */
export const Modal = ({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  danger = false,
}: IModalProps) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>('input, textarea, button')?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="card w-full max-w-lg overflow-hidden bg-surface"
        data-testid="modal"
      >
        <div className="border-b px-5 py-4" style={{ borderColor: 'var(--border)' }}>
          <h2 className={`text-lg font-semibold ${danger ? 'text-red-600' : ''}`}>{title}</h2>
          {description ? (
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              {description}
            </p>
          ) : null}
        </div>
        {children ? <div className="max-h-[60vh] overflow-y-auto px-5 py-4">{children}</div> : null}
        {footer ? (
          <div
            className="flex flex-wrap justify-end gap-2 border-t px-5 py-4"
            style={{ borderColor: 'var(--border)' }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
};
