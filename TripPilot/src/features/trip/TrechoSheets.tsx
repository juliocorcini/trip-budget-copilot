import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { showToast } from '@/components/Toast';
import { toCents, parseLocaleNumber, formatMoney } from '@/domain/money';
import { addDaysIso, formatDate, sortPhasesByOrder } from '@/domain/dates';
import { getNextPhaseOrder, validatePhaseSequence } from '@/domain/phases';
import { createPhaseWithBudget, transferBetweenPools } from '@/domain/orchestrators';
import { phaseRepository } from '@/data/repositories';
import type { Trip } from '@/domain/types/trip';
import type { Phase } from '@/domain/types/phase';
import type { BudgetPool } from '@/domain/types/budget-pool';

const INPUT_CLASS = 'bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full';
const LABEL_CLASS = 'text-xs text-on-surface-faint mb-1 block';

/** Formats cents as a plain editable amount ("12345" → "123,45") for inputs. */
function centsToInput(cents: number): string {
  if (cents <= 0) return '';
  return (cents / 100).toFixed(2).replace('.', ',');
}

interface AddTrechoSheetProps {
  open: boolean;
  onClose: () => void;
  trip: Trip;
  phases: Phase[];
  onCreated: () => void | Promise<void>;
}

/**
 * GATE 2 M2.2: the guided "Adicionar trecho" door. A trecho is a piece of the
 * trip with dates + a budget — no fund/pool/link jargon. On confirm it creates a
 * Phase + dedicated fund + link atomically (createPhaseWithBudget). D12/D13: the
 * range is validated against the other trechos; a clean boundary collision trims
 * the previous trecho to the day before this one starts.
 */
