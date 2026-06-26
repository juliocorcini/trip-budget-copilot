# Leva — Grupos Confiáveis & Acerto Claro (Group-Split Reliability · Live Truth · Settle-Up Redesign)

> **Status: ✅ ACTIVE — LOCKED by Julio (2026-06-26).** All four §16 locks are IN (L-IMG, L-LIVE, L-RT,
> L-IA). This wave answers Julio's **third field review** (the 1.2.x/1.3.0-rc device test). It is mostly
> **bug-fixes + two decision REVERSALS of things the previous wave just shipped** (E2E images,
> owner-as-reducer pending-gate) + a **deep settle-up IA rethink**. Each point was run through an **inline
> council** (§7). **Identity name (DEC-350) resolved by Julio:** use the **onboarding owner name** first;
> fall back to an optional `profileName`, then the device label. **Execute G1→G9 straight through.**
> **Base version:** `1.3.0-rc` (current). **Cadence:** `1.3.1-rc → 1.3.5-rc` per gate, **headline
> `1.4.0-rc` at G6** (real-time delivery), then `1.4.1 → 1.4.3-rc`.
> **Predecessor (the wave being corrected):** `2026-06-25-groups-sync-cloud-orchestrator.md` (G0→G7,
> shipped `1.3.0-rc`). **Siblings (tone/structure):** `2026-06-25-field-fixes-clarity-2-orchestrator.md`,
> `2026-06-25-discovery-clarity-implementation-orchestrator.md`.

---

## §0 — Mission

Make **group split** a ledger you can *trust in the field* and make **acerto de contas** a screen a
first-time user *understands*. The last wave shipped the features; this wave makes them **correct,
live, and legible** — and **reverses two calls** that field use proved wrong.

The central pains, in Julio's words (3rd review):
- *"Excluí a despesa e o total continuou 120 — e o saldo errado mesmo recarregando."* (stale math)
- *"A despesa do convidado fica 'aguardando sincronizar' até eu, dono, abrir o app — não pode."* (sync gate)
- *"A foto some quando saio e volto no grupo."* + *"quero várias fotos."* + **"tira a criptografia da
  imagem, salva no servidor normal."** (image rework + **reversal**)
- *"Apareci como 'Android Chrome' pra outra pessoa — tinha que ser o meu nome, Júlio."* (identity)
- *"Conectei, mas só um lado viu o outro."* (bilateral connect)
- *"A cobrança só apareceu quando recarreguei — tinha que chegar na hora, e ficar na central de
  notificações e na tela inicial."* (real-time + notifications)
- *"Todo QR do app tem que ser um link — quem lê com a câmera normal vê um texto inútil."* (QR-as-URL)
- *"Não dá pra penalizar quem marcou que pagou se o outro não confirma; e quem confirma deveria ser quem
  recebeu."* + *"quero um histórico de quem pagou quem."* (payments clarity)
- *"Na criação do grupo quero adicionar quem já existe / já é conectado — sem lista gigante."* (compose)
- *"Acerto de contas continua confuso — pega print, manda pro conselho seção por seção. 'Pessoas' e
  'Amigos conectados' me confundem."* (the deep IA rethink)

**What this wave IS:** (a) fix the group-split **correctness** bugs (delete-recalc, live propagation,
photo persistence, registrant display); (b) **reverse** image E2E → access-controlled plaintext on R2;
(c) **reverse** the owner-as-reducer *pending gate* → a **live shared board** (owner stays moderator);
(d) fix **identity** (onboarding name, not device label) + **bilateral** connect + Android QR zoom; (e) make
every **QR a URL**; (f) make delivery **real-time** + route inbound into the **notification center +
home**; (g) a **payments-clarity** layer (states, who-confirms, history); (h) **add existing/connected
people** at creation; (i) a **deep settle-up IA redesign** + unify Pessoas/Amigos + concept explainers.

**What this wave is NOT:** a login/accounts system (identity still = device `actorId` + a chosen
**name**); a rewrite of the ledger arithmetic (the math is unchanged — we fix *when/where* truth
propagates and *how* it's shown); native push via APNs/FCM (real-time = a signal-DO ping while the app is
reachable, plus a local/OS notification — no accounts).

TripPilot is a local-first travel-budget PWA (React + TS + Dexie; pure-TS domain; Cloudflare Pages + one
`trippilot-sync` Worker). **§16 is LOCKED — go straight to §17 and execute G1→G9.**

---

## §1 — Identity & autonomy contract (you are the executor)

1. **No subagents / no Task tool / no delegation.** Everything inline, one session. Councils = sections.
2. **Don't ask permission to advance** once a gate's lock is satisfied. Milestone → commit → deploy →
   dev-log → next. Only stop at the genuine hand-off (DoD all TRUE / hard blocker / context out / an
   **open §16 lock** for the next gate).
3. **Do, don't narrate.** Minimize prose.
4. **Reuse, never reinvent.** §4 baseline + §6 root-cause map say exactly what already exists. This wave
   is ~80% *fixing/relabelling/re-composing* existing code — almost no greenfield.
5. **Code in English; UI via `t()`** (pt/en/es), never hardcoded. Money = integer cents.
6. **Domain before UI**, one change at a time, **test with the change**.
7. **WSL terminal safety** (§11): `git --no-pager`, `"$G" commit -m`, no pager/editor.
8. **Keep the brain in sync** (§14) every milestone.
9. **Terminal hand-off ends with `AskQuestion`** — only at a genuine stop.
A *new* ambiguity the brain + this doc don't resolve → inline council on the spot → `DEC-NNN (PROPOSED)`
→ continue.

---

## §2 — Reading order (load once)

This doc §0–§9 → `src/dev-log.md` (Current State) → the **predecessor** orchestrator (it's the code you're
correcting) → the cited DECs only (**DEC-340** owner-as-reducer, **DEC-342/343** image E2E, **DEC-344**
two-way/peer-ping, **DEC-345/346** debt/payment, **DEC-347** settle IA, **DEC-207** Worker-ciphertext,
**DEC-297/306** group/trip bridge, **DEC-266** auto device name) → `product-spec.md` §25/§28 + "V1 in
scope w/ constraints" + "Explicitly NOT in scope" → a sibling orchestrator for tone. **Do not re-read the
whole brain per milestone.**

---

## §3 — Non-negotiables (ÂNCORA)

**Inherited (app-wide):**
- **Money = integer cents**; pure-TS domain (zero React in `domain/`); **Σ shares == amount** (ÂNCORA 11).
- **Ledger-math invariance:** the *arithmetic* (`expenseShares`, `computeGroupBalances`,
  `computeGroupTransfers`, greedy min-transfer, debt engine) is **unchanged** this wave. We change
  *propagation timing*, *display*, *storage* — **never the formula**. (Making a stale total *correct* is a
  bug-fix, not a math change.)
