# KICKOFF — Leva "Grupos Confiáveis & Acerto Claro" (paste to start the wave cold)

You are a **senior full-stack engineer** executing the **Grupos Confiáveis & Acerto Claro** wave on
TripPilot **alone, in this one chat session**, end-to-end: design → code → test → commit → deploy, gate by
gate. This wave **fixes + reverses** parts of the wave that just shipped (`1.3.0-rc`).

## Source of truth
- **Orchestrator:** `TripPilot/brain/documents/2026-06-26-group-reliability-settle-redesign-orchestrator.md`.
  Read **§0–§9 once**, then execute **G0→G9 in order** from §10. Re-read each §6 file *before* editing it
  (this wave edits files the predecessor wave just rewrote — symbols moved).
- **Predecessor (the code you're correcting):** `2026-06-25-groups-sync-cloud-orchestrator.md` (shipped
  `1.3.0-rc`). The brain is the truth of *product*; the orchestrator is the truth of *execution*.

## Wave state
- The doc is **✅ ACTIVE — all four §16 locks IN (L-IMG/L-LIVE/L-RT/L-IA), Julio 2026-06-26.** Execute
  **G1→G9 in order, no stops for approval.**
- **Recommended path:** **G1 first** (safe UX value), then straight through G2→G9. **G9's visual + IA are
  fully decided — NO council needed:** build **Variante O** for `/shared` + the **Pessoas page** (DEC-359) +
  the **"Divisões em grupo" tile in the Viagem grid** (DEC-360). Reference renders/wireframes in
  `documents/2026-06-26-settle-shots/` (`variant-o-refined.png`, `wire-people-page.png`, `wire-viagem-entry.png`).
- **Base version:** `1.3.0-rc`. Per gate: `1.3.1 → 1.3.2 → 1.3.3 → 1.3.4 → 1.3.5`, **headline `1.4.0-rc`
  at G6** (real-time), then `1.4.1 → 1.4.2 → 1.4.3-rc`.

## Autonomy contract (condensed)
1. No subagents / no Task tool / no delegation — everything inline, councils = sections.
2. **Don't ask to advance** — milestone → commit → deploy → dev-log → next. Stop only at the genuine
   hand-off (DoD all TRUE / hard blocker / context out).
3. Do, don't narrate. 4. **Reuse** (§4 baseline + §6 map) — this wave is ~80% fixing/relabelling/re-
   composing existing code; almost no greenfield. 5. Code in English; UI via `t()` (pt/en/es); money =
   integer cents. 6. Domain before UI; test WITH the change. 7. WSL terminal safety. 8. Brain sync every
   milestone. 9. Hand-off ends with `AskQuestion`. New fork → inline council → `DEC (PROPOSED)` → continue.

## Already-decided (don't re-ask — locked by council recommendation)
- **DEC-350** identity name = the **onboarding owner name** in all share/connect/P2P:
  `resolveSelfName = activeTripOwnerName ?? profileName ?? deviceName` (no new field by default; Settings
  "Seu nome" pre-filled from onboarding). Never show the device label ("Android Chrome") as a person.
- **DEC-351** every app QR is a **URL** (deep link); a default camera never shows raw text.
- **DEC-353** payment lifecycle states; **receiver confirms** (organizer-override **logged**); **never
  penalize** marked-paid (neutral, not red).
- **DEC-354** group **activity log / history** (additive, append-only; display-only; lives in the E2E payload).
- **DEC-355** add **existing/connected/trip** people at creation (recents/most-used/"ver mais"), linked by
  real id + accept-first notify.
- **DEC-358** explain **"Dividir Conta" vs "Divisão em Grupo"** at all entry points + help.
- **Directives (no council):** F01 accordion exclusivity · F02 payment-status copy fits the card · F03
  bigger names + 2 columns + bigger checkbox · F04 "registrado por" on all surfaces · F05 capture rename +
  manual item add · F15 Android QR zoom · F28 sticky headers.

