# TripPilot Brain — Source of Truth

> Last updated: 2026-06-25 (**Implementation-orchestrator process standard** — DEC-334; method codified in `.cursor/skills/implementation-orchestrator/SKILL.md` (`/orchestrator`); see "How we implement" below. Prior 2026-06-22: **Field Feedback master plan** — `documents/field-feedback-master-plan-and-councils-2026-06-22.md` (v2) + **DEC-256→278** recorded in `decision-log.md` (direction approved/ratified by Julio; implementation pending): converter+AI FX intent, capture stitching, AI-receipt field parity, inline add-participant, FAB↔back, cofrinho-as-buffer, carousel=1-occasion, outing trim+discard, Amigo Sincero phrase bank+voices, location default ON (ÂNCORA 8 amendment), auto device name, event-delete-asks, admin tokens/fn + Groq governance + 00000000 investigation + PWA telemetry + errors-in-detail + centered modal, release-notes/guide refresh, planner-no-write, single image chooser, graceful AI degradation, record repayment, in-app AI help V1. Prior 2026-06-21: DEC-248→255 Admin v1/v2 + multi-trip + Dia a dia + new icon. See the dated sections below)

## Truth Policy

1. This folder is the **single source of truth** for all product decisions about TripPilot
2. If something is not documented here, it has NOT been decided
3. AI agents MUST read relevant brain files before answering product questions
4. Contradictions between brain files must be flagged, not silently resolved
5. All updates must include `> Last updated: YYYY-MM-DD` at the top

## File Index

| File | Purpose | When to read |
|------|---------|--------------|
| `product-spec.md` | V1 features, rules, scope boundaries | Any product question |
| `decision-log.md` | All decisions DEC-001..DEC-279 with status (approved/pending/superseded); see the DEC-185–199/201 native-arc reconciliation note. Latest: DEC-256→279 = Field Feedback batch (2026-06-22; direction approved/ratified, implementation pending; DEC-279 cofrinho-legibility is PROPOSED, Model A vs B pending Julio). Next new id = DEC-280 | Before making new decisions |
| `technical-direction.md` | Stack (locked), database, architecture, deployment | Any technical question |
| `implementation-phases.md` | D1–D6 deliveries + the round-based work that followed (R1–R6, field reviews, expansion packages 1–3, native arc, receipt & shared-link epics) | Planning, scheduling |
| `project-status.md` | Current status, pending tasks, next steps | Status checks, standups |
| `competitive-landscape.md` | TravelSpend analysis, feature gap matrix, positioning | Marketing, positioning |
| `meetings-log.md` | Chronological log of meetings, decisions, action items | History, accountability |
| `documents/` | Plans, specs, audits & epic delivery reports (incl. `master-fix-and-skipped-features-plan-2026-06-17.md` — the active fix/backlog plan) | Execution, backlog |
| `../src/dev-log.md` | Live gate-by-gate execution log (native arc, rounds, epics) | What shipped, when |
| `research/` | Research outputs and raw source material | Deep dives on specific topics |

### How we implement (process standard — DEC-334)

Changes to the live app ship as a **"leva" (wave)** run by the **implementation-orchestrator** method:
an **orchestrator document** (the single execution truth) + a **kickoff prompt**, executed **end-to-end,
inline, in ONE session, no subagents**, one milestone at a time, testing with the change and deploying
per gate. This is the STANDARD — see `DEC-334`.

| Artifact | Where | When to read |
|------|---------|--------------|
| Method (how to author + execute a wave) | `.cursor/skills/implementation-orchestrator/SKILL.md` (`/orchestrator`) | Before authoring or executing any wave |
| Canonical examples | `documents/2026-06-24-coherence-implementation-orchestrator.md`, `documents/2026-06-25-discovery-clarity-implementation-orchestrator.md`, `documents/2026-06-25-field-fixes-clarity-2-orchestrator.md` (+ `…-kickoff-prompt.md`) | To copy the §0–§17 structure / tone |
| Live execution log | `../src/dev-log.md` | Current wave state, what shipped per gate |

### Budget-Model Reform (2026-06-17) — canonical mental model

