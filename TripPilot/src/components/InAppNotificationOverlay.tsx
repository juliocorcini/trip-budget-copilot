import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';

export interface InAppNotification {
  id: string;
  icon: string;
  title: string;
  body: string;
}

const AUTO_DISMISS_MS = 6000;

type Listener = (n: InAppNotification) => void;
const listeners = new Set<Listener>();

export function showInAppNotification(notification: InAppNotification): void {
  for (const fn of listeners) fn(notification);
}

export function InAppNotificationOverlay() {
  const [notification, setNotification] = useState<InAppNotification | null>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    setVisible(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    setTimeout(() => setNotification(null), 400);
  }, []);

  useEffect(() => {
    const handler: Listener = (n) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setNotification(n);
      requestAnimationFrame(() => setVisible(true));
      timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    };
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [dismiss]);

  if (!notification) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] flex justify-center px-4 pt-[max(env(safe-area-inset-top),12px)]"
      style={{ pointerEvents: 'none' }}
    >
      <div
        className="w-full max-w-[400px] rounded-2xl overflow-hidden flex items-center gap-3 p-4"
        style={{
          background: 'var(--surface-container-high)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.15)',
          transform: visible ? 'translateY(0)' : 'translateY(-100%)',
          opacity: visible ? 1 : 0,
          transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease',
          pointerEvents: 'auto',
        }}
        onClick={dismiss}
      >
        <div
          className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center"
          style={{
            background: 'color-mix(in srgb, var(--primary) 15%, transparent)',
          }}
        >
          <Icon
            name={notification.icon}
            size={22}
            filled
            style={{ color: 'var(--primary)' }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3
            className="text-sm font-bold leading-tight truncate"
            style={{ color: 'var(--on-surface)' }}
          >
            {notification.title}
          </h3>
          <p
            className="text-xs leading-snug mt-0.5 line-clamp-2"
            style={{ color: 'var(--on-surface-dim)' }}
          >
            {notification.body}
          </p>
        </div>
        <button
          className="btn-press p-1.5 rounded-lg shrink-0"
          onClick={(e) => { e.stopPropagation(); dismiss(); }}
        >
          <Icon name="close" size={16} style={{ color: 'var(--on-surface-faint)' }} />
        </button>
      </div>
    </div>
  );
}
