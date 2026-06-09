import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { createOnboardingEntities } from '@/domain/onboarding';
import { createDefaultActivityProfiles } from '@/domain/profiles';
import { toCents } from '@/domain/money';
import { db } from '@/data/db/database';
import { appSettingsRepository } from '@/data/repositories';

export function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { reload } = useAppData();

  const [step, setStep] = useState(0);
  const [tripName, setTripName] = useState('');
  const [phaseName, setPhaseName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [totalAmount, setTotalAmount] = useState('');
  const [protectedReserve, setProtectedReserve] = useState('');
  const [ownerName, setOwnerName] = useState('');

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
      ownerName: ownerName || 'Eu',
      deviceId,
    });

    await db.trips.add(entities.trip);
    await db.phases.add(entities.phase);
    await db.budgetPools.add(entities.pool);
    await db.budgetPoolPhaseLinks.add(entities.link);
    if (entities.reserve) await db.envelopes.add(entities.reserve);
    await db.participants.add(entities.owner);
    await db.activityProfiles.bulkAdd(createDefaultActivityProfiles(entities.trip.id));

    await appSettingsRepository.update({
      activeTrip: entities.trip.id,
      onboardingCompleted: true,
      isDemo: false,
    });

    await reload();
    navigate('/dashboard');
  };

  const steps = [
    <StepCard key="trip">
      <Field label={t('onboarding.trip_name')} value={tripName} onChange={setTripName} autoFocus />
      <Field label={t('onboarding.start_date')} type="date" value={startDate} onChange={setStartDate} />
      <Field label={t('onboarding.end_date')} type="date" value={endDate} onChange={setEndDate} />
      <CurrencySelect label={t('onboarding.currency')} value={currency} onChange={setCurrency} />
    </StepCard>,
    <StepCard key="budget">
      <Field label={t('onboarding.phase_name')} value={phaseName} onChange={setPhaseName} placeholder={tripName} />
      <Field label={t('onboarding.amount')} type="number" value={totalAmount} onChange={setTotalAmount} placeholder="0.00" />
      <Field label={t('onboarding.protected_reserve')} type="number" value={protectedReserve} onChange={setProtectedReserve} placeholder="0.00" />
    </StepCard>,
    <StepCard key="owner">
      <Field label={t('onboarding.owner_name')} value={ownerName} onChange={setOwnerName} placeholder={t('shared.owner_tag')} />
    </StepCard>,
  ];

  const canNext = step === 0 ? (tripName && startDate && endDate) : step === 1 ? !!totalAmount : true;

  return (
    <div className="flex flex-col min-h-screen px-6 pt-12 pb-8 gap-6">
      <div className="flex gap-1.5 mb-2">
        {steps.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-surface-high'}`} />
        ))}
      </div>

      <div className="flex-1">{steps[step]}</div>

      <div className="flex gap-3">
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