| File | Purpose | When to read |
|------|---------|--------------|
| `documents/budget-model-master-decision-2026-06-17.md` | **DECISION TRUTH** — canonical model (Trecho/Pote/Evento/Compra planejada), the 2-axis Event×Pote map, 19 consolidated decisions, sub-trecho V2, proposed DEC-2xx | Before touching budget/phase/pot/event model |
| `documents/budget-model-implementation-prompt-2026-06-17.md` | START-HERE implementation plan: 6 deployable gates, tests, migration safety, deploy checkpoints (direct execution) | When implementing the reform |
| `documents/budget-mental-model-study-2026-06-17.md` | Part I — diagnosis + Trecho/Pote model derivation | Deep dive on the "why" |
| `documents/budget-mental-model-study-part2-2026-06-17.md` | Part II — pots, wallet, overlapping phases, onboarding councils | Deep dive on the "why" |

### UX Clarity Audit (2026-06-17) — feeds Packages #2+

| File | Purpose | When to read |
|------|---------|--------------|
| `documents/ux-clarity-audit-2026-06-17.md` | App-wide clarity diagnosis (FAB redesign + every area, scored, with prioritized backlog). **Separate from Package #1** — source for future implementation Packages #2, #3… | Before planning post-budget UX work (FAB, capture friction, Copilot, etc.) |

### Device Test Force-Task (2026-06-17) — v0.50→v0.70 mobile QA

| File | Purpose | When to read |
|------|---------|--------------|
| `documents/device-test-plan-v50-v70-2026-06-17.md` | The B18 device test script (blocks A–N) Julio followed on Android + iPhone | Re-running device QA |
| `documents/device-test-results-2026-06-17.md` | **EVIDENCE** — per-block PASS/FAIL/improvement/decision map from Julio's session (raw findings) | Tracing a bug to its observation |
| `documents/device-test-fixes-masterplan-2026-06-17.md` | **ACTIVE FIX PLAN** — root cause + surgical plan for 20 bugs / 7 improvements / 5 decisions, organized in 5 waves with hardening gates (D-BUG-01…20, D-IMP-01…07, D-DEC-A…E) | Executing the device-bug force-task |

### Bill-Split "passa a nota" (2026-06-18) — feature brainstorm + council ranking (PROPOSAL, not yet decided)

