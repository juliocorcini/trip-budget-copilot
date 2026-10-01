---
name: implementation-orchestrator
description: >-
  The STANDARD way we implement changes to an existing, shipped app: an in-session, single-agent
  "leva" (implementation wave). It pairs an ORCHESTRATOR DOCUMENT (the single execution truth —
  mission, non-negotiables/ÂNCORA, baseline of what already exists, root-cause map code↔change,
  inline councils, gates G0→Gn with acceptance criteria, test strategy, deploy pipeline,
  Definition of Done) with a KICKOFF PROMPT that runs it end-to-end with NO subagents, one milestone
  at a time, testing and deploying per gate. Use when Julio says "monta o orquestrador", "cria a leva",
  "aplica/implementa a leva de ponta a ponta", "faz o kickoff", "manda essa leva", or asks to plan and
  then execute a multi-gate change wave on a live codebase. Read this BEFORE authoring or executing a wave.
---

# Implementation Orchestrator — How We Implement (Always)

This is **how we ship changes to an existing, already-deployed app**: not by ad-hoc coding and not by
delivering folders to an external dev, but by **one agent, in one chat session, executing a fully
pre-investigated plan end-to-end** — designing, coding, testing, committing, and deploying gate by gate.

It is the method behind every recent TripPilot wave. The canonical, real examples in this repo are:

- `TripPilot/brain/documents/2026-06-24-coherence-implementation-orchestrator.md` (Coherence & Tricount, G0→G8)
- `TripPilot/brain/documents/2026-06-25-discovery-clarity-implementation-orchestrator.md` (Discovery & Clarity, G0→G6)
- `TripPilot/brain/documents/2026-06-25-field-fixes-clarity-2-orchestrator.md` (Field Fixes & Clarity #2, G0→G6)
- `TripPilot/brain/documents/2026-06-25-discovery-clarity-kickoff-prompt.md` (the matching kickoff)

> **Why it's worth it (and the trade-off Julio called out):** this method is **a bit slower** than
> "just code it" because of the upfront investigation, councils, per-milestone self-checks, and the
> test+deploy discipline at every gate. In exchange it **delivers reliably**: no scope creep, no
> regressions in the parts that already work, a green suite and a live deploy at the end of each gate,
> and a brain that stays in sync. When you feel the slowness, **right-size the depth** (see
> "Right-sizing & the speed/cost trade-off") — do not abandon the structure.

---

## 0. When to use vs. when not to

**Use the orchestrator method when:**
- The app already exists, is tested, and is **live** — and we're applying a *batch of related changes*
  (a "leva"): a review round, a field-feedback batch, a clarity/UX pass, a feature set.
- The work spans **multiple files/areas** and benefits from ordering by risk.
- We want **deploys per gate** and a guarantee that nothing already-good regresses.

**Do NOT use it (overkill) when:**
- It's a one-line fix, a single isolated bug, or a pure question. Just do it (still respect terminal
  safety + brain sync if a decision is made).
- The deliverable is a **folder for an external developer** → that's `phase-delivery` (different skill).
- You only need to *plan* phases for a greenfield build → that's `phase-planner`.

**Two distinct jobs this skill covers:**
1. **AUTHORING** — turn a briefing into an orchestrator document (+ kickoff prompt). Slower, analytical,
   includes investigation and inline councils. Output = a `brain/documents/*-orchestrator.md`.
2. **EXECUTING** — take an `ACTIVE` orchestrator and build it end-to-end in one session. Output = shipped
   code, green tests, deploys, and an updated brain.

---

## 1. Non-negotiable execution contract (inherited from the rules)

These mirror the project rules and are **absolute** during a wave. They are what make the method safe.

1. **No subagents / no Task tool / no delegation.** Everything inline, in the same session. Multiple
   perspectives = multiple *sections of one response*, never multiple agents. (Cost is **per request**;
   a subagent = +1 request.) See `.cursor/rules/inline-council-no-subagents.mdc` + `tech-lead-delegation.mdc`.
2. **Don't ask permission to advance between work units** (once the plan is `ACTIVE`/locked). Finishing a
   milestone/gate is the cue to **commit → deploy → update dev-log → next**, not to stop. The *only*
   stop is the genuine hand-off (all of the Definition of Done TRUE, **or** an insurmountable
   credential/cost blocker, **or** context genuinely running out). See `execution-style.mdc`.
