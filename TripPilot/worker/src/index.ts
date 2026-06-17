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
   * DEC-207 (Shared Participant Link): persistent, re-readable encrypted share
   * channel. The worker only ever stores opaque ciphertext — the AES key lives
   * in the link's URL fragment and never reaches here. Absent in older
   * deploys, where /share routes report `share_not_configured`.
   */
  SHARE_STORE?: KVNamespace;
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
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Share-Token',
};

// DEC-207 — persistent encrypted share channel (KV). One key per share holds
// the owner's ciphertext statement; a sibling key holds the guest's appended
// (also ciphertext) responses. The worker reads neither — secrecy is the AES
// key in the URL fragment. Owner-only ops (update/revoke/pull responses) are
// gated by a write token whose SHA-256 hash is the only thing stored.
const SHARE_TTL_SECONDS = 90 * 24 * 60 * 60; // sliding: refreshed on every owner write
const SHARE_REVOKE_TTL_SECONDS = 14 * 24 * 60 * 60; // tombstone so a revoked link reads 410
const SHARE_MAX_BLOB_BYTES = 600_000; // statement ciphertext (a long trip ≈ a few KB)
const SHARE_RESP_MAX_ITEMS = 300;
const SHARE_RESP_MAX_TOTAL_BYTES = 800_000;
const SHARE_RESP_MAX_ITEM_BYTES = 60_000;
const SHARE_ID_RE = /^[0-9a-fA-F-]{8,64}$/;

interface ShareRecord {
  blob: string;
  revision: number;
  updatedAt: number;
  tokenHash: string;
  revoked?: boolean;
}

interface ShareResponseItem {
  id: string;
  blob: string;
  at: number;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

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

/**
 * DEC-207 — persistent encrypted share channel. Sub-routes under /share/*:
 *   POST   /share                 create  → { id, writeToken, expiresAt }
 *   GET    /share/:id             read the ciphertext statement (open: link id is the address)
 *   PUT    /share/:id             owner replaces the statement (x-share-token)
 *   DELETE /share/:id             owner revokes (x-share-token) → future reads 410
 *   POST   /share/:id/responses   guest appends a ciphertext response (no token, capped)
 *   GET    /share/:id/responses   owner pulls responses (x-share-token)
 * Everything stored is opaque ciphertext; the worker can read nothing.
 */
async function handleShare(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.SHARE_STORE) return json({ error: 'share_not_configured' }, 503);
  const kv = env.SHARE_STORE;

  if (request.method === 'POST' && url.pathname === '/share') {
    let body: { blob?: unknown; revision?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return json({ error: 'bad_json' }, 400);
    }
    const blob = body.blob;
    if (typeof blob !== 'string' || blob.length === 0) return json({ error: 'bad_blob' }, 400);
    if (blob.length > SHARE_MAX_BLOB_BYTES) return json({ error: 'too_large' }, 413);

    const id = crypto.randomUUID();
    const writeToken = randomToken();
    const record: ShareRecord = {
      blob,
      revision: typeof body.revision === 'number' && body.revision > 0 ? body.revision : 1,
      updatedAt: Date.now(),
      tokenHash: await sha256Hex(writeToken),
    };
    await kv.put(`s:${id}`, JSON.stringify(record), { expirationTtl: SHARE_TTL_SECONDS });
    return json({ id, writeToken, expiresAt: Date.now() + SHARE_TTL_SECONDS * 1000 });
  }

  const match = url.pathname.match(/^\/share\/([^/]+)(\/responses)?$/);
  if (!match) return json({ error: 'not_found' }, 404);
  const id = decodeURIComponent(match[1]!);
  const isResponses = match[2] === '/responses';
  if (!SHARE_ID_RE.test(id)) return json({ error: 'bad_id' }, 400);

  const recordRaw = await kv.get(`s:${id}`);
  if (recordRaw === null) return json({ error: 'not_found' }, 404);
  const record = JSON.parse(recordRaw) as ShareRecord;
  if (record.revoked) return json({ error: 'revoked' }, 410);

