import { useEffect, useRef, useState, type TouchEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { registerOverlayDismiss } from '@/utils/overlay-dismiss';
import { overlayHost } from '@/utils/overlay-host';
import { useAnimatedPresence } from '@/hooks/useAnimatedPresence';

// FIELD R2 item 3 (F3): dragging the grab handle down past this distance (or a
// quick downward flick) dismisses the sheet; below it, the sheet snaps back.
const CLOSE_DISTANCE_PX = 90;

// DEC-407: elements that own the touch outright — a drag-to-dismiss must never
// start inside them. Text fields scroll/select internally; `[data-no-sheet-drag]`
// is the explicit opt-out for any custom scroller the heuristic can't detect.
const NO_SHEET_DRAG_SELECTOR =
  'textarea, input, select, [contenteditable]:not([contenteditable="false"]), [data-no-sheet-drag]';

/**
 * DEC-407: true when the touch began inside a text field / explicit opt-out within
 * the sheet body — the body drag must bow out entirely so scrolling or selecting
 * text never starts closing the sheet. Walks up to (and including) the boundary.
 */
export function isNoSheetDragTarget(
  target: EventTarget | null,
  boundary: HTMLElement | null,
): boolean {
  let el = target instanceof Element ? target : null;
  while (el) {
    if (el instanceof HTMLElement && el.matches(NO_SHEET_DRAG_SELECTOR)) return true;
    if (el === boundary) break;
    el = el.parentElement;
  }
  return false;
}

/**
 * DEC-407: the nearest scrollable ancestor between the touch target and the sheet
 * body (exclusive) that has room to scroll vertically — a nested list/textarea
 * that should consume the gesture instead of dragging the sheet.
 */
export function nearestNestedScrollable(
  target: EventTarget | null,
  boundary: HTMLElement | null,
): HTMLElement | null {
  let el = target instanceof HTMLElement ? target : null;
  while (el && el !== boundary) {
    if (el.scrollHeight > el.clientHeight) {
      const overflowY = getComputedStyle(el).overflowY;
      if (overflowY === 'auto' || overflowY === 'scroll') return el;
    }
    el = el.parentElement;
  }
  return null;
}

/**
 * D-BUG-12: decide whether a touch that began INSIDE the sheet body should turn
 * into a drag-to-dismiss ("pull the content down from the top to close"), keep
 * waiting, or yield to the native scroll. Pure so the gesture rule is testable.
 *  - `abort`   → not a close gesture (moving up, horizontal, list not at top, or
 *                a nested scrollable still owns the gesture) → let it scroll.
 *  - `pending` → too small to tell yet; keep watching.
 *  - `drag`    → a clear downward, vertical pull while the body is at the top.
 *
 * DEC-407: `nestedCanScroll` is true when a nested scrollable under the finger can
 * still absorb a downward pull (it is not at its own top); the sheet then yields.
 */
export function decideBodyDrag(
  dy: number,
  dx: number,
  atTop: boolean,
  nestedCanScroll = false,
): 'pending' | 'abort' | 'drag' {
  if (nestedCanScroll) return 'abort';
  if (dy < -2) return 'abort';
  if (Math.abs(dx) > Math.abs(dy)) return 'abort';
  if (dy <= 6) return 'pending';
  if (!atTop) return 'abort';
  return 'drag';
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
  // FIELD R2 item 3 (F3): live drag-to-dismiss from the grab handle.
  const dragStartY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dragClosing, setDragClosing] = useState(false);
  // D-BUG-12: a drag can also begin in the body when the content is at the top.
  const bodyRef = useRef<HTMLDivElement | null>(null);
  // DEC-407: `scrollEl` is the nested scrollable under the finger (if any) so the
  // move handler can yield the gesture while it still has room to scroll.
  const bodyDrag = useRef<{
    startY: number;
    startX: number;
    active: boolean;
    scrollEl: HTMLElement | null;
  } | null>(null);

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
      bodyDrag.current = null;
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

  // D-BUG-12: drag-to-dismiss starting from the sheet body. The handle claims a
  // gesture synchronously (sets dragStartY) before this bubbles, so we bow out
  // when it already owns the touch. A body drag only commits while the content
  // is at the very top and the pull is clearly downward; otherwise the body
  // scrolls as usual.
  const onBodyTouchStart = (e: TouchEvent) => {
    if (dragStartY.current !== null) return;
    const touch = e.touches[0];
    if (e.touches.length !== 1 || !touch) return;
    // DEC-407: a touch that begins inside a text field / opt-out never drags the
    // sheet — typing, selecting or scrolling there must not start a dismiss.
    if (isNoSheetDragTarget(e.target, bodyRef.current)) {
      bodyDrag.current = null;
      return;
    }
    if ((bodyRef.current?.scrollTop ?? 0) > 0) {
      bodyDrag.current = null;
      return;
    }
    bodyDrag.current = {
      startY: touch.clientY,
      startX: touch.clientX,
      active: false,
      // DEC-407: remember a nested scroller so the move handler can yield to it.
      scrollEl: nearestNestedScrollable(e.target, bodyRef.current),
    };
  };

  const onBodyTouchMove = (e: TouchEvent) => {
    const drag = bodyDrag.current;
    const touch = e.touches[0];
    if (!drag || !touch) return;
    const dy = touch.clientY - drag.startY;
    const dx = touch.clientX - drag.startX;
    if (!drag.active) {
      const atTop = (bodyRef.current?.scrollTop ?? 0) <= 0;
      // DEC-407: a nested scrollable that isn't at its own top still owns a
      // downward pull — yield the gesture instead of dragging the sheet.
      const nestedCanScroll = drag.scrollEl !== null && drag.scrollEl.scrollTop > 0;
      const decision = decideBodyDrag(dy, dx, atTop, nestedCanScroll);
      if (decision === 'abort') {
        bodyDrag.current = null;
        return;
      }
      if (decision === 'pending') return;
      drag.active = true;
      dragStartY.current = drag.startY;
      setDragging(true);
    }
    setDragY(Math.max(0, dy));
  };

  const onBodyTouchEnd = () => {
    const drag = bodyDrag.current;
    bodyDrag.current = null;
    if (drag?.active) onHandleTouchEnd();
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
        ref={bodyRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-[430px] bg-surface-container rounded-t-2xl p-5 max-h-[85vh] overflow-y-auto"
        style={{ ...sheetStyle, overscrollBehavior: 'contain' }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onBodyTouchStart}
        onTouchMove={onBodyTouchMove}
        onTouchEnd={onBodyTouchEnd}
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
