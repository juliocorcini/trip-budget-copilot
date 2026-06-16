import type { Dispatch, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Icon } from '@/components/Icon';
import { BottomSheet } from '@/components/BottomSheet';
import { formatMoney } from '@/domain/money';
import { buildFreeToSpendBreakdown, type FtsBreakdownKey } from '@/domain/budget';
import type { PhaseAllowanceMap } from '@/domain/phases';
import { getDashboardCard, type DashboardCardId } from '@/domain/dashboard';
import type { DashboardInsight } from '@/domain/insights';
import type { PhaseLeftover } from '@/domain/phases';
import type { ValueSuggestion } from '@/domain/profiles';
import type { TripPriorsOffer } from '@/domain/templates';
import type { PhaseLeftoverDestination } from '@/domain/orchestrators';
import type { Trip } from '@/domain/types/trip';
import type { BudgetPool } from '@/domain/types/budget-pool';
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
  // DEC-168: "where this number comes from" — the hero's reconciling arithmetic
  heroBreakdownOpen: boolean;
  onCloseHeroBreakdown: () => void;
  // M9/M10: phase-leftover decision sheet (null = nothing to settle / simple mode)
  phaseLeftover: PhaseLeftover | null;
  leftoverTargets: BudgetPool[];
  onPhaseLeftover: (destination: PhaseLeftoverDestination, targetPoolId: string | null) => void;
  // M19: in-trip value suggestion (null = nothing diverges / simple mode)
  valueSuggestion: ValueSuggestion | null;
  onValueSuggestion: (accept: boolean) => void;
  // M21: end-of-trip "save priors" offer (null = trip still running / simple mode)
  tripPriors: TripPriorsOffer | null;
  onTripPriors: (accept: boolean) => void;
}

// DEC-168: each subtractable term of the free-to-spend formula maps to a label.
// `free` (total) and `deficit` (overflow note) are rendered with bespoke styling.
const FTS_LABEL_KEYS: Record<Exclude<FtsBreakdownKey, 'free' | 'deficit'>, string> = {
  budget: 'dashboard.fts_budget',
  spent: 'dashboard.fts_spent',
  protected: 'dashboard.fts_protected',
  future_floor: 'dashboard.fts_future_floor',
  event_reserves: 'dashboard.fts_event_reserves',
  planned_purchases: 'dashboard.fts_planned_purchases',
  plan: 'dashboard.fts_plan',
};