| File | Purpose | When to read |
|------|---------|--------------|
| `documents/bill-split-feature-brainstorm-and-council-2026-06-18.md` | **BRAINSTORM RECORD (history)** — full brainstorm + 5 inline councils + 5-persona test + competitive analysis + ranking for the fast table-split idea. **Superseded for decisions** by the implementation-support doc (see banner at top). | Deep dive on rationale/personas/competition |
| `documents/debt-and-split-ux-deep-dive-and-plan-2026-06-19.md` | **BUILD-READY (DEC-241)** — deep dive on the debt / "está me devendo" feature (`domain/splitting`, `/shared`) + bill-split. Root cause = the DEC-071 confirmation asymmetry (owner-authored shares for offline friends stay `pending` → "alguém me deve" invisible). 4 inline councils → gates G1 (born-confirmed for non-connected, v0.99.5), G2 ("Acerto de contas" hub redesign, v0.99.6), G3 (Lembrar/Cobrar + polish, v0.99.7). | Before touching the debt/settle/split-debt UX |
| `documents/open-decisions-councils-and-future-plan-2026-06-19.md` | **RESEARCH + DECISION-READY (DEC-242)** — inline councils + future-apply gates for the three non-forced open decisions: OD-1 `/viagem` Hub × `/trip` Overview (keep two / sharpen, don't merge), OD-2 Fundo→Trecho/Pote (nature-aware pass, not blanket), OD-3 Wise split explainer (mount existing component). All web/OTA, deferred to dedicated gates. | Before touching trip-surface IA, funds vocab, or the Wise importer |
| `documents/apk-ota-self-update-study-2026-06-19.md` | **STUDY (DEC-243)** — how TripPilot updates: web bundle OTA (Capgo, silent) + native APK in-app installer (DEC-210, one-tap, user-confirmed). Why the Downloads detour persists (device-pending shell not promoted). Android can't silently install sideloaded APKs. Future-apply: promote a verified shell via `latestNativeVersion` (OTA-1), optional Settings "check for update" button (OTA-2). | Before touching the update/version flow or promoting an APK |
| `documents/improvement-backlog-ranked-2026-06-19.md` | **RANKED BACKLOG (DEC-245)** — every researched-but-unbuilt, still-valid improvement, cross-checked against DEC-212..244 and scored (ease × value × fit × gain). Five buckets: A do-today (OD-3, receipt consent, simulator avulso, Wise atalho, OTA-2), B needs-your-decision (OD-2, OD-1), C bigger/delight (Wrapped, auto-Outing), D device-blocked (OTA-1, native batch, biometric, B18), E deferred-by-design. | Planning the next improvement round / "what's still worth doing" |
| `documents/bill-split-implementation-support-2026-06-18.md` | **BUILD-READY SPEC** — "Dividir conta" feature. Julio's LOCKED decisions T1–T13 (not ephemeral → persists as ONE divided expense w/ items + debts + budget; feature=`Dividir conta` in FAB; proportional service charge w/ AI detect→infer→ask; **live claim in V1**; **two-way live mirror propagation** owner-authoritative DEC-106; **state-dependent guest landing**; ad-hoc+promote; Pix→future payment-info feature §16). + 3 new inline councils (real-time input/sync, persistence/propagation, naming). + architecture (owner-as-reducer on existing `ShareSignal`+`/responses`+KV, **no new Worker routes**), domain model, sync protocol, gates G1–G3 (~70h Tier 3) + ACs + tests. Delivery QUEUED (Julio implements later via `/deliver`); only 3 minor technical decisions left open (§19). | Before scoping/implementing the bill-split epic; this is the truth for decisions |

### AI Quick Entry — natural-language router (text + voice) → ALL app functions (2026-06-20) — ✅ SHIPPED + LIVE (DEC-246, v0.99.12; apex + Worker deployed, `/assistant` probed 200)

| File | Purpose | When to read |
|------|---------|--------------|
| `documents/ai-quick-entry-natural-language-router-plan-2026-06-20.md` | **✅ SHIPPED + LIVE (DEC-246, v0.99.12 — apex + Worker deployed, `/assistant` probed 200)** — Julio's field ask: one box where you **type or speak** ("o Bruno me pagou uma cerveja de 2 euros") and the AI decides which function to run + fills the details, connecting **all** app functions to AI. Core architecture: **AI = planner** (Groq JSON mode via a new Worker `/assistant`, mirroring `/ocr`; returns a typed `AiIntent` with entities **by name**, never ids, never math) + **device = executor** (pure `resolve` name→id + `dispatch` to the EXISTING orchestrators; engines do the math; debt born-confirmed via DEC-241). Text-first (G0), voice next (G2 = Web Speech + Groq Whisper `/transcribe`, native-safe). Preview+confirm+undo always; opt-in `aiQuickEntryEnabled` + names-only context + no-names mode (privacy like `cloudReceiptOcrEnabled`). 5 inline councils (council/debate text×voice/review/assess/brainstorm). Intent registry §4, gates G0–G3 + ACs + tests, Groq capability verifications §16. | Before scoping/implementing the AI quick-entry feature; this is the rationale + plan |

### Field Feedback master plan + councils (2026-06-22) — DEC-256→278 (PROPOSAL/PLAN, direction approved, implementation pending)

| File | Purpose | When to read |
|------|---------|--------------|
| `documents/field-feedback-master-plan-and-councils-2026-06-22.md` | **BUILD-READY PLAN (v2)** — Julio's large 2026-06-22 field-feedback batch (FB-01…FB-28 + CC-IMG). §1 verified code baseline (what already ships — don't rebuild), §2 fourteen inline councils (C1–C14) on the strategic items (C14 = cofrinho legibility/ledger), §3 per-item specs (root cause + ACs + tests + anti-regression + effort), §4 nine sequenced hardening gates, §5 ratification state + DEC-256…279. Key decisions: converter+AI FX intent (DEC-256), capture stitching no-wizard (DEC-257), AI-receipt field parity (DEC-258), inline add-participant (DEC-259), FAB↔back (DEC-260), **cofrinho-as-buffer** (DEC-261, ÂNCORA-11 amendment — needs a math mini-spec), carousel=1-occasion (DEC-262), outing trim+discard (DEC-263), Amigo Sincero phrase bank+voices+reveal (DEC-264), **location default ON** (DEC-265, ÂNCORA-8 amendment), auto device name (DEC-266), event-delete-asks-about-expenses (DEC-267), admin tokens/fn (DEC-268) + **Groq governance server-side** (DEC-269) + 00000000 investigate-first (DEC-270) + PWA/browser telemetry (DEC-271) + errors-in-detail/centered modal (DEC-272), release-notes/guide refresh (DEC-273), planner-no-write guards (DEC-274), **single image chooser** (DEC-275), **graceful AI degradation** (DEC-276), **record repayment** (DEC-277), **in-app AI help V1 comprehensive** (DEC-278), **cofrinho legibility — voice + statement/ledger + movement insight** (DEC-279/C14, Model A vs B pending Julio). Verified facts: Groq has vision but no web browsing; 429 exposes `retry-after`/`x-ratelimit-reset-*`; YNAB "Roll With the Punches" + rollover apps (FreeBudget/FinWise) validate the cofrinho buffer/ledger. | Before implementing any item from the 2026-06-22 field feedback; this is the rationale + plan + gates |

