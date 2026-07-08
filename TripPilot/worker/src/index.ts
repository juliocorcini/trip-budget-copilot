/**
 * trippilot-sync — DEC-107 signaling worker.
 *
 * Scope is intentionally tiny: create short-lived rooms and relay opaque
 * messages between exactly two WebSocket peers. Payloads are E2E encrypted
 * by the clients (the AES key travels inside the QR code and never reaches
 * this worker). Nothing is persisted beyond the room's lifetime.
 */
import { logEvent, routeTemplate } from './logger';
import { FCM } from 'fcm-cloudflare-workers';
import {
  sanitizeSharePreview,
  randomSlugSuffix,
  composeSlug,
  SLUG_BASE_RE,
  SLUG_RE,
  CANONICAL_SHARE_ID_RE,
  LINK_KEY_RE,
  type WorkerSharePreview,
} from './share-preview';

/**
 * DEC-439 (SEC-2): minimal local type for the native Workers rate limiting
 * binding (GA) — kept local so no @cloudflare/workers-types bump is required.
 */
interface RateLimiterBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  SYNC_ROOM: DurableObjectNamespace;
  MAILBOX: DurableObjectNamespace;
  /**
   * DEC-207 S7 (real-time, best-effort): pure WebSocket fanout relay keyed by
   * shareId. TRANSPORT ONLY — it carries tiny "go pull" signals (no private
   * data; the statement/responses stay E2E-encrypted in KV). Disposable by
   * design (portability: swap the relay for any WS server, data is untouched).
   * Absent in older deploys, where the /share/:id/ws route reports 426/closed.
   */
  SHARE_SIGNAL?: DurableObjectNamespace;
  /**
   * DEC-207 (Shared Participant Link) — STRONGLY-CONSISTENT store. Each shareId
   * maps to one `ShareStore` Durable Object holding the (ciphertext) statement
   * and the (ciphertext) guest responses. A DO is used instead of KV because the
   * live table polls right after a write: KV is only eventually consistent (a
   * `put` does NOT invalidate the colo's ~60s read cache), so a guest's pick
   * stayed invisible to the owner and to the guest itself for up to a minute —
   * the table looked frozen. A DO gives read-after-write, so every poll is fresh.
   */
  SHARE_STORE_DO?: DurableObjectNamespace;
  /**
   * KV namespace with two lives: (1) legacy pre-DO share data (read-only);
   * (2) DEC-445/446 — `preview:{id}` summary blobs + `slug:{slug}` → shareId
   * mappings (both TTL'd like the share). Previews/slugs tolerate KV's eventual
   * consistency (crawlers and link opens, not live polling).
   */
  SHARE_STORE?: KVNamespace;
  /**
   * DEC-206 (G2): Groq API key for cloud receipt OCR. Lives ONLY here as a
   * Worker secret — it never reaches the client. Absent in dev/preview, where
   * the /ocr route reports `ocr_not_configured` so the app degrades gracefully.
   */
  GROQ_API_KEY?: string;
  /**
   * DEC-248 (Admin dashboard): one global SQLite Durable Object that stores
   * anonymous, NON-MONETARY usage telemetry — one upserted row per installation
   * (the "who + what they use" list) plus a per-(install,day) heartbeat table for
   * DAU/WAU/MAU. The DO rejects any field outside its allowlist, so monetary
   * values can never be stored. Absent in older deploys (routes report
   * `telemetry_not_configured`).
   */
  TELEMETRY?: DurableObjectNamespace;
  /**
   * DEC-248: bearer token gating the read-only `/admin/*` query routes. Worker
   * secret only — never in the client. Absent → `/admin` reports
   * `admin_not_configured` (the dashboard then shows a setup notice).
   */
  ADMIN_TOKEN?: string;
  /**
   * DEC-348 (G2, this wave): R2 bucket for shared images, now stored as
   * ACCESS-CONTROLLED PLAINTEXT (real content-type) so members + `/g/` web guests
   * can view/download them; secrecy is the unguessable id + TTL + delete-on-revoke
   * (DEC-207 unchanged — messages/debts/names stay ciphertext; only images here).
   * Legacy E2E ciphertext (`application/octet-stream`) is still served verbatim.
   * Objects carry an `expiresAt` in customMetadata; GET enforces the TTL
   * (delete-on-read-if-expired) and a bucket lifecycle rule is the hard backstop.
   * Absent in older deploys → `/img` reports `images_not_configured`.
   */
  MEDIA?: R2Bucket;
  /**
   * DEC-439 (SEC-2, 2026-07-03 audit): edge rate limiters (see wrangler.jsonc).
   * All three are optional — an absent binding fails OPEN (Â-RL-FAIL-OPEN), so
   * local dev and older deploys keep working with no limit rather than a 500.
   */
  RL_AI?: RateLimiterBinding;
  RL_INGEST?: RateLimiterBinding;
  RL_SHARE_WRITE?: RateLimiterBinding;
  /**
   * Web Push VAPID: KV namespace storing push subscriptions keyed by installId.
   * Each entry is a JSON PushSubscription. Absent in older deploys → /push
   * routes report `push_not_configured`.
   */
  PUSH_SUBS?: KVNamespace;
  /** VAPID private key (base64url). Worker secret. */
  VAPID_PRIVATE_KEY?: string;
  /** VAPID public key (base64url). Same as the client's applicationServerKey. */
  VAPID_PUBLIC_KEY?: string;
  /** VAPID subject (mailto: or https: URL for the push service). */
  VAPID_SUBJECT?: string;
  /**
   * FCM service account JSON (stringified). Used by fcm-cloudflare-workers
   * to authenticate with the FCM HTTP v1 API. Worker secret.
   */
  FCM_SERVICE_ACCOUNT?: string;
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
  // DEC-251 (Onda B): X-Install-Id attributes AI token usage to a pseudonymous
  // install. It carries no PII and is never required for the call to succeed.
  // DEC-443 (OBS-4): X-Request-Id is the end-to-end correlation id — accepted
  // from the app and exposed back so the client can log the same id.
  'Access-Control-Allow-Headers': 'Content-Type, X-Share-Token, Authorization, X-Install-Id, X-Request-Id, X-Img-TTL',
  'Access-Control-Expose-Headers': 'X-Request-Id',
};

/**
 * DEC-440 (SEC-4): the `/admin/*` routes are the only ones where CORS `*` is
 * needlessly broad — they are consumed exclusively by the app's own admin page.
 * Defense in depth: echo the origin only when allowlisted (browser JS on any
 * other origin then cannot read the response, token or not).
 */
const ADMIN_ALLOWED_ORIGINS = new Set([
  'https://trippilot.pages.dev',
  // Vite dev server (local admin dashboard during development).
  'http://localhost:5173',
]);

function withAdminCors(res: Response, request: Request): Response {
  const origin = request.headers.get('Origin') ?? '';
  const headers = new Headers(res.headers);
  if (ADMIN_ALLOWED_ORIGINS.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
  } else {
    headers.delete('Access-Control-Allow-Origin');
  }
  headers.set('Vary', 'Origin');
  return new Response(res.body, { status: res.status, headers });
}

/**
 * DEC-439 (SEC-2): shared edge rate-limit check. Key preference is the
 * pseudonymous install id (stable per app install — the recommended stable
 * identifier) with the connecting IP as fallback for callers without one.
 * Fails OPEN on any error/absence — throttling must never become an outage.
 */
async function edgeRateLimited(
  limiter: RateLimiterBinding | undefined,
  request: Request,
  installId: string,
): Promise<boolean> {
  if (!limiter) {
    logEvent('warn', 'rate_limiter_missing', {});
    return false;
  }
  const key = installId || (request.headers.get('CF-Connecting-IP') ?? 'unknown');
  try {
    const { success } = await limiter.limit({ key });
    return !success;
  } catch (err) {
    // Â-RL-FAIL-OPEN: throttling must never become an outage — but the audit's
    // whole point is that failing open SILENTLY hides real breakage. Log it.
    logEvent('warn', 'rate_limiter_error', { err });
    return false;
  }
}

/**
 * 429 body for the AI routes in the SAME shape as the Groq passthrough
 * (`rateLimitBody`) — `aiUnavailable` + `retryAfterSec` — so the client's
 * existing cooldown UI (FB-26) handles an edge limit with zero changes.
 */
function edgeRateLimitBody(
  fn: string,
): { error: string; aiUnavailable: true; retryAfterSec: number; scope: 'minute' } {
  return { error: `${fn}_rate_limited`, aiUnavailable: true, retryAfterSec: 60, scope: 'minute' };
}

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

const SHARE_STMT_CHUNK_BYTES = 120_000; // DO value cap is 128 KiB; chunk the statement under it

// DEC-348 (G2, this wave — REVERSES the image E2E of DEC-342/343) — shared images
// on R2 as ACCESS-CONTROLLED PLAINTEXT. The Worker now stores + serves the REAL
// content-type so a member or a no-app `/g/` web guest can `<img src>`/download it
// directly. Deltas vs the old E2E note:
//   1) the body is the real image (jpeg/png/webp); we store its content-type and
//      echo it on GET. (Legacy `application/octet-stream` ciphertext uploaded by
//      1.2.4-rc is still accepted + served verbatim, so old refs keep decrypting
//      client-side.) DEC-207 still holds for messages/debts/names — only IMAGES
//      are plaintext; the route only ever holds images.
//   2) there is NO D1 budget ledger here (this worker has no D1) — instead each
//      object carries an `expiresAt` in customMetadata and GET enforces it
//      (delete-on-read-if-expired); a bucket lifecycle rule is the hard backstop
//      and a dashboard budget alert is the cost guard.
// The id is the read capability (an unguessable UUID handed out only inside the
// E2E share payload), matching how the share link's id IS its read capability.
const IMG_ID_RE = /^[0-9a-fA-F-]{8,64}$/;
// Allowed stored content-types: real images + legacy ciphertext (octet-stream).
const IMG_ALLOWED_CT = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/octet-stream',
]);
// Client compresses to a few hundred KB; 2.1 MB is the hard per-object ceiling.
const IMG_MAX_BYTES = 2_100_000;
const IMG_DEFAULT_TTL_MS = 90 * 24 * 60 * 60 * 1000; // matches the share statement TTL
const IMG_MAX_TTL_MS = 180 * 24 * 60 * 60 * 1000; // bound any client-supplied TTL
const IMG_CACHE_IMMUTABLE = 'public, max-age=31536000, immutable'; // the bytes for an id never change

/**
 * DEC-348 (G2) — R2 image channel. Sub-routes under /img/:id:
 *   PUT    /img/:id   store an image; keeps its real Content-Type; optional X-Img-TTL (sec)
 *   GET    /img/:id   serve the image with its real Content-Type (TTL-enforced; 404 once expired)
 *   DELETE /img/:id   owner/guest drops it (revoke / hide-cleanup)
 * The route only ever holds images; secrecy is the unguessable id + TTL + revoke.
 */
async function handleImg(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.MEDIA) return json({ error: 'images_not_configured' }, 503);
  const match = url.pathname.match(/^\/img\/([^/]+)$/);
  if (!match) return json({ error: 'not_found' }, 404);
  const id = decodeURIComponent(match[1]!);
  if (!IMG_ID_RE.test(id)) return json({ error: 'bad_id' }, 400);

  if (request.method === 'PUT') {
    const body = await request.arrayBuffer();
    if (body.byteLength === 0) return json({ error: 'empty_image' }, 400);
    if (body.byteLength > IMG_MAX_BYTES) return json({ error: 'too_large' }, 413);
    // Keep the real content-type so GET can serve a viewable/downloadable image;
    // an unknown type falls back to jpeg (the client always sends jpeg).
    const rawCt = (request.headers.get('Content-Type') ?? '').split(';')[0]!.trim().toLowerCase();
    const contentType = IMG_ALLOWED_CT.has(rawCt) ? rawCt : 'image/jpeg';
    const ttlMs = clampImgTtlMs(request.headers.get('X-Img-TTL'));
    const expiresAt = Date.now() + ttlMs;
    await env.MEDIA.put(id, body, {
      httpMetadata: { contentType, cacheControl: IMG_CACHE_IMMUTABLE },
      customMetadata: { expiresAt: String(expiresAt) },
    });
    return json({ ok: true, id, expiresAt });
  }

  if (request.method === 'GET') {
    const object = await env.MEDIA.get(id);
    if (!object) return json({ error: 'not_found' }, 404);
    // Anonymous TTL guard: an expired object is deleted on read and reported gone.
    const expiresAt = Number(object.customMetadata?.expiresAt ?? 0);
    if (expiresAt > 0 && Date.now() > expiresAt) {
      await env.MEDIA.delete(id);
      return json({ error: 'expired' }, 404);
    }
    const headers = new Headers(CORS_HEADERS);
    object.writeHttpMetadata(headers);
    // Serve the stored real content-type (legacy objects → octet-stream verbatim).
    headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
    headers.set('Cache-Control', IMG_CACHE_IMMUTABLE);
    headers.set('Content-Length', String(object.size));
    return new Response(object.body, { status: 200, headers });
  }

  if (request.method === 'DELETE') {
    await env.MEDIA.delete(id);
    return json({ ok: true });
  }

  return json({ error: 'method_not_allowed' }, 405);
}

/** Parse + bound an optional client TTL (seconds) into ms; default when absent. */
function clampImgTtlMs(header: string | null): number {
  if (!header) return IMG_DEFAULT_TTL_MS;
  const seconds = Number(header);
  if (!Number.isFinite(seconds) || seconds <= 0) return IMG_DEFAULT_TTL_MS;
  return Math.min(Math.floor(seconds) * 1000, IMG_MAX_TTL_MS);
}

/**
 * Statement metadata held in the `ShareStore` DO. The ciphertext statement is
 * split across `st:<i>` keys (each < 128 KiB); each guest response is one
 * `resp:<respId>` key. Keeping it in DO storage (not KV) is what makes the live
 * table read-after-write consistent.
 */
