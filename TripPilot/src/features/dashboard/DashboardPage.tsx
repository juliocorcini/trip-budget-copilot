import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { useScrolled } from '@/hooks/useScrolled';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDate, localDateString } from '@/domain/dates';
import { formatMoney, converterCurrencies, MAJOR_CURRENCY_CODES } from '@/domain/money';
import { buildWidgetPayload } from '@/domain/widgets';
import { isIosDevice, isStandaloneDisplayMode } from '@/utils/platform';
import { isNativeApp } from '@/utils/native/platform';
import { updateHomeWidget, pushWidgetData } from '@/utils/native/home-widget';
import { shouldShowInstallNudge } from '@/features/install/install-nudge';
import { Icon } from '@/components/Icon';
import { DataErrorScreen } from '@/components/DataErrorScreen';
import {
  appSettingsRepository,
  plannedOccurrenceRepository,
  budgetPoolRepository,
} from '@/data/repositories';
import {
  toggleDashboardCardHidden,
  toggleDashboardCardPaired,
  toggleDashboardCardPinned,
  type DashboardCardId,
} from '@/domain/dashboard';
import { postponeOccurrence } from '@/domain/planning';
import {
  resolveShareConfirmation,
  applyPhaseLeftover,
  type PhaseLeftoverDestination,
  resolveEventLeftover,
  type EventLeftoverDestination,
  startEvent,
  endEvent,
  applyValueSuggestion,
  dismissValueSuggestion,
  saveTripTemplate,
  markTripPriorsHandled,
} from '@/domain/orchestrators';
import { buildTripTemplate } from '@/domain/templates';
import { showToast } from '@/components/Toast';
import { createDailyCheckIn } from '@/domain/check-in';
import type { DashboardInsight, AppNotification } from '@/domain/insights';
import type { CheckInIntent } from '@/domain/types/common';
import { shouldOfferModeReveal, MODE_REVEAL_MIN_EXPENSES } from '@/domain/app-mode';
import { isOngoing } from '@/domain/spaces/spaces';
import { useDashboardModel } from './useDashboardModel';
import { DashboardCards } from './DashboardCards';
import { DashboardSheets } from './DashboardSheets';
import { SimpleHome } from './SimpleHome';
import { OngoingHome } from './OngoingHome';
import { SimpleRevealCard } from './SimpleRevealCard';
import { LocationDefaultNoticeCard } from './LocationDefaultNoticeCard';
import { HomeAlertsCarousel, type HomeAlertSlide } from './HomeAlertsCarousel';
import { selectHomeAlertIds, type HomeAlertId } from './home-alerts';
import { ActiveSplitHomeCard } from '@/features/split/ActiveSplitHomeCard';
import { SpaceSwitcherChip } from '@/features/spaces/SpaceSwitcherChip';

type TFn = (key: string, options?: Record<string, string | number>) => string;

function notificationToastText(n: AppNotification, t: TFn, currency: string): string {
  const v = n.values;
  switch (n.kind) {
    case 'pending_p2p':
      return t('notifications.pending_p2p', { count: v.count as number });
    case 'pending_group_payment':
      return t('notifications.pending_group_payment', v as Record<string, string>);
    case 'phase_over_budget':
      return t('notifications.phase_over_budget', {
        amount: formatMoney(v.overCents as number, currency),
      });
    default:
      return t(`notifications.${n.kind}`, v as Record<string, string>);
  }
}

