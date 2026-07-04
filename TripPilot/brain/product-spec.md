# TripPilot — Product Specification

> Last updated: 2026-07-03 (wave `2.4.0-rc`: **short links without `#k=`** — the AES key is escrowed on the worker and returned to guests; explicit shareability-over-privacy trade-off locked by Julio — DEC-455, §34; **phase budget uses ONLY the phase's own fund** — global pots/other funds become an informative "outside this math" section in the lens and leave insights/burndown/amigo/Impact — DEC-456, §32 update; **share a single expense with photos** via `/x/:slug` with its own guest page and OG card — DEC-457, §35. Same-day hotfix wave `2.3.1-rc`: pool⇒phase stamping + list/map/total coherence + `?v=` re-scrape — DEC-452/453/454. Prior: Links+Números+Acerto `2.3.0-rc`: sharing links present themselves — summary-only preview blob DEFAULT-ON with kill-switch + readable slugs with the AES key always in the fragment + per-share OG via Pages Function — DEC-445/446, §31; phase numbers explain themselves via `PhaseSpendLens` with zero math change — DEC-447, §32; debt moves reach connected devices immediately with provenance on both sides and propagated undo via the new `debt_move` mailbox kind — DEC-451, §33; expense list opens phase-scoped — DEC-448; theme step in onboarding — DEC-449; directional split notification — DEC-450. Prior 2026-07-02: Field v2.1 `2.1.3-rc` venue-not-city + automatic FX — DEC-434/435. Prior 2026-06-17: reconciled with the native arc, the receipt epic DEC-206, and the shared-link epic DEC-207.)

## What is TripPilot?

A travel budget copilot that helps users make spending decisions in real-time during trips. Not just an expense tracker — it answers: **"Can I spend this right now without hurting the rest of my trip?"**

## Core Problem

Existing financial apps look backward ("you spent €42 yesterday"). TripPilot looks forward: "You already spent €28 tonight. One more €7 drink still fits the safe ceiling. After that, stop."

## Target Users

- Travelers staying with family/friends (mixed zero-spend and outing days)
- Budget-conscious travelers managing multi-phase trips
- Groups sharing expenses (Tricount replacement with budget intelligence)
- Anyone who needs to know "how many bar nights can I still afford?"

## V1 Features — In Scope

> ### Canonical Budget Model v2 (DEC-219 → DEC-225, shipped v0.76.0–0.81.0)
> The user sees **4 real-world concepts**; the technical vocabulary (fund/pool/link/envelope/occurrence) never appears on the happy path — only in Settings → "Visão avançada da viagem" (DEC-219/D17).
> - **Trecho** — a leg of the trip = **dates + a budget**. Backend: `Phase` + a **dedicated** `BudgetPool(linked_phases)` + a 1:1 `BudgetPoolPhaseLink`, created atomically. **1 trecho = 1 dedicated budget** (DEC-219/D4); sharing one pool across trechos is an *advanced* path (the old DEC-007 mechanism, kept in the backend).
> - **Pote** — money set aside with a purpose, spendable anytime. Backend: `BudgetPool(global)` with **optional** date + goal (DEC-220).
> - **Evento** — something that happens on a date; created via the single "Planejar um gasto" door with **3 funding options** (eat from the trecho · new Pote · existing Pote). Backend: `PlannedOccurrence(kind:'event')` (DEC-221).
> - **Compra planejada** — something I'll buy "sometime". Backend: `PlannedPurchase` (DEC-175/221).
>
> The **dashboard follows the active phase's pool** (DEC-219/D3, fixes the `linkedPools[0]` bug). **Trip total = sum of trechos** + pots counted separately (DEC-224). Phases are **sequential, non-overlapping**, boundary day belongs to the starting trecho (DEC-223). **Wallet tracking is progressive** — invisible with one source, auto-on with 2+ wallets or a Wise import, plus a manual override (DEC-222). **Anti-regression rule (DEC-219/D16):** rhythm/peak/events/activities/multi-currency/Wise all remain — simplification was of nomenclature, never capability.

### 1. Trip & Phase Management
- Create trip with name, dates, base currency
- Create phases (chronological periods within a trip)
- **Canonical: each trecho gets its own dedicated BudgetPool (DEC-219).** Phases *can* still share a BudgetPool as an advanced path (e.g., two Burgos stays sharing one €760 fund — the original DEC-007 mechanism, now reconciled)

### 2. BudgetPool System
- A fund can serve one or multiple non-consecutive phases (advanced; the canonical default is 1 trecho = 1 pool — DEC-219)
- Protected reserve (visible but not treated as free money)
- Automatic reserve calculation for future linked phases
- Manual floor option with detailed recommendation breakdown
- Global funds (personal shopping, emergencies) separate from phase budgets

### 3. Envelope Budgeting
- Envelopes belong to BudgetPools, not directly to phases
- Types: operational, protected_reserve, personal_shopping, informational
- Personal shopping fund with configurable limit

### 4. Occasion-Based Forecasting (Core Differentiator)
- ActivityProfiles: home day, market, bar, restaurant, outing, transport, festival, special
- Learning engine: weighted average with initial estimates + real data
- Safe estimate calculation (P75 percentile after enough data)
- Confidence levels: low/medium/high
- Contextual dashboard: "4 bar nights left, 5 markets covered, 1 outing available"
- Savings equivalence messaging: "You saved €24 = 73% of a bar night"
- Special occasion marking (doesn't affect learning averages)

### 5. Expense Registration
- Quick-add with minimal fields (value, category, envelope)
- Shared expense support (who paid, who participated, equal or custom split)
- Separate financial flow vs. personal cost tracking
- Cash withdrawal ≠ expense (wallet transfer)
- Debt settlement ≠ new expense

### 6. Simulator ("Can I Spend?")
- Input amount → see impact on everything before committing
- Three risk levels: comfortable / attention / avoid
- Shows: affected profiles, remaining occurrences, margin changes
- Explains in natural language why it recommends or warns

### 7. Outing Mode (Main Differentiator)
- Start outing session with type, ideal target, safe ceiling, max limit, avg drink price
- Quick-add buttons: +€3, +€5, +€7, +€10, +€15, custom (user-editable)
- Cumulative total mode ("€28 so far" — asks: replaces total or adds?)
- Progressive alerts at 50%, 75%, 90%, 100%, >100% with escalating tone
- "Next drink impact" calculation: always visible, shows remaining drinks estimate
- "Amigo sincero" tone: direct and natural, not comic or condescending
- End session: confirm expenses, cash check, shared items check, mark typical/special, update learning

### 8. Scenario Planner
- Interactive [-] N [+] controls for each profile
- Real-time recalculation on every change
- Trade-off suggestions when budget doesn't fit (deterministic scoring, not AI)
- Lock/unlock items (essentials locked by default)
- Never change preferences silently — show alternatives, let user choose
- Two modes: Manual (default — user chooses) + Assisted (app recommends best trade-off)
- Priority presets: Econômico, Equilibrado, Mais Social, Personalizado

### 9. Shared Expenses & Debts
- Participants (local, linkable to accounts later)
- Split engine with equal/custom division
- Debt tracking with simplified settlement suggestions
- Future: shared expenses from other users affect budget provisionally (visible)

### 10. Wallets & Cash
- Multiple wallets (Wise, cash, cards)
- Cash withdrawal tracking (transfer, not expense)
- End-of-day cash reconciliation

### 11. Backup & Export
- JSON backup/import (manual device transfer)
- Two import modes: Merge (default) or Replace all local data
- Conflict resolution: same ID, different versions → user chooses (keep local / use imported / compare)
- CSV export for spreadsheets (17 fields per expense)
- Pre-import summary: version, date, device origin, new/updated/conflicting records
- Backup age warning with periodic reminder

### 12. PWA Features
- Installable on home screen
- Offline-first (all data in IndexedDB)
- Request persistent storage (automatic after onboarding and first expense)
- Network-first service worker with cache fallback + persistent "new version" toast (DEC-082)
- Shortcuts: /quick_add, /outings/new, /outings/active

### 13. Shared Expense Confirmation (R2 — DEC-071)
- Third-party shares are born `pending`; the payer's own share is `confirmed`
- Debts count ONLY confirmed shares; rejecting a share returns the value to the payer's personal cost
- Dashboard card shows pending count; tap opens a confirm/reject/adjust sheet per expense
- Card disappears when everything is confirmed (independent of netting/settlement)

### 14. Per-Phase Activities (R2 — DEC-074)
- "O que vai ter nessa fase?" — chip grid in phase editing with a 16-preset catalog
  (Restaurantes, Bar, Mercado, Transporte, Hospedagem, Café & padaria, Passeios & tours,
  Museus & atrações, Vida noturna, Praia, Compras & souvenirs, Festivais & eventos,
  Esportes & aventura, Lavanderia, Internet & SIM, Farmácia & saúde) + "+ Outro" (custom)
- Selecting a preset creates the ActivityProfile on demand + an enabled `phaseProfileSettings` row
- Planner, dashboard counters, and outing start respect enabled profiles only
- Absence of a setting row = enabled (permissive default)

### 15. Phase Rhythm & Peak Days (R2 — DEC-075)
- Rhythm presets per phase: Intensa / Moderada / Tranquila (+ custom)
- Peak-day selector (weekdays); peak weight 1.5×, calm days per preset
- Free-to-spend per day is weighted by effective spending days
- "Hoje é dia de pico" microcopy on the hero

### 16. Planned Events & Sub-destinations (R2 — DEC-072/073)
- Events per phase: name, date or interval, estimated cost, optional reserve, kind (event/sub-destination)
- `reservedCents` deducts from freeToSpend until the occurrence is confirmed or linked to a session
- Dashboard day card when an event is active today: "Iniciar agora" (pre-configured session,
  ceiling = reserve) or "Adiar" (+1 day)
- Ending a linked session confirms the occurrence; real spending takes over from the reserve
- One-off sessions ("É um evento único?") create a PlannedOccurrence, never a recurring profile
- Planner shows an informative events line per phase; sub-destinations track spent-so-far by date interval

### 17. Rich Outing & History (R2 — DEC-078/079)
- Post-add enrichment stepper after each quick-add (transaction already saved — logging never blocks):
  "O que foi?" → "Quem pagou?" → "Dividiu?" — each step 1 tap, skippable, auto-dismisses in 3s
- Outing history: Gastos | Saídas tabs in the expense list; read-only review per completed session
- "Histórico de saídas" shortcut in the More menu

### 18. Final Dashboard (R2 — DEC-076/077)
- Occasion counters in a CSS scroll-snap carousel (3 visible, dots if more), ordered by usage
- Rotating "Insights" block (max 4/day, significance rules): phase projection, real vs planned
  rhythm, no-spend streak, average outing cost, participant balance, next event
- Daily insight calculations persisted in `forecastSnapshots`
- Fixed 11-position layout (gap-analysis-r2 §7)

### 19. App Feel (R3 — DEC-084..087)
- Sticky headers on Dashboard, Expenses, and Planner (single `.page-sticky-header` pattern with scroll elevation)
- Unified page side padding via `--page-padding-x` token; full-bleed carousels
- Invisible scrollbars on horizontal scrollers (`no-scrollbar`); no pull-to-refresh in installed PWA

### 20. Subtractive Daily Budget + Notifications Center (R3 — DEC-088/090)
- "Livre hoje" is fixed at day start and decreases with each expense (can go negative, error color);
  recalculated average is a secondary line
- Bell → `/notifications`: pending shares, today's events, overdue backup, long-running session,
  over-budget phase — each notification navigates to its destination

### 21. Honest Friend v2 + Multi-Metric Simulator (R3 — DEC-092/094)
- `buildHonestFriendV2` compares the PLAN of the category of the last profiled expense
  (planned vs done vs how many still fit in the free margin) → on_plan / over_pace / no_plan
- Projects the date reserves start being consumed at the current pace
- "Ver impacto completo" → `/impact` detail page (trigger expense, planned vs actual per category,
  end-of-phase projection, reserve risk) — distinct from the simulator
- Simulator evaluates 3 metrics (total budget, daily allowance, planned occasions) and returns
  the WORST verdict (ok / attention / risk)

### 22. Expense Taxonomy (R3 — DEC-095..097)
- 2-level categorization: category → subcategory (`subcategoryId`, ~110 subcategories across 17 lists)
- Stepper offers subcategories sorted by typical-value proximity to the amount entered
- Event sessions: level 1 = context (bar/restaurant/market/...), level 2 = subcategory
- Stepper auto-dismiss raised to 10s, timer resets on interaction; split flow also enriches;
  session items without subcategory are tappable to detail later
- Review labels: subcategory > own description > category — never the session name

### 23. Planner Overhaul (R3 — DEC-098..101)
- Free margin updates LIVE with each [-]/[+] (negative shown in error color)
- Over-budget warning is the first thing on screen, inside the sticky header
- Category menu (tap name): edit typical value, remove from phase, per-phase classification
  (essential/planned/optional lives on the allocation item — DEC-100)
- Lock has real effect: blocks +/- with toast feedback, presets skip locked items
- Planner events and dashboard day card open the event editor via deep link
- Profiles screen: edit any profile (name, icon, typical, safe); safe removal
  (in use → disabled in all phases instead of deleted)

### 24. Participant Debt Statement (R3 — DEC-102)
- Tap a participant in /shared → itemized statement: every share composing the balance
  (expense, date, share value, who paid, status) + settlements applied
- Net from confirmed lines matches the debts engine

### 25. Device-to-Device Sync (R4 — DEC-103..108)
- User-initiated session channel between two phones: WebRTC DataChannel, E2E encrypted
  (AES-GCM; key travels in the QR, never reaches the server)
- Signaling via minimal Cloudflare Worker + Durable Object (`worker/`, free tier) — rooms
  with 6-char codes, ~10 min expiry, relays opaque messages only (DEC-107)
- Fallbacks: encrypted relay over the same WebSocket when P2P fails; two-QR manual
  signaling offline (same Wi-Fi/hotspot); single-QR payload when compressed data ≤ ~1.2 KB
- **Device migration** (DEC-104): "Receber de outro aparelho" on Welcome + send/receive on
  Backup page; full backup travels the channel; receiver uses the existing import preview
- **QR pairing** (DEC-105): identity QR `{ actorId, displayName }` registers/links a
  Participant (`linkedActorId`); typing a name remains the default path
- **Mirrored debt statements** (DEC-106): owner device keeps financial truth; the peer
  receives a read-only statement and confirms/rejects pending lines on their own phone;
  responses update `ParticipantShare.confirmationStatus` on the owner (queued if offline)
- New tables (Dexie v4): `peerLinks`, `mirroredStatements`; backup format v4
- V2+ deferrals (DEC-108): real-time table split, group multi-device merge, live shared
  outing sessions, settlement handshake, animated multi-QR

### 26. Field Review R4 (DEC-114..123)

- **Payer semantics truth table** (DEC-114, the round's critical fix) — single domain
  function `resolvePayerExpense` used by QuickAdd, outing stepper and outing split:

  | Who paid | Split? | Personal cost | Debt created | Wallet |
  |---|---|---|---|---|
  | Me | no | full amount | — | debits mine |
  | Me | yes | my share | others owe me their shares | debits mine (full) |
  | Other | yes | my share | I owe MY SHARE to the payer | no movement |
  | Other | no | full amount | I owe the FULL amount to the payer | no movement |

  "Someone paid for me" is never a gift — it is a debt reminder. Session reconciliation
  (DEC-046) adjusts over the PERSONAL total and preserves debts. End-of-session batch
  wallet never touches items paid by someone else.
- **Occasions = sessions** (DEC-115): an outing session with N items counts as ONE
  occasion; standalone expenses count 1 each. Applied centrally (`countProfileOccasions`)
  → dashboard counters, Honest Friend (`over_plan` kind when done > planned), impact
  detail and simulator all agree.
- **Contextual simulator v3** (DEC-116): asks WHERE the money goes (profile / event /
  other); answers with labeled facts and a justified verdict (fits plan / consumes N of M
  occasions / uses the whole plan / over plan / reserve covers / short by €X / free
  margin + daily-allowance reading). No raw equations, no unlabeled numbers.
- **Honest outing zones** (DEC-117): speech changes AT the target — under target /
  over target ("this comes out of other plans") / over ceiling / over max; progressive
  alerts re-anchored on the zones; "drinks remaining" counts toward the TARGET.
- **Multi-select in lists** (DEC-118): long-press enters selection mode (expenses and
  outing history); batch delete / move pool / change category via atomic orchestrators.
- **Configurable dashboard** (DEC-119): long-press a card → quick action / hide /
  configure; /settings/dashboard reorders and toggles cards (anchors stay fixed);
  persisted in AppSettings.
- **Active-outing PWA notification** (DEC-120, best effort): persistent notification with
  quick-add action buttons and a "what was it?" follow-up; SW delegates to an open window
  or writes directly to IndexedDB. True ongoing/live notifications are native-only →
  Capacitor backlog (DEC-017); research in `brain/documents/pwa-notification-research.md`.
- **Contextual help mode** (DEC-121): "?" on complex screens opens an overlay over the
  real screen highlighting element by element with concrete travel examples (registry
  `domain/help/help-content.ts`; V1 screens: Funds, Planner, Wallets, Phase/Events,
  active Outing, Backup).
- **QuickAdd payer-first flow** (DEC-123): "Who paid?" is the first-level question; if
  someone else paid: "paid everything for me" vs "we split" with debt hints.

### 27. Stability & Data Safety (2026-06-13 — DEC-137)

The guarantees the user can rely on, even when the device storage misbehaves:

- **Your data is never confused with "no data."** If the database is slow or errors,
  the app shows a recovery screen ("your data was NOT deleted" + a Retry that reopens
  the database) — it never silently sends you back to onboarding or to Welcome.
- **Cold start always lands where it should.** Opening the installed app with a trip in
  the database goes straight to the dashboard; onboarding only appears for a genuinely
  empty install.
- **The app cannot get stuck in a crash loop.** If something crashes repeatedly, a
  persistent recovery screen offers "clear cache" and "export my data" instead of
  reloading forever.
- **Emergency restore (iOS-focused).** A lightweight backup is kept on the device and
  refreshed as you use the app; if the database is ever wiped by the OS while a backup
  exists, the app offers a one-tap restore on next open. The storage-durability banner is
  reinforced for devices that won't grant persistent storage.
- **Onboarding is all-or-nothing.** Creating a trip either completes fully or leaves no
  half-made trip behind; the active trip switches only after everything is saved.
- **Faster, lighter app.** The home screen and shared data load once (no double work),
  the JavaScript bundle is split so the first load is small, and notifications/updates no
  longer reload the app mid-outing. On Android, the hardware back button keeps the app
  open on the home screen instead of closing it.

### Feature Expansion Package 1 — Fast Capture, Outing v2, Simple Mode (v0.10.x)

**Fast capture (QuickAdd):**
- The amount field is a **calculator** — type `12+3,50` or `10*2` and it saves the result (safe parser, locale-aware, no `eval`).
- **Description memory & favorites** — typing a known description suggests the last category/value; the 3-4 most frequent expenses appear as one-tap chips. Nothing is saved until you confirm.
- **Round-trip transport** — saving a transport expense offers to log the return too (one tap = two transactions).
- **Anomaly confirm** — an amount far above your usual for that category asks to confirm (catches typos). It never blocks the save.
- **Voice quick-add (where supported)** — tap the mic and say "25 at the market"; it pre-fills the form for review.

**Outing v2 (active outing):**
- Amount buttons **learn the last value** you used; **repeat last item** in one tap; **round** logs N drinks at one price at once (splits correctly).
- A discreet **fair-rotation hint** suggests who pays next, and a **time projection** estimates "~1h to the ceiling at this pace." All suggestions — they never change your data.

**Simulator:**
- A **"borrow from tomorrow"** notice appears when a spend fits the phase budget but overflows today, with the honest trade-off. It never blocks.

**Simple mode (two doors):**
- The app has a **Simple** and a **Complete** mode. Simple shows a lean home — **"free today"** and a register button — and hides advanced surfaces (planner, outings, simulator). It only **hides**: your data and the pages still exist, and a hidden page can always be opened with "open anyway."
- **One-question onboarding** ("how much do you have and until when?") creates a working trip instantly, with a "customize everything" path to the full setup; both end by asking Simple or Complete.
- **Trip presets** (Urban / Family / Festival) suggest a starting rhythm and reserve — editable, never forced.
- **Adaptive reveal** — after a few expenses in simple mode, a one-time, dismissible card offers to unlock complete mode.
- Switch modes anytime in **Settings**.

**About:**
- The About screen shows **"What's new in this version"** plus an expandable history, in your language.

### Feature Expansion Package 2 — Insights v2, Phase Cycle, Motivation, Continuity (v0.11.x–v0.12.x)

**Smarter dashboard (insights v2):**
- Insights are **no longer capped** and are **ordered by what matters now**; the carousel **rotates on its own** (every 7s), pausing when you touch it and respecting reduced-motion.
- New **calibrated** nudges that stay quiet unless the signal is real (anti-spam): **category rhythm** ("eating out is ahead of pace"), **dangerous day** (the weekday you tend to overspend, as a forecast), and **end of day** (only if you logged nothing today).

**Daily check-in:**
- A one-tap **"intent of the day"** (calm / outing / night) sets the day's context. It's **read-only** — it never changes your numbers. Where supported, you can answer it **straight from the morning notification**.

**Phase cycle:**
- When a phase ends with money left, a sheet shows the **leftover** and lets you **carry it to the next phase**, **protect it as a reserve**, or **free it for shopping** — always preserving the trip total.
- A **countdown** between phases shows "X days to the next phase — €Y/day until then."

**Motivation (read-only — never touches "free today"):**
- **Savings goal** — set how much you want to come home with and track the projection to the trip's end.
- **Piggy bank** — see how much you've banked by spending under pace.

**Learns during the trip (suggests, never auto-changes):**
- When your outings consistently cost differently than a profile's typical value, the app **suggests** an update (treating a whole outing as one occasion, ignoring special expenses). It only changes the value **if you accept**; keeping it won't ask again this trip.

**Continuity between trips:**
- At a trip's end, the app offers to **save what it learned** for next time.
- **Save a trip as a template** (phases, profiles, typical values) and **start a new trip from a template** — the structure and learned values come pre-filled, while the new trip re-learns its own prices.

### Feature Expansion Package 3 — Location & Time, Multi-Currency, Data Safety & Sharing (v0.13.x–v0.14.x)

**Where & when (opt-in location — DEC-157):**
- Turn on location and each expense can remember **where** it happened — a friendly place name (reverse-geocoded once, then offline) you can always edit by hand.
- **The place name is the venue, not the city (DEC-434):** the "local" field shows the **establishment** (e.g. "Confitería Juarreño"), kept distinct from the description ("what I bought"). Wise imports derive the venue from the statement (dropping the trailing city token) and a background geocode **upgrades** an app-derived name to the real place name; a name **you typed/verified** is never overwritten.
- The last place is **sticky** so a string of expenses at the same spot needs no retyping, and your **recent places** come back as one-tap chips (works offline).
- See **spend by place** and the time of each expense. Location is **off by default**, asked for only when you opt in, and an expense **always saves** even if the GPS or naming fails.
- **Spends on the map (DEC-416 · DEC-426/428/429):** a full-screen **satellite map** of every spend with a real coordinate, reachable from a labelled **"Mapa"** pill on the Expenses toolbar (and the guide). The satellite surface shows **street/place labels** (Esri imagery + reference overlays) and **tapping a pin reveals the place name**. Spends at the same place group into one point and **cluster by zoom**: **tap a cluster = zoom in**, **hold a cluster = list its spends** (total + paginated list → open any). The map only ever shows **real** coordinates (never invents one) and is **best-effort/offline-safe** — nothing on it blocks. It is the traveler's own and is **never shared**.

**Multi-currency (DEC-158):**
- Log an expense in a **foreign currency** (e.g. `300 CZK`) while your budget stays in the trip's **base currency**. The app converts and shows **"300 CZK (≈ €12)"** everywhere.
- The **original amount and currency are kept forever**; only the base value touches your budget and wallets. You can **freeze a rate** per currency (opt-in) so the trip's math doesn't drift with the market.
- **Rates update automatically (DEC-435):** the app keeps a live reference-rate snapshot fresh in the background (refreshed on open when it's older than ~12h, best-effort/offline-safe), so a foreign expense **converts with the automatic rate by default** — typing a rate is only an **override**, and a manual rate is the **offline fallback**.
- **"Ver na minha moeda" (See in my currency — DEC-435, renamed from "mental anchor"):** pick a currency you think in and every foreign amount also shows **"≈ R$ …"** in it; that rate now **reads from the automatic snapshot** (manual value kept only for offline).
- **Converter is ready before you open it (DEC-423 · DEC-435):** the **main currencies** are always offered and pre-loaded, so you can convert **any major → any major with no button press**.

**On-device daily safety net (DEC-159):**
- The app quietly keeps **rolling daily restore points on the device** (the last several days). If something goes wrong you can **restore to yesterday** in one step — separate from, and on top of, your own JSON backups. These snapshots **never leave the device** and are not part of a backup file.

**Backup sharing & read-only report (DEC-160):**
- Send your backup **anywhere via the system share sheet** (cloud drive, chat, email) instead of only saving a file, with the usual **backup-age reminder**.
- Generate a **self-contained HTML trip report** — a read-only summary you can open in any browser and share, with no app required.

**App lock & share-into-app (DEC-161):**
- Optional **PIN lock at startup** (off by default). The PIN is stored only as a secure hash (never in clear), and **recovery/onboarding screens are never locked**, so a forgotten PIN can never trap your data. Biometric unlock is deferred (PIN is the baseline).
- **Share text into TripPilot** from any app (a receipt total, a message) and the **QuickAdd form opens pre-filled** for review — it never saves on its own.

### 28. Group Split — Tricount-style events (Coherence wave — DEC-297, v1.0.0-rc)

A persistent, multi-expense, multi-payer **group split event** — distinct from the single-bill
"Dividir conta" (which splits ONE receipt at a table). You create an event (e.g. "Eurotrip
apartment"), add people, then log many expenses over days/weeks and the app keeps a running
"who owes whom".

- **People**: by name, **connected** app people (linked to a trip participant), or **no-app**
  guests. A trip-scoped event can quick-add the trip's own participants (linked).
- **Expenses**: **manual + AI text + receipt photo** (reuses the same cloud `/ocr` + assistant the
  rest of the app uses); each expense names **one or many payers** and is split **equally OR
  custom** (both in scope). Money is integer cents; the sum of shares always equals the expense
  (ÂNCORA 11). Balances + a greedy **minimum-transfer** settle mirror the trip settle-up.
- **Public claim link (`/g/:id`)**: shareable to anyone with no app, reusing the exact encrypted
  share channel as the bill-split live table (ciphertext on the worker, AES key only in the link
  `#fragment` — DEC-207/297). A guest **picks their own name**, sees their net + the exact transfer,
  and **marks paid**; the owner **confirms receipt** (lifecycle: unpaid → marked[amber] →
  confirmed[green], never red).
- **History & sync**: events persist on-device (Dexie `groupSplitEvents`, in the encrypted backup).
  For a **trip-linked** event, confirmed group payments surface **read-only** in the trip's
  "Acerto de contas" via a contained bridge (DEC-306) — the settle action stays in the group and
  the trip money ledger is never mutated (no phantom transactions).
- **Discovery (DEC-360)**: `/groups` is the **one canonical list** of group divisions. Every door
  converges there — the FAB "Dividir → Divisão em grupo", a first-level **"Divisões em grupo (N)"**
  tile in the Viagem hub grid, and a summary pointer on `/shared` — never a second list. The two
  split modes ("Dividir conta" by items vs "Divisão em grupo") are explained at every door via a
  reusable `<ConceptHint>` (DEC-358).

### 29. State Dictionary — the app speaks one language (Coherence wave — DEC-304)

Every recurring concept has **one consistent label and color** across the whole app, so two screens
never contradict each other: **real** spend vs **planned**/**allocated** vs **free** money;
**simulated** vs **will be saved at close** vs **already saved** (piggy); **outing** (one entity) vs
**item**; and the settle/payment lifecycle (**pending → confirmed → paid**, plus the Tricount
**marked → confirmed**). The governing rule: **red means a real problem only** (out of money / over
the limit / into the reserve) — normal progress and plan adjustments are calm/neutral, and every
alert says *what happened · why it matters · what to do · whether it's real or just a plan change*.

### 30. Cofrinho — the official rule (Discovery & Clarity wave — DEC-312, DEC-313/314)

The cofrinho ("piggy") is a **buffer**, not a separate wallet. Its rule — exactly what the user
described and exactly what the code already does (`buildPiggyLedger`, Model B, DEC-279/261), with
**no math change this wave** (ÂNCORA 11):

- **A day under the daily rhythm** → the difference is **deposited** into the cofrinho.
- **A day over the rhythm** → the cofrinho **covers the overspend first**; the following days only
  drop by the part the cofrinho could not cover (`uncovered`).
- **Balance**: `bal_d = max(0, bal_{d-1} + dailyIdeal − spent_d)` — path-dependent, so an empty piggy
  on a bad day cannot go negative and a later great day does not silently repay it.

**One destination for the day's saving (DEC-313/314):** when the phase has dates the cofrinho is
active and a calm day's saving goes **there** (and that buffer is what protects the days ahead);
when there is no cofrinho (an ongoing / no-date phase) the saving **dilutes into the next days**. The
app never shows both at once, and never highlights the cofrinho when the money did not go to it. The
same plain-language rule appears in three places: the cofrinho statement, the day check-in's "Destino
da economia de hoje", and the hero "De onde vem?" sheet.

**One hero number for the day (Field v2 — DEC-427):** the Home leads with a **single** figure —
**"Livre para usar hoje"** — and nothing competes with it. The former "Ritmo de hoje" (peak-weighted)
and "Média até o fim" (flat) move into the hero's **"De onde vem?"** explainer as clearly-labelled
**projections/estimates**, not headline money; the word **"ritmo"** is reserved for the cofrinho
mechanic (deposit/cover), never the hero. Critically, the hero and the **per-day allowance map now
read the same truth**: when the cofrinho already parks leftover, the daily allowance is **capped**
(`piggyCap`) **for today's cell exactly like the hero** (fixing the old "5 shown here / 14 shown
there" mismatch), and the parked slice is surfaced inline as **"Guardado no cofrinho"**. This is a
**display + consistency** change — `baseFree` and every total stay **invariant** (proven by an anchor
test asserting today's cell equals the hero bit-for-bit).

### 31. Links that present themselves — rich previews + readable slugs (Links+Números+Acerto wave — DEC-445/446, `2.2.3-rc`; key model AMENDED by DEC-455, `2.4.0-rc`)

Sharing links (`/g` group boards, `/t` live splits, `/s` statements, `/x` single expenses) *present
themselves* when pasted into WhatsApp/social. **Key model since DEC-455**: new links go out **short,
with no `#k=` fragment** — the AES key is escrowed on the worker (KV, next to the ciphertext) and
returned to guests on `GET /share/:id`; old fragment links keep working forever (fragment wins when
present). The declared trade-off: new links are no longer E2E-against-the-server — Julio explicitly
chose shareability over that guarantee. The key still never appears in slugs, previews, logs or
query strings:

- **Preview blob (DEC-445, DEFAULT-ON with kill-switch)**: on publish, the client stores a plaintext
  **summary-only** blob (≤1KB: title, description, total, currency, people count, updatedAt, imgId —
  NEVER items, per-item names, the key or the writeToken) NEXT TO the ciphertext. A public
  `GET /preview/:idOrSlug` (no rate limit, logged) serves it. Settings → "Prévia nos links" (default
  ON) kills future previews and erases stored ones **without breaking the link**; revoking a share
  erases preview + slug mapping.
- **Readable slugs (DEC-446, suffix widened by DEC-455)**: new links come out as
  `/g/churras-do-bruno-x7f2mp` — a slugified name + 6-char suffix mapped to the raw id in KV
  (6 chars because the slug is now the full capability). The slug resolves everywhere (`/share`,
  `/responses`, `/ws`, `/preview`); **old raw-id links keep working forever** (the slug is a new
  layer, not a replacement).
- **OG surface (DEC-445 part 2)**: `index.html` carries a branded static OG block (default card);
  a **Cloudflare Pages Function** intercepts ONLY `/g/*`, `/t/*`, `/s/*` (via `_routes.json`) and
  injects per-share `og:title/description/image` (HTML-escaped; R2 image when the share has one,
  else a branded card per type). Any failure serves the untouched SPA shell — a link never breaks.
  Crawler-probed (WhatsApp + facebookexternalhit UAs) on the apex.

### 32. Phase numbers that explain themselves — PhaseSpendLens (DEC-447, `2.2.2-rc`; scope REMADE by DEC-456, `2.4.0-rc`)

A field investigation of the real case (628 configured / 602 projection / 345 impact / 734 spent /
873–884 heroes) concluded **zero math bugs** — every difference was labeling or scope. The fix is a
single explaining lens, not new arithmetic (Â-NUMBERS-EVIDENCE-FIRST):

- **Scope rule since DEC-456 (the Tomorrowland case): phase budget = the phase's own primary fund
  ONLY.** `calculated envelope = configured − event reserves`; the subtraction line is the
  **phase-fund spending only**; "Livre agora" closes with exactly those lines. Money from global
  pots or other funds attributed to the phase moves to a separate informative section ("Fora desta
  conta") that explicitly does NOT sum. The same phase-money-only scope feeds the dashboard's
  budget insights, burndown, honest friend and the Impact page (`phaseMoneyTxs` /
  `phaseMoneySpentCents`); behavioral insights (occasion counts, categories) still see all phase
  transactions.
- `PhaseSpendLens` (pure domain) reconciles the phase money canonically (invariant under test with
  the real-case fixture).
- The projection detail ("Como cheguei nisso") and the impact screen show a **"De onde vêm esses
  números"** block whose lines **actually add up** to the number on screen.
- The label "Orçamento da fase" became **"Orçamento disponível calculado"** — it was never the
  configured value, and now says so.
- The "All phases" expense list shows how much of the total comes from **other phases**, with a
  one-tap switch to the current phase (see also DEC-448: the list opens scoped to the current phase).

### 33. Debt moves that reach the other device (Links+Números+Acerto wave — DEC-451, `2.3.0-rc`)

Moving a debt (DEC-414's reassignment) now works for **connected people** too — immediate, never
silent (Â-MOVE-VISIBLE-BOTH-SIDES), superseding DEC-430's "charge, don't move" for peers with a
reachable mailbox:

- **Owner side**: connected people with a mailbox key are direct move destinations
  (`connected_movable`); the reassignment applies locally at once (total net invariant) and a new
  encrypted **`debt_move`** mailbox payload propagates it. Key-less peers keep the honest
  charge-only path.
- **Recipient side**: the drain folds the moved items immediately — payer = the mover, a confirmed
  share on me, and the share carries **`reassignedFromName`** so the statement shows "veio de
  {original debtor}" even on a device where that person never existed. Idempotent per item
  (`externalRef`); arriving before any trip exists leaves an **actionable card** ("Aplicar no
  caderno") — nothing is lost.
- **Source side (connected)**: gets an informative card — "your bills moved to {name}"; their ledger
  never auto-mutates.
- **Undo propagates**: the owner's undo sends a `revert` that surgically soft-deletes exactly what
  the apply created and updates the cards. The worker relay is untouched — `debt_move` is opaque
  ciphertext like every mailbox kind.

### 34. Short links — the AES key lives on the server (DEC-455, `2.4.0-rc`)

Every outgoing share link (`/s`, `/t`, `/g`, `/x`) is now **short**:
`https://…/g/churras-do-bruno-x7f2mp` — no `#k=` fragment. Julio locked this explicitly (twice):
shareability beats the E2E-against-the-server guarantee for links people actually paste around.

- The client always sends the AES key on publish (`extras.k`); the worker stores it in KV next to
  the ciphertext and returns it to guests on `GET /share/:id` (`key` field). Content remains
  encrypted in transit and at rest; what changes is **who holds the key** (the server can now
  technically read new shares — stated honestly, not hidden).
- **Both directions stay compatible**: an old link WITH `#k=` opens forever (the fragment takes
  precedence; shares created before escrow still resolve), and a new short link opens on old
  content once the key round-trips.
- Slug suffix went 4 → 6 chars (`SLUG_SUFFIX_LENGTH`) since the slug alone is now the capability.
  Revoking a share erases ciphertext + preview + slug + escrowed key.

### 35. Share a single expense — with its photos (DEC-457, `2.4.0-rc`)

"Compartilhar gasto" on the expense detail publishes the expense through the same share channel
(preview + slug + escrow) as everything else:

- **Payload** (`expense-share-payload.ts`, zod v1): who shared, description, category, amount +
  currency, date, place label, notes, up to 4 photos — **structurally free of** funds, wallets,
  budgets and participants (the guest sees the expense, never the owner's finances).
- **Photos travel**: attachments upload as plaintext copies to R2 (the DEC-348 group-image path);
  the first photo becomes the preview `imgId`, so **the WhatsApp card shows the actual expense
  photo**. Republishing bumps `?v=` (DEC-454) to force a re-scrape.
- **Guest page** `/x/:slug` (no app needed): amount, date/time, place, notes, photo grid, friendly
  error states (revoked / expired / offline). OG injection covers `/x/*` with a branded
  `og/expense.png` fallback card; the in-app QR scanner recognizes `/x/` links.

## V1 — In Scope With Constraints (reconciled 2026-06-17)

These were once "not in scope" but shipped under explicit, honest constraints (this section
fulfills the DEC-207 mandate to rewrite the old "no remote database" line):

- **Minimal portable backend** — the shared-link epic stores ciphertext (TTL + revoke) in
  Cloudflare KV (`SHARE_STORE`); portable by design, no vendor lock-in (DEC-207). **Key model
  amended by DEC-455 (`2.4.0-rc`)**: the AES key is now escrowed on the worker so links go out
  short (no `#k=`) — old fragment links keep working; the key still never appears in logs,
  previews or query strings. The DEC-107 signaling Worker still relays opaque bytes for live P2P.
- **Receipt import (photo → items → split)** — attach a photo to any expense, read it into items,
  split among chosen people (DEC-206/208). Images are device-local, never in the backup.
- **AI/LLM (opt-in, no-train provider)** — the receipt reader uses Groq behind the Worker `/ocr`,
  opt-in with disclosure; the provider does not train on data; manual entry is the always-available
  fallback (DEC-206/209). On-device OCR was removed (DEC-209).

## V1 — Explicitly NOT in Scope

- Login / user accounts / authentication
- Automatic always-on background sync (R4 sync is user-initiated; the shared link is async pull +
  best-effort live with the app open — DEC-207)
- Bank integration via API (Wise is CSV statement import only — DEC-200 — not the Wise API)
- Play Store / App Store publication (sideload-first; may or may not reach the Play Store later)
- Native iOS app (iOS users are web/PWA)
- Android widget
- Remote push with the app CLOSED (needs FCM/Play Services — against the sideload-first posture)
- Social features / gamification
- ~~Geographic map visualization~~ **SHIPPED** as "Spends on the map" (DEC-416/426/428/429; satellite + labels, cluster tap=zoom / hold=list). The phase "map" remains a separate per-day calendar (DEC-211 Wave B), not a geo map.
- Subscription/monetization system
- Kotlin-only native implementation

## Core Rules

1. **Simple daily average is a secondary indicator only** — occasion-based forecasting drives the product
2. **Financial flow ≠ personal cost** — always track both separately
3. **Cash withdrawal ≠ expense** — it's a wallet transfer
4. **Debt settlement ≠ new expense** — it closes an existing obligation
5. **Protected reserve ≠ free money** — visible but never suggested for casual spending
6. **Personal shopping never silently reduces daily budget** — separate global BudgetPool (DEC-041)
7. **No silent preference changes** — always show impact, offer alternatives, let user decide
8. **Every number must be explainable** — user can tap any value and see the calculation
9. **The app should also encourage spending** — "You saved enough for an extra bar night!" is as important as warnings
10. **No personal data in public build** — app starts empty, user imports private backup
11. **All code in English** — variable names, comments, function names
12. **Mobile-first design** — large buttons, minimal forms, readable on small screens
13. **Never block registration** — budget at zero, outing over max, phase boundary crossed → warn, don't block (DEC-053)
14. **Never delete history silently** — "Registrar total atual" creates reconciliation adjustment, not replacement (DEC-046)
15. **The app is generic** — no hardcoded references to Julio, Burgos, or any specific trip. All personal data via private import
16. **Wallet selection is optional** — missing wallet marked as "Carteira não informada" for later review (DEC-051)
17. **Protected reserve single source** — stored as Envelope (kind: protected_reserve), never duplicated as BudgetPool field (DEC-042)

## Onboarding

Minimal required: trip name, phase name, start/end dates, currency, amount, optional protected reserve → dashboard.
Profiles, participants, wallets, extra phases configured later. Presets available: Hospedado com família, Viagem urbana, Festival, Personalizado.
See DEC-036, DEC-037.

## Data Model Key Rules

- Phase can exist without BudgetPool (DEC-039)
- Phase can access multiple BudgetPools; each expense → exactly one pool (DEC-040)
- BudgetPool has scope: "global" (e.g., personal shopping) or "linked_phases" (DEC-041)
- ScenarioAllocationItem = aggregate planned quantity; PlannedOccurrence = specific event with optional date (DEC-043)
- ActivityProfile stores: typical value, safe value, confidence, optional frequency. Three-limit (meta/teto/máx) only in Outing Mode sessions (DEC-044)

## MVP Screens

### Core Flow (mobile-first)
1. **Welcome** — First launch: create trip / import backup / load demo
2. **Onboarding Wizard** — Trip setup → phases → budget → profiles → preferences (multi-step)
3. **Phase Dashboard** — THE main screen: today's status, occasions remaining, quick actions, pending alerts
4. **Trip Overview** — All phases, total budget, spending timeline
5. **Add Expense** — Bottom sheet: quick form with optional sharing
6. **Expense Detail** — View/edit single expense, see impact
7. **Outing Mode** — Start → active session (quick buttons + alerts) → end/confirm
8. **Simulator ("Can I Spend?")** — Amount input → full impact preview
9. **Scenario Planner** — Interactive trade-offs with [-] N [+] controls

### Supporting Screens
10. **Expense List** — Filterable by phase, category, date range, shared
11. **Shared Expenses & Debts** — Who owes whom, pending confirmations, settlements
12. **Wallets** — Manage wallets, cash reconciliation
13. **Reports** — Spending by category, timeline, profiles, savings equivalence
14. **Settings** — Alert tone, currency, preferences, about
15. **Backup & Data** — Export/import JSON, export CSV, backup status
16. **Trip/Phase Editor** — Edit existing trips, phases, budget pools

---

*See [decision-log.md](decision-log.md) for all approved decisions. See [technical-direction.md](technical-direction.md) for stack details. See [implementation-phases.md](implementation-phases.md) for delivery order.*
