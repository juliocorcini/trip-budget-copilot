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
  MAILBOX: DurableObjectNamespace;
  /**
   * DEC-206 (G2): Groq API key for cloud receipt OCR. Lives ONLY here as a
   * Worker secret — it never reaches the client. Absent in dev/preview, where
   * the /ocr route reports `ocr_not_configured` so the app degrades gracefully.
   */
  GROQ_API_KEY?: string;
}

/** No ambiguous chars (0/O, 1/I/L) — codes are sometimes read aloud. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const ROOM_TTL_MS = 10 * 60 * 1000;

// FIELD item 8 — async encrypted mailbox (store-and-forward). The worker only
// ever stores opaque ciphertext sealed to the recipient's public key; it can
// read nothing. Conservative caps keep an addressable-by-actorId mailbox from
// being abused, and a sliding TTL wipes anything left undelivered.
const MAILBOX_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAILBOX_MAX_MESSAGES = 40;
const MAILBOX_MAX_TOTAL_BYTES = 4_000_000;
const MAILBOX_MAX_MESSAGE_BYTES = 1_000_000;
const MAILBOX_CHUNK_BYTES = 120_000; // under the 128 KiB Durable Object value limit
const ACTOR_ID_RE = /^[0-9a-fA-F-]{8,64}$/;

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// DEC-206 (G2): cloud receipt OCR. The client posts a single receipt image and
// gets back STRUCTURED line items. The image is forwarded to Groq's vision model
// and the response is relayed verbatim — nothing is persisted or logged here.
const OCR_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
// A data URL holds ~1.37 chars per source byte; ~9 MB of base64 ≈ a 6.5 MB image.
// The client downscales receipts far below this, so the cap is a pure abuse guard.
const OCR_MAX_IMAGE_CHARS = 9_000_000;
// Lean extractor prompt (token-economical, no quality loss): pure JSON, no prose,
// every semantic rule kept. The image stays at the client's 1600px/q0.82 downscale
// — high enough for dense grocery receipts — so token spend is dominated by the
// image + item count, not this prompt.
const OCR_PROMPT = [
  'Read this receipt/bill photo (any shop, any country). Return ONLY this JSON, no prose, no markdown:',
  '{"merchant":string|null,"currency":string|null,"total":number|null,"items":[{"description":string,"qty":number,"unitPrice":number,"lineTotal":number}]}',
  'Rules: one entry per purchased product; lineTotal = the printed line amount (qty*unitPrice); currency = ISO 4217 code or null; total = final amount paid or null; numbers are plain dot-decimals with no symbols; never list subtotal/tax/tip/service/discount/change/payment as items; preserve product names as printed; do not invent items; if unreadable return {"merchant":null,"currency":null,"total":null,"items":[]}.',
].join('\n');

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

/**
 * DEC-206 (G2): relay a single receipt image to Groq vision and return the
 * model's raw JSON ({merchant, currency, total, items}). The client's domain
 * parser is the source of truth for normalisation, so the worker stays a thin,
 * stateless boundary. Every failure maps to a stable status the client can act
 * on (503 not configured, 429 rate limited, 502 upstream/parse failure).
 */