export function DashboardPage() {
  const { t } = useTranslation();
  const appData = useAppData();
  const { trip, transactions, loading, error, settings, reload, retry } = appData;
  const navigate = useNavigate();
  const scrolled = useScrolled();
  const [searchParams, setSearchParams] = useSearchParams();
  // DEC-090 (R-08): bell badge = active derived notifications.
  const { notifications } = useNotifications();

  // UI-only state — kept in the page; the heavy data lives in the model.
  const [confirmSheetOpen, setConfirmSheetOpen] = useState(false);
  const [shareDrafts, setShareDrafts] = useState<Record<string, string>>({});
  const [detailInsight, setDetailInsight] = useState<DashboardInsight | null>(null);
  const [configCardId, setConfigCardId] = useState<DashboardCardId | null>(null);
  const [heroBreakdownOpen, setHeroBreakdownOpen] = useState(false);
  // FIELD item 5: the savings goal is editable straight from its home card.
  const [savingsGoalOpen, setSavingsGoalOpen] = useState(false);

  // U6 (DEC-180): the month heatmap + its day drill-down moved to the Copiloto,
  // so the home no longer drives heatmap month/day state — the model still gets
  // the current month for the derivations the home cards reuse.
  const model = useDashboardModel(appData, localDateString(new Date()).slice(0, 7), null);

  // DEC-090 (R-08): the notifications center deep-links into the confirm sheet.
  useEffect(() => {
    if (searchParams.get('confirmShares') && model.pendingShares.length > 0) {
      setConfirmSheetOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, model.pendingShares]);

  const actionToastFiredRef = useRef(new Set<string>());
  useEffect(() => {
    const actionKinds: Set<string> = new Set([
      'pending_p2p',
      'pending_group_payment',
      'phase_over_budget',
    ]);
    const actionNotifs = notifications.filter(
      (n) => actionKinds.has(n.kind) && !actionToastFiredRef.current.has(n.id),
    );
    if (actionNotifs.length === 0) return;
    for (const n of actionNotifs) actionToastFiredRef.current.add(n.id);
    const first = actionNotifs[0]!;
    const toastVariant = first.tone === 'error' ? 'danger' as const : 'warning' as const;
    showToast(
      notificationToastText(first, t, trip?.baseCurrency ?? 'EUR'),
      toastVariant,
      {
        actionLabel: t('common.see'),
        onTap: () => navigate(first.destination),
        durationMs: 6000,
      },
    );
  }, [notifications, t, navigate, trip?.baseCurrency]);

  // DEC-459: mirror the daily hero into the Android home widget (native only;
  // no-op elsewhere). Formatting + labels are pushed from HERE so the widget
  // always matches the in-app number and language.
  const widgetFreeCents = model.todayBudget?.freeTodayCents ?? null;
  useEffect(() => {
    if (!isNativeApp() || widgetFreeCents === null || !trip) return;
    void updateHomeWidget({
      value: formatMoney(widgetFreeCents, trip.baseCurrency),
      label: t('dashboard.widget_free_today'),
      addHint: '+',
    });
  }, [widgetFreeCents, trip, t]);

  // DEC-468: push the FULL widget-suite payload (7 widgets, one JSON). All
  // numbers come from the model (ÂNCORA 10 — native never re-computes money);
  // the push itself dedupes, so re-renders are free. The legacy update above
  // stays for pre-0.72.0 APKs.
  const { todayBudget, occasionCounters, piggyBankCents, savingsGoal, upcomingEvents, todayIso } = model;
  const widgetPhase = model.activePhase;
  const frozenRates = settings?.frozenRates ?? null;
  const anchorCurrency = settings?.anchorCurrency ?? settings?.defaultCurrency ?? null;
  useEffect(() => {
    if (!isNativeApp() || !trip) return;
    const base = trip.baseCurrency;
    const currencies = converterCurrencies(frozenRates, [
      base,
      ...MAJOR_CURRENCY_CODES,
      ...(anchorCurrency ? [anchorCurrency.toUpperCase()] : []),
    ]);
    const home = anchorCurrency?.toUpperCase() ?? null;
    const converterTo =
      home && home !== base && currencies.includes(home)
        ? home
        : currencies.find((c) => c !== base) ?? base;
    const rateStamp = frozenRates
      ? t('dashboard.widget_rate_of', {
          date: new Date(frozenRates.fetchedAt).toLocaleDateString(),
        })
      : '';
    const payload = buildWidgetPayload({
      baseCurrency: base,
      todayIso,
      freeToday: todayBudget
        ? {
            freeTodayCents: todayBudget.freeTodayCents,
            todaySpentCents: todayBudget.todaySpentCents,
          }
        : null,
      phase: widgetPhase ? { startDate: widgetPhase.startDate, endDate: widgetPhase.endDate } : null,
      occasionCounters,
      piggyBankCents,
      savingsGoal: savingsGoal
        ? { goalCents: savingsGoal.goalCents, progressRatio: savingsGoal.progressRatio }
        : null,
      upcomingEvents,
      transactions,
      frozenRates,
      converterPair: { from: base, to: converterTo, currencies },
      labels: {
        freeToday: t('dashboard.widget_free_today'),
        addHint: '+',
        spentToday: (amount) => t('dashboard.widget_spent_today', { amount }),
        dayOf: (day, total) => t('dashboard.widget_day_of', { day, total }),
        metas: t('dashboard.widget_metas'),
        // DEC-472: whole-phase total — same figure as the home card.
        metaDetailPlanned: (done) => t('dashboard.occasion_done', { count: done }),
        metaDetailActivity: t('dashboard.occasion_items'),
        piggy: t('dashboard.widget_piggy'),
        piggyGoal: (amount) => t('dashboard.widget_piggy_goal', { amount }),
        nextEvent: t('dashboard.widget_next_event'),
        countdown: (days) =>
          days === 0
            ? t('dashboard.widget_event_today')
            : days === 1
              ? t('dashboard.widget_event_tomorrow')
              : t('dashboard.widget_event_in_days', { count: days }),
        eventReserve: (amount) => t('dashboard.widget_event_reserve', { amount }),
        today: t('dashboard.widget_today'),
        rateStamp,
        actionAdd: t('dashboard.widget_action_add'),
        actionScan: t('dashboard.widget_action_scan'),
        actionOuting: t('dashboard.widget_action_outing'),
        actionConvert: t('dashboard.widget_action_convert'),
        categoryName: (category) => t(`categories.${category}` as never),
      },
    });
    void pushWidgetData(JSON.stringify(payload));
  }, [
    trip,
    todayBudget,
    widgetPhase,
    occasionCounters,
    piggyBankCents,
    savingsGoal,
    upcomingEvents,
    todayIso,
    transactions,
    frozenRates,
    anchorCurrency,
    t,
  ]);

  const handleResolveShare = async (shareId: string, status: 'confirmed' | 'rejected') => {
    if (!model.owner) return;
    const draft = shareDrafts[shareId];
    const parsed = draft !== undefined ? Number(draft.replace(',', '.')) : NaN;
    const adjustedAmountCents =
      status === 'confirmed' && Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : null;
    await resolveShareConfirmation({ shareId, status, adjustedAmountCents, ownerId: model.owner.id });
    setShareDrafts((prev) => {
      const next = { ...prev };
      delete next[shareId];
      return next;
    });
    await reload();
  };

  // DEC-119 (R-10): hide card = "delete that doesn't delete".
  const handleHideCard = async (id: DashboardCardId) => {
    await appSettingsRepository.update({
      hiddenDashboardCards: toggleDashboardCardHidden(id, settings?.hiddenDashboardCards),
    });
    setConfigCardId(null);
    await reload();
  };

  // FIELD item 16: opt a compact card in/out of the 2-up grid (share a row).
  const handleTogglePairCard = async (id: DashboardCardId) => {
    await appSettingsRepository.update({
      dashboardPairedCards: toggleDashboardCardPaired(id, settings?.dashboardPairedCards),
    });
    setConfigCardId(null);
    await reload();
  };

  // FIELD R2 item 5 (F5): pin/unpin a contextual card (the piggy bank) so it
  // either lives permanently on the home or returns to lens-only surfacing.
  const handleTogglePinCard = async (id: DashboardCardId) => {
    await appSettingsRepository.update({
      dashboardPinnedCards: toggleDashboardCardPinned(id, settings?.dashboardPinnedCards),
    });
    setConfigCardId(null);
    await reload();
  };

  // M22: accepting the adaptive offer switches to complete mode (explicit user
  // action — ÂNCORA 10) and never asks again; dismissing only silences it.
  const handleRevealAccept = async () => {
    await appSettingsRepository.update({ appMode: 'complete', simpleRevealDismissed: true });
    await reload();
  };

  const handleRevealDismiss = async () => {
    await appSettingsRepository.update({ simpleRevealDismissed: true });
    await reload();
  };

  // FB-03 (DEC-265): the transparent first-run location notice. Acknowledging
  // (or stepping into Settings to turn it off) marks it seen so it never nags
  // again — a one-tap, honest disclosure of the new default ON.
  const handleAckLocationNotice = async () => {
    await appSettingsRepository.update({ locationDefaultNoticeAcknowledged: true });
    await reload();
  };

  const handleOpenLocationSettings = async () => {
    await appSettingsRepository.update({ locationDefaultNoticeAcknowledged: true });
    navigate('/settings');
  };

  // E05 (DEC-325): opening the discovery hub retires the first-run "Descobrir"
  // nudge for good — the header reverts to the compact icon + bell next time.
  const handleOpenDiscover = async () => {
    if ((settings?.discoverHintSeen ?? true) === false) {
      await appSettingsRepository.update({ discoverHintSeen: true });
      // Refresh the shared app-data so the header reverts to the compact icon +
      // bell on return (the context caches settings; an update alone is silent).
      await reload();
    }
    navigate('/descobrir');
  };

  // E05 (DEC-325): only a brand-new install (seeded false) shows the expanded
  // first-run "Descobrir" nudge; everyone else keeps the compact icon + bell.
  const showDiscoverNudge = (settings?.discoverHintSeen ?? true) === false;

  // DEC-251 (os-budget): set/clear the Dia a dia monthly cap. The cap lives on
  // the space's active pool; 0 means "no limit, just log". The spent total is
  // always derived month-scoped from transactions, so it resets on its own.
  const handleSetMonthlyCap = async (cents: number) => {
    if (!model.primaryPool) return;
    await budgetPoolRepository.update({ ...model.primaryPool, totalAmountCents: cents });
    showToast(cents > 0 ? t('ongoing.cap_set') : t('ongoing.cap_cleared'), 'success');
    await reload();
  };

  // M7 (E5): one tap sets the day's intent (read-only context — ÂNCORA 12).
  const handleSelectCheckIn = async (intent: CheckInIntent) => {
    await appSettingsRepository.update({
      dailyCheckIn: createDailyCheckIn(intent, localDateString(new Date())),
    });
    await reload();
  };

  // FIELD item 5: save / clear the savings goal from its card (ÂNCORA 11: the
  // goal is read-only motivation — it never touches the budget).
  const handleSaveSavingsGoal = async (cents: number | null) => {
    await appSettingsRepository.update({ savingsGoalCents: cents });
    await reload();
    setSavingsGoalOpen(false);
  };

  // DEC-465: resgate do cofrinho — append-only withdrawal persisted in settings;
  // the ledger replays it and the daily cap stops parking that money.
  const handlePiggyWithdraw = async (amountCents: number) => {
    if (!trip || !model.primaryPool || amountCents <= 0) return;
    const withdrawal = {
      tripId: trip.id,
      poolId: model.primaryPool.id,
      dateIso: model.todayIso,
      amountCents,
    };
    await appSettingsRepository.update({
      piggyWithdrawals: [...(settings?.piggyWithdrawals ?? []), withdrawal],
    });
    await reload();
    showToast(t('dashboard.piggy_withdraw_done'), 'success');
  };

  // M9/M10 (E5): the chosen leftover decision runs through the atomic
  // orchestrator; every path (including dismiss = carry_next) marks the ended
  // phase handled, so the sheet shows exactly once per cycle. ÂNCORA 13.
  const handlePhaseLeftover = async (
    destination: PhaseLeftoverDestination,
    targetPoolId: string | null,
  ) => {
    if (!model.phaseLeftover || !model.primaryPool || !trip) return;
    const leftoverCents = model.phaseLeftover.leftoverCents;
    await applyPhaseLeftover({
      endedPhaseId: model.phaseLeftover.endedPhaseId,
      sourcePoolId: model.primaryPool.id,
      amountCents: leftoverCents,
      destination,
      targetPoolId,
      reserveName: t('dashboard.leftover_reserve_name', {
        phase: model.phaseLeftover.endedPhaseName,
      }),
    });
    // Confirm where the money went — the destination (reserve / another pool)
    // is off-screen, so the choice must announce its result.
    if (destination === 'reserve') {
      showToast(
        t('dashboard.leftover_moved_reserve', {
          amount: formatMoney(leftoverCents, trip.baseCurrency),
        }),
        'success',
      );
    } else if (destination === 'shopping' && targetPoolId) {
      const target = model.globalPoolSummaries.find((g) => g.pool.id === targetPoolId);
      showToast(
        t('dashboard.leftover_moved_pool', {
          amount: formatMoney(leftoverCents, trip.baseCurrency),
          pool: target?.pool.name ?? '',
        }),
        'success',
      );
    }
    await reload();
  };

  // DEC-387 (G4): resolve an ended event's leftover. Only an explicit choice
  // runs the atomic orchestrator — dismissing the sheet leaves it pending (A4).
  // The destination (free / cofrinho / pote) is off-screen, so announce it.
  const handleEventLeftover = async (destination: EventLeftoverDestination) => {
    if (!model.eventLeftover || !trip) return;
    const { occurrence, leftoverCents } = model.eventLeftover;
    const leftoverLabel = t('dashboard.event_leftover_label', { event: occurrence.name });
    await resolveEventLeftover({
      occurrenceId: occurrence.id,
      amountCents: leftoverCents,
      destination,
      leftoverLabel,
      tripId: trip.id,
      currency: trip.baseCurrency,
    });
    const amount = formatMoney(leftoverCents, trip.baseCurrency);
    if (destination === 'free') {
      showToast(t('dashboard.event_leftover_moved_free', { amount }), 'success');
    } else if (destination === 'piggy') {
      showToast(t('dashboard.event_leftover_moved_piggy', { amount }), 'success');
    } else {
      showToast(t('dashboard.event_leftover_moved_pot', { amount }), 'success');
    }
    await reload();
  };

  // E7 (M19): the value suggestion is the app proposing, never deciding. Accept
  // writes the new typical/safe to the profile; keep records the dismissal so it
  // never nags again this trip. ÂNCORA 12.
  const handleValueSuggestion = async (accept: boolean) => {
    if (!model.valueSuggestion || !trip) return;
    if (accept) {
      await applyValueSuggestion({
        profileId: model.valueSuggestion.profileId,
        typicalValueCents: model.valueSuggestion.suggestedTypicalCents,
        safeValueCents: model.valueSuggestion.suggestedSafeCents,
      });
      // The accepted value updates a stored profile the user can't see from the
      // dashboard — confirm it so the action has a visible, explained result.
      showToast(
        t('dashboard.value_suggestion_applied', {
          profile: model.valueSuggestion.profileName,
          amount: formatMoney(model.valueSuggestion.suggestedTypicalCents, trip.baseCurrency),
        }),
        'success',
      );
    } else {
      await dismissValueSuggestion(model.valueSuggestion.profileId);
    }
    await reload();
  };

  // E7 (M21): the trip ended → offer to save what it learned as priors for the
  // next trip. Accept builds a template from the live trip (phases + learned
  // profiles); both accept and dismiss mark it handled so it shows once.
  const handleTripPriors = async (accept: boolean) => {
    if (!model.tripPriors || !trip) return;
    if (accept) {
      await saveTripTemplate(
        buildTripTemplate({
          id: crypto.randomUUID(),
          name: model.tripPriors.tripName,
          createdAt: new Date().toISOString(),
          baseCurrency: trip.baseCurrency,
          phases: appData.phases,
          profiles: model.profiles,
        }),
      );
      showToast(t('dashboard.priors_saved'), 'success');
    }
    await markTripPriorsHandled(model.tripPriors.tripId);
    await reload();
  };

  // DEC-072 (M6.3): "Postpone" pushes the event's date interval +1 day.
  const handlePostponeEvent = async (occurrenceId: string) => {
    const occurrence = await plannedOccurrenceRepository.getById(occurrenceId);
    if (!occurrence) return;
    const updated = postponeOccurrence(occurrence);
    await plannedOccurrenceRepository.update(updated);
    // Postponing used to be silent — confirm the new date so the tap has a
    // visible result instead of the event just shifting somewhere off-screen.
    if (updated.plannedDate) {
      showToast(
        t('dashboard.event_postponed', {
          name: occurrence.name,
          date: formatDate(updated.plannedDate, "d 'de' MMM"),
        }),
        'success',
      );
    }
    await reload();
  };

  // DEC-400 (G1): "iniciar evento" — the event goes live (and stays live until
  // explicitly ended); from here the card offers direct event expenses + outings.
  const handleStartEvent = async (occurrenceId: string) => {
    const occurrence = await plannedOccurrenceRepository.getById(occurrenceId);
    if (!occurrence) return;
    await startEvent(occurrenceId);
    showToast(t('dashboard.event_started', { name: occurrence.name }), 'success');
    await reload();
  };

  // DEC-400 (G1): "encerrar evento" — closes any running outing and ends the
  // event; an unspent reserve then surfaces the leftover prompt (DEC-387), which
  // the user resolves (never auto-decided, A4).
  const handleEndEvent = async (occurrenceId: string) => {
    const occurrence = await plannedOccurrenceRepository.getById(occurrenceId);
    if (!occurrence) return;
    await endEvent(occurrenceId);
    showToast(t('dashboard.event_ended', { name: occurrence.name }), 'success');
    await reload();
  };

  // DEC-091 (R-09): tap opens the CONTENT of each insight.
  const handleInsightTap = (insight: DashboardInsight) => {
    switch (insight.kind) {
      case 'avg_outing_cost':
        navigate('/expenses?tab=outings');
        return;
      case 'participant_balance':
        navigate('/shared');
        return;
      case 'next_event':
        navigate(`/trip/edit?occurrence=${insight.values.occurrenceId}`);
        return;
      // M4: jump to the offending category's expenses.
      case 'category_rhythm':
        navigate(`/expenses?category=${insight.values.category}`);
        return;
      // D06 · DEC-317: relocated factual reads route to where the data lives.
      case 'top_category':
        navigate(`/expenses?category=${insight.values.categoryKey}`);
        return;
      case 'receivable':
        navigate('/shared');
        return;
      // M6: the nudge opens quick capture so "what did I spend?" is one tap.
      case 'end_of_day':
        navigate('/quick-add');
        return;
      // M11: the countdown jumps to the Viagem hub (phases + dates) — DEC-288.
      case 'phase_countdown':
        navigate('/viagem');
        return;
      default:
        setDetailInsight(insight);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-on-surface-dim">{t('common.loading')}</p>
      </div>
    );
  }

  // DEC-109: a failed DB read is NOT "no data" — show recovery, never welcome.
  if (error) {
    return <DataErrorScreen onRetry={retry} />;
  }

  // BUG-009: declarative redirect — calling navigate() during render triggers
  // React's "cannot update a component while rendering" warning under React 19.
  if (!trip || !settings?.onboardingCompleted) {
    return <Navigate to="/welcome" replace />;
  }

  const { activePhase, dayNum } = model;
  const hiddenCardCount = (settings.hiddenDashboardCards ?? []).length;
  // DEC-251: a continuous "Dia a dia" space has no dates — its home reasons per
  // month, so it bypasses the phase header, the trip hero and simple mode alike.
  const ongoing = isOngoing(trip);
  // M18: simple mode shows a lean home (one number + register) instead of cards.
  const isSimpleMode = settings.appMode === 'simple';
  // M22: offer to unlock complete mode once enough expenses are logged.
  const offerReveal = shouldOfferModeReveal(
    settings.appMode,
    settings.simpleRevealDismissed,
    transactions.length,
    MODE_REVEAL_MIN_EXPENSES,
  );

  // UX polish: the urgent storage-eviction warning (real data-loss risk) stays
  // on the home. DEC-176: the routine backup REMINDER was removed from the home
  // — it now lives in the notifications center, so it no longer greets the user
  // on the first screen (Julio's request).
  // N4: the APK uses app-private storage (no browser eviction), so the
  // data-loss warning never applies natively — Web/PWA keeps it.
  const showStorageWarning =
    !isNativeApp() &&
    model.storageNotPersisted &&
    !(isIosDevice() && isStandaloneDisplayMode());

  // DEC-293 (M03/M10): the top-of-home alerts collapse into ONE rotating slot
  // instead of a stack. The selector decides which are active and their order
  // (demo alone; otherwise storage-risk before the location notice); the
  // carousel keeps every active alert one swipe away (Â9).
  const locationNoticeActive =
    !settings.isDemo &&
    settings.locationCaptureEnabled &&
    settings.locationDefaultNoticeAcknowledged === false;
  // BUG-002: with real data to lose off iOS, the CTA is a direct "back up now".
  const strongBackupCta = !isIosDevice() && transactions.length > 0;
  const alertNodeById: Record<HomeAlertId, ReactNode> = {
    demo: (
      <div className="mt-4 p-3 rounded-xl bg-warning/10 border border-warning/30">
        <p className="text-xs font-semibold text-warning">{t('demo.banner')}</p>
      </div>
    ),
    location_notice: (
      <LocationDefaultNoticeCard
        onAcknowledge={handleAckLocationNotice}
        onOpenSettings={handleOpenLocationSettings}
      />
    ),
    storage_warning: (
      <button
        onClick={() => navigate(strongBackupCta ? '/settings/backup' : '/settings')}
        className="mt-4 p-3 rounded-xl flex items-center gap-2.5 btn-press text-left w-full"
        style={{ background: 'var(--surface-container)', border: '1px solid var(--border-faint)' }}
      >
        <Icon
          name={isIosDevice() ? 'add_to_home_screen' : strongBackupCta ? 'cloud_upload' : 'warning'}
          size={16}
          className="text-warning"
        />
        <p className="text-xs font-semibold text-on-surface-dim flex-1">
          {isIosDevice()
            ? t('dashboard.storage_install_ios')
            : strongBackupCta
              ? t('dashboard.storage_backup_now')
              : t('dashboard.storage_not_persisted')}
        </p>
        <Icon name="chevron_right" size={14} className="text-on-surface-faint" />
      </button>
    ),
  };
  const alertSlides: HomeAlertSlide[] = selectHomeAlertIds({
    isDemo: settings.isDemo,
    storageAtRisk: showStorageWarning,
    locationNoticeActive,
    // DEC-380: the InstallNudge banner already carries the install prompt, so the
    // carousel drops the duplicate install/storage card (kept only for a real
    // backup CTA, which is a distinct action).
    installNudgeActive: shouldShowInstallNudge(),
    backupCtaActive: strongBackupCta,
  }).map((id) => ({ id, node: alertNodeById[id] }));

  return (
    <div className="flex flex-col pb-6">
      {/* DEC-249: active-space chip — names the current space and opens the
          switcher. Tap the name to jump between trips and "Dia a dia". */}
      {trip && <SpaceSwitcherChip trip={trip} />}

      {/* DEC-293 (M03/M10): demo notice, storage-eviction risk and the one-time
          location-default disclosure now share a SINGLE rotating slot instead of
          stacking three banners on the first glance. See home-alerts.ts. */}
      <HomeAlertsCarousel slides={alertSlides} />

      {/* HEADER — DEC-084 (R-01): fixed at the top, content scrolls beneath.
          DEC-251: a Dia a dia has no day counter — it shows the space name with
          a "Dia a dia" eyebrow and the left tap opens the space switcher. */}
      {(ongoing || (activePhase && dayNum !== null)) && (
        <div
          className={`page-sticky-header ${scrolled ? 'is-scrolled' : ''} pt-6 pb-2 flex justify-between items-center`}
        >
          {ongoing ? (
            <button onClick={() => navigate('/spaces')} className="text-left btn-press">
              <p className="text-[11px] tracking-[0.15em] uppercase font-bold" style={{ color: '#C75B39aa' }}>
                {t('spaces.subtitle_ongoing')}
              </p>
              <h1 className="text-xl font-extrabold tracking-tight mt-1 text-on-surface">{trip.name}</h1>
            </button>
          ) : (
            /* DEC-060 (GAP-024): phase name navigates to the Viagem hub (DEC-288) */
            <button onClick={() => navigate('/viagem')} className="text-left btn-press">
              <p className="text-[11px] tracking-[0.15em] uppercase font-bold" style={{ color: '#C75B39aa' }}>
                {t('dashboard.day_counter', {
                  current: dayNum,
                  end: formatDate(activePhase!.endDate, "d 'de' MMMM"),
                })}
              </p>
              <h1 className="text-xl font-extrabold tracking-tight mt-1 text-on-surface">
                {activePhase!.name || trip.name}
              </h1>
            </button>
          )}
          {/* Redesign (G1): bell stays the prominent action (primary); the gear
              is the quieter Settings entry that replaces the old "Mais" tab. */}
          <div className="flex items-center gap-2">
            {/* D02 · DEC-307: a discreet, always-visible doorway to the discovery
                hub. E05 · DEC-325: on first run (the hub never opened, so the bell
                is empty anyway) it grows into a LABELLED "Descobrir" CTA that calls
                the user to explore, and the bell is hidden until the hub is opened
                once — then it reverts to the compact icon + bell below. */}
            {showDiscoverNudge ? (
              <button
                onClick={handleOpenDiscover}
                className="btn-press flex items-center gap-1.5 h-10 pl-3 pr-4 rounded-full"
                style={{ background: 'var(--primary)' }}
                aria-label={t('discover.first_run_cta')}
              >
                <Icon name="travel_explore" size={18} style={{ color: 'var(--surface)' }} />
                <span className="text-xs font-extrabold" style={{ color: 'var(--surface)' }}>
                  {t('discover.first_run_cta')}
                </span>
              </button>
            ) : (
              <button
                onClick={handleOpenDiscover}
                className="btn-press"
                aria-label={t('discover.title')}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--surface-container)' }}
                >
                  <Icon name="travel_explore" size={20} className="text-on-surface-dim" />
                </div>
              </button>
            )}
            {/* DEC-090 (R-08): bell opens the notifications center — never /shared.
                Hidden during the first-run discover nudge (it has nothing to show
                yet) so the call to explore stands alone. */}
            {!showDiscoverNudge && (
              <button
                onClick={() => navigate('/notifications')}
                className="relative btn-press"
                aria-label={t('notifications.title')}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--surface-container)' }}
                >
                  <Icon name="notifications" size={20} className="text-primary" />
                </div>
                {notifications.length > 0 && (
                  <div
                    className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--primary)' }}
                  >
                    <span className="text-[9px] font-extrabold" style={{ color: 'var(--surface)' }}>
                      {notifications.length}
                    </span>
                  </div>
                )}
              </button>
            )}
            <button
              onClick={() => navigate('/settings')}
              className="btn-press"
              aria-label={t('settings.title')}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: 'var(--surface-container)' }}
              >
                <Icon name="settings" size={20} className="text-on-surface-dim" />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Active live split — "a saída de bar" you can walk back into. Sits above
          every other card (simple AND complete) so a running division is the
          first thing you see; renders nothing when none is live. */}
      <ActiveSplitHomeCard />

      {/* DEC-251: a Dia a dia owns its own month-based home (no countdown, no
          phases, no per-day allowance) — it precedes both simple and complete. */}
      {ongoing ? (
        <OngoingHome
          model={model}
          trip={trip}
          transactions={transactions}
          onSetMonthlyCap={handleSetMonthlyCap}
        />
      ) : isSimpleMode ? (
        <>
          <SimpleHome model={model} trip={trip} />
          {/* M22: adaptive reveal — discreet, dismissible, shown once */}
          {offerReveal && (
            <SimpleRevealCard onAccept={handleRevealAccept} onDismiss={handleRevealDismiss} />
          )}
        </>
      ) : (
        <>
          {/* DEC-119 (R-10): configurable home screen — order + visibility */}
          <DashboardCards
            model={model}
            trip={trip}
            settings={settings}
            onOpenConfirmSheet={() => setConfirmSheetOpen(true)}
            onConfigCard={setConfigCardId}
            onPostponeEvent={handlePostponeEvent}
            onStartEvent={handleStartEvent}
            onEndEvent={handleEndEvent}
            onInsightTap={handleInsightTap}
            onSelectCheckIn={handleSelectCheckIn}
            onOpenHeroBreakdown={() => setHeroBreakdownOpen(true)}
            onEditSavingsGoal={() => setSavingsGoalOpen(true)}
            onPiggyWithdraw={handlePiggyWithdraw}
          />

          {/* DEC-119 (R-10): thin edge-to-edge entry when cards are hidden */}
          {hiddenCardCount > 0 && (
            <button
              onClick={() => navigate('/settings/dashboard')}
              className="mt-5 w-full py-2.5 rounded-xl flex items-center justify-center gap-2 btn-press"
              style={{ background: 'var(--surface-container)', border: '1px dashed var(--border-faint)' }}
            >
              <Icon name="visibility_off" size={14} className="text-on-surface-faint" />
              <span className="text-xs font-semibold text-on-surface-dim">
                {t('dashboard.hidden_cards_entry', { count: hiddenCardCount })}
              </span>
            </button>
          )}
        </>
      )}

      <DashboardSheets
        model={model}
        trip={trip}
        confirmSheetOpen={confirmSheetOpen}
        onCloseConfirm={() => setConfirmSheetOpen(false)}
        shareDrafts={shareDrafts}
        setShareDrafts={setShareDrafts}
        onResolveShare={handleResolveShare}
        detailInsight={detailInsight}
        onCloseDetail={() => setDetailInsight(null)}
        configCardId={configCardId}
        onCloseConfig={() => setConfigCardId(null)}
        onHideCard={handleHideCard}
        onTogglePairCard={handleTogglePairCard}
        onTogglePinCard={handleTogglePinCard}
        pairedCards={settings.dashboardPairedCards}
        pinnedCards={settings.dashboardPinnedCards}
        heroBreakdownOpen={heroBreakdownOpen}
        onCloseHeroBreakdown={() => setHeroBreakdownOpen(false)}
        savingsGoalOpen={savingsGoalOpen}
        savingsGoalCents={settings.savingsGoalCents ?? null}
        onCloseSavingsGoal={() => setSavingsGoalOpen(false)}
        onSaveSavingsGoal={handleSaveSavingsGoal}
        phaseLeftover={isSimpleMode || ongoing ? null : model.phaseLeftover}
        leftoverTargets={model.globalPoolSummaries.map((g) => g.pool)}
        onPhaseLeftover={handlePhaseLeftover}
        eventLeftover={ongoing ? null : model.eventLeftover}
        onEventLeftover={handleEventLeftover}
        valueSuggestion={isSimpleMode || ongoing ? null : model.valueSuggestion}
        onValueSuggestion={handleValueSuggestion}
        tripPriors={isSimpleMode || ongoing ? null : model.tripPriors}
        onTripPriors={handleTripPriors}
      />
    </div>
  );
}
