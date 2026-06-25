import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/components/BottomSheet';
import { showToast } from '@/components/Toast';
import { Icon } from '@/components/Icon';
import { toCents, parseLocaleNumber } from '@/domain/money';
import { createPlannedExpense } from '@/domain/orchestrators';
import type { PlanFundingSource, PlannedExpenseOutcome, PotScope } from '@/domain/planning';
import { selectActivePhasePool } from '@/domain/budget';
import { findActivePhase, sortPhasesByOrder } from '@/domain/dates';
import type { Trip } from '@/domain/types/trip';
import type { Phase } from '@/domain/types/phase';
import type { BudgetPool } from '@/domain/types/budget-pool';
import type { BudgetPoolPhaseLink } from '@/domain/types/budget-pool-phase-link';

const INPUT_CLASS = 'bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full';
const LABEL_CLASS = 'text-xs text-on-surface-faint mb-1 block';
const AMOUNT_BOX_CLASS = 'flex items-baseline gap-1 bg-surface-high rounded-lg px-3 py-2';
const AMOUNT_INPUT_CLASS = 'bg-transparent text-sm text-on-surface tabular outline-none w-full';

/** master §10.4: example chips for an Event (dated). */
const EVENT_CHIP_KEYS = [
  'plan.chip_event_festival',
  'plan.chip_event_tour',
  'plan.chip_event_dinner',
  'plan.chip_event_ticket',
] as const;

/** master §10.4: example chips for a Pote / Compra (undated). */
const PURCHASE_CHIP_KEYS = [
  'pote.chip_shopping',
  'pote.chip_gifts',
  'pote.chip_emergency',
  'pote.chip_transport',
] as const;

/** E01 (DEC-321): the door's primary fork — what kind of thing to create. */
type PlanIntent = 'spend' | 'fund';

interface FundingOption {
  id: PlanFundingSource;
  labelKey: string;
  descKey: string;
}

const FUNDING_OPTIONS: FundingOption[] = [
  { id: 'phase', labelKey: 'plan.funding_phase', descKey: 'plan.funding_phase_desc' },
  { id: 'new_pot', labelKey: 'plan.funding_new_pot', descKey: 'plan.funding_new_pot_desc' },
  { id: 'existing_pot', labelKey: 'plan.funding_existing_pot', descKey: 'plan.funding_existing_pot_desc' },
];

interface PlanExpenseSheetProps {
  open: boolean;
  onClose: () => void;
  trip: Trip;
  phases: Phase[];
  pools: BudgetPool[];
  links: BudgetPoolPhaseLink[];
  onCreated: () => void | Promise<void>;
  /** C3: prefill the amount (major units, e.g. "25") when opened from the simulator. */
  initialAmount?: string;
  /** C3: prefill the name when opened with a known target. */
  initialName?: string;
}

const TOAST_KEY: Record<PlannedExpenseOutcome, string> = {
  event_phase: 'plan.created_event',
  event_existing_pot: 'plan.created_event',
  event_new_pot: 'plan.created_event_pot',
  purchase_phase: 'plan.created_purchase',
  purchase_existing_pot: 'plan.created_purchase',
  pot: 'plan.created_pot',
  pot_phase: 'plan.created_pot_phase',
};

/**
 * GATE 4 (M4.1/M4.2, master §3.3) + E01 (DEC-321): the single "Planejar um gasto"
 * door. The first question is now the INTENT — a gasto/evento (something you spend,
 * optionally on a date → countdown) vs a pote/fundo (money set apart, no countdown).
 * A pote/fundo can be scoped to one phase (a `linked_phases` pool, off the current
 * Home, selectable when logging) or the whole trip (a global pot). The Event branch
 * keeps its date + countdown. No fund/pool/occurrence jargon ever shows.
 */