async function handleOcr(request: Request, env: Env): Promise<Response> {
  if (!env.GROQ_API_KEY) return json({ error: 'ocr_not_configured' }, 503);

  let body: { imageDataUrl?: unknown };
  try {
    body = (await request.json()) as { imageDataUrl?: unknown };
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  const imageDataUrl = body.imageDataUrl;
  if (typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
    return json({ error: 'bad_image' }, 400);
  }
  if (imageDataUrl.length > OCR_MAX_IMAGE_CHARS) return json({ error: 'image_too_large' }, 413);

  let upstream: Response;
  try {
    upstream = await fetch(GROQ_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: OCR_MODEL,
        temperature: 0,
        // Headroom for long grocery receipts (40+ items ≈ 1.5k tokens of JSON).
        // A low cap would TRUNCATE big receipts into invalid JSON — the opposite
        // of saving money. max_tokens only caps; unused budget costs nothing.
        max_tokens: 4096,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: OCR_PROMPT },
              { type: 'image_url', image_url: { url: imageDataUrl } },
            ],
          },
        ],
      }),
    });
  } catch {
    return json({ error: 'ocr_upstream_unreachable' }, 502);
  }

  if (upstream.status === 429) return json({ error: 'ocr_rate_limited' }, 429);
  if (!upstream.ok) return json({ error: 'ocr_upstream_error', upstreamStatus: upstream.status }, 502);

  let payload: { choices?: { message?: { content?: unknown } }[] };
  try {
    payload = (await upstream.json()) as typeof payload;
  } catch {
    return json({ error: 'ocr_unparseable' }, 502);
  }
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== 'string') return json({ error: 'ocr_empty' }, 502);

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return json({ error: 'ocr_unparseable' }, 502);
  }
  return json(parsed);
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

    // DEC-206 (G2) — cloud receipt OCR. Stateless proxy to Groq vision.
    if (request.method === 'POST' && url.pathname === '/ocr') {
      return handleOcr(request, env);
    }

    // FIELD item 8 — async mailbox addressed by the recipient's actorId.
    const mailboxMatch = url.pathname.match(/^\/mailbox\/([^/]+)$/);
    if (mailboxMatch && (request.method === 'POST' || request.method === 'GET')) {
      const actorId = decodeURIComponent(mailboxMatch[1]!);
      if (!ACTOR_ID_RE.test(actorId)) return json({ error: 'bad_actor' }, 400);
      const stub = env.MAILBOX.get(env.MAILBOX.idFromName(actorId));
      return stub.fetch(new Request(`https://mailbox.internal/${request.method === 'POST' ? 'put' : 'drain'}`, request));
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

interface MailboxEntry {
  id: string;
  at: number;
  /** Total ciphertext bytes, summed across chunks (for the size cap). */
  size: number;
  chunks: number;
}

/**
 * FIELD item 8 — one mailbox per recipient actorId. Holds opaque sealed blobs
 * (ciphertext the recipient decrypts with its private key — the worker can read
 * nothing). POST appends, GET drains (returns then deletes). Large blobs are
 * split into <128 KiB chunks; a sliding alarm wipes anything undelivered after
 * the TTL. Caps bound count/size so an actorId cannot be flooded.
 */
export class Mailbox {
  constructor(private state: DurableObjectState) {}

  private async index(): Promise<MailboxEntry[]> {
    return (await this.state.storage.get<MailboxEntry[]>('index')) ?? [];
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/put') {
      let body: { blob?: unknown };
      try {
        body = (await request.json()) as { blob?: unknown };
      } catch {
        return json({ error: 'bad_json' }, 400);
      }
      const blob = body.blob;
      if (typeof blob !== 'string' || blob.length === 0) return json({ error: 'bad_blob' }, 400);
      if (blob.length > MAILBOX_MAX_MESSAGE_BYTES) return json({ error: 'too_large' }, 413);

      const index = await this.index();
      const totalBytes = index.reduce((sum, e) => sum + e.size, 0);
      if (index.length >= MAILBOX_MAX_MESSAGES || totalBytes + blob.length > MAILBOX_MAX_TOTAL_BYTES) {
        return json({ error: 'mailbox_full' }, 429);
      }

      const id = crypto.randomUUID();
      const chunks: number = Math.ceil(blob.length / MAILBOX_CHUNK_BYTES);
      const writes: Record<string, string> = {};
      for (let i = 0; i < chunks; i++) {
        writes[`m:${id}:${i}`] = blob.slice(i * MAILBOX_CHUNK_BYTES, (i + 1) * MAILBOX_CHUNK_BYTES);
      }
      await this.state.storage.put(writes);
      index.push({ id, at: Date.now(), size: blob.length, chunks });
      await this.state.storage.put('index', index);
      // Sliding TTL — every deposit pushes the wipe forward; undelivered mail
      // never expires earlier than TTL after the LAST write.
      await this.state.storage.setAlarm(Date.now() + MAILBOX_TTL_MS);
      return json({ ok: true, id });
    }

    if (request.method === 'GET' && url.pathname === '/drain') {
      const index = await this.index();
      const messages: { id: string; at: number; blob: string }[] = [];
      const keysToDelete: string[] = ['index'];
      for (const entry of index) {
        let blob = '';
        for (let i = 0; i < entry.chunks; i++) {
          const key = `m:${entry.id}:${i}`;
          blob += (await this.state.storage.get<string>(key)) ?? '';
          keysToDelete.push(key);
        }
        messages.push({ id: entry.id, at: entry.at, blob });
      }
      if (keysToDelete.length > 0) await this.state.storage.delete(keysToDelete);
      await this.state.storage.deleteAlarm();
      return json({ messages });
    }

    return json({ error: 'not_found' }, 404);
  }

  async alarm(): Promise<void> {
    await this.state.storage.deleteAll();
  }
}