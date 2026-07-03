import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { logger } from '@/utils/logger';
import { useAppData } from '@/hooks/useAppData';
import { resolveActivePhase } from '@/domain/dates';
import { getAvailablePoolsForPhase } from '@/domain/budget';
import { deriveRecentPlaces } from '@/domain/location';
import { evaluateAmountExpression } from '@/domain/money';
import {
  buildActionPlan,
  buildAssistantContext,
  executeOp,
  createAssistantParticipant,
  normalizeText,
  ownerPersonalCostCents,
  planAssistantBatch,
  AssistantDispatchError,
  defaultCooldown,
  cooldownRemainingSec as cooldownRemaining,
  isCoolingDown as isCoolingDownNow,
  type AiIntent,
  type ActionPlan,
  type AssistantPreview,
  type BatchReady,
  type Clarification,
  type ExecOp,
  type ExecutionResult,
  type PlanContext,
  type AiCooldown,
} from '@/domain/assistant';
import { requestAssistantIntents } from '@/utils/ai-assistant';
import { transcribeAudio, isLikelyVoiceHallucination } from '@/utils/ai-transcribe';
import { compressImageFile, blobToDataUrl, type CompressedImage } from '@/utils/image/compress';
import { extractReceiptViaCloud } from '@/utils/ai-ocr';
import { summarizeReceiptTotal, dominantReceiptCategory, type ReceiptPlan } from '@/domain/receipt';
import { setReceiptReviewHandoff } from '@/features/receipt/receipt-review-handoff';
import { expenseOpToQuickAddDraft, setAssistantQuickAddDraft } from './assistant-quickadd-draft';
import { stampExpenseLocation } from '@/features/location/stamp-expense-location';
import { isSpeechRecognitionSupported, startVoiceCapture } from '@/utils/speech-recognition';
import { isPcmRecordingSupported, startPcmRecording, type PcmRecording } from '@/utils/audio-recorder';
import { isNativeApp } from '@/utils/native/platform';
import { isVoiceListening, type VoiceState } from '@/domain/voice/voice-state';

/**
 * DEC-365 (B1): a uniform mic handle. Whatever the capture path (Web Speech,
 * PCM, MediaRecorder), `stop()` ends gracefully (keep the result) and `cancel()`
 * releases the mic NOW (close / unmount). Both guarantee the mic is freed.
 */
interface VoiceHandle {
  stop: () => void;
  cancel: () => void;
}
import { bumpTelemetryCounter } from '@/utils/telemetry-events';
import { showToast } from '@/components/Toast';
import type { Participant } from '@/domain/types/participant';

/**
 * Below this the WAV holds < ~0.4 s of 16 kHz mono audio — an accidental tap, not
 * speech. We bail instead of sending it (silence makes Whisper hallucinate a
 * stray filler like "E aí" — device-test 2026-06-20).
 */
const MIN_SPEECH_WAV_BYTES = 12_000;

/**
 * DEC-246 (AI Quick Entry): the sheet's state machine. It owns the full
 * round-trip — text/voice in → cloud router → on-device plan → optional
 * clarification taps → preview → execute through the engines → undo toast — and
 * never lets a failure dead-end (every error maps to a key the sheet renders
 * with a "switch to manual" door). All financial work happens in the pure
 * planner + the dispatch boundary; this hook only sequences them.
 */
export type AssistantPhase =
  | 'input'
  | 'thinking'
  | 'transcribing'
  | 'preview'
  | 'batch_preview'
  | 'clarify'
  | 'saving'
  | 'error'
  | 'done';

/** B5/DL-5 parity: who to nudge after an AI split (+ what each owes me). */
export interface AssistantSplitNudge {
  targets: Participant[];
  amountByParticipantId: Map<string, number>;
}

/**
 * DEC-408 (G7): an image pasted/attached into the assistant input, kept until the
 * user sends. `previewUrl` is an object URL for the thumbnail (revoked on remove /
 * send / reset). On send each is OCR'd (reusing the receipt pipeline) and merged
 * with the typed text into the batch flow.
 */
export interface PendingImage {
  id: string;
  file: File;
  previewUrl: string;
}

// DEC-408: keep the attach list bounded — a sane cap, not an abuse vector.
const MAX_PENDING_IMAGES = 6;

let pendingImageSeq = 0;
function makePendingImageId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ?? `pending-${Date.now()}-${++pendingImageSeq}`;
}

/**
 * DEC-258 / DEC-408: map an extracted receipt plan to a single `log_expense`
 * intent — the same shape used for a snapped photo, so OCR'd images flow through
 * the exact text plan/preview machinery (full parity, one-tap confirm). Carries
 * the OCR'd place + date so the spend lands on its real venue/day, not now/here.
 */
export function receiptPlanToIntent(
  plan: ReceiptPlan,
  summary: { amountCents: number; merchant: string | null },
): AiIntent {
  return {
    action: 'log_expense',
    amount: summary.amountCents / 100,
    currency: plan.currency,
    toCurrency: null,
    description: summary.merchant,
    category: dominantReceiptCategory(plan.items),
    person: null,
    participants: [],
    payer: null,
    direction: null,
    fromWallet: null,
    toWallet: null,
    place: plan.placeLabel,
    date: plan.purchaseDate,
    itemName: null,
    comparisonItems: [],
    screen: null,
    note: null,
    confidence: null,
  };
}

/**
 * Multi-action (DEC-246 multi): the preview of a whole message's events. `items`
 * are the previews the sheet lists; `blocked` are events that can't run
 * unattended (each with a reason key). `ownerTotalCents` is what the batch costs
 * ME (sum of my slice per expense), in `currency`.
 */