export function PlanExpenseSheet({ open, onClose, trip, phases, pools, links, onCreated, initialAmount, initialName }: PlanExpenseSheetProps) {
  const { t } = useTranslation();

  const sortedPhases = useMemo(() => sortPhasesByOrder(phases.filter((p) => p.deletedAt === null)), [phases]);
  const pots = useMemo(() => pools.filter((p) => p.scope === 'global' && p.deletedAt === null), [pools]);
  const activePhaseId = useMemo(() => findActivePhase(phases)?.id ?? null, [phases]);

  const [intent, setIntent] = useState<PlanIntent>('spend');
  const [hasDate, setHasDate] = useState(false);
  const [funding, setFunding] = useState<PlanFundingSource>('phase');
  const [potScope, setPotScope] = useState<PotScope>('phase');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedPhaseId, setSelectedPhaseId] = useState('');
  const [selectedPotId, setSelectedPotId] = useState('');
  const [hasGoal, setHasGoal] = useState(false);
  const [goal, setGoal] = useState('');
  const [saving, setSaving] = useState(false);

  const isFund = intent === 'fund';
  const isPhaseFund = isFund && potScope === 'phase';
  // A savings goal applies to a pote/fundo (money you save toward), never to a spend.
  const showGoal = isFund;

  useEffect(() => {
    if (!open) return;
    const defaultPhase = activePhaseId ?? sortedPhases[0]?.id ?? '';
    setIntent('spend');
    setHasDate(false);
    setFunding(sortedPhases.length > 0 ? 'phase' : 'existing_pot');
    setPotScope(sortedPhases.length > 0 ? 'phase' : 'trip');
    setName(initialName ?? '');
    setAmount(initialAmount ?? '');
    setStartDate(trip.startDate.slice(0, 10));
    setEndDate('');
    setSelectedPhaseId(defaultPhase);
    setSelectedPotId(pots[0]?.id ?? '');
    setHasGoal(false);
    setGoal('');
    setSaving(false);
  }, [open, trip.startDate, activePhaseId, sortedPhases, pots, initialAmount, initialName]);

  const fundingDisabled = (id: PlanFundingSource): boolean =>
    (id === 'phase' && sortedPhases.length === 0) || (id === 'existing_pot' && pots.length === 0);

  // In the spend branch, "set money aside in a new pot" is the FUND intent — so the
  // new-pot funding only applies to a dated Event (e.g. Tomorrowland). Undated spend
  // is a Compra from the trecho or from an existing pote.
  const spendFundingOptions = useMemo(
    () => FUNDING_OPTIONS.filter((o) => o.id !== 'new_pot' || hasDate),
    [hasDate],
  );

  const selectHasDate = (next: boolean) => {
    setHasDate(next);
    if (!next && funding === 'new_pot') setFunding('phase');
  };

  const chips = useMemo(
    () => (!isFund && hasDate ? EVENT_CHIP_KEYS : PURCHASE_CHIP_KEYS).map((key) => t(key)),
    [isFund, hasDate, t],
  );

  const dateInvalid = !isFund && hasDate && (!startDate || (endDate !== '' && endDate < startDate));
  const spendFundingInvalid =
    !isFund && ((funding === 'phase' && !selectedPhaseId) || (funding === 'existing_pot' && !selectedPotId));
  const fundPhaseInvalid = isPhaseFund && (!selectedPhaseId || sortedPhases.length === 0);
  const canCreate =
    name.trim().length > 0 &&
    (parseLocaleNumber(amount) ?? 0) > 0 &&
    !dateInvalid &&
    !spendFundingInvalid &&
    !fundPhaseInvalid &&
    (isFund || !fundingDisabled(funding)) &&
    !saving;

  /** The trecho a dated, pot-funded event lives in = the phase containing the date. */
  const phaseIdForDate = (iso: string): string | null => {
    const d = iso.slice(0, 10);
    const owner = sortedPhases.find(
      (p) => p.startDate.slice(0, 10) <= d && d <= p.endDate.slice(0, 10),
    );
    return owner?.id ?? activePhaseId ?? sortedPhases[0]?.id ?? null;
  };

  const handleCreate = async () => {
    if (!canCreate) return;
    setSaving(true);
    try {
      const estimatedCostCents = toCents(parseLocaleNumber(amount) ?? 0);
      const goalCents = showGoal && hasGoal ? toCents(parseLocaleNumber(goal) ?? 0) : null;
      let res;
      if (isFund) {
        // E01 (DEC-321): a pote/fundo never becomes an Event. Phase scope → a
        // `linked_phases` pool tied to the chosen phase; trip scope → a global pot.
        res = await createPlannedExpense({
          tripId: trip.id,
          currency: trip.baseCurrency,
          hasDate: false,
          funding: 'new_pot',
          potScope,
          name: name.trim(),
          estimatedCostCents,
          category: 'shopping',
          startDate: null,
          endDate: null,
          phaseId: potScope === 'phase' ? selectedPhaseId : null,
          phasePoolId: null,
          existingPotId: null,
          goalCents,
        });
      } else {
        const eventPhaseId =
          funding === 'phase' ? selectedPhaseId : hasDate ? phaseIdForDate(startDate) : null;
        const phasePool =
          funding === 'phase' && selectedPhaseId
            ? selectActivePhasePool(pools, links, selectedPhaseId)
            : null;
        res = await createPlannedExpense({
          tripId: trip.id,
          currency: trip.baseCurrency,
          hasDate,
          funding,
          name: name.trim(),
          estimatedCostCents,
          category: 'shopping',
          startDate: hasDate ? startDate : null,
          endDate: hasDate && endDate && endDate > startDate ? endDate : null,
          phaseId: eventPhaseId,
          phasePoolId: phasePool?.id ?? null,
          existingPotId: funding === 'existing_pot' ? selectedPotId : null,
          goalCents: null,
        });
      }
      showToast(t(TOAST_KEY[res.outcome], { name: name.trim() }), 'success');
      onClose();
      await onCreated();
    } finally {
      setSaving(false);
    }
  };

  const namePlaceholder = isFund
    ? t('plan.name_placeholder_fund')
    : t(hasDate ? 'plan.name_placeholder_event' : 'plan.name_placeholder_purchase');

  return (
    <BottomSheet open={open} onClose={onClose} title={t('plan.title')}>
      <div className="flex flex-col gap-4 mt-2">
        <p className="text-xs text-on-surface-dim leading-relaxed">{t('plan.why')}</p>

        {/* Q0 — what do you want to create? E01 (DEC-321): the primary fork is the
            INTENT (a spend/event vs setting money aside), so a fund for a future
            phase is never misfiled as a dated Event that pollutes the Home. */}
        <div>
          <label className={LABEL_CLASS}>{t('plan.kind_q')}</label>
          <div className="grid grid-cols-2 gap-2">
            <ChoiceCard
              active={!isFund}
              title={t('plan.kind_spend')}
              desc={t('plan.kind_spend_desc')}
              onClick={() => setIntent('spend')}
            />
            <ChoiceCard
              active={isFund}
              title={t('plan.kind_fund')}
              desc={t('plan.kind_fund_desc')}
              onClick={() => setIntent('fund')}
            />
          </div>
          <p className="text-[11px] text-on-surface-faint leading-snug mt-1.5" data-plan-kind-note>
            {t(isFund ? 'plan.kind_fund_note' : 'plan.kind_spend_note')}
          </p>
        </div>

        {/* SPEND branch — a date question (Event × Compra) + where the money comes from. */}
        {!isFund && (
          <>
            <div>
              <label className={LABEL_CLASS}>{t('plan.q1')}</label>
              <div className="grid grid-cols-2 gap-2">
                <ChoiceCard
                  active={hasDate}
                  title={t('plan.q1_yes')}
                  desc={t('plan.q1_yes_desc')}
                  onClick={() => selectHasDate(true)}
                />
                <ChoiceCard
                  active={!hasDate}
                  title={t('plan.q1_no')}
                  desc={t('plan.q1_no_desc')}
                  onClick={() => selectHasDate(false)}
                />
              </div>
            </div>

            <div>
              <label className={LABEL_CLASS}>{t('plan.q2')}</label>
              <div className="flex flex-col gap-2">
                {spendFundingOptions.map((opt) => {
                  const disabled = fundingDisabled(opt.id);
                  const active = funding === opt.id;
                  return (
                    <button
                      key={opt.id}
                      disabled={disabled}
                      onClick={() => setFunding(opt.id)}
                      className="text-left p-3 rounded-xl btn-press disabled:opacity-40 flex items-center gap-3"
                      style={{
                        background: active ? '#C75B3922' : 'var(--surface-high)',
                        border: active ? '1px solid #C75B3955' : '1px solid transparent',
                      }}
                    >
                      <Icon
                        name={active ? 'radio_button_checked' : 'radio_button_unchecked'}
                        size={18}
                        className={active ? 'text-primary shrink-0' : 'text-on-surface-faint shrink-0'}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-on-surface">{t(opt.labelKey)}</p>
                        <p className="text-[11px] text-on-surface-dim leading-snug">{t(opt.descKey)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
              {funding === 'phase' && sortedPhases.length === 0 && (
                <p className="text-xs text-error mt-1">{t('plan.no_phase')}</p>
              )}
              {funding === 'existing_pot' && pots.length === 0 && (
                <p className="text-xs text-error mt-1">{t('plan.no_pots')}</p>
              )}
            </div>
          </>
        )}

        {/* FUND branch — which part of the trip does the money belong to? */}
        {isFund && (
          <div>
            <label className={LABEL_CLASS}>{t('plan.fund_scope_q')}</label>
            <div className="grid grid-cols-2 gap-2">
              <ChoiceCard
                active={potScope === 'phase'}
                title={t('plan.fund_scope_phase')}
                desc={t('plan.fund_scope_phase_desc')}
                onClick={() => setPotScope('phase')}
                disabled={sortedPhases.length === 0}
              />
              <ChoiceCard
                active={potScope === 'trip'}
                title={t('plan.fund_scope_trip')}
                desc={t('plan.fund_scope_trip_desc')}
                onClick={() => setPotScope('trip')}
              />
            </div>
            {potScope === 'phase' && sortedPhases.length === 0 && (
              <p className="text-xs text-error mt-1">{t('plan.no_phase_fund')}</p>
            )}
          </div>
        )}

        {/* Example chips (prefill the name) */}
        <div>
          <label className={LABEL_CLASS}>{t('plan.examples_label')}</label>
          <div className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <button
                key={chip}
                onClick={() => setName(chip)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold btn-press whitespace-nowrap ${
                  name === chip ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                }`}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={LABEL_CLASS}>{t('plan.name_label')}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={namePlaceholder}
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label className={LABEL_CLASS}>{t('plan.amount_label')}</label>
          <div className={AMOUNT_BOX_CLASS}>
            <span className="text-on-surface-dim text-sm">{trip.baseCurrency}</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              className={AMOUNT_INPUT_CLASS}
            />
          </div>
        </div>

        {/* Optional savings goal — for a pote/fundo the user saves toward. */}
        {showGoal && (
          <>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasGoal}
                onChange={(e) => setHasGoal(e.target.checked)}
                className="accent-primary"
              />
              <span className="text-xs text-on-surface-dim">{t('pote.has_goal_label')}</span>
            </label>
            {hasGoal && (
              <div>
                <label className={LABEL_CLASS}>{t('pote.goal_label')}</label>
                <div className={AMOUNT_BOX_CLASS}>
                  <span className="text-on-surface-dim text-sm">{trip.baseCurrency}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="0,00"
                    className={AMOUNT_INPUT_CLASS}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {!isFund && hasDate && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={LABEL_CLASS}>{t('plan.start_label')}</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>{t('plan.end_label')}</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
          </div>
        )}
        {dateInvalid && startDate !== '' && <p className="text-xs text-error">{t('plan.error_range')}</p>}

        {/* Phase selector — a phase-funded spend OR a phase-scoped fund. */}
        {((!isFund && funding === 'phase') || isPhaseFund) && sortedPhases.length > 0 && (
          <div>
            <label className={LABEL_CLASS}>{t(isFund ? 'plan.fund_phase_label' : 'plan.phase_label')}</label>
            <select
              value={selectedPhaseId}
              onChange={(e) => setSelectedPhaseId(e.target.value)}
              className={INPUT_CLASS}
            >
              {sortedPhases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Pot selector — a spend funded by an existing pot. */}
        {!isFund && funding === 'existing_pot' && pots.length > 0 && (
          <div>
            <label className={LABEL_CLASS}>{t('plan.pot_label')}</label>
            <select
              value={selectedPotId}
              onChange={(e) => setSelectedPotId(e.target.value)}
              className={INPUT_CLASS}
            >
              {pots.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <p className="text-[11px] text-on-surface-faint leading-relaxed">
          {!isFund && funding === 'phase' ? t('plan.summary_from_trecho') : t('plan.summary_apart')}
        </p>

        <div className="flex gap-2 mt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface-dim font-medium text-sm btn-press"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleCreate}
            disabled={!canCreate}
            className="flex-1 py-2.5 rounded-xl bg-primary text-on-surface font-medium text-sm btn-press disabled:opacity-40"
          >
            {saving ? t('common.loading') : t('plan.create_cta')}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

function ChoiceCard({
  active,
  title,
  desc,
  onClick,
  disabled = false,
}: {
  active: boolean;
  title: string;
  desc: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="text-left p-3 rounded-xl btn-press h-full disabled:opacity-40"
      style={{
        background: active ? '#C75B3922' : 'var(--surface-high)',
        border: active ? '1px solid #C75B3955' : '1px solid transparent',
      }}
    >
      <p className="text-sm font-bold text-on-surface">{title}</p>
      <p className="text-[11px] text-on-surface-dim leading-snug mt-0.5">{desc}</p>
    </button>
  );
}