interface ShareStatementMeta {
  revision: number;
  updatedAt: number;
  tokenHash: string;
  revoked: boolean;
  chunks: number;
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
  '{"merchant":string|null,"place":string|null,"date":string|null,"currency":string|null,"total":number|null,"items":[{"description":string,"qty":number,"unitPrice":number,"lineTotal":number,"category":string|null}],"serviceCharge":{"amount":number|null,"percent":number|null,"included":boolean|null},"adjustments":[{"kind":"couvert"|"discount"|"other","label":string,"amount":number,"scope":"basket"|"item","itemIndex":number|null}]}',
  'Rules: one entry per purchased product; every item MUST have its own printed price; lineTotal = the printed line amount BEFORE any basket-wide discount; unitPrice = lineTotal/qty (per single unit); currency = ISO 4217 code or null; numbers are plain dot-decimals with no symbols; preserve product names as printed; do not invent items; if unreadable return {"merchant":null,"place":null,"date":null,"currency":null,"total":null,"items":[]}.',
  'total (IMPORTANT) = the final amount the customer actually PAID, AFTER discounts ("total","total a pagar","importe","total pagado","valor pago"). It must satisfy: sum of item lineTotals - discounts = total. NEVER use the pre-discount subtotal, and NEVER use aggregate benefit lines like "total ventajas"/"total de vantagens"/"total ahorro"/"você economizou" as the total or as a discount — those mix this purchase\'s discount with loyalty balance.',
  'date = the purchase date printed on the receipt, ALWAYS as strict YYYY-MM-DD (convert any printed format, e.g. 20/06/2026 or 20.06.26 -> 2026-06-20); null when no date is printed. Never invent a date.',
  'place = the merchant location printed on the receipt (city, or "City, Country", or street/neighbourhood); null when none is printed. Never invent it.',
  'category (per item) = the single best fit from EXACTLY this list: bar, restaurant, market, transport, outing, entertainment, health, accommodation, other. Use the lowercase English word verbatim; null only when truly unsure.',
  'qty (IMPORTANT): qty = how many units that line bought, exactly as printed ("2x Burger", "Burger x2", "2 Burger", or a quantity column =2 -> qty:2; lineTotal is the total for ALL units, unitPrice is for ONE). Default qty:1 only when no count is shown. Keep one line per printed product line even if qty>1 (do NOT split it into separate items).',
  'NOT items (never emit these as products, they have no place in items[]): the server/waiter/cashier/attendant/operator name, table/check/order/ticket number, date, time, phone, address, the store/merchant name, NIF/CNPJ/tax id, loyalty/points, greetings, and any header/footer text. Words like "mesa","garcom","garçom","atendente","operador","caixa","cliente","comanda","pedido nº","obrigado" are NOT products. A row with no clear product price is NOT an item. Also never list subtotal/tax/tip/service/discount/change/payment/total as items.',
  'serviceCharge (T3): find a service/gratuity line ("service","servicio","servico","serviço","taxa de servico","gratuity","tip","propina") -> set amount (and percent when printed); included=true if it is already inside total, false if added on top; if there is no service mention set amount=null, percent=null, included=null.',
  'adjustments (E6): list money lines that are NOT products: couvert/cover ("couvert","cover") as kind "couvert"; any discount/promo/coupon/voucher of THIS purchase ("discount","desconto","descuento","DTO","dcto","promo","off","vale","cupón","cupom","voucher","rebaja","oferta") as kind "discount" with a NEGATIVE amount; anything else non-product as "other". Never duplicate the service line here. If none, return [].',
  'discount scope: a discount printed on/under ONE product line (indented under it, or naming that product) is scope "item" with itemIndex = that item\'s 0-based position in items[]; a discount after the item list applying to the WHOLE purchase (a coupon/promo card/member discount before the total) is scope "basket" with itemIndex null. When unsure use "basket". Non-discount adjustments: scope "basket", itemIndex null.',
  'loyalty is NOT a discount: points earned, cashback, balance accumulated FOR FUTURE purchases ("acumulado","club","puntos","pontos","saldo acumulado","cashback","vuelve","te llevas") did NOT reduce this bill — never emit them as adjustments and never subtract them. Only money lines that reduced WHAT WAS PAID TODAY count as discounts (check: subtotal - discounts = total paid).',
].join('\n');

// DEC-284: cost-benefit comparator photo input. The client posts ONE product
// price-tag/package photo and gets back {price, quantity, unit, label, currency,
// confidence}; several photos are sent as parallel calls (one product per image),
// then merged into the comparator. Reuses the vision model + size guard of /ocr.
const UNIT_EXTRACT_PROMPT = [
  'Look at this photo of ONE product price tag or package (any shop, any country).',
  'Return ONLY this JSON, no prose, no markdown:',
  '{"price":number|null,"quantity":number|null,"unit":"g"|"kg"|"mg"|"ml"|"cl"|"l"|"un"|null,"label":string|null,"currency":string|null,"confidence":number}',
  'price = the package selling price as a plain dot-decimal (no symbol); the main shelf price, NOT the small per-kg/per-litre reference price.',
  'quantity = the net content amount as a plain number; unit = its measure (weight: g/kg/mg; volume: ml/cl/l; or count: un). If only a per-kg/per-litre reference is shown with no package size, set quantity=null.',
  'label = a short product name if visible, else null. currency = ISO 4217 code if a symbol/code is visible, else null.',
  'confidence = your 0..1 certainty that BOTH price and quantity are correct.',
  'Never invent numbers; any field not clearly readable = null; if nothing is readable, return all nulls with confidence 0. Numbers are plain dot-decimals with no symbols.',
].join('\n');

// DEC-246 (AI Quick Entry) — natural-language router. The client posts the typed
// text plus a tiny, low-sensitivity context pack (names/labels only, no ids, no
// amounts, no history); the model returns a JSON {"actions":[...]} list of typed
// intents (one per money event in the message — usually one, several for a
// narrated multi-event story). The device resolves names → ids and runs each
// action through its own engines, so nothing financial is computed or persisted
// here (this stays a thin proxy).
const ASSISTANT_MODEL = 'llama-3.3-70b-versatile';
const ASSISTANT_MAX_TEXT_CHARS = 2_000;

interface AssistantContextPack {
  language?: string;
  baseCurrency?: string;
  today?: string;
  place?: string | null;
  participants?: string[];
  wallets?: string[];
  categories?: string[];
  privateNames?: boolean;
}

function buildAssistantSystemPrompt(context: AssistantContextPack): string {
  const list = (values: string[] | undefined): string =>
    values && values.length > 0 ? values.join(', ') : '(none)';
  return [
    'You are TripPilot\'s quick-entry router. Read ONE short message a traveler typed or spoke about money on a trip and return ONLY a JSON object (no prose, no markdown): {"actions":[ ... ]} — the LIST of money events in the message, each as ONE typed action with its entities.',
    'HOW MANY ACTIONS (critical): MOST messages describe ONE event -> "actions" has exactly ONE element. But when the message clearly narrates SEVERAL distinct events — different items/amounts/payers, usually chained by words like "e", "depois", "aí", "então", "também", "no fim", "daí", "logo", or simply several separate amounts — output ONE element PER event, IN THE ORDER they happened. Do NOT merge several events into one, and do NOT drop any (a 5-event story MUST return 5 actions).',
    'NOT multiple actions: a SINGLE purchase that is merely DIVIDED among people is STILL ONE action (split_expense) — never break one shared bill into one-per-person actions. "Dividimos a pizza nós 3" = ONE split action with participants, not three.',
    'Each element of "actions" has this shape (include only what applies; use null/[] otherwise):',
    '{"action":string,"amount":number|null,"currency":string|null,"toCurrency":string|null,"description":string|null,"category":string|null,"person":string|null,"participants":string[],"payer":"me"|"other"|null,"direction":"i_owe"|"owes_me"|null,"fromWallet":string|null,"toWallet":string|null,"place":string|null,"date":string|null,"itemName":string|null,"comparisonItems":[{"price":number,"quantity":number,"unit":string|null,"label":string|null}],"screen":string|null,"note":string|null,"confidence":number}',
    'action is one of: log_expense, someone_paid, i_paid_for, split_expense, record_income, transfer, withdraw, settle_debt, plan_purchase, plan_event, open_split_bill, open_scan_receipt, open_outing, open_plan_expense, open_simulator, open_screen, convert_currency, compare_unit_price, unknown.',
    'Per-event routing rules (decide SPLIT first — any sign of dividing wins over a plain "paid"):',
    '- DIVIDED among several people ("dividimos/dividido/rachamos/racha/split/entre nós/entre eu e <names>/cada um paga sua parte/a gente divide/os tres") -> split_expense. Put EVERY person who shares (besides me) in participants[]. If I (or nobody) paid, payer="me". If SOMEONE ELSE paid, payer="other" and person=<who paid> (the payer is also a sharer, so also include them in participants[]).',
    '- "<name> pagou/me pagou/comprou/ofereceu/pagou pra mim" with NO sign of dividing (they covered the WHOLE thing for me) -> someone_paid, person=<name> (I will OWE them the full amount).',
    '- "paguei/cobri/banquei pro/para <name>" (I covered it FOR them, not divided) -> i_paid_for, person=<name> (they owe me).',
    '- I just spent ("gastei/paguei/comprei/torrei") with no other person and no dividing -> log_expense.',
    '- "recebi/me reembolsaram/entrou" money -> record_income.',
    '- "transferi de X pra Y" -> transfer (fromWallet, toWallet); "saquei/tirei no caixa" -> withdraw.',
    '- "acertei/paguei o que devia ao <name>" -> settle_debt, direction="i_owe"; "<name> me pagou o que devia" -> settle_debt, direction="owes_me".',
    '- "quero comprar/planejar <thing>" (future) -> plan_purchase, itemName=<thing>.',
    '- An EVENT/outing the user will go to or wants to set up — "vou no/tem <event> <when>", "criar/planejar evento <name>", "<event> <day>, separo/reservo <amount>" (a show, dinner, party, day trip, museum) -> plan_event. Put the event NAME in description; the day in date (when said); the reserved budget in amount (ONLY when a "separo/reservo/budget de" amount is stated, else amount=null = track-only). This is the EVENT itself, NOT a single purchase: use plan_event when the user names an occasion/outing, log_expense/plan_purchase when they name a thing they bought/will buy.',
    '- "dividir uma nota/conta por foto", "escanear nota/recibo" -> open_scan_receipt; itemized bill split -> open_split_bill.',
    '- "iniciar saída/abrir o bar/modo saída" -> open_outing. "planejar um gasto" -> open_plan_expense. "simular uma compra" -> open_simulator.',
    '- "abrir/ver dívidas|gastos|carteiras|painel|planejador|receitas|viagem" -> open_screen with screen in [debts, expenses, dashboard, wallets, planner, income, trip].',
    '- A pure conversion QUESTION (no spending happened): "quanto é/quanto dá/converte/quantos reais são <amount> <currencyA> em <currencyB>", "how much is X in Y" -> convert_currency. Set amount, currency=<source ISO>, toCurrency=<target ISO>. NEVER turn a question into a log_expense. If the target is omitted, leave toCurrency=null (device uses the home currency).',
    '- A cost-benefit / price-per-unit QUESTION (no spending happened): "o que vale mais/qual é mais barato/melhor custo-benefício, A de <q><unit> por <price> ou B de <q><unit> por <price>", "which is cheaper per kg/litre/unit" -> compare_unit_price. Put EACH product in comparisonItems[] as {"price":<number>,"quantity":<number>,"unit":<g|kg|mg|ml|l|un>,"label":<short name or null>}. Copy the unit the user said (gramas->g, quilo/kg->kg, ml, litro->l, unidade/un->un). Leave amount/currency null. NEVER turn this into a log_expense.',
    'Single-event examples (study these — each returns ONE action inside "actions"):',
    '- "Bruno pagou 12,80 pelas tortilhas, dividimos entre ele, eu e a Débora" -> {"actions":[{"action":"split_expense","amount":12.8,"payer":"other","person":"Bruno","participants":["Bruno","Débora"]}]} (NOT someone_paid — divided 3 ways; "ele"=Bruno; do NOT list "eu").',
    '- "dividi 100 meio a meio com o Bruno, ele pagou" -> {"actions":[{"action":"split_expense","amount":100,"payer":"other","person":"Bruno","participants":["Bruno"]}]}.',
    '- "almoço 35 dividido com a Ana" -> {"actions":[{"action":"split_expense","amount":35,"payer":"me","participants":["Ana"]}]}.',
    '- "o Bruno me pagou uma cerveja de 2 euros" -> {"actions":[{"action":"someone_paid","amount":2,"person":"Bruno","category":"bar"}]} (whole thing, not divided).',
    '- "quanto é 20 euros em reais?" -> {"actions":[{"action":"convert_currency","amount":20,"currency":"EUR","toCurrency":"BRL"}]} (a QUESTION, nothing was spent — never log_expense).',
    '- "sábado tem o show do Coldplay, separo 100 euros" -> {"actions":[{"action":"plan_event","description":"show do Coldplay","amount":100,"currency":"EUR","date":"<that Saturday ISO>"}]} (an EVENT with a reserve — description=name, amount=reserve; NOT plan_purchase).',
    '- "cria um evento jantar de aniversário" -> {"actions":[{"action":"plan_event","description":"jantar de aniversário","amount":null}]} (track-only event — no reserve stated, so amount=null).',
    '- "o que vale mais, 120g por 1 euro ou 200g por 2 euros?" -> {"actions":[{"action":"compare_unit_price","comparisonItems":[{"price":1,"quantity":120,"unit":"g","label":null},{"price":2,"quantity":200,"unit":"g","label":null}]}]} (a QUESTION about cost-benefit, nothing was spent — never log_expense).',
    'MULTI-EVENT example (study carefully — 5 distinct events -> 5 actions, in order, NONE dropped):',
    '"Saí com o Bruno e a Débora. O Bruno me pagou um sorvete de 2 euros, a Débora me pagou uma água de 1 euro, dividi com ela um bolo de 10 euros, depois paguei o estacionamento de 4 euros e comprei uma pizza de 10 euros que dividimos nós 3" ->',
    '{"actions":[' +
      '{"action":"someone_paid","amount":2,"currency":"EUR","description":"sorvete","category":"restaurant","person":"Bruno"},' +
      '{"action":"someone_paid","amount":1,"currency":"EUR","description":"água","category":"market","person":"Débora"},' +
      '{"action":"split_expense","amount":10,"currency":"EUR","description":"bolo","category":"restaurant","payer":"me","participants":["Débora"]},' +
      '{"action":"log_expense","amount":4,"currency":"EUR","description":"estacionamento","category":"transport"},' +
      '{"action":"split_expense","amount":10,"currency":"EUR","description":"pizza","category":"restaurant","payer":"me","participants":["Bruno","Débora"]}' +
      ']} (sorvete & água: someone ELSE paid the whole item for me -> someone_paid; bolo: I split it with HER -> participants=["Débora"]; estacionamento: just me -> log_expense; pizza: I paid, split 3 ways -> participants=["Bruno","Débora"]; "nós 3"/"a gente" = me + the two named, so list the two others).',
    'Entity rules (apply to EACH action independently):',
    '- amount = the plain decimal number the user said (e.g. 2 for "2 euros"); no currency symbol, no math, no splitting. A comma is the DECIMAL separator and a dot can be a thousands separator: "12,80"->12.8, "3,50"->3.5, "1.250,00"->1250, "1,250.00"->1250.',
    '- currency = ISO 4217 code ONLY when an explicit currency word/symbol is in the text (euros/€->EUR, reais/R$->BRL, dollars/US$->USD, libras/£->GBP). If NO currency is mentioned, currency=null — do NOT guess from context; the device falls back to the trip base currency.',
    '- toCurrency = ISO 4217 code ONLY for a convert_currency question, taken from the "em/para/in/to <currency>" target ("...em reais"->BRL). For every other action, toCurrency=null.',
    '- comparisonItems = ONLY for compare_unit_price; one entry per product with its price (plain number), quantity (plain number) and unit. For every other action, omit it (empty list).',
    '- person = the single key counterpart (for someone_paid/i_paid_for/settle, or the PAYER of a split when payer="other"). participants = everyone who shares the cost, by name.',
    '- Resolve pronouns to the named person: "ele/ela/o cara" -> the person just mentioned (e.g. "Bruno ... ele" => "Bruno"). NEVER put the user themself ("eu","me","mim","eu mesmo","I","yo") in participants OR person — the user is ALWAYS implicitly included in a split.',
    '- person/participants: copy real names EXACTLY as said. NEVER invent a person who was not mentioned. The device matches names to people itself.',
    '- category: pick from the categories list when clearly implied (a beer -> bar), else null. The category is a TAG, NEVER the description.',
    '- description = ALWAYS a short, human, FACTUAL label of WHAT the spend was, taken from the user\'s OWN words (e.g. "cerveja", "almoço", "táxi", "ingresso do show", "mercado"); keep it 1-3 words. Do NOT invent details that were not said, and NEVER use the category name ("restaurant"/"bar"/"market"/"other") or a generic word ("expense"/"gasto"/"compra") as the description. If the message genuinely names nothing to describe it, set description=null (the device fills a place/neutral fallback) — never echo the category.',
    '- fromWallet: for ANY expense I paid, set it to the payment method when stated ("no crédito/cartão"->the credit card, "no débito", "em dinheiro/cash", "no Pix", or a wallet name like "Wise"/"Revolut"); match the known wallets list when possible, else the plain word. Leave null when not stated or when someone else paid.',
    '- place: the venue/place where it happened ONLY when stated ("no bar do Zé","no mercado","at the hotel","na Tasca") -> the place name as said (match the current place when it is the same); else null. Do NOT invent a place.',
    '- date: when the spend happened ONLY when stated. Output ISO YYYY-MM-DD computed from "today" for relative words ("ontem"->yesterday, "anteontem"->2 days ago, "sexta"/"sexta passada"->that weekday, "semana passada"->7 days ago, "3 dias atrás"->today−3). If no time reference is given, date=null (the device uses now).',
    '- NEVER output ids. NEVER compute totals, shares or balances. NEVER add fields beyond the shape. NEVER split one amount across actions (each action carries the full amount of its own event).',
    '- If a SINGLE event is genuinely unclear, use action="unknown" for it and put a one-line question in "note" (in the user\'s language). If the WHOLE message is unclear, return {"actions":[{"action":"unknown","note":"..."}]}. Always set a confidence 0..1 per action.',
    'Output ONLY the JSON object {"actions":[...]}. No prose, no markdown, no trailing comments.',
    'Context (use it to match names/labels; do not echo it):',
    `- language: ${context.language ?? 'pt-BR'}`,
    `- today: ${context.today ?? ''}`,
    `- base currency: ${context.baseCurrency ?? ''}`,
    `- current place: ${context.place ?? '(unknown)'}`,
    `- known people: ${list(context.participants)}`,
    `- known wallets: ${list(context.wallets)}`,
    `- categories: ${list(context.categories)}`,
  ].join('\n');
}

