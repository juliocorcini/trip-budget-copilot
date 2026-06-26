import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';

type SplitMode = 'bill' | 'group';

interface ConceptHintProps {
  /**
   * The door this hint is mounted on. The matching mode is marked "você está
   * aqui" so the user instantly sees whether they picked the right one.
   */
  current?: SplitMode;
  className?: string;
}

/**
 * DEC-358 (G9) — the ONE reusable "Dividir conta vs Divisão em grupo" explainer.
 *
 * The two split modes are easy to confuse, so the difference is spelled out at
 * every door (the FAB chooser explains it inline; this collapsible "?" hint
 * covers `/split` and `/groups`). Collapsed by default — a single tap reveals
 * both definitions with concrete examples, identical copy everywhere.
 */
export function ConceptHint({ current, className = '' }: ConceptHintProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const modes: { mode: SplitMode; icon: string; titleKey: string; exKey: string }[] = [
    { mode: 'bill', icon: 'splitscreen', titleKey: 'conceptHint.bill_title', exKey: 'conceptHint.bill_ex' },
    { mode: 'group', icon: 'groups', titleKey: 'conceptHint.group_title', exKey: 'conceptHint.group_ex' },
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
        <span className="flex-1 text-xs font-semibold text-on-surface">{t('conceptHint.q')}</span>
        <Icon
          name="expand_more"
          size={18}
          className="text-on-surface-faint shrink-0 transition-transform"
          style={open ? { transform: 'rotate(180deg)' } : undefined}
        />
      </button>
      {open && (
        <div className="px-4 pb-3.5 flex flex-col gap-2.5">
          {modes.map(({ mode, icon, titleKey, exKey }) => (
            <div key={mode} className="flex gap-2.5">
              <span className="shrink-0 w-7 h-7 rounded-lg bg-surface-high flex items-center justify-center mt-px">
                <Icon name={icon} size={15} className="text-primary" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-on-surface flex items-center gap-1.5">
                  {t(titleKey)}
                  {current === mode && (
                    <span className="px-1.5 py-px rounded-full bg-primary/15 text-primary text-[9px] font-bold">
                      {t('conceptHint.here')}
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-on-surface-dim leading-snug mt-0.5">{t(exKey)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
