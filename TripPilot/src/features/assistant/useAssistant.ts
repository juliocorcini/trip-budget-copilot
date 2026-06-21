import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
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
  type AiIntent,
  type ActionPlan,
  type AssistantPreview,
  type BatchReady,
  type Clarification,
  type ExecOp,
  type PlanContext,
} from '@/domain/assistant';
import { requestAssistantIntents } from '@/utils/ai-assistant';
import { transcribeAudio, isLikelyVoiceHallucination } from '@/utils/ai-transcribe';
import { expenseOpToQuickAddDraft, setAssistantQuickAddDraft } from './assistant-quickadd-draft';
import { isSpeechRecognitionSupported, startVoiceCapture } from '@/utils/speech-recognition';
import { isPcmRecordingSupported, startPcmRecording, type PcmRecording } from '@/utils/audio-recorder';
import { isNativeApp } from '@/utils/native/platform';
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
 * Multi-action (DEC-246 multi): the preview of a whole message's events. `items`
 * are the previews the sheet lists; `blocked` are events that can't run
 * unattended (each with a reason key). `ownerTotalCents` is what the batch costs
 * ME (sum of my slice per expense), in `currency`.
 */
export interface AssistantBatchView {
  items: AssistantPreview[];
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
  enabled: boolean;
  listening: boolean;
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
  /** Hand the (edited) draft to the full QuickAdd form for the heavy cases. */
  openFullEditor: () => void;
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
  const [listening, setListening] = useState(false);

  const intentRef = useRef<AiIntent | null>(null);
  const planRef = useRef<ActionPlan | null>(null);
  // Multi-action: the parsed events + the resolved ops to commit, and which mode
  // the current round is in (so a clarification answer re-plans the right path).
  const intentsRef = useRef<AiIntent[]>([]);
  const batchReadyRef = useRef<BatchReady[]>([]);
  const modeRef = useRef<'single' | 'batch'>('single');
  const overridesRef = useRef<Record<string, string>>({});
  const localParticipantsRef = useRef<Participant[]>([]);
  const stopVoiceRef = useRef<(() => void) | null>(null);
  const transcriptRef = useRef('');