  const verifyToken = async (): Promise<boolean> => {
    const token = request.headers.get('X-Share-Token');
    if (!token) return false;
    return (await sha256Hex(token)) === record.tokenHash;
  };

  // --- /share/:id (statement slot) ---
  if (!isResponses) {
    if (request.method === 'GET') {
      return json({ blob: record.blob, revision: record.revision, updatedAt: record.updatedAt });
    }
    if (request.method === 'PUT') {
      if (!(await verifyToken())) return json({ error: 'forbidden' }, 403);
      let body: { blob?: unknown; revision?: unknown };
      try {
        body = (await request.json()) as typeof body;
      } catch {
        return json({ error: 'bad_json' }, 400);
      }
      const blob = body.blob;
      if (typeof blob !== 'string' || blob.length === 0) return json({ error: 'bad_blob' }, 400);
      if (blob.length > SHARE_MAX_BLOB_BYTES) return json({ error: 'too_large' }, 413);
      const revision =
        typeof body.revision === 'number' && body.revision > record.revision
          ? body.revision
          : record.revision + 1;
      const next: ShareRecord = { ...record, blob, revision, updatedAt: Date.now() };
      await kv.put(`s:${id}`, JSON.stringify(next), { expirationTtl: SHARE_TTL_SECONDS });
      return json({ ok: true, revision });
    }
    if (request.method === 'DELETE') {
      if (!(await verifyToken())) return json({ error: 'forbidden' }, 403);
      const tombstone: ShareRecord = { ...record, revoked: true, updatedAt: Date.now() };
      await kv.put(`s:${id}`, JSON.stringify(tombstone), { expirationTtl: SHARE_REVOKE_TTL_SECONDS });
      await kv.delete(`r:${id}`);
      return json({ ok: true });
    }
    return json({ error: 'not_found' }, 404);
  }

  // --- /share/:id/responses (guest → owner channel) ---
  if (request.method === 'POST') {
    let body: { id?: unknown; blob?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return json({ error: 'bad_json' }, 400);
    }
    const respId = body.id;
    const blob = body.blob;
    if (typeof respId !== 'string' || respId.length === 0 || respId.length > 80) {
      return json({ error: 'bad_id' }, 400);
    }
    if (typeof blob !== 'string' || blob.length === 0) return json({ error: 'bad_blob' }, 400);
    if (blob.length > SHARE_RESP_MAX_ITEM_BYTES) return json({ error: 'too_large' }, 413);

    const existingRaw = await kv.get(`r:${id}`);
    const items: ShareResponseItem[] = existingRaw ? (JSON.parse(existingRaw) as ShareResponseItem[]) : [];
    // Idempotent append: a retried response (same id) overwrites in place.
    const filtered = items.filter((it) => it.id !== respId);
    filtered.push({ id: respId, blob, at: Date.now() });
    const totalBytes = filtered.reduce((sum, it) => sum + it.blob.length, 0);
    if (filtered.length > SHARE_RESP_MAX_ITEMS || totalBytes > SHARE_RESP_MAX_TOTAL_BYTES) {
      return json({ error: 'responses_full' }, 429);
    }
    await kv.put(`r:${id}`, JSON.stringify(filtered), { expirationTtl: SHARE_TTL_SECONDS });
    return json({ ok: true });
  }
  if (request.method === 'GET') {
    if (!(await verifyToken())) return json({ error: 'forbidden' }, 403);
    const existingRaw = await kv.get(`r:${id}`);
    const items: ShareResponseItem[] = existingRaw ? (JSON.parse(existingRaw) as ShareResponseItem[]) : [];
    return json({ items });
  }
  return json({ error: 'not_found' }, 404);
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

    // DEC-207 — persistent encrypted share channel (shared participant link).
    if (url.pathname === '/share' || url.pathname.startsWith('/share/')) {
      return handleShare(request, env, url);
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