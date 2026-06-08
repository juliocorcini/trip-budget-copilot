---
name: app-design
description: >-
  Create visual design systems and HTML wireframes for any Febracorp app.
  Interviews the user about design vision, generates theme options as visual Canvas,
  and produces all screen wireframes as standalone HTML files.
  Use when the user asks: /design, crie as telas, monte o design, gere wireframes,
  design do app, visual do app, crie o tema, theme options, generate screens,
  create wireframes, design system.
---

# App Design — Visual Design System & Wireframe Generator

## Overview

This skill creates the complete visual identity for a Febracorp app in 3 phases:
- **Phase A**: Define the theme (interview OR extract from existing wireframes)
- **Phase B**: Generate all screen wireframes as standalone HTML files
- **Phase C**: Review and approve screens

**Output**: `design-system.md` in the brain + HTML wireframes for every V1 screen.

**Prerequisites**: The app's brain must have `v1-screen-list.md` and `{app}-product-spec.md`.

**Design Quality**: This skill leverages 3 installed design skills for quality:
- **design-taste-frontend** (Taste Skill) — anti-slop rules, premium UI patterns
- **impeccable** — anti-patterns, typography/color/spatial principles
- **emil-design-eng** (Emil Kowalski) — animation decisions, component polish

---

## Critical Rules

### Rule 1: Batch all questions
The user pays per request, not per token. ALL questions MUST be asked in a single AskQuestion call. If there are too many questions for AskQuestion (10+), create a markdown document with all questions and ask the user to answer in one message.

### Rule 2: Canvas must feel real
Theme previews and screen wireframes shown via Canvas must look like REAL interfaces, not flat mockups. Use overlapping elements, glassmorphism, tonal layering, real typography, proper spacing, shadows, and motion hints. The user must be able to evaluate the design as if it were the actual app.

### Rule 3: Screens are full pages
Every wireframe is a COMPLETE page: header + sidebar (if applicable) + main content + all interactive states visible. Shared layout components (header, sidebar, nav) are consistent across all screens.

### Rule 4: Brain drives content
Every element on a screen MUST be traceable to the brain (use cases, entities, plan limits, product spec). No missing form fields, no absent action buttons, no ignored states (empty, loading, error, upgrade prompt).

### Rule 5: Design system enables autonomy
The generated `design-system.md` must be detailed enough that ANY AI can create new screens matching the exact visual identity without seeing the wireframes. It serves as the "visual constitution."

---

## Execution Flow

```
DETECT → PHASE A (Theme) → PHASE B (Screens) → PHASE C (Review) → PACKAGE
```

---

## Step 0: DETECT

### 0a. Extract parameters
- **App name**: from user request (Events, Streaming, Learn, Community)
- **Brain path**: `{App}/brain/`
- **Screen list**: `{App}/brain/documents/v1-screen-list.md`
- **Existing wireframes?**: Check if `{App}/brain/wireframes/` exists with HTML files, OR if user points to an external folder with reference HTMLs

### 0b. Choose mode
- **Existing wireframes found** → Phase A Mode 2 (Extract)
- **No wireframes** → Phase A Mode 1 (Interview)

### 0c. Check design skills are installed
Verify these exist (search in `.cursor/skills/` and `.agents/skills/`):
- `design-taste-frontend/SKILL.md`
- `impeccable/SKILL.md`
- `emil-design-eng/SKILL.md`

If any is missing, install via `npx skills add` before proceeding.

---

## Phase A: Theme Definition

### Mode 1 — Interview (no existing wireframes)

Read `.cursor/skills/app-design/interview.md` for the full question set.

Present ALL questions in a SINGLE AskQuestion call. Questions cover:
- App personality and mood
- Color preferences
- Light vs dark
- Visual density and layout style
- Inspirations and anti-references
- Mobile strategy
- Special effects preferences

From the answers, generate **3 theme options as a Canvas**:
- Each option shows a mini-app: header, sidebar (if applicable), card, button variants, form input, data table row, modal overlay, toast notification, empty state
- The 3 options share the same colors/fonts (from the interview) but vary the LAYOUT: e.g., Option A = sidebar left + dense, Option B = top nav + spacious, Option C = sidebar floating + balanced
- Use Tailwind via CDN, Google Fonts, Material Symbols
- Canvas must feel real: overlapping elements, glassmorphism, tonal depth, proper shadows

User picks one option. If refinements needed, iterate. Then proceed.

### Mode 2 — Extract from existing wireframes

1. Read ALL existing HTML wireframe files
2. Extract the design tokens: colors (hex values), fonts (family, weights, sizes), spacing patterns, border-radius values, shadow styles, icon system, layout patterns (sidebar width, header height, grid structure)
3. Identify inconsistencies between wireframes (different color values for same semantic purpose, different font sizes for same heading level, etc.)
4. Propose a UNIFIED token system that resolves inconsistencies
5. Generate a Canvas preview showing the unified theme applied to both a dashboard view and a public page view
6. User approves or requests adjustments

