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
  'Access-Control-Allow-Headers': 'Content-Type, X-Share-Token, Authorization, X-Install-Id',
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
  '{"merchant":string|null,"place":string|null,"date":string|null,"currency":string|null,"total":number|null,"items":[{"description":string,"qty":number,"unitPrice":number,"lineTotal":number,"category":string|null}],"serviceCharge":{"amount":number|null,"percent":number|null,"included":boolean|null},"adjustments":[{"kind":"couvert"|"discount"|"other","label":string,"amount":number}]}',
  'Rules: one entry per purchased product; every item MUST have its own printed price; lineTotal = the printed line amount; unitPrice = lineTotal/qty (per single unit); currency = ISO 4217 code or null; total = final amount paid or null; numbers are plain dot-decimals with no symbols; preserve product names as printed; do not invent items; if unreadable return {"merchant":null,"place":null,"date":null,"currency":null,"total":null,"items":[]}.',
  'date = the purchase date printed on the receipt, ALWAYS as strict YYYY-MM-DD (convert any printed format, e.g. 20/06/2026 or 20.06.26 -> 2026-06-20); null when no date is printed. Never invent a date.',
  'place = the merchant location printed on the receipt (city, or "City, Country", or street/neighbourhood); null when none is printed. Never invent it.',
  'category (per item) = the single best fit from EXACTLY this list: bar, restaurant, market, transport, outing, entertainment, health, accommodation, other. Use the lowercase English word verbatim; null only when truly unsure.',
  'qty (IMPORTANT): qty = how many units that line bought, exactly as printed ("2x Burger", "Burger x2", "2 Burger", or a quantity column =2 -> qty:2; lineTotal is the total for ALL units, unitPrice is for ONE). Default qty:1 only when no count is shown. Keep one line per printed product line even if qty>1 (do NOT split it into separate items).',
  'NOT items (never emit these as products, they have no place in items[]): the server/waiter/cashier/attendant/operator name, table/check/order/ticket number, date, time, phone, address, the store/merchant name, NIF/CNPJ/tax id, loyalty/points, greetings, and any header/footer text. Words like "mesa","garcom","garçom","atendente","operador","caixa","cliente","comanda","pedido nº","obrigado" are NOT products. A row with no clear product price is NOT an item. Also never list subtotal/tax/tip/service/discount/change/payment/total as items.',
  'serviceCharge (T3): find a service/gratuity line ("service","servicio","servico","serviço","taxa de servico","gratuity","tip","propina") -> set amount (and percent when printed); included=true if it is already inside total, false if added on top; if there is no service mention set amount=null, percent=null, included=null.',
  'adjustments (E6): list money lines that are NOT products: couvert/cover ("couvert","cover") as kind "couvert"; any discount/promo ("discount","desconto","promo","off") as kind "discount" with a NEGATIVE amount; anything else non-product as "other". Never duplicate the service line here. If none, return [].',
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
    'action is one of: log_expense, someone_paid, i_paid_for, split_expense, record_income, transfer, withdraw, settle_debt, plan_purchase, open_split_bill, open_scan_receipt, open_outing, open_plan_expense, open_simulator, open_screen, convert_currency, compare_unit_price, unknown.',
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
    '- A pure conversion QUESTION (no spending happened): "quanto é/quanto dá/converte/quantos reais são <amount> <currencyA> em <currencyB>", "how much is X in Y" -> convert_currency. Set amount, currency=<source ISO>, toCurrency=<target ISO>. NEVER turn a question into a log_expense. If the target is omitted, leave toCurrency=null (device uses the home currency).',
    '- A cost-benefit / price-per-unit QUESTION (no spending happened): "o que vale mais/qual é mais barato/melhor custo-benefício, A de <q><unit> por <price> ou B de <q><unit> por <price>", "which is cheaper per kg/litre/unit" -> compare_unit_price. Put EACH product in comparisonItems[] as {"price":<number>,"quantity":<number>,"unit":<g|kg|mg|ml|l|un>,"label":<short name or null>}. Copy the unit the user said (gramas->g, quilo/kg->kg, ml, litro->l, unidade/un->un). Leave amount/currency null. NEVER turn this into a log_expense.',
    'Single-event examples (study these — each returns ONE action inside "actions"):',
    '- "Bruno pagou 12,80 pelas tortilhas, dividimos entre ele, eu e a Débora" -> {"actions":[{"action":"split_expense","amount":12.8,"payer":"other","person":"Bruno","participants":["Bruno","Débora"]}]} (NOT someone_paid — divided 3 ways; "ele"=Bruno; do NOT list "eu").',
    '- "dividi 100 meio a meio com o Bruno, ele pagou" -> {"actions":[{"action":"split_expense","amount":100,"payer":"other","person":"Bruno","participants":["Bruno"]}]}.',
    '- "almoço 35 dividido com a Ana" -> {"actions":[{"action":"split_expense","amount":35,"payer":"me","participants":["Ana"]}]}.',
    '- "o Bruno me pagou uma cerveja de 2 euros" -> {"actions":[{"action":"someone_paid","amount":2,"person":"Bruno","category":"bar"}]} (whole thing, not divided).',
    '- "quanto é 20 euros em reais?" -> {"actions":[{"action":"convert_currency","amount":20,"currency":"EUR","toCurrency":"BRL"}]} (a QUESTION, nothing was spent — never log_expense).',
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
  if (!token || token !== env.ADMIN_TOKEN) return json({ error: 'unauthorized' }, 401);
  const sub = url.pathname.slice('/admin'.length) || '/';
  const stub = env.TELEMETRY.get(env.TELEMETRY.idFromName('global'));
  const res = await stub.fetch(`https://t.internal${sub}${url.search}`, { method: request.method });
  return relayDoResponse(res);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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

    // DEC-251 (Onda B) — the pseudonymous install id attributes AI token spend.
    // Read once here and thread into the AI handlers; invalid/absent ids are
    // dropped by readInstallId so accounting stays strictly best-effort.
    const installId = readInstallId(request);

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

    // DEC-248 — anonymous usage telemetry ingest (NON-MONETARY; allowlisted).
    if (request.method === 'POST' && url.pathname === '/t') {
      return handleTelemetryIngest(request, env);
    }

    // DEC-251 (Onda B) — anonymous error ingest from the client crash buffer.
    if (request.method === 'POST' && url.pathname === '/e') {
      return handleErrorIngest(request, env);
    }

    // DEC-248 — read-only admin dashboard query routes (bearer-token gated).
    if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) {
      return handleAdmin(request, env, url);
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
    if (request.method === 'DELETE' && path === '/install') return this.deleteInstall(url);
    if (request.method === 'DELETE' && path === '/installs') return this.deleteAllInstalls();
    return json({ error: 'not_found' }, 404);
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