---
name: app-diagram-architect
description: >-
  Create, review, and verify use case diagrams and class diagrams for any Febracorp app.
  Reads the brain deeply, generates comprehensive UC lists, reviews .mmd files from developers,
  runs multi-pass verification, tracks connections between UCs, and audits completeness.
  Use when the user asks: /diagrams, /diagramas, /usecases, /casos, /classes,
  gere os use cases, revise os diagramas, verifique os use cases, audite os diagramas,
  crie a lista de use cases, review diagrams, generate use cases, verify class diagram,
  audit completeness, check diagram connections, verifique se falta algo,
  mande pro Luiz os use cases, o que falta nos diagramas, revise os .mmd,
  or any request involving use case creation, class diagram review, or diagram verification.
---

# App Diagram Architect — Use Cases & Class Diagrams

## Overview

This skill manages the full lifecycle of use case diagrams and class diagrams for any Febracorp app: from readiness assessment through generation, iterative review with the developer, and final completeness audit.

The skill is designed around one principle: **the brain is the source of truth, and every diagram artifact must be traceable back to it.** Nothing should exist in a diagram that contradicts the brain, and nothing in the brain should be missing from the diagrams.

**Artifact types managed:**
- **Use Case List** — numbered UC table with actors, rules, and groupings (markdown for developer)
- **Use Case Activity Diagrams** — .mmd files with activity flows per UC (developer creates, we review)
- **Class Diagram** — .mmd file with entities, services, relationships (developer creates, we review)

---

## Modes

| Command | Aliases | What it does |
|---------|---------|-------------|
| `/diagrams readiness [app]` | `/diagramas prontidao` | Check if the brain has enough info to generate diagrams |
| `/diagrams generate [app]` | `/diagramas gere`, `/usecases [app]` | Generate the complete UC list + class entity spec from brain |
| `/diagrams review [app]` | `/diagramas revise`, `/casos revise` | Multi-pass review of .mmd files against brain |
| `/diagrams audit [app]` | `/diagramas audite`, `/casos audite` | Deep completeness audit — final check before delivery |

**Default app:** Events (if no app specified and Events brain exists).

---

## Mode 1: READINESS — Brain Completeness Gate

### Purpose

Before generating any use case list or class diagram, verify the brain has enough information. If it doesn't, list exactly what's missing so the Product Lead can fill the gaps.

### Required Brain Files (GO/NO-GO)

| File | What we need from it | Required? |
|------|---------------------|-----------|
| `{app}-product-spec.md` | Features, rules, scope, out-of-scope | MUST |
| `decision-log.md` | Approved decisions, rejected items | MUST |
| `pricing-and-plans.md` | Tiers, limits, feature-per-plan matrix | MUST |
| `technical-direction.md` | Stack, auth, integrations, DB | MUST |
| `implementation-phases.md` | Phases with UCs, entities, priorities | SHOULD |
| `team-and-process.md` | Roles, timeline | NICE |
| `competitive-landscape.md` | Competitor features (for gap awareness) | NICE |
| `marketing-insights.md` | Personas, dealbreakers | NICE |

### Readiness Check Process

1. **Verify file existence** — glob for each required file in `{App}/brain/`
2. **Verify file substance** — read each MUST file; check it has actual content (not just headers)
3. **Verify feature coverage** — scan product-spec for these critical sections:
   - Event/entity model defined with fields
   - Auth approach defined
   - Scope boundaries (what's IN, what's OUT)
   - Plan-tiered features with limits
   - Email types and rules
   - Integration points (payments, rooms, storage)
4. **Verify decision completeness** — scan decision-log for BLOQUEANTE items still pending
5. **Generate Readiness Report**

### Readiness Report Format

