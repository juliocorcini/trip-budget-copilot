---
name: phase-report
description: >-
  Process a phase report received from a developer. Reads the report folder,
  applies suggested updates to the brain, records new decisions, improves skills,
  and prepares for the next phase delivery.
  Use when: /report, /processar-report, o Luiz mandou o report, processa o report da fase,
  aplica as sugestões do Luiz, apply phase report, process dev feedback.
---

# Phase Report Processor — Apply Dev Feedback to Brain

## Overview

When a developer finishes a phase, they send a report folder back to Julio.
This skill reads that report and applies the learnings to the brain, knowledge base,
decision log, and skills — so the next phase delivery is better.

## When to use

- Julio says: "o Luiz mandou o report", "processa o report da fase N"
- Julio drops a folder and says: "aplica isso no brain"
- `/report phase N`, `/processar-report`

## Execution Flow

```
READ REPORT → ANALYZE → APPLY TO BRAIN → CONFIRM WITH JULIO → PREPARE NEXT PHASE
```

---

## Step 1: READ REPORT

Read ALL files from the report folder:

1. `phase-summary.md` — overview of what happened
2. `problems-and-fixes.md` — every problem and solution
3. `ai-lessons-learned.md` — AI mistake patterns (MOST IMPORTANT)
4. `spec-changes.md` — deviations and new decisions
5. `suggested-brain-updates.md` — specific changes to make
6. `acceptance-checklist.md` — pass/fail status

### 1b. VERIFY COMMIT STATUS (MANDATORY — added 2026-05-26)

Check `phase-summary.md` for:
- **"Final commit"** field — must contain a commit hash (not empty, not "N/A")
- **"Total commits"** field — must be > 0

**If "Total commits: 0" or no commit hash**:
- FLAG AS PROCESS FAILURE in the report analysis
- Add to "What to improve" section: "Phase was delivered without commits — Rule 11 and Rule 21 violated"
- Recommend: developer must commit immediately and send updated report
- Still process the rest of the report, but note the process gap

This check exists because Phase 6 was delivered with 0 commits. The AI must catch this going forward.

---

## Step 2: ANALYZE

### 2a. Categorize suggested changes

Group all suggestions into:

| Category | Where to apply | Priority |
|----------|---------------|----------|
| Knowledge base updates | `{App}/brain/documents/{app}-project-knowledge-base.md` | HIGH |
| Decision log entries | `{App}/brain/decision-log.md` | HIGH |
| Technical direction changes | `{App}/brain/technical-direction.md` | HIGH |
| Skill improvements | `.cursor/skills/phase-delivery/` | MEDIUM |
| Wireframe fixes | `{App}/brain/wireframes/` | MEDIUM |
| Product spec clarifications | `{App}/brain/{app}-product-spec.md` | LOW |
| Phase scope adjustments | `{App}/brain/documents/director-scope-phase-*.md` | LOW |

### 2b. Identify recurring AI patterns

From `ai-lessons-learned.md`, extract patterns that should be added to:
- **`{App}/brain/documents/project-rules.md` Rule 9** (MANDATORY — merge ALL new anti-patterns here. Each entry: mistake | rule. Include the phase number for traceability)
- The knowledge base (new rules or clarifications)
- The START-HERE.md template in the phase-delivery skill
- The `.cursorrules` template in the setup automation

**CRITICAL**: `project-rules.md` Rule 9 is the CANONICAL accumulation point for AI lessons.
Every new lesson from `ai-lessons-learned.md` MUST be merged into Rule 9, even if it seems minor.
This file is shipped to the developer in every phase delivery and persists across all chat sessions.

### 2b2. Assess wireframe fidelity (MANDATORY for phases with frontend)

If the phase included frontend screens with wireframes:
1. Check the `ai-lessons-learned.md` for WIREFRAME entries
2. Check `problems-and-fixes.md` for visual fidelity issues
3. Check if the report mentions shared element inconsistencies
4. Check if the acceptance checklist includes the VISUAL FIDELITY criteria:
   - Shared elements consistent across pages?
   - Per-screen wireframe match > 90%?
   - Shared Elements Registry verified?
   - Side-by-side screenshots included?

If visual fidelity was NOT checked or failed:
- Flag as HIGH priority issue
- Recommend: re-run wireframe compliance on affected screens
- Check if `shared-elements-registry.md` was followed

If visual fidelity passed:
- Note as positive signal — the wireframe workflow is working