export interface AssistantBatchView {
  items: AssistantPreview[];
  /** DEC-397 (G6): the editable op behind each `items[i]` (same order/length), so
   *  the batch can enrich fund/event/wallet per item and hand one to QuickAdd. */
  ops: ExecOp[];
  blocked: { reasonKey: string; preview: AssistantPreview | null }[];
  count: number;
  ownerTotalCents: number;
  currency: string;
}

export interface UseAssistant {
  phase: AssistantPhase;
  text: string;
  preview: AssistantPreview | null;
  /** The editable expense op behind the preview (null for non-editable kinds). */
  draftOp: ExecOp | null;
  /** True when the drafted expense is in a foreign currency (needs the rate UI). */
  isForeign: boolean;
  /** Multi-action: the previewed batch of events (null in single-action mode). */
  batchView: AssistantBatchView | null;
  /** After a split: the people to send their share link (null when none). */
  splitNudge: AssistantSplitNudge | null;
  clarification: Clarification | null;
  note: string | null;
  errorKey: string | null;
  /** FB-26: seconds left on the AI cooldown (0 when not rate-limited). Drives the
   *  honest countdown and keeps the AI triggers gated until it expires. */
  aiCooldownSec: number;
  enabled: boolean;
  /** FB-09 (DEC-258): photo capture is available (cloud OCR opted-in). */
  photoEnabled: boolean;
  /** True while the current preview came from a scanned photo (offers "open items"). */
  fromPhoto: boolean;
  /** DEC-408 (G7): images pasted into the input, awaiting OCR on send. */
  pendingImages: PendingImage[];
  listening: boolean;
  /** DEC-365 (B1): the explicit mic lifecycle state for the UI status label. */
  voiceState: VoiceState;
  voiceAvailable: boolean;
  setText: (value: string) => void;
  submit: (textOverride?: string) => Promise<void>;
  answerAmount: (value: string) => void;
  confirmAddPerson: () => Promise<void>;
  /** Multi-action: create every pending companion at once, then re-plan. */
  confirmAddPeople: () => Promise<void>;
  choosePerson: (id: string) => void;
  cancelClarification: () => void;
  confirm: () => Promise<void>;
  /** Multi-action: commit every ready event, with a single combined undo. */
  confirmBatch: () => Promise<void>;
  /** Edit a field of the drafted expense before confirming (in-sheet parity). */
  patchDraft: (patch: Partial<Extract<ExecOp, { kind: 'expense' }>>) => void;
  /** DEC-410 (G8): edit the drafted event (name/date/reserve/start) before confirm. */
  patchEventDraft: (patch: Partial<Extract<ExecOp, { kind: 'event' }>>) => void;
  /** DEC-397 (G6): enrich one batch item's fund/event/wallet in place. */
  patchBatchItem: (index: number, patch: Partial<Extract<ExecOp, { kind: 'expense' }>>) => void;
  /** DEC-397 (G6): hand one batch item to the full QuickAdd editor (pre-filled). */
  openBatchItemEditor: (index: number) => void;
  /** Hand the (edited) draft to the full QuickAdd form for the heavy cases. */
  openFullEditor: () => void;
  /** DEC-408 (G7): queue pasted/attached image(s) to OCR on the next send. */
  addPendingImages: (files: File[]) => void;
  /** DEC-408 (G7): drop one queued image before sending. */
  removePendingImage: (id: string) => void;
  /** FB-09: open the scanned photo as the full item-by-item receipt instead. */
  openReceiptItems: () => void;
  /** Dismiss the post-split nudge (the action already committed). */
  dismissNudge: () => void;
  toggleVoice: () => Promise<void>;
  reset: () => void;
}

function mergeParticipants(base: Participant[], extra: Participant[]): Participant[] {
  if (extra.length === 0) return base;
  const seen = new Set(base.map((p) => p.id));
  return [...base, ...extra.filter((p) => !seen.has(p.id))];
}

function twoLetter(language: string): string {
  return language.slice(0, 2);
}

/**
 * DEC-403 (G4): the FACTUAL fallback for an AI expense the model left without a
 * description. Prefer the resolved place name, then a neutral label — but NEVER
 * the category (which used to surface "Outros"/"Restaurant" as the description).
 * Pure; the worker prompt already makes the model write a real description, so
 * this only runs on the rare empty case.
 */
export function fallbackExpenseDescription(
  op: Extract<ExecOp, { kind: 'expense' }>,
  t: (key: string) => string,
): string {
  const place = op.place?.label.trim();
  return place && place.length > 0 ? place : t('assistant.expense_fallback');
}

/**
 * DEC-389 (G5): fire-and-forget background stamp for an AI expense that captured a
 * place NAME but no coordinates — forward-geocodes the name to the real venue
 * (GPS fallback), exactly like the manual QuickAdd save. Gated on opt-in location
 * capture; no name / already located → nothing to do. Never blocks, never throws.
 */
function maybeStampAiExpenseLocation(result: ExecutionResult, locationEnabled: boolean): void {
  const tx = result.transaction;
  if (!locationEnabled || !tx) return;
  const hasName = tx.placeLabel !== null && tx.placeLabel.trim() !== '';
  if (!hasName || tx.latitude !== null) return;
  void stampExpenseLocation(tx, false);
}

