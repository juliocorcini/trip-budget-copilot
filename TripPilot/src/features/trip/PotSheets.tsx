import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/components/BottomSheet';
import { showToast } from '@/components/Toast';
import { toCents, parseLocaleNumber } from '@/domain/money';
import { createBudgetPoolWithPhaseLinks } from '@/domain/orchestrators';
import type { Trip } from '@/domain/types/trip';

const INPUT_CLASS = 'bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full';
const LABEL_CLASS = 'text-xs text-on-surface-faint mb-1 block';
const AMOUNT_BOX_CLASS = 'flex items-baseline gap-1 bg-surface-high rounded-lg px-3 py-2';
const AMOUNT_INPUT_CLASS = 'bg-transparent text-sm text-on-surface tabular outline-none w-full';

/** D15 / master §10.4: example chips that prefill the pot name (i18n keys). */
const POT_EXAMPLE_CHIP_KEYS = [
  'pote.chip_shopping',
  'pote.chip_gifts',
  'pote.chip_emergency',
  'pote.chip_transport',
] as const;

interface CreatePotSheetProps {
  open: boolean;
  onClose: () => void;
  trip: Trip;
  onCreated: () => void | Promise<void>;
}

/**
 * GATE 3 M3.2 (D7/D15): the guided "Novo pote" door. A Pote is money set apart
 * with a purpose — no fund/pool/scope jargon. Name + amount are enough; a date
 * (which drives the D8 Home visibility) and a savings goal are OPTIONAL, behind
 * a toggle so the happy path stays one decision. On confirm it creates a single
 * `global` BudgetPool (with the optional date/goal) atomically.
 */
export function CreatePotSheet({ open, onClose, trip, onCreated }: CreatePotSheetProps) {
  const { t } = useTranslation();

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [hasDate, setHasDate] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [hasGoal, setHasGoal] = useState(false);
  const [goal, setGoal] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setAmount('');
    setHasDate(false);
    setStartDate(trip.startDate.slice(0, 10));
    setEndDate(trip.startDate.slice(0, 10));
    setHasGoal(false);
    setGoal('');
    setSaving(false);
  }, [open, trip.startDate]);

  const dateInvalid = hasDate && endDate < startDate;
  const canCreate = name.trim().length > 0 && !dateInvalid && !saving;

  const chips = useMemo(() => POT_EXAMPLE_CHIP_KEYS.map((key) => t(key)), [t]);

  const handleCreate = async () => {
    if (!canCreate) return;
    setSaving(true);
    try {
      await createBudgetPoolWithPhaseLinks({
        tripId: trip.id,
        name: name.trim(),
        scope: 'global',
        totalAmountCents: toCents(parseLocaleNumber(amount) ?? 0),
        currency: trip.baseCurrency,
        phaseLinks: [],
        dateStart: hasDate ? startDate : null,
        dateEnd: hasDate ? endDate : null,
        goalCents: hasGoal ? toCents(parseLocaleNumber(goal) ?? 0) : null,
      });
      showToast(t('pote.created', { name: name.trim() }), 'success');
      onClose();
      await onCreated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={t('pote.create_title')}>
      <div className="flex flex-col gap-3 mt-2">
        <p className="text-xs text-on-surface-dim leading-relaxed">{t('pote.why')}</p>

        <div>
          <label className={LABEL_CLASS}>{t('pote.examples_label')}</label>
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
          <label className={LABEL_CLASS}>{t('pote.name_label')}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('pote.name_placeholder')}
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label className={LABEL_CLASS}>{t('pote.amount_label')}</label>
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

        {/* Optional date (drives D8 Home visibility) */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hasDate}
            onChange={(e) => setHasDate(e.target.checked)}
            className="accent-primary"
          />
          <span className="text-xs text-on-surface-dim">{t('pote.has_date_label')}</span>
        </label>
        {hasDate && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={LABEL_CLASS}>{t('pote.start_label')}</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>{t('pote.end_label')}</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
          </div>
        )}
        {dateInvalid && <p className="text-xs text-error">{t('pote.error_range')}</p>}

        {/* Optional savings goal */}
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
            {saving ? t('common.loading') : t('pote.create_cta')}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
