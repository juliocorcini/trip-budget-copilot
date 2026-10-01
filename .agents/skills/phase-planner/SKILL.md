---
name: app-phase-planner
description: >-
  Break any Febracorp app into prioritized implementation phases with V1/V2 cut lines,
  AI execution guides, and transition criteria. Reusable across all apps.
  Use when the user asks: separate em fases, defina as fases, phase planning,
  implementation order, what to build first, V1 vs V2 phasing, break into phases,
  priorize implementation, quebre em blocos, ordem de implementação, o que fazer primeiro.
---

# App Phase Planner — Reusable Implementation Phasing Framework

## Overview

This framework breaks any Febracorp app into **prioritized implementation phases** that:
- Order work by importance (most critical first, most deferrable last)
- Define clear V1/V2 cut lines
- Produce AI execution briefs for each phase
- Support an AI-first development workflow (AI codes ~80%, dev manages and reviews)
- Can be reused for Events, Streaming, Learn, Community, or any future app

## When to Use

- Starting a new app implementation from use cases + spec
- Re-evaluating phase priorities mid-development
- Deciding what to cut from V1 when time runs out
- Transitioning between development phases
- Preparing execution briefs for the dev + AI workflow

---

## Required Inputs

Before running the phase planner, gather these from the app's brain folder:

| Input | Where to find | Purpose |
|-------|---------------|---------|
| Use cases | `{App}/brain/documents/*-use-cases*.md` | Complete list of what to build |
| Product spec | `{App}/brain/*-product-spec.md` | V1 scope, rules, locked decisions |
| Decision log | `{App}/brain/decision-log.md` | What's approved, pending, superseded |
| Technical direction | `{App}/brain/technical-direction.md` | Stack, DB, auth, deploy |
| Team & process | `{App}/brain/team-and-process.md` | Capacity, timeline, methodology |
| Competitive landscape | `{App}/brain/competitive-landscape.md` | What competitors have vs. don't |
| Marketing insights | `{App}/brain/marketing-insights.md` | Differentiators, personas, priorities |

---

## Phase Scoring Methodology

Score every feature group across 5 dimensions. Weighted total determines phase placement.

### Dimension 1: Dependency Depth (Weight: 30%)

How many other features depend on this being done first?

| Score | Meaning | Examples |
|-------|---------|---------|
| 5 | Foundation — everything depends on this | Auth, DB schema, core entity CRUD |
| 4 | Core flow — most features need this | Registration, public pages, email infra |
| 3 | Revenue path — monetization needs this | Payments, billing, plan limits |
| 2 | Enrichment — adds value to existing | Analytics, notifications, export |
| 1 | Polish — standalone, few dependents | Profile, optimization, advanced UX |

### Dimension 2: Business Value (Weight: 25%)

How much business value does this deliver?

| Score | Meaning | Examples |
|-------|---------|---------|
| 5 | Enables revenue directly | Payments, checkout, subscriptions |
| 4 | Core value proposition (why users buy) | Event pages, registration, agendas |
| 3 | Competitive differentiator (unique to us) | GoBrunch integration, replay/materials |
| 2 | Expected feature (users assume it exists) | Search, filters, email confirmations |
| 1 | Nice to have (not a purchase driver) | Sharing button, organizer profile |

### Dimension 3: Competitive Differentiation (Weight: 20%)

How much does this set us apart from competitors?

| Score | Meaning | Examples |
|-------|---------|---------|
| 5 | Only we have this | GoBrunch native integration |
| 4 | We do it significantly better | LTD pricing, replay per event |
| 3 | Competitive parity (must-have to not lose) | Public pages, calendar, embed |
| 2 | Competitor does it too (catching up) | Paid events, newsletter |
| 1 | Not a competitive factor | Internal admin tools |

### Dimension 4: Implementation Risk (Weight: 15%)

How risky is the implementation? **INVERTED: high score = low risk = build earlier.**

