import { useState, useEffect, useCallback } from 'react';
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
 */

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function HelpOverlay({ screenId, onClose }: { screenId: HelpScreenId; onClose: () => void }) {
  const { t } = useTranslation();
  const topics = getHelpTopics(screenId);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<HighlightRect | null>(null);

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

  return (
    <div className="fixed inset-0 z-[70]">
      {/* Dimmer — tapping it closes the help mode. When an element is
          highlighted, the ring's spread shadow paints the dim instead
          (it leaves a "hole" over the real element). */}
      <div className={`absolute inset-0 ${rect ? '' : 'bg-black/70'}`} onClick={onClose} />

      {/* Highlight ring over the real element */}
      {rect && (
        <div
          className="absolute rounded-xl pointer-events-none transition-all duration-300"
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

      {/* Explanation card */}
      <div className="absolute bottom-0 left-0 right-0 max-w-[430px] mx-auto p-4 pb-6">
        <div className="bg-surface-container rounded-2xl p-4 shadow-2xl" style={{ border: '1px solid var(--surface-container-high)' }}>
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
    </div>
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