3. **Don't narrate what you'll do — do it.** Minimize prose; every token counts in a long session.
4. **Reuse what exists — never reinvent.** Most of a clarity/feedback wave is *exposing, organizing and
   explaining* pieces that already exist. The baseline section (§4 of the doc) and root-cause map (§6)
   tell you exactly what to reuse.
5. **Code in English** (identifiers, comments, commit messages, filenames). **UI text via i18n `t()`**,
   never hardcoded; the orchestrator doc and the brain are written in the language of the request.
6. **Domain before UI**, one change at a time, **test together with the change**.
7. **Respect WSL terminal safety** (see §8): always `git --no-pager …`, always `git commit -m`, never a
   pager/editor in the agent terminal.
8. **Keep the brain in sync** (see §9): `src/dev-log.md` every milestone, `decision-log.md` on any new
   decision, `product-spec.md`/`project-status.md` at the right moments.
9. **The terminal hand-off message ends with an `AskQuestion`** (per `always-end-with-askquestion.mdc` +
   `never-end-chat.mdc`) — but only at a *genuine* stop, never mid-build.

If a **new** ambiguity appears that the brain + the doc's decisions don't resolve: **run an inline
council on the spot** (1 request, no subagents), write the synthesis as `DEC-NNN (PROPOSED)` in
`decision-log.md`, and **continue**.

---

## 2. The orchestrator DOCUMENT — canonical structure (§0–§17)

Save to `TripPilot/brain/documents/YYYY-MM-DD-<slug>-orchestrator.md`. It is the **single execution
truth** for the wave (the brain stays the truth of *product*; this doc is the truth of *execution*).
Keep the numbered sections — every wave uses the same skeleton so an executing agent always knows where
to look:

