import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { useKeyboardInset } from '@/hooks/useKeyboardInset';
import { createOnboardingEntities } from '@/domain/onboarding';
import { createDefaultActivityProfiles } from '@/domain/profiles';
import { toCents } from '@/domain/money';
import { createTripFromOnboarding } from '@/domain/orchestrators';
import { appSettingsRepository } from '@/data/repositories';
import { requestPersistentStorage } from '@/utils/pwa';
import { showToast } from '@/components/Toast';
import type { PhaseRhythmPreset } from '@/domain/types/phase';

const RHYTHM_PRESETS: PhaseRhythmPreset[] = ['intense', 'moderate', 'relaxed'];
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { reload } = useAppData();
  // R5-04: keep the footer buttons above the on-screen keyboard (iOS overlay).
  const keyboardInset = useKeyboardInset();

  const [step, setStep] = useState(0);
  const [tripName, setTripName] = useState('');
  const [phaseName, setPhaseName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [totalAmount, setTotalAmount] = useState('');
  const [protectedReserve, setProtectedReserve] = useState('');
  const [ownerName, setOwnerName] = useState('');
  // R5-05: phase details — same fields the phase editor offers later.
  const [phaseStartDate, setPhaseStartDate] = useState('');
  const [phaseEndDate, setPhaseEndDate] = useState('');
  const [rhythmPreset, setRhythmPreset] = useState<PhaseRhythmPreset | null>(null);
  const [peakDays, setPeakDays] = useState<number[]>([]);
  // DEC-051 (GAP-026): default wallet (editable) + optional cash wallet
  const [walletName, setWalletName] = useState(() => t('onboarding.default_wallet_name'));
  const [addCashWallet, setAddCashWallet] = useState(false);
  const [cashWalletName, setCashWalletName] = useState(() => t('onboarding.cash_wallet_name'));

  const handleFinish = async () => {
    const deviceId = crypto.randomUUID();
    const entities = createOnboardingEntities({
      tripName,
      phaseName: phaseName || tripName,
      startDate,
      endDate,
      currency,
      totalAmountCents: toCents(parseFloat(totalAmount) || 0),
      protectedReserveCents: toCents(parseFloat(protectedReserve) || 0),
      ownerName: ownerName || t('onboarding.default_owner_name'),
      deviceId,
      defaultWalletName: walletName.trim() || t('onboarding.default_wallet_name'),
      cashWalletName: addCashWallet ? cashWalletName : null,
      phaseStartDate: phaseStartDate || null,
      phaseEndDate: phaseEndDate || null,
      rhythmPreset,
      peakDays: rhythmPreset !== null && peakDays.length > 0 ? peakDays : null,
      // PAR-004 (R6-17): generated names follow the active language.
      poolName: t('onboarding.pool_name', { phase: phaseName || tripName }),
      reserveName: t('onboarding.reserve_name'),
    });

    try {
      // BUG-013: all-or-nothing. A crash/app-switch between these writes used
      // to leave a trip with no pool/wallet/profiles as the active trip; the
      // orchestrator now wraps them in a single transaction that rolls back on
      // any failure, so nothing is persisted on error.
      await createTripFromOnboarding({
        ...entities,
        profiles: createDefaultActivityProfiles(entities.trip.id),
      });
    } catch (err) {
      // Partial state is impossible (the transaction rolled back) — let the
      // user simply tap Finish again instead of stranding them.
      console.error('[onboarding] trip creation failed', err);
      showToast(t('onboarding.create_error'), 'danger');
      return;
    }

    // BUG-013: flip the active trip only AFTER the data is durably committed.
    // appSettings lives in its own store, so it stays out of the transaction
    // above — activeTrip can never point at a rolled-back trip.
    await appSettingsRepository.update({
      activeTrip: entities.trip.id,
      onboardingCompleted: true,
      isDemo: false,
    });

    // GAP-R2-005: protect the freshly created trip data from browser eviction.
    requestPersistentStorage();

    await reload();
    navigate('/dashboard');
  };

  const togglePeakDay = (day: number) => {
    setPeakDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  // R5-05: phase dates must stay inside the trip range when customized.
  const phaseDatesValid =
    (!phaseStartDate || !startDate || phaseStartDate >= startDate) &&
    (!phaseEndDate || !endDate || phaseEndDate <= endDate) &&
    (!phaseStartDate || !phaseEndDate || phaseStartDate <= phaseEndDate);

  const steps = [
    <StepCard key="trip">
      <Field label={t('onboarding.trip_name')} value={tripName} onChange={setTripName} autoFocus />
      <Field label={t('onboarding.start_date')} type="date" value={startDate} onChange={setStartDate} />
      <Field label={t('onboarding.end_date')} type="date" value={endDate} onChange={setEndDate} />
      <CurrencySelect label={t('onboarding.currency')} value={currency} onChange={setCurrency} />
    </StepCard>,
    <StepCard key="phase">
      <Field label={t('onboarding.phase_name')} value={phaseName} onChange={setPhaseName} placeholder={tripName} />
      <p className="text-xs text-on-surface-dim px-1">{t('onboarding.phase_details_hint')}</p>
      <Field
        label={t('onboarding.phase_start_date')}
        type="date"
        value={phaseStartDate || startDate}
        onChange={setPhaseStartDate}
      />
      <Field
        label={t('onboarding.phase_end_date')}
        type="date"
        value={phaseEndDate || endDate}
        onChange={setPhaseEndDate}
      />
      <div className="bg-surface-container rounded-xl p-4">
        <label className="text-xs text-on-surface-faint block mb-2">{t('trip.phase_rhythm_title')}</label>
        <div className="flex gap-2">
          {RHYTHM_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setRhythmPreset((prev) => (prev === preset ? null : preset))}
              className={`flex-1 py-2 rounded-lg text-xs font-medium btn-press ${
                rhythmPreset === preset
                  ? 'bg-primary text-on-surface'
                  : 'bg-surface-high text-on-surface-dim'
              }`}
            >
              {t(`trip.rhythm_${preset}` as never)}
            </button>
          ))}
        </div>
        {rhythmPreset !== null && (
          <>
            <label className="text-xs text-on-surface-faint block mt-3 mb-2">
              {t('trip.peak_days_label')}
            </label>
            <div className="flex gap-1.5">
              {WEEKDAY_ORDER.map((day) => {
                const selected = peakDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => togglePeakDay(day)}
                    className={`w-9 h-9 rounded-lg text-xs font-bold btn-press ${
                      selected ? 'bg-warning/20 text-warning ring-1 ring-warning' : 'bg-surface-high text-on-surface-dim'
                    }`}
                    aria-pressed={selected}
                  >
                    {t(`trip.weekday_${day}` as never)}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </StepCard>,
    <StepCard key="budget">
      <Field label={t('onboarding.amount')} type="number" value={totalAmount} onChange={setTotalAmount} placeholder="0.00" />
      <Field label={t('onboarding.protected_reserve')} type="number" value={protectedReserve} onChange={setProtectedReserve} placeholder="0.00" />
    </StepCard>,
    <StepCard key="owner">
      <Field label={t('onboarding.owner_name')} value={ownerName} onChange={setOwnerName} placeholder={t('shared.owner_tag')} />
    </StepCard>,
    <StepCard key="wallets">
      <p className="text-xs text-on-surface-dim px-1">{t('onboarding.wallets_hint')}</p>
      <Field
        label={t('onboarding.default_wallet_label')}
        value={walletName}
        onChange={setWalletName}
      />
      <button
        type="button"
        onClick={() => setAddCashWallet((prev) => !prev)}
        className="bg-surface-container rounded-xl p-4 flex items-center justify-between btn-press"
      >
        <span className="text-sm text-on-surface font-medium">{t('onboarding.add_cash_wallet')}</span>
        <span
          className="w-10 h-6 rounded-full relative transition-colors"
          style={{ background: addCashWallet ? 'var(--primary)' : 'var(--surface-high)' }}
        >
          <span
            className="absolute top-0.5 w-5 h-5 rounded-full bg-on-surface transition-all"
            style={{ left: addCashWallet ? '18px' : '2px' }}
          />
        </span>
      </button>
      {addCashWallet && (
        <Field
          label={t('onboarding.cash_wallet_label')}
          value={cashWalletName}
          onChange={setCashWalletName}
        />
      )}
    </StepCard>,
  ];

  const canNext =
    step === 0 ? Boolean(tripName && startDate && endDate)
    : step === 1 ? phaseDatesValid
    : step === 2 ? !!totalAmount
    : true;

  return (
    // R5-04: dvh + scrollable content keeps the footer visible with the
    // keyboard open (Android resizes-content; iOS gets the inset below).
    <div className="flex flex-col px-6 pt-12 pb-8 gap-6" style={{ height: '100dvh' }}>
      <div className="flex gap-1.5 mb-2 shrink-0">
        {steps.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-surface-high'}`} />
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">{steps[step]}</div>

      <div
        className="flex gap-3 shrink-0"
        style={keyboardInset > 0 ? { marginBottom: keyboardInset } : undefined}
      >
        {step > 0 && (
          <button
            onClick={() => setStep(step - 1)}
            className="flex-1 py-3 rounded-xl bg-surface-high text-on-surface-dim font-medium btn-press"
          >
            {t('common.back')}
          </button>
        )}
        {step < steps.length - 1 ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canNext}
            className="flex-1 py-3 rounded-xl bg-primary text-on-surface font-semibold btn-press disabled:opacity-40"
          >
            {t('onboarding.next')}
          </button>
        ) : (
          <button
            onClick={handleFinish}
            className="flex-1 py-3 rounded-xl bg-primary text-on-surface font-semibold btn-press"
          >
            {t('onboarding.finish')}
          </button>
        )}
      </div>
    </div>
  );
}

function StepCard({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-4">{children}</div>;
}

function Field({
  label, value, onChange, type = 'text', placeholder, autoFocus,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; autoFocus?: boolean;
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
        // R5-04: keep the focused field visible above the keyboard.
        onFocus={(e) => {
          setTimeout(() => {
            e.target.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }, 250);
        }}
        className="bg-transparent text-sm text-on-surface outline-none w-full"
      />
    </div>
  );
}

const CURRENCIES = ['EUR', 'USD', 'BRL', 'GBP', 'CHF', 'CAD', 'AUD', 'JPY'];

function CurrencySelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
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