/**
 * DEC-246 (AI Quick Entry): relay the traveler's text + context to Groq's JSON
 * mode and return the model's raw intent JSON verbatim. The client's
 * `parseAssistantResponse` is the source of truth for validation, so the worker
 * stays a thin, stateless boundary. Failures map to stable statuses the client
 * folds into a graceful manual fallback (503 not configured, 429 rate limited,
 * 502 upstream/parse).
 */
async function handleAssistant(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  installId: string,
): Promise<Response> {
  if (!env.GROQ_API_KEY) return json({ error: 'assistant_not_configured' }, 503);

  let body: { text?: unknown; context?: unknown };
  try {
    body = (await request.json()) as { text?: unknown; context?: unknown };
  } catch {
    return json({ error: 'bad_json' }, 400);
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (text === '') return json({ error: 'bad_text' }, 400);
  if (text.length > ASSISTANT_MAX_TEXT_CHARS) return json({ error: 'text_too_large' }, 413);
  const context: AssistantContextPack =
    body.context && typeof body.context === 'object' ? (body.context as AssistantContextPack) : {};

  let upstream: Response;
  try {
    upstream = await fetch(GROQ_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: ASSISTANT_MODEL,
        temperature: 0,
        // Headroom for a multi-event message (DEC-246 multi-action): one narrated
        // story can carry 6-8 events ≈ 1.2k tokens of JSON. A low cap would
        // TRUNCATE the actions array into invalid JSON (dropping later events —
        // the opposite of the fix). Unused budget costs nothing.
        max_tokens: 2000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: buildAssistantSystemPrompt(context) },
          { role: 'user', content: text },
        ],
      }),
    });
  } catch {
    return json({ error: 'assistant_upstream_unreachable' }, 502);
  }

  if (upstream.status === 429) return json(rateLimitBody('assistant', upstream), 429);
  if (!upstream.ok) return json({ error: 'assistant_upstream_error', upstreamStatus: upstream.status }, 502);

  let payload: { choices?: { message?: { content?: unknown } }[] };
  try {
    payload = (await upstream.json()) as typeof payload;
  } catch {
    return json({ error: 'assistant_unparseable' }, 502);
  }
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== 'string') return json({ error: 'assistant_empty' }, 502);

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return json({ error: 'assistant_unparseable' }, 502);
  }
  ctx.waitUntil(recordAiUsage(env, installId, 'assistant', groqTotalTokens(payload)));
  return json(parsed);
}

// DEC-246 (AI Quick Entry · voice): speech-to-text via Groq Whisper. The client
// records a short clip and posts it as base64; the worker forwards it to Groq's
// audio endpoint and returns the plain transcript. Used as the robust fallback
// where the Web Speech API is unavailable (notably the Android APK).
const WHISPER_MODEL = 'whisper-large-v3-turbo';
const GROQ_AUDIO_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
// ~8 MB of base64 ≈ a 6 MB clip — far above a few seconds of speech; pure guard.
const TRANSCRIBE_MAX_CHARS = 8_000_000;

function base64ToBytes(value: string): Uint8Array {
  const comma = value.indexOf(',');
  const pure = value.startsWith('data:') && comma >= 0 ? value.slice(comma + 1) : value;
  const binary = atob(pure);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function transcribeFileExtension(mimeType: string): string {
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'mp4';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
  if (mimeType.includes('wav')) return 'wav';
  if (mimeType.includes('ogg')) return 'ogg';
  return 'webm';
}

async function handleTranscribe(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  installId: string,
): Promise<Response> {
  if (!env.GROQ_API_KEY) return json({ error: 'transcribe_not_configured' }, 503);

  let body: { audioBase64?: unknown; mimeType?: unknown; language?: unknown };
  try {
    body = (await request.json()) as { audioBase64?: unknown; mimeType?: unknown; language?: unknown };
  } catch {
    return json({ error: 'bad_json' }, 400);
  }

  const audioBase64 = typeof body.audioBase64 === 'string' ? body.audioBase64 : '';
  if (audioBase64 === '') return json({ error: 'bad_audio' }, 400);
  if (audioBase64.length > TRANSCRIBE_MAX_CHARS) return json({ error: 'audio_too_large' }, 413);

  const mimeType = typeof body.mimeType === 'string' ? body.mimeType : 'audio/webm';
  const language = typeof body.language === 'string' ? body.language.slice(0, 2) : undefined;

  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(audioBase64);
  } catch {
    return json({ error: 'bad_audio' }, 400);
  }

  const form = new FormData();
  form.append('file', new Blob([bytes], { type: mimeType }), `audio.${transcribeFileExtension(mimeType)}`);
  form.append('model', WHISPER_MODEL);
  form.append('response_format', 'json');
  if (language) form.append('language', language);

  let upstream: Response;
  try {
    upstream = await fetch(GROQ_AUDIO_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
      body: form,
    });
  } catch {
    return json({ error: 'transcribe_upstream_unreachable' }, 502);
  }

  if (upstream.status === 429) return json(rateLimitBody('transcribe', upstream), 429);
  if (!upstream.ok) return json({ error: 'transcribe_upstream_error', upstreamStatus: upstream.status }, 502);

  let payload: { text?: unknown; usage?: unknown; x_groq?: unknown };
  try {
    payload = (await upstream.json()) as typeof payload;
  } catch {
    return json({ error: 'transcribe_unparseable' }, 502);
  }
  // Groq's audio endpoint usually omits token usage; when present it may sit at
  // the top level or under `x_groq`. Record whatever is there (0 = no-op).
  const tokens = groqTotalTokens(payload) || groqTotalTokens(payload.x_groq);
  ctx.waitUntil(recordAiUsage(env, installId, 'transcribe', tokens));
  return json({ text: typeof payload.text === 'string' ? payload.text : '' });
}

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
    // `no-store`: these are live, frequently-polled endpoints (share statement +
    // responses). Any intermediary caching of a GET makes the live table look
    // frozen, so every read must reach the worker.
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS_HEADERS },
  });
}

/**
 * DEC-206 (G2): relay a single receipt image to Groq vision and return the
 * model's raw JSON ({merchant, currency, total, items}). The client's domain
 * parser is the source of truth for normalisation, so the worker stays a thin,
 * stateless boundary. Every failure maps to a stable status the client can act
 * on (503 not configured, 429 rate limited, 502 upstream/parse failure).
 */
async function handleOcr(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  installId: string,
): Promise<Response> {
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

  if (upstream.status === 429) return json(rateLimitBody('ocr', upstream), 429);
  if (!upstream.ok) return json({ error: 'ocr_upstream_error', upstreamStatus: upstream.status }, 502);

  let payload: { choices?: { message?: { content?: unknown } }[]; usage?: unknown };
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
  ctx.waitUntil(recordAiUsage(env, installId, 'ocr', groqTotalTokens(payload)));
  return json(parsed);
}

/**
 * DEC-284: relay ONE product photo to Groq vision and return the raw extraction
 * JSON ({price, quantity, unit, label, currency, confidence}). Mirrors handleOcr
 * (same vision model, same size guard, same stable error statuses); the client
 * merges several of these (one per photo) into the cost-benefit comparator.
 */
async function handleUnitExtract(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  installId: string,
): Promise<Response> {
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
        // One product's fields = a tiny JSON; a small cap is plenty and avoids
        // truncation. Unused budget costs nothing.
        max_tokens: 512,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: UNIT_EXTRACT_PROMPT },
              { type: 'image_url', image_url: { url: imageDataUrl } },
            ],
          },
        ],
      }),
    });
  } catch {
    return json({ error: 'ocr_upstream_unreachable' }, 502);
  }

  if (upstream.status === 429) return json(rateLimitBody('ocr', upstream), 429);
  if (!upstream.ok) return json({ error: 'ocr_upstream_error', upstreamStatus: upstream.status }, 502);

  let payload: { choices?: { message?: { content?: unknown } }[]; usage?: unknown };
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
  ctx.waitUntil(recordAiUsage(env, installId, 'ocr', groqTotalTokens(payload)));
  return json(parsed);
}

/**
 * DEC-207 — persistent encrypted share channel. Sub-routes under /share/*:
 *   POST   /share                 create  → { id, writeToken, expiresAt }
 *   GET    /share/:id             read the ciphertext statement (open: link id is the address)
 *   PUT    /share/:id             owner replaces the statement (x-share-token)
 *   DELETE /share/:id             owner revokes (x-share-token) → future reads 410
 *   POST   /share/:id/responses   guest appends a ciphertext response (no token, capped)
 *   GET    /share/:id/responses   read responses (open: any link-holder, like GET statement)
 *
 * Storage is one `ShareStore` Durable Object per shareId (strong read-after-write
 * consistency — see the Env doc). The worker only ever stores opaque ciphertext;
 * the AES key lives in the link fragment. Reads are open because the link IS the
 * read capability; mutations (PUT/DELETE) stay write-token-gated inside the DO.
 * This handler is a thin router that forwards to the DO and re-emits the result
 * with CORS + `no-store`.
 */
async function handleShare(request: Request, env: Env, url: URL): Promise<Response> {
  const ns = env.SHARE_STORE_DO;
  if (!ns) return json({ error: 'share_not_configured' }, 503);

  const method = request.method;
  // Read the body to a STRING and forward it explicitly. Forwarding the original
  // request's body STREAM into a DO subrequest (`new Request(url, request)`) can
  // silently drop the body for some client transports (browser HTTP/2), which
  // made the guest's POSTed claim arrive empty — the DO stored nothing yet still
  // 200'd. An explicit string body is transport-independent.
  const bodyText = method === 'POST' || method === 'PUT' ? await request.text() : undefined;
  const token = request.headers.get('X-Share-Token') ?? undefined;

  const callDo = (id: string, path: string): Promise<Response> => {
    const stub = ns.get(ns.idFromName(id));
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['X-Share-Token'] = token;
    return stub.fetch(`https://do${path}`, { method, headers, body: bodyText });
  };

  // DEC-445/446 — `preview` and `slugBase` ride inside the same POST/PUT body
  // as the ciphertext; the DO ignores them (it destructures blob/revision only).
  // DEC-455 — `linkKey` (escrowed AES key for short fragment-less links) rides
  // the same way and is stored ONLY in the extras record, never inside the DO.
  const extras = parseShareExtras(bodyText);

  // POST /share — mint the id here, then let its DO initialise + return a token.
  if (method === 'POST' && url.pathname === '/share') {
    const id = crypto.randomUUID();
    const res = await callDo(id, '/init');
    if (!res.ok) return relayDoResponse(res);
    const data = (await res.json()) as Record<string, unknown>;
    const stored = await storeShareExtras(env, id, extras);
    return json({
      id,
      ...(stored.slug ? { slug: stored.slug } : {}),
      ...(stored.keyHeld ? { keyHeld: true } : {}),
      ...data,
    });
  }

  const match = url.pathname.match(/^\/share\/([^/]+)(\/responses)?$/);
  if (!match) return json({ error: 'not_found' }, 404);
  const raw = decodeURIComponent(match[1]!);
  const isResponses = match[2] === '/responses';
  // DEC-446 (Â-OLD-LINKS-LIVE): raw ids resolve exactly as before; a slug is an
  // ADDITIONAL resolution layer on top.
  const id = await resolveShareAddress(env, raw);
  if (!id) return json({ error: 'bad_id' }, 400);

  const res = await callDo(id, isResponses ? '/responses' : '/statement');
  if (res.ok && !isResponses && method === 'PUT') {
    const keyHeld = await updateSharePreview(env, id, extras);
    return relayDoResponse(res, keyHeld ? { keyHeld: true } : undefined);
  }
  if (res.ok && !isResponses && method === 'DELETE') await clearShareExtras(env, id);
  if (res.ok && !isResponses && method === 'GET') {
    // DEC-455 — statement reads carry the escrowed key (when one exists) so a
    // guest opening a fragment-less link can decrypt. The link (id or slug) is
    // the read capability; the response is no-store, and the key never appears
    // in `/preview/` or in any log.
    const record = env.SHARE_STORE ? await readShareExtras(env.SHARE_STORE, id) : null;
    return relayDoResponse(res, record?.k ? { key: record.k } : undefined);
  }
  return relayDoResponse(res);
}

interface ShareExtras {
  preview: WorkerSharePreview | null;
  /** Raw client value — validated against SLUG_BASE_RE before use. */
  slugBase: string | null;
  /** True when the body carried a `preview` field at all (even an invalid one). */
  previewSent: boolean;
  /** DEC-455 — AES key the owner asked the worker to hold (short links). */
  linkKey: string | null;
}

function parseShareExtras(bodyText: string | undefined): ShareExtras {
  const empty: ShareExtras = { preview: null, slugBase: null, previewSent: false, linkKey: null };
  if (!bodyText) return empty;
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(bodyText) as Record<string, unknown>;
  } catch {
    return empty;
  }
  const preview = sanitizeSharePreview(body.preview);
  const previewSent = body.preview !== undefined;
  if (previewSent && !preview) logEvent('warn', 'share_preview_rejected', {});
  const slugBase =
    typeof body.slugBase === 'string' && SLUG_BASE_RE.test(body.slugBase) ? body.slugBase : null;
  const linkKey =
    typeof body.linkKey === 'string' && LINK_KEY_RE.test(body.linkKey) ? body.linkKey : null;
  return { preview, slugBase, previewSent, linkKey };
}

interface ShareExtrasRecord {
  slug: string | null;
  p: WorkerSharePreview | null;
  /** DEC-455 — escrowed AES key (returned only by `GET /share/:id`). */
  k?: string | null;
}

const previewKey = (id: string): string => `preview:${id}`;
const slugKey = (slug: string): string => `slug:${slug}`;

async function readShareExtras(kv: KVNamespace, id: string): Promise<ShareExtrasRecord | null> {
  const raw = await kv.get(previewKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ShareExtrasRecord;
  } catch {
    return null;
  }
}