```markdown
## Readiness Report: [App] Diagrams

### Status: [GO / NO-GO / CONDITIONAL GO]

### Brain Files
| File | Status | Notes |
|------|--------|-------|
| ... | PRESENT / MISSING / INCOMPLETE | ... |

### Feature Coverage
| Area | Status | Gap |
|------|--------|-----|
| Entity model | COMPLETE / PARTIAL / MISSING | [what's missing] |
| Auth | ... | ... |
| Scope boundaries | ... | ... |
| Plan limits | ... | ... |
| Emails | ... | ... |
| Integrations | ... | ... |

### Blocking Decisions
[List any BLOQUEANTE items from decision-log that are still PENDING]

### Recommendation
[GO: proceed with generation]
[NO-GO: these items MUST be resolved first: ...]
[CONDITIONAL GO: can generate 80% but these areas will have gaps: ...]
```

### Rules

- If status is NO-GO, do NOT proceed to generate. Tell the Product Lead what needs to be resolved.
- If status is CONDITIONAL GO, explain what can be generated now and what will need a second pass.
- A BLOQUEANTE pending decision is an automatic NO-GO unless the Product Lead explicitly says to proceed with assumptions.

---

## Mode 2: GENERATE — Create UC List & Entity Spec

### Purpose

Read the entire brain and produce a comprehensive use case list grouped by domain, plus an entity specification that seeds the class diagram. This is the artifact the Product Lead sends to the developer to start creating .mmd diagrams.

### Pre-Generation Checklist

Before generating, automatically run Mode 1 (Readiness). If NO-GO, stop. If CONDITIONAL GO, warn and ask for confirmation.

### Brain Reading Protocol (DEEP)

Read ALL of these files completely — do NOT skip or skim:

1. `{App}/brain/{app}-product-spec.md` — every feature, every rule, every field, every scope item
2. `{App}/brain/decision-log.md` — every approved decision, every rejected item
3. `{App}/brain/pricing-and-plans.md` — every tier, every limit, every feature-per-plan entry
4. `{App}/brain/technical-direction.md` — stack, auth, integrations, DB rules
5. `{App}/brain/implementation-phases.md` — all phases, UCs already defined, priorities
6. `{App}/brain/project-overview.md` — ecosystem context, cross-app integration points

If any of these files reference other brain files, read those too.

### UC Generation Rules

#### What IS a Use Case

A use case is a **discrete user or system action** that results in a state change or data retrieval. Each UC should map to one or more backend methods/endpoints.

**Valid UCs:**
- "Create event" — results in a new Event entity
- "Process payment via Stripe" — results in a Payment record
- "Send reminder email" — results in an email sent + EmailSendLog entry

