import { getInstallationId } from '@/utils/entity-factory';

/** DEC-107: deployed signaling worker (rooms + opaque relay only). */
const DEFAULT_SYNC_WORKER_URL = 'https://trippilot-sync.trippilot.workers.dev';

export function getSyncWorkerUrl(): string {
  return import.meta.env.VITE_SYNC_WORKER_URL ?? DEFAULT_SYNC_WORKER_URL;
}

/**
 * DEC-251 (Onda B): JSON headers for the AI worker routes, carrying the
 * pseudonymous install id so the worker can attribute server-authoritative
 * token spend. The id is non-PII and never required for the call to succeed —
 * if it is missing the worker simply skips accounting.
 *
 * DEC-443 (OBS-4): each call also mints an `X-Request-Id`. The worker adopts
 * it, logs it, and echoes it back, so one id correlates the app-side failure
 * with the worker-side request log end to end.
 */
export function aiRequestHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Install-Id': getInstallationId(),
    'X-Request-Id': newRequestId(),
  };
}

/** UUID with a graceful fallback for old WebViews without crypto.randomUUID. */
export function newRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  }
}

export const WEBRTC_CONNECT_TIMEOUT_MS = 8000;

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];
