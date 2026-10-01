---
name: phase-delivery
description: >-
  Generate a self-contained phase folder for a developer. The folder contains
  START-HERE.md (the AI reads this and knows exactly what to do), all reference docs,
  phase-specific wireframes, database schema, and release authorization.
  The developer just tells their AI: "Read START-HERE.md and execute it."
  Use when: /fase, /phase, manda a fase pro Luiz, prepara a fase X, gera o pacote da fase,
  phase delivery, send phase to dev, prepare phase folder.
---

# Phase Delivery — Self-Contained Phase Folder for Developer

## Overview

This skill generates a **self-contained folder** for a specific phase. The folder is designed
so the developer simply tells their AI: "Read START-HERE.md and execute it." The AI knows
what to build, where to find specs, where to put code, and what rules to follow.

**Key principle**: The developer doesn't think about what to do. The folder IS the instruction.

## When to use

- Julio says: "manda a fase X pro Luiz", "prepara a phase N", "gera o pacote da fase"
- After a phase is completed and the next one needs to start
- `/fase N`, `/phase N`, `/fase N [app] [dev]`

## Execution Flow

```
DETECT → GATHER → BUILD FOLDER → COPY TO DOWNLOADS → REPORT
```

---

## Step 1: DETECT

Extract from the user's request:
- **Phase number**: which phase to deliver (e.g., 2, 3, 4...)
- **App name**: Events, Streaming, Learn, Community (default: Events)
- **Developer name**: default Luiz for Events
- **Brain path**: `{App}/brain/`

Read `{App}/brain/project-status.md` to confirm:
- The PREVIOUS phase is marked as COMPLETED
- The requested phase is READY TO START or NOT STARTED

If the previous phase is NOT completed → WARN but allow (Julio may override).

---

## Step 2: GATHER

### 2a. Read phase scope

Read `{App}/brain/documents/director-scope-phase-N.md` for the target phase.
Extract:
- Milestones (ordered)
- Acceptance criteria
- Risks
- What's NOT in this phase

### 2b. Read screen list

Read `{App}/brain/documents/v1-screen-list.md`.
Extract which screens belong to the target phase.

### 2c. Identify wireframes

For each screen in the phase, check if a wireframe exists at:
`{App}/brain/wireframes/{screen-name}/code.html`

Build a map: screen → wireframe path (or "no wireframe").

### 2c2. Identify or generate Shared Elements Registry

