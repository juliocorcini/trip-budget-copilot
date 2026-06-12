import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { formatMoney } from '@/domain/money';
import type { PhaseBurndown } from '@/domain/dashboard';

interface BurndownCardProps {
  burndown: PhaseBurndown;
  currency: string;
  onOpen: () => void;
}

const VIEW_W = 300;
const VIEW_H = 96;
const PAD_X = 4;
const PAD_Y = 6;

/**
 * DEC-130: phase burn-down — real cumulative spending (solid) against the
 * rhythm-weighted ideal pace (dashed). Pure SVG, no chart library.
 */
export function BurndownCard({ burndown, currency, onOpen }: BurndownCardProps) {
  const { t } = useTranslation();
  const { points, budgetCents, todayIndex } = burndown;

  const maxCents = Math.max(
    budgetCents,
    ...points.map((p) => p.actualCents ?? 0),
  );
  const stepX = (VIEW_W - PAD_X * 2) / Math.max(1, points.length - 1);
  const toX = (i: number) => PAD_X + i * stepX;
  const toY = (cents: number) =>
    VIEW_H - PAD_Y - (cents / maxCents) * (VIEW_H - PAD_Y * 2);

  const idealPath = points.map((p, i) => `${toX(i)},${toY(p.idealCents)}`).join(' ');
  const actualPoints = points.filter((p) => p.actualCents !== null);
  const actualPath = actualPoints
    .map((p, i) => `${toX(i)},${toY(p.actualCents!)}`)
    .join(' ');
  const todayPoint = points[todayIndex];

  const paceColor = burndown.abovePace ? 'var(--warning)' : 'var(--success)';

  return (
    <button
      onClick={onOpen}
      className="mt-4 p-4 rounded-2xl w-full text-left btn-press bg-surface-container"
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-on-surface-faint">
          {t('dashboard.burndown_title')}
        </p>
        <Icon name="monitoring" size={14} className="text-on-surface-faint" />
      </div>

      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="w-full mt-2"
        style={{ height: 88 }}
        aria-hidden="true"
      >
        <polyline
          points={idealPath}
          fill="none"
          stroke="var(--on-surface-mute)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        {actualPoints.length >= 2 && (
          <polyline
            points={actualPath}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {todayPoint && todayPoint.actualCents !== null && (
          <circle
            cx={toX(todayIndex)}
            cy={toY(todayPoint.actualCents)}
            r="3.5"
            fill="var(--primary)"
          />
        )}
      </svg>

      <div className="flex items-center justify-between mt-2">
        <p className="text-xs font-semibold text-on-surface-dim">
          {t('dashboard.burndown_spent', {
            spent: formatMoney(burndown.spentToDateCents, currency),
            ideal: formatMoney(burndown.idealToDateCents, currency),
          })}
        </p>
        <p className="text-xs font-bold" style={{ color: paceColor }}>
          {t(burndown.abovePace ? 'dashboard.burndown_above' : 'dashboard.burndown_below', {
            delta: formatMoney(Math.abs(burndown.deltaCents), currency),
          })}
        </p>
      </div>
    </button>
  );
}
