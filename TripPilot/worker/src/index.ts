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
   * Legacy KV store (pre-DO). Kept bound for older data only; no longer written.
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

const SHARE_STMT_CHUNK_BYTES = 120_000; // DO value cap is 128 KiB; chunk the statement under it

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
  '{"merchant":string|null,"currency":string|null,"total":number|null,"items":[{"description":string,"qty":number,"unitPrice":number,"lineTotal":number}],"serviceCharge":{"amount":number|null,"percent":number|null,"included":boolean|null},"adjustments":[{"kind":"couvert"|"discount"|"other","label":string,"amount":number}]}',
  'Rules: one entry per purchased product; every item MUST have its own printed price; lineTotal = the printed line amount; unitPrice = lineTotal/qty (per single unit); currency = ISO 4217 code or null; total = final amount paid or null; numbers are plain dot-decimals with no symbols; preserve product names as printed; do not invent items; if unreadable return {"merchant":null,"currency":null,"total":null,"items":[]}.',
  'qty (IMPORTANT): qty = how many units that line bought, exactly as printed ("2x Burger", "Burger x2", "2 Burger", or a quantity column =2 -> qty:2; lineTotal is the total for ALL units, unitPrice is for ONE). Default qty:1 only when no count is shown. Keep one line per printed product line even if qty>1 (do NOT split it into separate items).',
  'NOT items (never emit these as products, they have no place in items[]): the server/waiter/cashier/attendant/operator name, table/check/order/ticket number, date, time, phone, address, the store/merchant name, NIF/CNPJ/tax id, loyalty/points, greetings, and any header/footer text. Words like "mesa","garcom","garçom","atendente","operador","caixa","cliente","comanda","pedido nº","obrigado" are NOT products. A row with no clear product price is NOT an item. Also never list subtotal/tax/tip/service/discount/change/payment/total as items.',
  'serviceCharge (T3): find a service/gratuity line ("service","servicio","servico","serviço","taxa de servico","gratuity","tip","propina") -> set amount (and percent when printed); included=true if it is already inside total, false if added on top; if there is no service mention set amount=null, percent=null, included=null.',
  'adjustments (E6): list money lines that are NOT products: couvert/cover ("couvert","cover") as kind "couvert"; any discount/promo ("discount","desconto","promo","off") as kind "discount" with a NEGATIVE amount; anything else non-product as "other". Never duplicate the service line here. If none, return [].',
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
    '{"action":string,"amount":number|null,"currency":string|null,"description":string|null,"category":string|null,"person":string|null,"participants":string[],"payer":"me"|"other"|null,"direction":"i_owe"|"owes_me"|null,"fromWallet":string|null,"toWallet":string|null,"place":string|null,"date":string|null,"itemName":string|null,"screen":string|null,"note":string|null,"confidence":number}',
    'action is one of: log_expense, someone_paid, i_paid_for, split_expense, record_income, transfer, withdraw, settle_debt, plan_purchase, open_split_bill, open_scan_receipt, open_outing, open_plan_expense, open_simulator, open_screen, unknown.',
    'Per-event routing rules (decide SPLIT first — any sign of dividing wins over a plain "paid"):',
    '- DIVIDED among several people ("dividimos/dividido/rachamos/racha/split/entre nós/entre eu e <names>/cada um paga sua parte/a gente divide/os tres") -> split_expense. Put EVERY person who shares (besides me) in participants[]. If I (or nobody) paid, payer="me". If SOMEONE ELSE paid, payer="other" and person=<who paid> (the payer is also a sharer, so also include them in participants[]).',
    '- "<name> pagou/me pagou/comprou/ofereceu/pagou pra mim" with NO sign of dividing (they covered the WHOLE thing for me) -> someone_paid, person=<name> (I will OWE them the full amount).',
    '- "paguei/cobri/banquei pro/para <name>" (I covered it FOR them, not divided) -> i_paid_for, person=<name> (they owe me).',
    '- I just spent ("gastei/paguei/comprei/torrei") with no other person and no dividing -> log_expense.',
    '- "recebi/me reembolsaram/entrou" money -> record_income.',
    '- "transferi de X pra Y" -> transfer (fromWallet, toWallet); "saquei/tirei no caixa" -> withdraw.',
    '- "acertei/paguei o que devia ao <name>" -> settle_debt, direction="i_owe"; "<name> me pagou o que devia" -> settle_debt, direction="owes_me".',
    '- "quero comprar/planejar <thing>" (future) -> plan_purchase, itemName=<thing>.',
    '- "dividir uma nota/conta por foto", "escanear nota/recibo" -> open_scan_receipt; itemized bill split -> open_split_bill.',
    '- "iniciar saída/abrir o bar/modo saída" -> open_outing. "planejar um gasto" -> open_plan_expense. "simular uma compra" -> open_simulator.',
    '- "abrir/ver dívidas|gastos|carteiras|painel|planejador|receitas|viagem" -> open_screen with screen in [debts, expenses, dashboard, wallets, planner, income, trip].',
    'Single-event examples (study these — each returns ONE action inside "actions"):',
    '- "Bruno pagou 12,80 pelas tortilhas, dividimos entre ele, eu e a Débora" -> {"actions":[{"action":"split_expense","amount":12.8,"payer":"other","person":"Bruno","participants":["Bruno","Débora"]}]} (NOT someone_paid — divided 3 ways; "ele"=Bruno; do NOT list "eu").',
    '- "dividi 100 meio a meio com o Bruno, ele pagou" -> {"actions":[{"action":"split_expense","amount":100,"payer":"other","person":"Bruno","participants":["Bruno"]}]}.',
    '- "almoço 35 dividido com a Ana" -> {"actions":[{"action":"split_expense","amount":35,"payer":"me","participants":["Ana"]}]}.',
    '- "o Bruno me pagou uma cerveja de 2 euros" -> {"actions":[{"action":"someone_paid","amount":2,"person":"Bruno","category":"bar"}]} (whole thing, not divided).',
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
    '- person = the single key counterpart (for someone_paid/i_paid_for/settle, or the PAYER of a split when payer="other"). participants = everyone who shares the cost, by name.',
    '- Resolve pronouns to the named person: "ele/ela/o cara" -> the person just mentioned (e.g. "Bruno ... ele" => "Bruno"). NEVER put the user themself ("eu","me","mim","eu mesmo","I","yo") in participants OR person — the user is ALWAYS implicitly included in a split.',
    '- person/participants: copy real names EXACTLY as said. NEVER invent a person who was not mentioned. The device matches names to people itself.',
    '- category: pick from the categories list when clearly implied (a beer -> bar), else null. description = a short human label of what it was, when stated.',
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
async function handleAssistant(request: Request, env: Env): Promise<Response> {
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

  if (upstream.status === 429) return json({ error: 'assistant_rate_limited' }, 429);
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

async function handleTranscribe(request: Request, env: Env): Promise<Response> {
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

  if (upstream.status === 429) return json({ error: 'transcribe_rate_limited' }, 429);
  if (!upstream.ok) return json({ error: 'transcribe_upstream_error', upstreamStatus: upstream.status }, 502);

  let payload: { text?: unknown };
  try {
    payload = (await upstream.json()) as { text?: unknown };
  } catch {
    return json({ error: 'transcribe_unparseable' }, 502);
  }
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

  // POST /share — mint the id here, then let its DO initialise + return a token.
  if (method === 'POST' && url.pathname === '/share') {
    const id = crypto.randomUUID();
    const res = await callDo(id, '/init');
    if (!res.ok) return relayDoResponse(res);
    const data = (await res.json()) as Record<string, unknown>;
    return json({ id, ...data });
  }

  const match = url.pathname.match(/^\/share\/([^/]+)(\/responses)?$/);
  if (!match) return json({ error: 'not_found' }, 404);
  const id = decodeURIComponent(match[1]!);
  const isResponses = match[2] === '/responses';
  if (!SHARE_ID_RE.test(id)) return json({ error: 'bad_id' }, 400);

  const res = await callDo(id, isResponses ? '/responses' : '/statement');
  return relayDoResponse(res);
}

/** Re-emit a ShareStore DO response with the public CORS + no-store headers. */
async function relayDoResponse(res: Response): Promise<Response> {
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS_HEADERS },
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

    // DEC-206 (G2) — cloud receipt OCR. Stateless proxy to Groq vision.
    if (request.method === 'POST' && url.pathname === '/ocr') {
      return handleOcr(request, env);
    }

    // DEC-246 — AI quick-entry router. Stateless proxy to Groq JSON mode.
    if (request.method === 'POST' && url.pathname === '/assistant') {
      return handleAssistant(request, env);
    }

    // DEC-246 — voice transcription. Stateless proxy to Groq Whisper.
    if (request.method === 'POST' && url.pathname === '/transcribe') {
      return handleTranscribe(request, env);
    }

    // DEC-207 S7 — real-time signal relay for a share (best-effort transport).
    // Must be matched BEFORE the generic /share handler. The room is named by
    // the shareId; anyone with the (unguessable) id can join, but the relay only
    // ever carries "something changed" pings — the payload itself stays in KV,
    // encrypted with the AES key the relay never sees.
    const shareWsMatch = url.pathname.match(/^\/share\/([^/]+)\/ws$/);
    if (request.method === 'GET' && shareWsMatch) {
      if (!env.SHARE_SIGNAL) return json({ error: 'realtime_not_configured' }, 426);
      const id = decodeURIComponent(shareWsMatch[1]!);
      if (!SHARE_ID_RE.test(id)) return json({ error: 'bad_id' }, 400);
      const stub = env.SHARE_SIGNAL.get(env.SHARE_SIGNAL.idFromName(id));
      return stub.fetch(request);
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
  private sockets: WebSocket[] = [];

  constructor(private state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return json({ error: 'expected_websocket' }, 426);
    }
    if (this.sockets.length >= SHARE_SIGNAL_MAX_SOCKETS) {
      return json({ error: 'relay_full' }, 409);
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();
    this.sockets.push(server);

    server.addEventListener('message', (event) => {
      // Drop oversized frames — a signal is tiny; anything large is abuse.
      const size = typeof event.data === 'string' ? event.data.length : (event.data as ArrayBuffer).byteLength;
      if (size > SHARE_SIGNAL_MAX_FRAME_BYTES) return;
      for (const socket of this.sockets) {
        if (socket !== server) {
          try {
            socket.send(event.data);
          } catch {
            // Peer gone; close handler cleans up.
          }
        }
      }
    });

    const cleanup = () => {
      this.sockets = this.sockets.filter((s) => s !== server);
    };
    server.addEventListener('close', cleanup);
    server.addEventListener('error', cleanup);

    return new Response(null, { status: 101, webSocket: client });
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
  constructor(private state: DurableObjectState) {}

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
    return json({ error: 'not_found' }, 404);
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
    return json({ ok: true });
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