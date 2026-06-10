/**
 * trippilot-sync — DEC-107 signaling worker.
 *
 * Scope is intentionally tiny: create short-lived rooms and relay opaque
 * messages between exactly two WebSocket peers. Payloads are E2E encrypted
 * by the clients (the AES key travels inside the QR code and never reaches
 * this worker). Nothing is persisted beyond the room's lifetime.
 */

export interface Env {
  SYNC_ROOM: DurableObjectNamespace;
}

/** No ambiguous chars (0/O, 1/I/L) — codes are sometimes read aloud. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const ROOM_TTL_MS = 10 * 60 * 1000;

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function generateRoomCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = '';
  for (const byte of bytes) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return code;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method === 'POST' && url.pathname === '/rooms') {
      const code = generateRoomCode();
      const stub = env.SYNC_ROOM.get(env.SYNC_ROOM.idFromName(code));
      await stub.fetch('https://room.internal/open', { method: 'POST' });
      return json({ code });
    }

    const wsMatch = url.pathname.match(/^\/rooms\/([A-Z2-9]{4,12})\/ws$/);
    if (request.method === 'GET' && wsMatch) {
      const stub = env.SYNC_ROOM.get(env.SYNC_ROOM.idFromName(wsMatch[1]!));
      return stub.fetch(request);
    }

    return json({ error: 'not_found' }, 404);
  },
};

export class SyncRoom {
  private sockets: WebSocket[] = [];
  private opened = false;

  constructor(private state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/open') {
      this.opened = true;
      await this.state.storage.setAlarm(Date.now() + ROOM_TTL_MS);
      return json({ ok: true });
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return json({ error: 'expected_websocket' }, 426);
    }
    if (!this.opened && this.sockets.length === 0) {
      // The DO may have restarted; accept reconnects to a known-named room
      // only within the alarm window. A fresh instance without an alarm is
      // an expired/unknown room.
      const alarm = await this.state.storage.getAlarm();
      if (alarm === null) return json({ error: 'room_not_found' }, 404);
      this.opened = true;
    }
    if (this.sockets.length >= 2) {
      return json({ error: 'room_full' }, 409);
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();
    this.sockets.push(server);

    server.addEventListener('message', (event) => {
      for (const socket of this.sockets) {
        if (socket !== server) {
          try {
            socket.send(event.data);
          } catch {
            // Peer already gone; close handler cleans up.
          }
        }
      }
    });

    const cleanup = () => {
      this.sockets = this.sockets.filter((s) => s !== server);
      for (const socket of this.sockets) {
        try {
          socket.send(JSON.stringify({ type: 'peer-left' }));
        } catch {
          // Ignore: socket on its way out.
        }
      }
    };
    server.addEventListener('close', cleanup);
    server.addEventListener('error', cleanup);

    if (this.sockets.length === 2) {
      for (const socket of this.sockets) {
        socket.send(JSON.stringify({ type: 'peer-joined' }));
      }
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  async alarm(): Promise<void> {
    for (const socket of this.sockets) {
      try {
        socket.close(4000, 'room_expired');
      } catch {
        // Already closed.
      }
    }
    this.sockets = [];
    this.opened = false;
    await this.state.storage.deleteAll();
  }
}