// FIELD-19: the per-day allowance "map" inside the hero breakdown sheet. Each
// row is a remaining day of the phase: a proportional bar (peak days are taller)
// and the money free that day, with any dated reserves listed beneath it. Today
// is highlighted so "free today" reads as one point on the distribution.
function PhaseDayMapSection({ map, currency }: { map: PhaseAllowanceMap; currency: string }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language || 'pt-BR';
  const formatDayParts = (iso: string) => {
    const date = new Date(`${iso.slice(0, 10)}T12:00:00`);
    return {
      weekday: date.toLocaleDateString(lang, { weekday: 'short' }).replace('.', ''),
      day: date.toLocaleDateString(lang, { day: '2-digit', month: 'short' }).replace('.', ''),
    };
  };

  return (
    <div className="mt-5 pt-4 border-t border-[var(--border-faint)]">
      <p className="text-sm font-bold text-on-surface">{t('dashboard.day_map_title')}</p>
      <p className="text-xs text-on-surface-dim mt-0.5 mb-3">{t('dashboard.day_map_intro')}</p>

      <div className="flex flex-col gap-2">
        {map.days.map((d) => {
          const barPct = Math.max(4, Math.round((d.allowanceCents / map.maxAllowanceCents) * 100));
          const barColor = d.isToday
            ? 'var(--primary)'
            : d.isPeakDay
              ? 'var(--warning)'
              : 'var(--success)';
          const parts = formatDayParts(d.dateIso);
          return (
            <div key={d.dateIso} className="flex flex-col gap-1">
              <div className="flex items-center gap-2.5">
                <div className="w-14 flex-shrink-0">
                  <p
                    className={`text-[11px] font-bold uppercase leading-tight ${
                      d.isToday
                        ? 'text-primary'
                        : d.isPeakDay
                          ? 'text-warning'
                          : 'text-on-surface-dim'
                    }`}
                  >
                    {d.isToday ? t('dashboard.day_map_today') : parts.weekday}
                  </p>
                  <p className="text-[10px] text-on-surface-faint leading-tight">{parts.day}</p>
                </div>
                <div
                  className="flex-1 h-2.5 rounded-full overflow-hidden"
                  style={{ background: 'var(--surface-container-high)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${barPct}%`, background: barColor, opacity: d.isToday ? 1 : 0.85 }}
                  />
                </div>
                <span
                  className={`w-16 text-right text-xs font-bold tabular flex-shrink-0 ${
                    d.freeCents < 0 ? 'text-error' : 'text-on-surface'
                  }`}
                >
                  {formatMoney(d.freeCents, currency)}
                </span>
              </div>
              {d.planItems.length > 0 && (
                <div className="ml-[4.1rem] flex flex-wrap gap-1">
                  {d.planItems.map((item) => (
                    <span
                      key={item.id}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
                      style={{ background: 'var(--surface-container-high)', color: 'var(--primary-dim)' }}
                    >
                      <Icon name={item.kind === 'occurrence' ? 'event' : 'shopping_bag'} size={11} />
                      {item.name} · {formatMoney(item.amountCents, currency)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {map.undatedPlanItems.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[var(--border-faint)]">
          <p className="text-[11px] font-semibold text-on-surface-dim mb-1.5">
            {t('dashboard.day_map_undated', {
              amount: formatMoney(map.undatedPlanTotalCents, currency),
            })}
          </p>
          <div className="flex flex-wrap gap-1">
            {map.undatedPlanItems.map((item) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
                style={{ background: 'var(--surface-container-high)', color: 'var(--primary-dim)' }}
              >
                <Icon name="shopping_bag" size={11} />
                {item.name} · {formatMoney(item.amountCents, currency)}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-on-surface-faint mt-3 leading-snug">
        {t('dashboard.day_map_legend')}
      </p>
    </div>
  );
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
  heroBreakdownOpen,
  onCloseHeroBreakdown,
  phaseLeftover,
  leftoverTargets,
  onPhaseLeftover,
  valueSuggestion,
  onValueSuggestion,
  tripPriors,
  onTripPriors,
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

      {/* DEC-168: "where this number comes from" — the hero is the app's #1
          figure, so make its arithmetic visible: budget − spent − reserves = free.
          The lines reconcile to the hero number; an over-budget deficit is shown
          rather than hidden behind the clamped-at-zero total. */}
      <BottomSheet
        open={heroBreakdownOpen}
        onClose={onCloseHeroBreakdown}
        title={t('dashboard.hero_breakdown_title')}
      >
        {model.fts && (
          <div className="flex flex-col gap-1">
            <p className="text-xs text-on-surface-dim mb-2">{t('dashboard.hero_breakdown_intro')}</p>
            {buildFreeToSpendBreakdown(model.fts, model.trueFree?.planReservedCents ?? 0).map((line) => {
              if (line.kind === 'total') {
                return (
                  <div
                    key={line.key}
                    className="flex items-baseline justify-between pt-3 mt-1 border-t border-[var(--border-faint)]"
                  >
                    <span className="text-sm font-bold text-on-surface">{t('dashboard.fts_free')}</span>
                    <span className="text-base font-extrabold tabular text-success">
                      {formatMoney(line.cents, trip.baseCurrency)}
                    </span>
                  </div>
                );
              }
              if (line.kind === 'deficit') {
                return (
                  <p key={line.key} className="text-[11px] font-semibold text-warning mt-2">
                    {t('dashboard.fts_deficit', {
                      amount: formatMoney(line.cents, trip.baseCurrency),
                    })}
                  </p>
                );
              }
              const isSubtract = line.kind === 'subtract';
              return (
                <div key={line.key} className="flex items-baseline justify-between py-1">
                  <span className="text-sm font-semibold text-on-surface-dim">
                    {t(FTS_LABEL_KEYS[line.key as Exclude<FtsBreakdownKey, 'free' | 'deficit'>] as never)}
                  </span>
                  <span
                    className={`text-sm font-bold tabular ${
                      isSubtract ? 'text-on-surface-faint' : 'text-on-surface'
                    }`}
                  >
                    {isSubtract ? '− ' : ''}
                    {formatMoney(line.cents, trip.baseCurrency)}
                  </span>
                </div>
              );
            })}
            {/* FIELD-19: the per-day allowance map — "where the daily number sits
                across the rest of the phase" (weekday low, weekend peaks high). */}
            {model.phaseDayMap && model.phaseDayMap.days.length > 0 && (
              <PhaseDayMapSection map={model.phaseDayMap} currency={trip.baseCurrency} />
            )}
          </div>
        )}
      </BottomSheet>

      {/* M9/M10 (E5): a phase ended with money left — propose, never force.
          Closing (dismiss) carries the leftover into the next phase and marks
          the cycle handled so it never reopens. */}
      <BottomSheet
        open={phaseLeftover !== null}
        onClose={() => onPhaseLeftover('carry_next', null)}
        title={t('dashboard.leftover_title')}
      >
        {phaseLeftover && (
          <div className="flex flex-col gap-4">
            <div className="text-center">
              <p className="text-4xl font-extrabold tabular text-success">
                {formatMoney(phaseLeftover.leftoverCents, trip.baseCurrency)}
              </p>
              <p className="mt-2 text-sm text-on-surface-dim">
                {t('dashboard.leftover_body', { phase: phaseLeftover.endedPhaseName })}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => onPhaseLeftover('carry_next', null)}
                className="w-full px-4 py-3 rounded-xl bg-surface-high text-left btn-press flex items-center gap-3"
              >
                <Icon name="arrow_forward" size={18} className="text-primary" />
                <span className="text-sm font-semibold text-on-surface">
                  {t('dashboard.leftover_carry', { phase: phaseLeftover.nextPhaseName })}
                </span>
              </button>
              <button
                onClick={() => onPhaseLeftover('reserve', null)}
                className="w-full px-4 py-3 rounded-xl bg-surface-high text-left btn-press flex items-center gap-3"
              >
                <Icon name="savings" size={18} className="text-on-surface-dim" />
                <span className="text-sm font-semibold text-on-surface">
                  {t('dashboard.leftover_reserve')}
                </span>
              </button>
              {leftoverTargets.map((pool) => (
                <button
                  key={pool.id}
                  onClick={() => onPhaseLeftover('shopping', pool.id)}
                  className="w-full px-4 py-3 rounded-xl bg-surface-high text-left btn-press flex items-center gap-3"
                >
                  <Icon name="shopping_bag" size={18} className="text-on-surface-dim" />
                  <span className="text-sm font-semibold text-on-surface">
                    {t('dashboard.leftover_shopping', { pool: pool.name })}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </BottomSheet>

      {/* M19 (E7): the app noticed a profile's real cost drifted from its typical
          and PROPOSES an update — never changes it silently. Closing = keep, so
          the suggestion never nags again this trip. */}
      <BottomSheet
        open={valueSuggestion !== null}
        onClose={() => onValueSuggestion(false)}
        title={t('dashboard.value_suggestion_title')}
      >
        {valueSuggestion && (
          <div className="flex flex-col gap-4">
            <div className="text-center">
              <p className="text-4xl font-extrabold tabular text-primary">
                {formatMoney(valueSuggestion.suggestedTypicalCents, trip.baseCurrency)}
              </p>
              <p className="mt-2 text-sm text-on-surface-dim">
                {t('dashboard.value_suggestion_body', {
                  profile: valueSuggestion.profileName.toLowerCase(),
                  average: formatMoney(valueSuggestion.suggestedTypicalCents, trip.baseCurrency),
                  typical: formatMoney(valueSuggestion.currentTypicalCents, trip.baseCurrency),
                })}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => onValueSuggestion(true)}
                className="w-full px-4 py-3 rounded-xl bg-primary text-on-surface text-center btn-press flex items-center justify-center gap-2"
              >
                <Icon name="auto_awesome" size={18} className="text-on-surface" />
                <span className="text-sm font-bold">
                  {t('dashboard.value_suggestion_update', {
                    amount: formatMoney(valueSuggestion.suggestedTypicalCents, trip.baseCurrency),
                  })}
                </span>
              </button>
              <button
                onClick={() => onValueSuggestion(false)}
                className="w-full px-4 py-3 rounded-xl bg-surface-high text-center btn-press"
              >
                <span className="text-sm font-semibold text-on-surface-dim">
                  {t('dashboard.value_suggestion_keep', {
                    amount: formatMoney(valueSuggestion.currentTypicalCents, trip.baseCurrency),
                  })}
                </span>
              </button>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* M21 (E7): the trip is over — offer to save what it learned as priors for
          the next trip. Saving is explicit; "not now" just closes and never asks
          again for this trip. */}
      <BottomSheet
        open={tripPriors !== null}
        onClose={() => onTripPriors(false)}
        title={t('dashboard.priors_title')}
      >
        {tripPriors && (
          <div className="flex flex-col gap-4">
            <div className="text-center">
              <Icon name="auto_awesome" size={32} className="text-primary mx-auto" />
              <p className="mt-2 text-sm text-on-surface-dim">
                {t('dashboard.priors_body', {
                  trip: tripPriors.tripName,
                  count: tripPriors.profileCount,
                })}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => onTripPriors(true)}
                className="w-full px-4 py-3 rounded-xl bg-primary text-on-surface text-center btn-press flex items-center justify-center gap-2"
              >
                <Icon name="bookmark_add" size={18} className="text-on-surface" />
                <span className="text-sm font-bold">{t('dashboard.priors_save')}</span>
              </button>
              <button
                onClick={() => onTripPriors(false)}
                className="w-full px-4 py-3 rounded-xl bg-surface-high text-center btn-press"
              >
                <span className="text-sm font-semibold text-on-surface-dim">
                  {t('dashboard.priors_dismiss')}
                </span>
              </button>
            </div>
          </div>
        )}
      </BottomSheet>
    </>
  );
}