### UX Audit Round 2 + Cost-Benefit Comparator (2026-06-22)

| File | Purpose | When to read |
|------|---------|--------------|
| `documents/ux-audit-round2-2026-06-22.md` | **DIAGNÓSTICO (Round 2, no code changes)** — full-app UX audit with **measured evidence**: live Playwright screenshots (15 screens), pixel-accurate contrast per token (dark theme), tap-target sizes, and the systemic keyboard-focus gap (`focus:outline-none` ×37, zero `focus-visible`). Includes Nielsen scores (**31/40 "Good"**), cognitive-load checklist, persona walkthroughs (Jordan/Casey/Sam), an **inline strategic council** (density vs richness → "clarity, not amputation"), and a prioritized roadmap in 3 packages: **UX-A Legibility & A11y** (focus-visible, contrast tokens, aria-current, tokenize the AI accent), **UX-B First-Minute** (dashboard banners, 1 primary action, FAB hierarchy, concept onboarding), **UX-C per-area**. Continues `ux-clarity-audit-2026-06-17.md` (Round 1). | Before planning the next UX/a11y package |
| `documents/cost-benefit-comparator-council-2026-06-22.md` | **DECISION (DEC-283)** — council that approved the cost-benefit unit-price comparator; V1 = lean, deterministic, currency-agnostic (text/voice + manual), modeled on the currency converter. Shipped in **0.99.49**. | Before touching the comparator |
| `documents/comparator-v2-multi-image-plan-2026-06-22.md` | **PLAN → ✅ IMPLEMENTED (DEC-284, 0.99.50)** — Comparator **V2: multi-image photo** (camera 1×/gallery N → extract price/qty/unit/label per photo **in parallel** → pre-fill `ComparatorPage` → user **confirms** via amber "confira" before verdict). New Worker `/unit-extract` (reuses DEC-206 vision) + `domain/shopping/unit-extract.ts` (+12 tests) + `utils/ai-unit-extract.ts`. Same request also reorganized the FAB (comparator → "Mais ações"; "Registrar mercado" promoted). | Before touching the comparator photo path |
| `documents/ui-ux-change-checklist-2026-06-23.md` | **DECISION CHECKLIST (no code)** — consolidates **every actionable UI/UX change** from the round-2 audit + the experience study into **25 items (M01–M25)**, deduped. Each has a markable decision (`FAZER / NÃO / DEPOIS`), the **why**, the **user impact**, plus priority/effort/risk and traceable origin. Grouped P1→P2→P3, with a priority panel, a "do-not-touch" guard, and questions that change priority. **This is the master list Julio marks to scope the next UX packages.** | When deciding/scoping any UI/UX work |
| `documents/ux-ui-experience-study-2026-06-22.md` | **STUDY (no code)** — deep experience study across **5 lenses** (user/JTBD, flow, sensation/emotion, intuition, need). Maps the 3 jobs (decide-if-I-can-spend / capture-fast / plan-&-split), mental-model gap (simple "how much is left?" vs phases/pots/modes), an **emotional curve** (relief vs anxiety), end-to-end **flow friction maps**, **intuition/first-click** gaps (mute "+", invisible mode, buried Simulador), a **north-star** ("one hand, 3s, no anxiety" · "number + why" · "honest & warm"), a problems catalog (P×I), an **inline council** (translate/sequence before adding), 5 experience packages (EXP-1 Anchor-Question, EXP-2 Human vocabulary, EXP-3 Trust points, EXP-4 The proud ending, EXP-5 Visible resilience), and cheap validation. Complements (does not repeat) the round-2 a11y audit. | Before planning UX/experience/clarity work |

## Research Files

| File | Topic |
|------|-------|
| `research/base.txt` | Raw product definition conversation (source material) |
| `research/2026-06-08-product-definition-session.md` | Structured summary of all findings and decisions |

## How to Update

1. Read the existing file first
2. Make the update
3. Update the `> Last updated` date
4. If it's a decision, add it to `decision-log.md`
5. If it contradicts an existing entry, mark the old one as `SUPERSEDED` with a reference

## Naming Conventions

- Files: `kebab-case.md`
- Research: `research/YYYY-MM-DD-topic-name.md`
- Decisions: `DEC-NNN` format in decision-log.md
- Meetings: `MTG-YYYY-MM-DD` format in meetings-log.md
