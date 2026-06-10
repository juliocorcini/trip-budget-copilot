/** DEC-107: deployed signaling worker (rooms + opaque relay only). */
const DEFAULT_SYNC_WORKER_URL = 'https://trippilot-sync.trippilot.workers.dev';

export function getSyncWorkerUrl(): string {
  return import.meta.env.VITE_SYNC_WORKER_URL ?? DEFAULT_SYNC_WORKER_URL;
}

export const WEBRTC_CONNECT_TIMEOUT_MS = 8000;

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];
