import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';

/**
 * FB-03 (DEC-265): transparent first-run notice. Location tagging now defaults
 * ON for new installs (amendment to ÂNCORA 8), so the very first home view says
 * so plainly — GPS is only read with OS permission and it is one tap to turn
 * off in Settings. Shown once; dismissing or opening Settings acknowledges it.
 */
export function LocationDefaultNoticeCard({
  onAcknowledge,
  onOpenSettings,
}: {
  onAcknowledge: () => void;
  onOpenSettings: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      className="mt-4 p-4 rounded-2xl flex items-start gap-3"
      style={{ background: 'var(--highlight-subtle)', border: '1px solid var(--border-faint)' }}
    >
      <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
        <Icon name="location_on" size={18} className="text-primary" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-bold text-on-surface">{t('dashboard.location_notice_title')}</p>
        <p className="text-xs text-on-surface-dim mt-1 leading-snug">
          {t('dashboard.location_notice_body')}
        </p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={onAcknowledge}
            className="px-3 py-2 rounded-xl bg-primary text-on-surface text-xs font-bold btn-press"
          >
            {t('dashboard.location_notice_ack')}
          </button>
          <button
            onClick={onOpenSettings}
            className="px-3 py-2 rounded-xl bg-surface-high text-on-surface-dim text-xs font-semibold btn-press"
          >
            {t('dashboard.location_notice_settings')}
          </button>
        </div>
      </div>
    </div>
  );
}
