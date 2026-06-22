import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { createOnboardingEntities } from '@/domain/onboarding';
import { createDefaultActivityProfiles } from '@/domain/profiles';
import { createTripFromOnboarding } from '@/domain/orchestrators';
import { appSettingsRepository } from '@/data/repositories';
import { toCents } from '@/domain/money';
import { localDateString, addDaysIso } from '@/domain/dates';
import { requestPersistentStorage } from '@/utils/pwa';
import { Icon } from '@/components/Icon';
import { showToast } from '@/components/Toast';
import type { TripKind } from '@/domain/types/common';

/**
 * DEC-249/250 — the in-app "new space" fork, opened from the `/spaces`
 * switcher. The user picks a dated Viagem or a continuous Dia a dia, fills a
 * short form, and a new space is created WITHOUT touching the current one. It
 * reuses the onboarding builder + atomic orchestrator (the same all-or-nothing
 * write), then flips `activeTrip` to the new space and drops the user on its
 * home. First-run onboarding (mode chooser, presets, templates) is untouched.
 */
export function NewSpacePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { trip, participants, settings, reload } = useAppData();

  const [kind, setKind] = useState<TripKind | null>(null);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState(
    () => trip?.baseCurrency ?? settings?.defaultCurrency ?? 'EUR',
  );
  const [startDate, setStartDate] = useState(() => localDateString(new Date()));
  const [endDate, setEndDate] = useState('');
  const [amount, setAmount] = useState('');
  const [monthlyBudget, setMonthlyBudget] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // The new space's owner reuses the current owner's name (participants are
  // trip-scoped, so a fresh owner record is created with the same identity).
  const ownerName =
    participants.find((p) => p.isOwner)?.name ?? t('onboarding.default_owner_name');

  const isOngoing = kind === 'ongoing';
  const canCreate =
    name.trim().length > 0 && (isOngoing || Boolean(endDate));

  const handleCreate = async () => {
    if (submitting || !canCreate || kind === null) return;
    setSubmitting(true);
    const trimmed = name.trim();
    const today = localDateString(new Date());
    const deviceId = crypto.randomUUID();
    try {
      // DEC-250: an ongoing space has no real end. Until the capability gate
      // (os-gate) hides date-coupled UI by `kind`, we seed a single ~1-month
      // phase so the optional monthly cap maps to a sensible daily allowance and
      // the space never renders as an "expired trip". Bounded on purpose — a
      // far-future sentinel would blow up any day-by-day iteration.
      const ongoingEnd = addDaysIso(today, 30);
      const entities = createOnboardingEntities({
        tripName: trimmed,
        phaseName: trimmed,
        startDate: isOngoing ? today : startDate || today,
        endDate: isOngoing ? ongoingEnd : endDate || startDate || today,
        currency,
        totalAmountCents: toCents(
          parseFloat(isOngoing ? monthlyBudget : amount) || 0,
        ),
        protectedReserveCents: 0,
        ownerName,
        ownerEmail: null,
        deviceId,
        defaultWalletName: t('onboarding.default_wallet_name'),
        cashWalletName: null,
        phaseStartDate: null,
        phaseEndDate: null,
        rhythmPreset: null,
        peakDays: null,
        poolName: t('onboarding.pool_name', { phase: trimmed }),
        reserveName: t('onboarding.reserve_name'),
        kind: isOngoing ? 'ongoing' : 'trip',
      });
      await createTripFromOnboarding({
        ...entities,
        profiles: createDefaultActivityProfiles(entities.trip.id),
      });
      // Switch to the new space only after the atomic write commits; appMode and
      // onboardingCompleted are intentionally left as-is (this is not first run).
      await appSettingsRepository.update({ activeTrip: entities.trip.id });
      requestPersistentStorage();
      await reload();
      showToast(t('spaces.created', { name: trimmed }), 'success');
      navigate('/dashboard');
    } catch (err) {
      console.error('[spaces] create failed', err);
      showToast(t('spaces.create_error'), 'danger');
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 py-6">
      <div className="flex items-center gap-2">
        <button
          onClick={() => (kind === null ? navigate(-1) : setKind(null))}
          className="btn-press p-1"
          aria-label={t('common.back')}
        >
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface">{t('spaces.new_title')}</h1>
      </div>

      {kind === null ? (
        <>
          <p className="text-xs text-on-surface-faint">{t('spaces.fork_subtitle')}</p>
          <ForkCard
            icon="luggage"
            title={t('spaces.kind_trip_title')}
            desc={t('spaces.kind_trip_desc')}
            onClick={() => setKind('trip')}
          />
          <ForkCard
            icon="sync"
            title={t('spaces.kind_ongoing_title')}
            desc={t('spaces.kind_ongoing_desc')}
            onClick={() => setKind('ongoing')}
          />
        </>
      ) : (
        <>
          <Field
            label={t('spaces.form_name')}
            value={name}
            onChange={setName}
            placeholder={isOngoing ? t('spaces.form_name_ongoing_ph') : t('onboarding.default_trip_name')}
            autoFocus
          />
          {!isOngoing && (
            <>
              <Field label={t('onboarding.start_date')} type="date" value={startDate} onChange={setStartDate} />
              <Field label={t('onboarding.end_date')} type="date" value={endDate} onChange={setEndDate} />
              <Field label={t('onboarding.amount')} type="number" value={amount} onChange={setAmount} placeholder="0.00" />
            </>
          )}
          {isOngoing && (
            <>
              <Field
                label={t('spaces.form_monthly_budget')}
                type="number"
                value={monthlyBudget}
                onChange={setMonthlyBudget}
                placeholder="0.00"
              />
              <p className="text-[10px] text-on-surface-faint px-1 leading-snug">
                {t('spaces.form_monthly_budget_hint')}
              </p>
            </>
          )}
          <CurrencySelect label={t('onboarding.currency')} value={currency} onChange={setCurrency} />

          <button
            onClick={handleCreate}
            disabled={!canCreate || submitting}
            className="py-3 rounded-xl bg-primary text-on-surface font-semibold btn-press disabled:opacity-40"
          >
            {submitting ? t('spaces.creating') : t('spaces.create')}
          </button>
        </>
      )}
    </div>
  );
}

function ForkCard({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: string;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-surface-container rounded-xl p-4 flex items-start gap-3 text-left btn-press ring-1 ring-transparent hover:ring-primary"
    >
      <Icon name={icon} size={24} className="text-primary shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-on-surface">{title}</p>
        <p className="text-xs text-on-surface-dim mt-0.5">{desc}</p>
      </div>
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="bg-surface-container rounded-xl p-4">
      <label className="text-xs text-on-surface-faint block mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="bg-transparent text-sm text-on-surface outline-none w-full"
      />
    </div>
  );
}

const CURRENCIES = ['EUR', 'USD', 'BRL', 'GBP', 'CHF', 'CAD', 'AUD', 'JPY'];

function CurrencySelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="bg-surface-container rounded-xl p-4">
      <label className="text-xs text-on-surface-faint block mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {CURRENCIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
              value === c ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
            }`}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
