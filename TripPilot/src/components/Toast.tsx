import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';

export type ToastVariant = 'info' | 'success' | 'warning' | 'danger';

export interface ToastOptions {
  /** Persistent toasts stay until tapped (DEC-082 update prompt). */
  persistent?: boolean;
  /** Action executed on tap; the toast dismisses itself afterwards. */
  onTap?: () => void;
}

export interface ToastMessage {
  id: number;
  message: string;
  variant: ToastVariant;
  persistent: boolean;
  onTap?: () => void;
}

type Listener = (toast: ToastMessage) => void;

let nextId = 1;
const listeners = new Set<Listener>();

/** Fire a toast from anywhere (pages, orchestration callbacks). */
export function showToast(message: string, variant: ToastVariant = 'info', options?: ToastOptions): void {
  const toast: ToastMessage = {
    id: nextId++,
    message,
    variant,
    persistent: options?.persistent ?? false,
    onTap: options?.onTap,
  };
  listeners.forEach((l) => l(toast));
}

const VARIANT_STYLE: Record<ToastVariant, { bg: string; border: string; color: string; icon: string }> = {
  info: { bg: 'var(--surface-container-high)', border: 'var(--border-subtle)', color: 'var(--on-surface)', icon: 'info' },
  success: { bg: '#6B8F7122', border: '#6B8F7140', color: 'var(--success)', icon: 'check_circle' },
  warning: { bg: '#D4A84322', border: '#D4A84340', color: 'var(--warning)', icon: 'warning' },
  danger: { bg: '#D9404022', border: '#D9404040', color: 'var(--error)', icon: 'error' },
};

const TOAST_DURATION_MS = 3500;

/** Mount once at the app root. Renders stacked toasts above everything. */
export function ToastHost() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const listener: Listener = (toast) => {
      setToasts((prev) => [...prev, toast]);
      if (!toast.persistent) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== toast.id));
        }, TOAST_DURATION_MS);
      }
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const handleTap = (toast: ToastMessage) => {
    toast.onTap?.();
    setToasts((prev) => prev.filter((t) => t.id !== toast.id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] w-full max-w-[400px] px-4 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => {
        const style = VARIANT_STYLE[toast.variant];
        const isInteractive = toast.persistent || Boolean(toast.onTap);
        return (
          <div
            key={toast.id}
            role={isInteractive ? 'button' : undefined}
            onClick={isInteractive ? () => handleTap(toast) : undefined}
            className={`rounded-xl px-4 py-3 flex items-center gap-2.5 backdrop-blur-md ${
              isInteractive ? 'pointer-events-auto btn-press' : ''
            }`}
            style={{
              background: style.bg,
              border: `1px solid ${style.border}`,
              animation: 'toast-in 0.2s ease-out',
            }}
          >
            <Icon name={style.icon} size={18} style={{ color: style.color }} />
            <p className="text-xs font-semibold leading-snug" style={{ color: style.color }}>
              {toast.message}
            </p>
          </div>
        );
      })}
      <style>{`
        @keyframes toast-in { from { transform: translateY(-8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
}
