# KICKOFF — Leva "Grupos, Sincronia & Nuvem" (paste to start the wave cold)

You are a **senior full-stack engineer** executing the **Grupos, Sincronia & Nuvem** wave on TripPilot
**alone, in this one chat session**, end-to-end: design → code → test → commit → deploy, gate by gate.

## Source of truth
- **Orchestrator:** `TripPilot/brain/documents/2026-06-25-groups-sync-cloud-orchestrator.md`.
  Read **§0–§9 once**, then execute **G0→G7 in order** from §10. Re-read each §6 file *before* editing it.
- The brain is the truth of *product*; that doc is the truth of *execution*.

## Wave state
- The doc is **✅ ACTIVE — §16 L1–L8 LOCKED by Julio (2026-06-25).** No open locks; execute G0→G7.
- Recommended path: **ship G1–G3 first** (UX, low-risk), then run backend **G4–G7**. One doc, two passes.
- Start version: **`1.1.9-rc`**. Per gate: `1.2.0 → 1.2.1 → 1.2.2 → 1.2.3 → 1.2.4 → 1.2.5`,
  **headline `1.3.0-rc` at G7** (live two-way sync).
- **R2 reuses the proven FestPilot `DEC-059` pattern** — read the sibling files first (orchestrator §4
  baseline row + §7 DEC-342 reuse note): `../festival-copilot/FestPilot/server/src/media/store.ts`,
  `.../api/media.ts`, `.../index.ts` (`GET /media/*`), `wrangler.toml`. TripPilot adds **client E2E
  encryption + an anonymous TTL guard** (our receipts are private; theirs are public).

## Autonomy contract (condensed)
1. No subagents / no Task tool / no delegation — everything inline, councils = sections.
2. Once a gate's lock is satisfied, **don't ask to advance** — milestone → commit → deploy → dev-log →
   next. Stop only at the genuine hand-off (DoD all TRUE / hard blocker / context out / an open lock).
3. Do, don't narrate. 4. Reuse (§4 baseline + §6 map) — never reinvent. 5. Code in English; UI via
   `t()` (pt/en/es); money = integer cents. 6. Domain before UI; test WITH the change. 7. WSL terminal
   safety. 8. Brain sync every milestone. 9. Hand-off ends with `AskQuestion`. New fork → inline council
   → `DEC (PROPOSED)` → continue.

## Already-adopted decisions (don't re-ask once locked)
- **DEC-335** group IA: Expenses-first; "Saldos"→"Pagamentos"; balances/transfers behind buttons.
- **DEC-336** `GroupExpense` += `occurredAt` + `createdByParticipantId` (additive); day-grouping.
- **DEC-337** capture: "nota completa | selecionar itens" (reuse SplitPage items); bigger fonts; item view.
- **DEC-338** inline people at creation + focus-advance add. **DEC-339** invite link + QR.
- **DEC-340** everyone contributes via **owner-as-reducer** (no login; pending-until-folded; stable ids).
- **DEC-341** nav: in-page back `navigate(-1)`; structural nav `{replace:true}`.
- **DEC-342/343** **E2E-encrypted images on R2** (compress→encrypt; key in the E2E payload; caps+TTL);
  private images stay local until shared; group/`/g/`/bill-split galleries.
- **DEC-344** two-way **mailbox `connect` handshake** + drain-on-open/focus + signal-DO peer-ping
  (per-pair DO room = V2). **DEC-347** settle-up IA (sobre-mim + fixed Meu QR top-right + add-person top
  + connections surfaced; `/sync` = backup).
- **DEC-345** inbound debt = **accept-first** (notify → one-tap accept; reject informs sender).
- **DEC-346 (L8 LOCK)** payment **closes the obligation** both sides (never red) **and ALWAYS prompts the
  receiver to credit a chosen fund/wallet** (real inflow, not a duplicate of the expense); the trip
  settle-bridge DEC-306 stays read-only.

