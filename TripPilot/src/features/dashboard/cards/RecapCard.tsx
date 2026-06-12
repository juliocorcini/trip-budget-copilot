import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { formatMoney } from '@/domain/money';
import type { YesterdayRecap } from '@/domain/dashboard';

interface RecapCardProps {
  recap: YesterdayRecap;
  currency: string;
  onOpen: () => void;
}

/**
 * DEC-129: "Ontem" recap — closes the daily loop with yesterday's verdict
 * and the running on-plan streak. Factual tone, no badges (no gamification).
 */
export function RecapCard({ recap, currency, onOpen }: RecapCardProps) {
  const { t } = useTranslation();
  const tone = recap.within
    ? { color: 'var(--success)', bg: '#6B8F7112', border: '#6B8F7118', icon: 'check_circle' }
    : { color: 'var(--warning)', bg: '#D4A84312', border: '#D4A84318', icon: 'trending_up' };

  return (
    <button
      onClick={onOpen}
      className="mt-4 p-4 rounded-2xl w-full text-left btn-press"
      style={{ background: tone.bg, border: `1px solid ${tone.border}` }}
    >
      <div className="flex items-start gap-3">
        <Icon name={tone.icon} size={18} style={{ color: tone.color }} />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-on-surface-faint">
            {t('dashboard.recap_title')}
          </p>
          <p className="text-[13px] font-semibold leading-snug mt-1 text-on-surface">
            {t(recap.within ? 'dashboard.recap_within' : 'dashboard.recap_over', {
              spent: formatMoney(recap.spentCents, currency),
              delta: formatMoney(recap.deltaCents, currency),
            })}
          </p>
          {recap.within && recap.streakDays >= 2 && (
            <p className="text-xs font-bold mt-1.5" style={{ color: tone.color }}>
              {t('dashboard.recap_streak', { n: recap.streakDays })}
            </p>
          )}
        </div>
        <Icon name="chevron_right" size={14} className="text-on-surface-faint mt-1" />
      </div>
    </button>
  );
}
