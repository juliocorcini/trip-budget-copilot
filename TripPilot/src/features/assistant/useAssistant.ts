import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAppData } from '@/hooks/useAppData';
import { resolveActivePhase } from '@/domain/dates';
import { getAvailablePoolsForPhase } from '@/domain/budget';
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
import { isSpeechRecognitionSupported, startVoiceCapture } from '@/utils/speech-recognition';
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

export interface UseAssistant {
  phase: AssistantPhase;
  text: string;
  preview: AssistantPreview | null;
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
    const place = d.settings?.locationCaptureEnabled ? d.settings.currentPlace ?? null : null;

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
        setClarification(null);
        setPhase('preview');
      } else if (result.status === 'needs') {
        planRef.current = null;
        setClarification(result.clarifications[0] ?? null);
        if (result.note) setNote(result.note);
        setPhase('clarify');
      } else {
        planRef.current = null;
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

  const confirm = useCallback(async () => {
    const plan = planRef.current;
    if (!plan) return;

    if (plan.type === 'navigate') {
      navigate(plan.to);
      setPhase('done');
      return;
    }

    setPhase('saving');
    setErrorKey(null);
    const d = dataRef.current;
    const owner = d.participants.find((p) => p.isOwner);
    let op: ExecOp = plan.op;
    // Localized fallback for an expense the user didn't describe ("uma cerveja").
    if (op.kind === 'expense' && op.description.trim() === '') {
      op = { ...op, description: t(`categories.${op.category}`) };
    }

    try {
      const result = await executeOp(op, {
        transactions: d.transactions,
        participants: mergeParticipants(d.participants, localParticipantsRef.current),
        ownerId: owner?.id ?? '',
      });
      showToast(t(`assistant.done.${result.summaryKey}`), 'success', {
        actionLabel: t('common.undo'),
        durationMs: 6000,
        onTap: () => {
          void result.undo();
          showToast(t('assistant.undone'), 'info');
        },
      });
      setPhase('done');
    } catch (error) {
      if (error instanceof AssistantDispatchError) setErrorKey(`error.${error.code}`);
      else setErrorKey('error.failed');
      setPhase('error');
    }
  }, [navigate, t]);

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
    // Prefer the on-device Web Speech engine; fall back to Whisper via upload.
    if (isSpeechRecognitionSupported()) {
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

  return {
    phase,
    text,
    preview,
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
    toggleVoice,
    reset,
  };
}
