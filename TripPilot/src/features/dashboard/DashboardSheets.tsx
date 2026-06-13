import type { Dispatch, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Icon } from '@/components/Icon';
import { BottomSheet } from '@/components/BottomSheet';
import { formatMoney, sumCents } from '@/domain/money';
import { formatDate } from '@/domain/dates';
import { getCategoryIcon } from '@/utils/category-icons';
import { getDashboardCard, type DashboardCardId } from '@/domain/dashboard';
import type { DashboardInsight } from '@/domain/insights';
import type { Trip } from '@/domain/types/trip';
import { InsightDetail } from './InsightDetail';
import type { DashboardModel } from './useDashboardModel';

interface DashboardSheetsProps {
  model: DashboardModel;
  trip: Trip;
  confirmSheetOpen: boolean;
  onCloseConfirm: () => void;
  shareDrafts: Record<string, string>;
  setShareDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  onResolveShare: (shareId: string, status: 'confirmed' | 'rejected') => void;
  detailInsight: DashboardInsight | null;
  onCloseDetail: () => void;
  configCardId: DashboardCardId | null;
  onCloseConfig: () => void;
  onHideCard: (id: DashboardCardId) => void;
  heatmapDayIso: string | null;
  onCloseHeatmapDay: () => void;
}

// BUG-008: the Dashboard's four bottom sheets, lifted out of the page. They read
// the shared DashboardModel and report intent back through callbacks.
export function DashboardSheets({
  model,
  trip,
  confirmSheetOpen,
  onCloseConfirm,
  shareDrafts,
  setShareDrafts,
  onResolveShare,
  detailInsight,
  onCloseDetail,
  configCardId,
  onCloseConfig,
  onHideCard,
  heatmapDayIso,
  onCloseHeatmapDay,
}: DashboardSheetsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const configCard = configCardId !== null ? getDashboardCard(configCardId) : null;

  return (
    <>
      {/* Confirmation sheet: confirm / reject / adjust value per share */}
      <BottomSheet open={confirmSheetOpen} onClose={onCloseConfirm} title={t('shared.confirm_sheet_title')}>
        <div className="flex flex-col gap-3">
          {model.pendingShares.length === 0 && (
            <p className="text-sm text-on-surface-dim text-center py-4">{t('shared.confirm_all_done')}</p>
          )}
          {model.pendingShares.map(({ share, transaction }) => {
            const draft = shareDrafts[share.id] ?? (share.shareAmountCents / 100).toFixed(2);
            return (
              <div key={share.id} className="bg-surface-high rounded-xl p-3.5 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-on-surface truncate">{transaction.description}</p>
                    <p className="text-xs text-on-surface-faint mt-0.5">
                      {t('shared.confirm_share_of', {
                        name: model.participantNameById.get(share.participantId) ?? '—',
                        total: formatMoney(transaction.amountCents, transaction.currency),
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-baseline gap-1 bg-surface-container rounded-lg px-3 py-2 flex-1">
                    <span className="text-on-surface-faint text-xs">{transaction.currency}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={draft}
                      onChange={(e) => setShareDrafts((prev) => ({ ...prev, [share.id]: e.target.value }))}
                      className="bg-transparent text-sm text-on-surface tabular outline-none w-full"
                      aria-label={t('shared.adjust_value')}
                    />
                  </div>
                  <button
                    onClick={() => onResolveShare(share.id, 'rejected')}
                    className="px-3 py-2 rounded-lg text-xs font-bold btn-press bg-error/15 text-error"
                  >
                    {t('shared.reject')}
                  </button>
                  <button
                    onClick={() => onResolveShare(share.id, 'confirmed')}
                    className="px-3 py-2 rounded-lg text-xs font-bold btn-press bg-success/20 text-success"
                  >
                    {t('shared.confirm')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </BottomSheet>

      {/* DEC-091 (R-09): "how we got here" — open calculation of the insight */}
      <BottomSheet open={detailInsight !== null} onClose={onCloseDetail} title={t('dashboard.insight_detail_title')}>
        {detailInsight && <InsightDetail insight={detailInsight} currency={trip.baseCurrency} />}
      </BottomSheet>

      {/* DEC-119 (R-10): long-press card options — hide + contextual quick action */}
      <BottomSheet
        open={configCardId !== null}
        onClose={onCloseConfig}
        title={configCard ? t(configCard.labelKey as never) : ''}
      >
        {configCard && (
          <div className="flex flex-col gap-2">
            {configCard.quickAction && (
              <button
                onClick={() => {
                  onCloseConfig();
                  navigate(configCard.quickAction!.route);
                }}
                className="w-full px-4 py-3 rounded-xl bg-surface-high text-left btn-press flex items-center gap-3"
              >
                <Icon name={configCard.quickAction.icon} size={18} className="text-primary" />
                <span className="text-sm font-semibold text-on-surface">
                  {t(configCard.quickAction.labelKey as never)}
                </span>
              </button>
            )}
            <button
              onClick={() => onHideCard(configCard.id)}
              className="w-full px-4 py-3 rounded-xl bg-surface-high text-left btn-press flex items-center gap-3"
            >
              <Icon name="visibility_off" size={18} className="text-on-surface-dim" />
              <span className="text-sm font-semibold text-on-surface">{t('dashboard.hide_card')}</span>
            </button>
            <button
              onClick={() => {
                onCloseConfig();
                navigate('/settings/dashboard');
              }}
              className="w-full px-4 py-3 rounded-xl bg-surface-high text-left btn-press flex items-center gap-3"
            >
              <Icon name="tune" size={18} className="text-on-surface-dim" />
              <span className="text-sm font-semibold text-on-surface">{t('dashboard.configure_home')}</span>
            </button>
          </div>
        )}
      </BottomSheet>

      {/* DEC-131: heatmap day drill-down — the expenses of the tapped day */}
      <BottomSheet
        open={heatmapDayIso !== null}
        onClose={onCloseHeatmapDay}
        title={heatmapDayIso ? formatDate(heatmapDayIso, "d 'de' MMMM") : ''}
      >
        <div className="flex flex-col gap-2">
          {model.heatmapDayTxs.map((tx) => (
            <button
              key={tx.id}
              onClick={() => {
                onCloseHeatmapDay();
                navigate(`/expenses/${tx.id}`);
              }}
              className="w-full p-3 rounded-xl bg-surface-high flex items-center gap-3 text-left btn-press"
            >
              <Icon name={getCategoryIcon(tx.category)} size={18} className="text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-on-surface truncate">{tx.description}</p>
                <p className="text-xs text-on-surface-faint mt-0.5">
                  {tx.category ? t(`categories.${tx.category}` as never) : '—'}
                </p>
              </div>
              <p className="text-sm font-extrabold tabular text-on-surface">
                {formatMoney(tx.personalCostCents ?? tx.amountCents, trip.baseCurrency)}
              </p>
            </button>
          ))}
          <div className="flex justify-between items-center px-1 pt-2">
            <p className="text-xs font-bold uppercase text-on-surface-faint">{t('common.total')}</p>
            <p className="text-sm font-extrabold tabular text-on-surface">
              {formatMoney(
                sumCents(model.heatmapDayTxs.map((tx) => tx.personalCostCents ?? tx.amountCents)),
                trip.baseCurrency,
              )}
            </p>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