### Phase A Output

Generate `design-system.md` following the spec in `.cursor/skills/app-design/design-spec.md`.
Save to: `{App}/brain/documents/design-system.md`

---

## Phase B: Screen Generation

### B.1 — Key screen layout variations

Identify 5-8 "key screens" — screens that define the structural skeleton:
- The main dashboard/list view
- The main creation form
- The primary public-facing page
- The pricing/billing page
- Any unique layout (agenda, discovery, embed)

For each key screen, generate **3 layout variations as Canvas**:
- Same theme/tokens, different element arrangement
- Show in a tabbed or side-by-side Canvas for easy comparison
- User picks one layout per key screen

### B.2 — Generate all screens

For EVERY screen in `v1-screen-list.md`:

1. Read the screen's route, description, and associated use cases from the brain
2. Identify which "Shared Components" table entries apply
3. Determine the layout template (from B.1 key screen choices, or closest match)
4. Generate a standalone HTML file:
   - Self-contained (inline Tailwind CDN, Google Fonts link, Material Symbols link)
   - Full page: header + sidebar/nav + main content
   - All form fields from the entity definition
   - All action buttons from the use cases
   - Placeholder data that feels real (no "John Doe", no "Lorem ipsum" — use contextual, believable data per Taste Skill rules)
   - States: show the primary "populated" state; include comments marking where empty/loading/error states would appear
5. Save to: `{App}/brain/wireframes/{screen-slug}/code.html`

### Screen naming convention
Use kebab-case derived from the route:
- `/login` → `login/code.html`
- `/dashboard/events` → `dashboard-events/code.html`
- `/dashboard/events/:id/schedule` → `event-schedule/code.html`
- `/events/:slug` → `event-public-page/code.html`

### Quality checklist per screen
Before saving each HTML, verify:
- [ ] All entity fields from brain PART 3 that should appear on this screen are present
- [ ] All action buttons from relevant use cases are present
- [ ] Plan-limited features show the correct limit context (e.g., "3 of 5 events used")
- [ ] Typography follows design-system.md scale
- [ ] Colors match design-system.md tokens exactly
- [ ] Spacing follows the defined spacing scale
- [ ] Icons use Material Symbols Outlined with correct weight
- [ ] Layout matches the approved key screen template
- [ ] No anti-patterns from the design skills (no Inter, no pure black, no side-stripe borders, no gradient text, no nested cards)

---

## Phase C: Review

Show screens to the user via Canvas for approval.
Group by phase for efficient review:
- "Here are all Phase 1 screens (8 screens). Review and let me know any adjustments."
- Iterate per screen if needed

When all screens are approved, mark Phase C complete.

---

## Step PACKAGE: Integrate with Handoff

After all screens are approved:

1. Ensure `design-system.md` is in `{App}/brain/documents/`
2. Ensure all wireframe HTMLs are in `{App}/brain/wireframes/`
3. Report to the user:

```
DESIGN COMPLETE — {App}

Theme: [brief description]
Design system: {App}/brain/documents/design-system.md
Wireframes: {App}/brain/wireframes/ ({N} screens)

Key screens: {list}
Layout variations chosen: {summary}

Ready to include in the next handoff package.
The app-dev-handoff skill will automatically pick up:
  - design-system.md → docs-para-repo/design-system.md
  - wireframes/ → docs-para-repo/wireframes/
```

---

## For Future Apps (No Wireframes)

When starting a brand-new app with no reference wireframes:

1. Run the full interview (Phase A Mode 1)
2. Generate 3 theme options
3. After theme approval, generate key screen layout variations
4. Generate all screens
5. Review and approve

The interview + theme generation takes ~1 request cycle. Screen generation is the bulk of the work.

---

## Integration with Design Skills

During HTML generation, apply these principles from the installed skills:

**From Taste Skill**:
- Use the 3 dials (DESIGN_VARIANCE, MOTION_INTENSITY, VISUAL_DENSITY) tuned to the app
- Follow anti-slop rules: no AI purple, no centered hero (variance > 4), no card overuse for dashboards
- Use realistic placeholder data (no generic names, no round numbers)

**From Impeccable**:
- Follow the font selection procedure (reject reflex fonts, use brand-appropriate choices)
- Apply OKLCH color principles and tinted neutrals
- 4pt spacing scale with semantic tokens
- Absolute bans: no side-stripe borders, no gradient text
- The AI Slop Test: would someone immediately say "AI made this"?

**From Emil Kowalski**:
- Animation annotations in HTML comments (which elements should animate, what easing, what duration)
- Button `:active` states with scale(0.97)
- Origin-aware popovers
- Custom easing curves in CSS variables
- Performance: only transform and opacity for animations
