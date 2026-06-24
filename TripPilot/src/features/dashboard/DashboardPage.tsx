import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { useScrolled } from '@/hooks/useScrolled';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDate, localDateString } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import { isIosDevice, isStandaloneDisplayMode } from '@/utils/platform';
import { isNativeApp } from '@/utils/native/platform';
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
  applyValueSuggestion,
  dismissValueSuggestion,
  saveTripTemplate,
  markTripPriorsHandled,
} from '@/domain/orchestrators';
import { buildTripTemplate } from '@/domain/templates';
import { showToast } from '@/components/Toast';
import { createDailyCheckIn } from '@/domain/check-in';
import type { DashboardInsight } from '@/domain/insights';
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
import { ActiveSplitHomeCard } from '@/features/split/ActiveSplitHomeCard';
import { SpaceSwitcherChip } from '@/features/spaces/SpaceSwitcherChip';

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

  return (
    <div className="flex flex-col pb-6">
      {/* DEC-249: active-space chip — names the current space and opens the
          switcher. Tap the name to jump between trips and "Dia a dia". */}
      {trip && <SpaceSwitcherChip trip={trip} />}

      {/* DEMO BANNER */}
      {settings.isDemo && (
        <div className="mt-4 p-3 rounded-xl bg-warning/10 border border-warning/30">
          <p className="text-xs font-semibold text-warning">{t('demo.banner')}</p>
        </div>
      )}

      {/* FB-03 (DEC-265): one-time transparent notice that a new install ships
          with location tagging ON. Skipped for the demo and for every existing
          install (acknowledged backfills true on read). */}
      {!settings.isDemo &&
        settings.locationCaptureEnabled &&
        settings.locationDefaultNoticeAcknowledged === false && (
          <LocationDefaultNoticeCard
            onAcknowledge={handleAckLocationNotice}
            onOpenSettings={handleOpenLocationSettings}
          />
        )}

      {/* STORAGE NOT PERSISTENT (R5-03 / R6-13 / BUG-002): eviction risk warning.
          iOS Safari cannot grant persistence programmatically — the honest
          advice there is installing to the home screen; installed iOS PWAs are
          already protected, so no alarm at all. */}
      {showStorageWarning && (() => {
        // BUG-002: with real data to lose off iOS, make the CTA a direct, urgent
        // call to back up now rather than a soft pointer to Settings.
        const strongBackupCta = !isIosDevice() && transactions.length > 0;
        return (
          <button
            onClick={() => navigate(strongBackupCta ? '/settings/backup' : '/settings')}
            className="mt-4 p-3 rounded-xl flex items-center gap-2.5 btn-press text-left"
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
        );
      })()}

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
            {/* DEC-090 (R-08): bell opens the notifications center — never /shared */}
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
            onInsightTap={handleInsightTap}
            onSelectCheckIn={handleSelectCheckIn}
            onOpenHeroBreakdown={() => setHeroBreakdownOpen(true)}
            onEditSavingsGoal={() => setSavingsGoalOpen(true)}
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
        valueSuggestion={isSimpleMode || ongoing ? null : model.valueSuggestion}
        onValueSuggestion={handleValueSuggestion}
        tripPriors={isSimpleMode || ongoing ? null : model.tripPriors}
        onTripPriors={handleTripPriors}
      />
    </div>
  );
}
