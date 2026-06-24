import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  getHelpTopics,
  getHelpTopicTitleKey,
  getHelpTopicBodyKey,
} from '@/domain/help';
import type { HelpScreenId } from '@/domain/help';
import { Icon } from '@/components/Icon';

/**
 * DEC-121 (R-12): contextual help mode. A "?" in the header opens a
 * darkened overlay over the REAL screen; topics are walked one by one,
 * scrolling to and highlighting the actual element (`data-help-anchor`)
 * with the explanation card pinned at the bottom.
 *
 * DEC-125: the overlay is portaled to <body> (page sticky headers create
 * stacking contexts that trapped it under the bottom nav) and the card is
 * draggable vertically so it never hides what the user wants to look at.
 */

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Vertical drag for the explanation card (pointer events, clamped to viewport). */
function useDraggableCard() {
  const [offsetY, setOffsetY] = useState(0);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ pointerId: number; startY: number; baseOffset: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      dragRef.current = { pointerId: e.pointerId, startY: e.clientY, baseOffset: offsetY };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [offsetY]
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const cardHeight = cardRef.current?.offsetHeight ?? 200;
    // 0 = anchored at the bottom; negative values move the card up.
    const minOffset = -(window.innerHeight - cardHeight - 24);
    const next = drag.baseOffset + (e.clientY - drag.startY);
    setOffsetY(Math.min(0, Math.max(minOffset, next)));
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
  }, []);

  return { offsetY, cardRef, handleProps: { onPointerDown, onPointerMove, onPointerUp } };
}

function HelpOverlay({ screenId, onClose }: { screenId: HelpScreenId; onClose: () => void }) {
  const { t } = useTranslation();
  const topics = getHelpTopics(screenId);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<HighlightRect | null>(null);
  const { offsetY, cardRef, handleProps } = useDraggableCard();

  const current = topics[index]!;

  const measure = useCallback(() => {
    if (!current.anchorId) {
      setRect(null);
      return;
    }
    const el = document.querySelector(`[data-help-anchor="${current.anchorId}"]`);
    if (!el) {
      setRect(null);
      return;
    }
    const box = el.getBoundingClientRect();
    setRect({ top: box.top - 6, left: box.left - 6, width: box.width + 12, height: box.height + 12 });
  }, [current.anchorId]);

  useEffect(() => {
    if (current.anchorId) {
      const el = document.querySelector(`[data-help-anchor="${current.anchorId}"]`);
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    // Wait for the smooth scroll to settle before measuring the highlight.
    const timer = setTimeout(measure, 380);
    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', measure);
    };
  }, [current.anchorId, measure]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[80]">
      {/* Dimmer — tapping it closes the help mode. When an element is
          highlighted, the ring's spread shadow paints the dim instead
          (it leaves a "hole" over the real element). */}
      <div className={`absolute inset-0 ${rect ? '' : 'bg-black/70'}`} onClick={onClose} />

      {/* Highlight ring over the real element */}
      {rect && (
        <div
          className="absolute rounded-xl pointer-events-none transition-[top,left,width,height] duration-300"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            boxShadow: '0 0 0 2px var(--primary), 0 0 0 9999px rgba(0,0,0,0.7)',
            background: 'transparent',
          }}
        />
      )}

      {/* Explanation card — draggable up/down via the grab handle */}
      <div
        className="absolute bottom-0 left-0 right-0 max-w-[430px] mx-auto p-4 pb-[calc(env(safe-area-inset-bottom)+16px)]"
        style={{ transform: `translateY(${offsetY}px)`, transition: 'none' }}
      >
        <div
          ref={cardRef}
          className="bg-surface-container rounded-2xl p-4 shadow-2xl"
          style={{ border: '1px solid var(--surface-container-high)' }}
        >
          <div
            {...handleProps}
            className="flex justify-center -mt-2 mb-1 py-1.5 cursor-grab active:cursor-grabbing"
            style={{ touchAction: 'none' }}
            aria-hidden
          >
            <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-faint)' }} />
          </div>
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <p className="text-sm font-bold text-on-surface">
              {t(getHelpTopicTitleKey(screenId, current.id) as never)}
            </p>
            <button onClick={onClose} className="btn-press p-0.5 -mt-0.5" aria-label={t('common.close')}>
              <Icon name="close" size={18} className="text-on-surface-faint" />
            </button>
          </div>
          <p className="text-xs text-on-surface-dim leading-relaxed">
            {t(getHelpTopicBodyKey(screenId, current.id) as never)}
          </p>
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="px-3 py-2 rounded-xl bg-surface-high text-on-surface-dim text-xs font-semibold btn-press disabled:opacity-30"
            >
              {t('help.prev')}
            </button>
            <span className="text-[11px] text-on-surface-faint tabular">
              {index + 1} / {topics.length}
            </span>
            {index < topics.length - 1 ? (
              <button
                onClick={() => setIndex((i) => Math.min(topics.length - 1, i + 1))}
                className="px-3 py-2 rounded-xl bg-primary text-on-surface text-xs font-semibold btn-press"
              >
                {t('help.next')}
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-3 py-2 rounded-xl bg-primary text-on-surface text-xs font-semibold btn-press"
              >
                {t('help.done')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** "?" header button — drop it next to the screen title. */
export function HelpButton({ screenId }: { screenId: HelpScreenId }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-press p-1 ml-auto"
        aria-label={t('help.open')}
      >
        <Icon name="help" size={22} className="text-on-surface-faint" />
      </button>
      {open && <HelpOverlay screenId={screenId} onClose={() => setOpen(false)} />}
    </>
  );
}
