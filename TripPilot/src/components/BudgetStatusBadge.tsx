import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';

type BudgetStatus = 'on_track' | 'attention' | 'over';

interface BudgetStatusBadgeProps {
  spentCents: number;
  budgetCents: number | null;
  className?: string;
}

function getStatus(spentCents: number, budgetCents: number | null): BudgetStatus {
  if (budgetCents === null || budgetCents <= 0) return 'on_track';
  const pct = (spentCents / budgetCents) * 100;
  if (pct > 100) return 'over';
  if (pct >= 80) return 'attention';
  return 'on_track';
}

const STATUS_STYLES: Record<BudgetStatus, { bg: string; text: string; icon: string }> = {
  on_track: {
    bg: 'color-mix(in srgb, var(--success) 15%, transparent)',
    text: 'var(--success)',
    icon: 'check_circle',
  },
  attention: {
    bg: 'color-mix(in srgb, var(--warning) 15%, transparent)',
    text: 'var(--warning)',
    icon: 'warning',
  },
  over: {
    bg: 'color-mix(in srgb, var(--error) 15%, transparent)',
    text: 'var(--error)',
    icon: 'error',
  },
};

export function BudgetStatusBadge({ spentCents, budgetCents, className = '' }: BudgetStatusBadgeProps) {
  const { t } = useTranslation();
  const status = getStatus(spentCents, budgetCents);
  const style = STATUS_STYLES[status];

  const labelMap: Record<BudgetStatus, string> = {
    on_track: t('itinerary.budget_on_track', { defaultValue: 'On Track' }),
    attention: t('itinerary.budget_attention', { defaultValue: 'Attention' }),
    over: t('itinerary.budget_over', { defaultValue: 'Over Budget' }),
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${className}`}
      style={{
        background: style.bg,
        color: style.text,
      }}
    >
      <Icon name={style.icon} size={14} style={{ color: style.text }} />
      {labelMap[status]}
    </span>
  );
}
