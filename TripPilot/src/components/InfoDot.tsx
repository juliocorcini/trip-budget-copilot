import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Icon } from './Icon';
import { BottomSheet } from './BottomSheet';
import {
  glossaryTermKey,
  glossaryGlossKey,
  glossaryHelpRoute,
  type GlossaryTermId,
} from '@/domain/help';

/**
 * DEC-289 (M05): a tappable ⓘ that explains a money concept in one line and
 * deep-links to the full help article. Stops propagation so it can sit inside
 * other tappable rows/cards without firing the parent action. Renders as a real
 * button — place it in non-button containers only (sheet bodies, plain text),
 * never nested inside another <button>.
 */
export function InfoDot({ term, className = '' }: { term: GlossaryTermId; className?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const label = t(glossaryTermKey(term) as never);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={t('glossary.explain', { term: label })}
        className={`btn-press inline-flex items-center justify-center align-middle text-on-surface-faint ${className}`}
      >
        <Icon name="help" size={14} />
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={label}>
        <div className="px-1 pb-2">
          <p className="text-sm text-on-surface-dim leading-relaxed">
            {t(glossaryGlossKey(term) as never)}
          </p>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate(glossaryHelpRoute(term));
            }}
            className="mt-4 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-on-surface text-xs font-bold btn-press"
          >
            <Icon name="open_in_new" size={16} />
            {t('glossary.learn_more')}
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
