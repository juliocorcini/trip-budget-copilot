import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { logger } from '@/utils/logger';
import { useAppData } from '@/hooks/useAppData';
import { useKeyboardInset } from '@/hooks/useKeyboardInset';
import {
  createOnboardingEntities,
  buildQuickOnboardingInput,
  buildOngoingOnboardingInput,
} from '@/domain/onboarding';
import {
  createDefaultActivityProfiles,
  TRIP_PRESETS,
  findTripPreset,
  applyTripPreset,
  ACTIVITY_PROFILE_PRESETS,
} from '@/domain/profiles';
import { toCents } from '@/domain/money';
import { localDateString } from '@/domain/dates';
import { instantiateTemplate } from '@/domain/templates';
import { createTripFromOnboarding, createTripFromTemplate } from '@/domain/orchestrators';
import { buildAutoPlan, createScenarioPlan, createAllocationItem } from '@/domain/planning';
import { appSettingsRepository } from '@/data/repositories';
import { requestPersistentStorage } from '@/utils/pwa';
import { showToast } from '@/components/Toast';
import { Icon } from '@/components/Icon';
import type { PhaseRhythmPreset } from '@/domain/types/phase';
import type { AppMode, ThemePreference } from '@/domain/types/common';
import type { TripPresetId } from '@/domain/profiles';

const RHYTHM_PRESETS: PhaseRhythmPreset[] = ['intense', 'moderate', 'relaxed'];
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
type OnboardingFlow = 'quick' | 'detailed';

