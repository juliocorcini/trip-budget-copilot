import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Icon } from '@/components/Icon';
import { BottomSheet } from '@/components/BottomSheet';
import { InfoDot } from '@/components/InfoDot';
import { formatMoney, fromCents, toCents } from '@/domain/money';
import { buildFreeToSpendBreakdown, type FtsBreakdownKey } from '@/domain/budget';
import type { PendingEventLeftover } from '@/domain/budget';
import type { GlossaryTermId } from '@/domain/help';
import {
  getDashboardCard,
  isDashboardCardPairable,
  isDashboardCardPaired,
  isDashboardCardContextual,
  isDashboardCardPinned,
  type DashboardCardId,
} from '@/domain/dashboard';
import type { DashboardInsight } from '@/domain/insights';
import type { PhaseLeftover } from '@/domain/phases';
import type { ValueSuggestion } from '@/domain/profiles';
import type { TripPriorsOffer } from '@/domain/templates';
import type { PhaseLeftoverDestination, EventLeftoverDestination } from '@/domain/orchestrators';
import type { Trip } from '@/domain/types/trip';
import type { BudgetPool } from '@/domain/types/budget-pool';
import { InsightDetail } from './InsightDetail';
import { PhaseSpendLensBlock } from './PhaseSpendLensBlock';
import { PhaseMapTabs } from './PhaseMapTabs';
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
  // FIELD item 16: opt a compact card in/out of the 2-up grid (share a row)
  onTogglePairCard: (id: DashboardCardId) => void;
  pairedCards: string[];
  // FIELD R2 item 5 (F5): pin a contextual card (piggy bank) to the home flow
  onTogglePinCard: (id: DashboardCardId) => void;
  pinnedCards: string[];
  // DEC-168: "where this number comes from" — the hero's reconciling arithmetic
  heroBreakdownOpen: boolean;
  onCloseHeroBreakdown: () => void;
  // FIELD item 5: savings goal edited from its home card (read-only motivation)
  savingsGoalOpen: boolean;
  savingsGoalCents: number | null;
  onCloseSavingsGoal: () => void;
  onSaveSavingsGoal: (cents: number | null) => void;
  // M9/M10: phase-leftover decision sheet (null = nothing to settle / simple mode)
  phaseLeftover: PhaseLeftover | null;
  leftoverTargets: BudgetPool[];
  onPhaseLeftover: (destination: PhaseLeftoverDestination, targetPoolId: string | null) => void;
  // DEC-387 (G4): ended-event leftover decision sheet (null = nothing pending)
  eventLeftover: PendingEventLeftover | null;
  onEventLeftover: (destination: EventLeftoverDestination) => void;
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
  income: 'dashboard.fts_income',
  spent: 'dashboard.fts_spent',
  protected: 'dashboard.fts_protected',
  future_floor: 'dashboard.fts_future_floor',
  event_reserves: 'dashboard.fts_event_reserves',
  planned_purchases: 'dashboard.fts_planned_purchases',
  plan: 'dashboard.fts_plan',
};

// DEC-289 (M05): the breakdown is where these money terms first get a number —
// attach the glossary ⓘ to the ones that read as jargon.
const FTS_GLOSSARY_TERMS: Partial<Record<FtsBreakdownKey, GlossaryTermId>> = {
  protected: 'protected_reserve',
  plan: 'plan_reserve',
};