**NOT a UC:**
- "Display the event page" — this is rendering, not a distinct action (UNLESS there's logic like incrementing pageViewCount, in which case the UC is the logic, not the rendering)
- "User reads the terms of service" — no state change, no system action
- "Show error message" — UI behavior, not a UC

#### UC Numbering and Grouping

- Number sequentially: UC-01, UC-02, ...
- Group by domain (Authentication, Event Management, Public Page, Participant Management, Emails, Agendas, Discovery, Billing, etc.)
- After each group, list the **Rules** that apply to those UCs
- Include **Architecture Requirements** where the brain specifies technical constraints tied to business rules

#### Actor Definitions

Define actors based on the product spec. Standard actors:
- **Visitor** — unauthenticated user
- **User** — authenticated, no content created yet
- **Organizer** / **Creator** — authenticated with content
- **Subscriber** — subscribed to recurring content
- **Third Party** — external person interacting via limited mechanism
- **System** — automated process

#### Completeness Verification During Generation

After drafting the UC list, run these checks BEFORE presenting it:

1. **Feature-to-UC mapping** — For every feature in the product spec, verify at least one UC covers it. List any feature without a UC.
2. **Decision-to-UC mapping** — For every approved decision that implies behavior, verify a UC or Rule captures it.
3. **Plan-limit-to-UC mapping** — For every plan-tiered limit, verify a UC or Rule mentions enforcement.
4. **Out-of-scope cross-check** — Verify NO UC covers something listed in "Out of Scope."
5. **Email cross-check** — For every email type mentioned in the spec, verify a UC covers sending it.
6. **Integration cross-check** — For every external integration (payments, rooms, storage, email provider), verify UCs cover the full lifecycle (setup, use, error handling, fallback).

### Entity Specification (Class Diagram Seed)

After the UC list, generate an entity specification:

1. **List every entity** mentioned in the product spec with ALL fields, types, and relationships
2. **Mark foreign keys** explicitly
3. **Mark nullable fields**
4. **Note plan-tiered fields** (fields whose behavior changes by plan)
5. **List implicit entities** — entities not explicitly named in the spec but required by the UCs (e.g., EmailSendLog, StripeWebhookLog, Session, PasswordResetToken)

### Output Files

Save to `{App}/brain/documents/`:
- `v1-use-cases-for-{dev}.md` — the UC list document (markdown, canonical source)
- `v1-entity-spec-for-{dev}.md` — the entity specification (if class diagram seed was generated)

### PDF Generation (MANDATORY)

After generating the UC list, also create a PDF version for the developer:

**UC List PDF structure:**

```
1. TITLE: "Use Cases V1 — [App]"
   SUBTITLE: "[X] use cases em [Y] domínios"

2. META BLOCK:
   - Data, Autor, Para: [Developer], Versão do brain

3. ACTOR DEFINITIONS:
   - Table with all actors and their definitions

4. USE CASE TABLE per domain:
   - Domain header
   - UC table: # | Use Case | Actor
   - Rules after each domain group

5. ENTITY SPECIFICATION (if generated):
   - Entity table per entity: Field | Type | Notes

6. VERIFICATION SUMMARY:
   - Features covered: [X/Y]
   - Decisions reflected: [X/Y]
   - Plan limits covered: [X/Y]
   - Gaps found: [list or "none"]

7. NEXT STEPS:
   - Developer creates .mmd activity diagrams from this list
   - Developer creates class diagram .mmd from the entity spec
   - Developer sends .mmd files back for review
```

Generate, save to `{App}/brain/documents/`, auto-copy to Downloads. Present summary in chat with UC count, domain count, gaps, and PDF location.

### Council Integration for Generation

If during generation you find **ambiguous areas** where the brain doesn't clearly define behavior, collect them and run a **quick council** (2 perspectives: Product Analyst + Technical Architect) to propose the most reasonable interpretation. Present the ambiguities and council suggestions to the Product Lead for resolution BEFORE finalizing the UC list.

---

## Mode 3: REVIEW — Multi-Pass Diagram Verification

### Purpose

When the developer sends back .mmd files (use case activity diagrams and/or class diagrams), the Product Lead passes them to this skill for thorough review. The skill runs multiple verification passes against the brain and outputs a prioritized list of corrections.

### Input

The Product Lead provides:
- .mmd file contents (pasted in chat or as file references)
- Optionally, context about what changed since last review

### Review Protocol: 7 Verification Passes

#### Pass 1: UC Completeness (Brain → Diagrams)

For every UC in the approved UC list (`v1-use-cases-for-{dev}.md` or `implementation-phases.md`):
- Is there a corresponding diagram/subgraph in the .mmd files?
- If not, flag as **MISSING UC** (P0)

For every diagram/subgraph in the .mmd files:
- Does it correspond to a UC in the brain?
- If not, flag as **ORPHAN DIAGRAM** (P1) — either it should be added to the UC list or removed

#### Pass 2: Pattern Compliance

Check every step (node) in every activity diagram:

| Pattern Violation | Severity | Fix |
|-------------------|----------|-----|
| Step contains a list of fields | P1 | Move fields to `%%` comment above the subgraph |
| Step is a note, policy, or explanation (prefixed with "nota:", "V1:", "modelo:", or reads like a description) | P1 | Move to `%%` comment |
| Step does 3+ different things (multiple responsibilities) | P1 | Decompose into individual steps |
| Step mentions implementation details ("via SP", "via adapter", "middleware", JWT specifics) | P2 | Remove mechanism, keep only the action (verb + object) |
| Complex inline logic that should be a separate UC | P1 | Extract to UC or link existing UC |
| Step is not an action (no verb, reads like a label) | P1 | Rewrite as verb + object |

**The golden rule:** Every step (node) in an activity diagram MUST represent a method or function call — something the system DOES. If it's not something that executes, it belongs in a `%%` comment.

#### Pass 3: Connection Analysis (UC ↔ UC)

Map all UC references (links, reuse calls) in the diagrams:

1. Build a **connection graph**: UC-A calls/reuses UC-B
2. For every UC that logically connects to another (e.g., "Create event" should reference "Check plan limits"):
   - Is the connection present in the diagram?
   - Is the connection direction correct?
3. Look for **dead-end UCs** — UCs that are never called by any other UC but should be (e.g., "Send email" should be called by multiple UCs)
4. Look for **orphan chains** — sequences of UCs that are disconnected from the main flow
5. Present the connection map and flag gaps

#### Pass 4: Decision-Log Alignment

For every **APPROVED** decision in `decision-log.md`:
- If the decision implies a behavior or rule, is it reflected in the diagrams?
- If the decision changed something (SUPERSEDED), is the old behavior removed and new behavior present?
- Flag any decision not reflected as **DECISION GAP** (P1)

#### Pass 5: Plan & Pricing Compliance

For every plan-tiered feature in `pricing-and-plans.md`:
- Is plan-limit enforcement present in the relevant UC diagram?
- Are the correct limits/values referenced (or in `%%` comments)?
- Flag missing enforcement as **PLAN GAP** (P1)

#### Pass 6: Entity Alignment (Class Diagrams)

For class diagram reviews:

| Check | Severity |
|-------|----------|
| Entity in product spec missing from class diagram | P0 |
| Entity in class diagram not in product spec (phantom entity) | P1 |
| Field in spec missing from entity | P1 |
| Field in entity not in spec (phantom field) | P2 |
| Missing FK relationship | P1 |
| Missing nullable annotation on conditional field | P2 |
| Service with zero callers (orphaned) | P1 |
| Service that should delegate to another but doesn't | P1 |
| Dead-end service (calls nothing, has methods that imply delegation) | P1 |
| Circular dependency without justification | P1 |
| Missing method for a UC action | P1 |

#### Pass 7: Journey Tracing (End-to-End)

Trace these complete user journeys through the diagrams:

1. **New user → creates account → creates first event → gets first registration**
2. **Visitor → finds event → registers → receives confirmation**
3. **Organizer → creates paid event → visitor purchases ticket → organizer sees payment**
4. **Organizer → creates agenda → adds events → visitor subscribes → organizer sends newsletter**
5. **System → sends reminder → tracks attendance → organizer exports data**

For each journey:
- Can you follow it end-to-end through the UCs without gaps?
- Are all transitions between UCs connected?
- Are error/fallback paths covered?

Add app-specific journeys based on the product spec.

### Review Output Format

```markdown
## Diagram Review: [App] — [Version/Date]

### Summary
- **Files reviewed:** [list]
- **Total subgraphs/UCs:** [count]
- **Findings:** [P0: X] [P1: Y] [P2: Z]
- **Overall assessment:** [score]% — [EXCELLENT / GOOD / NEEDS WORK / SIGNIFICANT GAPS]

### P0 — Critical (Must Fix)
#### [Finding ID]. [Title]
- **Pass:** [which verification pass found it]
- **Location:** [file, subgraph/UC ID]
- **Problem:** [clear description]
- **Expected:** [what the brain says]
- **Fix:** [specific correction instruction for the developer]

### P1 — Important (Should Fix)
[Same format]

### P2 — Minor (Nice to Fix)
[Same format]

### Connection Map
[ASCII or description of UC-to-UC connections found and missing]

### Journey Trace Results
| Journey | Status | Gaps |
|---------|--------|------|
| New user → first event → first registration | COMPLETE / GAP at [UC] | [description] |
| ... | ... | ... |

### Statistics
- UCs in brain: [X]
- UCs in diagrams: [Y]
- Coverage: [Y/X]%
- Pattern violations: [count]
- Missing connections: [count]
- Decision gaps: [count]
- Plan enforcement gaps: [count]
```

### After Review: Generate Developer PDF (MANDATORY)

Every review MUST produce a **PDF for the developer**. This is the concrete deliverable that the Product Lead sends to the developer with specific correction instructions.

#### Step 1: Save review markdown

Save to `{App}/brain/research/YYYY-MM-DD-diagram-review-v[N].md` (permanent record).

#### Step 2: Generate the Developer PDF

Create a generator script at `.cursor/tools/doc-generator/generate-diagram-review-v[N].js` following the established pattern (see existing scripts like `generate-usecase-v4-review.js`).

**PDF structure (mandatory sections):**

```
1. TITLE: "Revisão [Use Cases / Classes] V[N] — [App]"
   SUBTITLE: "Briefing para [Developer] — [X] correções"

2. META BLOCK:
   - Data: [today]
   - Autor: Julio (Product Portfolio Lead)
   - Escopo: [files reviewed] × [brain files cross-referenced]
   - Avaliação: [score]% — [X] achados anteriores corrigidos, [Y] novos

3. "COMO USAR ESTE DOCUMENTO" section:
   - Each item has the SUBGRAPH ID (e.g., Q35) + UC NAME + FILE (.mmd)
   - To find in code: open the .mmd file and search by subgraph ID
   - To find in visualizer: search by UC name

4. PREVIOUS FINDINGS STATUS:
   - Table: [Part] [Count] [Status: ✓ Corrected / Partial / Not fixed]
   - Bullet list highlighting notable corrections done well

5. NEW FINDINGS (grouped by severity P0 → P1 → P2):
   For each finding:
   - Subsection header: "[N]. [Priority] [Title]"
   - Location block: subgraph ID + UC name + file name
   - "Problema:" with bullet list explaining what's wrong
   - "Fluxo atual:" (optional, if visual helps)
   - "Correção recomendada:" in GREEN with specific step-by-step fix
   - Options A/B if multiple valid approaches exist

6. SUMMARY TABLE:
   | # | Subgraph | File | Action | Priority |

7. NOTES (context the developer needs):
   - V1/V2 in diagrams policy
   - References to brain files used
   - Link to previous review PDFs

8. FOOTER: "[App] Project — Revisão [Type] V[N] — Confidencial"
```

#### Step 3: Generate and deliver

```bash
cd .cursor/tools/doc-generator && node generate-diagram-review-v[N].js
```

Output locations:
- `{App}/brain/documents/revisao-[type]-v[N]-[dev]-YYYY-MM-DD.pdf`
- Auto-copy to `C:\Users\julio\Downloads\revisao-[type]-v[N]-[dev]-YYYY-MM-DD.pdf`

#### Step 4: Present to Product Lead

In chat, show:
1. Summary of findings (P0/P1/P2 counts)
2. Key corrections needed
3. Confirmation that PDF was generated
4. Path where the PDF is located
5. Instruction: "Send this PDF to [developer]"

#### PDF Language Rule

The PDF follows the language of the request. If Julio asks in Portuguese, the entire PDF is in Portuguese. If in English, in English. The developer's name and file references stay as-is regardless of language.

#### Version Tracking

Each review cycle increments the version: v1, v2, v3, v4...
The PDF filename includes the version so the developer can track progress.
Each new PDF includes a status section showing what was fixed from the previous version — this gives the developer positive feedback and shows the iteration is converging.

---

## Mode 4: AUDIT — Final Completeness Check

### Purpose

The final verification before delivery. This is the "is there ANYTHING missing?" pass. More thorough than a standard review — it actively searches for hidden use cases and untested assumptions.

### When to Use

- Before the first handoff of UC list to the developer
- Before approving a "final" version of .mmd files
- When the Product Lead says "verifique se falta algo" or "confira tudo"

### Audit Process

#### Step 1: Full Brain Reload

Re-read ALL brain files from scratch. Don't rely on previous context. The brain may have been updated since the last review.

#### Step 2: Hidden UC Discovery

For every entity in the product spec, ask:
- **Create** — Is there a UC for creating this entity?
- **Read** — Is there a UC for viewing/listing this entity?
- **Update** — Is there a UC for editing this entity?
- **Delete** — Is there a UC for removing this entity?
- **State transitions** — Does this entity have states? Is there a UC for each transition?
- **Expiry/cleanup** — Does this entity expire or get cleaned up? Is there a System UC for that?
- **Notifications** — When this entity changes, should anyone be notified? Is there a UC for that?
- **Limits** — Is this entity plan-limited? Is there a UC/rule for enforcement?
- **Export** — Can data from this entity be exported? Is there a UC for that?

#### Step 3: Edge Case Discovery

For every UC, ask:
- **What happens when the action fails?** (error path)
- **What happens at the plan limit boundary?** (exactly at limit, one over)
- **What happens when the user is unauthorized?**
- **What happens when the referenced entity doesn't exist?**
- **What happens concurrently?** (two users registering at the same time for the last spot)
- **What happens with zero data?** (no events, no registrations, empty state)

#### Step 4: Cross-Reference Audit Matrix

Build a matrix:

| Source | Item | UC Coverage | Class Coverage |
|--------|------|-------------|----------------|
| product-spec feature 1 | ... | UC-XX | Entity: Y |
| product-spec feature 2 | ... | MISSING | Entity: Y |
| decision D-001 | ... | UC-XX | N/A |
| pricing limit L-001 | ... | Rule in UC-XX | Field: Z |

Flag any row with MISSING coverage.

#### Step 5: Council Consultation (Optional but Recommended)

Run a `/review` council (4 perspectives: Correctness, Completeness, Consistency, UX) on the audit findings. The council examines:
- Are there use cases we're not seeing?
- Are there implicit behaviors that need explicit UCs?
- Are the connections between UCs logical and complete?
- From a user perspective, are all workflows covered?

#### Audit Output

Same format as Review Output, but with additional sections:

```markdown
### Hidden UC Discovery
| Entity | Create | Read | Update | Delete | States | Expiry | Notify | Limits | Export |
|--------|--------|------|--------|--------|--------|--------|--------|--------|--------|
| Event  | UC-07  | UC-10| UC-08  | UC-09  | MISSING| SYSTEM | UC-31  | RULE   | UC-25  |
| ... |

### Edge Cases Discovered
[List of edge cases not covered by current UCs]

### Audit Matrix Coverage
- Features covered: [X/Y] ([%])
- Decisions covered: [X/Y] ([%])
- Pricing limits covered: [X/Y] ([%])
- Overall audit score: [%]
```

#### Audit PDF (MANDATORY)

The audit also produces a PDF — the "final report" before delivery. This PDF is more comprehensive than a review PDF:

**Audit PDF structure:**

```
1. TITLE: "Auditoria Final — Diagramas [App]"
   SUBTITLE: "Verificação de completude antes da entrega"

2. META BLOCK:
   - Data, Autor, Escopo, Score geral

3. EXECUTIVE SUMMARY:
   - Overall health: [score]%
   - Total UCs: [X] in brain, [Y] in diagrams, [Z] missing
   - Total entities: [X] in spec, [Y] in class diagram, [Z] missing
   - Review iterations completed: [N]
   - Remaining open items: [count]

4. HIDDEN UC DISCOVERY TABLE (entity × CRUD × states × notify × limits)

5. EDGE CASES NOT COVERED (prioritized)

6. COVERAGE MATRIX:
   - Feature → UC mapping table
   - Decision → diagram mapping table
   - Plan limit → enforcement mapping table

7. JOURNEY TRACE RESULTS:
   | Journey | Status | Gap |

8. COUNCIL FINDINGS (if council was consulted)

9. RECOMMENDATIONS:
   - Items to fix before development starts
   - Items acceptable as-is with notes
   - Items to revisit after V1

10. SIGN-OFF SECTION:
    "This audit was completed on [date]. [X] open items remain.
     Recommendation: [APPROVE / APPROVE WITH CONDITIONS / NEEDS REVISION]"
```

Same generation process: create script, run, save to `{App}/brain/documents/`, auto-copy to Downloads.

---

## Quality Standards Reference

### Use Case Activity Diagrams (.mmd)

These rules were learned from 4 review cycles of the Events app and codified here for all future apps.

#### The Step Rule (GOLDEN RULE)

> Every node/step in an activity diagram represents a **method call or function execution**. If it doesn't execute, it doesn't belong as a step.

| Content Type | Where It Goes | Example |
|-------------|---------------|---------|
| Action the system performs | Step (node) | "Validate input fields" |
| Field list or schema | `%%` comment above subgraph | `%% Fields: firstName, lastName, email, phone` |
| Business rule or policy | `%%` comment or Rule section in UC doc | `%% Rule: Free Trial has 0 manual sends` |
| Implementation detail | Nowhere in the diagram | ~~"via stored procedure"~~ |
| Data description | `%%` comment | `%% Returns: event with all registrations` |
| V1/V2 scope note | `%%` comment | `%% V2: add individual occurrence editing` |

#### Connection Rules

- UCs that are reused must be **colored** and linked (not duplicated inline)
- Gateway (decision diamond) must be preceded by a step that poses the question
- Gateway diamonds themselves are **empty** — the question is in the preceding step
- All paths from a gateway must lead somewhere (no dangling branches)

#### Naming Conventions

- Steps: verb + object ("Validate email format", "Persist registration", "Send confirmation email")
- Subgraph titles: `UC-XX: Short Title`
- Reuse links: clearly labeled with the target UC ID

### Class Diagrams (.mmd)

#### Entity Rules

- Every entity from the product spec must be present
- Every field must have: name, type, and relationship note (FK, nullable, indexed)
- Conditional fields MUST be marked nullable
- Implicit entities (logs, tokens, sessions) must be present even if the spec doesn't name them explicitly

#### Service Rules

- Every service must have at least one caller (no orphaned services)
- Services that delegate to external systems (Stripe, S3, SES) must go through an interface
- Orchestrators should delegate to domain services, not implement business logic directly
- Method names must correspond to UC actions

#### Relationship Rules

- Every FK must have a corresponding relationship arrow
- Multiplicity must be annotated (1:1, 1:N, N:M)
- Circular dependencies must be documented and justified

---

## App-Specific Context Loading

When processing a request, load context based on the app:

### Events
- Brain path: `Events/brain/`
- Existing UC docs: `Events/brain/documents/v1-use-cases-for-luiz.md`
- Existing reviews: `Events/brain/research/2026-04-16-usecase-*.md`, `Events/brain/research/2026-04-16-class-diagram-*.md`
- Pattern analysis: `Events/brain/research/2026-04-16-usecase-pattern-analysis.md`
- Corrections briefing: `Events/brain/research/2026-04-15-luiz-use-case-corrections.md`

### Other Apps (Streaming, Learn, Community)
- Brain path: `{App}/brain/`
- Follow the same structure; generate UC docs and entity specs from scratch

---

## Workflow Summary

### For a NEW app (first time creating diagrams)

```
1. /diagrams readiness [App]
   → Brain completeness gate
   → If NO-GO: fill gaps first
   → If GO: proceed

2. /diagrams generate [App]
   → Deep brain read
   → Generate UC list + entity spec
   → Internal verification (6 checks)
   → Council for ambiguities (if any)
   → Save to brain/documents/
   → Product Lead reviews and sends to developer

3. Developer creates .mmd files from the UC list

4. /diagrams review [App]
   → Developer sends .mmd files back
   → 7-pass verification
   → Prioritized findings (P0/P1/P2)
   → Save review to brain/research/
   → Product Lead sends corrections to developer

5. Repeat step 4 until findings are minimal

6. /diagrams audit [App]
   → Final completeness check
   → Hidden UC discovery
   → Edge case scan
   → Council consultation
   → Final audit report
   → Sign-off for implementation
```

### For an EXISTING app (continuing review cycle)

```
1. Developer sends updated .mmd files

2. /diagrams review [App]
   → Read previous reviews to track progress
   → Run 7-pass verification
   → Note which previous findings are now FIXED
   → Identify new findings
   → Save review with version number

3. Repeat until clean

4. /diagrams audit [App] (before delivery / phase transition)
```

---

## Council Integration Points

| Situation | Council Mode | Roles |
|-----------|-------------|-------|
| Ambiguous feature in brain (unclear behavior) | `/council quick` | Product Analyst + Technical Architect |
| Disagreement on whether something is a UC or a rule | `/debate` | Product (pro-UC) vs Technical (pro-rule) |
| Final completeness audit | `/review` | Correctness + Completeness + Consistency + UX |
| Class diagram architectural question | `/council` | Full 4-perspective council |
| Timeline impact of missing UCs | `/assess` | Risk Analyst + Timeline Realist |

---

## PDF Deliverable Summary

Every mode that produces developer-facing output generates a PDF. The PDF is the concrete artifact that the Product Lead sends to the developer.

| Mode | PDF Generated | Filename Pattern | What It Contains |
|------|:------------:|-----------------|-----------------|
| Readiness | NO | — | Chat-only report for Product Lead |
| Generate | YES | `v1-use-cases-for-{dev}-YYYY-MM-DD.pdf` | Complete UC list + entity spec + verification summary |
| Review | YES | `revisao-{type}-v{N}-{dev}-YYYY-MM-DD.pdf` | Previous fixes status + new findings with fix instructions + summary table |
| Audit | YES | `auditoria-diagramas-{app}-YYYY-MM-DD.pdf` | Full completeness report + hidden UCs + coverage matrix + sign-off |

**All PDFs:**
- Primary location: `{App}/brain/documents/`
- Auto-copy to: `C:\Users\julio\Downloads\` (Windows accessible)
- Generated via: `.cursor/tools/doc-generator/generate-*.js` scripts
- Follow the language of the request (Portuguese or English)
- Include a "How to use this document" section at the top
- Include the version number for tracking iteration progress

**The review cycle produces a sequence of PDFs:**
```
v1-use-cases-for-luiz-2026-04-23.pdf          ← First: UC list to developer
revisao-usecases-v1-luiz-2026-04-25.pdf       ← After developer sends .mmd v1
revisao-usecases-v2-luiz-2026-04-27.pdf       ← After developer fixes and sends v2
revisao-classes-v1-luiz-2026-04-26.pdf         ← After developer sends class diagram v1
revisao-classes-v2-luiz-2026-04-28.pdf         ← After developer fixes and sends v2
auditoria-diagramas-events-2026-04-30.pdf      ← Final audit before development starts
```

Each PDF in the sequence references the previous one, creating a traceable history of the iteration.

---

## Important Rules

1. **NEVER generate diagrams from incomplete brain.** Always run readiness check first.
2. **NEVER skip verification passes.** All 7 passes run on every review.
3. **NEVER approve diagrams with P0 findings.** P0 = must fix before proceeding.
4. **ALWAYS cross-reference the decision-log.** Decisions change; diagrams must reflect current state.
5. **ALWAYS save reviews to brain/research/.** Every review is a permanent record of the iteration.
6. **ALWAYS present findings with specific fix instructions.** "Fix this" is not enough — tell the developer exactly what to change and where.
7. **When in doubt, consult the council.** Better to get 4 perspectives than to miss something.
8. **Track review versions.** Each review is numbered (v1, v2, v3...) so progress is visible.
9. **The brain overrides the diagrams.** If a diagram contradicts the brain, the diagram is wrong.
10. **Think in connections.** Every UC connects to other UCs. Every entity connects to other entities. The goal is a complete, connected system — no orphans, no dead ends, no hidden behaviors.