| Score | Meaning | Examples |
|-------|---------|---------|
| 5 | Low risk — CRUD, boilerplate, well-understood | Event CRUD, basic pages |
| 4 | Moderate — some integration, known patterns | Email sending, file upload |
| 3 | Medium — new integration, some unknowns | GoBrunch API, embed system |
| 2 | High — complex integration, many edge cases | Stripe Connect, recurrence |
| 1 | Very high — novel, external deps, complex state | Real-time features, multi-provider |

### Dimension 5: V2 Separability (Weight: 10%)

How cleanly can this be deferred to V2 without rework?

| Score | Meaning | Examples |
|-------|---------|---------|
| 5 | Cannot defer — product doesn't work without it | Auth, event creation |
| 4 | Very hard to defer — breaks core promise | Registration, public pages |
| 3 | Can defer with caveats — product works but limited | Analytics, notifications |
| 2 | Easy to defer — add later, no rework needed | Profile, advanced export |
| 1 | Should defer — premature for V1 | White-label, tracks, mobile |

### Scoring Formula

```
Phase Score = (Dependency × 0.30) + (Business × 0.25) + (Differentiation × 0.20) + (Risk_inverted × 0.15) + (Separability × 0.10)
```

Group features by score range into phases:
- Score 4.0-5.0 → Phase 1 (Foundation)
- Score 3.5-4.0 → Phase 2 (Revenue / Core Value)
- Score 3.0-3.5 → Phase 3 (Differentiators)
- Score 2.5-3.0 → Phase 4 (Product Completeness)
- Score 2.0-2.5 → Phase 5 (Engagement / Should-ship)
- Score < 2.0 → Phase 6 (V2 Buffer)

---

## Phase Ordering Rules

These rules override pure scoring when conflicts arise:

1. **Foundation always first**: Auth, DB, core entities, basic UI shell — no exceptions
2. **Revenue before features**: Payment/billing infrastructure before differentiating features
3. **Differentiators before parity**: What makes us unique before what competitors also have
4. **Compliance is NOT polish**: GDPR (unsubscribe), abuse protection, rate limiting are architecture concerns — bake into Phase 1 infrastructure, not Phase 6 polish
5. **Cut from the bottom**: When time runs out, cut from the last phase first, item by item
6. **Each phase must be testable**: After completing a phase, the product should be usable (even if incomplete)
7. **DB schema upfront, behavior incremental**: Design the full schema in Phase 1; add behavior in later phases

---

## Phase Priority Tiers

Every phase gets a tier that defines its relationship to V1 launch:

| Tier | Label | Meaning |
|------|-------|---------|
| **T1** | MUST SHIP | Product cannot launch without this. No exceptions. |
| **T2** | SHOULD SHIP | Makes the product competitive and complete. Ship if time allows. |
| **T3** | V2 BUFFER | Valuable but deferrable. First to move to V2 when timeline is tight. |

### V1/V2 Cut Line

The cut line sits **between T2 and T3**. Everything in T3 is explicitly "V2 if we run out of time."

Within each tier, items are ordered by score (highest first). When cutting, remove from the bottom of T3 upward.

---

## Phase Definition Template

Use this structure for each phase in the app's `implementation-phases.md`:

```markdown
## Phase N: [Name]

**Tier**: MUST SHIP / SHOULD SHIP / V2 BUFFER
**Timeline**: Weeks X-Y (~Nh estimated)
**Risk Level**: ON TRACK / TIGHT / AT RISK
**Objective**: One sentence — what the user can do after this phase is complete

### Use Cases

| UC# | Title | Actor | Priority |
|-----|-------|-------|----------|
| UC-XX | Title | Actor | MUST / SHOULD / MAY |

### Key Entities & Models
- Entity1, Entity2, ...

### API Endpoints (estimated)
- POST /api/resource — create
- GET /api/resource/:id — read
- ...

### Frontend Pages / Components
- /page-route — Page description
- Component — Component description

### Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

### Technical Notes & Risks
- Architecture decisions specific to this phase
- Integration points to watch
- Known risk areas

### V2 Fallback
If this phase doesn't complete fully:
- Items that can safely defer (with impact description)
- Minimum viable slice that must ship

### AI Execution Brief
> [Context block that Luiz copies into AI to start this phase]
> Includes: what exists from previous phases, what to build, key constraints, testing requirements
```