/**
 * DEC-446 — turn `/share/:x` into a share id. Canonical UUID ids (every id the
 * worker ever minted) pass through untouched — old links stay alive forever.
 * Anything slug-shaped goes through the KV `slug:` mapping; legacy hex ids
 * (pre-UUID KV era) keep their old validation as the final fallback.
 */
async function resolveShareAddress(env: Env, raw: string): Promise<string | null> {
  if (CANONICAL_SHARE_ID_RE.test(raw)) return raw;
  if (env.SHARE_STORE && SLUG_RE.test(raw)) {
    const mapped = await env.SHARE_STORE.get(slugKey(raw));
    if (mapped) return mapped;
  }
  return SHARE_ID_RE.test(raw) ? raw : null;
}

/** Create-time extras: reserve a readable slug + store the preview/key record. */
async function storeShareExtras(
  env: Env,
  id: string,
  extras: ShareExtras,
): Promise<{ slug: string | null; keyHeld: boolean }> {
  const kv = env.SHARE_STORE;
  if (!kv || (!extras.preview && !extras.slugBase && !extras.linkKey)) {
    return { slug: null, keyHeld: false };
  }

  let slug: string | null = null;
  if (extras.slugBase) {
    for (let attempt = 0; attempt < 3 && !slug; attempt++) {
      const candidate = composeSlug(extras.slugBase, randomSlugSuffix());
      if ((await kv.get(slugKey(candidate))) === null) {
        await kv.put(slugKey(candidate), id, { expirationTtl: SHARE_TTL_SECONDS });
        slug = candidate;
      }
    }
    if (!slug) logEvent('warn', 'share_slug_exhausted', {});
  }
  if (extras.preview || slug || extras.linkKey) {
    const record: ShareExtrasRecord = { slug, p: extras.preview, k: extras.linkKey };
    await kv.put(previewKey(id), JSON.stringify(record), { expirationTtl: SHARE_TTL_SECONDS });
  }
  return { slug, keyHeld: Boolean(extras.linkKey) };
}

/**
 * Re-publish-time extras: refresh the preview (and the slug's TTL) when the
 * owner sent one; DROP the stored preview when the owner explicitly published
 * without it (the Settings kill-switch turned OFF → republish erases the old
 * summary). The slug mapping survives either way — the link must keep opening.
 * DEC-455: the escrowed key survives every republish; a PUT that carries a
 * `linkKey` (re)stores it — the upgrade path for links created before escrow.
 * Returns whether a key is held after this update.
 */
async function updateSharePreview(env: Env, id: string, extras: ShareExtras): Promise<boolean> {
  const kv = env.SHARE_STORE;
  if (!kv) return false;
  const existing = await readShareExtras(kv, id);
  const slug = existing?.slug ?? null;
  const k = extras.linkKey ?? existing?.k ?? null;
  if (extras.preview) {
    const record: ShareExtrasRecord = { slug, p: extras.preview, k };
    await kv.put(previewKey(id), JSON.stringify(record), { expirationTtl: SHARE_TTL_SECONDS });
    if (slug) await kv.put(slugKey(slug), id, { expirationTtl: SHARE_TTL_SECONDS });
    return Boolean(k);
  }
  if (existing?.p || existing?.k || extras.linkKey) {
    if (slug || k) {
      await kv.put(previewKey(id), JSON.stringify({ slug, p: null, k }), {
        expirationTtl: SHARE_TTL_SECONDS,
      });
    } else {
      await kv.delete(previewKey(id));
    }
  }
  return Boolean(k);
}

/** Revoke-time extras: the preview and the slug die with the share. */
async function clearShareExtras(env: Env, id: string): Promise<void> {
  const kv = env.SHARE_STORE;
  if (!kv) return;
  const existing = await readShareExtras(kv, id);
  if (existing?.slug) await kv.delete(slugKey(existing.slug));
  if (existing) await kv.delete(previewKey(id));
}

/**
 * DEC-445 — `GET /preview/:idOrSlug` (public, CORS `*`, NO rate limit — it is a
 * read, like the statement GET). Returns the stored summary blob plus the live
 * `responsesCount` (people at the table) read from the DO meta WITHOUT ever
 * touching the ciphertext. 404 when the share never had a preview (or is gone);
 * 410 after a revoke that somehow left the record behind.
 */
async function handleSharePreviewGet(env: Env, url: URL): Promise<Response> {
  const kv = env.SHARE_STORE;
  if (!kv) return json({ error: 'preview_not_configured' }, 503);
  const match = url.pathname.match(/^\/preview\/([^/]+)$/);
  if (!match) return json({ error: 'not_found' }, 404);
  const raw = decodeURIComponent(match[1]!);
  const id = await resolveShareAddress(env, raw);
  if (!id) return json({ error: 'not_found' }, 404);
  const record = await readShareExtras(kv, id);
  if (!record?.p) return json({ error: 'not_found' }, 404);

  let responsesCount = 0;
  if (env.SHARE_STORE_DO) {
    const stub = env.SHARE_STORE_DO.get(env.SHARE_STORE_DO.idFromName(id));
    const res = await stub.fetch('https://do/summary');
    if (res.status === 404) return json({ error: 'not_found' }, 404);
    if (res.ok) {
      const summary = (await res.json()) as { responses?: number; revoked?: boolean };
      if (summary.revoked) return json({ error: 'revoked' }, 410);
      responsesCount = typeof summary.responses === 'number' ? summary.responses : 0;
    }
  }

  const body = JSON.stringify({
    ...record.p,
    ...(record.slug ? { slug: record.slug } : {}),
    responsesCount,
  });
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      // Crawlers re-fetch on every paste; 60s keeps "always fresh" in practice
      // while sparing the DO from a scrape loop.
      'Cache-Control': 'public, max-age=60',
      ...CORS_HEADERS,
    },
  });
}

/**
 * Re-emit a ShareStore DO response with the public CORS + no-store headers.
 * DEC-455 — `extraFields` (escrowed `key`, `keyHeld` ack) are merged into a
 * successful JSON body; a non-object body is relayed untouched.
 */
async function relayDoResponse(
  res: Response,
  extraFields?: Record<string, unknown>,
): Promise<Response> {
  let body = await res.text();
  if (extraFields && res.ok) {
    try {
      const parsed = JSON.parse(body) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        body = JSON.stringify({ ...(parsed as Record<string, unknown>), ...extraFields });
      }
    } catch {
      // Relay as-is — enrichment is best-effort, the payload itself is king.
    }
  }
  return new Response(body, {
    status: res.status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS_HEADERS },
  });
}

// DEC-248 (Admin dashboard) — anonymous, NON-MONETARY usage telemetry.
// Calibration (Julio, 2026-06-21): a human label (display name) IS allowed; the
// HARD red line is monetary VALUES, which are never accepted. The allowlists
// below are the ONLY accepted fields — the DO rejects anything else, so the
// ingest physically cannot store an amount even if a client sent one.
const TELEMETRY_MAX_BODY_BYTES = 8000;

/**
 * Telemetry ingest — public, anonymous. The client posts a tiny daily snapshot
 * keyed by its install id (a pseudonymous UUID). The country is taken from the
 * Cloudflare edge header (the client never sends an IP) and forwarded to the DO.
 */
async function handleTelemetryIngest(request: Request, env: Env): Promise<Response> {
  if (!env.TELEMETRY) return json({ error: 'telemetry_not_configured' }, 503);
  const bodyText = await request.text();
  if (bodyText.length > TELEMETRY_MAX_BODY_BYTES) return json({ error: 'too_large' }, 413);
  const country = request.headers.get('CF-IPCountry') ?? '';
  const stub = env.TELEMETRY.get(env.TELEMETRY.idFromName('global'));
  const res = await stub.fetch(`https://t.internal/ingest?country=${encodeURIComponent(country)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: bodyText,
  });
  return relayDoResponse(res);
}

// DEC-251 (Onda B) — server-authoritative AI token accounting. The real token
// count only exists in Groq's response (`usage.total_tokens`), so the client can
// never under-report it. The pseudonymous install id (X-Install-Id header) is
// the only thing the client supplies for attribution; absent/invalid ids are
// simply dropped (the AI call still succeeds — accounting is best-effort).
const AI_FUNCTIONS = new Set(['assistant', 'ocr', 'transcribe']);
const ERROR_MAX_BODY_BYTES = 8000;

function readInstallId(request: Request): string {
  const raw = request.headers.get('X-Install-Id') ?? '';
  return TELEMETRY_ID_RE.test(raw) ? raw : '';
}

function groqTotalTokens(payload: unknown): number {
  const usage = (payload as { usage?: { total_tokens?: unknown } } | null)?.usage;
  const total = usage?.total_tokens;
  return typeof total === 'number' && Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
}

/**
 * FB-26 (DEC-276) — parse a Groq reset hint to whole seconds. Accepts a bare
 * number (`retry-after` is seconds) or Groq's duration form ("2s", "1m30s",
 * "880ms", "7.66s", "1h2m"). Returns null when absent/unparseable.
 */
function parseGroqResetSeconds(value: string | null): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const n = Number(trimmed);
    return Number.isFinite(n) ? Math.max(1, Math.ceil(n)) : null;
  }
  let total = 0;
  let matched = false;
  const re = /(\d+(?:\.\d+)?)\s*(ms|h|m|s)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(trimmed)) !== null) {
    matched = true;
    const v = Number(m[1]);
    const unit = m[2];
    if (unit === 'ms') total += v / 1000;
    else if (unit === 's') total += v;
    else if (unit === 'm') total += v * 60;
    else if (unit === 'h') total += v * 3600;
  }
  return matched ? Math.max(1, Math.ceil(total)) : null;
}

/**
 * FB-26 — a structured 429 body the client folds into an honest cooldown.
 * Prefers `retry-after`; falls back to the longer of the request/token reset
 * hints, else a 30s default. `scope:'day'` (RPD — comes back later) when the
 * wait is long, else `'minute'` (TPM/RPM countdown).
 */
function rateLimitBody(
  fn: string,
  upstream: Response,
): { error: string; aiUnavailable: true; retryAfterSec: number; scope: 'minute' | 'day' } {
  const retryAfter = parseGroqResetSeconds(upstream.headers.get('retry-after'));
  const resetReq = parseGroqResetSeconds(upstream.headers.get('x-ratelimit-reset-requests'));
  const resetTok = parseGroqResetSeconds(upstream.headers.get('x-ratelimit-reset-tokens'));
  const fallbacks = [resetReq, resetTok].filter((n): n is number => n !== null);
  const seconds = retryAfter ?? (fallbacks.length > 0 ? Math.max(...fallbacks) : 30);
  return {
    error: `${fn}_rate_limited`,
    aiUnavailable: true,
    retryAfterSec: seconds,
    scope: seconds > 300 ? 'day' : 'minute',
  };
}

/**
 * Record one AI call's token spend against an install (best-effort, fire and
 * forget via ctx.waitUntil so it never delays the user's response). Silently
 * no-ops without telemetry, a valid install id, a known function, or tokens.
 */
async function recordAiUsage(env: Env, installId: string, fn: string, tokens: number): Promise<void> {
  if (!env.TELEMETRY || !installId || !AI_FUNCTIONS.has(fn) || tokens <= 0) return;
  try {
    const day = new Date().toISOString().slice(0, 10);
    const stub = env.TELEMETRY.get(env.TELEMETRY.idFromName('global'));
    await stub.fetch('https://t.internal/ai-usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ installId, day, fn, tokens }),
    });
  } catch {
    /* accounting is best-effort — never surface a telemetry failure */
  }
}

/**
 * DEC-251 (Onda B) — anonymous error capture (a tiny self-hosted Sentry). The
 * client posts a structured crash from its local buffer: a message + minimal
 * meta, NEVER the surrounding state. The DO scrubs + dedups by message hash, so
 * the dashboard shows "top errors × affected installs" without storing PII.
 */
async function handleErrorIngest(request: Request, env: Env): Promise<Response> {
  if (!env.TELEMETRY) return json({ error: 'telemetry_not_configured' }, 503);
  const bodyText = await request.text();
  if (bodyText.length > ERROR_MAX_BODY_BYTES) return json({ error: 'too_large' }, 413);
  const stub = env.TELEMETRY.get(env.TELEMETRY.idFromName('global'));
  const res = await stub.fetch('https://t.internal/error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: bodyText,
  });
  return relayDoResponse(res);
}

/**
 * DEC-437 (2026-07-03 security audit, SEC-3): constant-time string comparison
 * for the admin bearer token. A plain `!==` bails on the first differing byte,
 * which leaks a timing side-channel an attacker could use to guess the token
 * byte by byte. Mirrors `timingSafeEqualHex` used for the app-lock PIN.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Admin query routes — read-only, gated by the ADMIN_TOKEN bearer secret. Maps
 * `/admin/<sub>` to the global telemetry DO's `/<sub>` (overview/installs/
 * timeseries/ai-usage/errors). Never exposes anything the DO does not aggregate.
 */
async function handleAdmin(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.TELEMETRY) return json({ error: 'telemetry_not_configured' }, 503);
  if (!env.ADMIN_TOKEN) return json({ error: 'admin_not_configured' }, 503);
  if (request.method !== 'GET' && request.method !== 'DELETE') {
    return json({ error: 'method_not_allowed' }, 405);
  }
  const auth = request.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !safeEqual(token, env.ADMIN_TOKEN)) return json({ error: 'unauthorized' }, 401);
  const sub = url.pathname.slice('/admin'.length) || '/';
  const stub = env.TELEMETRY.get(env.TELEMETRY.idFromName('global'));
  const res = await stub.fetch(`https://t.internal${sub}${url.search}`, { method: request.method });
  return relayDoResponse(res);
}

// ---------------------------------------------------------------------------
// Web Push VAPID — subscribe and send
// ---------------------------------------------------------------------------

const PUSH_SUB_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days

interface PushSubscribeBody {
  installId: string;
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
}

async function handlePushSubscribe(request: Request, env: Env): Promise<Response> {
  if (!env.PUSH_SUBS) return json({ error: 'push_not_configured' }, 501);
  const body = await request.json<PushSubscribeBody>().catch(() => null);
  if (!body?.installId || !body?.subscription?.endpoint || !body?.subscription?.keys) {
    return json({ error: 'bad_request' }, 400);
  }
  await env.PUSH_SUBS.put(
    `sub:${body.installId}`,
    JSON.stringify(body.subscription),
    { expirationTtl: PUSH_SUB_TTL_SECONDS },
  );
  return json({ ok: true });
}

interface PushSendBody {
  installIds: string[];
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

function base64urlEncode(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str: string): Uint8Array {
  const padding = '='.repeat((4 - (str.length % 4)) % 4);
  const base64 = (str + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Derive the public key (x, y) from the VAPID public key (65-byte uncompressed
 * point) so the private JWK can be constructed from the 32-byte private scalar.
 */
function deriveXYFromPublicKey(publicKeyBase64url: string): { x: string; y: string } {
  const raw = base64urlDecode(publicKeyBase64url);
  // Uncompressed EC point: 0x04 || x (32 bytes) || y (32 bytes)
  return {
    x: base64urlEncode(raw.slice(1, 33).buffer),
    y: base64urlEncode(raw.slice(33, 65).buffer),
  };
}

async function createVapidJwt(
  audience: string,
  subject: string,
  privateKeyBase64: string,
  publicKeyBase64: string,
): Promise<string> {
  const header = base64urlEncode(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })).buffer as ArrayBuffer);
  const now = Math.floor(Date.now() / 1000);
  const payload = base64urlEncode(
    new TextEncoder().encode(JSON.stringify({ aud: audience, exp: now + 3600, sub: subject })).buffer as ArrayBuffer,
  );
  const unsigned = `${header}.${payload}`;

  const { x, y } = deriveXYFromPublicKey(publicKeyBase64);
  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', d: privateKeyBase64, x, y },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(unsigned),
  );

  // Convert DER signature to raw r||s (64 bytes) for JWT ES256.
  const sigBytes = new Uint8Array(signature);
  let r: Uint8Array;
  let s: Uint8Array;
  if (sigBytes.length === 64) {
    r = sigBytes.slice(0, 32);
    s = sigBytes.slice(32, 64);
  } else {
    const rLen = sigBytes[3]!;
    r = sigBytes.slice(4, 4 + rLen);
    if (r.length > 32) r = r.slice(r.length - 32);
    const sOff = 4 + rLen;
    const sLen = sigBytes[sOff + 1]!;
    s = sigBytes.slice(sOff + 2, sOff + 2 + sLen);
    if (s.length > 32) s = s.slice(s.length - 32);
  }
  const rawSig = new Uint8Array(64);
  const padR = new Uint8Array(32);
  padR.set(r, 32 - r.length);
  rawSig.set(padR, 0);
  const padS = new Uint8Array(32);
  padS.set(s, 32 - s.length);
  rawSig.set(padS, 32);

  return `${unsigned}.${base64urlEncode(rawSig.buffer)}`;
}

