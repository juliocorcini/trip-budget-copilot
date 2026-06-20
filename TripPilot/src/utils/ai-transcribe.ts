import { getSyncWorkerUrl } from '@/data/sync/config';

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
  | { ok: false; error: TranscribeError };

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
  } catch {
    return { ok: false, error: 'failed' };
  }

  let response: Response;
  try {
    response = await fetch(`${getSyncWorkerUrl()}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioBase64, mimeType: blob.type || 'audio/webm', language }),
    });
  } catch {
    return { ok: false, error: 'offline' };
  }

  if (response.status === 503) return { ok: false, error: 'not_configured' };
  if (response.status === 429) return { ok: false, error: 'rate_limited' };
  if (!response.ok) return { ok: false, error: 'failed' };

  try {
    const data = (await response.json()) as { text?: unknown };
    return { ok: true, text: typeof data.text === 'string' ? data.text : '' };
  } catch {
    return { ok: false, error: 'failed' };
  }
}