  const enabled = data.settings?.aiQuickEntryEnabled ?? false;
  const voiceAvailable =
    isSpeechRecognitionSupported() ||
    (typeof navigator !== 'undefined' && !!navigator.mediaDevices && typeof MediaRecorder !== 'undefined');

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
      blocked: plan.blocked.map((b) => ({ reasonKey: b.reasonKey, preview: b.preview })),
      count: plan.ready.length,
      ownerTotalCents,
      currency: ctx.baseCurrency,
    });
    setPhase('batch_preview');
  }, [buildPlanContext]);

  const submit = useCallback(
    async (textOverride?: string) => {
      const value = (textOverride ?? text).trim();
      if (value === '') return;
      if (!enabled) {
        setErrorKey('error.disabled');
        setPhase('error');
        return;
      }
      setText(value);
      setErrorKey(null);
      setNote(null);
      overridesRef.current = {};
      localParticipantsRef.current = [];
      setPhase('thinking');

      const d = dataRef.current;
      const pack = buildAssistantContext({
        language: i18n.language,
        baseCurrency: d.trip?.baseCurrency ?? 'EUR',
        place: d.settings?.locationCaptureEnabled ? d.settings.currentPlace ?? null : null,
        participants: mergeParticipants(d.participants, localParticipantsRef.current),
        wallets: d.wallets,
        privateNames: d.settings?.aiQuickEntryPrivateNames ?? false,
      });

      const outcome = await requestAssistantIntents(value, pack);
      if (!outcome.ok) {
        setErrorKey(`error.${outcome.error}`);
        setPhase('error');
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
    [text, enabled, i18n.language, runPlan, runBatch],
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
    setPhase('input');
  }, []);

  // In-sheet edits to the drafted expense (amount, category, place, fund…). Other
  // op kinds aren't editable in the sheet — they keep the planner's resolution.
  const patchDraft = useCallback((patch: Partial<Extract<ExecOp, { kind: 'expense' }>>) => {
    setDraftOp((prev) => (prev && prev.kind === 'expense' ? { ...prev, ...patch } : prev));
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
    // Localized fallback for an expense the user didn't describe ("uma cerveja").
    if (op.kind === 'expense' && op.description.trim() === '') {
      op = { ...op, description: t(`categories.${op.category}`) };
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
        finalOp = { ...op, description: t(`categories.${op.category}`) };
      }
      try {
        const result = await executeOp(finalOp, dispatchCtx);
        undos.push(result.undo);
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
        setErrorKey(`error.${outcome.error}`);
        setPhase('error');
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
    [i18n.language, submit, t],
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
      setListening(true);
      stopVoiceRef.current = () => {
        stopVoiceRef.current = null;
        void (async () => {
          let blob: Blob;
          try {
            blob = await recording.stop();
          } catch {
            setListening(false);
            setErrorKey('error.failed');
            setPhase('error');
            return;
          }
          setListening(false);
          await transcribeAndSubmit(blob);
        })();
      };
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
        setListening(false);
        stopVoiceRef.current = null;
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        await transcribeAndSubmit(blob);
      };
      recorder.start();
      setListening(true);
      stopVoiceRef.current = () => recorder.stop();
    } catch {
      setErrorKey('error.mic_denied');
      setPhase('error');
    }
  }, [transcribeAndSubmit]);

  const toggleVoice = useCallback(async () => {
    if (listening) {
      stopVoiceRef.current?.();
      return;
    }
    setErrorKey(null);
    // Prefer the on-device Web Speech engine on web/PWA; on the native Android
    // shell it is DEFINED but broken (the System WebView has no speech service,
    // so `start()` errors instantly and the mic icon just flips back without ever
    // asking for permission — device-test 2026-06-20). There we go straight to
    // the Whisper path, whose getUserMedia triggers the real RECORD_AUDIO prompt.
    if (!isNativeApp() && isSpeechRecognitionSupported()) {
      transcriptRef.current = '';
      setListening(true);
      const stop = startVoiceCapture(i18n.language, {
        onResult: (transcript) => {
          transcriptRef.current = transcript;
          setText(transcript);
        },
        onError: () => {
          setListening(false);
          stopVoiceRef.current = null;
        },
        onEnd: () => {
          setListening(false);
          stopVoiceRef.current = null;
          const transcript = transcriptRef.current.trim();
          if (transcript !== '') void submit(transcript);
        },
      });
      stopVoiceRef.current = stop;
      if (!stop) setListening(false);
      return;
    }
    await startWhisperCapture();
  }, [listening, i18n.language, submit, startWhisperCapture]);

  const reset = useCallback(() => {
    stopVoiceRef.current?.();
    stopVoiceRef.current = null;
    intentRef.current = null;
    planRef.current = null;
    intentsRef.current = [];
    batchReadyRef.current = [];
    modeRef.current = 'single';
    overridesRef.current = {};
    localParticipantsRef.current = [];
    transcriptRef.current = '';
    setText('');
    setPreview(null);
    setDraftOp(null);
    setBatchView(null);
    setSplitNudge(null);
    setClarification(null);
    setNote(null);
    setErrorKey(null);
    setListening(false);
    setPhase('input');
  }, []);

  // Stop any live capture if the consumer unmounts mid-listen.
  useEffect(() => {
    return () => {
      stopVoiceRef.current?.();
    };
  }, []);

  const baseCurrency = data.trip?.baseCurrency ?? 'EUR';
  const isForeign = draftOp?.kind === 'expense' && draftOp.currency !== baseCurrency;

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
    enabled,
    listening,
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
    openFullEditor,
    dismissNudge,
    toggleVoice,
    reset,
  };
}