export function AddTrechoSheet({ open, onClose, trip, phases, onCreated }: AddTrechoSheetProps) {
  const { t } = useTranslation();
  const livePhases = useMemo(
    () => sortPhasesByOrder(phases.filter((p) => p.deletedAt === null)),
    [phases],
  );

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(trip.startDate);
  const [endDate, setEndDate] = useState(trip.endDate);
  const [budget, setBudget] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const last = livePhases[livePhases.length - 1];
    const start = last ? addDaysIso(last.endDate, 1) : trip.startDate;
    const end = trip.endDate >= start ? trip.endDate : start;
    setName('');
    setStartDate(start);
    setEndDate(end);
    setBudget('');
    setSaving(false);
  }, [open, livePhases, trip.startDate, trip.endDate]);

  const validation = useMemo(
    () => validatePhaseSequence(livePhases, { startDate, endDate }),
    [livePhases, startDate, endDate],
  );
  const boundaryFix =
    !validation.ok && validation.reason === 'overlap' ? validation.boundaryFix : null;
  const blocked =
    !validation.ok &&
    (validation.reason === 'invalid_range' ||
      (validation.reason === 'overlap' && validation.boundaryFix === null));
  const canCreate = name.trim().length > 0 && !blocked && !saving;

  const handleCreate = async () => {
    if (!canCreate) return;
    setSaving(true);
    const budgetCents = toCents(parseLocaleNumber(budget) ?? 0);
    let trimmedPrev: Phase | null = null;
    try {
      if (boundaryFix) {
        const prev = phases.find((p) => p.id === boundaryFix.phaseId) ?? null;
        if (prev) {
          trimmedPrev = prev;
          await phaseRepository.update({ ...prev, endDate: boundaryFix.newEndDate });
        }
      }
      try {
        await createPhaseWithBudget({
          tripId: trip.id,
          name: name.trim(),
          startDate,
          endDate,
          order: getNextPhaseOrder(phases),
          budgetCents,
          currency: trip.baseCurrency,
        });
      } catch (err) {
        // Restore the boundary trim if the trecho creation failed (atomicity
        // across the two writes — never leave a trimmed trecho without its pair).
        if (trimmedPrev) await phaseRepository.update(trimmedPrev);
        throw err;
      }
      showToast(t('trecho.created', { name: name.trim() }), 'success');
      onClose();
      await onCreated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={t('trecho.add_title')}>
      <div className="flex flex-col gap-3 mt-2">
        <p className="text-xs text-on-surface-dim leading-relaxed">{t('trecho.help')}</p>
        <div>
          <label className={LABEL_CLASS}>{t('trecho.name_label')}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('trecho.name_placeholder')}
            className={INPUT_CLASS}
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={LABEL_CLASS}>{t('trecho.start_label')}</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>{t('trecho.end_label')}</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
        </div>
        <div>
          <label className={LABEL_CLASS}>{t('trecho.budget_label')}</label>
          <div className="flex items-baseline gap-1 bg-surface-high rounded-lg px-3 py-2">
            <span className="text-on-surface-dim text-sm">{trip.baseCurrency}</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="0,00"
              className="bg-transparent text-sm text-on-surface tabular outline-none w-full"
            />
          </div>
        </div>

        {!validation.ok && validation.reason === 'invalid_range' && (
          <p className="text-xs text-error">{t('trecho.error_range')}</p>
        )}
        {boundaryFix && (
          <div className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2">
            <Icon name="info" size={15} className="text-warning shrink-0 mt-0.5" />
            <p className="text-xs text-on-surface-dim">
              {t('trecho.boundary_notice', {
                phase: boundaryFix.phaseName,
                date: formatDate(boundaryFix.newEndDate),
              })}
            </p>
          </div>
        )}
        {!validation.ok && validation.reason === 'overlap' && !validation.boundaryFix && (
          <p className="text-xs text-error">{t('trecho.error_overlap')}</p>
        )}

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
            {saving ? t('common.loading') : t('trecho.add_cta')}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

interface RemanejarSheetProps {
  open: boolean;
  onClose: () => void;
  trip: Trip;
  targetPool: BudgetPool | null;
  pools: BudgetPool[];
  suggestedCents: number;
  onDone: () => void | Promise<void>;
}

/**
 * GATE 2 M2.4 (D5/D14): "remanejar" — cover an overspent trecho by moving budget
 * from another trecho. The trip total never changes (transferBetweenPools keeps
 * the sum invariant); the amount defaults to the overflow so one tap fixes it.
 */
export function RemanejarSheet({
  open,
  onClose,
  trip,
  targetPool,
  pools,
  suggestedCents,
  onDone,
}: RemanejarSheetProps) {
  const { t } = useTranslation();
  const sources = useMemo(
    () =>
      pools.filter(
        (p) => p.deletedAt === null && p.scope === 'linked_phases' && p.id !== targetPool?.id,
      ),
    [pools, targetPool],
  );

  const [sourceId, setSourceId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSourceId(sources[0]?.id ?? null);
    setAmount(centsToInput(suggestedCents));
    setSaving(false);
  }, [open, sources, suggestedCents]);

  const source = sources.find((p) => p.id === sourceId) ?? null;
  const cents = toCents(parseLocaleNumber(amount) ?? 0);
  const overSource = source !== null && cents > source.totalAmountCents;
  const canTransfer = targetPool !== null && source !== null && cents > 0 && !overSource && !saving;

  const handleTransfer = async () => {
    if (!canTransfer || !targetPool || !source) return;
    setSaving(true);
    try {
      const res = await transferBetweenPools({
        sourcePoolId: source.id,
        targetPoolId: targetPool.id,
        amountCents: cents,
      });
      if (res.ok) {
        showToast(
          t('trecho.remanejar_done', {
            amount: formatMoney(cents, trip.baseCurrency),
            from: source.name,
            to: targetPool.name,
          }),
          'success',
        );
        onClose();
        await onDone();
      } else {
        showToast(t('trecho.remanejar_error'), 'danger');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={t('trecho.remanejar_title')}>
      {targetPool && (
        <div className="flex flex-col gap-3 mt-2">
          <p className="text-xs text-on-surface-dim leading-relaxed">
            {t('trecho.remanejar_help', { to: targetPool.name })}
          </p>
          {sources.length === 0 ? (
            <p className="text-sm text-on-surface-dim">{t('trecho.remanejar_no_source')}</p>
          ) : (
            <>
              <div>
                <label className={LABEL_CLASS}>{t('trecho.remanejar_from')}</label>
                <div className="flex flex-col gap-2">
                  {sources.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSourceId(p.id)}
                      className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg btn-press text-left ${
                        sourceId === p.id ? 'bg-primary/15 ring-1 ring-primary' : 'bg-surface-high'
                      }`}
                    >
                      <span className="text-sm text-on-surface truncate">{p.name}</span>
                      <span className="text-xs tabular text-on-surface-dim shrink-0">
                        {formatMoney(p.totalAmountCents, p.currency)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={LABEL_CLASS}>{t('trecho.remanejar_amount')}</label>
                <div className="flex items-baseline gap-1 bg-surface-high rounded-lg px-3 py-2">
                  <span className="text-on-surface-dim text-sm">{trip.baseCurrency}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0,00"
                    className="bg-transparent text-sm text-on-surface tabular outline-none w-full"
                  />
                </div>
                {overSource && source && (
                  <p className="text-xs text-error mt-1">
                    {t('trecho.remanejar_too_much', {
                      max: formatMoney(source.totalAmountCents, source.currency),
                    })}
                  </p>
                )}
              </div>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface-dim font-medium text-sm btn-press"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleTransfer}
                  disabled={!canTransfer}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-on-surface font-medium text-sm btn-press disabled:opacity-40"
                >
                  {saving ? t('common.loading') : t('trecho.remanejar_cta')}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
