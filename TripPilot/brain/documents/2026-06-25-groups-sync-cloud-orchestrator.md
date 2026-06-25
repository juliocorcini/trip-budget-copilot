# Leva — Grupos, Sincronia & Nuvem (Group Split UX · Two-Way Live Sync · R2 Images)

> **Status: ✅ LOCKED (2026-06-25) — ready to execute.** Julio locked the §16 forks: **L1** rename
> "Saldos"→**"Pagamentos"**; **L4** everyone contributes via **owner-as-reducer**; **L5** images
> **E2E-encrypted on R2, ≤2 MB/image**; **L7** inbound debts **accept-first**; **L8 (changed from the
> council's default) — a confirmed payment ALWAYS prompts the receiver to credit a fund/wallet**
> (DEC-346 updated). L2/L3/L6 follow the council recommendations. **R2 reuses the proven FestPilot
> `DEC-059` media pattern** (see §4/§7/§10-G5) — TripPilot adds client-side E2E encryption + an
> anonymous TTL guard (our receipts are private; FestPilot avatars are public).
> **Version cadence:** `1.1.9-rc → 1.2.0-rc … 1.2.5-rc` per gate, **`1.3.0-rc` headline** when live
> two-way sync (G7) ships.
> **Siblings (tone/structure):** `2026-06-25-field-fixes-clarity-2-orchestrator.md`,
> `2026-06-25-discovery-clarity-implementation-orchestrator.md`,
> `2026-06-24-coherence-implementation-orchestrator.md`.

---

## §0 — Mission

Make **group split** (our Tricount) feel like a real shared ledger, make **connections** truly
**two-way and live**, and give shared expenses a **cloud home for their images** (R2, now enabled).

The central pain, in Julio's words:
- *"O grupo é de todo mundo — cada um adiciona os seus gastos, não só o dono."*
- *"Despesas é o principal; saldos e quem-paga ficam atrás de botões. 'Saldos' é palavra difícil."*
- *"Conectei com a pessoa mas eu não apareço no celular dela — tem que ser mão dupla, automático."*
- *"Hoje tem WebSocket; não preciso mais de QR pra passar informação. QR é só pra conectar (e backup)."*
- *"Criei um gasto dividindo com o Bruno → tem que chegar notificação no Bruno na hora: 'aceita?'."*
- *"A imagem que subi no gasto compartilhado tem que ir pra nuvem e aparecer pro outro."*
- *"O botão voltar entra em loop entre a lista de grupos e o grupo."*
- *"Acerto de contas: 'Meu QR' fixo em cima à direita; adicionar pessoa no topo; conexões não no fim."*

**What this wave IS:** a batch that (a) reorders + enriches the group-split surfaces so everyone
contributes, (b) fixes the nav loop, (c) adds an **E2E-encrypted R2 image channel** for shared/group
expenses, and (d) turns the existing async **mailbox** into a **two-way, live, notified** sync for
connections, debts and payments — activating the DEC-108 deferrals (settlement handshake, multi-device
merge, real-time table split).

**What this wave is NOT:** a login/accounts system (still out of V1 — identity stays *device actorId +
chosen name*, DEC product-spec "Explicitly NOT in Scope"); a rewrite of the money math (data-invariance
ÂNCORA holds); a new vendor backend (R2 + the existing Worker only).

TripPilot is a local-first travel-budget PWA (React + TS + Dexie; pure-TS domain; Cloudflare Pages +
one `trippilot-sync` Worker). **§16 is LOCKED — go straight to §17.**

---

## §1 — Identity & autonomy contract (you are the executor)

1. **No subagents / no Task tool / no delegation.** Everything inline, one session. Councils = sections.
2. **Don't ask permission to advance** once ACTIVE/locked. Finishing a milestone → commit → deploy →
   dev-log → next. Only stop at the genuine hand-off (DoD all TRUE / hard blocker / context out).
3. **Do, don't narrate.** Minimize prose.
4. **Reuse, never reinvent.** §4 baseline + §6 root-cause map say exactly what already exists.
5. **Code in English; UI via `t()`** (pt/en/es), never hardcoded. Money = integer cents.
6. **Domain before UI**, one change at a time, **test with the change**.
7. **WSL terminal safety** (§11): `git --no-pager`, `"$G" commit -m`, no pager/editor.
8. **Keep the brain in sync** (§14).
9. **Terminal hand-off ends with `AskQuestion`** — only at a genuine stop.
A *new* ambiguity the brain + this doc don't resolve → inline council on the spot → `DEC-NNN (PROPOSED)`
→ continue.

---

## §2 — Reading order (load once)

This doc §0–§9 → `src/dev-log.md` (Current State) → the cited DECs only (**DEC-297** group split,
**DEC-306** trip bridge, **DEC-103..108** sync, **DEC-206/207** images+share, **DEC-105/106** pairing +
mirrored statements, **DEC-259** inline add-participant) → `product-spec.md` §25/§26/§28/§29 + "V1 in
scope w/ constraints" + "Explicitly NOT in scope" → the sibling orchestrator for tone. **Do not re-read
the whole brain per milestone.**

---

## §3 — Non-negotiables (ÂNCORA)

**Inherited (app-wide):**
- **Money = integer cents**; pure-TS domain (zero React in `domain/`); the sum of shares always equals
  the expense (ÂNCORA 11). **Data invariance:** no balance/total changes value this wave.
- **Hide-never-delete**; nothing destructive without an undo path.
- **UI text via `t()`** in pt/en/es; **code in English**.
- **Never block expense logging** — manual entry is always available; AI/photo/cloud are opt-in.
- **Additive schema only** unless a real migration is justified (DEC-style note): new optional fields
  on `GroupExpense` are non-indexed → no Dexie version bump.
- **The Worker stores only opaque ciphertext** (DEC-207). It must never learn who talks to whom, nor
  read an image, a debt or a name.

**New for this wave (lock candidates → §16):**
- **N1 — No login.** Anyone can contribute to a group/shared expense identified only by a chosen
  **name** + their **device actorId**. The owner device stays the **reducer/authority** of group truth.
- **N2 — One connect, then live.** A QR/link pairing is a **one-time** act that makes the peer
  **permanent + two-way**. After that, *all* sync (debts, payments, expenses, images) flows over the
  **Worker mailbox/WebSocket** — never another QR. QR device-transfer (`/sync`) is **backup only**.
- **N3 — Images are E2E.** A shared/group image is encrypted **client-side**; only the AES key (in the
  share `#fragment` / sealed mailbox envelope) unlocks it. R2 holds ciphertext + a TTL. Local-only
  attachments (a private expense's photo) stay device-local (DEC-206 unchanged) until they are *shared*.
- **N4 — Honest sync state.** Never show a "ghost" connection or a "delivered" we didn't confirm
  (reuse `deriveConnectionStatus`). A pending shared debt is **pending until accepted**, not silently in.

Breaking one is a defect even if tests pass.

---

## §4 — Baseline: what already exists (reuse, don't rebuild)

| Area | File → symbol | What it already does | Confirmed GAP |
|---|---|---|---|
| Group event math | `domain/group-split/group-split.ts` → `buildGroupExpense`, `expenseShares`, `computeGroupBalances`, `computeGroupTransfers`, `groupTotalCents`, `addExpense/updateExpense/removeExpense`, `reduceGroupClaims` | Pure ledger: equal/custom split, balances, greedy min-transfers, owner folds guest claims | `GroupExpense` has **no `occurredAt`, no `createdByParticipantId`** |
| Group types | `domain/group-split/types.ts` → `GroupExpense`, `GroupParticipant`, `GroupSplitEvent` | participant `kind` (`manual`/`connected`/`guest`), `claimedByActorId`, `paymentStatus` | no expense date / author fields; no image refs |
| Guest claim | `domain/group-split/claim-response.ts` → `GroupClaimResponse`; `features/group-split/group-link.ts` → `postGroupClaim`, `pullGroupClaims` | Guest posts **{ pick name, marked paid }**; owner reduces | **guest can't author an expense** — claim only carries identity + paid flag |
| Detail screen | `features/group-split/GroupSplitDetailPage.tsx` | total/people card, invite(link), balances+transfers, expenses, people, lifecycle | order is balances-first; **invite = link only**; "Saldos" wording; add-person loses focus on tap |
| Expense editor | `features/group-split/GroupExpenseEditor.tsx` → `scanReceiptForGroup` (prefill desc/amount/category) | receipt scan = **whole-bill prefill**, manual payer + equal/custom | **no item-selection**, **no date field**, names small (`text-sm`) |
| Bill-split item picker | `features/split/SplitPage.tsx` (+ `domain/splitting`) | scan → **items list → pick items → who pays → split** | the richer flow Julio wants the group editor to match |
| Create | `features/group-split/GroupSplitListPage.tsx` → `handleCreate` (`createGroupSplit`) | name + currency, then navigate to detail | **no inline participants at creation** |
| Public board | `features/group-split/GroupClaimPage.tsx` (`/g/:id`) | guest picks name, sees net + transfer, marks paid (read-only expenses) | no add-expense; no "download the app" CTA; no item view |
| Pairing | `domain/orchestrators/sync-orchestrators.ts` → `pairParticipantFromIdentity`, `upsertPeerLink` | scanner links the scanned identity (+ captures pubkey) | **one-way** — the *scanned* device learns nothing about the scanner |
| Async mailbox | `domain/orchestrators/mailbox-orchestrators.ts` → `sendPayloadToPeerMailbox`, `drainMailboxIntoApp`, `flushOutbox`; `data/sync/identity-crypto.ts` → `sealForPeer/openForMe` | seals for a peer's pubkey, queues, posts, drains on open | kinds = **`statement`|`backup` only**; drain only **on open** (no live pull); no notification surface |
| Mailbox types | `domain/types/mailbox.ts` → `MailboxPayloadKind`, `MailboxEnvelope` | E2E envelope; sender identity inside ciphertext | no `connect`/`debt`/`payment`/`expense`/`image` kinds |
| Connections view | `domain/connections/connections.ts` → `buildConnectionViews`, `deriveConnectionStatus`, `findReconnectCandidate` | honest friend list (connected/waiting/offline) from `peerLinks` | reverse-link not created on pair; UI buries it |
| Settle hub | `features/shared/SharedExpensesPage.tsx` (`/shared`) | shared expenses, debts, **My QR + receive-from-device + connections collapsed at the bottom**; add-by-QR in the add-participant row | "Meu QR" buried; connections at the fold; QR-transfer mixed with connect |
| Images | `domain/types/attachment.ts`, `features/attachments/attachment-utils.ts`, `utils/image/compress.ts` (→ `CompressedImage`) | device-local `Attachment` (blob + thumb), compression, `useAttachments` | **never uploaded** anywhere; not in backup |
| **R2 reference (sibling, PROVEN)** | **FestPilot** `../festival-copilot/FestPilot/server/`: `wrangler.toml` (`[[r2_buckets]] binding="MEDIA"`), `src/env.ts` (`MEDIA: R2Bucket`), **`src/media/store.ts`** (thin adapter `putImage/getImage/deleteImage` + pure `checkMediaQuota` allowlist/cap/count/budget + D1 ledger), `src/api/media.ts` (`POST/DELETE` routes, versioned overwrite-aware keys), `src/index.ts` (`GET /media/*` serves straight from R2, immutable cache); client `web/src/ui/imageCompress.ts` (canvas downscale + JPEG step-down) + `web/src/data/api.ts uploadAvatar` (raw blob body, honest error). DEC-059. | this is the shape to **mirror** — TripPilot diverges: **ciphertext not plaintext**, **anon TTL guard not Firebase**, **no D1 ledger** (see §7 DEC-342) |
| Worker | `worker/src/index.ts`, `worker/wrangler.jsonc` | `/rooms` (P2P signal DO), `/ocr` `/assistant` `/transcribe`, `/share` (KV ciphertext), **`Mailbox` DO**, `/t` telemetry | **no R2 binding**, **no image route**, no live "ping a peer" hook |
| Notifications | `domain/insights/notifications.ts`, `features/notifications/NotificationsPage.tsx` | local notification surface (insights) | nothing routes inbound peer events into it |

---

## §5 — Change-set, normalized (by priority)

**Theme A — Group split UX (P0, no backend):**
- **A01** Create flow asks **participants inline** (name + currency + optional people), pre-fills event.
- **A02** Add-participant **focus-advance**: after add, keyboard stays + focus returns to an empty field
  (create form, detail "People", and `/shared`). Aligns DEC-259.
- **A03** Detail **reorder**: total/people card → **Expenses (primary)** → People → balances &
  "quem-paga" **behind buttons**; expenses-first even when empty (with an add affordance).
- **A04** Rename **"Saldos" → "Pagamentos"** (clearer); both *balances* and *transfers* ("quem paga
  quem") live behind toggle buttons, not always-on.
- **A05** **Everyone contributes** — group members/guests author their own expenses (not just owner);
  can also record a debt others owe. (Council C1 → DEC-340.) No login (N1).
- **A06** Invite = **link + QR** (reuse `QrCodeDisplay`).
- **A07** Expense **item-selection**: "**nota completa** (default) **ou selecionar itens**" — bring the
  `SplitPage` scan→items→pick flow into the group editor; choose payer + "dividir entre" with live
  preview. (DEC-337.)
- **A08** **Bigger fonts** for names in the people/selection list.
- **A09** Expense **date** ("quando foi") — new `occurredAt` field, shown + editable.
- **A10** **Open an expense** to see its items/value (read or edit view).
- **A11** Track + show **who registered** each expense (`createdByParticipantId`), distinct from payer.
- **A12** **Group expenses by day** when they span multiple dates (date headers).
- **A13** *(P2)* Settle-method **option at creation** — "cada um paga cada um" vs "consolidar pagadores"
  (the greedy min-transfer we already do). Default = current. (DEC-335 note.)
- **A14** Guest board CTA: "**gostou? baixe o app**" (the same invite-to-app pattern from `/shared`).

**Theme B — Navigation (P0):**
- **B01** Fix the **groups ↔ detail back loop** (DEC-341).

**Theme C — Cloud images / R2 (P1, backend):**
- **C01** Worker **R2 binding + upload/get/delete routes** for opaque ciphertext (TTL). (Council C2 → DEC-342.)
- **C02** Attach images to **any** expense locally (today's behavior) **and**, when an expense is
  **shared**, upload the encrypted image so the other side sees + downloads it. (DEC-343.)
- **C03** Group split **images gallery/tab** — receipts/split photos visible to all members & the `/g/`
  guest board. (DEC-343.)
- **C04** Bill-split (`/split` live table): the photo used to divide is shared to viewers. (DEC-343.)

**Theme D — Two-way live sync + settle IA (P1, backend, headline):**
- **D01** **Two-way connect handshake** — pairing (QR/link) creates the **reverse `peerLink`** so each
  appears on the other's phone automatically. (Council C3 → DEC-344.)
- **D02** **Persistent peer + live transport** — after connect, info flows over mailbox/WebSocket;
  add live "drain now" (open + a lightweight peer ping), not only drain-on-open. (DEC-344.)
- **D03** **Live shared debt/expense** — create an expense split with a peer → a sealed `debt`/`expense`
  envelope → a **notification** on their phone → **accept** → it lands in their shared expenses.
  (Council C4 → DEC-345.)
- **D04** **Live payment** — "I paid you" / "you paid me" propagates → notification → settle, and on
  confirmation **always prompts the receiver to credit a chosen fund/wallet** (L8 lock — the real cash
  arrived). (Council C4 → DEC-346.)
- **D05** **Settle-up IA redesign** — "Meu QR" as a **fixed top-right** action; **add-person at the
  top**; **connections surfaced** (not at the fold). (Council C5 → DEC-347.)
- **D06** **Demote QR-transfer to backup** — `/sync` "receber de outro aparelho" is the offline backup
  path, separated from "connect a friend"; fix the scan-asymmetry confusion. (DEC-347.)

---

## §6 — Root-cause map (symptom → exact code → fix direction → gate)

| # | Symptom (Julio) | Root cause (file → symbol) | Fix direction | Gate |
|---|---|---|---|---|
| B01 | Back loops between groups list ↔ a group | `GroupSplitDetailPage.tsx:243` back = `navigate('/groups')` **pushes** a 2nd list entry; `GroupSplitListPage.tsx:68` back = `navigate(-1)` **pops** to detail → ping-pong | Detail in-page back → `navigate(-1)`; keep `navigate('/groups',{replace:true})` only for not-found(`:149`)/post-delete(`:237`). Verify list back lands on the real parent | G1 |
| A03/A04 | Saldos shown first; "Saldos" hard word; quem-paga always on | `GroupSplitDetailPage.tsx` sections: balances+transfers `:310`, expenses `:351`, people `:394`; i18n `group_split.balances_title` | Reorder: card → Expenses → People → collapsible **Pagamentos** (balances) + **Quem paga quem** (transfers) behind buttons; rename key text | G1 |
| A02 | Add person closes keyboard / loses focus | `GroupSplitDetailPage.tsx:429-444` (button tap blurs input; `setNewPerson('')` only) | Add an input `ref`; on add, refocus it; same pattern in create form + `/shared` | G1 |
| A06 | Invite only makes a link | `GroupSplitDetailPage.tsx:203 handlePublish` → `shareLink` only | After publish, render `QrCodeDisplay(link)` + the link, both actions | G1 |
| A09/A11/A12 | No date; only payer shown; no day grouping | `domain/group-split/types.ts GroupExpense` (no `occurredAt`/`createdByParticipantId`); rows `:369-389` show payer only; `buildGroupExpense` | Add optional `occurredAt` + `createdByParticipantId` (additive); set author = acting participant; render date + "registrado por"; group rows by day | G2 |
| A07/A08/A10 | Scan lumps all items; names tiny; can't open items | `GroupExpenseEditor.tsx` `scanReceiptForGroup` = whole-bill prefill; names `text-sm`/`text-xs`; no item model | Reuse `SplitPage`/`domain/splitting` item picker → "nota completa | selecionar itens"; bump name font; expense detail shows items | G2 |
| A01 | Creation doesn't ask people | `GroupSplitListPage.tsx:75-119` form = name + currency; `createGroupSplit` | Add an inline participants editor (focus-advance A02); pass people into `createGroupSplit` | G3 |
| A05/A14 | Only owner adds; guest board read-only | `GroupClaimPage.tsx` (read-only expenses); `claim-response.ts GroupClaimResponse` (name+paid); `reduceGroupClaims` | Extend claim to carry **guest-authored expenses**; owner folds them (reducer stays authority); add "baixe o app" CTA | G4 |
| C01 | No cloud for images | `worker/wrangler.jsonc` (no `r2_buckets`); `worker/src/index.ts` (no image route) | **Mirror FestPilot `media/store.ts`+`media.ts`+`index.ts GET /media/*`**: add `[[r2_buckets]] binding="MEDIA"` + `MEDIA: R2Bucket`; a thin adapter (only R2 touchpoint) `putImage/getImage/deleteImage`; routes `PUT/GET/DELETE /img/:id`. **Divergence:** store **`application/octet-stream` ciphertext**, **anon write guard + TTL** (like `/share`), **no D1 ledger** (per-object cap only for V1). `wrangler deploy` | G5 |
| C02/C03/C04 | Shared images don't reach others | `attachment.ts` device-local; no upload; group event JSON can't hold blobs | Reuse our `utils/image/compress.ts` → **encrypt (AES-GCM, share crypto)** → `PUT /img/:id`; store `{ r2Id, keyRef, mime, w, h }` in the (already E2E) shared payload; lazy `GET`+**decrypt** on the other side → blob URL; gallery surface; delete on share-revoke | G5 |
| D01 | One-way connection | `sync-orchestrators.ts pairParticipantFromIdentity` only writes the scanner's `peerLink` | On pair, **seal a `connect` envelope** to the peer (carrying my identity+pubkey) so they upsert the reverse link → both two-way | G6 |
| D02/D07 | Sync needs repeated QR; not live | `mailbox-orchestrators.ts drainMailboxIntoApp` only on open; `mailbox.ts MailboxPayloadKind` limited; `/sync` is the transfer | Persist peer; live "drain now" on open + peer-ping over the signal DO; demote `/sync` to backup-only | G6 |
| D05/D06 | Meu QR + connections buried; scan asymmetry | `SharedExpensesPage.tsx` connections collapsed at bottom; My QR + receive-from-device low; add-by-QR vs receive confusion | Fixed top-right **Meu QR**; add-person at top; connections section up; separate "conectar amigo" from "backup de aparelho" | G6 |
| D03/D04 | No live debt/payment + notify/accept | `mailbox.ts` no `debt`/`payment` kinds; `notifications.ts` no inbound route; settle landing | New envelope kinds + drain routing → notification → accept handshake → shared expense / settlement; choose landing fund | G7 |

> **Re-read the cited file before editing — symbols move between gates.**

---

## §7 — Decisions + inline councils

> _All councils run **inline, this session, 1 request, no subagents** (cost is per-request). Each is a
> neutral brief → blind voices → red team → chair synthesis → a `DEC`._

### Direct decisions (clear directives — no council)
- **DEC-335** — Group-split detail **information architecture**: card → **Expenses (primary)** → People →
  **Pagamentos** (balances) and **Quem paga quem** (transfers) behind buttons. Rename "Saldos"→
  "Pagamentos". *(A13 settle-method option recorded here as a P2 sub-note; default = current greedy
  min-transfer.)*
- **DEC-336** — `GroupExpense` gains optional **`occurredAt`** (date) + **`createdByParticipantId`**
  (registrant). Additive, non-indexed. Rows show date + "registrado por {name}"; group by day when dates
  differ.
- **DEC-337** — Group expense capture offers **"nota completa" (default) vs "selecionar itens"**,
  reusing the `SplitPage` item primitives; larger name fonts; expense detail exposes items.
- **DEC-338** — **Inline participants at group creation** + **focus-advance** add everywhere (DEC-259).
- **DEC-339** — Group invite = **link + QR**.
- **DEC-341** — Nav: in-page group back = `navigate(-1)`; structural navigations use `{replace:true}`.

### Council C1 → DEC-340 — "Everyone contributes" without login
**Brief.** Today only the owner authors group expenses; guests (via `/g/`) only pick a name + mark paid.
Julio: *every member adds their own expenses, no account.* Identity is device `actorId` + chosen name;
login is out of V1. Options: **(a) owner-as-reducer** (guest posts an authored-expense claim; owner
device folds it deterministically, staying the single source of truth — extends the existing
`reduceGroupClaims`); **(b) multi-writer/CRDT** (every device writes the event); **(c) require the app
+ connection** to contribute. Bias to resist: "real Tricount lets anyone edit anything."
**Architect (prior: invariants/least-rework).** (a) reuses the proven reduce loop and keeps one
authority → no merge conflicts on money. CRDT (b) is a new consistency model for integer-cents truth =
high risk, weeks of work. Rec: (a). Confidence: High. *Others miss:* the owner already re-publishes on
every change — guest-authored items ride the same revision bump for free.
**Advocate (prior: user value/simplicity).** Users expect "I add my expense and it appears." (a)
delivers that within seconds (owner poll + live drain in G7). (c) breaks the no-app guest promise that
makes the `/g/` link valuable. Rec: (a), with optimistic local echo for the author. Confidence: High.
*Others miss:* the author must see their own item instantly even before the owner folds it.
**Critic (prior: failure modes).** (a)'s risk: two guests add the same receipt → duplicates; or the
owner is offline so nothing folds. Mitigations: stable client-generated expense ids (idempotent fold),
and "pending until owner syncs" honesty (N4). (b) would let a malicious guest rewrite others' debts —
worse. Rec: (a) + idempotency + pending state. Confidence: Med-High. *Others miss:* deletion rights —
only the author or owner may remove an authored expense (hide-never-delete).
**Red team (kill a-as-leading).** If the owner never opens the app, guest expenses never settle into
truth → "I added it, nothing happened." Counter: G7's live drain + a sealed copy to the owner's mailbox
makes the owner fold on next open (async-honest), and the guest sees "pending owner". Acceptable for V1;
true multi-writer stays a deferred V2 (DEC-108 lineage).
**Chair synthesis.** **Owner-as-reducer wins** (the invariants lens dominates: money truth must have one
authority and we already have the reduce machinery). Extend `GroupClaimResponse` to carry
author-stamped expenses with **client-stable ids**; `reduceGroupClaims` folds idempotently; author/owner
can remove; non-folded items read **pending**. No login. **What flips it:** if field use shows owners
are too often offline, promote to a per-pair live room (G7 infra makes this incremental).

### Council C2 → DEC-342 — R2 image storage shape
**Brief.** R2 is enabled. We need shared/group images in the cloud, but the Worker must stay a dumb
ciphertext store (DEC-207) and images must not bloat backups (DEC-206). Options: **(a) E2E-encrypted
blobs on R2** keyed by random id, AES key in the share `#fragment` / sealed envelope, TTL + revoke;
**(b) plaintext on R2** behind an unguessable URL; **(c) keep device-local, send over P2P/mailbox only.**
Bias to resist: "just upload the JPEG, it's only a receipt."
**Architect.** (a) matches the share-link model exactly (`SHARE_STORE` KV ciphertext + key in fragment)
— same crypto (`sealForPeer`/AES-GCM), R2 instead of KV for big bytes. (c) can't serve a `/g/` web
guest with no peer channel. Rec: (a). Confidence: High. *Others miss:* reuse `compress.ts` first so
even ciphertext is small; store `{r2Id, keyRef, mime, w, h}` in the payload, not the bytes.
**Critic.** (b) is a privacy breach: receipts show names, totals, locations — an unguessable URL is not
consent, and it contradicts N3/DEC-207. (a)'s risks: orphaned blobs (TTL + the share-revoke already
deletes), and key handling (the key already travels safely for statements). Rec: (a). Confidence: High.
*Others miss:* set a **size cap** + count cap per share to bound cost/abuse.
**Strategist.** (a) keeps "portable, no vendor lock-in, server sees nothing" — a real differentiator vs
Tricount/Splitwise. Confidence: High. *Others miss:* it also unlocks future shared-trip media cheaply.
**Red team (kill a).** E2E means a `/g/` guest's browser must decrypt — extra JS + a fragment key in
the URL (shoulder-surf risk). Counter: the same fragment already carries the board's AES key today; one
more key is no new exposure, and decryption in-browser is standard WebCrypto. Holds.
**Chair synthesis.** **E2E-encrypted R2 wins** (privacy + consistency lens dominates). Worker:
`PUT/GET/DELETE /img/:id` storing opaque bytes with a TTL; client encrypts with a per-image AES key
referenced from the (already E2E) share/mailbox payload; **compress before encrypt**; cap **≤2 MB/image
(L5 lock)**, ≤N per share. **What flips it:** none for shared media; private local attachments stay
device-local (DEC-206) — they only ascend to R2 when the expense becomes shared.

**Reuse note — FestPilot `DEC-059` R2 pattern (verified by reading the sibling code 2026-06-25).**
FestPilot already runs R2 in prod for avatars + meeting photos. **Mirror its proven shape**, do NOT
reinvent:
- **Binding:** `[[r2_buckets]] binding = "MEDIA" bucket_name = "trippilot-media"` (create via
  `wrangler r2 bucket create trippilot-media`); `MEDIA: R2Bucket` in the Worker `Env`.
- **Thin adapter = the only R2 touchpoint** (provider stays swappable): `putImage(env,key,body,ct)` →
  `env.MEDIA.put(key, body, { httpMetadata:{ contentType, cacheControl:'public,max-age=31536000,immutable' }})`;
  `getImage` → `env.MEDIA.get(key)`; `deleteImage` → `env.MEDIA.delete(key)`.
- **App-enforced quota** (Cloudflare has no hard spend cap — only budget alerts): a **pure**
  `checkMediaQuota(contentType, byteLength, usage, maxBytes)` → allowlist + per-object cap + (count +
  total-byte budget). Set a **~$1 budget alert** in the dashboard.
- **Serving:** `GET /img/:id` straight from R2 (`obj.writeHttpMetadata(headers)`); **versioned keys** so
  a new image = a new URL (no stale cache).
- **Client:** compress to a target budget before upload (our `utils/image/compress.ts` already does
  canvas downscale + JPEG step-down — reuse it, don't port FestPilot's `imageCompress.ts`); POST the
  blob as the **raw body**; surface the server's honest reason (oversize/wrong-type/over-budget).
**TripPilot divergences from FestPilot (because our images are PRIVATE + the Worker is anonymous):**
1. **Ciphertext, not plaintext.** FestPilot stores public JPEGs served no-auth + cached. We
   **compress → encrypt (AES-GCM, the same share crypto) → upload `application/octet-stream`**; the real
   `mime`/`w`/`h` live **inside** the encrypted payload (`{ r2Id, keyRef, mime, w, h }`), never as R2
   metadata. `GET /img/:id` returns **ciphertext**; the client decrypts with the key from the share
   `#fragment` / sealed envelope → a blob URL. The URL alone is useless without the key (the privacy win).
   The cap is the **2 MB plaintext** target; allow ciphertext ≤ ~2.1 MB for the envelope overhead.
2. **No D1 ledger (V1).** FestPilot ledgers count/bytes in D1 (it already had D1); the TripPilot Worker
   has none. **V1 enforces the per-object cap + TTL + the dashboard budget alert only** (feed
   `checkMediaQuota` a zeroed `usage` so only type+cap apply). The count/byte ledger (a small DO counter)
   is documented **V2 hardening**, reusing the same pure `checkMediaQuota`.
3. **Anonymous write guard + TTL/revoke.** No Firebase/user session. Guard writes like the existing
   **`/share`**: an opaque random `r2Id`, tied to a published share, with a **TTL**; **deleting the share
   (revoke/expiry) deletes the blob** (reuse the `group-link.ts`/share-client revoke path). The Worker
   never authenticates a person; it stores/serves opaque bytes with a lifetime.

### Council C3 → DEC-344 — Two-way connection + live transport
**Brief.** Pairing is one-way (`pairParticipantFromIdentity` writes only the scanner's `peerLink`).
Julio wants automatic reverse linking + persistent live sync, *without* repeating QR. We already have:
identity QR (actorId+pubkey), the E2E mailbox (seal/queue/drain), and the signal DO (`/rooms`). Options:
**(a) mailbox handshake** — on pair, seal a `connect` envelope to the peer so they upsert the reverse
link; thereafter mailbox is the channel, drained on open + a live ping; **(b) dedicated per-pair Durable
Object room** (always-on socket); **(c) WebRTC data channel** kept open.
Bias to resist: "live = must hold a socket open."
**Architect.** (a) reuses everything; the reverse link needs only the peer's pubkey, which the scanner
*has* (it scanned it) — so the scanner can even pre-seed and the `connect` envelope confirms. (b) is the
cleanest "live" but adds DO lifecycle + cost + presence; (c) WebRTC is flaky on mobile/background
(Julio's own pain). Rec: (a) now, (b) as the live-upgrade in G7. Confidence: High. *Others miss:* "live"
for a budget app = "updated within seconds when the app is open," not 24/7 push — (a)+ping covers it.
**Advocate.** Users want "I connect once and it just stays." (a) delivers permanence (the `peerLink` is
durable, cross-trip). The felt-latency gap (only-on-open) is closed by draining on open + on focus + a
short poll while a shared surface is visible. Rec: (a). Confidence: Med-High. *Others miss:* a visible
"sincronizado agora" honesty beat so the user trusts it.
**Critic.** (a) fails if the peer never opens the app (envelope waits) — but that's honest and identical
to every async model; (b)/(c) don't fix an offline peer either. Risk: the reverse `connect` could be
spoofed → bind it to the scanned pubkey + the sealed-sender identity (the Worker can't forge it). Rec:
(a) with authenticated envelopes. Confidence: High. *Others miss:* dedupe — a re-pair must update, not
duplicate, the link (`upsertPeerLink` already does).
**Red team (kill a).** "Only-on-open" will feel dead vs the user's "tem que chegar na hora." Counter:
G7 adds a **peer ping** over the existing signal DO (a tiny "you have mail" nudge) so an open app pulls
immediately; a closed app gets it on next open. That is the realistic ceiling without native push (no
accounts/APNs in V1). Accept.
**Chair synthesis.** **Mailbox handshake + live-on-open/ping wins** (reuse + mobile-reality lens
dominates). G6: reverse-link `connect` envelope → true two-way; persist peer; demote QR to connect+
backup. G7: add the signal-DO peer-ping + drain-on-focus for "feels instant." Per-pair DO room is the
documented **V2 upgrade** if presence/real-time is needed. **What flips it:** if users demand
background delivery, that needs push infra (out of V1).

### Council C4 → DEC-345 / DEC-346 — Live debt/payment: accept handshake + money landing
**Brief.** Julio: create a split-with-Bruno → Bruno gets a notification "Julio shared a 10 EUR debt,
accept?" → accept → it appears as a shared expense on Bruno's phone; likewise "paguei/recebi" must
notify and settle, and the settled money must land *somewhere honest* (which fund/wallet?). Two
questions: **(Q1)** does an inbound shared debt enter **born-confirmed** or **accept-first**?
**(Q2)** where does a confirmed payment **land** in the recipient's ledger?
**Advocate (Q1).** Accept-first matches the user's exact words ("você aceita?") and prevents strangers
injecting debts. Slight friction, big trust. Rec: **accept-first**, with one-tap accept from the
notification. Confidence: High. *Others miss:* an accepted debt should reciprocally update the sender
("Bruno aceitou").
**Critic (Q1).** Born-confirmed risks spam/abuse and contradicts N4 (pending-until-accepted). Accept-
first's risk is "ignored invites pile up" → add expiry + a clear pending list. Rec: accept-first.
Confidence: High. *Others miss:* rejecting must inform the sender so totals don't lie.
**Architect (Q2).** We already have the **debts engine** (`ParticipantShare`/mirrored statements,
DEC-106) and **funds/wallets**. A peer's "I paid you" is a **settlement of an existing obligation**, not
a new expense (product-spec ÂNCORA "settlement ≠ expense"). So a confirmed payment should **close the
debt** and, on the *receiver's* side, optionally **credit a chosen fund/wallet** (the "qual fundo?"
answer) — never auto-create a phantom transaction (mirrors DEC-306's no-phantom rule). Rec: settlement
closes the obligation; crediting a fund is an explicit, optional follow-up. Confidence: High. *Others
miss:* keep it ledger-neutral by default (like the trip bridge) to avoid double-counting.
**Red team.** Accept-first + "choose a fund" is two taps for a 10 EUR debt — friction. Counter: default
the debt to **pending** with one-tap accept, and make the fund-credit **optional** (skip = just close
the debt). Minimal friction, maximal honesty.
**Chair synthesis.** **DEC-345 (Q1): accept-first.** An inbound `debt`/`expense` envelope creates a
**pending** shared item + a notification; one-tap accept folds it in and reciprocally notifies the
sender; reject informs the sender. **DEC-346 (Q2) — LOCK OVERRIDE (Julio, 2026-06-25):** the council's default was *ledger-neutral*;
**Julio locked L8 = always credit a fund.** A `payment` envelope marks the obligation **confirmed/paid**
on both sides (lifecycle pending→confirmed→paid, never red) **and the receiver is ALWAYS prompted to
credit the received cash to a chosen fund/wallet** — this is a **real inflow** (the debtor returned money
the receiver had fronted per the payer-semantics truth table), **not** a phantom and **not** a duplicate
of the original expense. Reuse the existing **funds** engine for the credit + the **debts** engine to
close the obligation. The trip **settle-bridge (DEC-306) stays ledger-neutral/read-only** — this credit
is the **P2P shared-debt** flow, a distinct surface. **What flips it:** if users dislike the mandatory
prompt, offer a remembered "always this fund for {name}" default (still credits, just one less tap).
**Accept-first (DEC-345) what-flips:** if too heavy for trusted pairs, a per-connection "auto-accept from
{name}" toggle (opt-in, still honest).

### Council C5 → DEC-347 — Settle-up "Acerto de contas" IA + QR roles
**Brief.** `/shared` buries "Meu QR", "receber de outro aparelho" and connections at the bottom; add-by-
QR (connect) and receive-from-device (backup) are confusingly mixed. Julio: **Meu QR fixed top-right**,
**add-person at the top**, **connections surfaced**, and a clear split between *connect a friend* and
*backup/restore a device*.
**Advocate.** The two top jobs on this screen are "show my QR so someone adds me" and "add someone."
Make both reachable in the first viewport: a persistent **Meu QR** affordance (top-right) + an
**Adicionar pessoa** action at the top; connections right under "sobre mim." Rec: that layout.
Confidence: High. *Others miss:* "sobre mim" (my name + status) anchors identity so the QR makes sense.
**Architect.** This is a re-layout of existing pieces (QR component, add-participant row, connection
list) — no new data. Keep `/sync` (device transfer) as a clearly-labeled **backup** entry, not a
connection path. Rec: low-risk re-compose. Confidence: High. *Others miss:* the scan-asymmetry bug
(D01) must land with this or the new UI still "doesn't connect both ways."
**Critic.** Risk: a fixed top-right QR competes with the page back/title; ensure it doesn't overlap nav
and is reachable one-handed. And demoting `/sync` must not orphan the legit offline-transfer use. Rec:
fixed action in the header row (not floating over content); keep `/sync` discoverable under "backup."
Confidence: High.
**Red team.** Over-promoting QR could confuse users who only want to *see debts*. Counter: keep the debt
list as the page's body; QR/add/connections are the header band — present, not dominant.
**Chair synthesis.** **Re-compose `/shared`** (clarity lens dominates): header band = *sobre mim* +
fixed **Meu QR** (top-right) + **Adicionar pessoa**; **Conexões** moved up; debts remain the body;
`/sync` relabeled **backup de aparelho** and separated from connect. Ship **with D01** so two-way
actually works. **What flips it:** none — this is directive UX; the only open choice (QR as
header-action vs a sheet) resolves to header-action for one-tap access.

---

## §8 — Test strategy (test WITH the change)

- **Domain-pure first (>90%):** new/changed pure functions get concrete-value tests:
  - `group-split.ts`: `occurredAt`/`createdByParticipantId` preserved through build/update; **balances &
    transfers identical to baseline** for the same inputs (data-invariance); day-grouping helper.
  - `claim-response.ts` + `reduceGroupClaims`: **idempotent fold** of guest-authored expenses (stable
    ids → no duplicates), author/owner-only deletion, pending vs folded.
  - `mailbox-envelope.ts` + new kinds: pack/unpack round-trip for `connect`/`debt`/`payment`/`expense`/
    `image`; reverse-link upsert from a `connect` envelope; accept/reject state machine.
  - image: `compress → encrypt → decrypt` round-trip equals source; cap enforcement.
- **Reuse & extend** the existing `split-live-loop`, group-split and mirrored-statement suites — don't
  duplicate.
- **Critical UI via E2E (>70%):** create-with-people, add-expense-by-item, the nav-loop journey,
  `/shared` header actions, and a two-device handshake stub.
- **Data invariance:** assert every total/balance/transfer is **unchanged** vs baseline after the
  group-split refactors (G1–G4 are exposure/IA, not math).
- **"Full suite green between gates"** = 0 failures **beyond the documented G0 baseline** (record the
  known WebCrypto `split-live-loop` cases that pass only on Node 22/CI).

---

## §9 — Per-milestone protocol

**Before every milestone commit (5-point):** (1) list satisfied AC ids; (2) name 3 earlier ACs at
regression risk + verify (always include **data-invariance** + **never-block-expense-logging** +
**Worker-sees-only-ciphertext**); (3) run tests — no new failures; (4) flag any file touched outside
scope; (5) update `src/dev-log.md`.
**Gate boundary:** re-read §3 + next gate scope + dev-log Current State; print the ANCHOR + CURRENT
STATE line. **Every 3 milestones:** light refresh (critical rules + dev-log).

---

## §10 — THE BUILD — gates G0→G7

### G0 — Setup & baseline (always) → no version change
- **Why:** a regression reference + a seeded log.
- **Do:** `npm install`; run `npm run test`, `npm run build`, `npx tsc --noEmit` (+ E2E if env allows);
  **record baseline counts** (incl. known `split-live-loop` failures); seed `src/dev-log.md` (Current
  State + this wave's milestone table); add **DEC-335…347** as `PROPOSED`; confirm Pages pipeline + that
  G5–G7 will need `wrangler deploy` (Worker changes).
- **AC:** green baseline documented; dev-log seeded; DECs recorded; lock state noted.

### G1 — Group-split IA + nav loop (P0, no backend) → `1.2.0-rc`
- **Items:** B01, A02, A03, A04, A06. **Root cause:** §6 rows B01/A03/A04/A02/A06.
- **Change:** fix back nav; reorder detail (Expenses primary, People, **Pagamentos**+**Quem paga quem**
  behind buttons); rename "Saldos"; focus-advance add; invite link **+ QR**.
- **AC:** no back loop on groups↔detail (E2E); expenses are the first section; balances/transfers only
  via their buttons; "Saldos" gone from UI copy; adding a person keeps the keyboard + focus; invite
  shows a scannable QR + link. **Balances/totals byte-identical to baseline.**
- **Tests:** nav E2E; data-invariance assertions; i18n keys present pt/en/es.
- **Commit/Deploy:** per item; gate end → suite+build+tsc+smoke → bump `1.2.0-rc` → Pages deploy →
  promote G1 DECs (335/339/341 + 338's focus part) APPROVED → dev-log.

### G2 — Expense data + capture (P0) → `1.2.1-rc`
- **Items:** A09, A11, A12, A07, A08, A10. **Root cause:** §6 rows A09.../A07....
- **Change:** add `occurredAt` + `createdByParticipantId` (additive); render date + "registrado por";
  day-group rows; bring `SplitPage` item-selection ("nota completa | selecionar itens") into the group
  editor; larger name fonts; expense detail shows items.
- **AC:** an expense stores + shows its date and registrant; multi-day lists show day headers; the scan
  offers whole-bill (default) **or** item-pick with live preview; names are visibly larger; tapping an
  expense reveals its items/value; **math unchanged**.
- **Tests:** domain (fields preserved; invariance; day-group helper); editor E2E (both scan modes).
- **Deploy:** gate end → `1.2.1-rc` → DEC-336/337 APPROVED.

### G3 — Group creation with people (P0) → `1.2.2-rc`
- **Items:** A01 (+ A02 reuse). **Root cause:** §6 row A01.
- **Change:** inline participants editor in the create form (focus-advance); seed the event's people on
  create.
- **AC:** creating a group lets me add several people inline (keyboard stays, focus advances); the new
  event opens pre-populated; creating with zero extra people still works.
- **Tests:** create-with-people E2E; `createGroupSplit` people seeding unit.
- **Deploy:** `1.2.2-rc` → DEC-338 APPROVED.

### G4 — Everyone contributes (P0/P1) → `1.2.3-rc`  *(DEC-340 LOCKED: owner-as-reducer)*
- **Items:** A05, A14. **Root cause:** §6 row A05.
- **Change:** extend `GroupClaimResponse` to carry author-stamped expenses (client-stable ids);
  `reduceGroupClaims` folds idempotently; author/owner deletion; **pending** until folded;
  `GroupClaimPage` gains add-expense + "baixe o app" CTA + item view.
- **AC:** a `/g/` guest (no app) can add an expense that appears for everyone after the owner syncs,
  shown **pending** until then; duplicates impossible (stable ids); only author/owner can remove;
  owner stays the money authority; **balances correct**.
- **Tests:** idempotent-fold domain tests (concrete cents); guest-add E2E against a published board.
- **Deploy:** `1.2.3-rc` → DEC-340 APPROVED.

### G5 — R2 cloud images (P1, Worker) → `1.2.4-rc`  *(DEC-342/343 LOCKED)*
- **Items:** C01, C02, C03, C04. **Root cause:** §6 rows C01/C02. **Pattern:** mirror FestPilot DEC-059
  (§4 baseline row + §7 DEC-342 reuse note) — **read those sibling files first**, then adapt.
- **Change:** **(m1)** Worker R2: `[[r2_buckets]] binding="MEDIA"` in `wrangler.jsonc` + `MEDIA: R2Bucket`
  in `Env`; a thin `media/store.ts`-style adapter (`putImage/getImage/deleteImage`, the only R2 touchpoint)
  + a pure `checkMediaQuota` (allowlist `application/octet-stream`, **cap ≤~2.1 MB ciphertext**); routes
  `PUT/GET/DELETE /img/:id` (anon, opaque random id, **TTL**, tied to a share). **(m2)** Client:
  reuse `utils/image/compress.ts` → **encrypt (AES-GCM share crypto)** → `PUT`; store
  `{ r2Id, keyRef, mime, w, h }` in the (already E2E) shared/group/mailbox payload. **(m3)** Other side:
  lazy `GET /img/:id` → **decrypt** with the key from the share `#fragment`/sealed envelope → blob URL.
  **(m4)** Surfaces: group **images gallery** + `/g/` board + bill-split viewers. **(m5)** Lifecycle:
  delete the blob on **share revoke/expiry** (reuse `group-link.ts`/share-client revoke).
- **AC:** an image on a **shared** expense uploads encrypted and is viewable+downloadable by the other
  party / group members / the web guest; the Worker only ever stores ciphertext; a **private** expense's
  image stays device-local until shared; size/count caps enforced; revoke/TTL removes blobs.
- **Tests:** compress/encrypt/decrypt round-trip + cap unit; Worker route smoke; share→view E2E.
- **Deploy:** **`wrangler deploy`** + Pages → `1.2.4-rc` → DEC-342/343 APPROVED. Verify `/img` route.

### G6 — Two-way connect + settle-up IA (P1, Worker) → `1.2.5-rc`  *(DEC-344/347 LOCKED)*
- **Items:** D01, D02, D05, D06. **Root cause:** §6 rows D01/D02/D05.
- **Change:** on pair, seal a `connect` envelope → peer upserts the reverse `peerLink` (authenticated by
  the scanned pubkey + sealed sender) → true two-way; persist peer + drain-on-open/focus; re-compose
  `/shared` (sobre mim + fixed **Meu QR** top-right + **Adicionar pessoa** top + **Conexões** surfaced);
  relabel `/sync` as **backup de aparelho**, separated from connect.
- **AC:** scanning A↔B makes **each appear on the other's** connections automatically (no second QR);
  `/shared` shows my QR + add-person + connections in the first viewport; device-transfer is clearly a
  backup, not a connect; honest status (no ghosts).
- **Tests:** reverse-link-from-connect domain test; `/shared` layout E2E; status honesty unit.
- **Deploy:** `wrangler deploy` (if signal/ping touched) + Pages → `1.2.5-rc` → DEC-344/347 APPROVED.

### G7 — Live debt/payment + notifications (P1, headline, Worker) → `1.3.0-rc`  *(DEC-345/346 LOCKED)*
- **Items:** D03, D04, D07. **Root cause:** §6 row D03.
- **Change:** new envelope kinds `debt`/`expense`/`payment`; drain routing → **pending** shared item +
  a **notification**; one-tap **accept** folds it + reciprocally notifies; **payment** marks both sides
  confirmed/paid (lifecycle, never red) with an **optional fund-credit** (default ledger-neutral); add a
  signal-DO **peer-ping** + drain-on-focus for "feels instant"; QR is connect+backup only.
- **AC:** creating a split-with-peer puts a "{name} shared a debt of X — accept?" notification on the
  peer's phone; accept lands it as a shared expense; "paguei/recebi" notifies and settles on both sides
  and **always prompts the receiver to credit a chosen fund/wallet** (L8); nothing turns red for normal
  flow; all sync rides mailbox/socket, never a re-scanned QR.
- **Tests:** envelope round-trips; accept/reject/payment state machine (concrete cents); two-device
  handshake+settle E2E stub; data-invariance on the receiver's totals.
- **Deploy:** `wrangler deploy` + Pages → **`1.3.0-rc`** → DEC-345/346 APPROVED. Headline release note.

> **G_last (P2, optional):** A13 settle-method option at creation — only with slack; else record
> deferred in dev-log.

---

## §11 — Terminal safety (WSL)

`git --no-pager …` for log/diff/show/status. Commit via `G=/usr/bin/git; "$G" commit -m "…"` (the
harness injects `--trailer`, rejected by sandbox git 2.25.1). HEREDOC for multi-line. Never
`less/more/man/vim/nano/-i/rebase -i`; pipe uncertain CLIs to `| cat`. Hang >30s with no output → read
the terminal file, find the pid, kill it; don't re-run.

---

## §12 — Definition of Done (ALL true)

- [ ] Every **P0** item (A01–A04, A06–A12, B01) shipped; **P1** (A05/A14, C01–C04, D01–D06) shipped or
      explicitly deferred with reason.
- [ ] Group detail = **Expenses-first**; balances/transfers behind buttons; "Saldos" renamed.
- [ ] Add-participant keeps keyboard + focus everywhere; creation can seed people.
- [ ] Expenses carry **date + registrant**, group by day, support **item-selection** + detail view.
- [ ] Anyone (incl. no-app guest) can **contribute** an expense; owner stays authority; honest pending.
- [ ] Invite = link **+ QR**; nav loop **gone**.
- [ ] Shared/group/bill-split **images** upload **E2E-encrypted to R2** and are viewable+downloadable;
      private images stay local; Worker stores only ciphertext; caps + TTL hold.
- [ ] Connections are **two-way automatically**; `/shared` IA = sobre-mim + fixed Meu QR + add-person +
      connections surfaced; QR-transfer demoted to backup.
- [ ] Live **debt/payment** propagate with **notification + accept**, settle on both sides, never red,
      and a confirmed payment **always prompts a fund/wallet credit** (L8); all sync over mailbox/socket
      (no re-scan).
- [ ] **Data invariance** held (no total/balance changed value); suite **green** vs baseline; `build` +
      `tsc --noEmit` clean; **per-gate deploys** done (Pages; `wrangler deploy` for G5–G7).
- [ ] Brain synced (§14); DECs `APPROVED`.

---

## §13 — Anti-patterns (do NOT)

- ❌ Add login/accounts (N1). ❌ Multi-writer/CRDT the group ledger (C1 chose owner-as-reducer).
- ❌ Upload a **plaintext** image, or upload a **private** (unshared) image (N3/C2).
- ❌ Let the Worker read names/debts/images (DEC-207). ❌ Born-confirm an inbound debt (C4: accept-first).
- ❌ Duplicate the original expense as a "new transaction" when a debt settles. *(But DO credit the
  received cash to a fund — L8: a P2P repayment is a real inflow, not a phantom. The trip settle-bridge
  DEC-306 stays read-only/ledger-neutral; the P2P payment credit is a distinct, real movement.)*
- ❌ Re-scan a QR to sync after connecting (N2). ❌ Show a ghost/"delivered" we didn't confirm (N4).
- ❌ Change any total/balance value in G1–G4 (data-invariance). ❌ Delete any feature (hide-never-delete).
- ❌ Hardcoded UI text / non-English code. ❌ `git` without `--no-pager`. ❌ Code a gate whose §16 lock is open.

---

## §14 — Brain sync

- `src/dev-log.md` — every milestone (Current State + entry; newest gate first).
- `decision-log.md` — DEC-335…347 `PROPOSED` at G0 → `APPROVED` by the shipping gate.
- `product-spec.md` — at gate close: update §28 (group split: contribute + date/registrant + items +
  images), §25 (sync: two-way + live debt/payment), and the "V1 in scope w/ constraints" (R2 images).
- `project-status.md` — status/pending/next at wave end. `README.md` — point to this doc when ACTIVE.

---

## §15 — Manual smoke matrix (per gate)

| Journey | iOS Safari/PWA | Android Chrome/PWA | Desktop |
|---|---|---|---|
| Create group with people → add expense (item-pick) → back (no loop) | ☐ | ☐ | ☐ |
| Guest `/g/` adds an expense → owner sees it (pending→folded) | ☐ | ☐ | ☐ |
| Shared expense image → other side views + downloads | ☐ | ☐ | ☐ |
| Connect A↔B once → both appear; create debt → notify+accept on peer | ☐ | ☐ | ☐ |
| "Paguei" → creditor notified → settle → money-landing clear | ☐ | ☐ | ☐ |

---

## §16 — Decisions (✅ LOCKED by Julio, 2026-06-25)

> All forks are locked — the doc is **ACTIVE**. Recorded for the executing agent (do not re-ask):

- **L1 (DEC-335/336/337) — Group IA + expense data + capture.** ✅ **LOCKED:** Expenses-first;
  "Saldos"→**"Pagamentos"**; balances/transfers behind buttons; add `occurredAt`+`createdByParticipantId`;
  "nota completa | selecionar itens" capture.
- **L2 (DEC-338/339/341) — Creation people + QR invite + nav.** ✅ **LOCKED** (council rec): inline people
  + focus-advance; invite link+QR; back=`navigate(-1)`.
- **L3 (DEC-347/D05/D06) — Settle-up IA.** ✅ **LOCKED** (council rec): sobre-mim + **fixed Meu QR
  top-right** + add-person top + connections surfaced; `/sync` = backup.
- **L4 (DEC-340) — Everyone contributes.** ✅ **LOCKED: owner-as-reducer** (guest authors expenses, owner
  folds; **no login**; stable ids; pending-until-synced).
- **L5 (DEC-342/343) — R2 images.** ✅ **LOCKED: E2E-encrypted** blobs on R2, **cap ≤2 MB/image**
  (compress→encrypt; key in the E2E payload; TTL; private images stay local until shared). **Reuses the
  FestPilot DEC-059 R2 pattern** (§4/§7).
- **L6 (DEC-344) — Two-way + live transport.** ✅ **LOCKED** (council rec): **mailbox `connect` handshake**
  + drain-on-open/focus + a signal-DO **peer-ping**; per-pair DO room = V2. "Live = on-open/ping while the
  app is open, not 24/7 push" (no accounts/APNs in V1).
- **L7 (DEC-345) — Inbound debt protocol.** ✅ **LOCKED: accept-first** (notification → one-tap accept;
  reject informs sender; optional per-connection auto-accept later).
- **L8 (DEC-346) — Payment landing.** ✅ **LOCKED — OVERRIDES the council default:** a confirmed payment
  **ALWAYS prompts the receiver to credit a chosen fund/wallet** (a real inflow, not a phantom; does not
  duplicate the original expense). The trip settle-bridge (DEC-306) stays read-only/ledger-neutral.

**Scope note (honest):** this is effectively **two waves** — a UX wave (G1–G4) and a backend wave
(G5–G7). Recommended execution: **ship G1–G3 first** (immediate, low-risk value), then run the backend
gates G4–G7. One doc, executed in two passes, is fine — all locks are already in.

---

## §17 — GO — start here

1. **Confirm state:** `git --no-pager log --oneline -5`; read `package.json` version (expect
   `1.1.9-rc`); read `src/dev-log.md` Current State; confirm this wave's files don't already exist.
2. **G0:** `npm install` → `npm run test` → `npm run build` → `npx tsc --noEmit`; record baseline; seed
   dev-log; set DEC-335…347 `PROPOSED`.
3. **Execute G1→G7 in order** (each: re-read the §6 file → domain+tests → UI+E2E → 5-point self-check →
   commit per item → gate end: suite+build+tsc+smoke → bump version → deploy → DECs APPROVED → dev-log →
   ANCHOR+CURRENT STATE). **All §16 locks are in (2026-06-25) — execute straight through.** Recommended:
   ship G1–G3, then G4–G7. For **G5**, read the FestPilot DEC-059 files (§4/§7) before writing the R2 code.
4. **Don't stop** until the §12 DoD is all TRUE — or a gate closes clean at context's end — or a hard
   blocker. Then end with an `AskQuestion`.

**ANCHOR (paste every 3 milestones / each gate boundary):**
> Money=cents · domain=pure TS · `t()` always · **no login** · owner=group authority ·
> **images E2E only, Worker sees ciphertext** · connect-once-then-live · **accept-first** debts ·
> settlement≠duplicating-the-expense but a confirmed P2P payment **always credits a fund** (trip bridge
> DEC-306 read-only) · data-invariance · hide-never-delete · never block expense logging.
> **CURRENT STATE:** gate=__ · last commit=__ · tests=__/__ (baseline __) · risks=__ · scope=__.