/**
 * Send a tickle push (no payload) using VAPID auth. The browser's SW receives
 * a push event with no data and can then fetch pending notifications from the
 * app or show a generic alert. This avoids implementing the full RFC 8291
 * (aes128gcm content encryption) while still waking the browser.
 */
async function sendWebPushTickle(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  env: Env,
): Promise<boolean> {
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY || !env.VAPID_SUBJECT) return false;

  const audience = new URL(subscription.endpoint).origin;
  const jwt = await createVapidJwt(audience, env.VAPID_SUBJECT, env.VAPID_PRIVATE_KEY, env.VAPID_PUBLIC_KEY);

  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
      'Content-Length': '0',
      'TTL': '86400',
    },
  });

  return res.ok || res.status === 201;
}

interface PushWatchBody {
  installId: string;
  shareId: string;
  groupName: string;
}

async function handlePushWatch(request: Request, env: Env): Promise<Response> {
  if (!env.PUSH_SUBS) return json({ error: 'push_not_configured' }, 501);
  const body = await request.json<PushWatchBody>().catch(() => null);
  if (!body?.installId || !body?.shareId) return json({ error: 'bad_request' }, 400);
  await env.PUSH_SUBS.put(
    `watch:${body.shareId}`,
    JSON.stringify({ installId: body.installId, groupName: body.groupName ?? '' }),
    { expirationTtl: PUSH_SUB_TTL_SECONDS },
  );
  return json({ ok: true });
}

interface FcmRegisterBody {
  installId: string;
  fcmToken: string;
}

async function handleFcmRegister(request: Request, env: Env): Promise<Response> {
  if (!env.PUSH_SUBS) return json({ error: 'push_not_configured' }, 501);
  const body = await request.json<FcmRegisterBody>().catch(() => null);
  if (!body?.installId || !body?.fcmToken) return json({ error: 'bad_request' }, 400);
  await env.PUSH_SUBS.put(
    `fcm:${body.installId}`,
    body.fcmToken,
    { expirationTtl: PUSH_SUB_TTL_SECONDS },
  );
  return json({ ok: true });
}

async function sendFcmPush(
  fcmToken: string,
  title: string,
  body: string,
  env: Env,
): Promise<boolean> {
  if (!env.FCM_SERVICE_ACCOUNT) return false;
  try {
    const serviceAccount = JSON.parse(env.FCM_SERVICE_ACCOUNT);
    const fcm = new FCM(serviceAccount);
    await fcm.sendToToken(
      { notification: { title, body } },
      fcmToken,
    );
    return true;
  } catch {
    return false;
  }
}

async function handlePushSend(request: Request, env: Env): Promise<Response> {
  if (!env.PUSH_SUBS) return json({ error: 'push_not_configured' }, 501);
  const body = await request.json<PushSendBody>().catch(() => null);
  if (!body?.installIds?.length || !body?.title) {
    return json({ error: 'bad_request' }, 400);
  }

  const payload = JSON.stringify({
    title: body.title,
    body: body.body ?? '',
    url: body.url ?? '/dashboard',
    tag: body.tag ?? 'trippilot-push',
  });

  let sent = 0;
  let failed = 0;
  for (const installId of body.installIds) {
    const raw = await env.PUSH_SUBS.get(`sub:${installId}`);
    if (!raw) { failed++; continue; }
    try {
      const subscription = JSON.parse(raw);
      const ok = await sendWebPushTickle(subscription, env);
      if (ok) sent++; else failed++;
    } catch {
      failed++;
    }
  }

  return json({ sent, failed });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Preflights: never logged, never rate-limited. `/admin` preflights get the
    // allowlisted-origin treatment (DEC-440) instead of the public wildcard.
    if (request.method === 'OPTIONS') {
      const preflight = new Response(null, { status: 204, headers: CORS_HEADERS });
      return url.pathname.startsWith('/admin') ? withAdminCors(preflight, request) : preflight;
    }

    // DEC-441/443 (OBS-1/OBS-4) — request middleware: one structured log per
    // request (Workers Logs) with an end-to-end correlation id, plus a
    // last-resort catch so an unhandled throw becomes a clean 500 that still
    // carries the requestId the app can report.
    const requestId = readRequestId(request);
    const installId = readInstallId(request);
    const route = routeTemplate(url.pathname);
    const startedAt = Date.now();
    try {
      const res = await routeRequest(request, env, ctx, url, installId);
      logRequest(request.method, route, res.status, requestId, installId, startedAt);
      return attachRequestId(res, requestId);
    } catch (err) {
      logEvent('error', 'request_unhandled', {
        requestId,
        installId,
        method: request.method,
        route,
        durationMs: Date.now() - startedAt,
        err,
      });
      return attachRequestId(json({ error: 'internal', requestId }, 500), requestId);
    }
  },
};

/** Accept a sane client-supplied correlation id; otherwise mint one. */
function readRequestId(request: Request): string {
  const raw = request.headers.get('X-Request-Id') ?? '';
  return /^[0-9a-zA-Z-]{8,64}$/.test(raw) ? raw : crypto.randomUUID();
}

/** Echo the correlation id; tolerate immutable headers (WS upgrades, proxied DO responses). */
function attachRequestId(res: Response, requestId: string): Response {
  try {
    res.headers.set('X-Request-Id', requestId);
  } catch {
    // Immutable headers — the id is still in the logs on both sides.
  }
  return res;
}

function logRequest(
  method: string,
  route: string,
  status: number,
  requestId: string,
  installId: string,
  startedAt: number,
): void {
  // /health is a high-frequency machine probe — only log it when it failed.
  if (route === '/health' && status < 400) return;
  const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
  logEvent(level, 'request', {
    requestId,
    installId,
    method,
    route,
    status,
    durationMs: Date.now() - startedAt,
  });
}

async function routeRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  url: URL,
  installId: string,
): Promise<Response> {
    // Â-TRANSPORT / DEC-375 — transport health probe. A minimal Durable Object
    // round-trip (no storage, no socket) so the client can tell three states
    // apart: "offline" (the fetch itself rejects), "server reachable" (2xx) and
    // "server capacity cut" (5xx). When the account's daily Durable Object
    // duration budget is exhausted, env.MAILBOX.get().fetch() throws — we map
    // that to 503 so the UI can stop claiming "no internet" while online.
    if (request.method === 'GET' && url.pathname === '/health') {
      try {
        const stub = env.MAILBOX.get(env.MAILBOX.idFromName('health'));
        const res = await stub.fetch('https://mailbox.internal/__ping');
        return json({ ok: res.ok }, res.ok ? 200 : 503);
      } catch {
        return json({ ok: false, reason: 'capacity' }, 503);
      }
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

    // DEC-439 (SEC-2) — the Groq proxies are the costliest thing an abuser (or
    // a runaway retry loop) can hit: they burn the shared free-tier quota for
    // every real user. One shared per-caller limiter guards all four.
    const aiRoutes: Record<string, string> = {
      '/ocr': 'ocr',
      '/unit-extract': 'ocr',
      '/assistant': 'assistant',
      '/transcribe': 'transcribe',
    };
    const aiFn = request.method === 'POST' ? aiRoutes[url.pathname] : undefined;
    if (aiFn && (await edgeRateLimited(env.RL_AI, request, installId))) {
      return json(edgeRateLimitBody(aiFn), 429);
    }

    // DEC-206 (G2) — cloud receipt OCR. Stateless proxy to Groq vision.
    if (request.method === 'POST' && url.pathname === '/ocr') {
      return handleOcr(request, env, ctx, installId);
    }

    // DEC-284 — cost-benefit comparator photo extraction. One product per image;
    // the client sends several in parallel. Stateless proxy to Groq vision.
    if (request.method === 'POST' && url.pathname === '/unit-extract') {
      return handleUnitExtract(request, env, ctx, installId);
    }

    // DEC-246 — AI quick-entry router. Stateless proxy to Groq JSON mode.
    if (request.method === 'POST' && url.pathname === '/assistant') {
      return handleAssistant(request, env, ctx, installId);
    }

    // DEC-246 — voice transcription. Stateless proxy to Groq Whisper.
    if (request.method === 'POST' && url.pathname === '/transcribe') {
      return handleTranscribe(request, env, ctx, installId);
    }

    // DEC-207 S7 — real-time signal relay for a share (best-effort transport).
    // Must be matched BEFORE the generic /share handler. The room is named by
    // the shareId; anyone with the (unguessable) id can join, but the relay only
    // ever carries "something changed" pings — the payload itself stays in KV,
    // encrypted with the AES key the relay never sees.
    const shareWsMatch = url.pathname.match(/^\/share\/([^/]+)\/ws$/);
    if (request.method === 'GET' && shareWsMatch) {
      if (!env.SHARE_SIGNAL) return json({ error: 'realtime_not_configured' }, 426);
      // DEC-446: a guest that opened a slug link joins the relay by that slug —
      // resolve it so both sides land in the SAME room (named by the real id).
      const id = await resolveShareAddress(env, decodeURIComponent(shareWsMatch[1]!));
      if (!id) return json({ error: 'bad_id' }, 400);
      const stub = env.SHARE_SIGNAL.get(env.SHARE_SIGNAL.idFromName(id));
      return stub.fetch(request);
    }

    // DEC-445 — public share preview (summary blob + live people count). A pure
    // READ for crawlers/link cards: CORS `*`, no rate limit (Â-WORKER-GUARDS-KEPT
    // keeps writes limited; this is the same class as the statement GET).
    if (request.method === 'GET' && url.pathname.startsWith('/preview/')) {
      return handleSharePreviewGet(env, url);
    }

    // DEC-207 — persistent encrypted share channel (shared participant link).
    // DEC-439: WRITES are rate-limited (they cost DO duration/storage); reads
    // stay unlimited — the live split table polls GETs every few seconds.
    if (url.pathname === '/share' || url.pathname.startsWith('/share/')) {
      if (request.method !== 'GET' && (await edgeRateLimited(env.RL_SHARE_WRITE, request, installId))) {
        return json({ error: 'rate_limited', retryAfterSec: 60 }, 429);
      }
      return handleShare(request, env, url);
    }

    // FIELD item 8 — async mailbox addressed by the recipient's actorId.
    const mailboxMatch = url.pathname.match(/^\/mailbox\/([^/]+)$/);
    if (mailboxMatch && (request.method === 'POST' || request.method === 'GET')) {
      const actorId = decodeURIComponent(mailboxMatch[1]!);
      if (!ACTOR_ID_RE.test(actorId)) return json({ error: 'bad_actor' }, 400);
      // DEC-439: only deposits are limited; the owner's drain (GET) stays free.
      if (request.method === 'POST' && (await edgeRateLimited(env.RL_SHARE_WRITE, request, installId))) {
        return json({ error: 'rate_limited', retryAfterSec: 60 }, 429);
      }
      const stub = env.MAILBOX.get(env.MAILBOX.idFromName(actorId));
      return stub.fetch(new Request(`https://mailbox.internal/${request.method === 'POST' ? 'put' : 'drain'}`, request));
    }

    // DEC-348 (G2) — access-controlled plaintext image channel on R2 (real
    // content-type; legacy octet-stream served verbatim). DEC-207 unchanged.
    // DEC-439: uploads/deletes are limited (2 MB writes); GETs stay free.
    if (url.pathname.startsWith('/img/')) {
      if (request.method !== 'GET' && (await edgeRateLimited(env.RL_SHARE_WRITE, request, installId))) {
        return json({ error: 'rate_limited', retryAfterSec: 60 }, 429);
      }
      return handleImg(request, env, url);
    }

    // DEC-248 — anonymous usage telemetry ingest (NON-MONETARY; allowlisted).
    if (request.method === 'POST' && url.pathname === '/t') {
      if (await edgeRateLimited(env.RL_INGEST, request, installId)) {
        return json({ error: 'rate_limited', retryAfterSec: 60 }, 429);
      }
      return handleTelemetryIngest(request, env);
    }

    // DEC-251 (Onda B) — anonymous error ingest from the client crash buffer.
    if (request.method === 'POST' && url.pathname === '/e') {
      if (await edgeRateLimited(env.RL_INGEST, request, installId)) {
        return json({ error: 'rate_limited', retryAfterSec: 60 }, 429);
      }
      return handleErrorIngest(request, env);
    }

    // DEC-248 — read-only admin dashboard query routes (bearer-token gated).
    // DEC-440: CORS narrowed to the allowlisted dashboard origins.
    if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) {
      return withAdminCors(await handleAdmin(request, env, url), request);
    }

    // Web Push VAPID — subscribe + send routes.
    if (url.pathname === '/push/subscribe' && request.method === 'POST') {
      return handlePushSubscribe(request, env);
    }
    if (url.pathname === '/push/watch' && request.method === 'POST') {
      return handlePushWatch(request, env);
    }
    if (url.pathname === '/push/register-fcm' && request.method === 'POST') {
      return handleFcmRegister(request, env);
    }
    if (url.pathname === '/push/send' && request.method === 'POST') {
      return handlePushSend(request, env);
    }

    return json({ error: 'not_found' }, 404);
}

