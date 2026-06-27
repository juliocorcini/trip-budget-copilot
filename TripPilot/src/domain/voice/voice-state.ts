/**
 * DEC-365 (B1, wave 2026-06-27) — the explicit microphone lifecycle for voice
 * entry (AI Quick Entry + "speak the expense"). The field bug was a privacy one:
 * after using the mic on iPhone the OS "recording" indicator stayed lit because
 * the Web Speech engine was never torn down. This pure, data-driven machine is
 * the single source of truth for "is the mic hot right now?" so every surface
 * can RELEASE it deterministically and SHOW the user exactly what's happening.
 *
 * Pure + total: `voiceTransition` never throws and never gets stuck — an unknown
 * (state, event) pair is a no-op (returns the same state). Releasing the mic must
 * never be blocked by a bad transition (Â: nunca bloquear).
 */

export type VoiceState =
  /** Idle — the mic is closed and nothing is in flight. */
  | 'off'
  /** The permission prompt / engine warm-up is in flight (mic may be opening). */
  | 'asking'
  /** Actively listening — the mic is OPEN and the OS indicator is lit. */
  | 'capturing'
  /** Capture finished; transcribing/parsing with the mic already CLOSED. */
  | 'processing'
  /** A transcript was produced and handed off — success. */
  | 'done'
  /** Capture failed (denied, no-speech, engine error) — mic closed. */
  | 'error'
  /** The user (or an unmount/close) aborted before a result — mic closed. */
  | 'cancelled';

export type VoiceEvent =
  /** The user tapped the mic — begin asking for the mic. */
  | 'request'
  /** The mic was acquired and capture is now live. */
  | 'open'
  /** The user/engine ended capture; there is audio/text to process. */
  | 'finish'
  /** Processing produced a usable transcript. */
  | 'resolve'
  /** Anything failed along the way. */
  | 'fail'
  /** The user cancelled, or the host closed/unmounted the surface. */
  | 'cancel'
  /** Return to idle (clear a terminal state). */
  | 'reset';

export interface VoiceStateMeta {
  /**
   * The mic is, or may be, OPEN in this state — leaving it MUST guarantee a
   * teardown (track.stop / recognition.abort). `asking` counts: the OS may have
   * already lit the indicator while the prompt is up.
   */
  micHot: boolean;
  /** Show the live "listening" affordance (pulsing mic) only while capturing. */
  listening: boolean;
  /** Something is in flight (asking/capturing/processing) — show a busy hint. */
  busy: boolean;
  /** A resting state the flow ends on (off is idle; done/error/cancelled rest). */
  terminal: boolean;
  /** i18n key for the user-facing status label. */
  labelKey: string;
}

export const VOICE_STATE_META: Record<VoiceState, VoiceStateMeta> = {
  off: { micHot: false, listening: false, busy: false, terminal: true, labelKey: 'voice.state_off' },
  asking: { micHot: true, listening: false, busy: true, terminal: false, labelKey: 'voice.state_asking' },
  capturing: { micHot: true, listening: true, busy: true, terminal: false, labelKey: 'voice.state_capturing' },
  processing: { micHot: false, listening: false, busy: true, terminal: false, labelKey: 'voice.state_processing' },
  done: { micHot: false, listening: false, busy: false, terminal: true, labelKey: 'voice.state_done' },
  error: { micHot: false, listening: false, busy: false, terminal: true, labelKey: 'voice.state_error' },
  cancelled: { micHot: false, listening: false, busy: false, terminal: true, labelKey: 'voice.state_cancelled' },
};

/**
 * The forward transition table. `cancel` and `reset` are handled separately
 * (below) because they are valid from almost anywhere — releasing the mic and
 * returning to idle can never be refused.
 */
const VOICE_TRANSITIONS: Partial<Record<VoiceState, Partial<Record<VoiceEvent, VoiceState>>>> = {
  off: { request: 'asking' },
  asking: { open: 'capturing', finish: 'processing', fail: 'error' },
  capturing: { finish: 'processing', resolve: 'done', fail: 'error' },
  processing: { resolve: 'done', fail: 'error' },
};

/**
 * Compute the next state. Total and safe:
 *  - `reset` always returns to `off`.
 *  - `cancel` returns `cancelled` from any non-idle state (idle stays `off`).
 *  - any other unknown pair is a no-op (returns the same state).
 */
export function voiceTransition(state: VoiceState, event: VoiceEvent): VoiceState {
  if (event === 'reset') return 'off';
  if (event === 'cancel') return state === 'off' ? 'off' : 'cancelled';
  return VOICE_TRANSITIONS[state]?.[event] ?? state;
}

export function canVoiceTransition(state: VoiceState, event: VoiceEvent): boolean {
  return voiceTransition(state, event) !== state;
}

/** The mic is (or may be) open — the caller must ensure a hard teardown. */
export function isVoiceMicHot(state: VoiceState): boolean {
  return VOICE_STATE_META[state].micHot;
}

/** Show the live listening affordance (pulsing mic). */
export function isVoiceListening(state: VoiceState): boolean {
  return VOICE_STATE_META[state].listening;
}

/** Something is in flight (asking/capturing/processing). */
export function isVoiceBusy(state: VoiceState): boolean {
  return VOICE_STATE_META[state].busy;
}

export function voiceStateLabelKey(state: VoiceState): string {
  return VOICE_STATE_META[state].labelKey;
}