## ✅ Locked by Julio §16 (2026-06-26) — reversals / deep revisions, now in scope
- **L-IMG (DEC-348, G2):** reverse image **E2E** → **access-controlled plaintext on R2** (unguessable id +
  TTL + revoke; DEC-207 stays for messages/debts/names). ✅ LOCKED.
- **L-LIVE (DEC-349, G3):** **live shared board** (every viewer folds locally); owner = **moderator, not a
  sync gate** (keeps money-authority + tombstones). ✅ LOCKED.
- **L-RT (DEC-352, G6):** promote the **signal-DO peer-ping** to real-time + route inbound to the
  **notification center + home + native notif**. ✅ LOCKED.
- **L-IA (DEC-356/357, G9):** **settle-up IA v2** = **4 intent zones** (Situação · Resolver · Pessoas · Mais)
  under a **sticky header**; state money **once**; **unify Pessoas/Amigos** (one badge vocab); **backup
  leaves this screen**; ledger one-tap, not removed. ✅ LOCKED. **Concrete layout = Variante O** (saldo **2
  números verde/vermelho** A receber/A pagar · **Resolver agora** · **Pessoas** prévia de 3 linhas ricas +
  "**ver todas (N)**" + linha de conectar logo abaixo · **Atividade** prévia + "**Ver tudo (Histórico)**" ·
  **Divisões = ponteiro** → `/groups` · **Mais** · backup-out). See the DEC-357 layout addendum + `variant-o-refined`.
- **L-PEOPLE (DEC-359, G9):** "**ver todas as pessoas**" opens a **full Pessoas page** (not a modal):
  **search** + a **connect row at top** (`Meu QR · Ler QR · Adicionar`) + status sections
  (`Precisam de ação → Conectados → Convidados → Sem app`), paginated; reuses the unified people model
  (DEC-357). **Connect lives WITH people** (a slim row, never a separate "Conectar" card). **Rename "Por QR"
  → "Ler QR".** ✅ LOCKED.
- **L-DIV (DEC-360, G9/G-last):** **`/groups` stays the ONE divisions list** (don't build a 2nd list in
  `/shared`). Fix **discoverability**: FAB "Divisão em grupo" lands on **`/groups`** (the list w/ "+ Nova"),
  **not** `?new=1`; add a **"Divisões em grupo (N)" tile in the Viagem grid** (`TripHubPage` `structureItems`,
  `grid grid-cols-3`) → `/groups`, and **rename** the mislabeled "Participantes" tile (→`/shared`) to
  **"Acerto de contas"**; `/shared` keeps only a **summary pointer** → `/groups`. All doors converge on
  `/groups`. ✅ LOCKED.
- **DEC-350 sub-choice — RESOLVED:** onboarding owner name first, `profileName` only as a fallback when
  absent. No new field by default.

## NON-NEGOTIABLES / ÂNCORA (paste every 3 milestones / each gate)
> Money=cents · domain=pure TS (zero React) · `t()` always (pt/en/es) · code English · **no login**
> (identity = device actorId + **onboarding name** → `profileName` → device label) · **owner = group money
> authority + moderator, NOT a sync
> gate** · **contributions are live for everyone** · **shared images = access-controlled plaintext on R2**
> (messages/debts/names STAY E2E — DEC-207) · **real-time = signal-DO ping while the app is reachable** (no
> APNs) · **never penalize marked-paid; the receiver confirms** (organizer-override logged) · **every QR is
> a URL** · **ledger-math invariance** (the arithmetic is unchanged; fixing a stale total is allowed) ·
> hide-never-delete · never block a contribution · **settle-up screen = Variante O** (saldo 2 números
> verde/vermelho) · **`/groups` is the ONE divisions list** (many pointers; FAB→list, Viagem grid tile) ·
> **connect lives WITH people** ("Ler QR", never a separate card) · **"ver todas pessoas" = a full page** (search).
> **CURRENT STATE:** gate=__ · last commit=__ · tests=__/__ (baseline __) · locks set=__ · risks=__ · scope=__.

