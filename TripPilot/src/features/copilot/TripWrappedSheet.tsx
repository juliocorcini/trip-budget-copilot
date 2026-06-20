import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { showToast } from '@/components/Toast';
import { formatMoney } from '@/domain/money';
import { formatDate } from '@/domain/dates';
import { getCategoryIcon } from '@/utils/category-icons';
import { renderShareCard, deliverShareCard } from '@/utils/share-card';
import type { TripWrapped } from '@/domain/copilot';

interface TripWrappedSheetProps {
  wrapped: TripWrapped;
  tripName: string;
  currency: string;
  onClose: () => void;
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: string;
  label: string;
  value: string;
  hint?: ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-surface-container px-4 py-3.5 flex items-center gap-3">
      <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-primary-subtle">
        <Icon name={icon} size={20} className="text-primary" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-on-surface-dim">{label}</p>
        <p className="text-base font-bold text-on-surface truncate">{value}</p>
        {hint && <p className="text-[11px] text-on-surface-faint truncate">{hint}</p>}
      </div>
    </div>
  );
}

/**
 * Trip "Wrapped" sheet (DEC-247) — a celebratory end-of-trip retrospective built
 * from {@link TripWrapped}. Every stat is already data-gated in the domain, so
 * this only paints what exists. "Compartilhar" reuses the existing 1080×1350
 * share-card renderer (DEC-133); a bespoke Wrapped canvas is a future decision.
 */
export function TripWrappedSheet({ wrapped, tripName, currency, onClose }: TripWrappedSheetProps) {
  const { t } = useTranslation();
  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    setSharing(true);
    try {
      const topCategoryLine = wrapped.topCategory
        ? t('wrapped.share_top_category', {
            category: t(`categories.${wrapped.topCategory.category}` as never),
            percent: wrapped.topCategory.percent,
          })
        : null;
      const dayLine = wrapped.biggestDay
        ? t('wrapped.share_biggest_day', {
            amount: formatMoney(wrapped.biggestDay.cents, currency),
            date: formatDate(wrapped.biggestDay.dayIso, "d 'de' MMM"),
          })
        : t('wrapped.share_days', { days: wrapped.activeDays });
      const blob = await renderShareCard({
        tripName,
        spentDisplay: formatMoney(wrapped.totalCents, currency),
        subtitle: t('wrapped.hero_sub', {
          count: wrapped.expenseCount,
          days: wrapped.activeDays,
        }),
        dayLine,
        topCategoryLine,
        percentUsed: 100,
        dayPercent: 100,
      });
      if (!blob) {
        showToast(t('wrapped.share_failed'), 'danger');
        return;
      }
      const filename = `trippilot-${tripName}`.replace(/\s+/g, '-').toLowerCase() + '.png';
      const outcome = await deliverShareCard(blob, filename);
      if (outcome === 'failed') showToast(t('wrapped.share_failed'), 'danger');
    } catch {
      showToast(t('wrapped.share_failed'), 'danger');
    } finally {
      setSharing(false);
    }
  };

  return (
    <BottomSheet open onClose={onClose} title={t('wrapped.title')}>
      <div className="flex flex-col gap-3 pb-2">
        {/* Hero total */}
        <div className="rounded-2xl px-5 py-6 text-center bg-surface-container">
          {!wrapped.ended && (
            <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-primary mb-2">
              {t('wrapped.preview_badge')}
            </span>
          )}
          <p className="text-xs text-on-surface-dim">{t('wrapped.hero_label', { trip: tripName })}</p>
          <p className="text-4xl font-extrabold text-on-surface mt-1 tabular">
            {formatMoney(wrapped.totalCents, currency)}
          </p>
          <p className="text-xs text-on-surface-faint mt-1">
            {t('wrapped.hero_sub', { count: wrapped.expenseCount, days: wrapped.activeDays })}
          </p>
        </div>

        {wrapped.biggestDay && (
          <StatCard
            icon="local_fire_department"
            label={t('wrapped.biggest_day')}
            value={formatMoney(wrapped.biggestDay.cents, currency)}
            hint={formatDate(wrapped.biggestDay.dayIso, "EEEE, d 'de' MMM")}
          />
        )}
        {wrapped.topCategory && (
          <StatCard
            icon={getCategoryIcon(wrapped.topCategory.category)}
            label={t('wrapped.top_category')}
            value={t(`categories.${wrapped.topCategory.category}` as never)}
            hint={t('wrapped.top_category_hint', {
              percent: wrapped.topCategory.percent,
              amount: formatMoney(wrapped.topCategory.cents, currency),
            })}
          />
        )}
        {wrapped.social && wrapped.social.sharedCents > 0 && (
          <StatCard
            icon="group"
            label={t('wrapped.social')}
            value={t('wrapped.social_value', { percent: wrapped.social.sharedPercent })}
            hint={t('wrapped.social_hint', {
              shared: formatMoney(wrapped.social.sharedCents, currency),
            })}
          />
        )}
        {wrapped.peakHour && (
          <StatCard
            icon="schedule"
            label={t('wrapped.peak_hour')}
            value={t('wrapped.peak_hour_value', { hour: wrapped.peakHour.hour })}
            hint={t('wrapped.peak_hour_hint', { percent: wrapped.peakHour.sharePercent })}
          />
        )}
        {wrapped.streak && (
          <StatCard
            icon="bolt"
            label={t('wrapped.streak')}
            value={t('wrapped.streak_value', { days: wrapped.streak.longestStreak })}
          />
        )}

        <button
          onClick={handleShare}
          disabled={sharing}
          className="mt-2 w-full py-3.5 rounded-2xl bg-primary text-on-surface font-bold btn-press disabled:opacity-50 flex items-center justify-center gap-2"
          data-wrapped-share
        >
          <Icon name="share" size={18} />
          {sharing ? t('wrapped.sharing') : t('wrapped.share')}
        </button>
      </div>
    </BottomSheet>
  );
}