### 2c. Identify spec gaps

From `suggested-brain-updates.md` and the "Missing or Unclear Specs" section,
identify documentation that needs to be added or clarified.

---

## Step 3: PRESENT TO JULIO

Before making changes, present a summary:

```
╔══════════════════════════════════════════════════╗
║   PHASE REPORT ANALYSIS — Phase N               ║
╠══════════════════════════════════════════════════╣

FROM: {developer}
PHASE: {N} — {name}
STATUS: {COMPLETE / PARTIAL}
ACCEPTANCE: {N/N criteria met}

SUGGESTED CHANGES:
  Knowledge base:     {N} updates
  Decision log:       {N} new entries
  Technical direction: {N} changes
  Skills:             {N} improvements
  Wireframes:         {N} fixes needed
  Product spec:       {N} clarifications

AI PATTERNS IDENTIFIED:
  {list top 3-5 recurring AI mistakes}

WIREFRAME FIDELITY (if phase had frontend):
  Shared elements consistent:    {PASS / FAIL / NOT CHECKED}
  Per-screen wireframe match:    {PASS / FAIL / NOT CHECKED}
  Registry verified:             {PASS / FAIL / NOT CHECKED}
  Screenshots included:          {YES / NO}

TOP PROBLEMS:
  {list top 3 most significant problems}

RECOMMENDATION:
  Apply {N} changes automatically? (y/n)
  Some changes need your review first:
  - {list any changes that need human judgment}

╚══════════════════════════════════════════════════╝
```

Wait for Julio's approval before applying changes.

---

## Step 4: APPLY TO BRAIN

For each approved change:

### 4a. Knowledge base
- Update the specific PART in `{app}-project-knowledge-base.md`
- Add new rules, clarify existing ones, fix incorrect information
- Increment the version number

### 4b. Decision log
- Add new [APPROVED] entries from decisions made during development
- Mark any [PENDING] items that were resolved
- Add date and "— Luiz (during Phase N development)"

### 4c. Technical direction
- Update any stack changes or architecture patterns discovered
- Update last-updated date

### 4d. Project status
- Mark the phase as COMPLETED
- Update any risk assessments based on what actually happened
- Move the "YOU ARE HERE" marker

### 4e. Skills (if applicable)
- Update phase-delivery SKILL.md with new patterns to include in START-HERE
- Update dev-log-system.md if new entry types or rules are needed
- Add new lessons to any relevant skill files

### 4f. Wireframes (flag only)
- Do NOT auto-update wireframes — flag them for Julio to review
- List which wireframes need attention and what changed

### 4g. Shared Elements Registry
- If the report mentions shared element inconsistencies → flag for Julio to update the registry
- If the report suggests new shared elements (found during development) → add to registry
- If the report confirms registry was followed perfectly → note as positive signal
- Update `{App}/brain/documents/shared-elements-registry.md` if Julio approves changes

---

## Step 5: CONFIRM

After applying all changes, show:

```
╔══════════════════════════════════════════════════╗
║   CHANGES APPLIED — Phase N Report               ║
╠══════════════════════════════════════════════════╣

APPLIED:
  ✓ Knowledge base — {N} updates (version X.Y → X.Z)
  ✓ Decision log — {N} new entries
  ✓ Technical direction — {N} changes
  ✓ Project status — Phase N marked COMPLETED
  ✓ Skills — {N} improvements

FLAGGED FOR REVIEW:
  ⚠ Wireframe: {screen-name} — {what changed}
  ⚠ {any other items needing human judgment}

NEXT STEP:
  Ready to generate Phase {N+1} delivery folder.
  Say: /deliver phase {N+1}

╚══════════════════════════════════════════════════╝
```

---

## Important Rules

1. **Always present changes before applying** — Julio approves what gets applied
2. **AI lessons are the highest value** — these improve future phases for ALL apps
3. **Decision log entries from dev work are [APPROVED]** — they already happened
4. **Never auto-update wireframes** — only flag them for review
5. **Knowledge base version must increment** — track changes
6. **Project status is always updated** — phase marked COMPLETED
7. **This skill pairs with phase-delivery** — one sends, one receives. Together they form the feedback loop
8. **Visual fidelity is checked for every frontend phase** — wireframe compliance, shared elements, and screenshots are part of the report assessment. If not present in the report, flag as a gap. See lessons-learned.md L12.
