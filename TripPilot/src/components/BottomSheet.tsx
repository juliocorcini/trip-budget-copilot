import { useEffect, useRef, useState, type TouchEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { registerOverlayDismiss } from '@/utils/overlay-dismiss';
import { useAnimatedPresence } from '@/hooks/useAnimatedPresence';

/** DEC-195: portal target — the overlay host inside #root (keeps cap-native zoom),
 *  falling back to <body> if it isn't mounted yet (tests, very early render). */
function overlayHost(): HTMLElement {
  return document.getElementById('app-overlay-root') ?? document.body;
}

// FIELD R2 item 3 (F3): dragging the grab handle down past this distance (or a
// quick downward flick) dismisses the sheet; below it, the sheet snaps back.
const CLOSE_DISTANCE_PX = 90;

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
  // FIELD R2 item 3 (F3): live drag-to-dismiss from the grab handle.
  const dragStartY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dragClosing, setDragClosing] = useState(false);

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

  // Reset the drag offset whenever the sheet (re)opens, so a reused instance
  // never starts mid-drag.
  useEffect(() => {
    if (open) {
      dragStartY.current = null;
      setDragY(0);
      setDragging(false);
      setDragClosing(false);
    }
  }, [open]);

  if (!mounted) return null;
  const closing = state === 'closing';

  const onHandleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    if (e.touches.length !== 1 || !touch) return;
    dragStartY.current = touch.clientY;
    setDragging(true);
  };

  const onHandleTouchMove = (e: TouchEvent) => {
    const touch = e.touches[0];
    if (dragStartY.current === null || !touch) return;
    const dy = touch.clientY - dragStartY.current;
    // Only a downward drag moves the sheet; an upward pull does nothing.
    setDragY(Math.max(0, dy));
  };

  const onHandleTouchEnd = () => {
    if (dragStartY.current === null) return;
    dragStartY.current = null;
    setDragging(false);
    if (dragY > CLOSE_DISTANCE_PX) {
      // Slide the rest of the way out, then unmount via the parent.
      setDragClosing(true);
      setDragY(window.innerHeight);
      window.setTimeout(onClose, 200);
    } else {
      // Snap back to rest.
      setDragY(0);
    }
  };

  // While dragging (or sliding out from a drag) the inline transform drives the
  // sheet, so the open/close keyframes must stand down; otherwise the normal
  // mount/close animation plays.
  const dragActive = dragging || dragClosing || dragY > 0;
  const sheetStyle: React.CSSProperties = dragActive
    ? {
        transform: `translate3d(0, ${dragY}px, 0)`,
        transition: dragging ? 'none' : 'transform 200ms var(--ease-accelerate)',
        animation: 'none',
      }
    : {
        animation: closing
          ? 'sheet-down 200ms var(--ease-accelerate) both'
          : 'sheet-up var(--motion-base) var(--ease-out) both',
      };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      {/* GAP-R2-008: scrim is the close affordance — expose it to a11y tree */}
      <button
        aria-label={t('common.close')}
        className="absolute inset-0 bg-black/60 cursor-default"
        style={{
          animation:
            closing || dragClosing
              ? 'sheet-fade-out 180ms var(--ease-accelerate) both'
              : 'sheet-fade var(--motion-base) var(--ease-out) both',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-[430px] bg-surface-container rounded-t-2xl p-5 max-h-[85vh] overflow-y-auto"
        style={sheetStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* FIELD R2 item 3 (F3): the top strip (grab handle + title) is the drag
            affordance — pull it down to dismiss. The negative margins extend the
            touch target over the sheet's top padding for an easy grab. */}
        <div
          className="-mx-5 -mt-5 px-5 pt-5 pb-3 cursor-grab touch-none"
          onTouchStart={onHandleTouchStart}
          onTouchMove={onHandleTouchMove}
          onTouchEnd={onHandleTouchEnd}
        >
          <div className="w-10 h-1.5 rounded-full bg-surface-high mx-auto" />
          {title && <p className="text-sm font-bold text-on-surface mt-4">{title}</p>}
        </div>
        {children}
      </div>
    </div>,
    overlayHost(),
  );
}
