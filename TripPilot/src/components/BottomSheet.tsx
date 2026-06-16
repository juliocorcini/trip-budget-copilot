import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { registerOverlayDismiss } from '@/utils/overlay-dismiss';
import { useAnimatedPresence } from '@/hooks/useAnimatedPresence';

/** DEC-195: portal target — the overlay host inside #root (keeps cap-native zoom),
 *  falling back to <body> if it isn't mounted yet (tests, very early render). */
function overlayHost(): HTMLElement {
  return document.getElementById('app-overlay-root') ?? document.body;
}

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

/**
 * Design-system bottom sheet (replaces native dialogs — DEC-022 / GAP-025).
 * Renders over the current screen, constrained to the app's 430px column.
 */
export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const { t } = useTranslation();
  // DEC-194: keep the sheet mounted through its drop-out animation.
  const { mounted, state } = useAnimatedPresence(open, 200);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    // DEC-193: the native back button closes the open sheet before navigating.
    const unregisterBack = registerOverlayDismiss(onClose);
    return () => {
      window.removeEventListener('keydown', onKey);
      unregisterBack();
    };
  }, [open, onClose]);

  if (!mounted) return null;
  const closing = state === 'closing';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      {/* GAP-R2-008: scrim is the close affordance — expose it to a11y tree */}
      <button
        aria-label={t('common.close')}
        className="absolute inset-0 bg-black/60 cursor-default"
        style={{
          animation: closing
            ? 'sheet-fade-out 180ms var(--ease-accelerate) both'
            : 'sheet-fade var(--motion-base) var(--ease-out) both',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-[430px] bg-surface-container rounded-t-2xl p-5 max-h-[85vh] overflow-y-auto"
        style={{
          animation: closing
            ? 'sheet-down 200ms var(--ease-accelerate) both'
            : 'sheet-up var(--motion-base) var(--ease-out) both',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-surface-high mx-auto mb-4" />
        {title && <p className="text-sm font-bold text-on-surface mb-4">{title}</p>}
        {children}
      </div>
    </div>,
    overlayHost(),
  );
}
