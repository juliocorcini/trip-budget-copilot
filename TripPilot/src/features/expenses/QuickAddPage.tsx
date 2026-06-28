import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { useAppData, notifyAppDataChanged } from '@/hooks/useAppData';
import { useWalletTracking } from '@/hooks/useWalletTracking';
import {
  createExpenseTransaction,
  suggestFromDescription,
  getFrequentExpenses,
  getCategoryTypicalCents,
  detectAmountAnomaly,
  parseVoiceExpense,
} from '@/domain/transactions';
import type { ExpenseSuggestion } from '@/domain/transactions';
import { resolvePayerExpense, collectSplitNotifyTargets } from '@/domain/splitting';
import { placeToTransactionFields, placesEqual } from '@/domain/location';
import { stampExpenseLocation } from '@/features/location/stamp-expense-location';
import { appSettingsRepository, attachmentRepository } from '@/data/repositories';
import type { ParticipantShare } from '@/domain/types/participant-share';
import type { Transaction } from '@/domain/types/transaction';
import { resolveActivePhase, toSafeIsoDate } from '@/domain/dates';
import {
  toCents,
  fromCents,
  formatMoney,
  formatAnchorHint,
  evaluateAmountExpression,
  convertToBaseCents,
  resolveFrozenRate,
  listSelectableCurrencies,
  parseLocaleNumber,
} from '@/domain/money';
import { getAvailablePoolsForPhase, calculateFreeToSpend } from '@/domain/budget';
import { selectAttributableEvents } from '@/domain/planning';
import { filterTransactionsByPool } from '@/domain/transactions';
import {
  registerExpense,
  transferBetweenWallets,
  withdrawCash,
  softDeleteTransactionsBatch,
  deliverManualSplitDebts,
} from '@/domain/orchestrators';
import { requestPersistentStorage } from '@/utils/pwa';
import {
  isSpeechRecognitionSupported,
  startVoiceCapture,
  type VoiceCaptureController,
} from '@/utils/speech-recognition';
import { recordExpenseForSnapshot } from '@/utils/emergency-snapshot';
import { recordDailyLocalSnapshot } from '@/utils/local-snapshot';
import { parseSharedExpense } from '@/domain/sharing';
import { v4 as uuidv4 } from 'uuid';
import { compressImageFile, type CompressedImage } from '@/utils/image/compress';
import { newAttachment } from '@/features/attachments/attachment-utils';
import { getCategoryIcon } from '@/utils/category-icons';
import { Icon } from '@/components/Icon';
import { BottomSheet } from '@/components/BottomSheet';
import { DataErrorScreen } from '@/components/DataErrorScreen';
import { showToast } from '@/components/Toast';
import type { ShareType, CurrentPlace } from '@/domain/types/common';
import type { AppSettings } from '@/domain/types/app-settings';
import type { Participant } from '@/domain/types/participant';
import { SplitShareNudgeSheet } from '@/features/shared/SplitShareNudgeSheet';
import { SplitExplainer } from '@/features/shared/SplitExplainer';
import { AddParticipantSheet } from '@/features/participants/AddParticipantSheet';
import { openAssistant } from '@/features/assistant/assistant-bus';
import { PlaceField } from '@/features/location/PlaceField';
import {
  takeAssistantQuickAddDraft,
  resolveDraftSplitState,
  isoToDatetimeLocal,
  type AssistantQuickAddDraft,
} from '@/features/assistant/assistant-quickadd-draft';

const CATEGORY_KEYS = [
  'bar',
  'restaurant',
  'market',
  'transport',
  'outing',
  'entertainment',
  'health',
  'accommodation',
  'other',
] as const;

