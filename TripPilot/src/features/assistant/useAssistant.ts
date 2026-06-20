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
  AssistantDispatchError,
  type AiIntent,
  type ActionPlan,
  type AssistantPreview,
  type Clarification,
  type ExecOp,
  type PlanContext,
} from '@/domain/assistant';
import { requestAssistantIntent } from '@/utils/ai-assistant';
import { transcribeAudio } from '@/utils/ai-transcribe';
import { expenseOpToQuickAddDraft, setAssistantQuickAddDraft } from './assistant-quickadd-draft';
import { isSpeechRecognitionSupported, startVoiceCapture } from '@/utils/speech-recognition';
import { isNativeApp } from '@/utils/native/platform';
import { showToast } from '@/components/Toast';
import type { Participant } from '@/domain/types/participant';

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
  | 'clarify'
  | 'saving'
  | 'error'
  | 'done';

/** B5/DL-5 parity: who to nudge after an AI split (+ what each owes me). */
export interface AssistantSplitNudge {
  targets: Participant[];
  amountByParticipantId: Map<string, number>;
}

export interface UseAssistant {
  phase: AssistantPhase;
  text: string;
  preview: AssistantPreview | null;
  /** The editable expense op behind the preview (null for non-editable kinds). */
  draftOp: ExecOp | null;
  /** True when the drafted expense is in a foreign currency (needs the rate UI). */
  isForeign: boolean;
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
  choosePerson: (id: string) => void;
  cancelClarification: () => void;
  confirm: () => Promise<void>;
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
  const [splitNudge, setSplitNudge] = useState<AssistantSplitNudge | null>(null);
  const [clarification, setClarification] = useState<Clarification | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [listening, setListening] = useState(false);

  const intentRef = useRef<AiIntent | null>(null);
  const planRef = useRef<ActionPlan | null>(null);
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

      const outcome = await requestAssistantIntent(value, pack);
      if (!outcome.ok) {
        setErrorKey(`error.${outcome.error}`);
        setPhase('error');
        return;
      }
      intentRef.current = outcome.intent;
      setNote(outcome.intent.note);
      runPlan(outcome.intent);
    },
    [text, enabled, i18n.language, runPlan],
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

  const choosePerson = useCallback(
    (id: string) => {
      if (clarification?.type !== 'choose_person') return;
      overridesRef.current = { ...overridesRef.current, [normalizeText(clarification.name)]: id };
      if (intentRef.current) runPlan(intentRef.current);
    },
    [clarification, runPlan],
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

  const startWhisperCapture = useCallback(async () => {
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
        setPhase('transcribing');
        const outcome = await transcribeAudio(blob, twoLetter(i18n.language));
        if (!outcome.ok) {
          setErrorKey(`error.${outcome.error}`);
          setPhase('error');
          return;
        }
        const transcript = outcome.text.trim();
        if (transcript === '') {
          setPhase('input');
          return;
        }
        setText(transcript);
        void submit(transcript);
      };
      recorder.start();
      setListening(true);
      stopVoiceRef.current = () => recorder.stop();
    } catch {
      setErrorKey('error.mic_denied');
      setPhase('error');
    }
  }, [i18n.language, submit]);

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
    overridesRef.current = {};
    localParticipantsRef.current = [];
    transcriptRef.current = '';
    setText('');
    setPreview(null);
    setDraftOp(null);
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
    choosePerson,
    cancelClarification,
    confirm,
    patchDraft,
    openFullEditor,
    dismissNudge,
    toggleVoice,
    reset,
  };
}
