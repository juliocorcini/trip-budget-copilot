import { getSyncWorkerUrl } from './config';

/**
 * DEC-207 S7 — client transport for the real-time share relay (best-effort).
 * A thin WebSocket wrapper that auto-reconnects and carries only tiny "go pull"
 * signals — never statement data (that stays E2E-encrypted in KV). When the
 * relay is down or the peer is offline, signals are simply lost and the app
 * falls back to its async pull/refresh (the guaranteed floor). The whole layer
 * is disposable: nothing here persists, so dropping it changes nothing but
 * latency.
 */

export type ShareSignalType = 'upd' | 'resp';

export interface ShareSignalMessage {
  /** 'upd' = owner re-published the statement; 'resp' = guest posted a response. */
  t: ShareSignalType;
  /** Statement revision (owner → guest), informational. */
  rev?: number;
}

export interface ShareSignalHandle {
  send(msg: ShareSignalMessage): void;
  close(): void;
}

const MAX_BACKOFF_MS = 15_000;
const OUTBOX_CAP = 8;

function signalUrl(shareId: string): string {
  // https→wss, http→ws — the relay shares the worker origin.
  const base = getSyncWorkerUrl().replace(/^http/, 'ws').replace(/\/+$/, '');
  return `${base}/share/${encodeURIComponent(shareId)}/ws`;
}

function parseSignal(data: unknown): ShareSignalMessage | null {
  if (typeof data !== 'string') return null;
  try {
    const obj = JSON.parse(data) as { t?: unknown; rev?: unknown };
    if (obj.t === 'upd' || obj.t === 'resp') {
      return { t: obj.t, rev: typeof obj.rev === 'number' ? obj.rev : undefined };
    }
  } catch {
    // not a signal frame
  }
  return null;
}

/**
 * Open a live signal channel for one share. Returns immediately; the socket
 * connects in the background and reconnects with capped exponential backoff.
 * `onMessage` fires for every relayed signal from the OTHER side. Always pair
 * with `close()` (e.g. in a React cleanup) so the socket and its reconnect
 * timer are released.
 */
export function connectShareSignal(
  shareId: string,
  onMessage: (msg: ShareSignalMessage) => void,
  onStatus?: (open: boolean) => void,
): ShareSignalHandle {
  let socket: WebSocket | null = null;
  let closed = false;
  let retry = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  // Signals fired before the socket opens (or during a reconnect) wait here and
  // flush on open — so "owner refreshes the instant the sheet mounts" still
  // reaches a guest who is already connected.
  let outbox: ShareSignalMessage[] = [];

  const flush = (): void => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    for (const msg of outbox) {
      try {
        socket.send(JSON.stringify(msg));
      } catch {
        // best-effort
      }
    }
    outbox = [];
  };

  const scheduleReconnect = (): void => {
    if (closed || reconnectTimer) return;
    const delay = Math.min(1_000 * 2 ** retry, MAX_BACKOFF_MS) + Math.random() * 400;
    retry += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      open();
    }, delay);
  };

  function open(): void {
    if (closed) return;
    try {
      socket = new WebSocket(signalUrl(shareId));
    } catch {
      scheduleReconnect();
      return;
    }
    socket.addEventListener('open', () => {
      retry = 0;
      onStatus?.(true);
      flush();
    });
    socket.addEventListener('message', (event) => {
      const msg = parseSignal((event as MessageEvent).data);
      if (msg) onMessage(msg);
    });
    socket.addEventListener('close', () => {
      onStatus?.(false);
      if (!closed) scheduleReconnect();
    });
    socket.addEventListener('error', () => {
      try {
        socket?.close();
      } catch {
        // ignore — close handler reconnects
      }
    });
  }

  open();

  return {
    send(msg: ShareSignalMessage): void {
      if (socket && socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(JSON.stringify(msg));
          return;
        } catch {
          // fall through to queue
        }
      }
      if (outbox.length < OUTBOX_CAP) outbox.push(msg);
    },
    close(): void {
      closed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      try {
        socket?.close();
      } catch {
        // ignore
      }
      socket = null;
      outbox = [];
    },
  };
}