export function QuickAddPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { trip, phases, pools, links, envelopes, transactions, wallets, participants, occurrences, plannedPurchases, settings, error, reload, retry } =
    useAppData();
  // GATE 5 (D10): hide the "de onde saiu?" wallet question for a single-source
  // traveler — the expense silently lands on the default wallet.
  const walletTrackingActive = useWalletTracking();

  const initialCategory = searchParams.get('cat') ?? 'other';
  const txType = searchParams.get('type') ?? 'expense';
  const isTransfer = txType === 'transfer';
  const isWithdrawal = txType === 'withdrawal';
  const isTransferLike = isTransfer || isWithdrawal;

  // E6 (M21): Web Share Target — the OS shares into TripPilot as a GET to
  // /quick-add?title&text&url. We only PRE-FILL (never auto-save — ÂNCORA 13).
  const sharedIntake = parseSharedExpense({
    title: searchParams.get('title'),
    text: searchParams.get('text'),
    url: searchParams.get('url'),
  });

  // R6-21: the simulator CTA pre-fills the amount (?amount=); a Share Target
  // intent pre-fills it from the shared text instead.
  const [amount, setAmount] = useState(() => {
    const prefill = searchParams.get('amount');
    if (prefill) {
      const parsed = parseFloat(prefill);
      if (!Number.isNaN(parsed) && parsed > 0) return String(parsed);
    }
    return sharedIntake.amount !== null ? String(sharedIntake.amount) : '';
  });
  const [description, setDescription] = useState(() => sharedIntake.description);
  const [category, setCategory] = useState(initialCategory);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [targetWalletId, setTargetWalletId] = useState<string | null>(null);
  const [poolId, setPoolId] = useState<string>('');
  // GAP-027: optional retroactive date/time (empty = now)
  const [customDate, setCustomDate] = useState('');
  const [saving, setSaving] = useState(false);
  // P2 (UX audit §4.3 / G2): progressive disclosure — the typical expense is
  // amount + category + description; date/place/fund/wallet/photos collapse here.
  const [showDetails, setShowDetails] = useState(false);
  // DEC-386 (G1): the event this spend is attributed to (null = none). Pre-
  // suggested by date inference (L-ATTRIBUTION refinement) but always asked — the
  // user confirms or opts out, never auto-decided (Â-ATTRIBUTION).
  const [attributedOccurrenceId, setAttributedOccurrenceId] = useState<string | null>(null);
  const eventAttributionTouchedRef = useRef(false);

  // E9 (M8/M9): expense currency (default = trip base) + the conversion rate
  // (seeded from the frozen snapshot, editable as a manual rate).
  const [currency, setCurrency] = useState<string | null>(null);
  const [manualRate, setManualRate] = useState('');

  const [isShared, setIsShared] = useState(false);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  // DEC-123 (D-R4-J): "Who paid?" is a first-level question (null = me).
  const [paidById, setPaidById] = useState<string | null>(null);
  // DEC-123: when someone else paid — they paid everything for me OR we split.
  const [otherPaidSplit, setOtherPaidSplit] = useState(false);
  const [splitMode, setSplitMode] = useState<ShareType>('equal');
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [showZeroBudgetConfirm, setShowZeroBudgetConfirm] = useState(false);
  // M5: confirm an amount far above the category typical (never blocks — DEC-053).
  const [showAnomalyConfirm, setShowAnomalyConfirm] = useState(false);
  // M4: offer to duplicate a transport expense as a round trip.
  const [showRoundTrip, setShowRoundTrip] = useState(false);
  // B5: after a split, prompt to send each debtor their shared link.
  const [splitNudge, setSplitNudge] = useState<Participant[]>([]);
  // DL-5: per-debtor owed amount (cents), so the nudge can offer a "Lembrar"
  // (cobrar) message with the right value right after the split is committed.
  const [splitNudgeAmounts, setSplitNudgeAmounts] = useState<Map<string, number>>(new Map());
  // M11: optional voice capture — only offered when the browser supports it.
  const [listening, setListening] = useState(false);
  // DEC-365 (B1): hold the live capture so we can hard-release the mic on a
  // second tap or on unmount (Web Speech leaves the iOS indicator lit otherwise).
  const voiceControllerRef = useRef<VoiceCaptureController | null>(null);
  useEffect(() => {
    return () => {
      voiceControllerRef.current?.cancel();
      voiceControllerRef.current = null;
    };
  }, []);

  // DEC-246 (AI Quick Entry escape hatch): a fully pre-filled draft handed over
  // by the assistant sheet for the heavy cases (foreign currency, custom split,
  // photos, careful review). Read ONCE (lazy init clears the slot) and applied
  // after data loads so nothing the AI captured is lost on the way to the form.
  const [aiDraft] = useState<AssistantQuickAddDraft | null>(() => takeAssistantQuickAddDraft());
  const aiDraftAppliedRef = useRef(false);

  // E8 (M2/M3): opt-in location — a "sticky" place reused across expenses. The
  // selector UI/GPS/nearby machinery lives in <PlaceField> (D-BUG-08); QuickAdd
  // only owns the chosen place (for the save + sticky persistence below).
  const locationEnabled = !!settings?.locationCaptureEnabled && !isTransferLike;
  const [place, setPlace] = useState<CurrentPlace | null>(null);

  // Inherit the remembered place once settings load (until GPS says otherwise).
  useEffect(() => {
    setPlace((prev) => prev ?? settings?.currentPlace ?? null);
  }, [settings?.currentPlace]);

  // R3-H: open on the last-used category (sticky) so capture starts on the most
  // likely choice instead of always "other". Applied once, after settings load,
  // and only when the URL didn't pin a category (?cat=) or a transfer (?type=) —
  // so it never fights an explicit intent or a later manual change.
  const stickyCategoryAppliedRef = useRef(false);
  useEffect(() => {
    if (stickyCategoryAppliedRef.current || !settings) return;
    stickyCategoryAppliedRef.current = true;
    if (searchParams.get('cat') || searchParams.get('type')) return;
    const last = settings.lastExpenseCategory;
    if (last && (CATEGORY_KEYS as readonly string[]).includes(last)) {
      setCategory(last);
    }
  }, [settings, searchParams]);

  // BUG-002 (R6-02): never fall back to phases[0] — resolveActivePhase picks
  // the nearest phase (current, else last past, else first future).
  const currentPhase = resolveActivePhase(phases);
  const defaultWallet = wallets.find((w) => w.isDefault);

  // Withdrawal pulls from a non-cash wallet into a cash wallet (Core Rule 3).
  const defaultSourceWallet = isWithdrawal
    ? (wallets.find((w) => w.isDefault && w.walletType !== 'cash') ??
       wallets.find((w) => w.walletType !== 'cash') ??
       defaultWallet)
    : defaultWallet;
  const effectiveSourceWalletId = walletId ?? defaultSourceWallet?.id ?? null;

  const cashWallets = wallets.filter((w) => w.walletType === 'cash');
  const targetCandidates = (isWithdrawal && cashWallets.length > 0 ? cashWallets : wallets).filter(
    (w) => w.id !== effectiveSourceWalletId,
  );
  const effectiveTargetWalletId =
    targetWalletId && targetCandidates.some((w) => w.id === targetWalletId)
      ? targetWalletId
      : targetCandidates.length === 1
        ? targetCandidates[0]!.id
        : null;

  const effectiveWalletId = walletId ?? defaultWallet?.id ?? null;

  // DEC-039/040: only pools linked to the active phase + global pools are
  // selectable; auto-select happens only with exactly one operational pool.
  const availablePools = currentPhase
    ? getAvailablePoolsForPhase(pools, links, currentPhase.id)
    : { operational: [], global: [], otherPhases: [], autoSelectedPoolId: null };
  // E02 (DEC-322): off-phase funds are selectable too (rendered as a labelled
  // secondary group), so a fund created for a future leg can receive a spend.
  const selectablePools = [
    ...availablePools.operational,
    ...availablePools.global,
    ...availablePools.otherPhases,
  ];
  const effectivePoolId =
    poolId && selectablePools.some((p) => p.id === poolId)
      ? poolId
      : (availablePools.autoSelectedPoolId ?? '');

  const selectedPool = selectablePools.find((p) => p.id === effectivePoolId) ?? null;
  // P2: hide the fund picker when there's nothing to choose (0 or 1 pool). When
  // multiple pools force a choice, the details block opens so it's never hidden.
  const requiresFundChoice = !isTransferLike && selectablePools.length > 1 && !effectivePoolId;
  const detailsOpen = showDetails || requiresFundChoice;
  const selectFund = (id: string) => {
    setPoolId(id);
    setShowDetails(true);
  };
  const selectedPoolFreeToSpendCents =
    selectedPool && currentPhase
      ? calculateFreeToSpend(
          selectedPool,
          envelopes.filter((e) => e.budgetPoolId === selectedPool.id),
          filterTransactionsByPool(transactions, selectedPool.id),
          links.filter((l) => l.budgetPoolId === selectedPool.id),
          currentPhase.id,
          occurrences,
          plannedPurchases,
        ).freeToSpendCents
      : null;

  const owner = participants.find((p) => p.isOwner) ?? null;
  const effectivePaidById = paidById ?? owner?.id ?? null;

  // DEC-386 (G1): the OPEN events whose interval contains the expense's day —
  // the date-inference set the attribution prompt is built from. Based on the
  // chosen date when set, otherwise today (UTC day, like the other "today" reads).
  const expenseDayIso = customDate
    ? toSafeIsoDate(customDate).slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const attributableEvents = useMemo(
    () => selectAttributableEvents(occurrences, expenseDayIso),
    [occurrences, expenseDayIso],
  );
  // L-ATTRIBUTION refinement (Julio): pre-suggest the LONE active event (date
  // inference) so the user just confirms; never auto-pick when ambiguous, and
  // drop a stale pick when the date moves out of the interval. Uses a functional
  // update so it never loops on its own state.
  useEffect(() => {
    setAttributedOccurrenceId((current) => {
      if (current !== null && !attributableEvents.some((e) => e.id === current)) return null;
      if (
        current === null &&
        !eventAttributionTouchedRef.current &&
        attributableEvents.length === 1
      ) {
        return attributableEvents[0]!.id;
      }
      return current;
    });
  }, [attributableEvents]);
  const selectAttributedEvent = (id: string | null): void => {
    eventAttributionTouchedRef.current = true;
    setAttributedOccurrenceId(id);
  };

  // DEC-246: apply the assistant draft once everything is loaded. setState in an
  // effect (not initializers) keeps it robust against an initial empty snapshot;
  // it reveals the details block so the pre-filled fund/wallet/place are visible.
  useEffect(() => {
    if (!aiDraft || aiDraftAppliedRef.current || !trip || !settings) return;
    aiDraftAppliedRef.current = true;
    // Pin the category so the sticky-category effect never overrides the AI's.
    stickyCategoryAppliedRef.current = true;

    if (aiDraft.amount > 0) setAmount(String(aiDraft.amount));
    if (aiDraft.currency) setCurrency(aiDraft.currency);
    if (aiDraft.category) setCategory(aiDraft.category);
    if (aiDraft.description) setDescription(aiDraft.description);
    if (aiDraft.date) {
      const local = isoToDatetimeLocal(aiDraft.date);
      if (local !== '') setCustomDate(local);
    }
    if (aiDraft.place) setPlace(aiDraft.place);
    if (aiDraft.poolId) setPoolId(aiDraft.poolId);
    if (aiDraft.walletId !== undefined) setWalletId(aiDraft.walletId);
    if (aiDraft.shareType) setSplitMode(aiDraft.shareType);

    if (owner) {
      const split = resolveDraftSplitState(aiDraft, owner.id);
      setPaidById(split.paidById);
      setOtherPaidSplit(split.otherPaidSplit);
      setSelectedParticipantIds(split.selectedParticipantIds);
      setIsShared(split.isShared);
    }
    setShowDetails(true);
  }, [aiDraft, trip, settings, owner]);
  const canSplit = !isTransferLike && participants.length > 1;
  // DEC-123: someone else paid — first-level state, independent of splitting.
  const otherPaid = owner !== null && effectivePaidById !== null && effectivePaidById !== owner.id;
  const wantsSplit = otherPaid ? otherPaidSplit : isShared;
  const payer = participants.find((p) => p.id === effectivePaidById) ?? null;
  const payerName = payer ? (payer.nickname ?? payer.name) : '';

  const toggleShared = () => {
    setIsShared((prev) => {
      const next = !prev;
      // DEC-378: turning sharing ON pre-selects only the OWNER (plus the payer
      // when someone else already paid) — never everyone. With many people (40+)
      // marking all was hostile; the user picks who actually shared.
      if (next && selectedParticipantIds.length === 0 && owner) {
        const seed = [owner.id];
        if (effectivePaidById && effectivePaidById !== owner.id) seed.push(effectivePaidById);
        setSelectedParticipantIds(seed);
      }
      return next;
    });
  };

  const selectPayer = (id: string) => {
    setPaidById(id);
    // DEC-123: simple case prefilled — splitting with the payer needs no setup.
    if (owner && id !== owner.id && selectedParticipantIds.length < 2) {
      setSelectedParticipantIds([owner.id, id]);
    }
  };

  const toggleParticipant = (id: string) => {
    setSelectedParticipantIds((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id],
    );
  };

  // FB-06/24 (DEC-259): add a participant inline — the overlay never unmounts
  // this form, so the typed expense survives. The new/reused person is refreshed
  // into app data and pre-selected so they're immediately splittable.
  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const handleParticipantAdded = async (p: Participant) => {
    await reload();
    setSelectedParticipantIds((prev) => (prev.includes(p.id) ? prev : [...prev, p.id]));
    showToast(t('participants.added_toast', { name: p.nickname ?? p.name }), 'success');
  };

  // M1: the amount field accepts a calculator expression ("12+3,50").
  const evaluatedAmount = evaluateAmountExpression(amount);
  const amountCentsPreview =
    evaluatedAmount !== null && evaluatedAmount > 0 ? toCents(evaluatedAmount) : 0;

  // E9 (M8/M9): multi-currency — the entered amount is in `selectedCurrency`;
  // a foreign one is converted to base via the frozen/manual rate. The base
  // value drives the budget, anomaly and anchor (everything else is in base).
  const baseCurrency = trip?.baseCurrency ?? '';
  const selectedCurrency = currency ?? baseCurrency;
  const isForeignCurrency =
    !isTransferLike && selectedCurrency !== '' && selectedCurrency !== baseCurrency;
  const currencyOptions = listSelectableCurrencies(baseCurrency, [
    ...wallets.map((w) => w.currency),
    ...Object.keys(settings?.frozenRates?.ratesToBase ?? {}),
  ]);
  const frozenRate = resolveFrozenRate(settings?.frozenRates ?? null, selectedCurrency, baseCurrency);
  const manualRateValue = parseLocaleNumber(manualRate);
  const effectiveRate = isForeignCurrency ? manualRateValue : null;
  const needsRate = isForeignCurrency && (effectiveRate === null || effectiveRate <= 0);
  const baseAmountCentsPreview =
    effectiveRate !== null && effectiveRate > 0
      ? convertToBaseCents(amountCentsPreview, effectiveRate)
      : amountCentsPreview;

  // E9 (M9): seed the rate field with the frozen snapshot (editable); the base
  // currency needs none. Re-seeds only when the chosen currency changes.
  useEffect(() => {
    if (!isForeignCurrency) {
      setManualRate('');
      return;
    }
    setManualRate(frozenRate !== null ? String(Number(frozenRate.toPrecision(6))) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCurrency, isForeignCurrency]);

  // M2/M3/M5: capture helpers derived purely from existing transactions.
  const frequentExpenses = !isTransferLike ? getFrequentExpenses(transactions) : [];
  const descriptionSuggestion = !isTransferLike
    ? suggestFromDescription(transactions, description)
    : null;
  const categoryTypicalCents = !isTransferLike ? getCategoryTypicalCents(transactions, category) : 0;
  // E9: compare the base value — the historical typical is in base currency.
  const isAmountAnomaly =
    !isTransferLike && detectAmountAnomaly(baseAmountCentsPreview, categoryTypicalCents);

  const applySuggestion = (suggestion: ExpenseSuggestion) => {
    setCategory(suggestion.category);
    setDescription(suggestion.description);
    setAmount(String(fromCents(suggestion.amountCents)));
  };

  // M11: speak the expense — fills amount + description; the user reviews it.
  const voiceSupported = !isTransferLike && isSpeechRecognitionSupported();
  const handleVoiceCapture = () => {
    // DEC-365 (B1): a second tap while listening cancels + releases the mic NOW.
    if (listening) {
      voiceControllerRef.current?.cancel();
      voiceControllerRef.current = null;
      setListening(false);
      return;
    }
    setListening(true);
    voiceControllerRef.current = startVoiceCapture(i18n.language, {
      onResult: (transcript) => {
        const parsed = parseVoiceExpense(transcript);
        if (parsed.amountCents !== null && parsed.amountCents > 0) {
          setAmount(String(fromCents(parsed.amountCents)));
        }
        if (parsed.description !== '') setDescription(parsed.description);
      },
      onError: () => {
        voiceControllerRef.current = null;
        setListening(false);
      },
      onEnd: () => {
        voiceControllerRef.current = null;
        setListening(false);
      },
    });
    if (!voiceControllerRef.current) setListening(false);
  };

  // DEC-128: mental anchor while typing — "€20 ≈ R$ 124".
  const anchorHint =
    settings && trip && baseAmountCentsPreview > 0
      ? formatAnchorHint(
          baseAmountCentsPreview,
          { anchorCurrency: settings.anchorCurrency, anchorRatePer1: settings.anchorRatePer1 },
          trip.baseCurrency,
        )
      : null;

  const customSumCents = selectedParticipantIds.reduce((sum, pid) => {
    const value = parseFloat((customAmounts[pid] ?? '').replace(',', '.'));
    return sum + (Number.isNaN(value) ? 0 : Math.round(value * 100));
  }, 0);
  const customRemainingCents = amountCentsPreview - customSumCents;

  const previewShareCents =
    wantsSplit && selectedParticipantIds.length > 0 && owner && selectedParticipantIds.includes(owner.id)
      ? splitMode === 'equal'
        ? Math.round(amountCentsPreview / selectedParticipantIds.length)
        : (() => {
            const value = parseFloat((customAmounts[owner.id] ?? '').replace(',', '.'));
            return Number.isNaN(value) ? 0 : Math.round(value * 100);
          })()
      : null;

  const canSaveTransferLike =
    !isTransferLike ||
    (effectiveSourceWalletId !== null &&
      effectiveTargetWalletId !== null &&
      effectiveSourceWalletId !== effectiveTargetWalletId);

  // DEC-206 (G1): photos picked during creation have no transaction id yet, so
  // we compress them now, buffer them, and persist them once the expense is saved.
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [pendingImages, setPendingImages] = useState<{ id: string; image: CompressedImage }[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);

  const handleAddPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setPhotoBusy(true);
    try {
      const compressed = await compressImageFile(file);
      setPendingImages((prev) => [...prev, { id: uuidv4(), image: compressed }]);
    } catch {
      showToast(t('attachments.add_failed'), 'danger');
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePendingPhoto = (id: string) =>
    setPendingImages((prev) => prev.filter((entry) => entry.id !== id));

  // Builds the expense transaction + shares from the current form state. Reading
  // it on demand lets M4 register an identical return trip with a fresh id.
  const buildExpense = () => {
    const amountCents = toCents(evaluatedAmount!);
    // E9 (M9): keep the original currency/value; store the base equivalent + rate
    // when foreign so every base-currency aggregation stays correct.
    const baseCents =
      isForeignCurrency && effectiveRate !== null
        ? convertToBaseCents(amountCents, effectiveRate)
        : amountCents;
    // DEC-386 (G1): only attribute to an event that still matches the day (guards
    // a date changed right before save); createExpenseTransaction enforces the
    // event-XOR-session invariant.
    const occurrenceId = attributableEvents.some((e) => e.id === attributedOccurrenceId)
      ? attributedOccurrenceId
      : null;
    const tx = createExpenseTransaction({
      tripId: trip!.id,
      phaseId: currentPhase!.id,
      budgetPoolId: effectivePoolId,
      walletId: effectiveWalletId,
      amountCents,
      currency: isForeignCurrency ? selectedCurrency : trip!.baseCurrency,
      baseCurrencyAmountCents: baseCents,
      exchangeRate: isForeignCurrency ? effectiveRate : null,
      category,
      description: description || t(`categories.${category}` as never),
      date: customDate ? toSafeIsoDate(customDate) : undefined,
      occurrenceId,
      ...placeToTransactionFields(place),
    });

    const splitActive =
      canSplit && wantsSplit && selectedParticipantIds.length >= 2 && effectivePaidById !== null;
    // DEC-114/123: the payer flow applies whenever someone else paid (even
    // without splitting — truth-table row 4) or a split is active.
    const payerFlowActive =
      owner !== null && effectivePaidById !== null && (otherPaid || splitActive);

    let finalShares: ParticipantShare[] = [];
    if (payerFlowActive) {
      const customAmountsCents = Object.fromEntries(
        selectedParticipantIds.map((pid) => {
          const value = parseFloat((customAmounts[pid] ?? '').replace(',', '.'));
          return [pid, Number.isNaN(value) ? 0 : Math.round(value * 100)];
        }),
      );
      const resolution = resolvePayerExpense({
        transactionId: tx.id,
        amountCents,
        ownerId: owner!.id,
        payerId: effectivePaidById!,
        didSplit: splitActive,
        participantIds: selectedParticipantIds,
        shareType: splitMode,
        customAmountsCents,
        // DEC-241: only paired devices stay pending; offline friends owe now.
        connectedParticipantIds: participants
          .filter((p) => p.linkedActorId !== null)
          .map((p) => p.id),
      });
      tx.isShared = resolution.isShared;
      tx.paidByParticipantId = effectivePaidById;
      tx.personalCostCents = resolution.personalCostCents;
      // When someone else paid, no money left the user's wallets (DEC-114).
      if (!resolution.movesOwnerWallet) tx.walletId = null;
      finalShares = resolution.shares;
    }

    return { transaction: tx, shares: finalShares };
  };

  const persistExpense = async (): Promise<{ transaction: Transaction; shares: ParticipantShare[] }> => {
    const { transaction, shares } = buildExpense();
    await registerExpense({ transaction, shares });
    // DEC-377 (G3, Â-CONSISTENT-SPLIT): a manual split with a CONNECTED person
    // must deliver the slice as an accept-first debt — exactly like "Dividir
    // conta" (DEC-366) — instead of dying as a local pending share. Best-effort
    // in the BACKGROUND so the #1 action never waits (A5); idempotent by a
    // stable debtId so a re-save never duplicates. The planner sends only when
    // the OWNER fronted the money (a real "you owe me").
    if (owner && transaction.isShared) {
      void deliverManualSplitDebts({
        transactionId: transaction.id,
        ownerId: owner.id,
        payerId: transaction.paidByParticipantId ?? owner.id,
        currency: transaction.currency,
        description: transaction.description,
        occurredAt: transaction.date ?? null,
        shares,
        participants,
      });
    }
    // DEC-206 (G1): persist photos buffered during creation, now that the
    // transaction has an id. Cleared so a round-trip persist never reattaches them.
    if (pendingImages.length > 0) {
      await Promise.all(
        pendingImages.map((entry) =>
          attachmentRepository.add(newAttachment(entry.image, { transactionId: transaction.id })),
        ),
      );
      setPendingImages([]);
    }
    // Persist sticky preferences in a SINGLE write: the place (E8/M3) and the
    // last category (R3-H), so the next expense inherits both.
    const settingsPatch: Partial<AppSettings> = {};
    if (place !== null && !placesEqual(place, settings?.currentPlace ?? null)) {
      settingsPatch.currentPlace = place;
    }
    if (category && category !== (settings?.lastExpenseCategory ?? null)) {
      settingsPatch.lastExpenseCategory = category;
    }
    if (Object.keys(settingsPatch).length > 0) {
      await appSettingsRepository.update(settingsPatch);
    }
    // DEC-367 (G8): when the chosen place carries no coordinates (a fast save
    // with "detalhes" closed), stamp the point in the background — the save
    // returns instantly and the expense still lands on the map.
    if (locationEnabled && transaction.latitude === null) {
      void stampExpenseLocation(transaction, detailsOpen);
    }
    // GAP-R2-005: idempotent — ensures storage persistence after the first expense.
    requestPersistentStorage();
    // BUG-002: refresh the emergency snapshot every few expenses (best-effort).
    void recordExpenseForSnapshot();
    // E6 (M14): capture at most one daily restore point (best-effort, deduped).
    void recordDailyLocalSnapshot();
    return { transaction, shares };
  };

  // The app's #1 action used to be silent. Confirm what was registered (in base
  // currency, mirroring the hero) with a one-tap undo — the dashboard the user
  // lands on already shows the resulting "free today", so this names the action.
  // N8: the success toast now carries the confirmation haptic (native-aware).
  const confirmExpenseSaved = (txId: string, baseCurrencyAmountCents: number) => {
    if (!trip) return;
    showToast(
      t('expenses.saved_toast', { amount: formatMoney(baseCurrencyAmountCents, trip.baseCurrency) }),
      'success',
      {
        actionLabel: t('common.undo'),
        durationMs: 5000,
        onTap: () => {
          void softDeleteTransactionsBatch([txId]).then(() => {
            notifyAppDataChanged();
            showToast(t('common.undo_done'), 'info');
          });
        },
      },
    );
  };

  const finishAndGoHome = async () => {
    await reload();
    navigate('/dashboard');
  };

  // Actually registers the expense (after any confirmation sheets are cleared).
  const commitExpense = async () => {
    if (!trip || !currentPhase || evaluatedAmount === null || evaluatedAmount <= 0) return;
    setShowAnomalyConfirm(false);
    setShowZeroBudgetConfirm(false);
    setSaving(true);
    try {
      const { transaction: tx, shares } = await persistExpense();
      confirmExpenseSaved(tx.id, tx.baseCurrencyAmountCents);
      // M4: a transport expense offers to log the return trip too.
      if (category === 'transport') {
        setShowRoundTrip(true);
        return;
      }
      // B5: if this split gave someone a slice, nudge to send their link before
      // leaving — the slice only reaches the other phone when they open it.
      const notifyTargets = owner ? collectSplitNotifyTargets(shares, participants, owner.id) : [];
      if (notifyTargets.length > 0) {
        // DL-5: "Lembrar" (cobrar) only makes sense when the OWNER is the payer —
        // then the slices are debts to me. If someone else paid, skip amounts so
        // the nudge offers only "Enviar link" (always valid), never a wrong charge.
        const amounts = new Map<string, number>();
        if (effectivePaidById === owner?.id) {
          for (const share of shares) {
            amounts.set(share.participantId, (amounts.get(share.participantId) ?? 0) + share.shareAmountCents);
          }
        }
        setSplitNudgeAmounts(amounts);
        setSplitNudge(notifyTargets);
        return;
      }
      await finishAndGoHome();
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!trip || !currentPhase || evaluatedAmount === null || evaluatedAmount <= 0) return;

    // Transfers and withdrawals move money between wallets and never touch the
    // budget (budgetPoolId/personalCostCents = null — Core Rule 3).
    if (isTransferLike) {
      if (!canSaveTransferLike) return;
      setSaving(true);
      try {
        const input = {
          tripId: trip.id,
          phaseId: currentPhase.id,
          sourceWalletId: effectiveSourceWalletId!,
          targetWalletId: effectiveTargetWalletId!,
          amountCents: toCents(evaluatedAmount),
          currency: trip.baseCurrency,
          description:
            description || (isWithdrawal ? t('fab.register_withdrawal') : t('fab.register_transfer')),
        };
        await (isWithdrawal ? withdrawCash(input) : transferBetweenWallets(input));
        // Money moved between wallets used to be silent — confirm what happened
        // (the success toast carries the haptic).
        showToast(
          t(isWithdrawal ? 'expenses.withdrawal_saved_toast' : 'expenses.transfer_saved_toast', {
            amount: formatMoney(input.amountCents, trip.baseCurrency),
          }),
          'success',
        );
        await finishAndGoHome();
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!effectivePoolId) return;
    // E9 (M9): a foreign expense needs a positive conversion rate before saving.
    if (needsRate) return;

    // M5: confirm an amount far above the category typical (never blocks — DEC-053).
    if (isAmountAnomaly) {
      setShowAnomalyConfirm(true);
      return;
    }
    // DEC-053(a): zero/negative budget never blocks — it asks for confirmation.
    if (selectedPoolFreeToSpendCents !== null && selectedPoolFreeToSpendCents <= 0) {
      setShowZeroBudgetConfirm(true);
      return;
    }

    await commitExpense();
  };

  // M5: after confirming the anomaly, still honor the zero-budget confirmation.
  const confirmAfterAnomaly = async () => {
    setShowAnomalyConfirm(false);
    if (selectedPoolFreeToSpendCents !== null && selectedPoolFreeToSpendCents <= 0) {
      setShowZeroBudgetConfirm(true);
      return;
    }
    await commitExpense();
  };

  // M4: register the return trip (identical expense, fresh id) then leave.
  const handleRoundTripYes = async () => {
    setShowRoundTrip(false);
    setSaving(true);
    try {
      const { transaction: tx } = await persistExpense();
      confirmExpenseSaved(tx.id, tx.baseCurrencyAmountCents);
      await finishAndGoHome();
    } finally {
      setSaving(false);
    }
  };

  const handleRoundTripNo = async () => {
    setShowRoundTrip(false);
    await finishAndGoHome();
  };

  // DEC-109: failed DB read shows recovery instead of silently rendering nothing.
  if (error) return <DataErrorScreen onRetry={retry} />;

  if (!trip || !settings?.onboardingCompleted) return null;

  // P2: a subtle dot on the collapsed "Detalhes" toggle when anything inside was
  // set, so a customized expense never hides its details silently.
  const detailsCustomized =
    !isTransferLike &&
    (customDate !== '' ||
      place !== null ||
      pendingImages.length > 0 ||
      (selectablePools.length > 1 && effectivePoolId !== '') ||
      (walletTrackingActive && walletId !== null));

  return (
    <div className="max-w-[430px] mx-auto flex flex-col gap-4 px-5">
      <div className="flex items-center justify-between pt-2">
        <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface">
          {isTransfer ? t('fab.register_transfer') : isWithdrawal ? t('fab.register_withdrawal') : t('expenses.add')}
        </h1>
        {/* FB-09 (DEC-258): the manual form's shortcut to the AI — "prefer to just
            tell it?". Opens the global assistant overlay (this form stays mounted). */}
        {settings?.aiQuickEntryEnabled ?? true ? (
          <button
            onClick={() => openAssistant()}
            className="btn-press flex items-center gap-1 pl-2 pr-2.5 py-1.5 rounded-full text-[12px] font-bold text-[#ffffff]"
            style={{ background: 'var(--ai-gradient)' }}
            aria-label={t('assistant.fab_title')}
          >
            <Icon name="auto_awesome" size={14} className="text-[#ffffff]" />
            {t('expenses.use_ai')}
          </button>
        ) : (
          <div className="w-8" />
        )}
      </div>

      {/* M3: 1-tap repeat of the most frequent expenses (derived, not stored). */}
      {frequentExpenses.length > 0 && (
        <div>
          <label className="text-xs text-on-surface-faint mb-2 block">{t('expenses.repeat_label')}</label>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {frequentExpenses.map((fav, index) => (
              <button
                key={index}
                onClick={() => applySuggestion(fav)}
                className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-container btn-press"
              >
                <Icon name={getCategoryIcon(fav.category)} size={16} className="text-on-surface-dim" />
                <span className="text-xs text-left">
                  <span className="block font-medium text-on-surface truncate max-w-[120px]">{fav.description}</span>
                  <span className="block text-on-surface-faint tabular">
                    {formatMoney(fav.amountCents, trip.baseCurrency)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-surface-container rounded-2xl p-5">
        <label className="text-xs text-on-surface-faint mb-1 block">{t('expenses.amount')}</label>
        <div className="flex items-baseline gap-1">
          <span className="text-on-surface-dim text-lg">{selectedCurrency}</span>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            className="bg-transparent text-display font-bold text-on-surface tabular outline-none w-full"
            autoFocus
          />
        </div>

        {/* E9 (M8): pick the expense currency — only when a foreign option exists
            (from a wallet or a frozen-rate snapshot); default is the trip base. */}
        {!isTransferLike && currencyOptions.length > 1 && (
          <div className="mt-3 flex items-center gap-2">
            <Icon name="payments" size={16} className="text-on-surface-faint shrink-0" />
            <select
              value={selectedCurrency}
              onChange={(e) => setCurrency(e.target.value)}
              aria-label={t('expenses.currency_label')}
              className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none flex-1"
            >
              {currencyOptions.map((code) => (
                <option key={code} value={code}>
                  {code === baseCurrency ? t('expenses.currency_base', { code }) : code}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* E9 (M9): foreign currency — manual/frozen rate + live base conversion. */}
        {isForeignCurrency && (
          <div className="mt-3 bg-surface-high rounded-lg p-3 flex flex-col gap-1">
            <label className="text-[11px] text-on-surface-faint">
              {t('expenses.exchange_rate_label', { currency: selectedCurrency, base: baseCurrency })}
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={manualRate}
              onChange={(e) => setManualRate(e.target.value)}
              placeholder="0,00"
              className="bg-transparent text-sm font-semibold text-on-surface tabular outline-none w-full"
            />
            {frozenRate !== null && (
              <span className="text-[10px] text-on-surface-faint">
                {t('expenses.exchange_rate_frozen')}
              </span>
            )}
            {amountCentsPreview > 0 && !needsRate && (
              <p className="text-sm font-bold tabular text-primary mt-0.5">
                ≈ {formatMoney(baseAmountCentsPreview, baseCurrency)}
              </p>
            )}
            {needsRate && amountCentsPreview > 0 && (
              <p className="text-xs font-semibold text-warning">
                {t('expenses.exchange_rate_required')}
              </p>
            )}
          </div>
        )}

        {anchorHint && (
          <p className="text-sm font-semibold text-on-surface-dim mt-1 tabular">{anchorHint}</p>
        )}
        {/* M11: optional voice capture (hidden when unsupported by the browser) */}
        {voiceSupported && (
          <button
            onClick={handleVoiceCapture}
            className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-lg btn-press ${
              listening ? 'bg-primary/20 ring-1 ring-primary' : 'bg-surface-high'
            }`}
          >
            <Icon
              name="mic"
              size={16}
              className={listening ? 'text-primary' : 'text-on-surface-dim'}
            />
            <span
              className={`text-xs font-medium ${listening ? 'text-primary' : 'text-on-surface-dim'}`}
            >
              {listening ? t('expenses.voice_listening') : t('expenses.voice_hint')}
            </span>
          </button>
        )}
      </div>

      {!isTransferLike && (
      <div>
        <label className="text-xs text-on-surface-faint mb-2 block">{t('expenses.category')}</label>
        <div className="grid grid-cols-5 gap-2">
          {CATEGORY_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => setCategory(key)}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl btn-press transition-colors ${
                category === key ? 'bg-primary/20 ring-1 ring-primary' : 'bg-surface-container'
              }`}
            >
              <Icon name={getCategoryIcon(key)} size={20} className={category === key ? 'text-primary' : 'text-on-surface-dim'} />
              {/* R-03: long labels (e.g. "Entretenimento") wrap with hyphenation
                  instead of overflowing the chip — works for any label ×3 languages. */}
              <span className="w-full text-center text-[10px] leading-tight text-on-surface-faint break-words hyphens-auto line-clamp-2">
                {t(`categories.${key}` as never)}
              </span>
            </button>
          ))}
        </div>
      </div>
      )}

      <div className="bg-surface-container rounded-xl p-4">
        <label className="text-xs text-on-surface-faint mb-1 block">{t('expenses.description')}</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={
            isWithdrawal
              ? t('fab.register_withdrawal')
              : isTransfer
                ? t('fab.register_transfer')
                : t(`categories.${category}` as never)
          }
          className="bg-transparent text-sm text-on-surface outline-none w-full"
          data-quickadd-description
        />
        {/* M2: memory by description — 1 tap fills category + value from last use. */}
        {descriptionSuggestion && (
          <button
            onClick={() => applySuggestion(descriptionSuggestion)}
            className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/15 ring-1 ring-primary/30 btn-press w-full text-left"
          >
            <Icon name="auto_awesome" size={16} className="text-primary shrink-0" />
            <span className="text-xs text-on-surface flex-1">
              {t('expenses.suggestion_hint', {
                category: t(`categories.${descriptionSuggestion.category}` as never),
                amount: formatMoney(descriptionSuggestion.amountCents, trip.baseCurrency),
              })}
            </span>
          </button>
        )}
      </div>

      {/* P2 (UX audit §4.3): the fund's empty state stays visible — it blocks the
          save, so the traveler must see why and reach "add fund". */}
      {!isTransferLike && selectablePools.length === 0 && (
        <div className="bg-surface-container rounded-xl p-4">
          <label className="text-xs text-on-surface-faint mb-2 block">{t('expenses.fund')}</label>
          <div className="flex flex-col items-start gap-2">
            <p className="text-xs text-on-surface-dim">{t('expenses.no_pool_for_phase')}</p>
            <button
              onClick={() => navigate('/funds')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold btn-press"
              style={{ background: '#C75B3918', color: 'var(--primary)', border: '1px dashed #C75B3940' }}
            >
              {t('funds.add')}
            </button>
          </div>
        </div>
      )}

      {/* DEC-386 (G1): event attribution — surfaced by date inference (an event
          is active on the expense's day) so the user is ALWAYS asked, never auto-
          decided (Â-ATTRIBUTION). One tap; the lone active event is pre-suggested
          and the user can opt out with "Não". Kept OUT of the collapsed details
          so the question is never hidden. */}
      {!isTransferLike && attributableEvents.length > 0 && (
        <div className="bg-surface-container rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="celebration" size={16} className="text-primary shrink-0" />
            <p className="text-sm font-semibold text-on-surface">
              {t('expenses.event_attribution_question')}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {attributableEvents.map((event) => {
              const selected = attributedOccurrenceId === event.id;
              return (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => selectAttributedEvent(selected ? null : event.id)}
                  aria-pressed={selected}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
                    selected ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                  }`}
                >
                  {event.name}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => selectAttributedEvent(null)}
              aria-pressed={attributedOccurrenceId === null}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
                attributedOccurrenceId === null
                  ? 'bg-primary text-on-surface'
                  : 'bg-surface-high text-on-surface-dim'
              }`}
            >
              {t('expenses.event_attribution_none')}
            </button>
          </div>
          <p className="text-[10px] text-on-surface-faint mt-2">
            {t('expenses.event_attribution_hint')}
          </p>
        </div>
      )}

      {/* P2 (UX audit §4.3 / G2): progressive disclosure — date, place, fund,
          wallet and photos collapse here so a trivial expense is ~3 taps. The
          fund picker only shows when there's a real choice (>1 pool); a lone fund
          is read-only, and a required multi-fund choice forces the block open. */}
      {!isTransferLike && (
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="bg-surface-container rounded-xl px-4 py-3.5 flex items-center gap-3 btn-press text-left"
          aria-expanded={detailsOpen}
        >
          <Icon name="tune" size={18} className="text-on-surface-dim shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-on-surface">{t('expenses.details_toggle')}</p>
            <p className="text-[11px] text-on-surface-faint line-clamp-1">{t('expenses.details_hint')}</p>
          </div>
          {detailsCustomized && !detailsOpen && (
            <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
          )}
          <Icon
            name="expand_more"
            size={20}
            className="text-on-surface-faint shrink-0 transition-transform"
            style={detailsOpen ? { transform: 'rotate(180deg)' } : undefined}
          />
        </button>
      )}

      {!isTransferLike && detailsOpen && (
        <>
          <div className="bg-surface-container rounded-xl p-4">
            <label className="text-xs text-on-surface-faint mb-1 block">{t('expenses.date_time')}</label>
            <input
              type="datetime-local"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              aria-label={t('expenses.date_time')}
              className="bg-transparent text-sm text-on-surface outline-none w-full"
            />
            <p className="text-[10px] text-on-surface-faint mt-1">{t('expenses.date_time_hint')}</p>
          </div>

          {/* E8 (M2/M3) + D-BUG-08: opt-in location selector (shared <PlaceField>). */}
          {locationEnabled && (
            <PlaceField
              value={place}
              onChange={setPlace}
              category={category}
              transactions={transactions}
              autoCapture
              locationFeaturesEnabled
              rememberedPlace={settings?.currentPlace ?? null}
            />
          )}

          {/* DEC-039/040: fund picker only when there's a choice; a lone fund is
              shown read-only (hidden from the default view per the audit). */}
          {selectablePools.length > 1 ? (
            <div className="bg-surface-container rounded-xl p-4">
              <label className="text-xs text-on-surface-faint mb-2 block">{t('expenses.fund')}</label>
              <div className="flex gap-2 flex-wrap">
                {availablePools.operational.map((pool) => (
                  <button
                    key={pool.id}
                    onClick={() => selectFund(pool.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
                      effectivePoolId === pool.id ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                    }`}
                  >
                    {pool.name}
                  </button>
                ))}
                {availablePools.global.map((pool) => (
                  <button
                    key={pool.id}
                    onClick={() => selectFund(pool.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press flex items-center gap-1 ${
                      effectivePoolId === pool.id ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                    }`}
                  >
                    <Icon
                      name="public"
                      size={12}
                      className={effectivePoolId === pool.id ? 'text-on-surface' : 'text-on-surface-faint'}
                    />
                    {pool.name}
                  </button>
                ))}
                {/* E02 (DEC-322): funds tied to another phase — selectable here,
                    just out of the active-phase focus. Labelled so the user knows
                    they belong to a different leg of the trip. */}
                {availablePools.otherPhases.length > 0 && (
                  <div className="w-full mt-1">
                    <p className="text-[10px] text-on-surface-faint mb-1.5">
                      {t('expenses.fund_other_phases')}
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {availablePools.otherPhases.map((pool) => (
                        <button
                          key={pool.id}
                          onClick={() => selectFund(pool.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press flex items-center gap-1 ${
                            effectivePoolId === pool.id ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                          }`}
                        >
                          <Icon
                            name="schedule"
                            size={12}
                            className={effectivePoolId === pool.id ? 'text-on-surface' : 'text-on-surface-faint'}
                          />
                          {pool.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {!effectivePoolId && (
                <p className="text-[10px] text-on-surface-faint mt-2">{t('expenses.choose_pool_hint')}</p>
              )}
            </div>
          ) : (
            selectedPool && (
              <div className="bg-surface-container rounded-xl p-4">
                <label className="text-xs text-on-surface-faint mb-1 block">{t('expenses.fund')}</label>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-high text-xs font-medium text-on-surface-dim">
                  <Icon name="savings" size={12} className="text-on-surface-faint" />
                  {selectedPool.name}
                </div>
              </div>
            )
          )}

          {/* D10: wallet stays progressive — only when tracking is active. */}
          {walletTrackingActive && (
            <div className="bg-surface-container rounded-xl p-4">
              <label className="text-xs text-on-surface-faint mb-2 block">{t('expenses.wallet')}</label>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setWalletId(null)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
                    effectiveWalletId === null ? 'bg-warning/20 text-warning ring-1 ring-warning' : 'bg-surface-high text-on-surface-dim'
                  }`}
                >
                  {t('expenses.wallet_not_set')}
                </button>
                {wallets.map((wallet) => (
                  <button
                    key={wallet.id}
                    onClick={() => setWalletId(wallet.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
                      effectiveWalletId === wallet.id ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                    }`}
                  >
                    {wallet.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* DEC-206 (G1): attach receipt/proof photos while creating the expense.
              Buffered in memory (compressed) and saved with the new transaction id. */}
          <div className="bg-surface-container rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-on-surface-faint font-semibold uppercase tracking-wider">
                {t('attachments.title')}
              </p>
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={photoBusy}
                className="flex items-center gap-1 text-xs font-semibold text-primary btn-press disabled:opacity-40"
              >
                <Icon name="add_a_photo" size={16} className="text-primary" />
                {photoBusy ? t('attachments.adding') : t('attachments.add')}
              </button>
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAddPhoto}
            />
            {pendingImages.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {pendingImages.map((entry) => (
                  <div
                    key={entry.id}
                    className="relative aspect-square rounded-xl overflow-hidden bg-surface-high"
                  >
                    <img
                      src={entry.image.thumbnailDataUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePendingPhoto(entry.id)}
                      aria-label={t('common.delete')}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center btn-press"
                    >
                      <Icon name="close" size={14} className="text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── WHO PAID? (DEC-123 / D-R4-J) — first-level question + split ── */}
      {canSplit && (
        <>
          {/* G9 (audit §4.15): the single shared "how splitting works" explainer. */}
          <SplitExplainer />
          <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-4">
          <div>
            <label className="text-xs text-on-surface-faint mb-2 block">
              {t('expenses.who_paid')}
            </label>
            <div className="flex gap-2 flex-wrap">
              {participants.map((p) => {
                // DEC-378: a green dot marks a CONNECTED person (paired device) so
                // the user can tell who an action actually reaches.
                const connected = p.linkedActorId !== null;
                const label = p.isOwner ? t('shared.owner_tag') : (p.nickname ?? p.name);
                return (
                  <button
                    key={p.id}
                    onClick={() => selectPayer(p.id)}
                    aria-label={connected ? `${label} · ${t('shared.people_badge_connected')}` : undefined}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press inline-flex items-center gap-1.5 ${
                      effectivePaidById === p.id
                        ? 'bg-primary text-on-surface'
                        : 'bg-surface-high text-on-surface-dim'
                    }`}
                  >
                    {label}
                    {connected && <span className="w-1.5 h-1.5 rounded-full bg-success" aria-hidden="true" />}
                  </button>
                );
              })}
              <button
                onClick={() => setAddPersonOpen(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium btn-press bg-surface-high text-primary border border-dashed border-outline"
              >
                {t('expenses.add_person_chip')}
              </button>
            </div>
          </div>

          {otherPaid && (
            <div>
              <label className="text-xs text-on-surface-faint mb-2 block">
                {t('expenses.other_paid_question')}
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setOtherPaidSplit(false)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium btn-press ${
                    !otherPaidSplit ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                  }`}
                >
                  {t('expenses.other_paid_full')}
                </button>
                <button
                  onClick={() => setOtherPaidSplit(true)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium btn-press ${
                    otherPaidSplit ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                  }`}
                >
                  {t('expenses.other_paid_split')}
                </button>
              </div>
              {/* DEC-114: never a gift — the cost stays mine, as a debt. */}
              {!otherPaidSplit && amountCentsPreview > 0 && (
                <p className="text-xs font-semibold text-warning mt-2">
                  {t('expenses.debt_full_hint', {
                    amount: formatMoney(amountCentsPreview, selectedCurrency),
                    name: payerName,
                  })}
                </p>
              )}
            </div>
          )}

          {!otherPaid && (
            <button
              onClick={toggleShared}
              className="w-full flex items-center justify-between btn-press"
            >
              <span className="text-sm text-on-surface font-medium flex items-center gap-2">
                <Icon name="group" size={18} className="text-on-surface-dim" />
                {t('expenses.shared_toggle')}
              </span>
              <span
                className="w-10 h-6 rounded-full relative transition-colors"
                style={{ background: isShared ? 'var(--primary)' : 'var(--surface-high)' }}
              >
                <span
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-on-surface transition-[left]"
                  style={{ left: isShared ? '18px' : '2px' }}
                />
              </span>
            </button>
          )}

          {wantsSplit && (
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-on-surface-faint mb-2 block">
                  {t('expenses.participants_label')}
                </label>
                <div className="flex gap-2 flex-wrap">
                  {participants.map((p) => {
                    // DEC-378: green dot = connected (paired device), same affordance
                    // as the "who paid" picker, so the cue reads identically.
                    const connected = p.linkedActorId !== null;
                    const label = p.nickname ?? p.name;
                    return (
                      <button
                        key={p.id}
                        onClick={() => toggleParticipant(p.id)}
                        aria-label={connected ? `${label} · ${t('shared.people_badge_connected')}` : undefined}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press inline-flex items-center gap-1.5 ${
                          selectedParticipantIds.includes(p.id)
                            ? 'bg-primary text-on-surface'
                            : 'bg-surface-high text-on-surface-dim'
                        }`}
                      >
                        {label}
                        {connected && <span className="w-1.5 h-1.5 rounded-full bg-success" aria-hidden="true" />}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setAddPersonOpen(true)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium btn-press bg-surface-high text-primary border border-dashed border-outline"
                  >
                    {t('expenses.add_person_chip')}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-on-surface-faint mb-2 block">
                  {t('expenses.split_mode')}
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSplitMode('equal')}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium btn-press ${
                      splitMode === 'equal' ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                    }`}
                  >
                    {t('expenses.split_equal')}
                  </button>
                  <button
                    onClick={() => setSplitMode('custom')}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium btn-press ${
                      splitMode === 'custom' ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                    }`}
                  >
                    {t('expenses.split_custom')}
                  </button>
                </div>
              </div>

              {splitMode === 'custom' && (
                <div className="flex flex-col gap-2">
                  {participants
                    .filter((p) => selectedParticipantIds.includes(p.id))
                    .map((p) => (
                      <div key={p.id} className="flex items-center gap-2">
                        <span className="text-xs text-on-surface-dim flex-1 truncate">
                          {p.isOwner ? t('shared.owner_tag') : (p.nickname ?? p.name)}
                        </span>
                        <div className="flex items-baseline gap-1 bg-surface-high rounded-lg px-3 py-1.5 w-28">
                          <span className="text-on-surface-faint text-xs">{selectedCurrency}</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            value={customAmounts[p.id] ?? ''}
                            onChange={(e) =>
                              setCustomAmounts((prev) => ({ ...prev, [p.id]: e.target.value }))
                            }
                            placeholder="0,00"
                            className="bg-transparent text-xs text-on-surface tabular outline-none w-full"
                          />
                        </div>
                      </div>
                    ))}
                  {customRemainingCents !== 0 && amountCentsPreview > 0 && (
                    <p className="text-xs text-warning">
                      {t('expenses.split_remaining', {
                        amount: formatMoney(customRemainingCents, selectedCurrency),
                      })}{' '}
                      {t('expenses.split_remainder_to_payer')}
                    </p>
                  )}
                </div>
              )}

              {previewShareCents !== null &&
                amountCentsPreview > 0 &&
                (otherPaid ? (
                  // DEC-114: my share stays my cost AND becomes a debt to the payer.
                  <p className="text-xs font-semibold text-warning">
                    {t('expenses.debt_share_hint', {
                      amount: formatMoney(previewShareCents, selectedCurrency),
                      name: payerName,
                    })}
                  </p>
                ) : (
                  <p className="text-xs font-semibold text-success">
                    {t('expenses.your_share', {
                      amount: formatMoney(previewShareCents, selectedCurrency),
                    })}
                  </p>
                ))}
            </div>
          )}
          </div>
        </>
      )}

      {!isTransferLike && participants.length <= 1 && (
        <button
          onClick={() => setAddPersonOpen(true)}
          className="w-full rounded-xl py-3 border border-dashed border-outline text-sm font-semibold text-primary btn-press flex items-center justify-center gap-2"
        >
          <Icon name="person_add" size={18} />
          {t('expenses.add_participants_button')}
        </button>
      )}

      {isTransferLike && (
        <>
          <div className="bg-surface-container rounded-xl p-4">
            <label className="text-xs text-on-surface-faint mb-2 block">
              {t('expenses.source_wallet')}
            </label>
            <div className="flex gap-2 flex-wrap">
              {wallets.map((wallet) => (
                <button
                  key={wallet.id}
                  onClick={() => setWalletId(wallet.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
                    effectiveSourceWalletId === wallet.id
                      ? 'bg-primary text-on-surface'
                      : 'bg-surface-high text-on-surface-dim'
                  }`}
                >
                  {wallet.name}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-surface-container rounded-xl p-4">
            <label className="text-xs text-on-surface-faint mb-2 block">
              {t('expenses.target_wallet')}
            </label>
            {targetCandidates.length === 0 ? (
              <p className="text-xs text-warning">{t('expenses.no_target_wallet')}</p>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {targetCandidates.map((wallet) => (
                  <button
                    key={wallet.id}
                    onClick={() => setTargetWalletId(wallet.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
                      effectiveTargetWalletId === wallet.id
                        ? 'bg-primary text-on-surface'
                        : 'bg-surface-high text-on-surface-dim'
                    }`}
                  >
                    {wallet.name}
                  </button>
                ))}
              </div>
            )}
            <p className="text-[10px] text-on-surface-faint mt-2">
              {t('expenses.transfer_no_budget_hint')}
            </p>
          </div>
        </>
      )}

      {amountCentsPreview > 0 && (
        <div className="bg-surface-high rounded-xl p-3 text-center">
          <p className="text-xs text-on-surface-faint">{t('expenses.amount')}</p>
          <p className="text-lg font-bold tabular text-on-surface">
            {formatMoney(amountCentsPreview, selectedCurrency)}
          </p>
          {isForeignCurrency && !needsRate && (
            <p className="text-xs text-on-surface-dim tabular mt-0.5">
              ≈ {formatMoney(baseAmountCentsPreview, baseCurrency)}
            </p>
          )}
        </div>
      )}

      {/* R3-J: live consequence of the action — "after this, you'll have X left
          in the fund" — so the user SEES the result before saving (not only an
          edge-case warning when the fund is already empty). Read-only preview. */}
      {!isTransferLike &&
        selectedPool &&
        selectedPoolFreeToSpendCents !== null &&
        baseAmountCentsPreview > 0 &&
        (() => {
          const afterCents = selectedPoolFreeToSpendCents - baseAmountCentsPreview;
          const over = afterCents < 0;
          return (
            <div
              className={`rounded-xl p-3 flex items-start gap-2 ${over ? 'bg-error/10' : 'bg-surface-high'}`}
            >
              <Icon
                name={over ? 'warning' : 'account_balance_wallet'}
                size={16}
                className={`mt-0.5 shrink-0 ${over ? 'text-error' : 'text-success'}`}
              />
              <p
                className={`text-xs font-semibold leading-snug ${over ? 'text-error' : 'text-on-surface'}`}
              >
                {t(over ? 'expenses.after_expense_over' : 'expenses.after_expense_left', {
                  amount: formatMoney(Math.abs(afterCents), trip.baseCurrency),
                  fund: selectedPool.name,
                })}
              </p>
            </div>
          );
        })()}

      {/* UX polish (Gate 3): the save/cancel row sticks to the bottom so a user
          in a hurry can confirm without scrolling past every optional field.
          ZERO behavior change — same buttons, same disabled rules; content
          scrolls cleanly under it (page is body-scrolled, no bottom nav here). */}
      <div
        className="sticky bottom-0 z-10 -mx-5 px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] flex gap-3"
        style={{ background: 'var(--surface)', borderTop: '1px solid var(--border-faint)' }}
      >
        <button
          onClick={() => navigate(-1)}
          className="flex-1 py-3 rounded-xl bg-surface-high text-on-surface-dim font-medium btn-press"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={handleSave}
          disabled={
            amountCentsPreview <= 0 ||
            saving ||
            !canSaveTransferLike ||
            needsRate ||
            (!isTransferLike && !effectivePoolId)
          }
          className="flex-1 py-3 rounded-xl bg-primary text-on-surface font-medium btn-press disabled:opacity-40"
        >
          {saving ? t('common.loading') : t('common.save')}
        </button>
      </div>

      <BottomSheet
        open={showZeroBudgetConfirm}
        onClose={() => setShowZeroBudgetConfirm(false)}
        title={t('expenses.zero_budget_title')}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-on-surface-dim">
            {t('expenses.zero_budget_body', {
              amount: formatMoney(selectedPoolFreeToSpendCents ?? 0, trip.baseCurrency),
            })}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowZeroBudgetConfirm(false)}
              className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface-dim font-medium text-sm btn-press"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={commitExpense}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-warning/20 text-warning ring-1 ring-warning font-semibold text-sm btn-press disabled:opacity-40"
            >
              {t('expenses.zero_budget_confirm')}
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* M5: anomaly confirmation — catches typos, never blocks (DEC-053). */}
      <BottomSheet
        open={showAnomalyConfirm}
        onClose={() => setShowAnomalyConfirm(false)}
        title={t('expenses.anomaly_title')}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-on-surface-dim">
            {t('expenses.anomaly_body', {
              amount: formatMoney(baseAmountCentsPreview, trip.baseCurrency),
              category: t(`categories.${category}` as never),
              typical: formatMoney(categoryTypicalCents, trip.baseCurrency),
            })}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAnomalyConfirm(false)}
              className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface-dim font-medium text-sm btn-press"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={confirmAfterAnomaly}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-warning/20 text-warning ring-1 ring-warning font-semibold text-sm btn-press disabled:opacity-40"
            >
              {t('expenses.anomaly_confirm')}
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* M4: transport round trip — duplicates the expense for the return leg. */}
      <BottomSheet
        open={showRoundTrip}
        onClose={handleRoundTripNo}
        title={t('expenses.round_trip_title')}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-on-surface-dim">{t('expenses.round_trip_body')}</p>
          <div className="flex gap-2">
            <button
              onClick={handleRoundTripNo}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface-dim font-medium text-sm btn-press disabled:opacity-40"
            >
              {t('expenses.round_trip_no')}
            </button>
            <button
              onClick={handleRoundTripYes}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-primary text-on-surface font-semibold text-sm btn-press disabled:opacity-40"
            >
              {t('expenses.round_trip_yes')}
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* B5: nudge to send each debtor their shared link after a split. */}
      <SplitShareNudgeSheet
        open={splitNudge.length > 0}
        participants={splitNudge}
        amountByParticipantId={splitNudgeAmounts}
        currency={trip?.baseCurrency}
        tripName={trip?.name}
        onClose={() => {
          setSplitNudge([]);
          setSplitNudgeAmounts(new Map());
          void finishAndGoHome();
        }}
      />

      <AddParticipantSheet
        open={addPersonOpen}
        onClose={() => setAddPersonOpen(false)}
        tripId={trip.id}
        participants={participants}
        onAdded={(p) => void handleParticipantAdded(p)}
      />
    </div>
  );
}