- **Hide-never-delete**; nothing destructive without an undo/tombstone path.
- **UI text via `t()`** in pt/en/es; **code in English**.
- **Never block expense logging** — manual entry always works; AI/photo/cloud are opt-in. **And never
  block a contribution on the owner being online** (this wave's correction to that ÂNCORA).
- **Additive schema only** unless a real migration is justified; new optional fields are non-indexed.

**Amended for this wave (the reversals — see §7 councils + §16 locks):**
- **~~Images E2E only~~ → Â-IMG (revised):** the Worker stays **ciphertext-only for messages, debts,
  names, statements** (DEC-207 **unchanged**). **Shared group/bill IMAGES are exempted**: stored as
  **access-controlled plaintext** on R2 behind an **unguessable random id + TTL + delete-on-revoke**
  (DEC-348 supersedes the image E2E of DEC-342/343). Rationale: field-proven persistence failure +
  Julio's explicit directive + the privacy delta is bounded (an unguessable URL, short TTL, revoke).
- **~~Owner-as-reducer pending-gate~~ → Â-LIVE (revised):** a contribution is **live for everyone**
  (every viewer folds all snapshots locally — shared read-fold) and **must not wait for the owner to open
  the app**. The owner stays the **money authority + moderator** (tombstone/confirm/remove), not a sync
  gate (DEC-349 amends DEC-340; the owner-authority + stable-id + tombstone parts of DEC-340 **stay**).
- **~~Peer-ping = V2~~ → in scope (DEC-352):** real-time delivery via the existing signal DO is **now
  required** (DEC-344's "V2" note is promoted), bounded to "instant while the app is reachable" (no APNs).

**Still absolutely inviolable:**
- **No login.** Identity = device `actorId` + a **name resolved from onboarding** (owner name `??
  profileName ?? deviceName`, DEC-350).
- **Owner device = group money authority.** Multi-writer/CRDT on the money ledger stays out.
- **Honest sync state** — no ghost connections, no fake "delivered/confirmed" (DEC-344/N4).
- **Settlement ≠ duplicating the expense**, but a confirmed P2P payment still **credits a fund** (DEC-346,
  unchanged); the trip settle-bridge (DEC-306) stays read-only.

Breaking one is a defect even if tests pass.

---

## §4 — Baseline: what already exists (reuse, don't rebuild)

| Area | File → symbol | What it already does | The GAP / what to change |
|---|---|---|---|
| Group math (pure) | `domain/group-split/group-split.ts` → `expenseShares`, `computeGroupBalances`, `computeGroupTransfers`, `groupTotalCents`, `addExpense/updateExpense/removeExpense`, `groupExpenseDay*` | equal/custom split, balances, greedy transfers, day-grouping; `removeExpense` already tombstones guest-authored ids | math is correct — the **stale total** is a *read/propagation* bug, not here |
| Guest claim + reducer (pure) | `domain/group-split/claim-response.ts` → `groupClaimResponseSchema`, `buildGroupClaimResponse`, **`reduceGroupClaims`**, `foldClaimExpense` | guest posts a **snapshot** (name + paid + authored expenses w/ stable ids + items + imageRef); owner folds add-or-retract, idempotent, owner-authority | **`reduceGroupClaims` is pure** → can run on the **read** side for *every* viewer (the live-board key, G3); no new code to fold |
| Guest channel (transport) | `features/group-split/group-link.ts` → `postGroupClaim`, `pullGroupClaims`; share `/responses` slot | each batch AES-encrypted with the **link key** (in the `/g/` `#fragment`) → every guest already has the key to read **all** responses | a guest currently only **posts**; it can also **pull+fold** to go live (G3) |
| Detail screen | `features/group-split/GroupSplitDetailPage.tsx` | total/people card → Expenses → People → **Pagamentos**/**Quem-paga** toggle buttons; invite link+QR; photo gallery; lifecycle | accordions **both open at once** (F01); names small (F03); registrant shown unevenly (F04); photo lifecycle is "local-until-shared" → **lost on reload** (F07); **non-sticky** header (F28) |
| Expense editor | `features/group-split/GroupExpenseEditor.tsx` → `scanReceiptForGroup`, `scanReceiptItemsForGroup`, `parseTextForGroup`; `useImageSourceChooser`; `items`/`itemsActive`; single `pendingImage`/`imageRef` | "nota completa" (`scan_full`) · "selecionar itens" (`scan_items`) · "pedir IA" (`ai_ask`); item list from a scan; one photo | **rename** the 3 modes (F05); **manual item add** (F05); **multiple** photos (F08) |
| Public board | `features/group-split/GroupClaimPage.tsx` (`/g/:id`) | guest picks name, sees net, marks paid, can author expenses (snapshot), CTA | reads only the owner-published snapshot → **not live** (F10); registrant/photos uneven (F04/F09) |
| Image boundary (client) | `data/sync/media-link.ts` → `uploadEncryptedImage`, `fetchDecryptedImageUrl`, `deleteSharedImage`; `domain/media` (`ImageRef`, caps) | **compress → AES-GCM encrypt → PUT octet-stream**; lazy GET+decrypt; delete | **DELETE the encrypt/decrypt path** (DEC-348): PUT the compressed JPEG, GET serves it directly; `ImageRef` drops `key`; **always upload on attach** (F06/F07); `imageRefs[]` (F08) |
| Worker image route | `worker/src/index.ts` → `handleImg` (`PUT/GET/DELETE /img/:id`), `MEDIA: R2Bucket`, TTL, cap | content-agnostic store + TTL + per-object cap | serve the **real content-type** for plaintext (so `<img src>`/download works for a web guest); cap/TTL/revoke stay (F06/F09) |
| Identity (no login) | `domain/types/app-settings.ts` → `deviceName` (single field), `DeviceIdentity`; `data/db/seed.ts` → `suggestDeviceName()` (→ "Android Chrome"); `data/sync/identity-crypto.ts` → `getDeviceIdentity`; **onboarding owner name** in `domain/onboarding` / `OnboardingPage` (active-trip owner participant) | one auto-seeded `deviceName` used as the share/connect/P2P `fromName` | **use the onboarding owner name everywhere** via `resolveSelfName` (owner `?? profileName ?? deviceName`); no new field by default (F13/DEC-350) |
| P2P + connect | `domain/orchestrators/p2p-orchestrators.ts`, `sync-orchestrators.ts`, `mailbox-orchestrators.ts` → all stamp `fromName: settings.deviceName` | charge/payment/connect envelopes; reverse-link `connect` (G6 of last wave) | swap `deviceName` → `resolveSelfName` (onboarding name first) (F13); fix the **bilateral** asymmetry so both sides upsert + see correct names (F14) |
| QR | `components/QrCodeDisplay.tsx` (render), `components/QrScanner.tsx` (scan, `computeZoomLevels`); identity QR + statement "QR" payloads | renders whatever string it's given; scanner has 1×/2×/3× gated by `zoomLevels.length > 1` + capability timing | **every QR = a URL** (F16/DEC-351); Android zoom regressed (F15) — re-derive zoom after the track settles / relax the gate |
| Real-time signal | `worker/src/index.ts` → `SHARE_SIGNAL` DO + `/rooms/<id>/ws` (relays "something changed" pings; payload stays in KV/mailbox) | a working WS ping relay already exists | **reuse it** for a P2P **peer-ping** (F17/DEC-352): on send, ping the recipient's room → an open app drains instantly |
| Notifications | `domain/insights/notifications.ts` (local/insight notifications), `features/notifications/NotificationsPage.tsx` (the center), `utils/native/notifications.ts` (OS notification), `utils/notifications.ts` | a notification center + native-notification capability exist | **route inbound P2P** into the center (persist) + fire native + toast (F18); pending actions also on the **home** dashboard card (F19) |
| Mailbox inbox | `mailboxQueueRepository` (`enqueueIn`/`pendingInbox`/`remove`); `getInboundP2pItems` (G7) | inbound debt/payment queued as PENDING; `/shared` shows the cards | surface those same pending items in the center + home (F18/F19) |
| Settle hub | `features/shared/SharedExpensesPage.tsx` (`/shared`) | header (h1 + fixed Meu QR) → P2P inbox → summary → group-settle → people → connections → awaiting → shared expenses → pending debts → charge/pay sheets | **too many concerns at once** (F25); **Pessoas vs Conexões** confusing (F26); non-sticky header (F28) — the deep council (DEC-356/357) |
| Concept doors | FAB "Dividir" (DEC-309/310), `/split`, `/groups`, discovery hub, help center | entries exist; no inline explanation of *which to use* | add **"Dividir Conta vs Divisão em Grupo"** explainers (F27/DEC-358) |
| Dashboard | `domain/dashboard/dashboard-cards.ts`, `features/dashboard/DashboardCards.tsx` | data-driven home cards (hide/order/pin) | add a **"pending actions"** card for inbound charges (F19) |

---

## §5 — Change-set, normalized (F01–F28, by priority)

**Theme G — Group-split UX quick wins (P0, no/low backend):**
- **F01** Accordion exclusivity: **Pagamentos** XOR **Quem paga quem** (only one open).
- **F02** Payment-status text fits the card (shorten + wrap; "Marcado como pago · aguardando confirmação").
- **F03** Bigger names/values in "dividir entre": larger font + **2 columns** + bigger checkboxes + breathing room.
- **F04** **"Registrado por {name}"** on **every** surface (owner detail + `/g/` board), incl. guest-authored.
- **F05** Capture **rename** ("nota completa"→**Enviar nota (tudo)**; "selecionar itens"→**Enviar nota e
  escolher itens**; "pedir IA"→**Descrever por texto**) + **manual item add** inside an expense.

**Theme H — Images reworked (P0, Worker) — REVERSAL:**
- **F06** Remove image **E2E** → store **access-controlled plaintext** on R2 (delete the scramble path).
- **F07** **Fix photo persistence**: upload on attach, store the ref on the expense, survives reload.
- **F08** **Multiple photos** per expense (additive `imageRefs[]`).
- **F09** Images **visible + downloadable** for all incl. the `/g/` web guest; **revoke/TTL deletes** them.

**Theme I — Live group truth (P0, backend) — REVERSAL:**
- **F10** **Live board**: every viewer folds all snapshots → guest expenses appear **without** the owner opening the app.
- **F11** **Delete recalcs** total + balances **immediately**, everywhere (the 120€ bug).
- **F12** Owner = **moderator** (remove/correct/revoke/confirm), **not a sync gate**; honest copy.

**Theme J — Identity & connection (P0, backend):**
- **F13** **Profile name** ("como amigos te veem") replaces the device label in all P2P/connect/share; first-connect prompt.
- **F14** **Bilateral connect**: both sides see each other, with **correct names** (fix asymmetry).
- **F15** **Android QR zoom** restored (1×/2×/3×).

**Theme K — QR as URL (P0):**
- **F16** **Every app QR is a URL-first** deep link (connect QR, statement QR, …); safe for a default camera.

**Theme L — Real-time & notifications (P0/headline, Worker):**
- **F17** **Real-time peer delivery** (signal-DO peer-ping): a sent charge/debt/payment surfaces instantly on an open app.
- **F18** Inbound P2P → **notification center** (persists) + **native/OS notification** + toast.
- **F19** **Pending actions on the home** screen (outside settle-up).

**Theme M — Payments clarity (P1):**
- **F20** Payment **lifecycle states** (pending / marked-paid / awaiting-confirmation / confirmed / contestable / cancelled); **never penalize** marked-paid.
- **F21** **Confirmation authority**: the **receiver** confirms; the organizer may override but it is **logged**.
- **F22** **"Quem já pagou / quem falta"** status view.
- **F23** **Group movement history / timeline** (added / removed / paid / confirmed / joined / revoked).

**Theme N — Group composition (P1):**
- **F24** Add **existing / connected / trip** people at creation (recents / most-used / "ver mais"), linked by **real id** + notified.

**Theme O — Settle-up IA & concepts (P1/P2, deep council):**
- **F25** **Settle-up IA v2** (intent-led; sticky header; revises DEC-347).
- **F26** **Unify** "Pessoas" + "Amigos conectados" → one **"Pessoas"** with **status badges**.
- **F27** Explain **"Dividir Conta" vs "Divisão em Grupo"** at all entry points + help.

**Theme P — Cross-cutting (P0):**
- **F28** **Sticky header** (back + right action) on internal pages (settle-up, people, connections, group detail, QR screens).

---

## §6 — Root-cause map (symptom → exact code → fix direction → gate)

| # | Symptom (Julio) | Root cause (file → symbol) | Fix direction | Gate |
|---|---|---|---|---|
| F11 | Deleted expense; total stayed 120, balances stale even after reload | guest/board view renders the **owner-published snapshot**; a guest's local add/remove isn't re-folded live; `groupTotalCents` reads the stale event | Live read-fold (F10): recompute from `base ⊕ reduceGroupClaims(allResponses)` on every surface so remove/retract recalcs at once | G3 |
| F10/F12 | Guest expense "aguardando o organizador sincronizar" until owner opens app | only the **owner** pulls `/responses` + folds + re-publishes (`group-link.ts`/`reduceGroupClaims`) | Every viewer **pulls + folds locally** (the link key already decrypts all `/responses`); owner re-publish only consolidates moderation; drop the blocking copy | G3 |
| F06/F07 | Photo disappears on re-enter; "tira a criptografia" | `media-link.ts` `uploadEncryptedImage` only runs **on share** → a local group keeps the blob in memory, the event JSON persists **without** it → lost on reload | **Always upload on attach** (plaintext): compress → `PUT /img` JPEG → store `{r2Id,mime,w,h}` (no key) on the expense; delete the encrypt/decrypt funcs | G2 |
| F08 | Can't add a 2nd photo | single `imageRef` + single `GroupExpenseImageIntent` in `GroupExpenseEditor.tsx` | additive `imageRefs: ImageRef[]`; editor accepts N; gallery shows N | G2 |
| F09 | Web guest sees no photos | `handleImg` GET returns `application/octet-stream` (needs decrypt) | serve the **real content-type**; `/g/` board renders `<img src=/img/:id>`; revoke/TTL still delete | G2 |
| F13 | Shown as "Android Chrome" | every `*-orchestrators.ts` stamps `fromName: settings.deviceName`; `deviceName` auto-seeded by `suggestDeviceName()` (DEC-266) | **DEC-350 (locked): `resolveSelfName` = onboarding owner name `?? profileName ?? deviceName`**; use it in all share/connect/P2P; no new field by default (Settings "Seu nome" pre-filled from onboarding) | G4 |
| F14 | Only one side saw the other | the G6 `connect` reverse-link upsert fires inconsistently / before the name is known (Julio: only appeared after "cobrar pelo app") | ensure pairing **always** seals the `connect` envelope with the **resolved name (onboarding) + pubkey** and the peer upserts on drain; verify both `peerLink`s + names; dedupe | G4 |
| F15 | Android lost 1×/2×/3× | `QrScanner.tsx` `computeZoomLevels` + `zoomLevels.length > 1` gate; `getCapabilities().zoom` not yet populated / reports a degenerate range on Android's default stream | re-read capabilities after `loadedmetadata`/track-settle; offer a continuous slider when presets don't qualify; request zoom in `getUserMedia` advanced on Android | G4 |
| F16 | QR shows junk in a default camera | identity/statement QRs encode **raw payload text**, not a URL | route every QR through a **URL builder** (existing deep-link/web routes); the scanned URL opens the app/web to the right action; an in-app-only scan shows "abra no app e escaneie de novo" | G5 |
| F17 | Charge only appeared after reload | send queues a sealed envelope to the mailbox; drain is on-open/focus only (peer-ping was deferred V2) | on send, **ping** the recipient's `SHARE_SIGNAL`/`/rooms` room; an open app subscribed to its own room drains immediately | G6 |
| F18/F19 | Notification not in center / home | inbound P2P only becomes a toast + the `/shared` inbox; `domain/insights/notifications.ts` + `NotificationsPage` aren't fed; no home card | route `getInboundP2pItems()` into the notification center (persist) + `utils/native/notifications.ts` + a dashboard "pending actions" card | G6 |
| F01 | Pagamentos + Quem-paga both open | `GroupSplitDetailPage.tsx` independent `showBalances`/`showTransfers` booleans | one `openPanel: 'none'|'balances'|'transfers'` state (mutually exclusive) | G1 |
| F02 | Status text overflows the card | the "marcado como pago…" string is long, no wrap/size control on the badge | shorter `t()` copy + `break-words`/smaller class | G1 |
| F03 | Names tiny in "dividir entre" | `GroupExpenseEditor.tsx` rows `text-sm`/`text-xs`, single column, small checkbox | bump font, 2-column grid, larger tap-target checkbox | G1 |
| F04 | "registrado por" missing for guest expenses | row renders registrant unevenly; guest board omits it | render `createdByParticipantId ?? authoredBy name` on **all** rows + the board | G1 |
| F05 | Capture mode names confusing; no manual items | `scan_full`/`scan_items`/`ai_ask` labels; `items` only from a scan | rename the i18n keys; add an "adicionar item" button feeding the same `items` list | G1 |
| F20/F21/F22 | Marked-paid penalized; organizer confirmed for the receiver; no status view | payment status is a 3-value enum (`unpaid/marked/confirmed`); confirm allowed to owner; no states/log | extend the lifecycle; gate confirm to the receiver (owner-override logged); a "quem pagou/quem falta" panel | G7 |
| F23 | No history of who paid whom | events aren't recorded anywhere durable | a pure append-only `GroupActivity[]` derived from claims/payments/moderation + a timeline view | G7 |
| F24 | Creation can't add existing/connected people | `GroupSplitListPage.tsx` create form = manual names only | a compact people picker (recents/most-used/trip/connected, "ver mais"), linking the real participant/actor id + a notify | G8 |
| F25/F26/F27 | Settle-up confusing; Pessoas vs Conexões; concepts unclear | `SharedExpensesPage.tsx` stacks ~9 concerns; two people-lists; no concept copy | intent-led IA v2; one "Pessoas" w/ status; explainers — **deep council DEC-356/357/358** | G9 |
| F28 | Header/back/QR scroll away | internal pages use a non-sticky header row | a shared sticky header pattern (back + title + right action) on the listed pages | G1 |

> **Re-read the cited file before editing — symbols move between gates (this wave edits files the
> predecessor wave just rewrote).**

---

## §7 — Decisions + inline councils

> _Every point was run through the council (Julio's explicit ask). The genuine **forks/reversals** get a
> full inline council (neutral brief → blind voices → red team → chair → `DEC`); the clear **bugs** get a
> one-line **council verdict** under "Direct decisions". All inline, this session, 1 request, no
> subagents._

### Direct decisions (clear bug-fixes — council verdict in one line)
- **F01 Accordion exclusivity** — *Verdict (Advocate+Critic):* one-open-at-a-time is the standard
  accordion contract; zero downside. Single `openPanel` state. **Directive.**
- **F02 Status copy fits the card** — *Verdict:* a card that eats its margins is a defect; shorten +
  wrap. pt "Marcado como pago · aguardando confirmação". **Directive.**
- **F03 Bigger names + 2 columns + bigger checkbox** — *Verdict (Advocate):* legibility on a phone with
  many names is core; 2-col + larger type + larger tap target. Keep Σ-shares math intact. **Directive.**
- **F04 "Registrado por" everywhere** — *Verdict:* payer ≠ registrant is already modelled
  (`createdByParticipantId`/`authoredByActorId`); just render it on all surfaces. **Directive.**
- **F15 Android QR zoom** — *Verdict (Architect):* a regression; re-derive capabilities post-settle +
  relax the `length>1` gate. **Directive** (re-investigate the device timing in-gate).
- **F28 Sticky headers** — *Verdict (Advocate):* back + primary action must always be reachable; a
  shared sticky header. **Directive.**

### Council C1 → DEC-348 — Image storage: REVERSE E2E → access-controlled plaintext on R2
**Brief.** Last wave shipped client-side **E2E** for shared images (DEC-342/343): compress → AES-GCM →
upload octet-stream; the key rode the E2E payload. Field result: **photos vanish on reload** (the
"local-until-shared" lifecycle never persisted the blob) and Julio judges the crypto **unnecessary
complexity** for receipts, directing: *"tira a criptografia, salva no servidor normal, todo mundo vê e
baixa, inclusive pelo link."* The Worker `/img` route is content-agnostic (stores bytes + TTL). Bias to
resist: "we already built E2E, sunk-cost it." Options: **(a)** plaintext on R2 behind an unguessable id +
TTL + delete-on-revoke; **(b)** keep E2E and only fix the persistence bug; **(c)** plaintext but gated by
a server-checked share token.
**Architect (prior: least code, robustness).** (a) is *less* code (delete two functions, drop a key
field) and **fixes the persistence bug for free** (upload happens on attach, ref persists on the
expense). (b) keeps the bug-prone lifecycle and the in-browser decrypt for `/g/` guests. (c) adds Worker
auth state we don't have (anonymous Worker). Rec: **(a)**. Confidence: High. *Others miss:* serving the
real content-type lets a web guest just `<img src>`/long-press-download — exactly the ask.
**Critic (prior: privacy/abuse).** The cost of (a) is real: a receipt has names/totals/places; plaintext
on R2 means *anyone with the URL* sees it (no key needed). Mitigations: **unguessable 128-bit id**, a
**short TTL**, **delete-on-revoke**, **no listing**, and **never** put the URL anywhere but the (still
E2E) share/mailbox payload. DEC-207 (Worker can't read **messages/debts/names**) **must stay** — only
images are exempted. Rec: (a) **with the id/TTL/revoke guards + DEC-207 carve-out explicit**. Confidence:
Med-High. *Others miss:* document this as a *scoped* privacy downgrade so it isn't copied to debts/names.
**Strategist (prior: positioning).** "Server sees nothing" was a differentiator. But a broken photo is a
worse story than "photos are private-by-obscurity + TTL." Most competitors (Splitwise) store receipts
plaintext anyway. Rec: (a); keep the E2E story for the *ledger* (where it's cheap and true). Confidence:
Med.
**Red team (kill a).** A leaked link = a leaked receipt, forever-ish. Counter: the link only exists
inside the E2E payload (not guessable, not indexed), TTL caps exposure, revoke deletes; and the user
**explicitly chose** this trade after the E2E version failed in the field. Acceptable for receipts;
**not** extended to any non-image content.
**Chair synthesis.** **(a) wins** (robustness + the explicit directive dominate; the privacy delta is
bounded and scoped). **DEC-348:** shared group/bill **images** are **plaintext on R2**, keyed by an
**unguessable random id**, with **TTL + delete-on-revoke + delete-on-remove**; `ImageRef` drops `key`;
**always upload on attach** (fixes persistence); the Worker serves the **real content-type**. **DEC-207
stays** for messages/debts/names/statements (ciphertext-only) — images are the **only** carve-out. Delete
`uploadEncryptedImage`/`fetchDecryptedImageUrl` and the per-image-key plumbing. **What flips it:** if a
leaked-receipt incident occurs, re-enable E2E **just** for images (the route already accepts opaque
bytes) — but fix persistence by uploading on attach regardless.

### Council C2 → DEC-349 — Live group board (shared read-fold); owner = moderator, not a sync gate
**Brief.** DEC-340 made the owner the **reducer**: a guest's authored expense stays **pending until the
owner opens the app**, pulls `/responses`, folds, and re-publishes. Field result: a guest sees "aguardando
sincronizar" indefinitely, and a **delete doesn't recalc**. Julio: *"a despesa do convidado tem que
aparecer pra todos na hora; o dono modera (excluir/corrigir), mas não pode ser um portão."* Key fact:
the `/g/` link's AES key (in the URL `#fragment`) **already decrypts every `/responses` batch**, and
**`reduceGroupClaims` is pure** — so any viewer can fold locally. Options: **(a) shared read-fold** —
every viewer computes `base ⊕ reduceGroupClaims(all responses)` on read (owner re-publish only
consolidates moderation); **(b) keep owner-only fold but poll faster**; **(c) multi-writer/CRDT**.
**Architect.** (a) is **near-zero new code**: reuse the pure reducer on the read path for all viewers;
guest contributions and deletes (retract from snapshot) recalc the moment the response lands. (b) doesn't
fix the offline-owner gate. (c) is a new consistency model on money truth — banned. Rec: **(a)**.
Confidence: High. *Others miss:* the owner's **moderation** (tombstones `hiddenExpenseIds`,
confirmations) lives in the **base** event, re-published owner-paced — so contributions are live,
moderation is owner-authoritative; both invariants hold.
**Advocate.** Users expect "I added it → everyone sees it." (a) delivers within a refresh/ping. The honest
nuance ("aguardando moderação do dono" only when relevant) replaces the false "aguardando sincronizar."
Rec: (a) + a live "atualizado agora" beat. Confidence: High. *Others miss:* the author must see their own
item instantly (optimistic local echo, already there).
**Critic.** (a)'s risks: two viewers fold slightly different sets until both pull (eventual consistency —
acceptable, self-heals on next pull/ping); a malicious guest could spam authored expenses → the owner's
tombstone + the existing per-actor snapshot cap bound it; the owner's **delete must stick** even on a
viewer that hasn't pulled the new base → the tombstone travels in the base event, and `removeExpense`
already records it. Rec: (a) with the existing tombstone discipline + the G6 ping to converge fast.
Confidence: Med-High. *Others miss:* the **money authority stays the owner** — viewers *display* the
folded truth, but only the owner's published base + confirmations are canonical for settlement.
**Red team (kill a).** "Eventual consistency on money will confuse." Counter: the *display* converges in
seconds (pull + G6 ping); the *canonical* total for settling is still the owner's published base — we
never settle off an un-consolidated view. Honest copy makes the live-vs-confirmed distinction explicit.
**Chair synthesis.** **(a) wins** (reuse + the explicit directive dominate). **DEC-349 (amends DEC-340):**
every viewer folds all `/responses` locally with the existing pure `reduceGroupClaims` → **contributions
& deletes are live for everyone without the owner opening the app**; the **owner stays the money authority
+ moderator** (tombstone/confirm/remove in the re-published base); drop the "aguardando o organizador"
blocking copy; keep stable ids + idempotent fold + tombstones from DEC-340. **What flips it:** if field
use shows viewers diverging too long, add the G6 peer-ping to the board (already planned) or a short
visible poll while the board is open.

### Council C3 → DEC-350 — Profile name (not the device label) everywhere
**Brief.** All share/connect/P2P paths stamp `fromName: settings.deviceName`, auto-seeded "Android
Chrome" (DEC-266). Julio appeared to a peer as "Android Chrome" though he wanted "Júlio." There is **no
separate profile name** today. Options: **(a)** add `settings.profileName` (the user-facing identity),
default to the auto label, prompt to set it on first connect/share; **(b)** just relabel the Settings
"device name" field as "your name" and reuse `deviceName`; **(c)** derive the name from the active trip's
owner participant.
**Advocate.** Users think "this is **me**," not "this is my device." (a)/(b) both fix it; (a) is cleaner
semantically (device label ≠ how friends see you) and lets us **prompt at the moment it matters** (first
connect). (c) couples identity to a trip — wrong (identity is cross-trip). Rec: **(a)** (or (b) if we want
zero schema). Confidence: High. *Others miss:* the prompt must be **one tap, skippable**, pre-filled.
**Architect.** (b) is zero-schema (rename copy + a first-run prompt) but overloads one field for two jobs
(a technical device id for backup vs a social name). (a) is one additive non-indexed field, read with a
fallback `profileName ?? deviceName`. Rec: **(a)** — small, explicit, no migration. Confidence: High.
*Others miss:* swap the read at **every** `fromName`/`displayName` site (grep the 8 call-sites).
**Critic.** Risk: an existing user who never set a name still shows the auto label → the first-connect
prompt fixes the *social* surfaces; never block sharing on it (fallback to the label). Rec: (a) + prompt
+ fallback. Confidence: High.
**Chair synthesis.** **DEC-350 (LOCKED by Julio 2026-06-26):** **use the name the user already typed at
onboarding** (the active trip's **owner participant name**, `ownerName` from `OnboardingPage` /
`domain/onboarding`) as the `fromName`/`displayName` in **all** share/connect/P2P/claim contexts. **Do
NOT introduce a separate profile field by default** — Julio: *"no onboarding já colocamos o nome, então
pega o nome do onboarding."* **Resolution order:** `onboardingOwnerName (active trip owner) ?? profileName
(optional fallback) ?? deviceName (technical/backup label, never shown as a person)`. Only when the
onboarding name is genuinely unavailable (no trip yet) do we read/prompt an optional `profileName`; the
auto device label (DEC-266) is the last-resort technical fallback. **What flips it:** none — directive.
*Implementation note:* find the active-trip owner participant name; if a single device name must also be
editable, surface it as "Seu nome" prefilled from the onboarding name.

### Council C4 → DEC-351 — Every app QR is a URL
**Brief.** Some QRs encode raw payload text (identity, statement); scanned by a phone's **default
camera**, the user sees gibberish. Julio: *"todo QR do app tem que ser um link primeiro"* → opens the app
(or web), routes to the right action; if an in-app scanner is truly needed, the link lands on a screen
that says "escaneie de novo no app." Options: **(a)** wrap every QR payload in an existing **deep-link/web
URL** (`https://trippilot.pages.dev/<route>#<payload>`); the URL handler does the action; **(b)** keep raw
payloads but show an instruction card; **(c)** shorten payloads via a server shortener.
**Architect.** (a) reuses the existing route + `#fragment` pattern (already used for `/g/` and shares):
the payload moves into the URL fragment (client-only, never sent to the server). A default camera opens
the URL → the app (if installed) or the web route → it parses the fragment → acts, or instructs an
in-app re-scan only where a live camera is unavoidable. (c) adds a server round-trip + a storage liability
for connect data. Rec: **(a)**. Confidence: High. *Others miss:* connect needs *mutual* pubkeys — but the
URL can carry the initiator's identity so the opener can reverse-link (ties to F14/DEC-349's connect
path).
**Critic.** Risk: a fragment in a URL can be **shoulder-surfed** / logged in history. Counter: it's no
worse than today's raw QR (same secret on screen), the connect data is a pubkey + name (not a secret),
and statement links already work this way with a TTL. Rec: (a). Confidence: High. *Others miss:* keep the
QR **payload small** so it stays scannable (URL + compact fragment).
**Chair synthesis.** **DEC-351:** a single **`buildQrUrl(kind, payload)`** helper produces a real
`https://…/<route>#<payload>` for **every** QR the app renders (connect, statement, group invite already
is one); the matching route parses the fragment and performs the action, or, when a live in-app scan is
unavoidable, shows "abra no app e escaneie aqui." Default-camera scans never show raw text again. **What
flips it:** none — directive.

### Council C5 → DEC-352 — Real-time delivery (signal-DO peer-ping) + notification surfacing
**Brief.** A charge sent via the app only appeared after the peer **reloaded** (drain-on-open/focus; the
peer-ping was deferred to V2 in DEC-344). Julio now requires it **real-time**, **persisted in the
notification center**, and surfaced **on the home screen** (not only inside settle-up). We have a working
**signal DO** (`SHARE_SIGNAL` + `/rooms/<id>/ws`) that already relays "something changed" pings, a
**notification center** (`NotificationsPage` + `domain/insights/notifications.ts`), and **native
notification** capability (`utils/native/notifications.ts`). Options: **(a)** reuse the signal DO: on
send, ping the recipient's room → an open app drains instantly; persist inbound in the center; add a home
"pending actions" card; **(b)** short polling while the app is open; **(c)** native push (APNs/FCM) —
needs accounts.
**Architect.** (a) reuses all existing infra (DO + center + native-notif); the ping carries no payload
(stays E2E in the mailbox) — the app just "drains now." (b) is a battery/latency compromise; (c) is out
(no accounts). Rec: **(a)** with (b) as a low-frequency fallback while a shared surface is open.
Confidence: High. *Others miss:* "real-time" is bounded to **app reachable** — a closed PWA still needs
the next open; that's the honest ceiling without push, and matches DEC-344's "live = on-open/ping."
**Advocate.** The felt experience is "I cobrar, it pops on their phone." (a) delivers that for an open
app; the **notification center + home card** make it durable so a missed toast isn't lost (Julio's exact
complaint). Rec: (a). Confidence: High. *Others miss:* fire a **native OS notification** too (works even
when the PWA tab is backgrounded but alive), not just an in-app toast.
**Critic.** Risk: ping storms / reconnect loops on the DO; a peer offline never ger the ping (gets it on
next open — honest). Mitigations: debounce pings, reuse the share-signal reconnect/backoff, idempotent
inbox (already keyed by `debtId`/`paymentId`). Rec: (a) + debounce + honest "offline" state. Confidence:
Med-High.
**Red team (kill a).** "Without push it's not really real-time." True for a closed app — but that's a
platform limit (no accounts/APNs in V1), and (a) is the realistic ceiling; the persisted center + home
card + native notif close the "I missed it" gap. Accept.
**Chair synthesis.** **DEC-352 (promotes DEC-344's V2 peer-ping into scope):** on send, **ping the
recipient's signal-DO room**; an open app subscribed to its own room **drains immediately**; route
inbound P2P (`getInboundP2pItems`) into the **notification center (persisted)** + a **native OS
notification** + a toast + a **home "pending actions" card** with one-tap accept/confirm. "Real-time =
instant while the app is reachable" (no APNs). **What flips it:** if users need delivery to a fully-closed
app, that requires push infra (a future, accounts-bearing wave).

### Council C6 → DEC-353 — Payment lifecycle states + confirmation authority (don't penalize the payer)
**Brief.** Today a participant's payment is a 3-value enum (`unpaid`/`marked`/`confirmed`); the
**organizer** could confirm a payment made to **Débora**; and someone who "marked paid" looks unsettled
if the receiver never confirms. Julio: the **receiver** should confirm; the organizer may intervene **but
it's logged**; and **marking paid must carry weight** (don't penalize the payer for the receiver's
inaction). Options for **who confirms**: (1) receiver only; (2) receiver **or** organizer; (3) organizer
only; (4) anyone, logged. For **states**: extend to pending / marked-paid / awaiting-confirmation /
confirmed / contestable / cancelled.
**Advocate.** The person who **received** the money is the truth-holder; they confirm. The organizer is a
safety valve (the receiver may never open the app) but every override must be **visible** ("Júlio
confirmou manualmente o pagamento de Ingrid → Débora"). The payer who marked paid should read **"marcado
— aguardando confirmação," not "deve"** (no red). Rec: **(2) receiver-or-organizer, organizer-override
logged**; full state set. Confidence: High. *Others miss:* a "contestar" path for the receiver to reject
a false "paguei."
**Critic.** Risk: organizer-override without a log = "who said I paid?" disputes → mandatory activity-log
entry (DEC-354). Risk: a payer marks paid falsely → the obligation stays **awaiting-confirmation** (not
closed) so the receiver isn't harmed; only the receiver's confirm (or a logged override) closes it. Rec:
(2) + log + the awaiting state never auto-closes. Confidence: High.
**Architect.** This extends the existing `paymentStatus` enum + the settlement engine — additive. The
"don't penalize" is a **display** rule (marked-paid renders neutral, not debt-red) + a **state** rule
(awaiting ≠ owed). Rec: additive enum + display tokens. Confidence: High. *Others miss:* keep settlement
math unchanged — states are metadata over the same debt engine.
**Chair synthesis.** **DEC-353:** payment lifecycle = **pending → marked-paid → awaiting-confirmation →
confirmed** (+ **contestable**, **cancelled**); **the receiver confirms**; the **organizer may override,
always written to the activity log** (DEC-354); **marked-paid renders neutral** (never red) and the payer
is never shown as delinquent while awaiting; only a receiver-confirm (or logged override) closes the
obligation; a receiver can **contestar**. Settlement arithmetic unchanged. **What flips it:** none — this
is the user's explicit fairness model.

### Council C7 → DEC-354 — Group activity log / movement history
**Brief.** There is no durable "what happened" trail; Julio wants to see who added/removed an expense,
who marked/confirmed a payment, who joined via link, who revoked. Options: **(a)** a pure append-only
`GroupActivity[]` derived + stored on the event; **(b)** reconstruct a timeline on-the-fly from claims +
payments (no storage); **(c)** full event-sourcing.
**Architect (prior: simplicity).** (b) is cheapest (derive from the snapshots + payment states we
already persist) but loses ordering/authorship for moderation actions. (a) is a small additive
append-only array (id, ts, actorId, name, kind, summary) written at each mutation — durable + portable in
the share/backup. (c) is overkill. Rec: **(a)** seeded by (b)'s derivation for past events. Confidence:
High. *Others miss:* the log is **display-only** — never a money source.
**Advocate.** A visible timeline is what makes a shared ledger *trustworthy* ("eu vejo que a Ingrid pagou
a Débora"). Rec: (a), human strings via `t()`. Confidence: High.
**Critic.** Risk: the log leaks names to the Worker? No — it lives **inside** the E2E share payload /
local event, never as Worker metadata. Risk: unbounded growth → cap/trim oldest with a "ver tudo." Rec:
(a) + cap. Confidence: Med-High.
**Chair synthesis.** **DEC-354:** an additive, append-only **`GroupActivity[]`** on the event (pure
builder; entries for add/remove/mark/confirm/override/join/revoke), rendered as a **timeline** on the
group detail and surfaced in the settle-up history; human copy via `t()`; lives inside the E2E
payload/local event (never Worker-readable); capped with "ver tudo." **What flips it:** none.

### Council C8 → DEC-355 — Add existing/connected/trip people at group creation
**Brief.** Creation only takes **manual** names; Julio wants to also pick **people who already exist**
(trip participants, connected friends, recently-used) **without a 40-name wall**, and have the pick
**link the real id** + **notify** the person. Options for the picker: **(a)** recents/most-used first +
"da viagem" + "conectados" + "ver mais"; **(b)** a full searchable list; **(c)** only connected friends.
**Advocate.** (a) matches the ask exactly (no giant list; the few likely people up front, search behind
"ver mais"). Linking the **real id** is what makes the group appear on *their* app + enables live debt.
Rec: **(a)**. Confidence: High. *Others miss:* a manual name and a linked person must coexist in the same
add row (don't split the flow).
**Architect.** Reuse the existing participant/connection sources (trip participants, `peerLinks`,
last-used) + the F24 link to actorId; the notify rides the G6 real-time path. Rec: (a), data-driven
ranking (most-used). Confidence: Med-High. *Others miss:* dedupe (same person via trip + connection).
**Critic.** Risk: notifying someone who didn't consent to a group → it's an **invite-style** notification
(accept-first, like DEC-345), not an auto-join. Rec: (a) + accept-first link. Confidence: High.
**Chair synthesis.** **DEC-355:** the create flow offers, besides manual entry, a **compact picker**
(recents/most-used → "da viagem" → "conectados" → "ver mais" search), linking the **real
participant/actor id**; adding a linked person sends an **accept-first** invite (rides DEC-352 real-time +
DEC-345 accept). No 40-name wall. **What flips it:** none — directive shape; ranking heuristics tunable.

### Council C9 → DEC-356 / DEC-357 — Settle-up "Acerto de contas" IA v2 + Pessoas/Amigos unification (DEEP)
**Brief.** `/shared` stacks ~9 concerns (sobre-mim, Meu QR, P2P inbox, summary a-receber/a-pagar,
group-settle, people, **connections**, awaiting, shared expenses, pending debts, charge/pay sheets) and
shows **two** people-lists ("Pessoas" and "Amigos conectados"). Julio: *"confuso — o que cada área faz,
por que preciso ver cada uma; qual a diferença entre pessoa e amigo conectado."* The guiding question:
**"quando o usuário entra aqui, o que ele veio resolver?"** Answers: quem me deve / quem eu devo / cobrar
alguém / registrar que paguei / confirmar que recebi / conectar alguém / ver um grupo / mandar extrato.
This council runs as a **review** (multi-angle) per Julio's "seção por seção," then a **debate** on the
people model.

**Decision Brief (neutral).** Re-architect `/shared` around the **8 intents** above; decide whether
"Pessoas" and "Amigos conectados" stay separate, merge, or become **one list with status**. Bias to
resist: "show everything so nothing is missed" — that *is* the current failure.

**Lens 1 — Information Architecture / Hierarchy.** The page must answer the **top intent in the first
viewport**: a **balance summary** ("você recebe X · você deve Y") + the **action that resolves it**.
Everything else (connections, QR, groups, statement, history) becomes **secondary** — reachable, not
stacked. Proposed structure: **(1) sticky header**: back · "Acerto de contas" · fixed **Meu QR**; **(2)
sobre-mim** (your name + status, anchors identity); **(3) the balance** (a-receber / a-pagar, the body's
hero); **(4) "Resolver"** — pending debts/charges with one-tap settle/confirm + the **accept-first inbox**
folded in here (it *is* a pending action); **(5) Pessoas** (the unified list, below the fold); **(6)
secondary drawer**: "Conectar / Meu QR / Backup de aparelho", "Grupos", "Histórico", "Enviar extrato."
*Rec:* intent-led, one hero, the rest progressive. Confidence: High. *Others miss:* the **P2P inbox is
not a separate section** — it's the top of "Resolver."

**Lens 2 — Mental model (Pessoas vs Amigos conectados).** Two lists for "people" is the core confusion.
A person has **attributes**, not a category: *no app* / *convidado por link* / *conectado* / *cobrança
pendente* / *sincronizado*. **One "Pessoas" list with a status badge per person** removes the dichotomy
while keeping the truth visible. "Conectado" becomes a **badge + capabilities** (can charge live), not a
separate list. *Rec:* **unify into one "Pessoas" with status** (DEC-357). Confidence: High. *Others miss:*
a connected person who is also a trip participant must appear **once** (dedupe by actorId/name).

**Lens 3 — Emotion / trust.** The screen carries money tension; it should feel **calm + honest**: a
single clear "você está em dia" / "falta resolver X" headline; **never** a false red (DEC-353); a
**history** link so nothing feels hidden (DEC-354). *Rec:* lead with reassurance + one next action.
Confidence: Med-High.

**Lens 4 — First-click / intuition.** A first-timer should, in one glance, know **what to tap**: the hero
balance + a primary "Resolver/Cobrar" button; "Conectar amigo" clearly **separated** from "Backup de
aparelho" (today's confusion). *Rec:* one primary action; connect ≠ backup, labelled. Confidence: High.

**Red team (kill the redesign).** "A big re-layout risks regressing the working debt/settle/charge flows
just shipped (G6/G7)." Counter: it's a **re-composition of existing components** (no data/logic change) +
the F26 list merge; gate it behind tests + the smoke matrix; ship the people-merge (DEC-357) and the
hierarchy (DEC-356) as **separate milestones** so each is verifiable. The arithmetic and the P2P
orchestrators are untouched.

**Chair synthesis.** **DEC-356 (revises DEC-347):** re-architect `/shared` **intent-first** — sticky
header (back · title · fixed Meu QR) → sobre-mim → **the balance hero** → **"Resolver"** (pending
debts/charges + the accept-first inbox, one-tap) → unified **Pessoas** → a **secondary drawer** (conectar
/ backup / grupos / histórico / extrato). **DEC-357:** **one "Pessoas" list** with per-person **status
badges** (sem app / convidado / conectado / cobrança pendente / sincronizado), deduped by actorId/name;
"conectado" is a capability badge, not a separate list. Both ship as distinct, tested milestones; zero
ledger/orchestrator logic change. **Weightiest lens:** IA/hierarchy (Lens 1) — the page must resolve the
top intent first; the people-merge (Lens 2) is the highest-leverage single fix. **What flips it:** if user
testing shows people still want an explicit "connected friends" view, keep the unified list but add a
**filter chip** "só conectados" (still one list). **Conditions:** land **with** F28 sticky header and
**after** F13/F14 (so names/connections are correct first).

> _Note: Julio asked for live **Playwright screenshots** of the current `/shared` fed to the council. The
> council above reasoned from the **current code IA** (authoritative, written days ago). Capturing live
> screenshots is offered as an optional **G9 m0** (spin the dev server + browser MCP, shoot the 4 states:
> empty / debts / connected / inbox) to visually validate the redesign before coding — recommended, not
> required for the decision._

### Council C10 → DEC-358 — Explain "Dividir Conta" vs "Divisão em Grupo"
**Brief.** The two split modes are confused. **Dividir Conta** = one bill with **items**, each person
picks what they consumed (restaurant/bar). **Divisão em Grupo** = many people add **many expenses** to a
shared pot, the app splits across everyone (trip/churrasco/festa). Julio wants this explained at **every
entry** + help. Options: **(a)** a one-line explainer under each door + a help-center section + a tiny
"?" tooltip; **(b)** a one-time onboarding modal; **(c)** auto-suggest the mode from context.
**Advocate.** (a) is always-available, low-friction, and answers "which do I use?" exactly when the user
chooses. (b) is forgotten after once; (c) risks guessing wrong. Rec: **(a)**. Confidence: High. *Others
miss:* the copy must be **concrete** ("conta de restaurante" vs "viagem/churrasco"), not abstract.
**Architect.** Pure i18n + a shared `<ConceptHint>` reused at the FAB "Dividir", `/split`, `/groups`,
discovery, and help. Rec: (a), one component, many mounts. Confidence: High.
**Chair synthesis.** **DEC-358:** a reusable **concept explainer** ("Dividir Conta = por itens de uma
conta · Divisão em Grupo = vários gastos de várias pessoas") mounted at **all** entry points (FAB door,
`/split`, `/groups`, discovery hub) + a help-center section + a "?" tooltip; concrete examples; pt/en/es.
**What flips it:** none — directive.

---

## §8 — Test strategy (test WITH the change)

- **Domain-pure first (>90%):**
  - **Live read-fold (G3):** a pure `foldEventForViewer(base, responses)` (reuse `reduceGroupClaims`) —
    two-guest convergence, **delete/retract recalculates total + balances**, idempotent, owner-tombstone
    sticks. *(This is the F11 regression test — the 120€ bug becomes a unit test.)*
  - **Images (G2):** `ImageRef` without `key`; `imageRefs[]` add/remove; cap still enforced; a
    round-trip that no longer encrypts (the bytes out == bytes in).
  - **Identity (G4):** `resolveSelfName` = onboarding owner name `?? profileName ?? deviceName` at every
    `fromName` site; a connect envelope carries the resolved name; reverse-link upsert is symmetric.
  - **Payments (G7):** the state machine (pending→marked→awaiting→confirmed, contestable, cancelled);
    marked-paid never renders as owed; receiver-confirm vs organizer-override (logged); **settlement math
    identical to baseline**.
  - **Activity log (G7):** the pure builder emits the right entries; capped; no money derived from it.
  - **QR (G5):** `buildQrUrl` round-trips (URL + fragment parse → same payload).
- **Reuse & extend** the predecessor's group-split, claim-response, p2p-orchestrators, mailbox-envelope,
  and `qr-scanner-zoom` suites — **don't duplicate**.
- **Critical UI via E2E (>70%):** guest-adds-expense-appears-live (no owner); delete-recalcs; photo
  persists across reload; settle-up IA v2 first-viewport; a charge surfaces in the center + home.
- **Ledger-math invariance:** assert every total/balance/transfer equals baseline for the same inputs
  (the math is untouched — only timing/display/storage change).
- **"Full suite green between gates"** = 0 failures **beyond the documented G0 baseline** (record the
  known WebCrypto `split-live-loop` cases that pass only on Node 22/CI).

---

## §9 — Per-milestone protocol

**Before every milestone commit (5-point):** (1) list satisfied AC ids; (2) name 3 earlier ACs at
regression risk + verify (**always** include **ledger-math invariance** + **never-block-expense/
contribution** + **Worker-ciphertext-for-messages/debts/names** [images are the only carve-out, DEC-348]);
(3) run tests — no new failures; (4) flag any file touched outside scope; (5) update `src/dev-log.md`.
**Gate boundary:** re-read §3 + the next gate scope + dev-log Current State; print the ANCHOR + CURRENT
STATE line; **if the next gate's §16 lock is still open, STOP and hand off** (don't code an unlocked
reversal). **Every 3 milestones:** light refresh (critical rules + dev-log).

---

## §10 — THE BUILD — gates G0→G9

### G0 — Setup & baseline (always) → no version change
- **Why:** a regression reference + a seeded log.
- **Do:** `npm install`; `npm run test` + `npm run build` + `npx tsc --noEmit` (+ E2E if env allows);
  **record baseline counts** (incl. known `split-live-loop`); seed `src/dev-log.md` (Current State + this
  wave's F01–F28 table); add **DEC-348…358** as `PROPOSED`; confirm the Pages pipeline + that **G2 & G6**
  need `wrangler deploy`. **All §16 locks are IN (L-IMG/L-LIVE/L-RT/L-IA) — execute G1→G9 in order.**
- **AC:** green baseline documented; dev-log seeded; DECs recorded.

### G1 — Group-split UX quick wins (P0, no/low backend) → `1.3.1-rc`  *(no lock needed — start now)*
- **Items:** F01, F02, F03, F04, F05, F28. **Root cause:** §6 rows F01–F05/F28.
- **Change:** one `openPanel` state (accordion exclusivity); shorten+wrap the payment-status copy; bigger
  names + 2-column "dividir entre" + bigger checkbox; render "registrado por {name}" on all rows + `/g/`
  board; rename the 3 capture modes + add a manual "adicionar item"; a shared **sticky header** on the
  internal pages (settle-up, people, connections, group detail, QR screens).
- **AC:** opening one panel closes the other; the status badge never overflows; names are clearly larger
  in 2 columns; every expense shows its registrant; capture labels read "Enviar nota (tudo) / Enviar nota
  e escolher itens / Descrever por texto" + items can be added by hand; the back + right action stay
  visible while scrolling. **Math unchanged.**
- **Tests:** accordion-exclusivity + manual-item domain/UI; i18n keys pt/en/es; sticky-header E2E.
- **Deploy:** per item → gate end suite+build+tsc+smoke → bump `1.3.1-rc` → Pages → DEC-358 (explainers
  copy if landed here) / the F05 capture-rename note APPROVED → dev-log.

### G2 — Images: plaintext on R2 + persistence + multi-photo (P0, Worker) → `1.3.2-rc`  *(✅ L-IMG LOCKED)*
- **Items:** F06, F07, F08, F09. **Root cause:** §6 rows F06–F09. **REVERSAL of DEC-342/343.**
- **Change:** **(m1)** `data/sync/media-link.ts` — delete `uploadEncryptedImage`/`fetchDecryptedImageUrl`;
  add `uploadImage` (compress → `PUT /img/:id` as `image/jpeg`) + `imageUrl(ref)` (direct URL); `ImageRef`
  drops `key`. **(m2)** Worker `handleImg` — serve the **real content-type** (store it in
  `customMetadata`/httpMetadata on PUT, echo on GET) so a web guest can `<img src>`/download; keep TTL +
  cap + delete. **(m3)** `GroupExpenseEditor.tsx` — **upload on attach** (not on share) + support
  `imageRefs: ImageRef[]` (additive on `GroupExpense`/`groupClaimExpenseSchema`). **(m4)** galleries
  (group detail + `/g/` board + bill-split) render N images via direct URLs; **delete-on-remove +
  delete-on-revoke**. **(m5)** migrate reads: an old `imageRef` with a `key` still decrypts (back-compat
  shim) OR is treated as legacy — prefer a shim that reads either.
- **AC:** attaching a photo persists across reload and shows for **all** members + the web guest;
  multiple photos per expense; revoke/TTL/remove deletes the blob; the Worker stores plaintext images
  (only — messages/debts/names stay ciphertext). **No ledger change.**
- **Tests:** `ImageRef` (no key) + `imageRefs[]` add/remove + cap; Worker route smoke (PUT jpeg → GET
  jpeg); persist-across-reload E2E; web-guest-sees-photo E2E.
- **Deploy:** **`wrangler deploy`** + Pages → `1.3.2-rc` → DEC-348 APPROVED. Verify `/img` serves jpeg.

### G3 — Live group board + delete-recalc (P0, backend) → `1.3.3-rc`  *(✅ L-LIVE LOCKED)*
- **Items:** F10, F11, F12. **Root cause:** §6 rows F10–F12. **AMENDS DEC-340.**
- **Change:** **(m1)** a pure read-side `foldEventForViewer(base, responses)` (reuse `reduceGroupClaims`)
  + tests (the 120€ bug → a unit test). **(m2)** `GroupClaimPage.tsx` + the non-owner group detail
  **pull `/responses` + base + fold locally** (drain on open + focus + a light poll while visible / a G6
  ping later); the author's own add/remove recalcs instantly. **(m3)** delete recalcs total + balances on
  **every** surface; owner tombstone still authoritative. **(m4)** replace "aguardando o organizador
  sincronizar" with honest live/"aguardando moderação" copy; owner = moderator (remove/correct/revoke/
  confirm) **not** a sync gate.
- **AC:** a `/g/` guest's expense appears for everyone **without** the owner opening the app; deleting an
  expense immediately corrects the total + balances (incl. after reload); the owner can still remove/
  moderate and it sticks; copy is honest (no false "aguardando sincronizar"). **Canonical settlement
  still uses the owner-published base.**
- **Tests:** `foldEventForViewer` convergence + delete-recalc + tombstone-sticks (concrete cents);
  guest-add-appears-live E2E; delete-recalc E2E.
- **Deploy:** Pages → `1.3.3-rc` → DEC-349 APPROVED.

### G4 — Identity, bilateral connect, Android QR zoom (P0, backend) → `1.3.4-rc`  *(✅ DEC-350 LOCKED: onboarding name)*
- **Items:** F13, F14, F15. **Root cause:** §6 rows F13–F15.
- **Change:** **DEC-350 (Julio):** resolve the displayed name from the **onboarding owner name** first —
  add a single resolver `resolveSelfName(settings, activeTrip)` → `activeTripOwnerName ?? settings.profileName
  ?? settings.deviceName`. **Do NOT add a profile field by default**; only fall back to an optional
  `profileName` when there is no onboarding name (no trip yet). Swap **every** `fromName`/`displayName`
  site (grep the ~8 call-sites in `*-orchestrators.ts` + `share-link` + claim) to call `resolveSelfName`.
  Settings may surface "Seu nome" **pre-filled from the onboarding name** (editing writes `profileName`).
  Fix the **bilateral** connect: pairing always seals the `connect` envelope (resolved name + pubkey); the
  peer upserts on drain; verify both `peerLink`s + correct names; dedupe re-pairs. Restore Android QR zoom
  (re-derive capabilities post `loadedmetadata`/track-settle; relax the `length>1` gate; request zoom
  advanced on Android).
- **AC:** a peer sees **my onboarding name** (never "Android Chrome"); connecting A↔B makes **both** appear
  with correct names without a second action; the Android scanner shows 1×/2×/3× again.
- **Tests:** `resolveSelfName` precedence (owner → profileName → deviceName) at every site; connect-envelope
  carries the resolved name; symmetric reverse-link unit; `computeZoomLevels` device-timing test extended.
- **Deploy:** Pages → `1.3.4-rc` → DEC-350 APPROVED.

### G5 — QR as URL everywhere (P0) → `1.3.5-rc`  *(no lock — directive)*
- **Items:** F16. **Root cause:** §6 row F16.
- **Change:** a `buildQrUrl(kind, payload)` helper → `https://…/<route>#<payload>` for **every** QR
  (connect identity, statement/extrato, group invite already is); the matching routes parse the fragment
  and act (or, where a live in-app scan is unavoidable, land on "abra no app e escaneie aqui"); audit all
  `QrCodeDisplay` call-sites.
- **AC:** scanning any app QR with a **default phone camera** opens a working link (app or web), never raw
  text; the in-app scanner still works for the connect flow.
- **Tests:** `buildQrUrl` round-trip (URL→fragment→payload); a route-parse unit per kind.
- **Deploy:** Pages → `1.3.5-rc` → DEC-351 APPROVED.

### G6 — Real-time delivery + notifications (P0, headline, Worker) → `1.4.0-rc`  *(✅ L-RT LOCKED)*
- **Items:** F17, F18, F19. **Root cause:** §6 rows F17–F19. **Promotes DEC-344's V2 peer-ping.**
- **Change:** **(m1)** Worker — a P2P **peer-ping** reusing `SHARE_SIGNAL`/`/rooms/<actorId>/ws` (payload
  stays in the mailbox; the ping only says "drain now"); debounce. **(m2)** client — on send (charge/debt/
  payment/connect), ping the recipient's room; an open app subscribed to **its own** room drains
  immediately. **(m3)** route `getInboundP2pItems()` into the **notification center**
  (`domain/insights/notifications.ts` + `NotificationsPage`) — persisted, mark-read on action. **(m4)**
  fire a **native OS notification** (`utils/native/notifications.ts`) + toast on arrival. **(m5)** a home
  **"pending actions"** dashboard card (`dashboard-cards.ts`) with one-tap accept/confirm.
- **AC:** a charge sent to an **open** peer app pops **without a reload**; the inbound item is in the
  notification center (and survives a missed toast) + fires a native notification + shows on the home
  screen; a closed app still gets it on next open (honest). **No re-scan to sync.**
- **Tests:** ping debounce/idempotency; inbound→notification-center routing; home-card pending count;
  two-device deliver E2E stub.
- **Deploy:** **`wrangler deploy`** + Pages → **`1.4.0-rc`** (headline) → DEC-352 APPROVED.

### G7 — Payments clarity: states + authority + history (P1) → `1.4.1-rc`  *(no reversal — fairness model)*
- **Items:** F20, F21, F22, F23. **Root cause:** §6 rows F20–F23.
- **Change:** extend the payment lifecycle (pending→marked-paid→awaiting-confirmation→confirmed +
  contestable/cancelled); **receiver confirms** (organizer override **logged**); marked-paid renders
  **neutral** (never red); a **"quem pagou / quem falta"** status panel; a pure append-only
  **`GroupActivity[]`** + a **timeline** view (group detail + settle-up history). Settlement math
  unchanged.
- **AC:** marking paid never shows the payer as owing; only the receiver (or a logged organizer override)
  closes an obligation; a clear who-paid/who-owes view; a readable history of adds/removes/payments/
  confirmations/joins.
- **Tests:** the state machine + display-neutral marked-paid + receiver-vs-override (logged); activity
  builder; settlement invariance.
- **Deploy:** Pages → `1.4.1-rc` → DEC-353/354 APPROVED.

### G8 — Add existing/connected people at creation (P1) → `1.4.2-rc`  *(no lock — directive shape)*
- **Items:** F24. **Root cause:** §6 row F24.
- **Change:** a compact people picker in the create flow (recents/most-used → "da viagem" → "conectados"
  → "ver mais" search), linking the **real participant/actor id**, sending an **accept-first** invite
  (rides DEC-352/345); dedupe; manual + linked coexist.
- **AC:** creating a group lets me pick existing/connected/trip people **without** a giant list; a linked
  person's app shows the group (accept-first) and the link uses their real id.
- **Tests:** picker ranking/dedupe unit; create-with-linked-person E2E (accept-first).
- **Deploy:** Pages → `1.4.2-rc` → DEC-355 APPROVED.

### G9 — Settle-up IA v2 + unify Pessoas/Amigos + concept explainers (P1/P2, deep) → `1.4.3-rc`  *(✅ L-IA LOCKED)*
- **Items:** F25, F26, F27. **Root cause:** §6 row F25/F26/F27. **REVISES DEC-347.**
- **Visual council DONE (2026-06-26):** live Playwright screenshots captured at
  `brain/documents/2026-06-26-settle-shots/` (`shared-seg-00/01/02.png`, `shared-full.png`); inline
  4-lens council verdict folded into DEC-356/357. **The live screen stacks 12 flat near-equal sections and
  restates the same money 3–4× (hero / Pessoas / Dívidas / Gastos); device-backup contaminates the
  people/settle screen.** Build to the **4-zone intent IA** below (not a free re-stack).
- **Visual layout DONE — round 3 (2026-06-26):** 9 hi-fi HTML mockups rendered with Playwright
  (`variant-a..n*.png` in the settle-shots folder) + 3 inline visual councils. Convergence (DEC-357,
  layout addendum): **`variant-m-converged` = the DEFAULT screen** and **`variant-n-scale` = the scale
  mode for big accounts.** The locked layout grammar (do NOT re-invent at build):
  - **Saldo enxuto (strip), não hero gigante** — "No saldo, te devem €X · a pagar €Y" em 1 linha; o herói
    visual é o Resolver, não o saldo.
  - **Resolver agora = faixa ACIMA das abas** (transversal, nunca uma aba); cada linha mantém sua ação
    rotulada; quando >2 pendências, um **"+ ver todas as N pendências"**.
  - **Pessoas = linhas ricas de 2 linhas** (nome + badge na 1ª; `te cobrou/deve/em dia · contexto · quando`
    na 2ª); prévia de 3 + **"ver todas (N)"** com o número; **expandir-pessoa** abre extrato/ações inline
    (não nova tela); **"ver mais"** pagina contas grandes.
  - **Conectar = linha/cartão de ação** (Meu QR · Por QR · Adicionar) perto de Pessoas — **NUNCA uma aba**
    (aba = visão/substantivo; conectar = verbo). 3-abas (`variant-l`) foi **rejeitado** por misturar isso.
  - **Atividade:** no DEFAULT (M) é uma **prévia inline de 3 eventos + "Ver tudo (Histórico)"** (garante
    descoberta — a dor "onde vejo o que aconteceu/quem pagou quem"); no modo escala (N) vira o **segmento
    `Pessoas ⇄ Atividade`** (de `variant-i`) que só aparece quando a lista é longa. "Ver tudo" → a timeline
    completa (`variant-d`) como **Histórico** (DEC-354). Honra "linha do tempo não precisa ficar 100% à
    mostra" sem escondê-la atrás de aba no caso comum.
  - **What would flip M→N as the default:** se telemetria mostrar lista média grande + baixíssimo uso de
    "Ver tudo", promova o segmento (N) a padrão. Até lá, **M é a tela; N é o fallback de escala.**
- **Visual layout — round 3 refinements (2026-06-26, council C11) — `variant-o-refined` = ✅ LOCKED screen
  (Julio) + wireframes `wire-people-page` (DEC-359) / `wire-viagem-entry` (DEC-360):**
  - **Saldo = 2 números coloridos** (A receber verde / A pagar vermelho) + linha de net — **não** a faixa de
    1 linha (Julio: "quero mostrando quanto devo e quanto me devem, verde/vermelho").
  - **Rename:** "Por QR" → **"Ler QR"** (todas as linhas de conectar).
  - **DEC-359 — "ver todas as pessoas" abre uma PÁGINA Pessoas** (não modal): busca + linha de conectar no
    topo + seções por status (`Precisam de ação → Conectados → Convidados → Sem app`), paginadas; reusa o
    view-model unificado (DEC-357). No `/shared`, a zona Pessoas = **prévia de 3 linhas ricas + "ver todas (N)"**,
    e **conectar fica COM as pessoas** (linha enxuta logo abaixo da prévia), **nunca** cartão "Conectar" à parte.
  - **DEC-360 — Divisões em grupo: `/groups` continua a lista única** (não duplicar no `/shared`). Conserto de
    **descoberta**: FAB "Divisão em grupo" cai em **`/groups`** (lista c/ "+ Nova"), não em `?new=1`; **entrada
    de 1º nível no hub Viagem usando o GRID existente** (`TripHubPage` `structureItems`, `grid grid-cols-3` de
    tiles — Julio: "mesmo padrão da tela atual, que é um grid"): novo tile **"Divisões em grupo (N)"** → `/groups`
    + **renomear** o tile "Participantes" (que aponta pra `/shared`) pra **"Acerto de contas"**; `/shared` mantém só um **ponteiro-resumo**
    ("Ver divisões em grupo · N ativas" → `/groups`); opcional: card no dashboard quando há divisão ativa.
    **Todas as portas convergem em `/groups`.** Reuse-first: `GroupSplitListPage` já existe.
  - **Scope note p/ G9:** a **página Pessoas (DEC-359)** e a **entrada no Viagem + FAB→lista (DEC-360)** são
    milestones próprios (m-people, m-divisions-discovery); se faltar folga, a entrada no Viagem + FAB→lista é o
    mínimo P1 (descoberta), e a página Pessoas pode degradar pra um sheet com busca como fallback.
- **Change — `/shared` v2 = 4 zones under a STICKY header** (`←` · "Acerto de contas" · fixed Meu QR):
  - **(z1) Situação (hero):** A receber / A pagar / net — the **only** big money statement. **Kill the
    duplicate "como querem te pagar" prompt here** → move to sobre-mim/drawer. Dedupe money representation.
  - **(z2) Resolver (action zone, prime slot under hero):** aguardando-aceite + dívidas pendentes +
    cobranças as one to-do list, **each row KEEPS its own labelled action** (Aceitar / Lembrar / Liquidar /
    Confirmar) — grouped, **never merged into one ambiguous tap** (four distinct authority models).
  - **(z3) Pessoas (unified, DEC-357):** ONE list, ONE badge vocabulary `{sem app · convidado · conectado ·
    recebe X · deve Y · em dia}`, deduped by actorId/name; tap → person detail (extrato / cobrar / conectar
    / histórico). The separate device-"CONEXÕES" people-feel is **gone** (connection = a per-person badge).
  - **(z4) Mais (collapsed but on-screen, section-headed):** Grupos · **Gastos compartilhados (one tap,
    collapsed — NOT removed; keep statuses; explainer → tooltip)** · Histórico/Liquidações + movimentações
    (DEC-354) · Enviar extrato · Conectar novo (Meu QR). **Backup entre aparelhos MOVES OUT** → Settings /
    a clearly-labelled "Seus aparelhos" (Julio: conectar amigo ≠ backup).
  - **(m3)** mount the **concept explainer** (Dividir Conta vs Divisão em Grupo) at all entry points + help.
  - **No ledger/orchestrator logic change** — pure re-composition of existing components.
- **AC:** top intent (your balance + the action to resolve it) in the **first viewport**; sticky header w/
  fixed Meu QR; net money stated **once** big (no 3–4× duplication); one "Pessoas" list w/ one badge set (no
  Pessoas-vs-Amigos confusion); **backup is NOT on this screen**; Gastos + Histórico reachable in **one tap**;
  every Resolver row has a distinct labelled action; the two split modes explained at every door + help.
- **Tests:** unified-people view model + dedupe unit; `/shared` first-viewport + sticky-header E2E;
  data-invariance (totals/badges == baseline); explainer i18n pt/en/es; **P2P/settle flows from G6/G7 pass
  unchanged**.
- **Fallback (Skeptic minority, if the 2240-line re-compose destabilizes):** ship the low-risk subset first
  (sticky header + remove backup + unify badges + tooltips), defer the zone re-order — record in dev-log.
- **Deploy:** Pages → `1.4.3-rc` → DEC-356/357/358 APPROVED. **Wave DoD review.**

> **G_last (P2, optional):** anything trimmed for slack (e.g. organizer-override richer audit, "auto-aceitar
> de {nome}" toggle) — record deferred in dev-log.

---

## §11 — Terminal safety (WSL)

`git --no-pager …` for log/diff/show/status. Commit via `G=/usr/bin/git; "$G" commit -m "…"` (the harness
injects `--trailer`, rejected by sandbox git 2.25.1). HEREDOC for multi-line. Never
`less/more/man/vim/nano/-i/rebase -i`; pipe uncertain CLIs to `| cat`. Hang >30s with no output → read the
terminal file, find the pid, kill it; don't re-run.

---

## §12 — Definition of Done (ALL true)

- [ ] **P0** shipped: F01–F19 + F28 (group-split UX, images-reworked, live board, identity/connect, QR-as-
      URL, real-time+notifications, sticky headers); **P1/P2** (F20–F27) shipped or deferred with reason.
- [ ] Deleting an expense **recalculates** total + balances everywhere; a guest contribution is **live**
      without the owner opening the app; the owner stays moderator + money authority.
- [ ] Photos **persist** across reload, allow **multiple**, are viewable+downloadable by all incl. the web
      guest; the Worker stores **plaintext images** (only) + TTL/revoke; **messages/debts/names stay E2E**.
- [ ] A peer sees **my onboarding name** (never "Android Chrome"); connect is **bilateral**; Android QR zoom
      works; **every QR is a URL**.
- [ ] A charge/debt/payment surfaces **in real-time** on an open app + lands in the **notification center**
      + **home** + a native notification; nothing requires a re-scan.
- [ ] Marking-paid is **never penalized**; the **receiver confirms** (override logged); a **who-paid/who-
      owes** view + a **history** exist.
- [ ] Group creation can add **existing/connected/trip** people (no giant list), linked by real id +
      notified.
- [ ] `/shared` is **intent-led** (balance hero first, sticky header); **one "Pessoas"** with status;
      concepts explained.
- [ ] **Ledger-math invariance** held (arithmetic unchanged); suite **green** vs baseline; `build` +
      `tsc --noEmit` clean; per-gate deploys done (Pages; `wrangler deploy` for G2 & G6).
- [ ] Brain synced (§14); DEC-348…360 `APPROVED`; superseded notes added to DEC-340/342/343/344/347.

---

## §13 — Anti-patterns (do NOT)

- ❌ Add login/accounts. ❌ Multi-writer/CRDT the money ledger (owner stays authority).
- ❌ Keep an image **E2E** after DEC-348 (delete the scramble path) — but ❌ also never upload a **private,
  unshared** expense's image without the user sharing/attaching it.
- ❌ Let the Worker read **messages/debts/names/statements** (DEC-207 stays — images are the **only**
  carve-out).
- ❌ Re-introduce the **owner-pending gate** (a contribution must not wait for the owner).
- ❌ Change any total/balance **value** for the same inputs (ledger-math invariance) — making a stale total
  correct is allowed; changing the formula is not.
- ❌ Show a person in **two** lists (Pessoas + Amigos) after DEC-357. ❌ Show a payer as **owing** while
  awaiting-confirmation (DEC-353).
- ❌ Render a **raw-payload QR** to a default camera (DEC-351). ❌ Show "Android Chrome" as a person (DEC-350).
- ❌ Code a gate whose **§16 lock is open** (G2/G3/G6/G9). ❌ Delete any feature (hide-never-delete).
- ❌ Hardcoded UI text / non-English code. ❌ `git` without `--no-pager`.

---

## §14 — Brain sync

- `src/dev-log.md` — every milestone (Current State + entry; newest gate first; preserve the predecessor wave below).
- `decision-log.md` — DEC-348…358 `PROPOSED` at G0 → `APPROVED` by the shipping gate; **add a SUPERSEDED/
  AMENDED note** to DEC-342/343 (images), DEC-340 (owner gate), DEC-344 (peer-ping promoted), DEC-347
  (settle IA v2).
- `product-spec.md` — at the relevant gate close: §28 (group split: live board, registrant, multi-photo,
  plaintext images, history, states), §25 (sync: real-time + notifications), the "V1 in scope w/
  constraints" (image privacy model change).
- `project-status.md` — status/pending/next at wave end. `README.md` — point to this doc when ACTIVE.

---

## §15 — Manual smoke matrix (per gate)

| Journey | iOS Safari/PWA | Android Chrome/PWA | Desktop |
|---|---|---|---|
| Guest `/g/` adds an expense → appears for everyone live (no owner open) | ☐ | ☐ | ☐ |
| Delete an expense → total + balances correct immediately + after reload | ☐ | ☐ | ☐ |
| Attach 2 photos → persist across reload → web guest views + downloads | ☐ | ☐ | ☐ |
| Connect A↔B once → both see each other by **onboarding name**; QR zoom works | ☐ | ☐ | ☐ |
| Cobrar → real-time toast + notification center + home card on the peer | ☐ | ☐ | ☐ |
| Marcar pago → receiver confirms; payer never red; history shows it | ☐ | ☐ | ☐ |
| `/shared` v2: balance first, one Pessoas list, connect ≠ backup | ☐ | ☐ | ☐ |

---

## §16 — Decisions (✅ LOCKED by Julio, 2026-06-26)

> All four locks are IN — the doc is **ACTIVE**. Recorded for the executing agent (do not re-ask).
> Recommended execution path: **G1 first** (immediate safe value), then straight through G2→G9.

- **L-IMG (DEC-348) — Reverse image E2E → access-controlled plaintext on R2.** ✅ **LOCKED.** Unguessable
  id + TTL + delete-on-revoke; upload-on-attach (fixes persistence); multi-photo; Worker serves the real
  content-type. **DEC-207 stays** for messages/debts/names/statements (images are the only carve-out).
- **L-LIVE (DEC-349) — Live shared board; owner = moderator, not a sync gate.** ✅ **LOCKED.** Every
  viewer folds all `/responses` locally (reuse the pure `reduceGroupClaims`); contributions/deletes live;
  owner keeps money-authority + tombstones + confirmations.
- **L-RT (DEC-352) — Real-time signal-DO peer-ping + notification center + home + native notif.** ✅
  **LOCKED.** Reuse `SHARE_SIGNAL`/`/rooms`; "real-time = while the app is reachable" (no APNs).
- **L-IA (DEC-356/357) — Settle-up IA v2 (intent-led) + unify Pessoas/Amigos into one list w/ status.** ✅
  **LOCKED.** Re-composition only, no ledger/orchestrator logic change. *(Julio asked for a **visual
  council** on live screenshots first — see the appended "G9 visual council" + capture them at G9 m0.)*
- **DEC-350 sub-choice — RESOLVED by Julio:** **use the onboarding owner name** first (no new field by
  default); `onboardingOwnerName ?? profileName ?? deviceName`. An optional `profileName` only when no
  onboarding name exists.

**Everything else (DEC-351/353/354/355/358 + the F01–F05/F15/F28 directives) is locked by the council
recommendation — do not re-ask.**

---

## §17 — GO — start here

1. **Confirm state:** `git --no-pager log --oneline -5`; read `package.json` version (expect `1.3.0-rc`);
   read `src/dev-log.md` Current State; confirm the predecessor wave (G0→G7) is shipped and **this** wave's
   files don't exist yet.
2. **G0:** `npm install` → `npm run test` → `npm run build` → `npx tsc --noEmit`; record baseline; seed
   dev-log; set DEC-348…358 `PROPOSED`; print the §16 lock state.
3. **All §16 locks are IN — execute G1→G9 in order**, no stops for approval. (G9 m0 still captures the
   live `/shared` screenshots and runs the visual council before re-composing — see the G9 appendix.)
4. Each gate: re-read the §6 file → domain+tests → UI+E2E → 5-point self-check → commit per item → gate
   end: suite+build+tsc+smoke → bump version → deploy (`wrangler deploy` for G2 & G6) → DECs APPROVED →
   dev-log → ANCHOR + CURRENT STATE.
5. **Don't stop** until the §12 DoD is all TRUE — or a gate closes clean at context's end — or a hard
   blocker. Then end with an `AskQuestion`.

**ANCHOR (paste every 3 milestones / each gate boundary):**
> Money=cents · domain=pure TS · `t()` always (pt/en/es) · code English · **no login** (identity = device
> actorId + **onboarding name** → `profileName` → device label) · **owner = group money authority +
> moderator (NOT a sync gate)** ·
> **contributions live for everyone** · **images = access-controlled plaintext on R2** (messages/debts/
> names stay E2E — DEC-207) · **real-time = signal-DO ping while reachable** · **never penalize
> marked-paid; receiver confirms** · **every QR is a URL** · ledger-math invariance · hide-never-delete ·
> never block a contribution.
> **CURRENT STATE:** gate=__ · last commit=__ · tests=__/__ (baseline __) · locks set=__ · risks=__ · scope=__.
