import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';

interface SplitExplainerProps {
  className?: string;
}

/**
 * G9 (UX audit §4.15) — the single, shared "how splitting works" explainer.
 *
 * Splitting surfaces in four places (QuickAdd, Receipt, Shared, Wise) with
 * slightly different wording each time. This is the ONE source of that copy, so
 * the explanation reads identically everywhere it is shown. Collapsed by
 * default — it informs the first-timer without re-cluttering the split UI for
 * everyone else.
 */
export function SplitExplainer({ className = '' }: SplitExplainerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const steps = [
    t('split.how_step_who'),
    t('split.how_step_share'),
    t('split.how_step_settle'),
  ];

  return (
    <div className={`bg-surface-container rounded-xl ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 flex items-center gap-2.5 btn-press text-left"
        aria-expanded={open}
      >
        <Icon name="help" size={16} className="text-primary shrink-0" />
        <span className="flex-1 text-xs font-semibold text-on-surface">
          {t('split.how_title')}
        </span>
        <Icon
          name="expand_more"
          size={18}
          className="text-on-surface-faint shrink-0 transition-transform"
          style={open ? { transform: 'rotate(180deg)' } : undefined}
        />
      </button>
      {open && (
        <ol className="px-4 pb-3.5 flex flex-col gap-2">
          {steps.map((step, index) => (
            <li
              key={index}
              className="flex gap-2.5 text-[11px] text-on-surface-dim leading-snug"
            >
              <span className="shrink-0 w-4 h-4 rounded-full bg-primary/15 text-primary text-[9px] font-bold flex items-center justify-center mt-px">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