## Gate order (one line each)
- **G0** baseline + dev-log seed + DEC-348…360 PROPOSED + **all §16 locks IN** (no version).
- **G1** `1.3.1-rc` — group-split UX: accordion-exclusive, status-copy, bigger names/2-col, registrant
  everywhere, capture rename + manual items, **sticky headers**. [council rec]
- **G2** `1.3.2-rc` — **images → plaintext R2** + persistence + multi-photo + revoke. [✅ L-IMG] · `wrangler deploy`
- **G3** `1.3.3-rc` — **live group board** + delete-recalc + owner = moderator. [✅ L-LIVE]
- **G4** `1.3.4-rc` — **onboarding name** (`resolveSelfName`) + **bilateral connect** + Android QR zoom. [✅ DEC-350]
- **G5** `1.3.5-rc` — **every QR is a URL**. [council rec]
- **G6** `1.4.0-rc` — **real-time peer-ping** + notification center + home + native notif. [✅ L-RT] · `wrangler deploy`
- **G7** `1.4.1-rc` — payment **states** + **receiver-confirms** + don't-penalize + **history** + who-paid view. [council rec]
- **G8** `1.4.2-rc` — add **existing/connected/trip** people at creation. [council rec]
- **G9** `1.4.3-rc` — **settle-up = Variante O** (saldo 2 números verde/vermelho · Resolver · Pessoas prévia rica + "ver todas" + conectar `Meu QR · Ler QR · Adicionar` · Atividade prévia + "Ver tudo" · Divisões = ponteiro → `/groups` · backup-out · sticky header) + **página Pessoas** (DEC-359) + **Divisões no grid do Viagem** + FAB→lista (DEC-360) + unify **Pessoas/Amigos** + explainers. [✅ L-IA / L-PEOPLE / L-DIV]
- **G_last (P2):** trimmed extras (auto-accept toggle, richer override audit, dashboard "divisão ativa" card) — only with slack.

## Terminal safety (WSL)
`git --no-pager log/diff/show/status`. Commit: `G=/usr/bin/git; "$G" commit -m "…"` (HEREDOC for
multi-line) — avoids the `--trailer` reject. Never `less/more/man/vim/nano/-i/rebase -i`; pipe uncertain
CLIs to `| cat`. Hang >30s → read the terminal file, find the pid, kill; don't re-run.

## Deploy pipeline
Bump `package.json` + `src/utils/app-version.ts` + `public/version.json` (+ pt/en/es release note) →
`"$G" commit -m "…"` + push `master` → **Cloudflare Pages** auto-build (`build:pages` → `dist/` +
`bundles/<v>.zip`); verify `/version.json` + `/bundles/<v>.zip`. **G2 & G6 also need `wrangler deploy`**
(Worker: image content-type on G2; peer-ping room on G6). Verify the `/img` route serves a JPEG after G2.

## Per-milestone protocol
5-point before each commit: (1) AC ids done; (2) 3 earlier ACs at risk + verify (always include **ledger-
math invariance** + **never-block-contribution** + **Worker-ciphertext-for-messages/debts/names**;
images are the only carve-out); (3) tests — no new failures; (4) flag out-of-scope files; (5) dev-log
entry. Gate boundary: re-read §3 + next scope + dev-log; print ANCHOR + CURRENT STATE; continue.

## Exact G0 commands
```bash
git --no-pager log --oneline -5
npm install
npm run test
npm run build
npx tsc --noEmit
```
Record baseline counts (incl. the known `split-live-loop` WebCrypto cases that pass only on Node 22/CI),
seed `src/dev-log.md`, set DEC-348…360 `PROPOSED`. **All §16 locks are IN** — execute **G1→G9 in order**;
don't stop until the §12 DoD is all TRUE (or a clean gate close at context's end, or a hard blocker).

**Confirm in ONE line that you read the orchestrator and finished G0 — then continue without waiting for a
reply** (G1→G9 straight through; **G9 builds Variante O + the Pessoas page + the Viagem divisions entry —
the visual/IA is already locked, no council needed**).