export function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // DEC-290 (G3): the Welcome "Começar no Dia a dia" entry opens this same flow
  // with ?kind=ongoing — a continuous space (no end date, optional monthly cap)
  // that still finalizes onboarding (identity + mode chooser + activeTrip).
  const isOngoing = searchParams.get('kind') === 'ongoing';
  const { settings, reload } = useAppData();
  // M23: templates saved from past trips, applied here on a new trip.
  const tripTemplates = settings?.tripTemplates ?? [];
  // R5-04: keep the footer buttons above the on-screen keyboard (iOS overlay).
  const keyboardInset = useKeyboardInset();

  // M16: default to the 1-question path; "personalizar" switches to detailed.
  const [flow, setFlow] = useState<OnboardingFlow>('quick');
  const [presetId, setPresetId] = useState<TripPresetId | null>(null);
  // M23: id of the chosen prior-trip template (null = start from defaults).
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0);
  const [tripName, setTripName] = useState('');
  const [phaseName, setPhaseName] = useState('');
  const [startDate, setStartDate] = useState(() => localDateString(new Date()));
  const [endDate, setEndDate] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [totalAmount, setTotalAmount] = useState('');
  const [protectedReserve, setProtectedReserve] = useState('');
  const [ownerName, setOwnerName] = useState('');
  // DEC-252: e-mail is optional and stays LOCAL (fills Participant.email only).
  const [ownerEmail, setOwnerEmail] = useState('');
  // R5-05: phase details — same fields the phase editor offers later.
  const [phaseStartDate, setPhaseStartDate] = useState('');
  const [phaseEndDate, setPhaseEndDate] = useState('');
  const [rhythmPreset, setRhythmPreset] = useState<PhaseRhythmPreset | null>(null);
  const [peakDays, setPeakDays] = useState<number[]>([]);
  // DEC-051 (GAP-026): default wallet (editable) + optional cash wallet
  const [walletName, setWalletName] = useState(() => t('onboarding.default_wallet_name'));
  const [addCashWallet, setAddCashWallet] = useState(false);
  const [cashWalletName, setCashWalletName] = useState(() => t('onboarding.cash_wallet_name'));
  // DEC-449 (D05): theme chosen during onboarding — pre-selected on System,
  // skippable (Próximo confirms), persisted in the same finishing write.
  const [themeChoice, setThemeChoice] = useState<ThemePreference>('system');
  // G2 / DEC-491: activity chips for auto-plan generation. Preset IDs
  // (not profile IDs — profiles are created at finish time).
  const [selectedPresetIds, setSelectedPresetIds] = useState<string[]>([]);

  // M16: the quick path defaults everything but amount + end date, and the
  // chosen trip preset (if any) supplies rhythm/peak/reserve.
  const buildEntities = () => {
    const deviceId = crypto.randomUUID();
    const totalAmountCents = toCents(parseFloat(totalAmount) || 0);
    if (isOngoing) {
      // DEC-290: a Dia a dia space has no real end — reuse the in-app fork's
      // bounded-phase recipe (NewSpacePage) so the monthly cap maps to a sane
      // daily allowance. Amount here is the optional monthly budget.
      const dailyName = tripName.trim() || t('onboarding.daily_default_name');
      return createOnboardingEntities(
        buildOngoingOnboardingInput({
          spaceName: dailyName,
          currency,
          today: localDateString(new Date()),
          monthlyBudgetCents: totalAmountCents,
          ownerName: ownerName.trim() || t('onboarding.default_owner_name'),
          ownerEmail: ownerEmail.trim() || null,
          deviceId,
          defaultWalletName: t('onboarding.default_wallet_name'),
          poolName: t('onboarding.pool_name', { phase: dailyName }),
          reserveName: t('onboarding.reserve_name'),
        }),
      );
    }
    if (flow === 'quick') {
      const quickName = tripName.trim() || t('onboarding.default_trip_name');
      const preset = presetId ? findTripPreset(presetId) : null;
      return createOnboardingEntities(
        buildQuickOnboardingInput({
          tripName: quickName,
          currency,
          startDate: startDate || localDateString(new Date()),
          endDate,
          totalAmountCents,
          // DEC-252: the name is now collected in the shared first step.
          ownerName: ownerName.trim() || t('onboarding.default_owner_name'),
          ownerEmail: ownerEmail.trim() || null,
          deviceId,
          defaultWalletName: t('onboarding.default_wallet_name'),
          poolName: t('onboarding.pool_name', { phase: quickName }),
          reserveName: t('onboarding.reserve_name'),
          presetDefaults: preset ? applyTripPreset(preset, totalAmountCents) : null,
        }),
      );
    }
    return createOnboardingEntities({
      tripName,
      phaseName: phaseName || tripName,
      startDate,
      endDate,
      currency,
      totalAmountCents,
      protectedReserveCents: toCents(parseFloat(protectedReserve) || 0),
      ownerName: ownerName.trim() || t('onboarding.default_owner_name'),
      ownerEmail: ownerEmail.trim() || null,
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
  };

  const handleFinish = async (appMode: AppMode) => {
    if (submitting) return;
    setSubmitting(true);
    const entities = buildEntities();
    // M23: a chosen template recreates its phases + learned profiles instead of
    // the single default phase + cold default profiles.
    const template = selectedTemplateId
      ? tripTemplates.find((tpl) => tpl.id === selectedTemplateId) ?? null
      : null;

    try {
      // BUG-013: all-or-nothing. A crash/app-switch between these writes used
      // to leave a trip with no pool/wallet/profiles as the active trip; the
      // orchestrator now wraps them in a single transaction that rolls back on
      // any failure, so nothing is persisted on error.
      if (template && template.phases.length > 0) {
        const { phases, links, profiles } = instantiateTemplate({
          template,
          tripId: entities.trip.id,
          budgetPoolId: entities.pool.id,
          startDate: entities.trip.startDate.slice(0, 10),
          endDate: entities.trip.endDate.slice(0, 10),
          deviceId: entities.trip.sourceDeviceId,
          now: new Date().toISOString(),
        });
        await createTripFromTemplate({
          trip: entities.trip,
          pool: entities.pool,
          reserve: entities.reserve,
          owner: entities.owner,
          wallets: entities.wallets,
          phases,
          links,
          profiles,
        });
      } else {
        const profiles = createDefaultActivityProfiles(entities.trip.id);

        // G2 / DEC-491: when the user selected activity chips, generate an
        // auto-plan (Fase 1, balanced, no AI) so counters appear immediately.
        let autoPlan = null;
        let autoAllocations: import('@/domain/types/scenario').ScenarioAllocationItem[] = [];

        if (selectedPresetIds.length > 0) {
          const selectedProfileIds = selectedPresetIds
            .map((presetId) => {
              const preset = ACTIVITY_PROFILE_PRESETS.find((p) => p.id === presetId);
              const profile = preset
                ? profiles.find((pr) => pr.category === preset.category)
                : undefined;
              return profile?.id;
            })
            .filter((id): id is string => id != null);

          if (selectedProfileIds.length > 0) {
            const reserveCents = toCents(parseFloat(protectedReserve) || 0);
            const totalCents = toCents(parseFloat(totalAmount) || 0);
            const freeToSpend = Math.max(0, totalCents - reserveCents);

            const result = buildAutoPlan({
              selectedProfileIds,
              profiles,
              freeToSpendCents: freeToSpend,
            });

            if (result.allocations.length > 0) {
              const plan = createScenarioPlan({
                tripId: entities.trip.id,
                phaseId: entities.phase.id,
                budgetPoolId: entities.pool.id,
                name: 'Auto',
                preset: 'equilibrado',
              });
              autoPlan = plan;
              autoAllocations = result.allocations.map((a) =>
                createAllocationItem({
                  scenarioPlanId: plan.id,
                  activityProfileId: a.activityProfileId,
                  quantity: a.quantity,
                  estimatedUnitCostCents: a.estimatedUnitCostCents,
                  isLocked: false,
                  priority: 'planned',
                }),
              );
            }
          }
        }

        await createTripFromOnboarding({
          ...entities,
          profiles,
          autoPlan,
          autoAllocations,
        });
      }
    } catch (err) {
      // Partial state is impossible (the transaction rolled back) — let the
      // user simply tap Finish again instead of stranding them.
      logger.error('onboarding_trip_create_failed', { module: 'onboarding' }, err);
      showToast(t('onboarding.create_error'), 'danger');
      setSubmitting(false);
      return;
    }

    // BUG-013: flip the active trip only AFTER the data is durably committed.
    // appSettings lives in its own store, so it stays out of the transaction
    // above — activeTrip can never point at a rolled-back trip.
    // M16: persist the chosen UX mode in the same write.
    // DEC-449 (D05): the theme picked in the onboarding step rides along.
    await appSettingsRepository.update({
      activeTrip: entities.trip.id,
      onboardingCompleted: true,
      isDemo: false,
      appMode,
      themePreference: themeChoice,
    });

    // GAP-R2-005: protect the freshly created trip data from browser eviction.
    requestPersistentStorage();

    await reload();
    if (copilotChoice === 'copilot') {
      navigate('/planner?copilot=1');
    } else {
      navigate('/dashboard');
    }
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

  const detailedSteps = [
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
      {/* G14 (audit §4.1): "reserva protegida" is jargon — name it with a money example. */}
      <p className="text-xs text-on-surface-dim px-1 leading-snug">{t('onboarding.protected_reserve_hint')}</p>
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
            className="absolute top-0.5 w-5 h-5 rounded-full bg-on-surface transition-[left]"
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

  // M16: the 1-question path — amount + "until when", everything else defaulted.
  const quickStep = (
    <StepCard key="quick">
      <div className="px-1">
        <h2 className="text-heading font-bold text-on-surface">{t('onboarding.quick_title')}</h2>
        <p className="text-xs text-on-surface-dim mt-1">{t('onboarding.quick_subtitle')}</p>
      </div>
      <Field label={t('onboarding.amount')} type="number" value={totalAmount} onChange={setTotalAmount} placeholder="0.00" autoFocus />
      <Field label={t('onboarding.start_date')} type="date" value={startDate} onChange={setStartDate} />
      <Field label={t('onboarding.end_date')} type="date" value={endDate} onChange={setEndDate} />
      <Field label={t('onboarding.trip_name')} value={tripName} onChange={setTripName} placeholder={t('onboarding.default_trip_name')} />
      <CurrencySelect label={t('onboarding.currency')} value={currency} onChange={setCurrency} />
      {/* M23: reuse a template saved from a past trip — recreates its phases and
          learned profiles. Only shown when at least one template exists. */}
      {tripTemplates.length > 0 && (
        <div className="bg-surface-container rounded-xl p-4">
          <label className="text-xs text-on-surface-faint block mb-2">{t('onboarding.template_label')}</label>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setSelectedTemplateId(null)}
              className={`w-full px-3 py-2 rounded-lg text-xs font-medium btn-press text-left ${
                selectedTemplateId === null ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
              }`}
              aria-pressed={selectedTemplateId === null}
            >
              {t('onboarding.template_none')}
            </button>
            {tripTemplates.map((tpl) => {
              const selected = selectedTemplateId === tpl.id;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(tpl.id)}
                  className={`w-full px-3 py-2 rounded-lg btn-press flex items-center gap-2 text-left ${
                    selected ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                  }`}
                  aria-pressed={selected}
                >
                  <Icon name="luggage" size={16} className={selected ? 'text-on-surface' : 'text-on-surface-dim'} />
                  <span className="text-xs font-semibold truncate">{tpl.name}</span>
                  <span className="text-[10px] ml-auto opacity-80">
                    {t('onboarding.template_meta', {
                      phases: tpl.phases.length,
                      profiles: tpl.profiles.length,
                    })}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {/* M17: optional trip type — pre-fills rhythm/peak/reserve, never forced.
          Hidden when a template is chosen (the template defines the structure). */}
      {selectedTemplateId === null && (
        <div className="bg-surface-container rounded-xl p-4">
          <label className="text-xs text-on-surface-faint block mb-2">{t('onboarding.trip_type_label')}</label>
          <div className="flex gap-2">
            {TRIP_PRESETS.map((preset) => {
              const selected = presetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setPresetId((prev) => (prev === preset.id ? null : preset.id))}
                  className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg btn-press ${
                    selected ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                  }`}
                  aria-pressed={selected}
                >
                  <Icon name={preset.iconName} size={20} className={selected ? 'text-on-surface' : 'text-on-surface-dim'} />
                  <span className="text-[11px] font-medium">{t(`trip_presets.${preset.id}` as never)}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-on-surface-faint mt-2">{t('onboarding.trip_type_hint')}</p>
        </div>
      )}
      <button
        type="button"
        onClick={() => { setFlow('detailed'); setStep(0); }}
        className="text-xs font-medium text-primary btn-press py-1 px-1 self-start"
      >
        {t('onboarding.customize_detailed')}
      </button>
    </StepCard>
  );

  // DEC-290 (G3): the Dia a dia first-run step — no end date (continuous), an
  // optional monthly cap, and a friendly default name. Templates and trip-type
  // presets are trip-specific and intentionally omitted here.
  const ongoingStep = (
    <StepCard key="ongoing">
      <div className="px-1">
        <h2 className="text-heading font-bold text-on-surface">{t('onboarding.daily_quick_title')}</h2>
        <p className="text-xs text-on-surface-dim mt-1">{t('onboarding.daily_quick_subtitle')}</p>
      </div>
      <Field
        label={t('onboarding.daily_name_label')}
        value={tripName}
        onChange={setTripName}
        placeholder={t('onboarding.daily_default_name')}
        autoFocus
      />
      <Field
        label={t('spaces.form_monthly_budget')}
        type="number"
        value={totalAmount}
        onChange={setTotalAmount}
        placeholder="0.00"
      />
      <p className="text-[10px] text-on-surface-faint px-1 leading-snug">
        {t('spaces.form_monthly_budget_hint')}
      </p>
      <CurrencySelect label={t('onboarding.currency')} value={currency} onChange={setCurrency} />
    </StepCard>
  );

  // DEC-449 (D05): one-tap theme step in BOTH flows (viagem + Dia a dia) —
  // 3 cards, System pre-selected, never blocks Próximo (skippable by design).
  const themeStep = (
    <StepCard key="theme">
      <div className="px-1">
        <h2 className="text-heading font-bold text-on-surface">{t('onboarding.theme_title')}</h2>
        <p className="text-xs text-on-surface-dim mt-1">{t('onboarding.theme_subtitle')}</p>
      </div>
      {(
        [
          { key: 'light', icon: 'light_mode', labelKey: 'settings.theme_light' },
          { key: 'dark', icon: 'dark_mode', labelKey: 'settings.theme_dark' },
          { key: 'system', icon: 'contrast', labelKey: 'settings.theme_system' },
        ] as const
      ).map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => setThemeChoice(opt.key)}
          className={`bg-surface-container rounded-xl p-4 flex items-center gap-3 text-left btn-press ring-1 ${
            themeChoice === opt.key ? 'ring-primary' : 'ring-transparent'
          }`}
          aria-pressed={themeChoice === opt.key}
        >
          <Icon
            name={opt.icon}
            size={22}
            className={themeChoice === opt.key ? 'text-primary' : 'text-on-surface-dim'}
          />
          <div className="flex-1">
            <p className="text-sm font-semibold text-on-surface">{t(opt.labelKey)}</p>
            {opt.key === 'system' && (
              <p className="text-xs text-on-surface-dim mt-0.5">{t('onboarding.theme_system_hint')}</p>
            )}
          </div>
          {themeChoice === opt.key && <Icon name="check_circle" size={18} filled className="text-primary" />}
        </button>
      ))}
      <p className="text-[10px] text-on-surface-faint px-1 leading-snug">{t('onboarding.theme_hint')}</p>
    </StepCard>
  );

  // M16: closing step in BOTH flows — choose the UX mode (sets appMode).
  const modeStep = (
    <StepCard key="mode">
      <div className="px-1">
        <h2 className="text-heading font-bold text-on-surface">{t('onboarding.mode_title')}</h2>
        <p className="text-xs text-on-surface-dim mt-1">{t('onboarding.mode_subtitle')}</p>
      </div>
      <button
        type="button"
        onClick={() => handleFinish('simple')}
        disabled={submitting}
        className="bg-surface-container rounded-xl p-4 flex items-start gap-3 text-left btn-press ring-1 ring-transparent hover:ring-primary disabled:opacity-50"
      >
        <Icon name="bolt" size={24} className="text-primary shrink-0 mt-0.5" />
        <div>
          {/* G14 (audit §4.1): give the first-timer a recommended default. */}
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-on-surface">{t('onboarding.mode_simple_title')}</p>
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
              {t('onboarding.mode_recommended')}
            </span>
          </div>
          <p className="text-xs text-on-surface-dim mt-0.5">{t('onboarding.mode_simple_desc')}</p>
        </div>
      </button>
      <button
        type="button"
        onClick={() => handleFinish('complete')}
        disabled={submitting}
        className="bg-surface-container rounded-xl p-4 flex items-start gap-3 text-left btn-press ring-1 ring-transparent hover:ring-primary disabled:opacity-50"
      >
        <Icon name="tune" size={24} className="text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-on-surface">{t('onboarding.mode_complete_title')}</p>
          <p className="text-xs text-on-surface-dim mt-0.5">{t('onboarding.mode_complete_desc')}</p>
        </div>
      </button>
    </StepCard>
  );

  // DEC-252: shared FIRST step in both flows — the owner's name (required) and
  // an optional, local-only e-mail. Replaces the old detailed-only owner step
  // and removes the "Eu" default that made every quick-flow user anonymous.
  const identityStep = (
    <StepCard key="identity">
      <div className="px-1">
        <h2 className="text-heading font-bold text-on-surface">{t('onboarding.identity_title')}</h2>
        <p className="text-xs text-on-surface-dim mt-1">{t('onboarding.identity_subtitle')}</p>
      </div>
      <Field
        label={t('onboarding.owner_name')}
        value={ownerName}
        onChange={setOwnerName}
        placeholder={t('shared.owner_tag')}
        autoFocus
      />
      <Field
        label={t('onboarding.owner_email_optional')}
        type="email"
        value={ownerEmail}
        onChange={setOwnerEmail}
        placeholder={t('onboarding.owner_email_placeholder')}
      />
      <p className="text-[10px] text-on-surface-faint px-1 leading-snug">{t('onboarding.owner_email_hint')}</p>
    </StepCard>
  );

  // G2 / DEC-491: activity chip selection step — "O que vai ter nessa fase?"
  const togglePreset = (presetId: string) => {
    setSelectedPresetIds((prev) =>
      prev.includes(presetId) ? prev.filter((id) => id !== presetId) : [...prev, presetId],
    );
  };

  const activityStep = (
    <StepCard key="activities">
      <div className="px-1">
        <h2 className="text-heading font-bold text-on-surface">{t('onboarding.activities_title')}</h2>
        <p className="text-xs text-on-surface-dim mt-1">{t('onboarding.activities_subtitle')}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {ACTIVITY_PROFILE_PRESETS.map((preset) => {
          const selected = selectedPresetIds.includes(preset.id);
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => togglePreset(preset.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium btn-press ${
                selected
                  ? 'bg-primary text-on-surface ring-1 ring-primary'
                  : 'bg-surface-container text-on-surface-dim'
              }`}
              aria-pressed={selected}
            >
              <Icon name={preset.iconName} size={16} className={selected ? 'text-on-surface' : 'text-on-surface-dim'} />
              {t(`profile_presets.${preset.id}` as never)}
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-on-surface-faint px-1 leading-snug">
        {t('onboarding.activities_hint')}
      </p>
    </StepCard>
  );

  // G5 (M5.5): after activity selection, offer the copilot when online.
  const [copilotChoice, setCopilotChoice] = useState<'undecided' | 'copilot' | 'manual'>('undecided');
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : false;

  const copilotOfferStep = (
    <StepCard key="copilot-offer">
      <div className="px-1">
        <h2 className="text-heading font-bold text-on-surface">{t('copilot_flow.copilot_offer')}</h2>
        <p className="text-xs text-on-surface-dim mt-1">{t('copilot_loading.hint')}</p>
      </div>
      <div className="flex flex-col gap-3 mt-2">
        <button
          type="button"
          onClick={() => setCopilotChoice('copilot')}
          className={`p-4 rounded-xl flex items-start gap-3 text-left btn-press ring-1 ${
            copilotChoice === 'copilot' ? 'ring-primary bg-primary/5' : 'ring-transparent bg-surface-container'
          }`}
        >
          <Icon name="auto_awesome" size={22} className={copilotChoice === 'copilot' ? 'text-primary' : 'text-on-surface-dim'} />
          <div>
            <p className="text-sm font-semibold text-on-surface">{t('copilot_flow.copilot_yes')}</p>
            <p className="text-xs text-on-surface-dim mt-0.5">{t('copilot_loading.hint')}</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setCopilotChoice('manual')}
          className={`p-4 rounded-xl flex items-start gap-3 text-left btn-press ring-1 ${
            copilotChoice === 'manual' ? 'ring-primary bg-primary/5' : 'ring-transparent bg-surface-container'
          }`}
        >
          <Icon name="tune" size={22} className={copilotChoice === 'manual' ? 'text-primary' : 'text-on-surface-dim'} />
          <div>
            <p className="text-sm font-semibold text-on-surface">{t('copilot_flow.copilot_no')}</p>
          </div>
        </button>
      </div>
    </StepCard>
  );

  // DEC-290: ongoing replaces the trip steps with the single Dia a dia step.
  const baseSteps = isOngoing ? [ongoingStep] : flow === 'quick' ? [quickStep] : detailedSteps;
  // DEC-252: identity first, then the flow's own steps, then activity chips
  // (G2), then copilot offer (G5, online only), then theme (DEC-449), then the mode chooser closes.
  const showCopilotOffer = isOnline && selectedPresetIds.length > 0 && !isOngoing;
  const steps = [identityStep, ...baseSteps, activityStep, ...(showCopilotOffer ? [copilotOfferStep] : []), themeStep, modeStep];
  const isModeStep = step === steps.length - 1;

  // Per-step validators run PARALLEL to `steps` (data-driven — the index math
  // stays correct now that the identity step shifts everything by one). The
  // identity step requires a non-empty name; everything else mirrors before.
  const nameValid = ownerName.trim().length > 0;
  // DEC-290: the Dia a dia step has no required fields (name defaults, the
  // monthly cap is optional) — the only gate stays the identity name.
  const baseValidators: Array<() => boolean> = isOngoing
    ? [() => true]
    : flow === 'quick'
      ? [() => Boolean(totalAmount && startDate && endDate && startDate <= endDate)]
      : [
          () => Boolean(tripName && startDate && endDate),
          () => phaseDatesValid,
          () => Boolean(totalAmount),
          () => true,
        ];
  // Identity gate + the flow's own gates + activity (always valid) + copilot offer (always valid) + theme (always valid) + mode.
  const copilotOfferValidator = showCopilotOffer ? [() => copilotChoice !== 'undecided'] : [];
  const validators: Array<() => boolean> = [() => nameValid, ...baseValidators, () => true, ...copilotOfferValidator, () => true, () => true];
  const canNext = (validators[step] ?? (() => true))();

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
        {/* M16: the mode step finishes via its own option buttons (no footer CTA). */}
        {!isModeStep && (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canNext}
            className="flex-1 py-3 rounded-xl bg-primary text-on-surface font-semibold btn-press disabled:opacity-40"
          >
            {t('onboarding.next')}
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