export class SyncRoom {
  constructor(private state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/open') {
      // The alarm is the room's source of truth ("opened, not yet expired"),
      // and it survives hibernation where an in-memory flag would not.
      await this.state.storage.setAlarm(Date.now() + ROOM_TTL_MS);
      return json({ ok: true });
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return json({ error: 'expected_websocket' }, 426);
    }
    const live = this.state.getWebSockets();
    if (live.length === 0) {
      // No live peer: the room exists only if it was opened and is still inside
      // the alarm window — this also accepts a reconnect after both peers
      // dropped. A fresh/expired instance has no alarm → unknown room.
      const alarm = await this.state.storage.getAlarm();
      if (alarm === null) return json({ error: 'room_not_found' }, 404);
    }
    if (live.length >= 2) {
      return json({ error: 'room_full' }, 409);
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    // Hibernatable accept — no socket is held in instance memory, so the room
    // can be evicted between messages and stops billing the 128 MB while idle.
    this.state.acceptWebSocket(server);

    if (this.state.getWebSockets().length === 2) {
      for (const socket of this.state.getWebSockets()) {
        try {
          socket.send(JSON.stringify({ type: 'peer-joined' }));
        } catch {
          // Ignore: a socket on its way out.
        }
      }
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  /** Relay an opaque frame to the other peer in the room. */
  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    for (const socket of this.state.getWebSockets()) {
      if (socket === ws) continue;
      try {
        socket.send(message);
      } catch {
        // Peer already gone; its close handler notifies the survivor.
      }
    }
  }

  webSocketClose(ws: WebSocket): void {
    this.dropAndNotify(ws);
  }

  webSocketError(ws: WebSocket): void {
    this.dropAndNotify(ws);
  }

  /** Release the closing socket and tell the surviving peer that it left. */
  private dropAndNotify(ws: WebSocket): void {
    try {
      ws.close();
    } catch {
      // Already closing.
    }
    for (const socket of this.state.getWebSockets()) {
      if (socket === ws) continue;
      try {
        socket.send(JSON.stringify({ type: 'peer-left' }));
      } catch {
        // Ignore: socket on its way out.
      }
    }
  }

  async alarm(): Promise<void> {
    for (const socket of this.state.getWebSockets()) {
      try {
        socket.close(4000, 'room_expired');
      } catch {
        // Already closed.
      }
    }
    await this.state.storage.deleteAll();
  }
}

/**
 * DEC-207 S7 — real-time relay for one share (named by shareId). Pure transport:
 * fans every received frame out to the OTHER connected sockets and stores
 * nothing. Frames are tiny app-level signals ({"t":"upd"|"resp",...}) that mean
 * "re-pull from KV"; they never contain statement data, so an eavesdropper who
 * guesses a shareId learns only that something changed (and the id is a UUID).
 * Mirrors the SyncRoom pattern but without the 2-peer cap or open handshake —
 * the room lives exactly as long as sockets are attached, then the DO evicts.
 */
const SHARE_SIGNAL_MAX_SOCKETS = 8; // owner + a few guest tabs; abuse guard
const SHARE_SIGNAL_MAX_FRAME_BYTES = 2_000; // a signal is a few dozen bytes

export class ShareSignal {
  constructor(private state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return json({ error: 'expected_websocket' }, 426);
    }
    if (this.state.getWebSockets().length >= SHARE_SIGNAL_MAX_SOCKETS) {
      return json({ error: 'relay_full' }, 409);
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    // Hibernatable accept — reverses the duration cost of a plain accept(): the
    // relay holds NOTHING in instance memory, so the runtime can evict it between
    // signals and we stop being billed for the 128 MB while every socket sits
    // idle (which is ~all the time — a signal is rare). The fanout re-reads the
    // live socket set on each message instead of a per-instance array.
    this.state.acceptWebSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  /** Relay one tiny frame to the OTHER sockets in this room (oversized = abuse). */
  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    const size = typeof message === 'string' ? message.length : message.byteLength;
    if (size > SHARE_SIGNAL_MAX_FRAME_BYTES) return;
    for (const socket of this.state.getWebSockets()) {
      if (socket === ws) continue;
      try {
        socket.send(message);
      } catch {
        // Peer gone; its own close removes it from the live set.
      }
    }
  }

  webSocketClose(ws: WebSocket): void {
    this.closeSocket(ws);
  }

  webSocketError(ws: WebSocket): void {
    this.closeSocket(ws);
  }

  /** Complete the server half of the close so the socket is released promptly. */
  private closeSocket(ws: WebSocket): void {
    try {
      ws.close();
    } catch {
      // Already closing.
    }
  }
}

/**
 * DEC-207 — strongly-consistent share store (one DO per shareId). Replaces the
 * KV backing for the share channel: a DO is single-instance and transactional,
 * so a guest's POSTed response (or an owner statement edit) is visible to the
 * very next GET — the read-after-write the live table needs. KV could not do
 * this (eventual consistency + a ~60s read cache that a `put` does not bust),
 * which made the table look frozen on real devices.
 *
 * Layout in DO storage (each value < 128 KiB):
 *   meta            → ShareStatementMeta (revision, token hash, revoked, #chunks)
 *   st:<i>          → ciphertext statement chunk i
 *   resp:<respId>   → JSON ShareResponseItem (one per guest, overwrite-in-place)
 * A sliding alarm wipes everything after the TTL; revoke keeps a short tombstone.
 */
export class ShareStore {
  constructor(private state: DurableObjectState, private env: Env) {}

  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (request.method === 'POST' && path === '/init') return this.init(request);
    if (path === '/statement') {
      if (request.method === 'GET') return this.getStatement();
      if (request.method === 'PUT') return this.putStatement(request);
      if (request.method === 'DELETE') return this.revoke(request);
    }
    if (path === '/responses') {
      if (request.method === 'POST') return this.postResponse(request);
      if (request.method === 'GET') return this.getResponses();
    }
    // DEC-445 — tiny ciphertext-free meta read for the public preview endpoint.
    if (request.method === 'GET' && path === '/summary') return this.summary();
    return json({ error: 'not_found' }, 404);
  }

  /** Meta-only summary (never touches the ciphertext): live people count. */
  private async summary(): Promise<Response> {
    const meta = await this.meta();
    if (!meta) return json({ error: 'not_found' }, 404);
    const responses = (await this.listResponses()).size;
    return json({
      revision: meta.revision,
      updatedAt: meta.updatedAt,
      revoked: meta.revoked,
      responses,
    });
  }

  private async meta(): Promise<ShareStatementMeta | null> {
    return (await this.state.storage.get<ShareStatementMeta>('meta')) ?? null;
  }

  private async writeStatementChunks(blob: string, previousChunks: number): Promise<number> {
    const chunks = Math.max(1, Math.ceil(blob.length / SHARE_STMT_CHUNK_BYTES));
    const writes: Record<string, string> = {};
    for (let i = 0; i < chunks; i++) {
      writes[`st:${i}`] = blob.slice(i * SHARE_STMT_CHUNK_BYTES, (i + 1) * SHARE_STMT_CHUNK_BYTES);
    }
    await this.state.storage.put(writes);
    // Drop any now-orphaned chunks from a previously larger statement.
    if (previousChunks > chunks) {
      const dels: string[] = [];
      for (let i = chunks; i < previousChunks; i++) dels.push(`st:${i}`);
      await this.state.storage.delete(dels);
    }
    return chunks;
  }

  private async readStatement(chunks: number): Promise<string> {
    let blob = '';
    for (let i = 0; i < chunks; i++) blob += (await this.state.storage.get<string>(`st:${i}`)) ?? '';
    return blob;
  }

  private async verify(request: Request, meta: ShareStatementMeta): Promise<boolean> {
    const token = request.headers.get('X-Share-Token');
    if (!token) return false;
    return (await sha256Hex(token)) === meta.tokenHash;
  }

  private async init(request: Request): Promise<Response> {
    if (await this.meta()) return json({ error: 'exists' }, 409); // uuid collision ≈ never
    let body: { blob?: unknown; revision?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return json({ error: 'bad_json' }, 400);
    }
    const blob = body.blob;
    if (typeof blob !== 'string' || blob.length === 0) return json({ error: 'bad_blob' }, 400);
    if (blob.length > SHARE_MAX_BLOB_BYTES) return json({ error: 'too_large' }, 413);

    const writeToken = randomToken();
    const chunks = await this.writeStatementChunks(blob, 0);
    const meta: ShareStatementMeta = {
      revision: typeof body.revision === 'number' && body.revision > 0 ? body.revision : 1,
      updatedAt: Date.now(),
      tokenHash: await sha256Hex(writeToken),
      revoked: false,
      chunks,
    };
    await this.state.storage.put('meta', meta);
    await this.state.storage.setAlarm(Date.now() + SHARE_TTL_SECONDS * 1000);
    return json({ writeToken, expiresAt: Date.now() + SHARE_TTL_SECONDS * 1000 });
  }

  private async getStatement(): Promise<Response> {
    const meta = await this.meta();
    if (!meta) return json({ error: 'not_found' }, 404);
    if (meta.revoked) return json({ error: 'revoked' }, 410);
    const blob = await this.readStatement(meta.chunks);
    return json({ blob, revision: meta.revision, updatedAt: meta.updatedAt });
  }

  private async putStatement(request: Request): Promise<Response> {
    const meta = await this.meta();
    if (!meta) return json({ error: 'not_found' }, 404);
    if (meta.revoked) return json({ error: 'revoked' }, 410);
    if (!(await this.verify(request, meta))) return json({ error: 'forbidden' }, 403);
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
      typeof body.revision === 'number' && body.revision > meta.revision ? body.revision : meta.revision + 1;
    const chunks = await this.writeStatementChunks(blob, meta.chunks);
    await this.state.storage.put('meta', { ...meta, revision, updatedAt: Date.now(), chunks });
    await this.state.storage.setAlarm(Date.now() + SHARE_TTL_SECONDS * 1000);
    return json({ ok: true, revision });
  }

  private async revoke(request: Request): Promise<Response> {
    const meta = await this.meta();
    if (!meta) return json({ error: 'not_found' }, 404);
    if (!(await this.verify(request, meta))) return json({ error: 'forbidden' }, 403);
    await this.clearResponses();
    const dels: string[] = [];
    for (let i = 0; i < meta.chunks; i++) dels.push(`st:${i}`);
    if (dels.length > 0) await this.state.storage.delete(dels);
    await this.state.storage.put('meta', { ...meta, revoked: true, updatedAt: Date.now(), chunks: 0 });
    await this.state.storage.setAlarm(Date.now() + SHARE_REVOKE_TTL_SECONDS * 1000);
    return json({ ok: true });
  }

  private async listResponses(): Promise<Map<string, string>> {
    return this.state.storage.list<string>({ prefix: 'resp:' });
  }

  private async clearResponses(): Promise<void> {
    const map = await this.listResponses();
    if (map.size > 0) await this.state.storage.delete([...map.keys()]);
  }

  private async postResponse(request: Request): Promise<Response> {
    const meta = await this.meta();
    if (!meta) return json({ error: 'not_found' }, 404);
    if (meta.revoked) return json({ error: 'revoked' }, 410);
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

    // Cap check excludes the key being overwritten (a re-post of the same guest).
    const map = await this.listResponses();
    const key = `resp:${respId}`;
    let count = 0;
    let totalBytes = 0;
    for (const [k, v] of map) {
      if (k === key) continue;
      count += 1;
      totalBytes += v.length;
    }
    if (count + 1 > SHARE_RESP_MAX_ITEMS || totalBytes + blob.length > SHARE_RESP_MAX_TOTAL_BYTES) {
      return json({ error: 'responses_full' }, 429);
    }
    const item: ShareResponseItem = { id: respId, blob, at: Date.now() };
    await this.state.storage.put(key, JSON.stringify(item));
    await this.state.storage.setAlarm(Date.now() + SHARE_TTL_SECONDS * 1000);

    // Best-effort: notify the share owner via Web Push that a new response arrived.
    this.notifyOwnerViaPush().catch(() => {});

    return json({ ok: true });
  }

  private async notifyOwnerViaPush(): Promise<void> {
    const { PUSH_SUBS } = this.env;
    if (!PUSH_SUBS) return;
    const shareId = this.state.id.toString();
    const watchRaw = await PUSH_SUBS.get(`watch:${shareId}`);
    if (!watchRaw) return;
    const watch = JSON.parse(watchRaw) as { installId: string; groupName: string };

    // Try FCM first (native app, survives full process kill).
    const fcmToken = await PUSH_SUBS.get(`fcm:${watch.installId}`);
    if (fcmToken) {
      const title = 'TripPilot';
      const body = watch.groupName
        ? `New activity in "${watch.groupName}"`
        : 'New activity in your group split';
      await sendFcmPush(fcmToken, title, body, this.env);
    }

    // Also try Web Push VAPID (PWA, browser open).
    const subRaw = await PUSH_SUBS.get(`sub:${watch.installId}`);
    if (subRaw) {
      const subscription = JSON.parse(subRaw);
      await sendWebPushTickle(subscription, this.env);
    }
  }

  private async getResponses(): Promise<Response> {
    const meta = await this.meta();
    if (!meta) return json({ error: 'not_found' }, 404);
    if (meta.revoked) return json({ error: 'revoked' }, 410);
    const map = await this.listResponses();
    const items: ShareResponseItem[] = [];
    for (const v of map.values()) items.push(JSON.parse(v) as ShareResponseItem);
    return json({ items });
  }

  async alarm(): Promise<void> {
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

    // Liveness round-trip for GET /health (Â-TRANSPORT). No storage access, so
    // it costs the minimum Durable Object time and never mutates the mailbox.
    if (request.method === 'GET' && url.pathname === '/__ping') {
      return json({ ok: true });
    }

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

// DEC-248 (Admin dashboard) — anonymous usage telemetry store. ONE global SQLite
// Durable Object. Stores ONLY allowlisted, NON-MONETARY fields; any key outside
// the maps below is rejected at ingest, so a monetary value can never be stored.
const TELEMETRY_ID_RE = /^[0-9a-fA-F-]{8,64}$/;
const TELEMETRY_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TELEMETRY_STR_MAX = 60;

/** payload counter key → SQLite column (cumulative per-install integer totals). */
const TELEMETRY_COUNTERS: Record<string, string> = {
  trips: 'c_trips',
  expenses: 'c_expenses',
  outings: 'c_outings',
  splits: 'c_splits',
  settlements: 'c_settlements',
  plannedPurchases: 'c_planned',
  wallets: 'c_wallets',
  participants: 'c_participants',
  connections: 'c_connections',
  aiEntries: 'c_ai_entries',
  receiptScans: 'c_receipt_scans',
  crashes: 'c_crashes',
};
/** payload flag key → SQLite column (0/1 adoption flags). */
const TELEMETRY_FLAGS: Record<string, string> = {
  usesAI: 'f_uses_ai',
  usesReceiptOcr: 'f_uses_receipt_ocr',
  usesSplit: 'f_uses_split',
  usesWallets: 'f_uses_wallets',
  usesLocation: 'f_uses_location',
  usesAppLock: 'f_uses_app_lock',
  isNative: 'f_is_native',
};

function telemetryStr(v: unknown, max = TELEMETRY_STR_MAX): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t === '' ? null : t.slice(0, max);
}

function num(v: SqlStorageValue): number {
  return typeof v === 'number' ? v : Number(v ?? 0) || 0;
}

// DEC-251 (Onda B) — accepted AI functions for the usage ledger, and the hard
// caps that keep the error table bounded. Server-side scrubbing is the trust
// boundary: even if the client forgets to scrub, no long digit run (id, money,
// token, timestamp) is ever persisted, and messages are length-capped.
const TELEMETRY_AI_FUNCTIONS = new Set(['assistant', 'ocr', 'transcribe']);
const ERROR_MSG_MAX = 240;
const ERRORS_TABLE_CAP = 500;

// FB-19 (DEC-272) — the all-zeros UUID is NOT a real install (the app emits a
// uuidv4 that's never zeroed). It reaches us only as a placeholder X-Install-Id
// from deploy probes / scanners / external clients. Per Julio's call we DON'T
// silently drop it — we NAME it so its (real) token spend is visible and
// understood, just flagged as non-user so it never pollutes the user ranking.
const SYSTEM_INSTALL_ID = '00000000-0000-0000-0000-000000000000';
function isSystemInstallId(id: string): boolean {
  return id === SYSTEM_INSTALL_ID;
}

// FB-18 (DEC-273) — Groq free-tier ceilings (VERIFIED 2026-06-22 via
// console.groq.com/docs/rate-limits). Per MODEL + per ORG; the daily request
// cap (RPD) is the practical bottleneck for our JSON router. Echoed to the admin
// so "% of limit" + projections use REAL numbers, never invented ones.
const GROQ_FREE_LIMITS = {
  assistant: { rpd: 1000, tpm: 6000, label: 'Llama (router/visão)' },
  ocr: { rpd: 1000, tpm: 6000, label: 'Llama (visão/OCR)' },
  transcribe: { rpd: 2000, tpm: 0, label: 'Whisper' },
} as const;

function scrubErrorMessageServer(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/\s+/g, ' ')
    .replace(/\d{4,}/g, '#')
    .trim()
    .slice(0, ERROR_MSG_MAX);
}

