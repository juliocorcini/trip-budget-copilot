# TripPilot Brain — Source of Truth

> Last updated: 2026-06-17 (device-test force-task plan added)

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
| `decision-log.md` | All decisions DEC-001..DEC-211 with status (approved/pending/superseded); see the DEC-185–199/201 native-arc reconciliation note | Before making new decisions |
| `technical-direction.md` | Stack (locked), database, architecture, deployment | Any technical question |
| `implementation-phases.md` | D1–D6 deliveries + the round-based work that followed (R1–R6, field reviews, expansion packages 1–3, native arc, receipt & shared-link epics) | Planning, scheduling |
| `project-status.md` | Current status, pending tasks, next steps | Status checks, standups |
| `competitive-landscape.md` | TravelSpend analysis, feature gap matrix, positioning | Marketing, positioning |
| `meetings-log.md` | Chronological log of meetings, decisions, action items | History, accountability |
| `documents/` | Plans, specs, audits & epic delivery reports (incl. `master-fix-and-skipped-features-plan-2026-06-17.md` — the active fix/backlog plan) | Execution, backlog |
| `../src/dev-log.md` | Live gate-by-gate execution log (native arc, rounds, epics) | What shipped, when |
| `research/` | Research outputs and raw source material | Deep dives on specific topics |

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