export function useAssistant(): UseAssistant {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const data = useAppData();

  // Always resolve against the freshest snapshot inside async callbacks.
  const dataRef = useRef(data);
  dataRef.current = data;

  const [phase, setPhase] = useState<AssistantPhase>('input');
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<AssistantPreview | null>(null);
  const [draftOp, setDraftOp] = useState<ExecOp | null>(null);
  const [batchView, setBatchView] = useState<AssistantBatchView | null>(null);
  const [splitNudge, setSplitNudge] = useState<AssistantSplitNudge | null>(null);
  const [clarification, setClarification] = useState<Clarification | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  // DEC-365 (B1): the explicit mic lifecycle (off/asking/capturing/processing/…).
  // `listening` (the live pulse) is derived so the two can never desync.
  const [voiceState, setVoiceState] = useState<VoiceState>('off');
  const listening = isVoiceListening(voiceState);
  // FB-26 (DEC-276): when Groq's free tier is exhausted the AI triggers gate
  // until the cooldown expires. The ref is the source of truth read inside async
  // callbacks (no stale closure / dep churn); `cooldownTick` only re-renders the
  // countdown. The cooldown deliberately survives reset() so closing/reopening
  // the sheet can't bypass the gate.
  const cooldownRef = useRef<AiCooldown | null>(null);
  const [cooldown, setCooldownStateRaw] = useState<AiCooldown | null>(null);
  const [cooldownTick, setCooldownTick] = useState(() => Date.now());
  // FB-09 (DEC-258): when the active preview was built from a scanned photo, the
  // sheet offers "open items" (the full receipt) beside "confirm".
  const [fromPhoto, setFromPhoto] = useState(false);
  // DEC-408 (G7): images pasted into the input, OCR'd on send. The ref mirrors the
  // state so the async `submit` reads the freshest list without a stale closure.
  const [pendingImages, setPendingImagesRaw] = useState<PendingImage[]>([]);
  const pendingImagesRef = useRef<PendingImage[]>([]);
  const setPendingImages = useCallback((next: PendingImage[]) => {
    pendingImagesRef.current = next;
    setPendingImagesRaw(next);
  }, []);

  const intentRef = useRef<AiIntent | null>(null);
  const planRef = useRef<ActionPlan | null>(null);
  // Multi-action: the parsed events + the resolved ops to commit, and which mode
  // the current round is in (so a clarification answer re-plans the right path).
  const intentsRef = useRef<AiIntent[]>([]);
  const batchReadyRef = useRef<BatchReady[]>([]);
  const modeRef = useRef<'single' | 'batch'>('single');
  const overridesRef = useRef<Record<string, string>>({});
  const localParticipantsRef = useRef<Participant[]>([]);
  // FB-09: the scanned plan + photo kept so "open items" hands them to the full
  // receipt page without a second OCR call (no token spent twice).
  const receiptPlanRef = useRef<ReceiptPlan | null>(null);
  const receiptImageRef = useRef<CompressedImage | null>(null);
  const voiceRef = useRef<VoiceHandle | null>(null);
  const transcriptRef = useRef('');

  const enabled = data.settings?.aiQuickEntryEnabled ?? false;
  const photoEnabled = data.settings?.cloudReceiptOcrEnabled ?? false;
  const voiceAvailable =
    isSpeechRecognitionSupported() ||
    (typeof navigator !== 'undefined' && !!navigator.mediaDevices && typeof MediaRecorder !== 'undefined');

  // FB-26 helpers — keep the ref and the render state in lock-step.
  const setCooldown = useCallback((cd: AiCooldown | null) => {
    cooldownRef.current = cd;
    setCooldownStateRaw(cd);
    setCooldownTick(Date.now());
  }, []);

  const cooldownErrorKey = (cd: AiCooldown): string =>
    cd.scope === 'day' ? 'error.ai_unavailable_day' : 'error.rate_limited';

  // Enter the cooldown error from a rate-limited outcome (honest countdown).
  const enterCooldown = useCallback(
    (cd: AiCooldown | undefined) => {
      const resolved = cd ?? defaultCooldown(Date.now());
      setCooldown(resolved);
      setErrorKey(cooldownErrorKey(resolved));
      setPhase('error');
    },
    [setCooldown],
  );

  // Gate any AI trigger while a cooldown is active — re-asserts the error so the
  // user sees why nothing happened, then bails. Reads the ref (no stale state).
  const blockedByCooldown = useCallback((): boolean => {
    const cd = cooldownRef.current;
    if (!isCoolingDownNow(cd, Date.now())) return false;
    setErrorKey(cooldownErrorKey(cd!));
    setPhase('error');
    return true;
  }, []);

  // Tick the countdown once per second; auto-clear the cooldown when it expires
  // so the retry button re-enables on its own.
  useEffect(() => {
    if (!cooldown) return;
    const id = window.setInterval(() => {
      if (Date.now() >= cooldown.until) {
        setCooldown(null);
        window.clearInterval(id);
      } else {
        setCooldownTick(Date.now());
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [cooldown, setCooldown]);

  const buildPlanContext = useCallback((): PlanContext | null => {
    const d = dataRef.current;
    if (!d.trip) return null;
    const phaseRow = resolveActivePhase(d.phases);
    const owner = d.participants.find((p) => p.isOwner) ?? null;
    const participants = mergeParticipants(d.participants, localParticipantsRef.current);
    const available = phaseRow
      ? getAvailablePoolsForPhase(d.pools, d.links, phaseRow.id)
      : { operational: [], global: [], autoSelectedPoolId: null };
    const selectable = [...available.operational, ...available.global];
    const defaultWallet = d.wallets.find((w) => w.isDefault);
    const nonCashDefault =
      d.wallets.find((w) => w.isDefault && w.walletType !== 'cash') ??
      d.wallets.find((w) => w.walletType !== 'cash') ??
      defaultWallet;
    const cashWallet = d.wallets.find((w) => w.walletType === 'cash');
    // Location-gated: the sticky place + a pool of past venues a named place can
    // snap onto (so it recovers coordinates). With location off, neither is used.
    const locationOn = !!d.settings?.locationCaptureEnabled;
    const place = locationOn ? d.settings?.currentPlace ?? null : null;
    const knownPlaces = locationOn ? deriveRecentPlaces(d.transactions, null, 50) : [];

    return {
      tripId: d.trip.id,
      baseCurrency: d.trip.baseCurrency,
      phaseId: phaseRow?.id ?? null,
      owner,
      participants,
      connectedParticipantIds: participants.filter((p) => p.linkedActorId !== null).map((p) => p.id),
      wallets: d.wallets,
      defaultPoolId: available.autoSelectedPoolId ?? selectable[0]?.id ?? null,
      defaultWalletId: defaultWallet?.id ?? null,
      defaultSourceWalletId: nonCashDefault?.id ?? null,
      defaultTargetWalletId: cashWallet?.id ?? null,
      place,
      knownPlaces,
      now: new Date(),
      personOverrides: overridesRef.current,
    };
  }, []);

  const runPlan = useCallback(
    (intent: AiIntent) => {
      const ctx = buildPlanContext();
      if (!ctx) {
        setErrorKey('unsupported.no_trip');
        setPhase('error');
        return;
      }
      const result = buildActionPlan(intent, ctx);
      if (result.status === 'ready') {
        planRef.current = result.plan;
        setPreview(result.plan.preview);
        setDraftOp(result.plan.type === 'execute' ? result.plan.op : null);
        setClarification(null);
        setPhase('preview');
      } else if (result.status === 'needs') {
        planRef.current = null;
        setDraftOp(null);
        setClarification(result.clarifications[0] ?? null);
        if (result.note) setNote(result.note);
        setPhase('clarify');
      } else {
        planRef.current = null;
        setDraftOp(null);
        setErrorKey(`unsupported.${result.messageKey}`);
        setPhase('error');
      }
    },
    [buildPlanContext],
  );

  // Multi-action: plan ALL parsed events together. Unknown/ambiguous people are
  // aggregated into ONE consolidated clarification (add everyone in a tap); once
  // resolved, we land on a batch preview listing each event + a single confirm.
  const runBatch = useCallback(() => {
    const ctx = buildPlanContext();
    if (!ctx) {
      setErrorKey('unsupported.no_trip');
      setPhase('error');
      return;
    }
    const plan = planAssistantBatch(intentsRef.current, ctx);
    if (plan.pendingAdd.length > 0) {
      setClarification({ type: 'add_people', names: plan.pendingAdd });
      setPhase('clarify');
      return;
    }
    if (plan.pendingChoose.length > 0) {
      const first = plan.pendingChoose[0]!;
      setClarification({ type: 'choose_person', name: first.name, candidates: first.candidates });
      setPhase('clarify');
      return;
    }
    batchReadyRef.current = plan.ready;
    if (plan.ready.length === 0 && plan.blocked.length === 0) {
      setErrorKey('error.failed');
      setPhase('error');
      return;
    }
    const ownerTotalCents = plan.ready.reduce(
      (sum, r) => sum + (r.op.kind === 'expense' ? ownerPersonalCostCents(r.op) : 0),
      0,
    );
    setClarification(null);
    setBatchView({
      items: plan.ready.map((r) => r.preview),
      ops: plan.ready.map((r) => r.op),
      blocked: plan.blocked.map((b) => ({ reasonKey: b.reasonKey, preview: b.preview })),
      count: plan.ready.length,
      ownerTotalCents,
      currency: ctx.baseCurrency,
    });
    setPhase('batch_preview');
  }, [buildPlanContext]);

  // DEC-408 (G7): build the cloud router context pack. Extracted so the text
  // submit and the pasted-image flow share one definition (no drift).
  const buildRouterPack = useCallback(() => {
    const d = dataRef.current;
    return buildAssistantContext({
      language: i18n.language,
      baseCurrency: d.trip?.baseCurrency ?? 'EUR',
      place: d.settings?.locationCaptureEnabled ? d.settings.currentPlace ?? null : null,
      participants: mergeParticipants(d.participants, localParticipantsRef.current),
      wallets: d.wallets,
      privateNames: d.settings?.aiQuickEntryPrivateNames ?? false,
    });
  }, [i18n.language]);

  // DEC-408 (G7): queue pasted/attached images (bounded), each kept as an
  // object-URL thumbnail until send/remove. Gated by the cloud-OCR opt-in (the
  // same gate as the camera) — without it there is no pipeline to read them.
  const addPendingImages = useCallback(
    (files: File[]) => {
      if (!photoEnabled) return;
      const images = files.filter((f) => f.type.startsWith('image/'));
      if (images.length === 0) return;
      const current = pendingImagesRef.current;
      const room = MAX_PENDING_IMAGES - current.length;
      if (room <= 0) return;
      const added = images.slice(0, room).map((file) => ({
        id: makePendingImageId(),
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      setPendingImages([...current, ...added]);
    },
    [photoEnabled, setPendingImages],
  );

  const removePendingImage = useCallback(
    (id: string) => {
      const current = pendingImagesRef.current;
      const target = current.find((img) => img.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      setPendingImages(current.filter((img) => img.id !== id));
    },
    [setPendingImages],
  );

  const clearPendingImages = useCallback(() => {
    for (const img of pendingImagesRef.current) URL.revokeObjectURL(img.previewUrl);
    setPendingImages([]);
  }, [setPendingImages]);

  // DEC-408 (G7): OCR one pasted image through the SAME receipt pipeline as a
  // snapped photo, folding it into one summarized `log_expense` intent. Never
  // throws — transport/parse failures map to a typed result so a single bad
  // image cannot dead-end the rest (A5 never-block).
  const ocrPendingImage = useCallback(
    async (
      img: PendingImage,
    ): Promise<
      | { ok: true; plan: ReceiptPlan; image: CompressedImage; intent: AiIntent }
      | { ok: false; error: 'rate_limited'; cooldown: AiCooldown }
      | { ok: false; error: 'failed' }
    > => {
      try {
        const image = await compressImageFile(img.file);
        const dataUrl = await blobToDataUrl(image.blob);
        const outcome = await extractReceiptViaCloud(dataUrl);
        if (!outcome.ok) {
          if (outcome.error === 'rate_limited' && outcome.cooldown) {
            return { ok: false, error: 'rate_limited', cooldown: outcome.cooldown };
          }
          return { ok: false, error: 'failed' };
        }
        const summary = summarizeReceiptTotal(outcome.plan);
        if (!summary) return { ok: false, error: 'failed' };
        return { ok: true, plan: outcome.plan, image, intent: receiptPlanToIntent(outcome.plan, summary) };
      } catch (err) {
        logger.error('assistant_pending_image_ocr_failed', { module: 'assistant' }, err);
        return { ok: false, error: 'failed' };
      }
    },
    [],
  );

  // DEC-408 (G7): the send path when images were pasted — OCR every image, append
  // any typed-text intents, then route through the SAME preview/batch machinery.
  // One image + no text keeps single-photo "open items" parity; anything more
  // lands on the batch list (one confirm). A rate-limit on any call gates the lot.
  const runImagesThenText = useCallback(
    async (value: string, images: PendingImage[]) => {
      if (!buildPlanContext()) {
        setErrorKey('unsupported.no_trip');
        setPhase('error');
        return;
      }
      const results = await Promise.all(images.map(ocrPendingImage));
      const limited = results.find(
        (r): r is { ok: false; error: 'rate_limited'; cooldown: AiCooldown } =>
          !r.ok && r.error === 'rate_limited',
      );
      if (limited) {
        enterCooldown(limited.cooldown);
        return;
      }
      const scanned = results.filter((r): r is Extract<typeof r, { ok: true }> => r.ok);
      const imageIntents = scanned.map((r) => r.intent);

      let textIntents: AiIntent[] = [];
      if (value !== '') {
        const outcome = await requestAssistantIntents(value, buildRouterPack());
        if (!outcome.ok) {
          if (outcome.error === 'rate_limited') {
            enterCooldown(outcome.cooldown);
            return;
          }
          // Text failed but images scanned: proceed on images alone (A5).
          if (imageIntents.length === 0) {
            setErrorKey(`error.${outcome.error}`);
            setPhase('error');
            return;
          }
        } else {
          textIntents = outcome.intents;
        }
      }

      const combined = [...imageIntents, ...textIntents];
      if (combined.length === 0) {
        setErrorKey('error.photo_failed');
        setPhase('error');
        return;
      }
      clearPendingImages();

      // One image, no text → single preview with "open items" (full receipt).
      if (combined.length === 1 && imageIntents.length === 1 && textIntents.length === 0) {
        const first = scanned[0]!;
        receiptPlanRef.current = first.plan;
        receiptImageRef.current = first.image;
        intentRef.current = first.intent;
        modeRef.current = 'single';
        runPlan(first.intent);
        setFromPhoto(true);
        return;
      }
      if (combined.length === 1) {
        const only = combined[0]!;
        modeRef.current = 'single';
        intentRef.current = only;
        setNote(only.note);
        runPlan(only);
        return;
      }
      modeRef.current = 'batch';
      intentsRef.current = combined;
      setNote(null);
      runBatch();
    },
    [buildPlanContext, ocrPendingImage, enterCooldown, buildRouterPack, clearPendingImages, runPlan, runBatch],
  );

  // FB-09: escalate the scanned photo to the full item-by-item receipt — hands
  // the already-extracted plan + photo to the receipt page (no second OCR call).
  const openReceiptItems = useCallback(() => {
    const plan = receiptPlanRef.current;
    if (!plan) return;
    const merchant = plan.merchant?.trim();
    setReceiptReviewHandoff({
      plan,
      image: receiptImageRef.current,
      name: merchant && merchant.length > 0 ? merchant : null,
    });
    setPhase('done');
    navigate('/receipt/scan');
  }, [navigate]);

  const submit = useCallback(
    async (textOverride?: string) => {
      const value = (textOverride ?? text).trim();
      const images = pendingImagesRef.current;
      if (value === '' && images.length === 0) return;
      if (!enabled) {
        setErrorKey('error.disabled');
        setPhase('error');
        return;
      }
      if (blockedByCooldown()) return;
      setText(value);
      setErrorKey(null);
      setNote(null);
      setFromPhoto(false);
      overridesRef.current = {};
      localParticipantsRef.current = [];
      setPhase('thinking');

      // DEC-408 (G7): pasted images → OCR-then-text merged flow.
      if (images.length > 0) {
        await runImagesThenText(value, images);
        return;
      }

      const outcome = await requestAssistantIntents(value, buildRouterPack());
      if (!outcome.ok) {
        if (outcome.error === 'rate_limited') enterCooldown(outcome.cooldown);
        else {
          setErrorKey(`error.${outcome.error}`);
          setPhase('error');
        }
        return;
      }
      const intents = outcome.intents;
      // A message that narrates several events → the batch path (list + one
      // confirm). A single event keeps the proven single-intent flow untouched.
      if (intents.length > 1) {
        modeRef.current = 'batch';
        intentsRef.current = intents;
        setNote(null);
        runBatch();
        return;
      }
      modeRef.current = 'single';
      const intent = intents[0];
      if (!intent) {
        setErrorKey('error.failed');
        setPhase('error');
        return;
      }
      intentRef.current = intent;
      setNote(intent.note);
      runPlan(intent);
    },
    [text, enabled, runPlan, runBatch, blockedByCooldown, enterCooldown, runImagesThenText, buildRouterPack],
  );

  const answerAmount = useCallback(
    (value: string) => {
      if (!intentRef.current) return;
      const parsed = evaluateAmountExpression(value);
      if (parsed === null || !Number.isFinite(parsed) || parsed <= 0) return;
      intentRef.current = { ...intentRef.current, amount: parsed };
      runPlan(intentRef.current);
    },
    [runPlan],
  );

  const confirmAddPerson = useCallback(async () => {
    if (clarification?.type !== 'add_person') return;
    const ctx = buildPlanContext();
    if (!ctx) return;
    const name = clarification.name.trim();
    if (name === '') {
      setErrorKey('error.need_people');
      setPhase('error');
      return;
    }
    setPhase('saving');
    const participant = await createAssistantParticipant(ctx.tripId, name);
    localParticipantsRef.current = [...localParticipantsRef.current, participant];
    overridesRef.current = { ...overridesRef.current, [normalizeText(name)]: participant.id };
    if (intentRef.current) runPlan(intentRef.current);
    else setPhase('input');
  }, [clarification, buildPlanContext, runPlan]);

  const confirmAddPeople = useCallback(async () => {
    if (clarification?.type !== 'add_people') return;
    const ctx = buildPlanContext();
    if (!ctx) return;
    const names = clarification.names.map((n) => n.trim()).filter((n) => n !== '');
    if (names.length === 0) {
      setErrorKey('error.need_people');
      setPhase('error');
      return;
    }
    setPhase('saving');
    const created = await Promise.all(names.map((name) => createAssistantParticipant(ctx.tripId, name)));
    localParticipantsRef.current = [...localParticipantsRef.current, ...created];
    const overrides = { ...overridesRef.current };
    created.forEach((participant, i) => {
      overrides[normalizeText(names[i]!)] = participant.id;
    });
    overridesRef.current = overrides;
    runBatch();
  }, [clarification, buildPlanContext, runBatch]);

  const choosePerson = useCallback(
    (id: string) => {
      if (clarification?.type !== 'choose_person') return;
      overridesRef.current = { ...overridesRef.current, [normalizeText(clarification.name)]: id };
      // Re-plan the path the current message is on (single vs batch).
      if (modeRef.current === 'batch') runBatch();
      else if (intentRef.current) runPlan(intentRef.current);
    },
    [clarification, runPlan, runBatch],
  );

  const cancelClarification = useCallback(() => {
    setClarification(null);
    setNote(null);
    setFromPhoto(false);
    receiptPlanRef.current = null;
    receiptImageRef.current = null;
    setPhase('input');
  }, []);

  // In-sheet edits to the drafted expense (amount, category, place, fund…). Other
  // op kinds aren't editable in the sheet — they keep the planner's resolution.
  const patchDraft = useCallback((patch: Partial<Extract<ExecOp, { kind: 'expense' }>>) => {
    setDraftOp((prev) => (prev && prev.kind === 'expense' ? { ...prev, ...patch } : prev));
  }, []);

  // DEC-410 (G8): in-sheet edits to the drafted EVENT (name/date/reserve/start).
  const patchEventDraft = useCallback((patch: Partial<Extract<ExecOp, { kind: 'event' }>>) => {
    setDraftOp((prev) => (prev && prev.kind === 'event' ? { ...prev, ...patch } : prev));
  }, []);

  // Escape hatch: hand the (edited) expense draft to the full QuickAdd form for
  // the heavy cases the sheet doesn't duplicate (foreign rate, custom split,
  // photos) — pre-filled, so nothing the AI captured is lost.
  const openFullEditor = useCallback(() => {
    const plan = planRef.current;
    const op = draftOp ?? (plan?.type === 'execute' ? plan.op : null);
    if (op && op.kind === 'expense') {
      const base = dataRef.current.trip?.baseCurrency ?? 'EUR';
      setAssistantQuickAddDraft(expenseOpToQuickAddDraft(op, base));
    }
    navigate('/quick-add');
    setPhase('done');
  }, [navigate, draftOp]);

  // DEC-397 (G6): enrich one batch item in place — set its fund/event/wallet
  // without leaving the list. Only the expense kind is editable; the headline
  // (amount/who) is unaffected by these fields, so the total/preview stay valid.
  const patchBatchItem = useCallback(
    (index: number, patch: Partial<Extract<ExecOp, { kind: 'expense' }>>) => {
      const ready = batchReadyRef.current;
      const item = ready[index];
      if (!item || item.op.kind !== 'expense') return;
      const nextOp: ExecOp = { ...item.op, ...patch };
      batchReadyRef.current = ready.map((r, i) => (i === index ? { ...r, op: nextOp } : r));
      setBatchView((prev) =>
        prev ? { ...prev, ops: batchReadyRef.current.map((r) => r.op) } : prev,
      );
    },
    [],
  );

  // DEC-397 (G6): hand ONE batch item to the full QuickAdd editor, pre-filled
  // (incl. the event). The handed item is dropped from the batch so it can never
  // double-commit; the rest stay pending. Mirrors `openFullEditor` per item.
  const openBatchItemEditor = useCallback(
    (index: number) => {
      const ready = batchReadyRef.current;
      const item = ready[index];
      if (!item || item.op.kind !== 'expense') return;
      const base = dataRef.current.trip?.baseCurrency ?? 'EUR';
      setAssistantQuickAddDraft(expenseOpToQuickAddDraft(item.op, base));
      batchReadyRef.current = ready.filter((_, i) => i !== index);
      navigate('/quick-add');
      setPhase('done');
    },
    [navigate],
  );

  const dismissNudge = useCallback(() => setSplitNudge(null), []);

  const confirm = useCallback(async () => {
    const plan = planRef.current;
    if (!plan) return;

    if (plan.type === 'navigate') {
      navigate(plan.to);
      setPhase('done');
      return;
    }

    const d = dataRef.current;
    const baseOp = draftOp ?? plan.op;
    // A foreign-currency expense needs a conversion rate the sheet doesn't carry;
    // route it to the full editor so the budget math stays correct (never guess).
    if (baseOp.kind === 'expense' && baseOp.currency !== (d.trip?.baseCurrency ?? baseOp.currency)) {
      openFullEditor();
      return;
    }

    setPhase('saving');
    setErrorKey(null);
    const owner = d.participants.find((p) => p.isOwner);
    let op: ExecOp = baseOp;
    // DEC-403: factual fallback for an expense with no description — place name,
    // then a neutral label; never the category.
    if (op.kind === 'expense' && op.description.trim() === '') {
      op = { ...op, description: fallbackExpenseDescription(op, t) };
    }

    try {
      const result = await executeOp(op, {
        transactions: d.transactions,
        participants: mergeParticipants(d.participants, localParticipantsRef.current),
        ownerId: owner?.id ?? '',
        currentPlace: d.settings?.currentPlace ?? null,
        lastExpenseCategory: d.settings?.lastExpenseCategory ?? null,
      });
      bumpTelemetryCounter('aiEntries'); // DEC-248: count a successful AI action.
      // DEC-389 (G5): an AI expense that captured a place NAME but no coordinates
      // gets the SAME background location stamp QuickAdd does — forward-geocode
      // the name to the real venue (GPS fallback). Fire-and-forget; never blocks
      // the confirm and never throws (A5).
      maybeStampAiExpenseLocation(result, d.settings?.locationCaptureEnabled ?? false);
      showToast(t(`assistant.done.${result.summaryKey}`), 'success', {
        actionLabel: t('common.undo'),
        durationMs: 6000,
        onTap: () => {
          void result.undo();
          showToast(t('assistant.undone'), 'info');
        },
      });
      // B5/DL-5 parity: a split that gave others a slice opens the same "send
      // their link / remind" nudge QuickAdd does (rendered by the sheet once it
      // closes). No nudge → the sheet just closes on `done`.
      if (result.splitNudge && result.splitNudge.targets.length > 0) {
        setSplitNudge(result.splitNudge);
      }
      setPhase('done');
    } catch (error) {
      if (error instanceof AssistantDispatchError) setErrorKey(`error.${error.code}`);
      else setErrorKey('error.failed');
      setPhase('error');
    }
  }, [navigate, t, draftOp, openFullEditor]);

  // Multi-action: commit every ready event in order through the SAME dispatch the
  // single flow uses; collect each undo into ONE "Desfazer" that reverses them
  // all. A per-op try/catch means one failure never aborts the rest. (Foreign
  // events were already filtered to `blocked` by the planner, so every op here is
  // base-currency and safe to book without a rate.)
  const confirmBatch = useCallback(async () => {
    const ops = batchReadyRef.current;
    if (ops.length === 0) return;
    setPhase('saving');
    setErrorKey(null);
    const d = dataRef.current;
    const owner = d.participants.find((p) => p.isOwner);
    const dispatchCtx = {
      transactions: d.transactions,
      participants: mergeParticipants(d.participants, localParticipantsRef.current),
      ownerId: owner?.id ?? '',
      currentPlace: d.settings?.currentPlace ?? null,
      lastExpenseCategory: d.settings?.lastExpenseCategory ?? null,
    };
    const undos: Array<() => Promise<void>> = [];
    let done = 0;
    let failed = 0;
    for (const { op } of ops) {
      let finalOp: ExecOp = op;
      if (op.kind === 'expense' && op.description.trim() === '') {
        finalOp = { ...op, description: fallbackExpenseDescription(op, t) };
      }
      try {
        const result = await executeOp(finalOp, dispatchCtx);
        undos.push(result.undo);
        // DEC-389 (G5): same name→venue stamp as the single flow, per item.
        maybeStampAiExpenseLocation(result, d.settings?.locationCaptureEnabled ?? false);
        done += 1;
      } catch {
        failed += 1;
      }
    }
    if (done > 0) {
      bumpTelemetryCounter('aiEntries', done); // DEC-248: count each AI action.
      showToast(t('assistant.done.batch', { count: done }), 'success', {
        actionLabel: t('common.undo'),
        durationMs: 6000,
        onTap: () => {
          void (async () => {
            for (const undo of undos.reverse()) await undo();
          })();
          showToast(t('assistant.undone'), 'info');
        },
      });
    }
    if (failed > 0) showToast(t('assistant.batch.partial_error', { count: failed }), 'warning');
    setPhase('done');
  }, [t]);

  // Shared tail for both audio paths: transcribe the clip and run it like typed
  // input. Silence/too-short clips bail quietly (no "E aí" hallucination spam).
  const transcribeAndSubmit = useCallback(
    async (blob: Blob) => {
      // WAV size maps directly to duration; a too-small clip is an accidental tap.
      // (The compressed webm fallback skips this — Whisper's empty result handles it.)
      if (blob.type.includes('wav') && blob.size < MIN_SPEECH_WAV_BYTES) {
        setPhase('input');
        showToast(t('assistant.voice_unclear'), 'info');
        return;
      }
      setPhase('transcribing');
      const outcome = await transcribeAudio(blob, twoLetter(i18n.language));
      if (!outcome.ok) {
        if (outcome.error === 'rate_limited') enterCooldown(outcome.cooldown);
        else {
          setErrorKey(`error.${outcome.error}`);
          setPhase('error');
        }
        return;
      }
      const transcript = outcome.text.trim();
      // Empty, or a bare "no speech" filler ("E aí") Whisper invents for audio it
      // couldn't read — both mean "didn't catch that", never a real command.
      if (transcript === '' || isLikelyVoiceHallucination(transcript)) {
        setPhase('input');
        showToast(t('assistant.voice_unclear'), 'info');
        return;
      }
      setText(transcript);
      void submit(transcript);
    },
    [i18n.language, submit, t, enterCooldown],
  );

  const startWhisperCapture = useCallback(async () => {
    // Primary: capture clean 16 kHz mono WAV via Web Audio. This is what makes
    // voice reliable on the Android WebView, where MediaRecorder's webm/opus
    // lacks duration cues and Whisper decoded only a fragment ("E aí").
    if (isPcmRecordingSupported()) {
      let recording: PcmRecording;
      try {
        recording = await startPcmRecording();
      } catch {
        setErrorKey('error.mic_denied');
        setPhase('error');
        return;
      }
      setVoiceState('capturing');
      // `recording.stop()` releases the mic synchronously (its cleanup runs before
      // the first await), so both stop and cancel free the device immediately;
      // only `deliver` decides whether we then transcribe.
      let pcmDone = false;
      const finishPcm = (deliver: boolean): void => {
        if (pcmDone) return;
        pcmDone = true;
        voiceRef.current = null;
        void (async () => {
          let blob: Blob;
          try {
            blob = await recording.stop();
          } catch {
            setVoiceState('error');
            setErrorKey('error.failed');
            setPhase('error');
            return;
          }
          if (!deliver) {
            setVoiceState('off');
            return;
          }
          setVoiceState('processing');
          await transcribeAndSubmit(blob);
          setVoiceState('off');
        })();
      };
      voiceRef.current = { stop: () => finishPcm(true), cancel: () => finishPcm(false) };
      return;
    }

    // Fallback: MediaRecorder (older/web engines without ScriptProcessor).
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        voiceRef.current = null;
        setVoiceState('processing');
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        await transcribeAndSubmit(blob);
        setVoiceState('off');
      };
      recorder.start();
      setVoiceState('capturing');
      // stop() ends gracefully (onstop transcribes); cancel() also stops the
      // recorder — onstop still releases the tracks, so the mic is freed either way.
      voiceRef.current = { stop: () => recorder.stop(), cancel: () => recorder.stop() };
    } catch {
      setVoiceState('error');
      setErrorKey('error.mic_denied');
      setPhase('error');
    }
  }, [transcribeAndSubmit]);

  const toggleVoice = useCallback(async () => {
    if (listening) {
      // A second tap = "I'm done": end gracefully so the final transcript lands.
      voiceRef.current?.stop();
      return;
    }
    if (blockedByCooldown()) return;
    setErrorKey(null);
    // Prefer the on-device Web Speech engine on web/PWA; on the native Android
    // shell it is DEFINED but broken (the System WebView has no speech service,
    // so `start()` errors instantly and the mic icon just flips back without ever
    // asking for permission — device-test 2026-06-20). There we go straight to
    // the Whisper path, whose getUserMedia triggers the real RECORD_AUDIO prompt.
    if (!isNativeApp() && isSpeechRecognitionSupported()) {
      transcriptRef.current = '';
      setVoiceState('capturing');
      const controller = startVoiceCapture(i18n.language, {
        onResult: (transcript) => {
          transcriptRef.current = transcript;
          setText(transcript);
        },
        // The boundary already aborted + released the mic before calling back.
        onError: () => {
          voiceRef.current = null;
          setVoiceState('error');
        },
        onEnd: () => {
          voiceRef.current = null;
          const transcript = transcriptRef.current.trim();
          if (transcript !== '') {
            setVoiceState('off');
            void submit(transcript);
          } else {
            setVoiceState('off');
          }
        },
      });
      voiceRef.current = controller;
      if (!controller) setVoiceState('off');
      return;
    }
    await startWhisperCapture();
  }, [listening, i18n.language, submit, startWhisperCapture, blockedByCooldown]);

  const reset = useCallback(() => {
    // Hard-release the mic immediately (close/clear must drop the OS indicator).
    voiceRef.current?.cancel();
    voiceRef.current = null;
    intentRef.current = null;
    planRef.current = null;
    intentsRef.current = [];
    batchReadyRef.current = [];
    modeRef.current = 'single';
    overridesRef.current = {};
    localParticipantsRef.current = [];
    receiptPlanRef.current = null;
    receiptImageRef.current = null;
    transcriptRef.current = '';
    clearPendingImages();
    setText('');
    setPreview(null);
    setDraftOp(null);
    setBatchView(null);
    setSplitNudge(null);
    setClarification(null);
    setNote(null);
    setErrorKey(null);
    setVoiceState('off');
    setFromPhoto(false);
    setPhase('input');
  }, [clearPendingImages]);

  // DEC-365 (B1): release the mic if the consumer unmounts mid-listen — `cancel`
  // aborts the engine / stops the tracks so the OS recording indicator clears.
  useEffect(() => {
    return () => {
      voiceRef.current?.cancel();
      voiceRef.current = null;
      // DEC-408: release any pending image object URLs on unmount.
      for (const img of pendingImagesRef.current) URL.revokeObjectURL(img.previewUrl);
    };
  }, []);

  const baseCurrency = data.trip?.baseCurrency ?? 'EUR';
  const isForeign = draftOp?.kind === 'expense' && draftOp.currency !== baseCurrency;
  const aiCooldownSec = cooldownRemaining(cooldown, cooldownTick);

  return {
    phase,
    text,
    preview,
    draftOp,
    isForeign,
    batchView,
    splitNudge,
    clarification,
    note,
    errorKey,
    aiCooldownSec,
    enabled,
    photoEnabled,
    fromPhoto,
    pendingImages,
    listening,
    voiceState,
    voiceAvailable,
    setText,
    submit,
    answerAmount,
    confirmAddPerson,
    confirmAddPeople,
    choosePerson,
    cancelClarification,
    confirm,
    confirmBatch,
    patchDraft,
    patchEventDraft,
    patchBatchItem,
    openBatchItemEditor,
    openFullEditor,
    addPendingImages,
    removePendingImage,
    openReceiptItems,
    dismissNudge,
    toggleVoice,
    reset,
  };
}