export class TelemetryStore {
  private sql: SqlStorage;

  constructor(private state: DurableObjectState) {
    this.sql = state.storage.sql;
    this.ensureSchema();
  }

  private ensureSchema(): void {
    const counterCols = Object.values(TELEMETRY_COUNTERS)
      .map((c) => `${c} INTEGER NOT NULL DEFAULT 0`)
      .join(', ');
    const flagCols = Object.values(TELEMETRY_FLAGS)
      .map((c) => `${c} INTEGER NOT NULL DEFAULT 0`)
      .join(', ');
    this.sql.exec(
      `CREATE TABLE IF NOT EXISTS installs (
        install_id TEXT PRIMARY KEY,
        display_name TEXT,
        first_seen INTEGER NOT NULL,
        last_seen INTEGER NOT NULL,
        app_version TEXT,
        platform TEXT,
        locale TEXT,
        country TEXT,
        active_days INTEGER NOT NULL DEFAULT 1,
        ${counterCols},
        ${flagCols}
      )`,
    );
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_installs_last_seen ON installs(last_seen)`);
    // FB-21 (DEC-274) — coarse browser family (e.g. "Chrome"/"Safari") for
    // support/debug, alongside the existing platform tag. Added via a guarded
    // migration because the installs table already exists in production; SQLite
    // ALTER ... ADD COLUMN is idempotent here only via the try/catch.
    try {
      this.sql.exec(`ALTER TABLE installs ADD COLUMN browser TEXT`);
    } catch {
      /* column already present — re-running ensureSchema is a no-op */
    }
    this.sql.exec(
      `CREATE TABLE IF NOT EXISTS heartbeats (
        install_id TEXT NOT NULL,
        day TEXT NOT NULL,
        app_version TEXT,
        platform TEXT,
        PRIMARY KEY (install_id, day)
      )`,
    );
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_heartbeats_day ON heartbeats(day)`);

