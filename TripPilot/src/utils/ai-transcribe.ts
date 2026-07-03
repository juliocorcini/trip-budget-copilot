import { getSyncWorkerUrl, aiRequestHeaders } from '@/data/sync/config';
import { logger } from '@/utils/logger';
import { readCooldown } from '@/utils/ai-rate-limit';
import type { AiCooldown } from '@/domain/assistant';

/**
 * DEC-246 (AI Quick Entry · voice): client boundary for Groq Whisper
 * speech-to-text. Sends a short recorded clip (base64) to the Worker
 * `/transcribe` route and returns the plain transcript. Used as the robust
 * fallback where the Web Speech API is unavailable/unreliable (notably the
 * Android APK). Never throws — failures fold into a typed error.
 */
export type TranscribeError = 'not_configured' | 'rate_limited' | 'offline' | 'failed';

export type TranscribeOutcome =
  | { ok: true; text: string }
  | { ok: false; error: TranscribeError; cooldown?: AiCooldown };

/**
 * Whisper emits a stray filler when handed audio with no intelligible speech —
 * for pt-BR this is overwhelmingly "E aí". Confirmed live (device-test
 * 2026-06-20): BOTH digital near-silence AND a pure 220 Hz tone come back as
 * `{"text":" E aí"}`, so it is a "no speech detected" artefact, not a
 * transcription. These full-string forms are never valid expense commands on
 * their own, so treating them as "didn't catch that" is safe.
 */
const VOICE_HALLUCINATIONS = new Set([
  'e ai',
  'eai',
  'obrigado',
  'obrigada',
  'tchau',
  'valeu',
  'amara org',
  'legendas pela comunidade amara org',
]);

/**
 * True when a transcript is ONLY a known no-speech filler (so the caller shows
 * "didn't catch that" instead of feeding "E aí" to the intent parser, which then
 * answers "não entendi"). Matches the FULL normalized string only — real speech
 * that merely starts with a filler ("e aí, paguei 5 euros") passes through.
 */
export function isLikelyVoiceHallucination(text: string): boolean {
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // drop accents: "aí" → "ai"
    .replace(/[^a-z0-9 ]+/g, ' ') // drop punctuation
    .replace(/\s+/g, ' ')
    .trim();
  if (normalized === '') return true;
  return VOICE_HALLUCINATIONS.has(normalized);
}

/** Reads a Blob into a bare base64 string (no data-URL prefix). */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('read_failed'));
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

export async function transcribeAudio(blob: Blob, language?: string): Promise<TranscribeOutcome> {
  let audioBase64: string;
  try {
    audioBase64 = await blobToBase64(blob);
  } catch (err) {
    logger.warn('transcribe_blob_read_failed', { module: 'ai-transcribe' }, err);
    return { ok: false, error: 'failed' };
  }

  const headers = aiRequestHeaders();
  const requestId = headers['X-Request-Id'];
  let response: Response;
  try {
    response = await fetch(`${getSyncWorkerUrl()}/transcribe`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ audioBase64, mimeType: blob.type || 'audio/webm', language }),
    });
  } catch {
    logger.info('transcribe_offline', { module: 'ai-transcribe', requestId });
    return { ok: false, error: 'offline' };
  }

  if (response.status === 503) return { ok: false, error: 'not_configured' };
  if (response.status === 429) return { ok: false, error: 'rate_limited', cooldown: await readCooldown(response) };
  if (!response.ok) {
    logger.warn('transcribe_http_failed', { module: 'ai-transcribe', requestId, status: response.status });
    return { ok: false, error: 'failed' };
  }

  try {
    const data = (await response.json()) as { text?: unknown };
    return { ok: true, text: typeof data.text === 'string' ? data.text : '' };
  } catch (err) {
    logger.warn('transcribe_parse_failed', { module: 'ai-transcribe', requestId }, err);
    return { ok: false, error: 'failed' };
  }
}