| § | Section | What it contains |
|---|---|---|
| Banner | Status + version line | `Status: ✅ ACTIVE` (or `⏳ AWAITING LOCK`), version cadence (e.g. `1.1.4-rc → 1.1.9-rc per gate`), pointer to sibling waves. |
| §0 | **Mission** | Plain-language "what this wave is and is NOT". The central pain in the user's own words. One-line reminder of what the app is. Ends with "go to §17 to start". |
| §1 | **Identity & autonomy contract** | The non-negotiables of §1 above, made concrete for this wave (who you are: the executor). |
| §2 | **Reading order** | Load context **once**: this doc §0–§9, then `dev-log.md`, then only the cited `DEC-NNN`, then the relevant `product-spec` entities, then the sibling orchestrator for tone. "Don't re-read the whole brain per milestone." |
| §3 | **Non-negotiables (ÂNCORA)** | The invariants — inherited (app-wide: money = integer cents, domain = pure TS/zero React, `t()` always, hide-never-delete, data invariance, never block expense logging…) + new ones derived from this wave. "Breaking one is a defect even if tests pass." |
| §4 | **Baseline — what already exists** | A map (confirmed by reading code) of the functions/symbols this wave will *expose/organize/explain* rather than rebuild. File → symbol, with the confirmed GAP. |
| §5 | **Change-set, normalized** | The briefing's points → `D01…Dnn` (or `E01…`, `C01…`) items, grouped by the user's priority (P0/P1/P2). Each lands in a gate. |
| §6 | **Root-cause map (code ↔ change)** | A table: symptom → root cause (**file → symbol, exact**) → direction of the fix → gate. This is the investigation result; it's what lets execution skip re-discovery. **Re-read the cited file before editing** (symbols may have moved). |
| §7 | **Decisions + inline councils** | For every conceptual/architectural question, an inline council (brief → blind voices → red team → synthesis), distilled to a `DEC-NNN`. Direct decisions (clear directives) listed without a council. |
| §8 | **Test strategy** | Domain-pure first (>90%), reuse & extend existing tests (don't duplicate), critical UI via E2E (>70%), the data-invariance check, what "the full suite green" means (incl. known baseline failures). |
| §9 | **Per-milestone protocol** | The 5-point self-check + context refresh cadence (see §6 of this skill). |
| §10 | **THE BUILD — gates G0→Gn** | The heart. One block per gate: **Why · Root cause · Change · Acceptance Criteria · Tests · Commit/Deploy + version**. G0 is always setup/baseline. |
| §11 | **Terminal safety (WSL)** | The pager + commit-bypass rules (see §8 of this skill). |
| §12 | **Definition of Done** | A checklist that is ALL TRUE only when the wave is complete (every P0/P1 item, the invariants held, suite green, build OK, deploys done, brain synced). |
| §13 | **Anti-patterns** | The specific "do NOT" list for this wave (e.g. "don't change the math to 'explain' it"). |
| §14 | **Brain sync** | Which brain files to update, when. |
| §15 | **Manual smoke matrix** | The 3-platform smoke table for the key journeys. |
| §16 | **Decisions for the user (lock)** | Open questions with the council's recommendation. `AWAITING LOCK` until the user approves; once waived/approved, the doc goes `ACTIVE`. |
| §17 | **GO — start here** | The exact first commands (G0) + the execution loop instruction. |
| Appendix | Intent→function map / state dictionary | A quick reference seed when relevant. |

---

## 3. The KICKOFF PROMPT — the GO message

A separate, self-contained prompt (saved as `…-kickoff-prompt.md`) that a fresh agent can paste/run to
execute the wave **without re-reading everything first**. It restates, tersely:

- **Role + mission** ("You are a senior full-stack engineer applying leva X end-to-end, alone, this session").
- **Source of truth** → the orchestrator doc path, and "read §0–§9 once, then execute G0→Gn in order".
- **Wave state** ("the doc is ACTIVE; the lock was waived; execute G1→Gn; G_last optional").
- **The autonomy contract** (the 9 rules, condensed).
- **The already-adopted decisions** (so the agent doesn't re-ask).
- **The non-negotiables / ÂNCORA block** (verbatim).
- **The gate order** (one line per gate + target version).
- **Terminal safety** (incl. the `G=/usr/bin/git; "$G" commit -m "…"` bypass).
- **Per-milestone protocol + the ANCHOR block to paste every 3 milestones / each gate boundary.**
- **The exact G0 commands**, then "execute G1→Gn, don't stop until the DoD is all TRUE".
- A final line: "Confirm in ONE line that you read the orchestrator and started G0 — then continue
  without waiting for a reply."

The kickoff is intentionally **redundant with the doc**: it survives context pressure and lets the wave
start cold.

---

## 4. The gate model (G0 → Gn)

Order gates by **risk and dependency**, cheapest/most-global first:

- **G0 — Setup & baseline (always).** `npm install`; run `npm run test` + `npm run build` + `tsc --noEmit`
  (+ E2E if the env supports it); **record the baseline counts**; seed/update `src/dev-log.md` (Current
  State + a milestone table for this wave); add the wave's `DEC-NNN` as `PROPOSED`; confirm the deploy
  pipeline. AC: green baseline documented, dev-log seeded, DECs recorded.
- **G1…Gn — the work.** Each gate groups a few `Dxx` items by area. Cap **5–6 milestones per gate**
  (`phase-delivery-hardening.mdc`). Each gate ends with: full suite green, `build` + `tsc --noEmit` OK,
  a 3-journey smoke, dev-log updated, **a version bump and a deploy**, and the gate's DECs promoted
  `PROPOSED → APPROVED`.
- **G_last — optional/P2.** Do it only if there's slack; otherwise record it as deferred in the dev-log.

**Close every gate cleanly** before starting the next. If context runs out mid-wave, finish the *current*
gate clean (commit + deploy + dev-log hand-off) and stop — never leave a gate half-built.

---

## 5. Inline councils (no subagents) — for any conceptual fork

When a wave has conceptual or product-architecture questions, resolve them with an **inline council**
(per `inline-council-no-subagents.mdc`), run in ONE response:

1. **Decision Brief (neutral, ≤200 words)** — the question + verified facts only; name any chat-lean as a
   bias to resist.
2. **Blind perspectives** — 2–4 roles (Strategist / Architect / Critic / Advocate by default), each
   written *as if first*, with a distinct prior, ending in a one-line Rec + Confidence + "what others miss".
3. **Red team** — kill the leading option (steelman the opposition).
4. **Chair synthesis** — consensus, tensions, the recommendation (say which lens dominates *for this
   decision* and why), conditions, what would flip it.

Distill each council to a `DEC-NNN` in the doc's §7 and in `decision-log.md`. During execution, a *new*
fork triggers a fresh inline council on the spot → `DEC-NNN (PROPOSED)` → continue.

---

## 6. Per-milestone protocol + context refresh

**Before every milestone commit (5-point self-check)** — mirrors `phase-delivery-hardening.mdc`:
1. List the satisfied Acceptance Criteria (the gate's AC IDs).
2. Name **3 earlier ACs at regression risk** and verify them (especially the data-invariance ÂNCORA and
   "never block expense logging").
3. Run the tests — **no new failures**.
4. Flag any file touched **outside** the milestone's scope.
5. Update `src/dev-log.md` (what changed, tests, risks).

**At every gate boundary:** re-read the doc's §3 (non-negotiables) + the next gate's scope + the dev-log
Current State; print the **ANCHOR block** and the **CURRENT STATE** line (gate / last commit / tests /
risks / scope). **Every 3 milestones:** a lighter refresh (critical rules + dev-log).

**The ANCHOR block** is a short, wave-specific banner of the inviolables, ending with a `CURRENT STATE`
line. Paste it every 3 milestones and at each gate boundary so the invariants survive context pressure.
(See the kickoff doc for a filled example.)

---

## 7. Testing strategy (test WITH the change)

Per `test-routing.mdc`: write and run tests **directly** (no subagents, no Task tool).
- **Domain-pure first (>90%):** the new/changed pure functions get math/logic tests with concrete values.
- **Reuse & extend** existing tests — don't duplicate.
- **Critical UI via E2E (>70%):** the key journeys (Playwright).
- **Data invariance:** if the wave is "exposure/clarity", assert the totals/balances are **identical to
  baseline** after the change.
- **"Full suite green between gates"** means 0 failures *beyond the documented baseline failures* (e.g.
  the 2 WebCrypto `split-live-loop` tests that need Node 22 and pass only in CI). Always state the known
  baseline in G0.

---

## 8. Terminal safety (WSL) — read before any git

Mirrors `.cursor/rules/terminal-pager-safety.mdc`. The agent terminal hangs forever on a pager.
- **Always `git --no-pager …`** (`log`/`diff`/`show`/`status`). **Commit always with `-m`** (HEREDOC for
  multi-line). Never `less`/`more`/`man`/`vim`/`nano`/`-i`/`rebase -i`. Pipe uncertain CLIs to `| cat`.
- **Commit bypass (confirmed on this machine):** the Shell harness injects `--trailer`, which the
  sandbox git 2.25.1 rejects (`unknown option 'trailer'`). Commit via a path that doesn't expose the
  literal `git commit`: `G=/usr/bin/git; "$G" commit -m "…"`.
- If a command hangs >30s with no output: don't re-run; read the terminal file, find the pid, kill it.

---

## 9. Brain sync

- `src/dev-log.md` — **every milestone** (Current State + an entry). Most-recent gate first; preserve
  prior waves below.
- `brain/decision-log.md` — `DEC-NNN` `PROPOSED` at G0 → `APPROVED` by the gate that ships it.
- `brain/product-spec.md` — record any new official rule/concept when its gate closes.
- `brain/project-status.md` — status / pending / next steps at the end of the wave.
- `brain/README.md` — point to the orchestrator doc when it goes `ACTIVE`.

---

## 10. Deploy pipeline (TripPilot, confirmed)

Bump `package.json` + `src/utils/app-version.ts` + `public/version.json` (+ a release note pt/en/es) →
`G=/usr/bin/git; "$G" commit -m "…"` + push `master` → **Cloudflare Pages auto-build** (`build:pages`
produces `dist/` + the OTA bundle `bundles/<v>.zip`). Verify `/version.json` + `/bundles/<v>.zip`. The
worker (`trippilot-sync`) only needs `wrangler deploy` if routes change — UI/clarity waves don't touch it.

---

## 11. AUTHORING flow — turn a briefing into an orchestrator

1. **Read the brain** (`README` → `product-spec` → `decision-log` → `technical-direction` → the sibling
   orchestrator for tone/voice).
2. **Investigate the code** for every briefing point → build the §6 root-cause map (file → symbol). This
   is the slow, high-value part: it's what makes execution fast and safe.
3. **Normalize** the briefing into `Dxx` items grouped by priority (§5).
4. **Run inline councils** for every conceptual/architectural fork (§7) → `DEC-NNN`.
5. **Define the gates** (§10) by risk/dependency, cap 5–6 milestones each, assign each `Dxx` + a version.
6. **Write §3 non-negotiables** (inherited ÂNCORA + new) and §12 Definition of Done.
7. **Add DECs to `decision-log.md`** as `PROPOSED`. Set the doc banner `ACTIVE` (or `AWAITING LOCK` if
   there are conceptual questions the user must lock — then list them in §16).
8. **Write the kickoff prompt** (§3 of this skill).
9. Tell the user it's ready, and whether it needs a §16 lock before G3+.

---

## 12. EXECUTION flow — build an ACTIVE orchestrator end-to-end

1. **Confirm the state first (critical):** check `git log`, the current version, the dev-log, and whether
   the wave's files already exist. **Never re-run a completed wave.** If the dev-log/commits show the wave
   is done, say so with evidence and stop — don't redo shipped work.
2. Read the doc §0–§9 once; read the dev-log; read only the cited DECs.
3. **G0:** install, baseline, seed dev-log, confirm DECs PROPOSED + pipeline. Record baseline counts.
4. **For each gate G1→Gn:** before editing, **re-read the §6 file** for that item; make the domain change
   + tests; make the UI change + E2E; run the 5-point self-check; commit per item; at gate end run the
   full suite + build + tsc + smoke, bump version, deploy, promote DECs to APPROVED, update dev-log,
   print the ANCHOR + CURRENT STATE, refresh.
5. **Don't stop** until the Definition of Done is all TRUE — or context runs out (close the current gate
   clean + hand off in the dev-log) — or an insurmountable blocker. Only then end with an `AskQuestion`.

---

## 13. Right-sizing & the speed/cost trade-off

Julio's note: *"great for deployments, a bit slow but delivers well."* The slowness is the upfront
investigation + the per-gate discipline. Tune **depth**, not structure:

- **Small wave (≤3 items, low risk):** keep §6 (root-cause map), §10 (gates), §12 (DoD); collapse the
  rest. One or two gates. Councils only if there's a real fork.
- **Medium wave:** the full doc, 3–5 gates.
- **Large/architectural wave:** the full doc + §16 lock before the risky gates; more councils.
- **Always keep, regardless of size:** G0 baseline, the root-cause map, test-with-the-change, the
  5-point self-check, terminal safety, deploy-per-gate, and brain sync. These are what make it "deliver
  well"; cutting them is what turns fast into broken.
- **Cost reality:** one continuous session = fewer requests than restarting; per-gate deploys mean value
  ships even if the session ends early. The investigation cost is paid once and amortized across the wave.

---

## 14. Anti-patterns

- ❌ Re-running or "restarting" a wave that the dev-log/commits show is already shipped.
- ❌ Subagents / Task tool / delegation. ❌ `git` without `--no-pager`. ❌ A pager/editor in the terminal.
- ❌ Coding a gate that depends on an unresolved §16 lock.
- ❌ Skipping G0 baseline (you lose the regression reference).
- ❌ Editing a §6 file without re-reading it first (symbols move).
- ❌ Changing math/totals in an "exposure/clarity" wave (data-invariance ÂNCORA).
- ❌ Deleting any action/feature (hide-never-delete ÂNCORA).
- ❌ Hardcoded UI text (use `t()`), or non-English code.
- ❌ Stopping mid-build (after lock) before the DoD is all TRUE.

---

## 15. Quick reference — what to produce

- **Authoring** → `brain/documents/YYYY-MM-DD-<slug>-orchestrator.md` (§0–§17) + `…-kickoff-prompt.md` +
  `DEC-NNN (PROPOSED)` in `decision-log.md`.
- **Executing** → shipped code + extended tests + green suite + per-gate deploys + DECs `APPROVED` +
  `dev-log.md` updated + `product-spec`/`project-status` synced.