## NON-NEGOTIABLES / ÂNCORA (verbatim — paste every 3 milestones / each gate)
> Money=cents · domain=pure TS (zero React) · `t()` always (pt/en/es) · code English · **no login**
> (identity = device actorId + name) · **owner device = group money authority** · **images E2E only,
> Worker stores only ciphertext** · **connect once, then live (never re-scan to sync)** · **accept-first**
> inbound debts · **settlement ≠ duplicating the expense** — but a confirmed P2P payment **always credits
> a fund** (real inflow; trip bridge DEC-306 stays read-only) · **data-invariance** (no total/balance
> changes value in G1–G4) · **hide-never-delete** · **never block expense logging** · honest sync state
> (no ghosts / no fake "delivered").
> **CURRENT STATE:** gate=__ · last commit=__ · tests=__/__ (baseline __) · risks=__ · scope=__.

## Gate order (one line each)
- **G0** baseline + dev-log seed + DEC-335…347 PROPOSED (no version).
- **G1** `1.2.0-rc` — nav loop + detail IA (Expenses-first, Pagamentos/Quem-paga buttons, rename) +
  focus-advance + invite QR. [L1+L2]
- **G2** `1.2.1-rc` — expense date + registrant + day-group + item-selection capture + bigger fonts +
  item view. [L1]
- **G3** `1.2.2-rc` — create group with inline people. [L2]
- **G4** `1.2.3-rc` — everyone contributes (owner-as-reducer) + guest "baixe o app" CTA. [L4]
- **G5** `1.2.4-rc` — R2 E2E images (mirror FestPilot DEC-059 adapter/routes + client encrypt + share
  upload + galleries + ≤2 MB cap + TTL). [L5] · `wrangler deploy`
- **G6** `1.2.5-rc` — two-way connect handshake + settle-up IA + demote QR-transfer to backup. [L6+L3] · `wrangler deploy`
- **G7** `1.3.0-rc` — live debt/payment + notifications + accept + peer-ping. [L7+L8] · `wrangler deploy`
- **G_last (P2):** A13 settle-method option at creation — only with slack.

## Terminal safety (WSL)
`git --no-pager log/diff/show/status`. Commit: `G=/usr/bin/git; "$G" commit -m "…"` (HEREDOC for
multi-line) — avoids the `--trailer` reject. Never `less/more/man/vim/nano/-i/rebase -i`; pipe uncertain
CLIs to `| cat`. Hang >30s → read terminal file, find pid, kill; don't re-run.

## Deploy pipeline
Bump `package.json` + `src/utils/app-version.ts` + `public/version.json` (+ pt/en/es release note) →
`"$G" commit -m "…"` + push `master` → **Cloudflare Pages** auto-build (`build:pages` → `dist/` +
`bundles/<v>.zip`); verify `/version.json` + `/bundles/<v>.zip`. **G5–G7 also need `wrangler deploy`**
(R2 binding + new routes/ping). Verify the `/img` route after G5.

## Per-milestone protocol
5-point before each commit: (1) AC ids done; (2) 3 earlier ACs at risk + verify (always include
data-invariance + never-block-expense + Worker-ciphertext-only); (3) tests — no new failures; (4) flag
out-of-scope files; (5) dev-log entry. Gate boundary: re-read §3 + next scope + dev-log; print ANCHOR +
CURRENT STATE.

## Exact G0 commands
```bash
git --no-pager log --oneline -5
npm install
npm run test
npm run build
npx tsc --noEmit
```
Record baseline counts (incl. known `split-live-loop` WebCrypto cases that pass only on Node 22/CI), seed
`src/dev-log.md`, set DEC-335…347 `PROPOSED`. Then — **only for gates whose §16 lock is satisfied** —
execute G1→G7; don't stop until the §12 DoD is all TRUE (or a clean gate close at context's end, or an
open lock).

**Confirm in ONE line that you read the orchestrator and finished G0 — then continue without waiting for
a reply** (respecting the open §16 locks).
