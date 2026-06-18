import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { calculateFreeToSpend } from '@/domain/budget';
import { filterTransactionsByPool } from '@/domain/transactions';
import { buildPhasePreview } from '@/domain/phases';
import { formatDate } from '@/domain/dates';
import { formatMoney, toCents, fromCents } from '@/domain/money';
import { phaseRepository } from '@/data/repositories';
import { Icon } from '@/components/Icon';
import { BottomSheet } from '@/components/BottomSheet';
import { DataErrorScreen } from '@/components/DataErrorScreen';
import { showToast } from '@/components/Toast';
import { AvailableCalendar } from '@/features/dashboard/cards/AvailableCalendar';
import { DayBreakdown } from '@/features/dashboard/PhaseMapTabs';

/**
 * F18 (future vision) + F17 (planned income): a READ-ONLY preview of any phase
 * "as if it were day one". It reuses the live per-day distribution
 * (`buildPhasePreview` → `buildPhaseAllowanceMap`) so the math matches the hero,
 * and lets the traveler set the phase's planned income — which feeds ONLY this
 * projection (ÂNCORA 11), never today's real free-to-spend.
 */
export function PhasePreviewPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language || 'pt-BR';
  const navigate = useNavigate();
  const { phaseId } = useParams<{ phaseId: string }>();
  const { trip, phases, pools, links, envelopes, transactions, occurrences, plannedPurchases, loading, error, retry, reload } =
    useAppData();

  const [selectedDayIso, setSelectedDayIso] = useState<string | null>(null);
  const [editingIncome, setEditingIncome] = useState(false);
  const [incomeInput, setIncomeInput] = useState('');
  const [savingIncome, setSavingIncome] = useState(false);

  const phase = useMemo(
    () => phases.find((p) => p.id === phaseId && p.deletedAt === null) ?? null,
    [phases, phaseId],
  );

  // The phase's projection — phase free-to-spend (+ planned income) distributed
  // across the phase from day one. Recomputed only when the inputs change.
  const preview = useMemo(() => {
    if (!phase) return null;
    const primaryPool = pools.find((p) => p.scope === 'linked_phases' && p.deletedAt === null);
    const phaseFreeCents = primaryPool
      ? calculateFreeToSpend(
          primaryPool,
          envelopes.filter((e) => e.budgetPoolId === primaryPool.id),
          filterTransactionsByPool(transactions, primaryPool.id),
          links.filter((l) => l.budgetPoolId === primaryPool.id),
          phase.id,
          occurrences,
          plannedPurchases,
        ).freeToSpendCents
      : 0;
    return buildPhasePreview({
      phase,
      phaseFreeCents,
      plannedIncomeCents: phase.plannedIncomeCents ?? 0,
      occurrences: occurrences.filter((o) => o.phaseId === phase.id && o.deletedAt === null),
      plannedPurchases: plannedPurchases.filter(
        (p) => p.deletedAt === null && (p.phaseId === phase.id || p.phaseId === null),
      ),
    });
  }, [phase, pools, envelopes, transactions, links, occurrences, plannedPurchases]);

  // BUG-004/009/014: a DB read error is NOT "no trip" — never redirect to the
  // destructive onboarding flow on error.
  if (!trip) {
    if (error) return <DataErrorScreen onRetry={retry} />;
    if (loading) return <p className="text-on-surface-dim py-8 text-center">{t('common.loading')}</p>;
    return <Navigate to="/welcome" replace />;
  }

  if (!phase || !preview) {
    return (
      <div className="flex flex-col gap-4 pb-4 pt-2">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
            <Icon name="arrow_back" size={24} className="text-on-surface" />
          </button>
          <h1 className="text-heading font-bold text-on-surface flex-1">{t('phase_preview.title')}</h1>
        </div>
        <p className="text-sm text-on-surface-dim text-center py-8">{t('phase_preview.not_found')}</p>
      </div>
    );
  }

  const currency = trip.baseCurrency;
  const selectedDay = selectedDayIso
    ? preview.map.days.find((d) => d.dateIso === selectedDayIso) ?? null
    : null;

  const formatLongDay = (iso: string) => {
    const label = new Date(`${iso.slice(0, 10)}T12:00:00`)
      .toLocaleDateString(lang, { weekday: 'long', day: '2-digit', month: 'short' })
      .replace('.', '');
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  const openIncomeEditor = () => {
    setIncomeInput(preview.plannedIncomeCents > 0 ? String(fromCents(preview.plannedIncomeCents)) : '');
    setEditingIncome(true);
  };

  const persistIncome = async (cents: number) => {
    setSavingIncome(true);
    try {
      await phaseRepository.update({ ...phase, plannedIncomeCents: Math.max(0, Math.round(cents)) });
      await reload();
      setEditingIncome(false);
    } catch {
      showToast(t('phase_preview.income_save_failed'), 'danger');
    } finally {
      setSavingIncome(false);
    }
  };

  const handleSaveIncome = () => {
    const parsed = toCents(parseFloat(incomeInput.replace(',', '.')));
    if (!Number.isFinite(parsed) || parsed < 0) {
      showToast(t('phase_preview.income_invalid'), 'danger');
      return;
    }
    persistIncome(parsed);
  };

  return (
    <div className="flex flex-col gap-5 pb-4 pt-2">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-heading font-bold text-on-surface truncate">{phase.name}</h1>
          <p className="text-xs text-on-surface-faint">
            {formatDate(phase.startDate)} — {formatDate(phase.endDate)}
          </p>
        </div>
        <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-primary/15 text-primary shrink-0">
          {t('phase_preview.badge')}
        </span>
      </div>

      {/* Read-only notice — this is a future vision, not the live screen. */}
      <div
        className="flex items-start gap-2 rounded-xl p-3"
        style={{ background: 'var(--highlight-subtle)' }}
      >
        <Icon name="visibility" size={16} className="text-primary mt-0.5 shrink-0" />
        <p className="text-xs text-on-surface-dim leading-snug">{t('phase_preview.notice')}</p>
      </div>

      {/* Projection summary — available across the whole phase from day one. */}
      <div className="bg-surface-container rounded-2xl p-5">
        <p className="text-[10px] font-bold text-on-surface-faint uppercase tracking-wider">
          {t('phase_preview.available_label')}
        </p>
        <p className="text-3xl font-extrabold tabular text-on-surface mt-1">
          {formatMoney(preview.previewBaseCents, currency)}
        </p>
        <p className="text-xs text-on-surface-dim mt-1">
          {t('phase_preview.per_day_summary', {
            amount: formatMoney(preview.avgPerDayCents, currency),
            days: preview.totalDays,
          })}
        </p>

        <div className="mt-4 pt-3 border-t border-[var(--border-faint)] flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-on-surface-dim">{t('phase_preview.phase_free')}</span>
            <span className="text-xs font-semibold tabular text-on-surface">
              {formatMoney(preview.phaseFreeCents, currency)}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-on-surface-dim inline-flex items-center gap-1">
              <Icon name="payments" size={13} className="text-primary" />
              {t('phase_preview.planned_income')}
            </span>
            <span className="text-xs font-semibold tabular text-on-surface">
              {preview.plannedIncomeCents > 0
                ? `+ ${formatMoney(preview.plannedIncomeCents, currency)}`
                : formatMoney(0, currency)}
            </span>
          </div>
          {/* G14 (audit §4.11): the "planned income only feeds the projection" nuance, surfaced inline. */}
          <p className="text-[11px] text-on-surface-faint leading-snug mt-1">{t('phase_preview.planned_income_hint')}</p>
        </div>

        <button
          onClick={openIncomeEditor}
          className="mt-3 w-full py-2.5 rounded-xl text-xs font-semibold btn-press inline-flex items-center justify-center gap-1.5"
          style={{ background: 'var(--surface-container-high)', color: 'var(--primary)' }}
        >
          <Icon name="edit" size={14} />
          {preview.plannedIncomeCents > 0
            ? t('phase_preview.edit_income')
            : t('phase_preview.add_income')}
        </button>
      </div>

      {/* The day-by-day calendar (same component as the live phase map). */}
      <div className="bg-surface-container rounded-2xl p-5">
        <p className="text-sm font-bold text-on-surface">{t('phase_preview.calendar_title')}</p>
        <p className="text-xs text-on-surface-dim mt-0.5 mb-3">{t('phase_preview.calendar_intro')}</p>

        <AvailableCalendar
          map={preview.map}
          currency={currency}
          selectedDayIso={selectedDayIso}
          onSelectDay={(iso) => setSelectedDayIso((cur) => (cur === iso ? null : iso))}
        />

        {selectedDay ? (
          <DayBreakdown
            day={selectedDay}
            currency={currency}
            label={formatLongDay(selectedDay.dateIso)}
            hideToday
          />
        ) : (
          <p className="text-[11px] text-on-surface-faint mt-3 leading-snug">
            {t('phase_preview.calendar_hint')}
          </p>
        )}

        {preview.map.undatedPlanItems.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[var(--border-faint)]">
            <p className="text-[11px] font-semibold text-on-surface-dim mb-1.5">
              {t('dashboard.day_map_undated', {
                amount: formatMoney(preview.map.undatedPlanTotalCents, currency),
              })}
            </p>
            <div className="flex flex-wrap gap-1">
              {preview.map.undatedPlanItems.map((item) => (
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
      </div>

      <BottomSheet open={editingIncome} onClose={() => setEditingIncome(false)} title={t('phase_preview.income_sheet_title')}>
        <p className="text-xs text-on-surface-dim mt-1 mb-3 leading-snug">
          {t('phase_preview.income_sheet_hint')}
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            autoFocus
            value={incomeInput}
            onChange={(e) => setIncomeInput(e.target.value)}
            placeholder="0"
            className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2.5 outline-none flex-1 min-w-0"
          />
          <span className="text-xs font-semibold text-on-surface-dim">{currency}</span>
        </div>
        <button
          onClick={handleSaveIncome}
          disabled={savingIncome}
          className="mt-4 w-full py-3 rounded-xl bg-primary text-on-surface font-semibold text-sm btn-press disabled:opacity-50"
        >
          {savingIncome ? t('common.saving') : t('common.save')}
        </button>
        {preview.plannedIncomeCents > 0 && (
          <button
            onClick={() => persistIncome(0)}
            disabled={savingIncome}
            className="mt-2 w-full py-2 text-xs text-on-surface-faint btn-press disabled:opacity-50"
          >
            {t('phase_preview.remove_income')}
          </button>
        )}
      </BottomSheet>
    </div>
  );
}
