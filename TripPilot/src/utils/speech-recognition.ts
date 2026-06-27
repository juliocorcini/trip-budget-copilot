/**
 * E1 (M11): thin boundary around the Web Speech API. The feature is optional —
 * everything here degrades to "unsupported" so callers can hide the mic button
 * when the browser has no recognition engine (DEC-052: voice is additive only).
 */

interface RecognitionAlternative {
  transcript: string;
}

interface RecognitionResultLike {
  0: RecognitionAlternative;
}

interface RecognitionEventLike {
  results: ArrayLike<RecognitionResultLike>;
}

interface RecognitionErrorLike {
  error: string;
}

interface MinimalSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  /** Graceful end: stops capture but waits for the final result. */
  stop: () => void;
  /**
   * Hard stop: ends capture immediately, discards pending results AND releases
   * the microphone. This is the call that drops the iOS recording indicator —
   * `stop()` alone leaves it lit (DEC-365).
   */
  abort: () => void;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: RecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
}

type RecognitionConstructor = new () => MinimalSpeechRecognition;

function getRecognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const candidate = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return candidate.SpeechRecognition ?? candidate.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getRecognitionConstructor() !== null;
}

/** Maps an app i18n language to a BCP-47 tag the recognition engine expects. */
export function toSpeechLocale(language: string): string {
  if (language.startsWith('es')) return 'es-ES';
  if (language.startsWith('en')) return 'en-US';
  return 'pt-BR';
}

export interface VoiceCaptureHandlers {
  onResult: (transcript: string) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
}

/**
 * DEC-365 (B1): a controllable capture handle. The mic lifecycle is explicit so
 * every caller can RELEASE deterministically:
 *  - `stop()`   → graceful: finish the utterance, deliver the final result, then
 *                 tear down (used when the user is done — keeps the transcript).
 *  - `cancel()` → immediate: abort the engine, drop the mic + the OS indicator
 *                 NOW, no result (used on cancel / close / unmount).
 * Both end in the SAME hard teardown, which is idempotent.
 */
export interface VoiceCaptureController {
  stop: () => void;
  cancel: () => void;
}

/**
 * Starts a single-shot capture and returns a controller, or null when the
 * browser cannot recognize speech (the caller should not have offered it) or the
 * engine refuses to start.
 *
 * Hardening (DEC-365): on EVERY exit (result, end, error, cancel) we null the
 * engine handlers and call `abort()` — Web Speech does not expose its
 * MediaStream, so `abort()` + dropping the handlers/ref is the strongest release
 * we can guarantee, and it's what drops the lingering iOS mic indicator.
 */
export function startVoiceCapture(
  language: string,
  handlers: VoiceCaptureHandlers,
): VoiceCaptureController | null {
  const Recognition = getRecognitionConstructor();
  if (!Recognition) return null;
  const recognition = new Recognition();
  recognition.lang = toSpeechLocale(language);
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  // Runs at most once: detach the engine handlers (so a late onend can't re-fire
  // or retain the object) and abort to force the mic + OS indicator off.
  let settled = false;
  const teardown = (): void => {
    if (settled) return;
    settled = true;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    try {
      recognition.abort();
    } catch {
      /* abort may throw if it never started / already ended — release stands */
    }
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0]?.[0]?.transcript ?? '';
    handlers.onResult(transcript);
  };
  recognition.onerror = (event) => {
    const error = event.error;
    teardown();
    handlers.onError?.(error);
    handlers.onEnd?.();
  };
  recognition.onend = () => {
    teardown();
    handlers.onEnd?.();
  };

  try {
    recognition.start();
  } catch {
    teardown();
    handlers.onError?.('start_failed');
    handlers.onEnd?.();
    return null;
  }

  return {
    // Graceful: let the engine deliver the final result (onresult) and then fire
    // onend, where teardown releases the mic. If stop() itself throws, release now.
    stop: () => {
      if (settled) return;
      try {
        recognition.stop();
      } catch {
        teardown();
        handlers.onEnd?.();
      }
    },
    // Immediate release with no result and no callbacks — the caller owns its own
    // state reset (this is what unmount / close / cancel use).
    cancel: () => {
      teardown();
    },
  };
}