// FIELD item 5: edit the savings goal from its home card. Read-only motivation
// (ÂNCORA 11) — it never affects the budget; this only sets/clears the target.
function SavingsGoalSheet({
  open,
  currentCents,
  currency,
  onClose,
  onSave,
}: {
  open: boolean;
  currentCents: number | null;
  currency: string;
  onClose: () => void;
  onSave: (cents: number | null) => void;
}) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');

  useEffect(() => {
    if (open) setInput(currentCents != null ? String(fromCents(currentCents)) : '');
  }, [open, currentCents]);

  const save = () => {
    const cents = toCents(parseFloat(input.replace(',', '.')));
    if (Number.isFinite(cents) && cents > 0) onSave(cents);
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={t('dashboard.goal_edit')}>
      <div className="flex flex-col gap-3">
        <p className="text-xs text-on-surface-dim">{t('settings.goal_hint')}</p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="200"
            aria-label={t('dashboard.goal_edit')}
            className="bg-surface-high text-on-surface text-base rounded-lg px-3 py-2.5 outline-none flex-1 min-w-0"
          />
          <span className="text-xs font-semibold text-on-surface-dim">{currency}</span>
        </div>
        <button
          onClick={save}
          className="w-full py-3 rounded-xl bg-primary text-on-surface text-sm font-semibold btn-press"
        >
          {t('common.save')}
        </button>
        {currentCents != null && (
          <button
            onClick={() => onSave(null)}
            className="w-full py-2 text-xs text-on-surface-faint btn-press"
          >
            {t('settings.goal_remove')}
          </button>
        )}
      </div>
    </BottomSheet>
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
  onTogglePairCard,
  pairedCards,
  onTogglePinCard,
  pinnedCards,
  heroBreakdownOpen,
  onCloseHeroBreakdown,
  savingsGoalOpen,
  savingsGoalCents,
  onCloseSavingsGoal,
  onSaveSavingsGoal,
  phaseLeftover,
  leftoverTargets,
  onPhaseLeftover,
  eventLeftover,
  onEventLeftover,
  valueSuggestion,
  onValueSuggestion,
  tripPriors,
  onTripPriors,
}: DashboardSheetsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const configCard = configCardId !== null ? getDashboardCard(configCardId) : null;
  // DEC-387 (G4): the event-leftover prompt is never auto-decided — dismissing it
  // only hides it for THIS session (the event stays pending and the prompt
  // reappears on the next open, A4) until the user picks a destination.
  const [dismissedEventLeftoverId, setDismissedEventLeftoverId] = useState<string | null>(null);

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
        {/* DEC-447 (G3): the projection detail carries the PhaseSpendLens — the
            reconciliation that explains the derived "orçamento disponível
            calculado" line by line (the lines SUM). */}
        {detailInsight?.kind === 'phase_projection' && model.phaseSpendLens && (
          <PhaseSpendLensBlock
            lens={model.phaseSpendLens}
            currency={trip.baseCurrency}
            poolNameById={model.poolNameById}
          />
        )}
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
            {/* FIELD item 16: compact cards can share a row with the next one. */}
            {isDashboardCardPairable(configCard.id) && (
              <button
                onClick={() => onTogglePairCard(configCard.id)}
                className="w-full px-4 py-3 rounded-xl bg-surface-high text-left btn-press flex items-center gap-3"
              >
                <Icon
                  name={isDashboardCardPaired(configCard.id, pairedCards) ? 'view_agenda' : 'view_column'}
                  size={18}
                  className="text-primary"
                />
                <span className="text-sm font-semibold text-on-surface">
                  {isDashboardCardPaired(configCard.id, pairedCards)
                    ? t('dashboard.card_pair_off')
                    : t('dashboard.card_pair_on')}
                </span>
              </button>
            )}
            {/* FIELD R2 item 5 (F5): contextual cards (piggy bank) can be pinned
                so they stay on the home instead of only when the lens calls them. */}
            {isDashboardCardContextual(configCard.id) && (
              <button
                onClick={() => onTogglePinCard(configCard.id)}
                className="w-full px-4 py-3 rounded-xl bg-surface-high text-left btn-press flex items-center gap-3"
              >
                <Icon
                  name={isDashboardCardPinned(configCard.id, pinnedCards) ? 'keep_off' : 'keep'}
                  size={18}
                  className="text-primary"
                />
                <span className="text-sm font-semibold text-on-surface">
                  {isDashboardCardPinned(configCard.id, pinnedCards)
                    ? t('dashboard.card_pin_off')
                    : t('dashboard.card_pin_on')}
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
                    <span className="text-sm font-bold text-on-surface">
                      {t('dashboard.fts_free')}
                      <InfoDot term="free_to_spend" className="ml-1" />
                    </span>
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
              const isAdd = line.kind === 'add';
              return (
                <div key={line.key} className="flex items-baseline justify-between py-1">
                  <span className="text-sm font-semibold text-on-surface-dim">
                    {t(FTS_LABEL_KEYS[line.key as Exclude<FtsBreakdownKey, 'free' | 'deficit'>] as never)}
                    {FTS_GLOSSARY_TERMS[line.key as FtsBreakdownKey] && (
                      <InfoDot term={FTS_GLOSSARY_TERMS[line.key as FtsBreakdownKey]!} className="ml-1" />
                    )}
                  </span>
                  <span
                    className={`text-sm font-bold tabular ${
                      isSubtract ? 'text-on-surface-faint' : isAdd ? 'text-success' : 'text-on-surface'
                    }`}
                  >
                    {isSubtract ? '− ' : isAdd ? '+ ' : ''}
                    {formatMoney(line.cents, trip.baseCurrency)}
                  </span>
                </div>
              );
            })}
            {/* DEC-466 (INV-1): the "conta do Julio" — reconcile "Já gasto" with
                the bank statement: outflow − fronted for others + your share
                others fronted = personal cost. Plus open debts, so the traveler
                can rebuild the hero number from their own Wise extract. */}
            {model.personalRecon &&
              (model.personalRecon.paidForOthersCents > 0 ||
                model.personalRecon.sharePaidByOthersCents > 0 ||
                model.receivableCents > 0 ||
                model.payableCents > 0) && (
                <div className="mt-4 p-3 rounded-xl bg-surface-container">
                  <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-on-surface-faint">
                    {t('dashboard.recon_title')}
                  </p>
                  <p className="text-[11px] leading-relaxed text-on-surface-faint mt-1">
                    {t('dashboard.recon_hint')}
                  </p>
                  <ReconRow
                    label={t('dashboard.recon_outflow')}
                    cents={model.personalRecon.walletOutflowCents}
                    currency={trip.baseCurrency}
                  />
                  {model.personalRecon.paidForOthersCents > 0 && (
                    <ReconRow
                      label={t('dashboard.recon_paid_for_others')}
                      cents={-model.personalRecon.paidForOthersCents}
                      currency={trip.baseCurrency}
                    />
                  )}
                  {model.personalRecon.sharePaidByOthersCents > 0 && (
                    <ReconRow
                      label={t('dashboard.recon_share_paid_by_others')}
                      cents={model.personalRecon.sharePaidByOthersCents}
                      currency={trip.baseCurrency}
                    />
                  )}
                  <div className="flex items-baseline justify-between pt-2 mt-1 border-t border-[var(--border-faint)]">
                    <span className="text-[12px] font-bold text-on-surface">
                      {t('dashboard.recon_personal_cost')}
                    </span>
                    <span className="text-[12px] font-extrabold tabular text-on-surface">
                      {formatMoney(model.personalRecon.personalCostCents, trip.baseCurrency)}
                    </span>
                  </div>
                  {(model.receivableCents > 0 || model.payableCents > 0) && (
                    <p className="text-[11px] font-semibold text-on-surface-dim mt-2">
                      {t('dashboard.recon_open_debts', {
                        receivable: formatMoney(model.receivableCents, trip.baseCurrency),
                        payable: formatMoney(model.payableCents, trip.baseCurrency),
                      })}
                    </p>
                  )}
                </div>
              )}
            {/* F4 + F20 + F22: the phase map — a 2-tab card (available calendar +
                spending heatmap) showing "where the daily number sits across the
                phase" and what each day's free + reserved total adds up to. */}
            {model.phaseDayMap && model.phaseDayMap.days.length > 0 && (
              <PhaseMapTabs
                map={model.phaseDayMap}
                heatmap={model.heatmap}
                currency={trip.baseCurrency}
                todayIso={model.todayIso}
              />
            )}
            {/* DEC-427 (Field v2 §7-A): "Ritmo de hoje" and "Média até o fim" left
                the Home headline (which now shows ONE hero, "Livre para usar hoje")
                and live here as PROJECTIONS — estimates of pace, never a permission
                to spend. Same numbers as before, only relocated + relabelled; hidden
                when they merely repeat today's free (± < €0,50). Zero math. */}
            {model.todayBudget &&
              (() => {
                const tb = model.todayBudget;
                const showRhythm =
                  Math.abs(tb.avgDailyUntilEndCents - tb.freeTodayCents) > 50;
                const showAvg =
                  Math.abs(tb.avgUntilEndFlatCents - tb.freeTodayCents) > 50;
                if (!showRhythm && !showAvg) return null;
                return (
                  <div className="mt-4 p-3 rounded-xl bg-surface-container">
                    <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-on-surface-faint">
                      {t('dashboard.hero_projections_title')}
                    </p>
                    <p className="text-[11px] leading-relaxed text-on-surface-faint mt-1">
                      {t('dashboard.hero_projections_hint')}
                    </p>
                    {showRhythm && (
                      <p className="text-[12px] font-semibold text-on-surface-dim mt-1.5">
                        {t('dashboard.today_rhythm', {
                          amount: formatMoney(tb.avgDailyUntilEndCents, trip.baseCurrency),
                        })}
                      </p>
                    )}
                    {showAvg && (
                      <p className="text-[12px] font-semibold text-on-surface-dim mt-0.5">
                        {t('dashboard.avg_until_end_flat', {
                          amount: formatMoney(tb.avgUntilEndFlatCents, trip.baseCurrency),
                        })}
                      </p>
                    )}
                  </div>
                );
              })()}
            {/* D13 · DEC-312/313 — "where it comes from" also answers the DAY's
                money: how the daily slice moves and where a calm day's saving
                goes. ONE destination (DEC-313): with a cofrinho the saving is
                kept there (reuse its exact rule copy), otherwise it dilutes into
                the next days. Read-only — the math is untouched (ÂNCORA 11). */}
            <div className="mt-4 p-3 rounded-xl bg-surface-container">
              <p className="text-[10px] font-bold tracking-[0.1em] uppercase text-on-surface-faint">
                {t('dashboard.hero_day_title')}
              </p>
              {model.piggyLedger ? (
                <>
                  <p className="text-[12px] leading-relaxed text-on-surface-dim mt-1.5">
                    {t('dashboard.piggy_voice')}
                  </p>
                  <p className="text-[11px] leading-relaxed text-on-surface-faint mt-1.5">
                    {t('dashboard.piggy_states_hint')}
                  </p>
                </>
              ) : (
                <p className="text-[12px] leading-relaxed text-on-surface-dim mt-1.5">
                  {t('dashboard.hero_day_nextdays')}
                </p>
              )}
            </div>
          </div>
        )}
      </BottomSheet>

      {/* FIELD item 5: edit the savings goal straight from its home card. */}
      <SavingsGoalSheet
        open={savingsGoalOpen}
        currentCents={savingsGoalCents}
        currency={trip.baseCurrency}
        onClose={onCloseSavingsGoal}
        onSave={onSaveSavingsGoal}
      />

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

      {/* DEC-387 (G4): an event ended with reserve money still unspent — ask where
          it goes (free / cofrinho / pote), conserving it 1:1. Never auto-decided:
          dismissing only hides it this session; the event stays pending (A4). */}
      <BottomSheet
        open={eventLeftover !== null && eventLeftover.occurrence.id !== dismissedEventLeftoverId}
        onClose={() => eventLeftover && setDismissedEventLeftoverId(eventLeftover.occurrence.id)}
        title={t('dashboard.event_leftover_title')}
      >
        {eventLeftover && (
          <div className="flex flex-col gap-4">
            <div className="text-center">
              <p className="text-4xl font-extrabold tabular text-success">
                {formatMoney(eventLeftover.leftoverCents, trip.baseCurrency)}
              </p>
              <p className="mt-2 text-sm text-on-surface-dim">
                {t('dashboard.event_leftover_body', { event: eventLeftover.occurrence.name })}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => onEventLeftover('free')}
                className="w-full px-4 py-3 rounded-xl bg-surface-high text-left btn-press flex items-center gap-3"
              >
                <Icon name="account_balance_wallet" size={18} className="text-primary" />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-on-surface">
                    {t('dashboard.event_leftover_free')}
                  </span>
                  <span className="block text-[11px] text-on-surface-faint">
                    {t('dashboard.event_leftover_free_hint')}
                  </span>
                </span>
              </button>
              <button
                onClick={() => onEventLeftover('piggy')}
                className="w-full px-4 py-3 rounded-xl bg-surface-high text-left btn-press flex items-center gap-3"
              >
                <Icon name="savings" size={18} className="text-on-surface-dim" />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-on-surface">
                    {t('dashboard.event_leftover_piggy')}
                  </span>
                  <span className="block text-[11px] text-on-surface-faint">
                    {t('dashboard.event_leftover_piggy_hint')}
                  </span>
                </span>
              </button>
              <button
                onClick={() => onEventLeftover('pot')}
                className="w-full px-4 py-3 rounded-xl bg-surface-high text-left btn-press flex items-center gap-3"
              >
                <Icon name="shopping_bag" size={18} className="text-on-surface-dim" />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-on-surface">
                    {t('dashboard.event_leftover_pot')}
                  </span>
                  <span className="block text-[11px] text-on-surface-faint">
                    {t('dashboard.event_leftover_pot_hint')}
                  </span>
                </span>
              </button>
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

// DEC-466: one signed line of the personal reconciliation card.
function ReconRow({ label, cents, currency }: { label: string; cents: number; currency: string }) {
  const negative = cents < 0;
  return (
    <div className="flex items-baseline justify-between py-0.5 mt-1">
      <span className="text-[12px] font-semibold text-on-surface-dim">{label}</span>
      <span
        className={`text-[12px] font-bold tabular ${negative ? 'text-success' : 'text-on-surface'}`}
      >
        {negative ? '\u2212 ' : ''}
        {formatMoney(Math.abs(cents), currency)}
      </span>
    </div>
  );
}
