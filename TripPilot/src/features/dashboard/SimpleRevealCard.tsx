import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';

/**
 * E1 (M22): discreet, dismissible offer to unlock complete mode after the
 * user has logged enough expenses in simple mode. Shown once.
 */
export function SimpleRevealCard({
  onAccept,
  onDismiss,
}: {
  onAccept: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      className="mt-4 p-4 rounded-2xl flex items-start gap-3"
      style={{ background: 'var(--highlight-subtle)', border: '1px solid var(--border-faint)' }}
    >
      <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
        <Icon name="auto_awesome" size={18} className="text-primary" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-bold text-on-surface">{t('reveal.title')}</p>
        <p className="text-xs text-on-surface-dim mt-1">{t('reveal.body')}</p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={onAccept}
            className="px-3 py-2 rounded-xl bg-primary text-on-surface text-xs font-bold btn-press"
          >
            {t('reveal.accept')}
          </button>
          <button
            onClick={onDismiss}
            className="px-3 py-2 rounded-xl bg-surface-high text-on-surface-dim text-xs font-semibold btn-press"
          >
            {t('reveal.dismiss')}
          </button>
        </div>
      </div>
    </div>
  );
}
