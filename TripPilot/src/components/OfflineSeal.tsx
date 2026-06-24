import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';

/**
 * M24 — a discreet "works offline" seal. TripPilot's resilience (cached rates,
 * 0-token tools, graceful AI degradation) is a brand trait that was invisible;
 * this surfaces it only where it's truthfully always offline-capable.
 */
export function OfflineSeal({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-semibold text-on-surface-faint ${className}`}
    >
      <Icon name="cloud_off" size={12} className="shrink-0" />
      {t('common.works_offline')}
    </span>
  );
}
