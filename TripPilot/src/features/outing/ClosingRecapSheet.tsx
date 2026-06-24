import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { BottomSheet } from '@/components/BottomSheet';
import { formatMoney } from '@/domain/money';
import { formatRecapDuration, recapHeadlineKey, type OutingRecap } from '@/domain/outing';

/**
 * M17-lite (DEC-292) — the "end that makes you proud", light version. A warm
 * peak-end moment shown right after an outing closes: a headline tuned to the
 * outcome, the final total, and the same recap chips the review screen uses
 * (duration · rounds · vs-target). No new heavy screen — it links into the
 * existing read-only OutingReviewPage for the full breakdown.
 */
export function ClosingRecapSheet({
  open,
  recap,
  sessionName,
  currency,
  onClose,
  onSeeSummary,
}: {
  open: boolean;
  recap: OutingRecap;
  sessionName: string;
  currency: string;
  onClose: () => void;
  onSeeSummary: () => void;
}) {
  const { t } = useTranslation();
  const showVsTarget = recap.outcome !== 'no_target';
  const underOrEven = recap.vsTargetCents >= 0;

  return (
    <BottomSheet open={open} onClose={onClose} title={t('outing.recap_sheet_title')}>
      <div className="px-1 pb-2 text-center">
        <p className="text-sm font-semibold text-on-surface">
          {t(recapHeadlineKey(recap.outcome) as never)}
        </p>

        <p className="text-display font-extrabold tabular text-on-surface mt-3">
          {formatMoney(recap.totalCents, currency)}
        </p>
        <p className="text-xs text-on-surface-faint mt-1">{sessionName}</p>

        <div className="flex items-center justify-center gap-2 mt-3 flex-wrap text-[11px] font-semibold text-on-surface-dim">
          <span className="inline-flex items-center gap-1">
            <Icon name="schedule" size={13} className="text-on-surface-faint" />
            {formatRecapDuration(recap.durationMin)}
          </span>
          <span className="text-on-surface-faint">·</span>
          <span className="inline-flex items-center gap-1">
            <Icon name="local_bar" size={13} className="text-on-surface-faint" />
            {t('outing.recap_rounds', { count: recap.itemCount })}
          </span>
          {showVsTarget && (
            <>
              <span className="text-on-surface-faint">·</span>
              <span
                className="inline-flex items-center gap-1"
                style={{ color: underOrEven ? 'var(--success)' : 'var(--warning)' }}
              >
                <Icon name={underOrEven ? 'check_circle' : 'warning'} size={13} />
                {recap.vsTargetCents === 0
                  ? t('outing.recap_on_target')
                  : t(
                      recap.vsTargetCents > 0
                        ? 'outing.recap_under_target'
                        : 'outing.recap_over_target',
                      { amount: formatMoney(Math.abs(recap.vsTargetCents), currency) },
                    )}
              </span>
            </>
          )}
        </div>

        <button
          onClick={onSeeSummary}
          className="mt-5 w-full px-4 py-3 rounded-xl bg-surface-container text-on-surface text-sm font-semibold btn-press flex items-center justify-center gap-2"
        >
          <Icon name="receipt_long" size={18} className="text-primary" />
          {t('outing.recap_see_summary')}
        </button>
        <button
          onClick={onClose}
          className="mt-2 w-full px-4 py-3 rounded-xl bg-primary text-on-surface text-sm font-bold btn-press"
        >
          {t('outing.recap_done')}
        </button>
      </div>
    </BottomSheet>
  );
}