---

## Council Integration

For critical phasing decisions, use the council skill:

| Decision type | Council mode | When |
|---------------|-------------|------|
| Phase ordering disputes | `/council` | Multiple valid orderings with trade-offs |
| "Should X be V1 or V2?" | `/debate` | Binary decision on scope |
| Timeline risk evaluation | `/assess` | Checking if plan is realistic |
| Phase content review | `/review` | Reviewing a completed phase plan |
| Creative solutions for cuts | `/brainstorm` | Finding ways to simplify scope |

---

## AI-First Execution Workflow

This framework assumes AI does ~80% of coding. The developer manages, reviews, and tests.

### Phase Lifecycle

```
PLAN → BRIEF → BUILD → REVIEW → TEST → TRANSITION
```

1. **PLAN**: Read the phase from `implementation-phases.md`
2. **BRIEF**: Give AI the phase's AI Execution Brief + relevant brain files
3. **BUILD**: AI implements feature by feature; dev reviews each output
4. **REVIEW**: Dev checks code quality, edge cases, spec compliance
5. **TEST**: Dev tests critical paths manually; AI generates automated tests
6. **TRANSITION**: Check acceptance criteria → mark phase complete → prepare next brief

### Phase Transition Criteria

A phase is "done" when:
- [ ] All MUST items are implemented and tested
- [ ] SHOULD items are either done or consciously deferred with rationale
- [ ] No blocking bugs in the phase's scope
- [ ] Integration with previous phases verified
- [ ] Brain files updated (project-status.md at minimum)
- [ ] Next phase brief is ready

### Prompt Strategy for AI

See the app-specific `ai-execution-guide.md` for detailed prompt templates. General principles:

1. **Give full context at phase start**: product spec excerpt, entities, previous phase state
2. **One feature at a time**: Don't ask AI to build an entire phase in one prompt
3. **Backend before frontend**: API + DB first, then React components
4. **Test alongside build**: Ask AI to generate tests with each feature
5. **Review before proceeding**: Don't start the next feature until current one is reviewed

---

## Generating a Phase Plan for a New App

### Step-by-step

1. Read all brain files for the app
2. List all use cases from the use cases document
3. Group use cases into logical clusters (auth, core entity, revenue, etc.)
4. Score each cluster using the 5-dimension methodology
5. Assign clusters to phases based on score ranges
6. Apply ordering rules to resolve conflicts
7. Assign priority tiers (T1/T2/T3)
8. Define acceptance criteria per phase
9. Write AI execution briefs per phase
10. Run `/assess` council to validate timeline realism
11. Save to `{App}/brain/implementation-phases.md`
12. Create `{App}/brain/ai-execution-guide.md` with prompt templates
13. Update `{App}/brain/README.md` with references to new files

### Output Files

| File | Location | Purpose |
|------|----------|---------|
| Implementation phases | `{App}/brain/implementation-phases.md` | The phase plan with all details |
| AI execution guide | `{App}/brain/ai-execution-guide.md` | How the dev works with AI per phase |
| Updated README | `{App}/brain/README.md` | References to new files |
| Updated project status | `{App}/brain/project-status.md` | Phase tracking |

---

## Maintenance

### When phases change
1. Update `{App}/brain/implementation-phases.md`
2. If V1/V2 scope changed, update decision-log.md
3. Update project-status.md with new phase tracking
4. Re-generate AI execution briefs for affected phases

### When a phase completes
1. Mark all acceptance criteria as checked
2. Update project-status.md
3. Log any scope changes in decision-log.md
4. Prepare the next phase's AI brief with current state

### When scope is cut
1. Move items from current tier to T3 (V2 BUFFER)
2. Document the cut decision in decision-log.md
3. Update implementation-phases.md
4. Notify stakeholders via next checkpoint