    // DEC-251 (Onda B) — server-authoritative AI token spend, one row per
    // (install, UTC day, function). Tokens come from Groq's response so the
    // client can never under-report; `runs` counts calls. Keyed for cheap
    // per-day / per-function rollups in the admin dashboard.
    this.sql.exec(
      `CREATE TABLE IF NOT EXISTS ai_usage (
        install_id TEXT NOT NULL,
        day TEXT NOT NULL,
        fn TEXT NOT NULL,
        tokens INTEGER NOT NULL DEFAULT 0,
        runs INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (install_id, day, fn)
      )`,
    );
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_ai_usage_day ON ai_usage(day)`);

    // DEC-251 (Onda B) — anonymous error capture, deduped by message hash.
    // `count` is total occurrences; `users` is distinct affected installs
    // (tracked in error_seen). The message is already scrubbed before storage.
    this.sql.exec(
      `CREATE TABLE IF NOT EXISTS errors (
        msg_hash TEXT PRIMARY KEY,
        message TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        users INTEGER NOT NULL DEFAULT 0,
        first_seen INTEGER NOT NULL,
        last_seen INTEGER NOT NULL,
        app_version TEXT,
        platform TEXT
      )`,
    );
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_errors_last_seen ON errors(last_seen)`);
    this.sql.exec(
      `CREATE TABLE IF NOT EXISTS error_seen (
        msg_hash TEXT NOT NULL,
        install_id TEXT NOT NULL,
        PRIMARY KEY (msg_hash, install_id)
      )`,
    );
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    if (request.method === 'POST' && path === '/ingest') return this.ingest(request, url);
    if (request.method === 'GET' && path === '/overview') return this.overview();
    if (request.method === 'GET' && path === '/installs') return this.installs(url);
    if (request.method === 'GET' && path === '/timeseries') return this.timeseries(url);
    // DEC-251 (Onda B) — AI token ledger (POST = internal ingest, GET = admin)
    // and anonymous error capture (POST /error = ingest, GET /errors = admin).
    if (request.method === 'POST' && path === '/ai-usage') return this.ingestAiUsage(request);
    if (request.method === 'GET' && path === '/ai-usage') return this.aiUsage(url);
    // FB-17 — per-function token/run breakdown for ONE install (admin modal).
    if (request.method === 'GET' && path === '/install-detail') return this.installDetail(url);
    // FB-21 — the (deduped) errors a single install has hit (admin modal).
    if (request.method === 'GET' && path === '/install-errors') return this.installErrors(url);
    // FB-18 — Groq governance: day/month rollups + real free-tier limits.
    if (request.method === 'GET' && path === '/ai-governance') return this.aiGovernance();
    if (request.method === 'POST' && path === '/error') return this.ingestError(request);
    if (request.method === 'GET' && path === '/errors') return this.errorsList(url);
    if (request.method === 'GET' && path === '/ghost-signals') return this.ghostSignals();
    if (request.method === 'DELETE' && path === '/install') return this.deleteInstall(url);
    if (request.method === 'DELETE' && path === '/installs') return this.deleteAllInstalls();
    return json({ error: 'not_found' }, 404);
  }

  /**
   * Ghost signals — installIds present in heartbeats, ai_usage, or error_seen
   * but NOT in the installs table. These are "phantom" devices whose heartbeat
   * record was deleted or never created.
   */
  private ghostSignals(): Response {
    const ghosts: Record<
      string,
      {
        installId: string;
        sources: string[];
        aiTokens: number;
        aiCalls: number;
        aiFns: { fn: string; tokens: number; runs: number }[];
        errorCount: number;
        errorMessages: string[];
        heartbeatDays: string[];
        platforms: string[];
        versions: string[];
        firstSeen: number | null;
        lastSeen: number | null;
      }
    > = {};

    const ensure = (id: string) => {
      if (!ghosts[id]) {
        ghosts[id] = {
          installId: id,
          sources: [],
          aiTokens: 0,
          aiCalls: 0,
          aiFns: [],
          errorCount: 0,
          errorMessages: [],
          heartbeatDays: [],
          platforms: [],
          versions: [],
          firstSeen: null,
          lastSeen: null,
        };
      }
      return ghosts[id];
    };

    const aiOrphans = this.sql
      .exec(
        `SELECT a.install_id, a.fn, SUM(a.tokens) AS tokens, SUM(a.runs) AS runs,
                MIN(a.day) AS first_day, MAX(a.day) AS last_day
         FROM ai_usage a
         LEFT JOIN installs i ON i.install_id = a.install_id
         WHERE i.install_id IS NULL
         GROUP BY a.install_id, a.fn
         ORDER BY tokens DESC`,
      )
      .toArray();
    for (const r of aiOrphans) {
      const g = ensure(String(r.install_id));
      if (!g.sources.includes('ai_usage')) g.sources.push('ai_usage');
      const tokens = num(r.tokens);
      const runs = num(r.runs);
      g.aiTokens += tokens;
      g.aiCalls += runs;
      g.aiFns.push({ fn: String(r.fn), tokens, runs });
      const fd = new Date(String(r.first_day)).getTime();
      const ld = new Date(String(r.last_day)).getTime();
      if (g.firstSeen === null || fd < g.firstSeen) g.firstSeen = fd;
      if (g.lastSeen === null || ld > g.lastSeen) g.lastSeen = ld;
    }

    const errOrphans = this.sql
      .exec(
        `SELECT s.install_id, e.message, e.count, e.last_seen, e.platform, e.app_version
         FROM error_seen s
         JOIN errors e ON e.msg_hash = s.msg_hash
         LEFT JOIN installs i ON i.install_id = s.install_id
         WHERE i.install_id IS NULL
         ORDER BY e.last_seen DESC`,
      )
      .toArray();
    for (const r of errOrphans) {
      const g = ensure(String(r.install_id));
      if (!g.sources.includes('error_seen')) g.sources.push('error_seen');
      g.errorCount += num(r.count);
      const msg = String(r.message);
      if (!g.errorMessages.includes(msg)) g.errorMessages.push(msg);
      const p = r.platform ? String(r.platform) : null;
      if (p && !g.platforms.includes(p)) g.platforms.push(p);
      const v = r.app_version ? String(r.app_version) : null;
      if (v && !g.versions.includes(v)) g.versions.push(v);
      const ls = num(r.last_seen);
      if (g.lastSeen === null || ls > g.lastSeen) g.lastSeen = ls;
    }

    const hbOrphans = this.sql
      .exec(
        `SELECT h.install_id, h.day, h.platform, h.app_version
         FROM heartbeats h
         LEFT JOIN installs i ON i.install_id = h.install_id
         WHERE i.install_id IS NULL
         ORDER BY h.day DESC`,
      )
      .toArray();
    for (const r of hbOrphans) {
      const g = ensure(String(r.install_id));
      if (!g.sources.includes('heartbeats')) g.sources.push('heartbeats');
      const day = String(r.day);
      if (!g.heartbeatDays.includes(day)) g.heartbeatDays.push(day);
      const p = r.platform ? String(r.platform) : null;
      if (p && !g.platforms.includes(p)) g.platforms.push(p);
      const v = r.app_version ? String(r.app_version) : null;
      if (v && !g.versions.includes(v)) g.versions.push(v);
      const ts = new Date(day).getTime();
      if (g.firstSeen === null || ts < g.firstSeen) g.firstSeen = ts;
      if (g.lastSeen === null || ts > g.lastSeen) g.lastSeen = ts;
    }

    const signals = Object.values(ghosts)
      .filter((g) => !isSystemInstallId(g.installId))
      .sort((a, b) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0));

    return json({ signals, total: signals.length });
  }

  /** Wipe every install + heartbeat + AI/error ledger (admin "reset"). Used to
   *  clear test/junk data; real users simply re-report on their next heartbeat. */
  private deleteAllInstalls(): Response {
    const before = num(this.sql.exec(`SELECT COUNT(*) AS n FROM installs`).one().n);
    this.sql.exec(`DELETE FROM heartbeats`);
    this.sql.exec(`DELETE FROM ai_usage`);
    this.sql.exec(`DELETE FROM error_seen`);
    this.sql.exec(`DELETE FROM errors`);
    this.sql.exec(`DELETE FROM installs`);
    return json({ ok: true, deleted: before });
  }

  /** Remove one install (heartbeats + AI usage), and roll back its contribution
   *  to each error's distinct-user count. Idempotent: a missing id returns 0. */
  private deleteInstall(url: URL): Response {
    const id = url.searchParams.get('id') ?? '';
    if (!TELEMETRY_ID_RE.test(id)) return json({ error: 'bad_id' }, 400);
    this.sql.exec(`DELETE FROM heartbeats WHERE install_id = ?`, id);
    this.sql.exec(`DELETE FROM ai_usage WHERE install_id = ?`, id);
    const hashes = this.sql
      .exec(`SELECT msg_hash FROM error_seen WHERE install_id = ?`, id)
      .toArray()
      .map((r) => String(r.msg_hash));
    for (const h of hashes) {
      this.sql.exec(`UPDATE errors SET users = MAX(users - 1, 0) WHERE msg_hash = ?`, h);
    }
    this.sql.exec(`DELETE FROM error_seen WHERE install_id = ?`, id);
    const r = this.sql.exec(`DELETE FROM installs WHERE install_id = ?`, id);
    return json({ ok: true, deleted: r.rowsWritten });
  }

  /** DEC-251 (Onda B) — ingest one AI call's token spend (server-authoritative,
   *  called only by the worker's recordAiUsage). UPSERTs the day/fn row,
   *  accumulating tokens and incrementing the run count. */
  private async ingestAiUsage(request: Request): Promise<Response> {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return json({ error: 'bad_json' }, 400);
    }
    const installId = typeof body.installId === 'string' ? body.installId : '';
    if (!TELEMETRY_ID_RE.test(installId)) return json({ error: 'bad_id' }, 400);
    const day = typeof body.day === 'string' && TELEMETRY_DAY_RE.test(body.day) ? body.day : '';
    if (!day) return json({ error: 'bad_day' }, 400);
    const fn = typeof body.fn === 'string' ? body.fn : '';
    if (!TELEMETRY_AI_FUNCTIONS.has(fn)) return json({ error: 'bad_fn' }, 400);
    const rawTokens = body.tokens;
    if (typeof rawTokens !== 'number' || !Number.isFinite(rawTokens) || rawTokens < 0) {
      return json({ error: 'bad_tokens' }, 400);
    }
    const tokens = Math.min(Math.floor(rawTokens), 100_000_000);
    this.sql.exec(
      `INSERT INTO ai_usage (install_id, day, fn, tokens, runs) VALUES (?, ?, ?, ?, 1)
       ON CONFLICT(install_id, day, fn) DO UPDATE SET
         tokens = ai_usage.tokens + excluded.tokens,
         runs = ai_usage.runs + 1`,
      installId,
      day,
      fn,
      tokens,
    );
    return json({ ok: true });
  }

  /** DEC-251 (Onda B) — admin AI-usage rollup: grand totals, split by function,
   *  a daily series (bounded), and the heaviest installs (joined to their
   *  display name for the dashboard). */
  private aiUsage(url: URL): Response {
    const days = Math.min(Math.max(Number(url.searchParams.get('days')) || 30, 1), 180);
    const totals = this.sql
      .exec(`SELECT COALESCE(SUM(tokens), 0) AS tokens, COALESCE(SUM(runs), 0) AS runs FROM ai_usage`)
      .one();
    const byFn = this.sql
      .exec(`SELECT fn, SUM(tokens) AS tokens, SUM(runs) AS runs FROM ai_usage GROUP BY fn ORDER BY tokens DESC`)
      .toArray()
      .map((r) => ({ fn: String(r.fn), tokens: num(r.tokens), runs: num(r.runs) }));
    const series = this.sql
      .exec(
        `SELECT day, SUM(tokens) AS tokens, SUM(runs) AS runs FROM ai_usage GROUP BY day ORDER BY day DESC LIMIT ?`,
        days,
      )
      .toArray()
      .map((r) => ({ day: String(r.day), tokens: num(r.tokens), runs: num(r.runs) }))
      .reverse();
    const topUsers = this.sql
      .exec(
        `SELECT a.install_id AS install_id, i.display_name AS display_name,
                SUM(a.tokens) AS tokens, SUM(a.runs) AS runs
         FROM ai_usage a LEFT JOIN installs i ON i.install_id = a.install_id
         GROUP BY a.install_id ORDER BY tokens DESC LIMIT 50`,
      )
      .toArray()
      .map((r) => {
        const installId = String(r.install_id);
        return {
          installId,
          displayName: r.display_name === null ? null : String(r.display_name),
          tokens: num(r.tokens),
          runs: num(r.runs),
          // FB-19: name the all-zeros so its spend is understood, not user-ranked.
          isSystem: isSystemInstallId(installId),
        };
      });
    return json({ totals: { tokens: num(totals.tokens), runs: num(totals.runs) }, byFn, series, topUsers });
  }

  /** FB-17 (DEC-272) — per-function token/run breakdown for a SINGLE install,
   *  so the user modal shows Assistant/OCR/Transcribe split (not just totals). */
  private installDetail(url: URL): Response {
    const id = url.searchParams.get('id') ?? '';
    if (!TELEMETRY_ID_RE.test(id)) return json({ error: 'bad_id' }, 400);
    const byFn = this.sql
      .exec(
        `SELECT fn, SUM(tokens) AS tokens, SUM(runs) AS runs
         FROM ai_usage WHERE install_id = ? GROUP BY fn ORDER BY tokens DESC`,
        id,
      )
      .toArray()
      .map((r) => ({ fn: String(r.fn), tokens: num(r.tokens), runs: num(r.runs) }));
    return json({ installId: id, byFn, isSystem: isSystemInstallId(id) });
  }

  /** FB-21 (DEC-274) — the distinct errors a single install has hit (joined from
   *  error_seen → errors). Coarse + already-scrubbed; no values, no PII. */
  private installErrors(url: URL): Response {
    const id = url.searchParams.get('id') ?? '';
    if (!TELEMETRY_ID_RE.test(id)) return json({ error: 'bad_id' }, 400);
    const errors = this.sql
      .exec(
        `SELECT e.msg_hash AS msg_hash, e.message AS message, e.count AS count,
                e.last_seen AS last_seen, e.app_version AS app_version, e.platform AS platform
         FROM error_seen s JOIN errors e ON e.msg_hash = s.msg_hash
         WHERE s.install_id = ? ORDER BY e.last_seen DESC LIMIT 100`,
        id,
      )
      .toArray()
      .map((r) => ({
        hash: String(r.msg_hash),
        message: String(r.message),
        count: num(r.count),
        lastSeen: num(r.last_seen),
        appVersion: r.app_version === null ? null : String(r.app_version),
        platform: r.platform === null ? null : String(r.platform),
      }));
    return json({ installId: id, errors });
  }

  /** FB-18 (DEC-273) — Groq governance rollups: today + current-month token/run
   *  totals (and per-function today), plus the REAL free-tier limits so the admin
   *  can read "% of limit used" and project capacity. Computed from the existing
   *  ai_usage ledger — the AI hot path is untouched. */
  private aiGovernance(): Response {
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);
    const todayAgg = this.sql
      .exec(
        `SELECT COALESCE(SUM(tokens),0) AS tokens, COALESCE(SUM(runs),0) AS runs FROM ai_usage WHERE day = ?`,
        today,
      )
      .one();
    const monthAgg = this.sql
      .exec(
        `SELECT COALESCE(SUM(tokens),0) AS tokens, COALESCE(SUM(runs),0) AS runs FROM ai_usage WHERE substr(day,1,7) = ?`,
        month,
      )
      .one();
    const byFnToday = this.sql
      .exec(
        `SELECT fn, SUM(tokens) AS tokens, SUM(runs) AS runs FROM ai_usage WHERE day = ? GROUP BY fn`,
        today,
      )
      .toArray()
      .map((r) => ({ fn: String(r.fn), tokens: num(r.tokens), runs: num(r.runs) }));
    // Distinct installs that used AI today (excluding the system sentinel) — the
    // denominator for "tokens per active AI user", the projection input.
    const activeToday = num(
      this.sql
        .exec(
          `SELECT COUNT(DISTINCT install_id) AS n FROM ai_usage WHERE day = ? AND install_id != ?`,
          today,
          SYSTEM_INSTALL_ID,
        )
        .one().n,
    );
    return json({
      today,
      month,
      todayTokens: num(todayAgg.tokens),
      todayRuns: num(todayAgg.runs),
      monthTokens: num(monthAgg.tokens),
      monthRuns: num(monthAgg.runs),
      activeToday,
      byFnToday,
      limits: GROQ_FREE_LIMITS,
    });
  }

  /** DEC-251 (Onda B) — ingest one anonymous error. Scrubs server-side, dedups
   *  by message hash, accumulates count, and tracks distinct affected installs.
   *  Caps the table so an error flood can never grow the DO without bound. */
  private async ingestError(request: Request): Promise<Response> {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return json({ error: 'bad_json' }, 400);
    }
    const installId =
      typeof body.installId === 'string' && TELEMETRY_ID_RE.test(body.installId) ? body.installId : '';
    const message = scrubErrorMessageServer(body.message);
    if (message === '') return json({ error: 'bad_message' }, 400);
    const appVersion = telemetryStr(body.appVersion, 20);
    const platform = telemetryStr(body.platform, 20);
    const now = Date.now();
    const msgHash = await sha256Hex(message);
    this.sql.exec(
      `INSERT INTO errors (msg_hash, message, count, users, first_seen, last_seen, app_version, platform)
       VALUES (?, ?, 1, 0, ?, ?, ?, ?)
       ON CONFLICT(msg_hash) DO UPDATE SET
         count = errors.count + 1,
         last_seen = excluded.last_seen,
         message = excluded.message,
         app_version = excluded.app_version,
         platform = excluded.platform`,
      msgHash,
      message,
      now,
      now,
      appVersion,
      platform,
    );
    if (installId) {
      const seen = this.sql.exec(
        `INSERT OR IGNORE INTO error_seen (msg_hash, install_id) VALUES (?, ?)`,
        msgHash,
        installId,
      );
      if (seen.rowsWritten > 0) {
        this.sql.exec(`UPDATE errors SET users = users + 1 WHERE msg_hash = ?`, msgHash);
      }
    }
    this.pruneErrors();
    return json({ ok: true });
  }

  /** Keep only the most-recent N distinct errors (by last_seen) so a flood of
   *  unique messages can never grow the table unbounded. */
  private pruneErrors(): void {
    const total = num(this.sql.exec(`SELECT COUNT(*) AS n FROM errors`).one().n);
    if (total <= ERRORS_TABLE_CAP) return;
    const victims = this.sql
      .exec(`SELECT msg_hash FROM errors ORDER BY last_seen ASC LIMIT ?`, total - ERRORS_TABLE_CAP)
      .toArray()
      .map((r) => String(r.msg_hash));
    for (const h of victims) {
      this.sql.exec(`DELETE FROM error_seen WHERE msg_hash = ?`, h);
      this.sql.exec(`DELETE FROM errors WHERE msg_hash = ?`, h);
    }
  }

  /** DEC-251 (Onda B) — admin error list, most-recent first. */
  private errorsList(url: URL): Response {
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 100, 1), 500);
    const rows = this.sql
      .exec(`SELECT * FROM errors ORDER BY last_seen DESC LIMIT ?`, limit)
      .toArray()
      .map((r) => ({
        hash: String(r.msg_hash),
        message: String(r.message),
        count: num(r.count),
        users: num(r.users),
        firstSeen: num(r.first_seen),
        lastSeen: num(r.last_seen),
        appVersion: r.app_version === null ? null : String(r.app_version),
        platform: r.platform === null ? null : String(r.platform),
      }));
    const total = num(this.sql.exec(`SELECT COUNT(*) AS n FROM errors`).one().n);
    return json({ errors: rows, total });
  }

  private async ingest(request: Request, url: URL): Promise<Response> {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return json({ error: 'bad_json' }, 400);
    }
    const installId = typeof body.installId === 'string' ? body.installId : '';
    if (!TELEMETRY_ID_RE.test(installId)) return json({ error: 'bad_id' }, 400);
    const day = typeof body.day === 'string' && TELEMETRY_DAY_RE.test(body.day) ? body.day : '';
    if (!day) return json({ error: 'bad_day' }, 400);

    const displayName = telemetryStr(body.displayName);
    const appVersion = telemetryStr(body.appVersion, 20);
    const platform = telemetryStr(body.platform, 20);
    const browser = telemetryStr(body.browser, 24); // FB-21 — coarse family only
    const locale = telemetryStr(body.locale, 20);
    const country = telemetryStr(url.searchParams.get('country'), 4);

    // Counters/flags — STRICT allowlist. Any unknown key is rejected so a
    // monetary value (or any unexpected field) can never be persisted.
    const counters: Record<string, number> = {};
    const rawCounters = (body.counters ?? {}) as Record<string, unknown>;
    for (const key of Object.keys(rawCounters)) {
      const col = TELEMETRY_COUNTERS[key];
      if (!col) return json({ error: `bad_counter:${key}` }, 400);
      const v = rawCounters[key];
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
        return json({ error: `bad_counter_value:${key}` }, 400);
      }
      counters[col] = Math.min(Math.floor(v), 100_000_000);
    }
    const flags: Record<string, number> = {};
    const rawFlags = (body.flags ?? {}) as Record<string, unknown>;
    for (const key of Object.keys(rawFlags)) {
      const col = TELEMETRY_FLAGS[key];
      if (!col) return json({ error: `bad_flag:${key}` }, 400);
      flags[col] = rawFlags[key] ? 1 : 0;
    }

    const now = Date.now();
    // 1) Idempotent day heartbeat — a freshly written row means a new active day.
    const hb = this.sql.exec(
      `INSERT OR IGNORE INTO heartbeats (install_id, day, app_version, platform) VALUES (?, ?, ?, ?)`,
      installId,
      day,
      appVersion,
      platform,
    );
    const dayInc = hb.rowsWritten > 0 ? 1 : 0;

    // 2) Upsert the install row. Counters are cumulative DEVICE totals → store the
    // reported value verbatim; active_days only grows on a genuinely new day.
    const counterCols = Object.values(TELEMETRY_COUNTERS);
    const flagCols = Object.values(TELEMETRY_FLAGS);
    const insertCols = [
      'install_id',
      'display_name',
      'first_seen',
      'last_seen',
      'app_version',
      'platform',
      'browser',
      'locale',
      'country',
      'active_days',
      ...counterCols,
      ...flagCols,
    ];
    const insertVals: SqlStorageValue[] = [
      installId,
      displayName,
      now,
      now,
      appVersion,
      platform,
      browser,
      locale,
      country,
      1,
      ...counterCols.map((c) => counters[c] ?? 0),
      ...flagCols.map((c) => flags[c] ?? 0),
    ];
    const setClauses = [
      'display_name = COALESCE(excluded.display_name, installs.display_name)',
      'last_seen = excluded.last_seen',
      'app_version = excluded.app_version',
      'platform = excluded.platform',
      'browser = COALESCE(excluded.browser, installs.browser)',
      'locale = excluded.locale',
      'country = COALESCE(excluded.country, installs.country)',
      `active_days = installs.active_days + ${dayInc}`,
      ...counterCols.map((c) => `${c} = excluded.${c}`),
      ...flagCols.map((c) => `${c} = excluded.${c}`),
    ];
    const placeholders = insertCols.map(() => '?').join(', ');
    this.sql.exec(
      `INSERT INTO installs (${insertCols.join(', ')}) VALUES (${placeholders})
       ON CONFLICT(install_id) DO UPDATE SET ${setClauses.join(', ')}`,
      ...insertVals,
    );

    return json({ ok: true });
  }

  private overview(): Response {
    const now = Date.now();
    const day = 86_400_000;
    const counterCols = Object.values(TELEMETRY_COUNTERS);
    const flagCols = Object.values(TELEMETRY_FLAGS);
    const sums = [...counterCols, ...flagCols].map((c) => `SUM(${c}) AS ${c}`).join(', ');
    // Active-user windows come from the heartbeats table (distinct install per
    // UTC day) — NOT installs.last_seen, which is just the wall-clock of the
    // latest report and would make DAU≈everyone. day keys are ISO 'YYYY-MM-DD'
    // so a lexical string compare is also a chronological one.
    const dayKey = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
    const today = dayKey(now);
    const weekAgo = dayKey(now - 6 * day);
    const monthAgo = dayKey(now - 29 * day);
    const distinctActive = (op: string, arg: string): number =>
      num(this.sql.exec(`SELECT COUNT(DISTINCT install_id) AS n FROM heartbeats WHERE day ${op} ?`, arg).one().n);
    const dau = distinctActive('=', today);
    const wau = distinctActive('>=', weekAgo);
    const mau = distinctActive('>=', monthAgo);
    const agg = this.sql
      .exec(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN first_seen >= ? THEN 1 ELSE 0 END) AS new7d,
           ${sums}
         FROM installs`,
        now - 7 * day,
      )
      .one();
    const platforms = this.sql
      .exec(`SELECT COALESCE(platform, '?') AS k, COUNT(*) AS n FROM installs GROUP BY k ORDER BY n DESC`)
      .toArray()
      .map((r) => ({ key: String(r.k), count: num(r.n) }));
    const versions = this.sql
      .exec(`SELECT COALESCE(app_version, '?') AS k, COUNT(*) AS n FROM installs GROUP BY k ORDER BY n DESC LIMIT 20`)
      .toArray()
      .map((r) => ({ key: String(r.k), count: num(r.n) }));
    const countries = this.sql
      .exec(`SELECT COALESCE(NULLIF(country, ''), '?') AS k, COUNT(*) AS n FROM installs GROUP BY k ORDER BY n DESC LIMIT 30`)
      .toArray()
      .map((r) => ({ key: String(r.k), count: num(r.n) }));
    const counters: Record<string, number> = {};
    for (const [key, col] of Object.entries(TELEMETRY_COUNTERS)) counters[key] = num(agg[col]);
    const flags: Record<string, number> = {};
    for (const [key, col] of Object.entries(TELEMETRY_FLAGS)) flags[key] = num(agg[col]);
    return json({
      total: num(agg.total),
      dau,
      wau,
      mau,
      new7d: num(agg.new7d),
      counters,
      flags,
      platforms,
      versions,
      countries,
      generatedAt: now,
    });
  }

  private installs(url: URL): Response {
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 100, 1), 500);
    const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);
    // LEFT JOIN the AI ledger so every install row carries its lifetime token
    // spend + run count (DEC-254: the detail panel shows ALL info about a user).
    const rows = this.sql
      .exec(
        `SELECT i.*, COALESCE(u.tokens, 0) AS ai_tokens, COALESCE(u.runs, 0) AS ai_runs
         FROM installs i
         LEFT JOIN (SELECT install_id, SUM(tokens) AS tokens, SUM(runs) AS runs FROM ai_usage GROUP BY install_id) u
           ON u.install_id = i.install_id
         ORDER BY i.last_seen DESC LIMIT ? OFFSET ?`,
        limit,
        offset,
      )
      .toArray();
    const total = num(this.sql.exec(`SELECT COUNT(*) AS n FROM installs`).one().n);
    return json({ installs: rows.map((r) => this.shapeInstall(r)), total, limit, offset });
  }

  private timeseries(url: URL): Response {
    const days = Math.min(Math.max(Number(url.searchParams.get('days')) || 30, 1), 180);
    const series = this.sql
      .exec(`SELECT day, COUNT(DISTINCT install_id) AS dau FROM heartbeats GROUP BY day ORDER BY day DESC LIMIT ?`, days)
      .toArray()
      .map((r) => ({ day: String(r.day), dau: num(r.dau) }))
      .reverse();
    return json({ series });
  }

  private shapeInstall(r: Record<string, SqlStorageValue>): Record<string, unknown> {
    const counters: Record<string, number> = {};
    for (const [key, col] of Object.entries(TELEMETRY_COUNTERS)) counters[key] = num(r[col]);
    const flags: Record<string, boolean> = {};
    for (const [key, col] of Object.entries(TELEMETRY_FLAGS)) flags[key] = num(r[col]) > 0;
    return {
      installId: String(r.install_id),
      displayName: r.display_name === null ? null : String(r.display_name),
      firstSeen: num(r.first_seen),
      lastSeen: num(r.last_seen),
      appVersion: r.app_version === null ? null : String(r.app_version),
      platform: r.platform === null ? null : String(r.platform),
      browser: r.browser === null || r.browser === undefined ? null : String(r.browser),
      locale: r.locale === null ? null : String(r.locale),
      country: r.country === null ? null : String(r.country),
      activeDays: num(r.active_days),
      counters,
      flags,
      // DEC-251 (Onda B) — server-authoritative AI spend for this install
      // (present only when the installs() query joins the ledger).
      aiTokens: num(r.ai_tokens),
      aiCalls: num(r.ai_runs),
    };
  }
}