Check if `{App}/brain/documents/shared-elements-registry.md` exists:
- **EXISTS** → include it in the delivery (always — it's a locked contract)
- **DOES NOT EXIST and phase has frontend wireframes** → GENERATE it now:
  1. Read ALL wireframe HTML files in `{App}/brain/wireframes/`
  2. Identify every element appearing in 2+ wireframes (sidebar, header, footer, nav, auth shell, etc.)
  3. Catalog variants with visual attributes (items, colors, layout structure)
  4. Apply priority criteria: (1) scope alignment, (2) brain/design-system alignment, (3) frequency, (4) design quality
  5. Write the registry to `{App}/brain/documents/shared-elements-registry.md`
  6. Include in the delivery

The registry pre-decides shared element versions so the developer's AI VERIFIES against it
rather than inventing from scratch. See lessons-learned.md L10.

### 2d. Read technical direction

Read `{App}/brain/technical-direction.md` for confirmed stack.

### 2e. Read project-status for risks

Read `{App}/brain/project-status.md` for phase-specific risks identified by the developer.

### 2f. Read implementation-phases for context

Read `{App}/brain/implementation-phases.md` for phase details.

### 2g. Detect CHANGED files (CRITICAL for slim delivery)

The phase folder only includes files that are NEW or UPDATED since the last delivery.
Files that haven't changed are NOT included — they're already on the dev's machine.

**Always NEW for every phase:**
- `scope-phase-N.md` — the phase scope
- `releases/phase-N-approved.md` — authorization
- Phase-specific wireframes

**Always included (may be updated):**
- `project-knowledge-base.md` — if Julio applied report feedback or added rules
- `implementation-protocols.md` — ALWAYS included. Contains Gate Checkpoint, Self-Check, Context Refresh, and all quality protocols. This is a Febracorp standard for ALL phases
- `cursorrules-template.md` — ALWAYS included (C80). Contains the updated `AGENTS.md` that the AI must install on the dev's machine. This is the PERSISTENT rule layer — the only file the AI reads in EVERY interaction. Dev-log enforcement, commit enforcement, and session start rules live here. START-HERE.md CONFIGURE section must instruct the AI to copy this file to `AGENTS.md` in the project root
- `dev-log-system.md` — if logging rules were improved
- `PHASE-COMPLETE-INSTRUCTIONS.md` — if report generation was improved
- Database `.mmd` files — if schema was corrected
- Any wireframe that was updated based on dev feedback

**Only included if changed (check brain file modification dates or ask Julio):**
- `api-response-standard.md`
- `use-cases.md` / `v1-use-cases-for-{dev}.md`
- `v1-screen-list.md`
- `design-system.md` — ALWAYS include if phase has frontend screens or design migration milestones
- `design-enforcement-rules.md` — include if phase has design migration milestones (contains 30-point self-audit)
- `design-migration-tracker.md` — include if phase has design migration milestones
- `director-workflow-guide.md`
- `implementation-phases.md`

**Include if changed OR if dev doesn't have it yet:**
- `project-rules.md` — installed during setup, but CAN be updated. Include if modified since last delivery or if the dev never had it.
- `dev-log-system.md` — installed during setup, but CAN be updated. Include if modified or if the dev never had it.
- `dev-log-initial.md` — only include if the dev doesn't have `dev-log.md` yet (first time only).
- `PHASE-COMPLETE-INSTRUCTIONS.md` — installed during setup, but CAN be updated. Include if modified or if the dev never had it.

**NEVER included in phase deliveries:**
- `dev-log.md` — lives on dev's machine, append-only. NEVER overwrite.

**Decision logic**: If Julio processed a report since the last delivery (via `/report`),
check which brain files were modified. Include those. If unsure, ask Julio:
"Which files changed since the last delivery? Or should I include all reference docs?"

---

## Step 3: BUILD FOLDER

### Folder structure

```
{App}-para-{Dev}/
└── phase-N-{phase-slug}/
    ├── LEIA-ME.txt                        ← For the developer (short, human-readable)
    ├── START-HERE.md                      ← For the AI (instructions + manifest of what changed)
    ├── docs/                              ← ONLY new + updated documents
    │   ├── scope-phase-N.md               ← ALWAYS (new — this phase's scope)
    │   ├── shared-elements-registry.md    ← ALWAYS when phase has frontend wireframes
    │   ├── project-knowledge-base.md      ← ONLY IF updated since last delivery
    │   ├── implementation-protocols.md   ← ALWAYS (Gate Checkpoint, Self-Check, Context Refresh)
    │   ├── project-rules.md              ← ALWAYS (Rule 9 grows every phase with new AI lessons)
    │   ├── cursorrules-template.md       ← ALWAYS (C80 — persistent AI rules, dev-log/commit enforcement)
    │   ├── future-phases-roadmap.md      ← ALWAYS (read-only summary of remaining phases + Post-V1)
    │   ├── dev-log-system.md              ← ONLY IF updated or first time
    │   ├── dev-log-initial.md             ← ONLY IF dev-log.md doesn't exist yet
    │   ├── PHASE-COMPLETE-INSTRUCTIONS.md ← ONLY IF updated
    │   └── {other changed docs}           ← ONLY docs that changed since last delivery
    ├── wireframes/                        ← ONLY this phase's wireframes (+ any updated ones)
    │   ├── {screen-name}/
    │   │   ├── code.html
    │   │   └── screen.png (if exists)
    │   └── ...
    ├── database/                          ← ONLY IF schema was updated
    │   ├── schema-*.mmd
    │   └── database-erd-explorer.html
    └── releases/
        └── phase-N-approved.md            ← ALWAYS (new — authorization)
```

**KEY PRINCIPLE: If a file is NOT in the folder, it means it hasn't changed.**
The dev's existing files stay as-is. Only files present in the delivery get overwritten.

### 3a. Generate START-HERE.md

This is the CORE of the folder. It must have TWO PARTS:

**PART 1: CONFIGURE (runs immediately)**
1. **Header block** with FOR THE AI / FOR THE DEVELOPER + explanation of the two-part flow
2. **Step 1: Copy docs** — exact cp commands for the developer's project
3. **Step 1b: Update AGENTS.md** — `cp docs/cursorrules-template.md AGENTS.md` (C80). This is the PERSISTENT AI rule layer. It contains dev-log enforcement, commit enforcement, and updated session start. Without this step, the AI will NOT follow dev-log/commit rules
4. **Step 2: Set up dev log** — copy dev-log-system.md, create/append dev-log.md, add phase start header
5. **Step 3: Validate** — checklist of required files and project state (includes verifying AGENTS.md was updated)
6. **Step 4: Report and WAIT** — show configuration summary, list milestones, then ASK "Want me to implement Phase N?"

**PART 2: IMPLEMENT (only when developer says go)**
6. **What this phase builds** — milestone table + screen table with wireframe paths
7. **WIREFRAME-FIRST WORKFLOW (MANDATORY for phases with frontend wireframes)**:
   - Step A: Read `docs/shared-elements-registry.md` — these are the LOCKED shared elements
   - Step B: Before implementing ANY screen, read its wireframe HTML completely
   - Step C: Extract exact values (colors, typography, spacing, layout, components) from the HTML
   - Step D: Implement matching the wireframe — same structure, same hierarchy, same patterns
   - Step E: After each screen, report wireframe fidelity (structural match assessment)
   - Step F: Verify shared elements match the registry on every page
   - **Note on model capabilities**: Frontend wireframe implementation benefits from extended
     reasoning (thinking mode). If not available, implement ONE screen per session using the
     stepwise checklist above. Do not batch multiple screens without thinking mode.
8. **Build each milestone** — read order (scope → KB → schema → wireframes → shared-elements-registry), build order (backend → frontend → test → LOG → commit)
9. **Rules** — phase enforcement, architecture patterns, tech stack, phase-specific config
10. **After completing** — fill Phase Completed summary in dev-log.md, tell Luiz to review + test
11. **COMMIT ALL WORK** — `git add -A && git commit -m "phase [N] complete: [summary]"` — **NEVER SKIP THIS STEP** (see Rule 21)
12. **Generate report** — read PHASE-COMPLETE-INSTRUCTIONS.md and generate report folder (Step 0 in that file verifies commit exists)
12. **Acceptance criteria** — full checklist from the scope (including VISUAL FIDELITY gate)
13. **Known risks** — from project-status.md and scope risks

**KEY: The AI STOPS between Part 1 and Part 2.** It does NOT start implementing until the developer explicitly says to.

### 3b. Generate LEIA-ME.txt

Short, human-readable. Pattern:

```
EVENTS — PHASE N: {PHASE NAME}
================================

Luiz, para executar essa fase:

1. Abra o Director no Codex
2. Diga para a IA:

   "Leia o arquivo START-HERE.md na pasta [caminho desta pasta]
    e execute."

A IA vai:
  1. Copiar os documentos para o projeto
  2. Configurar o sistema de log
  3. Validar que está tudo no lugar
  4. Te mostrar um resumo e PERGUNTAR se pode começar a implementar

Você decide quando a implementação começa.
Se precisar corrigir bugs da fase anterior, pode fazer.
Quando estiver pronto, diga: "Implementa Phase N"

A pasta contém:
- START-HERE.md      → Instrução para a IA (configurar + implementar)
- docs/              → Documentos de referência + sistema de log
- wireframes/        → HTMLs das telas desta fase ({N} wireframes)
- database/          → Schema do banco
- releases/          → Autorização para Phase N

IMPORTANTE: A IA registra TUDO no dev-log.md (bugs, correções, decisões).
Quando terminar, diga "gera o relatório pro Julio".

— Julio
```

### 3c. Generate phase-N-approved.md

```markdown
# Phase N — Approved by Julio

> Date: {today}
> Approved by: Julio (Product Portfolio Lead)
> App: {App}
> Developer: {Dev}

Phase {N-1} has been reviewed and approved.
The developer is authorized to proceed with Phase {N}.

This file serves as the ONLY valid authorization for phase transition.
Place this file in your project at: docs/releases/phase-N-approved.md
```

### 3d. Copy reference docs

**Always include (NEW for this phase):**
- `director-scope-phase-N.md` → renamed to `scope-phase-N.md`
- `releases/phase-N-approved.md`
- Phase-specific wireframes (new screens for this phase)

**Include ONLY IF changed since last delivery:**
- `project-knowledge-base.md` — if Julio updated it (applied report feedback, added rules, fixed entities)
- `dev-log-system.md` — if logging rules were improved
- `PHASE-COMPLETE-INSTRUCTIONS.md` — if report generation was improved
- Database `.mmd` files — if schema was corrected
- Any reference doc that Julio modified: `api-response-standard.md`, `use-cases.md`, `v1-screen-list.md`, `design-system.md`, `director-workflow-guide.md`, `implementation-phases.md`
- Any wireframe that was updated (not just new phase wireframes)

**Include for first phase delivery only (if project was set up before this system):**
- `dev-log-initial.md` — only if dev-log.md doesn't exist yet on dev's machine

**NEVER include:**
- `dev-log.md` — append-only, lives on dev's machine. NEVER overwrite.

NOTE: `project-rules.md` CAN be included if Julio modified it (added/changed rules).
It's installed during setup but is NOT frozen — Julio may update it between phases.

**The START-HERE.md must contain a manifest** listing every file in the delivery, whether it's NEW or UPDATE, and what changed. Files NOT in the folder haven't changed.

### 3e. Copy wireframes (phase-specific only)

For each screen identified in Step 2c, copy the wireframe folder.
Only copy wireframes for THIS phase — not all wireframes.

### 3f. Copy database schema

Copy from `{App}/brain/tools/diagrams/raw/*.mmd` to `database/`.
Remove date prefixes from filenames (e.g., `2026-04-23-pg-` → just `schema-`).
Also copy `{App}/brain/tools/*database-erd*.html` if it exists.

---

## Step 4: COPY TO DOWNLOADS

Detect Windows Downloads path:
- WSL: `/mnt/c/Users/{windows-user}/Downloads/`
- macOS/Linux: `$HOME/Downloads/`

Copy the entire phase folder to Downloads.

---

## Step 5: REPORT

Show to Julio:

```
╔══════════════════════════════════════════════════╗
║   PHASE DELIVERY — Phase N: {Phase Name}         ║
╠══════════════════════════════════════════════════╣

FOLDER: Downloads/phase-N-{slug}/

CONTENTS:
  START-HERE.md        ← AI instruction (entry point)
  LEIA-ME.txt          ← Developer instruction
  docs/                ← {N} reference documents
  wireframes/          ← {N} screen wireframes
  database/            ← {N} schema files + ERD
  releases/            ← phase-N-approved.md

TOTAL FILES: {N}

WHAT TO TELL LUIZ:
  "Pega essa pasta e diz pra IA: leia o START-HERE.md
   e executa tudo que está lá."

╚══════════════════════════════════════════════════╝
```

---

## Important Rules

1. **START-HERE.md is the entry point** — everything the AI needs is there or referenced from there
2. **Only phase-specific wireframes** — don't dump all 35 wireframes, only the ones for this phase
3. **Reference docs included ONLY IF changed** — KB, API standard, use cases are only included when Julio updated them since the last delivery. Unchanged files stay on the dev's machine
4. **Database schema included ONLY IF changed** — schema files only when corrections were made
5. **The folder is NOT fully self-contained** — it depends on files already on the dev's machine from setup or previous deliveries. It only contains what's new or updated
6. **Naming convention**: `phase-N-{slug}` where slug is the phase name in lowercase kebab-case
7. **LEIA-ME is for humans, START-HERE is for AI** — keep them separate and purpose-specific
8. **CONFIGURE always UPDATES existing files** — docs in the folder are the latest versions from Julio. The CONFIGURE step OVERWRITES existing docs (KB, use cases, design system, etc.) because Julio may have applied improvements. Only dev-log.md and reports/ are NEVER overwritten
9. **dev-log-system.md included if updated or first delivery** — logging rules may improve between phases
10. **PHASE-COMPLETE-INSTRUCTIONS.md included if updated or first delivery** — report generation is AUTOMATIC at end of phase
11. **Report is AUTOMATIC** — when the phase is complete and the dev confirms review is done, the AI generates the report without a separate request. The report is the LAST mandatory step of every phase
12. **Tech Lead delegation is MANDATORY** — the AI that reads START-HERE.md does NOT write code. It delegates ALL implementation to the Tech Lead agent. The Tech Lead decides architecture, assigns subagents, and is the ONLY agent that touches source code. This rule MUST be included in every START-HERE.md
13. **Shared Elements Registry is MANDATORY for frontend phases** — if the phase has wireframe HTML files, the delivery MUST include `shared-elements-registry.md`. This file pre-decides locked shared elements (sidebar, header, nav, etc.) so the developer's AI verifies against it instead of inventing from scratch. Generate it in Step 2c2 if it doesn't exist. See lessons-learned.md L10.
14. **Visual fidelity is an acceptance criterion** — every phase with frontend screens MUST include visual quality gates in the acceptance criteria: shared element consistency, per-screen wireframe match (>90% structural), and shared-elements-registry verification. The phase report must include wireframe fidelity assessment. See lessons-learned.md L12.
15. **Recommend thinking mode for frontend phases** — START-HERE.md should note that extended reasoning (thinking mode) significantly improves wireframe fidelity. If not available, the developer should implement one screen per session with explicit stepwise checklist. See lessons-learned.md L11.
16. **implementation-protocols.md is ALWAYS included** — This file contains all reusable quality protocols (Gate Checkpoint, Self-Check, Context Refresh, Mid-Gate Refresh, dev-log, Phase Completion Commit, single session). START-HERE.md MUST reference it (`Read docs/implementation-protocols.md`) instead of repeating protocol details inline. This keeps START-HERE.md focused on phase-specific content and ensures protocols are consistent across all phases.
17. **START-HERE.md should be focused, not bloated** — START-HERE.md contains: (1) NON-NEGOTIABLES block, (2) file manifest, (3) pre-phase verification, (4) phase structure overview, (5) gate sections with milestones and ACs, (6) anti-patterns, (7) report instructions. Protocols and checkpoint details live in `implementation-protocols.md`. The AI reads BOTH files at phase start.
18. **Phases with 6+ milestones MUST be organized in gates** — max 5-6 milestones per gate. Gate Checkpoint Protocol (from implementation-protocols.md) is mandatory between gates. All phases run in a SINGLE session — Context Refresh replaces session restart.
19. **Design migration milestones follow the V1/V2 safety protocol** — When a phase includes visual migration milestones, the AI MUST: (a) create V2 files alongside V1 (NEVER modify original), (b) run the 30-point self-audit from `design-enforcement-rules.md` on each migrated screen, (c) log audit results in dev-log.md, (d) only replace V1 with V2 when the developer explicitly confirms V2 works. The `design-system.md` and `design-enforcement-rules.md` are ALWAYS included in deliveries that have design migration milestones. See `.cursor/skills/design-migration/SKILL.md` for the full migration protocol.
20. **design-system.md is the DEFINITIVE visual reference** — Every frontend screen must comply with `design-system.md`. This file defines the Burnished Copper Modern brand: color tokens, typography (Manrope only), glass surfaces, spring physics motion, component patterns, and 12 antipatterns. If the developer's AI creates any frontend that violates this file, it is a defect. Include in EVERY delivery that has frontend work.
21. **future-phases-roadmap.md is ALWAYS included** — Every phase delivery includes a read-only summary of all remaining phases (what they do, estimated effort, tier, key milestones) plus the Post-V1 backlog. This gives the developer visibility into what's coming without permission to implement it. Generate from `{App}/brain/implementation-phases.md`. The file must clearly state "informational only — do NOT implement" and START-HERE.md must mark it as informational in the manifest.

## Feedback Loop

The phase delivery is NOT a one-way street. The full cycle is:

```
Julio sends phase folder → Dev AI CONFIGURES (copies, validates, UPDATES docs) →
Dev AI WAITS for "implement" → Dev AI delegates to Tech Lead →
Tech Lead implements → Dev AI logs everything → Dev reviews + tests →
Dev AI AUTOMATICALLY generates report → Dev sends report to Julio →
Julio applies brain updates → Julio sends next phase folder (with improved docs)
```

### Files that enable the feedback loop:
- `dev-log-system.md` — permanent logging rules (updated each delivery if Julio improved them)
- `dev-log.md` — the permanent, append-only log (NEVER overwritten, only appended)
- `PHASE-COMPLETE-INSTRUCTIONS.md` — tells the AI how to generate the report (automatic at end)
- The generated report folder (`phase-N-report-for-julio/`) is what the dev sends back

### What Julio does with the report:
1. Read `ai-lessons-learned.md` → update knowledge base and skills
2. Read `suggested-brain-updates.md` → apply changes to the brain
3. Read `spec-changes.md` → record new decisions in decision-log.md
4. Read `problems-and-fixes.md` → understand what went wrong and prevent recurrence
5. Generate the next phase folder with improvements applied (docs will be UPDATED)

### Why CONFIGURE overwrites docs:
Between phases, Julio processes the dev's report and applies improvements:
- Knowledge base may have new rules or corrected entities
- Use cases may have been added or clarified
- Design system may have updated tokens
- Wireframes may have been fixed based on dev feedback
- dev-log-system.md may have new entry types or improved rules

The CONFIGURE step ensures the developer ALWAYS has the latest versions of everything.
