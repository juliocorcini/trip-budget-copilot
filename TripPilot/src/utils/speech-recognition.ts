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
  stop: () => void;
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
 * Starts a single-shot capture and returns a stop function, or null when the
 * browser cannot recognize speech (the caller should not have offered it).
 */
export function startVoiceCapture(
  language: string,
  handlers: VoiceCaptureHandlers,
): (() => void) | null {
  const Recognition = getRecognitionConstructor();
  if (!Recognition) return null;
  const recognition = new Recognition();
  recognition.lang = toSpeechLocale(language);
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = (event) => {
    const transcript = event.results[0]?.[0]?.transcript ?? '';
    handlers.onResult(transcript);
  };
  recognition.onerror = (event) => handlers.onError?.(event.error);
  recognition.onend = () => handlers.onEnd?.();
  recognition.start();
  return () => recognition.stop();
}
