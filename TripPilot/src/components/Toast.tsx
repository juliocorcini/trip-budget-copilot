import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { hapticSuccess, hapticWarning, hapticError } from '@/utils/haptics';

export type ToastVariant = 'info' | 'success' | 'warning' | 'danger';

export interface ToastOptions {
  /** Persistent toasts stay until tapped (DEC-082 update prompt). */
  persistent?: boolean;
  /** Action executed on tap; the toast dismisses itself afterwards. */
  onTap?: () => void;
  /** DEC-126: visible action chip (e.g. "Undo") — tap target = whole toast. */
  actionLabel?: string;
  /** Override the default auto-dismiss window (undo toasts stay longer). */
  durationMs?: number;
}

export interface ToastMessage {
  id: number;
  message: string;
  variant: ToastVariant;
  persistent: boolean;
  onTap?: () => void;
  actionLabel?: string;
  durationMs: number;
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
    actionLabel: options?.actionLabel,
    durationMs: options?.durationMs ?? TOAST_DURATION_MS,
  };
  // N8: a toast is a result — confirm it with a matching haptic (info stays
  // silent to avoid buzzing on every passive message).
  if (variant === 'success') hapticSuccess();
  else if (variant === 'warning') hapticWarning();
  else if (variant === 'danger') hapticError();
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
        }, toast.durationMs);
      }
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const removeToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  // Julio device test 2026-06-18: the action (e.g. Undo) fires ONLY from the
  // chip; a swipe clears the toast WITHOUT firing it.
  const runAction = (toast: ToastMessage) => {
    toast.onTap?.();
    removeToast(toast.id);
  };

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[60] w-full max-w-[400px] px-4 flex flex-col gap-2 pointer-events-none"
      style={{ top: 'calc(var(--safe-top) + 1rem)' }}
    >
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onAction={() => runAction(toast)}
          onDismiss={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}

// Horizontal travel (px) past which a swipe clears the toast.
const SWIPE_DISMISS_PX = 72;

/**
 * One toast row. Julio device test 2026-06-18:
 *  - the action chip ("Desfazer") is the ONLY trigger for `onTap` — a stray tap
 *    on the body no longer undoes anything;
 *  - the row can be SWIPED sideways to dismiss it, without firing the action;
 *  - a tap-anywhere body remains only for action-bearing prompts WITHOUT a chip
 *    (the persistent "tap to update" toast).
 */
function ToastItem({
  toast,
  onAction,
  onDismiss,
}: {
  toast: ToastMessage;
  onAction: () => void;
  onDismiss: () => void;
}) {
  const style = VARIANT_STYLE[toast.variant];
  const hasChip = Boolean(toast.actionLabel);
  const bodyTappable = Boolean(toast.onTap) && !hasChip;

  const startX = useRef<number | null>(null);
  const [dx, setDx] = useState(0);
  const [dismissing, setDismissing] = useState(false);
  const dragging = startX.current !== null;

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    startX.current = e.clientX;
    setDx(0);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (startX.current === null) return;
    setDx(e.clientX - startX.current);
  };
  const endDrag = () => {
    if (startX.current === null) return;
    const delta = dx;
    startX.current = null;
    if (Math.abs(delta) > SWIPE_DISMISS_PX) {
      setDismissing(true);
      setDx(delta > 0 ? 480 : -480);
      window.setTimeout(onDismiss, 170);
    } else {
      setDx(0);
    }
  };

  const swiped = dx !== 0 || dismissing;
  const dragStyle: React.CSSProperties = swiped
    ? {
        transform: `translateX(${dx}px)`,
        opacity: dismissing ? 0 : Math.max(0.25, 1 - Math.abs(dx) / 220),
        transition: dragging
          ? 'none'
          : 'transform 170ms var(--ease-out), opacity 170ms var(--ease-out)',
      }
    : { animation: 'toast-in var(--motion-base) var(--ease-out) both' };

  return (
    <div
      role={bodyTappable ? 'button' : undefined}
      onClick={bodyTappable && !swiped ? onAction : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={() => {
        startX.current = null;
        setDx(0);
      }}
      className={`rounded-xl px-4 py-3 flex items-center gap-2.5 backdrop-blur-md pointer-events-auto select-none ${
        bodyTappable ? 'btn-press' : ''
      }`}
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        touchAction: 'pan-y',
        ...dragStyle,
      }}
    >
      <Icon name={style.icon} size={18} style={{ color: style.color }} />
      <p className="text-xs font-semibold leading-snug flex-1" style={{ color: style.color }}>
        {toast.message}
      </p>
      {toast.actionLabel && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAction();
          }}
          className="text-xs font-extrabold uppercase tracking-wide px-2.5 py-1 rounded-lg shrink-0 btn-press"
          style={{ background: 'var(--highlight-subtle)', color: 'var(--on-surface)' }}
        >
          {toast.actionLabel}
        </button>
      )}
    </div>
  );
}
