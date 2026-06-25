# TripPilot — Decision Log

> Last updated: 2026-06-24 (UI/UX pass: DEC-285/286/287 APPROVED via G1 ship 0.99.51; DEC-288 APPROVED via G2 ship 0.99.52; DEC-290 APPROVED via G3 ship 0.99.53; DEC-289/293 APPROVED via G4 ship 0.99.54; DEC-291/292 APPROVED via G5 ship 0.99.55; G6 shipped 0.99.56 (M13/M22/M21/M24/M25 — P3 polish, no new DECs); DEC-294 APPROVED via G7 ship 0.99.57 — the FAZER batch is complete; see the entries at the end; orchestrator `documents/2026-06-24-ui-ux-implementation-orchestrator.md`. Prior 2026-06-22: Field Feedback batch DEC-256→279 recorded — see the 2026-06-22 note at the end of this paragraph. Prior 2026-06-17: Device-Test Force-Task shipped: DEC-217 Ondas 1–4 web/OTA bug-fix + UX batch + 4C close-out, v0.71.0 → v0.75.0, 1299 tests / 144 files. DEC-218 native biometric (D-DEC-C) + Onda 5 sync/device batch — APPROVED but device-pending (needs Julio's physical device(s)). Prior: DEC-216 E2E-in-CI (B15) + FundsPage atomic pool-creation (B13), v0.70.0. DEC-215 native batch B1+B2+B3, APK 0.69.0 built but NOT promoted — device session pending. NOTE: the numbers DEC-185–199 and DEC-201 were never written — see the reconciliation block between DEC-184 and DEC-200. Next new id = DEC-240. — 2026-06-18: DEC-219→234 budget-model + UX-clarity packages shipped; DEC-235 = Device Test 2026-06-18 GATE 15; DEC-236 = Device Test 2026-06-18 GATE 16 (Amigo Sincero deep redesign); DEC-237 = Device Test 2026-06-18 GATE 17 (Home occasion carousel opens on the planned metas — planned-first kept, scroll-snap dropped to stop Chromium's involuntary re-snap); DEC-239 = Device Test 2026-06-18 GATE 19 (daily-detail explainers: free/day base+peak source + spent/day per-category breakdown, v0.95.0); DEC-238 = Device Test 2026-06-18 GATE 18 (FAB rebalanced — planning promoted to visible chips, "Registrar mercado" demoted into "Outros registros"). — 2026-06-19: DEC-240 = Bill Split "saída de bar" hardening batch (full who-got-what history by person/item + "O que é meu" hero + persistent live-split notification + pass-the-phone round-the-table mode, v0.99.4). DEC-241 = Debt ("está me devendo") + bill-split UX deep-dive batch — born-confirmed debts from the owner's ledger for non-connected people + "Acerto de contas" hub redesign + remind/cobrar (v0.99.5→v0.99.7); see `documents/debt-and-split-ux-deep-dive-and-plan-2026-06-19.md`. Next new id = DEC-242. — 2026-06-20: DEC-242→245 shipped/researched (244 = G4 payment methods v0.99.9; 245 = ranked backlog, A1 Wise split explainer shipped v0.99.11). DEC-246 = AI Quick Entry — natural-language router (text + voice) wired to every core action, planner(cloud, Groq JSON)/executor(device) split + Whisper STT, privacy names-only, v0.99.12 — **SHIPPED + deployed** (Pages OTA + Worker `/assistant`+`/transcribe` live, reusing the existing `GROQ_API_KEY`; live probe "o Bruno me pagou uma cerveja de 2 euros" → `someone_paid`/Bruno/€2/i_owe, 200); see `documents/ai-quick-entry-natural-language-router-plan-2026-06-20.md`. DEC-247 = Copilot "Trip Wrapped" end-of-trip retrospective, v0.99.13 **SHIPPED** (pure `buildTripWrapped` reusing copilot-insights + `TripWrappedSheet`, data-gated, mid-trip preview, reuses the DEC-133 share card). — 2026-06-21: DEC-248→255 = Admin dashboard v1/v2 (telemetry, AI tokens server-authoritative, error capture, per-user detail, DAU) + multi-trip switcher (DEC-249) + "Dia a dia" ongoing mode (DEC-250) + onboarding identity (DEC-252) + real-OS platform telemetry (DEC-253) + new app icon (DEC-255); see `documents/multi-space-and-admin-v2-study-2026-06-21.md` + `admin-dashboard-v1-plan-2026-06-21.md`. — 2026-06-22: **DEC-256→278 = Field Feedback batch** (direction APPROVED/ratified, implementation pending): converter+AI FX intent, capture stitching, AI-receipt field parity, inline add-participant, FAB↔back, **cofrinho-as-buffer**, carousel=1-occasion, outing setup trim+discard, Amigo Sincero phrase bank+voices, **location default ON** (ÂNCORA 8 amendment), auto device name, event delete asks about expenses, admin tokens-per-fn + **Groq governance** + 00000000 investigation + PWA/browser telemetry + errors-in-detail + centered modal, release-notes/guide refresh, planner-no-write guards, **single image chooser**, **graceful AI degradation**, **record repayment**, **in-app AI help V1**, and **cofrinho legibility — voice + statement/ledger + movement insight (DEC-279, council C14; Model A vs B pending Julio)**; see `documents/field-feedback-master-plan-and-councils-2026-06-22.md`. Next new id (pre-batch pointer) = DEC-280; **the UI/UX pass 2026-06-24 consumed DEC-285→294** (PROPOSED), so the next genuinely free id = **DEC-295**.)

## Format

- **ID**: DEC-NNN
- **Date**: YYYY-MM-DD
- **Status**: APPROVED | PENDING | SUPERSEDED | REJECTED
- **Decision**: What was decided
- **Rationale**: Why
- **Alternatives considered**: What else was on the table

---

## Decisions

### DEC-001 — Project Structure
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: Use Director-style tech-lead delegation with 11 subagents + Febracorp planning methodology
- **Rationale**: Structured planning AND quality execution with specialized agents
- **Alternatives**: Single-agent approach, simpler 3-agent team

### DEC-002 — Platform: PWA First
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: Build as Progressive Web App, not native Android/Kotlin
- **Rationale**: Faster to build with AI, works on phone + computer, JS/TS expertise, free hosting, no app store needed. Capacitor can add native features later
- **Alternatives**: Kotlin native (rejected: slower, Android-only), React Native (overkill for V1)

### DEC-003 — Tech Stack
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: React + TypeScript + Vite + Tailwind CSS + Dexie (IndexedDB) + Zustand + Zod + date-fns + Vitest + Playwright + vite-plugin-pwa
- **Rationale**: Julio's JS/Node expertise, fast AI-assisted development, minimal dependencies
- **Alternatives**: SvelteKit, Next.js (unnecessary complexity for local-first PWA)

### DEC-004 — Data Storage: Local-First
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: IndexedDB via Dexie, no backend, no login, no remote DB
- **Rationale**: Works offline (critical for travel), zero hosting cost, privacy, simplicity
- **Alternatives**: Supabase (deferred to later), localStorage (insufficient for structured data)

### DEC-005 — Hosting: Cloudflare Pages
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: Deploy on Cloudflare Pages free tier (500 builds/month)
- **Rationale**: Free, auto-deploy from Git, supports Functions for future backend
- **Alternatives**: Vercel, Netlify (similar but Cloudflare aligns with future plans)

### DEC-006 — Budget Model: Occasion-Based Forecasting
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: Main engine uses occasion profiles (bar, market, restaurant, etc.), NOT simple daily average
- **Rationale**: User's spending pattern is highly irregular — zero-spend days vs €40 bar nights. Daily average misleads
- **Alternatives**: Simple daily average (rejected as primary metric, kept as secondary indicator)

### DEC-007 — BudgetPool Across Phases
- **Date**: 2026-06-08
- **Status**: APPROVED · **RECONCILED by DEC-219** (2026-06-18) — the canonical model is now **1 trecho = 1 dedicated pool**; cross-phase sharing is demoted to an *advanced* capability. The `BudgetPoolPhaseLink` primitive stays in the backend (still possible in "Visão avançada"), it just stops being the default mental model.
- **Decision**: A BudgetPool can serve multiple non-consecutive phases via BudgetPoolPhaseLink
- **Rationale**: €760 must last for two separate Burgos stays (before and after eurotrip). Can't be tied to one phase
- **Alternatives**: Separate budgets per phase (doesn't reflect shared money pool)

### DEC-008 — Entity Hierarchy
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: Trip → Phase (chronological) + BudgetPool (financial) → Envelope (purpose). These are distinct concepts
- **Rationale**: Phase = when. Pool = how much money. Envelope = what for. Conflating them causes bugs
- **Alternatives**: Phase-owns-budget (insufficient for multi-phase pools)

### DEC-009 — Outing Mode as Core Feature
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: Outing Mode with quick buttons, progressive alerts, next-drink calculation
- **Rationale**: This is the main gap no competitor fills — real-time spending guidance during a night out
- **Alternatives**: Post-hoc tracking only (doesn't solve the core problem)

### DEC-010 — Three-Limit System
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: Every spending context shows: ideal target, safe ceiling, maximum limit
- **Rationale**: Single limit is either too restrictive (frustrating) or too permissive (useless)
- **Alternatives**: Single hard limit, no limit

### DEC-011 — Personal Shopping Isolation
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: Personal shopping (clothes, cosmetics, gifts) goes to separate global fund with €100 initial limit
- **Rationale**: 2024 analysis showed Zara/Lefties purchases distorted daily budget perception
- **Alternatives**: Mix all spending (causes confusion per 2024 data)

### DEC-012 — Alert Tone: "Amigo Sincero"
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: Default alert tone is direct and natural, not comic or condescending
- **Rationale**: Julio's preference. Must feel like honest advice, not a lecture or joke
- **Alternatives**: Calm (too passive), Comic (inappropriate for real money decisions)

### DEC-013 — Device Transfer via JSON/CSV
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: Manual JSON export/import between devices, CSV export for spreadsheets
- **Rationale**: Simplest approach for V1. Julio needs computer access for spreadsheet work
- **Alternatives**: Auto-sync (deferred), cloud backup (requires backend)

### DEC-014 — No Personal Data in Public Build
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: PWA starts empty. Demo uses fictional data only. User imports private JSON
- **Rationale**: Bruno/Debora sharing the same URL must not see Julio's data
- **Alternatives**: Hardcoded seed (security/privacy violation)

### DEC-015 — Scenario Planner with Manual Mode
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: Interactive planner where user adjusts quantities. App shows alternatives but never changes preferences silently. Manual mode default, assisted mode optional
- **Rationale**: User wants to see trade-offs interactively ("2 more outings = 1 less bar night")
- **Alternatives**: Automatic rebalancing (rejected as default, available as opt-in)

### DEC-016 — Future Phase Reserve: Auto + Manual Floor
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: System calculates reserve recommendation for future phases with 3 levels (essential/recommended/comfortable). User can set manual floor. Applied = max(recommended, manual_floor). Initial floor: €170
- **Rationale**: Prevents spending all money before second Burgos stay
- **Alternatives**: Pure automatic (user wants control), pure manual (no guidance)

### DEC-017 — Capacitor for Android Later
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: Add Capacitor to same React project after PWA is validated, for APK + local notifications
- **Rationale**: Local notifications during outings need native layer. PWA handles everything else
- **Alternatives**: Kotlin rewrite (rejected), PWA only (notifications unreliable)

### DEC-018 — Future Multi-User Architecture
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: Prepare data model for future where each person has own account. Shared expenses visible to participants. Personal budgets remain private
- **Rationale**: Bruno and Debora will eventually have own apps, interconnected
- **Alternatives**: Single-user forever (limits value)

### DEC-019 — Shared Expense Provisional Impact
- **Date**: 2026-06-08
- **Status**: APPROVED — implemented via DEC-071 (2026-06-09)
- **Decision**: Shared expenses from others affect budget provisionally before confirmation, with clear visual indication
- **Rationale**: Better to over-reserve than be surprised. But must be transparent
- **Alternatives**: Only after confirmation (user loses real-time awareness)
- **Note (2026-06-09)**: the confirmation state never existed in the model until R2; DEC-071 adds `ParticipantShare.confirmationStatus` and the confirmation flow, finally implementing this decision

### DEC-020 — Money in Cents
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: Store monetary values as integer cents (€12.34 = 1234)
- **Rationale**: Avoids floating-point precision errors in financial calculations
- **Alternatives**: Floating point (error-prone)

### DEC-021 — EUR-Only Initial Interface
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: First interface works with EUR only. Data model prepared for multi-currency
- **Rationale**: Reduces initial complexity while keeping extensibility
- **Alternatives**: Multi-currency from day 1 (unnecessary complexity)

### DEC-022 — Design System: Mediterranean Cockpit
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: Dark-first theme with terracotta (#C75B39) accent, Manrope font, cockpit-style Outing Mode with drink segments and segmented gauge. Dashboard shows "Livre para usar" as hero number, not raw fund balance
- **Rationale**: Council brainstorm (4 perspectives) + user preferences. Terracotta = warm travel identity, not cold corporate blue. Cockpit Outing Mode matches real-time decision-making need
- **Alternatives**: Amber-only (Golden Cockpit), Teal dual-accent (Night Pilot), generic finance-app aesthetic (rejected)

### DEC-023 — Budget Display: "Livre para usar" as Hero
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: Dashboard primary number is "Livre para usar até [data]" = (fund balance - future phase reserve - protected reserve). Raw fund balance shown secondary below
- **Rationale**: User feedback: showing total fund balance without subtracting reserves misleads the user about actual spendable money. The app must answer "how much can I really spend?" instantly
- **Alternatives**: Show total fund balance as primary (causes confusion between saved and free money)

### DEC-024 — Outing Mode: Dedicated Full Screen
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: Outing Mode opens as a dedicated immersive screen (not inline in dashboard). Quick-add buttons must be visible without scrolling. Dashboard shows compact card with "Abrir sessão" link
- **Rationale**: User feedback: at 1am in a bar, scrolling to find +€7 button is unacceptable. Buttons must be immediately accessible
- **Alternatives**: Inline in dashboard (poor UX for the core use case)

### DEC-025 — UI Language: Portuguese for User-Facing Text
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: All user-facing labels, messages, badges, and navigation text in Portuguese. Code (variables, comments, functions) stays in English
- **Rationale**: The primary user is Brazilian/Portuguese-speaking. Mixing languages in the UI creates cognitive friction
- **Alternatives**: English UI (not natural for the user), bilingual (unnecessary for V1)

### DEC-026 — Outing Screen: Dense Layout with Session History
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: Outing Mode eliminates dead space between gauge and quick-add buttons. Adds: (1) inline 3-limit indicators (Meta/Teto/Máx), (2) compact session history (last 3 items + "Ver todos"), (3) next-drink impact message, (4) "Registrar total atual" secondary button. All visible without scrolling on a standard mobile viewport
- **Rationale**: User rated screen 8.0/10, main complaint was "too much empty space" making it look broken. Travel app must feel complete and functional at a glance in a bar environment
- **Alternatives**: Keep spacious layout (feels incomplete), add a chart (too heavy for quick interactions)

### DEC-027 — FAB Button: Quick Action Menu with 6 Options
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: Central + button opens a full-screen overlay menu with 6 specific actions: (1) Registrar gasto, (2) Começar saída, (3) Simular compra, (4) Registrar mercado, (5) Registrar transferência, (6) Registrar saque. "Registrar gasto" is visually primary. FAB icon changes to × when menu is open
- **Rationale**: User feedback: a generic + button without clear purpose is "genérico de app moderno". Each action must be explicit and discoverable
- **Alternatives**: Single-purpose button (limits discoverability), long-press submenu (hidden UX)

### DEC-028 — Planner State Chips: Visual Badges over Text
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: Replace text-only states (e.g. "Essencial · Travado") with compact visual chips/badges. Color-coded: green for Essencial, gray for Planejado/Opcional, yellow for Alterado. Lock/unlock icons replace Travado/Ajustável text. Scannable at a glance
- **Rationale**: User feedback: text-heavy states are "pouco escaneável". Badge-based UI is faster to parse on mobile during travel
- **Alternatives**: Text-only (current, harder to scan), icons-only (too cryptic without color context)

### DEC-029 — Contrast Tier Increase: dim 67%, faint 38%
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: Increase secondary text contrast: --on-dim from 50% to 67% opacity (#EDE8E0aa), --on-faint from 27% to 38% (#EDE8E060). Add --on-mute at 21% for dividers. Maintains premium dark aesthetic while ensuring readability on mobile in low-light environments
- **Rationale**: User feedback (2nd round): "subtítulos menores" and "labels pequenos" still too hard to read "no celular, à noite, andando, ou no bar"
- **Alternatives**: Keep current opacity (poor readability), increase to full opacity (loses premium feel)

### DEC-030 — Dashboard Hierarchy: Priority-Based Card Ordering
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: Dashboard cards follow priority hierarchy: (1) "Livre para usar" hero — strongest visual weight, (2) Active outing card — high priority with border accent and CTA, (3) Occasion counters — medium, (4) Savings message — subtle positive, (5) Pending shared expenses — high when present (warning style), (6) Personal shopping — medium with prominent remaining amount, (7) Amigo sincero — contextual/low with before/after data + "Ver impacto" CTA
- **Rationale**: User feedback: all cards were "um pouco empilhado" with similar visual weight. Priority hierarchy ensures the most actionable information stands out
- **Alternatives**: Flat uniform cards (current issue), tabbed sections (too hidden for a dashboard)

### DEC-031 — Amigo Sincero: Actionable with Before/After Data
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: Amigo sincero card includes structured comparison (ANTES/DEPOIS columns), shows reserve status, and has a "Ver impacto completo" CTA button. Lower visual priority than active outing or pending expenses
- **Rationale**: User feedback: current insight is good but "não puxa a próxima ação". Adding structured data and CTA makes it actionable
- **Alternatives**: Text-only message (not actionable), always-visible full simulation (too heavy for contextual card)

### DEC-032 — Outing Gauge: Position Marker + Zone Label
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: The outing progress gauge includes a white circle marker at the current spend position, a €value label below it, three limit labels (META/TETO SEGURO/MÁXIMO) aligned left/center/right below the gauge, and a colored zone chip ("Dentro da meta", "Acima da meta", "Acima do teto") for instant comprehension
- **Rationale**: User feedback: the gauge "still requires interpretation". A position marker with a zone label eliminates guesswork — the user instantly sees where they stand
- **Alternatives**: Numeric-only labels (requires mental calculation), color-only (ambiguous for colorblind users)

### DEC-033 — Final Contrast: dim 70%, faint 44%
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: Final contrast values: --dim at 70% opacity (#EDE8E0b3), --faint at 44% (#EDE8E070). Optimized for mobile readability in low-light environments (bars, restaurants, walking outdoors at night). Maintains visual hierarchy without breaking the premium dark aesthetic
- **Rationale**: Third contrast iteration based on user testing feedback. Previous 67%/38% still too low for real-world mobile usage
- **Alternatives**: Keep 67%/38% (insufficient), raise to 80%/55% (flattens hierarchy too much)

### DEC-034 — FAB Menu: Full-Screen Real Overlay
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: The FAB menu renders as a full-screen dark overlay (--deep at 94%) with action items bottom-aligned near the thumb zone. No preview text or headers — the production version shows only the overlay and action list. FAB icon shows × while open
- **Rationale**: User feedback: preview text was for presentation only. The real app should show a clean, immersive action menu that respects thumb reach
- **Alternatives**: Half-sheet bottom panel (less immersive), dropdown from button (poor touch target)

### DEC-035 — Amigo Sincero: Direct Impact Phrasing
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: The Amigo Sincero message uses direct, scannable phrasing: "Se confirmar essa compra, suas saídas de bar caem de 3 para 2." instead of softer indirect text. Bold font-weight for the main message to ensure readability at a glance
- **Rationale**: User feedback: previous phrasing "não puxa tanto a próxima ação". Direct cause-effect wording is faster to parse on mobile during real decision moments
- **Alternatives**: Softer phrasing (slower to parse), bullet-only format (loses conversational tone)

### DEC-036 — Minimal Onboarding: Trip + Phase + Amount → Dashboard
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: Onboarding requires only: trip name, phase name, start/end dates, currency, amount, optional protected reserve. Profiles, participants, wallets, and extra phases can be configured later. App is usable immediately after minimal setup
- **Rationale**: Reduce friction to first use. User shouldn't need to configure 8 screens before seeing the dashboard
- **Alternatives**: Full wizard required (too long), completely empty start (no context for the app to work)

### DEC-037 — Activity Profiles: Editable Presets + Skip
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: App suggests initial profiles with low-confidence estimates based on presets (Hospedado com família, Viagem urbana, Festival, Personalizado). User can accept, edit, remove, or skip entirely. Profiles are not required for the app to function. Users can also create custom profiles (e.g., "Café da manhã fora", "Lavanderia")
- **Rationale**: Balance between guided start and flexibility. Low-confidence estimates are better than nothing, but shouldn't block usage
- **Alternatives**: User must input all values (too much friction), no presets (lost opportunity)

### DEC-038 — Demo Data: Complete Small Fictional Trip
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: Demo includes: 1 fictional trip, 2 non-consecutive phases linked to same pool, 1 operational + 1 personal shopping pool, 3 fictional participants, 2 wallets, 8-12 expenses, 1 shared market, 1 cash withdrawal, 1 completed bar session, 1 active demo session, 1 pending shared expense, 1 scenario with trade-off recommendation. Shows "Dados de demonstração" banner + "Apagar e começar do zero" button
- **Rationale**: User needs to see all features working to understand the product
- **Alternatives**: Empty demo (useless), too many records (confusing)

### DEC-039 — Phase Without BudgetPool: Allowed
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: A phase can exist without an associated BudgetPool. When registering an expense in such a phase, require selecting an accessible pool or creating a new one
- **Rationale**: Users may create phases before defining budgets (e.g., transition days, planning ahead)
- **Alternatives**: Require pool at creation (blocks workflow)

### DEC-040 — Multiple BudgetPools Per Phase
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: A single phase can access multiple BudgetPools. Each expense points to exactly one pool. When only one operational pool exists, auto-select it. Pools like "Compras pessoais" or "Emergência" require conscious user selection
- **Rationale**: A Burgos phase needs access to both the Burgos fund and the personal shopping fund
- **Alternatives**: One pool per phase (too restrictive for the real use case)

### DEC-041 — Personal Shopping: Global BudgetPool, Not Envelope
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: Personal shopping is a separate BudgetPool with scope "global" (applies to entire trip, not linked to specific phases). It does NOT silently reduce the main phase budget. BudgetPool gains a `scope` field: "global" | "linked_phases"
- **Rationale**: Mixing personal shopping into the Burgos fund caused confusion in 2024 analysis. A separate pool makes accounting unambiguous
- **Alternatives**: Envelope inside main pool (still mixed), per-phase allocation (unnecessary complexity)

### DEC-042 — Simplified Envelope Model
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: Envelope kinds reduced to: "protected_reserve" and "allocation". The "informational" kind is removed from MVP. Protected reserve MUST be stored as an Envelope (single source of truth), never duplicated as a standalone field on BudgetPool. Dashboard derives protected reserve display from the envelope
- **Rationale**: Envelope informational had no clear use case. PlannedOccurrence covers known future expenses. Single-source for reserve prevents inconsistency
- **Alternatives**: Four envelope types (over-engineered for V1)

### DEC-043 — ScenarioAllocationItem vs PlannedOccurrence
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: Two distinct concepts: ScenarioAllocationItem = aggregate planned quantity for a phase/pool (e.g., "4 bar nights"); PlannedOccurrence = specific committed event with optional date (e.g., "Passeio para Valladolid, 10/07, €35"). The planner [-]/[+] controls manipulate ScenarioAllocationItems, not individual PlannedOccurrences
- **Rationale**: User doesn't schedule 5 individual market visits — they plan "5 markets this phase". But a specific outing to Valladolid is a commitment worth tracking individually
- **Alternatives**: Only one concept (loses granularity for committed events)

### DEC-044 — Profile Costs: Typical + Safe (Not Three-Limit for Planning)
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: Each ActivityProfile stores: typical value, safe value (for planning), confidence level, optional expected frequency. The three-limit system (meta/teto/máx) applies only to Outing Mode sessions. Profiles can store default session limits that pre-fill when starting a new outing
- **Rationale**: Planning needs one reliable number (safe estimate). Three limits add complexity only justified in real-time tracking during an active session
- **Alternatives**: Three limits everywhere (over-complex for planning)

### DEC-045 — Quick-Add Values: Dynamic Based on Profile
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: Quick-add button values are suggested based on the activity profile and avg drink price. Editable in: global settings, profile settings, session start, and during session. Default: +€3, +€5, +€7, +€10, +€15, Outro. The value closest to avg drink price gets visual highlight
- **Rationale**: A bar with €3 beers needs different buttons than a cocktail bar with €12 drinks. Flexibility without losing the quick-tap experience
- **Alternatives**: Fixed values (too rigid), fully custom only (no guidance)

### DEC-046 — "Registrar Total Atual": Reconciliation Adjustment
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: When user reports total (e.g., €35) and existing items sum to €21: keep all individual items, create an "Ajuste para total informado" entry of +€14. If reported total < existing sum: warn of conflict, allow correcting items or creating negative adjustment with confirmation. Never silently delete history
- **Rationale**: User may forget to log individual items but knows the total. Destroying logged items to match would lose useful data
- **Alternatives**: Replace all items (loses data), block if conflict (too restrictive)

### DEC-047 — Shared Expenses During Outing Mode
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: Users can register shared expenses within an active Outing Mode session. The session's personal cost only includes the user's share. Financial flow tracks the full amount from the payer's wallet
- **Rationale**: Splitting a bar tab is the most common shared expense scenario — it must work inside the main feature
- **Alternatives**: Shared expenses only outside outing (poor UX for the core use case)

### DEC-048 — Alerts: Visual + Optional Vibration
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: Progressive alerts use visual banners/toasts. Vibration uses browser Vibration API when supported AND user has enabled it in settings. Default: vibration on. Never depend solely on vibration. Future Capacitor version adds reliable haptics
- **Rationale**: PWA vibration is unreliable across devices. Visual must be the primary channel
- **Alternatives**: Vibration required (not supported everywhere), no vibration option (missed sensory feedback)

### DEC-049 — End Outing: Single Review Screen
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: End-of-session uses a single screen with expandable blocks: total, items, adjustments, shared items, wallet, cash difference, classification (típica/especial/excluir do aprendizado). Blocks with conflicts are highlighted. Final CTA: "Confirmar e encerrar saída"
- **Rationale**: Multi-step wizard is too long for 1am in a bar. Single screen with expandable sections is faster
- **Alternatives**: Multi-step wizard (too much friction), auto-close (loses confirmation)

### DEC-050 — Simulator: Multiple Access Points + Combined Risk Factors
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: Simulator accessible via: FAB menu ("Simular compra"), Amigo Sincero card ("Ver impacto completo" — pre-filled), Planner, direct route /simulator, "Mais" tab. Risk levels use combined factors: Comfortable = reserves intact + essentials covered + margin healthy; Attention = reduces optional activities or margin significantly; Avoid = touches protected reserve, reduces future floor, or leaves essentials uncovered. Always show explanation. Not user-configurable in MVP
- **Rationale**: Simulator is a core feature that should be reachable from every relevant context. Single-factor risk assessment is too simplistic
- **Alternatives**: Single access point (poor discoverability), percentage-only risk (misleading)

### DEC-051 — Wallet: Optional Selection + "Carteira não informada"
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: Wallet selection is optional during quick-add. If skipped: save as "Carteira não informada", mark for review. Dashboard/wallet area shows "Você possui N gastos sem carteira informada. Revisar agora". Expense list has filter "Somente gastos sem carteira". Wallet correction later doesn't affect personal cost, category, fund, or forecasts (unless it affects specific financial flow). Default wallet pre-selects but can be cleared. Add generic editable "Cartão de crédito" wallet. No "Outra carteira"
- **Rationale**: Quick registration must have minimal friction. Missing wallet is better than blocking the registration or slowing the user down at 1am
- **Alternatives**: Wallet required (friction), silent default (hides data quality issue)

### DEC-052 — Cash Reconciliation Flow
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: User counts physical cash → inputs amount → app compares with expected balance → shows difference. If negative (spent more than tracked): offer to create "Ajuste de dinheiro físico" expense with chosen category. If positive (more cash than expected): create positive correction with justification. Both affect wallet balance and budget
- **Rationale**: Cash tracking is inherently imprecise. Reconciliation closes the gap without forcing real-time perfection
- **Alternatives**: Ignore differences (inaccurate wallet), force tracking (impossible with cash)

### DEC-053 — Edge Cases: Never Block Registration
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: (a) Budget at zero: show critical state (red), simulator classifies optional spending as "Evitar", allow continuation with confirmation. (b) Outing exceeds max: don't block, change to risk state, show direct message, require confirmation for new quick-adds (15-min unlock to avoid repetition). (c) Session crosses phase boundary: don't auto-close, on manual close offer: keep in original phase / move to current / split by time. (d) First offline: requires initial online load to cache; show "Pronto para uso offline" only after confirmed caching
- **Rationale**: Real life doesn't stop at budget limits. The app must record reality accurately. Blocking registration would cause data loss
- **Alternatives**: Block at limits (causes inaccurate tracking), auto-close sessions at phase boundary (loses data)

### DEC-054 — React Router v7 + react-i18next + Tests from D1
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: Router: React Router v7 with Data Mode (createBrowserRouter). i18n: react-i18next from D1, pt-BR as initial language, prepare en/es structure without translating. Tests: Vitest (domain), RTL (critical components), Playwright (main flows) — all from Delivery 1. Priority: budget calculations, splits, withdrawals, settlements, multi-phase pools, reserves, backup/import. Cloudflare Pages: SPA routing by default, _redirects only if needed after testing
- **Rationale**: Solid foundations from day one. Hardcoded strings are technical debt that compounds. Domain logic is too critical to ship untested
- **Alternatives**: TanStack Router (unnecessary complexity), hardcoded strings (debt), tests later (risk)

### DEC-055 — D1 Dashboard: Real Data Only + Basic Planner Tab
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: Dashboard in D1 shows only implemented features: phase info, "Livre para usar", fund balance breakdown, personal shopping, recent expenses, FAB button, empty states. Cards for occasions, savings, amigo sincero, active outing, and pending expenses are hidden until their engines exist — no fake data. "Planejar" tab in D1 shows basic editor: phases, funds, protected reserve, future floor, personal shopping, initial profiles. Full planner with [-]/[+] controls and trade-offs appears with D3
- **Rationale**: Fake placeholder data misleads. A functional but incomplete dashboard is better than a beautiful but dishonest one
- **Alternatives**: Full dashboard with placeholders (misleading), empty dashboard (poor UX)

### DEC-056 — Participant Data: Minimal + Future-Ready
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: V1 participant: name (required), nickname (optional). Schema prepared with optional email and linkedUserAccountId for future sync. No phone number. Shared expenses created locally can be confirmed immediately for the user's own share. Pending shared expense card hidden when empty in V1 production
- **Rationale**: Local-first V1 doesn't need contact info. But schema should be ready for multi-device sync
- **Alternatives**: Full contact info (unused in V1), no preparation (migration pain later)

### DEC-057 — Settings V1 Scope
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: V1 settings: alert tone (amigo sincero/calmo/direto), default currency (EUR, structure ready for others), quick-add default values, default wallet, vibration toggle, backup reminder (on/off + days, default 7), theme (dark/light/system), language (pt-BR), device name (optional, for backup), persistent storage status. NOT in settings: personal shopping limit, protected reserve, future floor, profiles — these belong in trip/fund/planner editors
- **Rationale**: Settings = app-wide preferences. Trip-specific financial configurations belong in their respective editors
- **Alternatives**: Mix everything in settings (confusing), minimal settings (loses configurability)

### DEC-058 — CSV Export Fields
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: Basic CSV (17 fields): Data, Hora, Viagem, Fase, Fundo, Caixa, Categoria, Sessão, Descrição, Valor original, Moeda, Valor em moeda base, Carteira, Quem pagou, Custo pessoal, Valor compartilhado, Observações. Advanced CSV adds: ID, Tipo da movimentação, Status, Criado em, Atualizado em, Dispositivo de origem
- **Rationale**: Basic covers spreadsheet analysis needs. Advanced covers data portability/debugging
- **Alternatives**: Single format (either too simple or too complex for different users)

### DEC-059 — "Mais" Tab: Sectioned List
- **Date**: 2026-06-08
- **Status**: SUPERSEDED by DEC-180 (2026-06-15) — the "Mais" tab became **Viagem + Copiloto** and `MorePage` was deleted; its sections were redistributed, nothing removed (ÂNCORA 9). [reconciled 2026-06-17]
- **Decision**: "Mais" tab opens a list with sections: Viagem (Visão geral, Editar fases, Fundos, Perfis, Participantes e dívidas, Carteiras), Dados (Relatórios, Exportar para planilha, Backup e importação), Aplicativo (Configurações, Sobre)
- **Rationale**: Clean organization by category. Avoids dumping everything into a flat settings page
- **Alternatives**: Card-based layout (heavier), flat list (harder to scan)

### DEC-060 — Trip Overview Navigation Logic
- **Date**: 2026-06-08
- **Status**: APPROVED
- **Decision**: Single active phase → open phase dashboard directly. No active phase → open trip overview. Multiple active phases → open trip overview with phase selection. Trip overview also accessible via: phase name tap in header, "Mais" tab. When /outings/active has no active session → redirect to /outings/new or show "Nenhuma saída ativa. Começar nova saída"
- **Rationale**: Most users have one active phase. Don't add an extra tap for the common case
- **Alternatives**: Always show trip overview first (extra tap), always show last viewed phase (confusing after phase change)

### DEC-061 — Backup Reminder Default: 7 Days (was D-A)
- **Date**: 2026-06-09
- **Status**: APPROVED
- **Decision**: Backup reminder default is 7 days, as DEC-057 specified. The code default of 3 days was a divergence and was corrected
- **Rationale**: Truth Policy — DEC wins over code
- **Alternatives**: Keep 3 days (would require amending DEC-057)

### DEC-062 — Quick-Add Defaults: €3/5/7/10/15 (was D-B)
- **Date**: 2026-06-09
- **Status**: APPROVED
- **Decision**: Default quick-add values are [300, 500, 700, 1000, 1500] cents, defined once in the outing domain (`DEFAULT_QUICK_ADD_VALUES_CENTS`) and consumed by the settings repository and OutingPage. Divergent fallbacks eliminated
- **Rationale**: DEC-045 wins over code; single source of truth
- **Alternatives**: Keep code values €3/5/10/15/20 (violates DEC-045)

### DEC-063 — Pending Shared Criterion (was D-C)
- **Date**: 2026-06-09
- **Status**: SUPERSEDED by DEC-071 (2026-06-09)
- **Decision**: A shared transaction is "pending confirmation" when at least one third-party `participantShare` is not yet covered by settlements (FIFO coverage of the participant's total debt). Fully settled → disappears from the dashboard card (DEC-056)
- **Rationale**: Only verifiable criterion with the current local-first model
- **Alternatives**: isPaid flag per share (ignores settlements), manual confirmation (extra friction)

### DEC-064 — "Mais" Menu: About Without Reports (was D-D)
- **Date**: 2026-06-09
- **Status**: SUPERSEDED by DEC-180 (2026-06-15) — Settings/About moved to the home **gear**; the "Mais" menu no longer exists (replaced by Viagem + Copiloto). [reconciled 2026-06-17]
- **Decision**: "Mais" gets a dedicated "Sobre" item (version, backup link) under Aplicativo. "Relatórios" is NOT added — it is D3+ scope. This amends the screen list in DEC-059
- **Rationale**: implementation-phases.md wins over v1-screen-list.md
- **Alternatives**: Add a stub Reports entry (dead UI)

### DEC-065 — en/es Fully Translated (was D-E)
- **Date**: 2026-06-09
- **Status**: APPROVED
- **Decision**: `en.json` and `es.json` mirror 100% of pt-BR keys and are fully translated (not just structured). Settings offers 3 working languages
- **Rationale**: AI translation cost is trivial; eliminates the silent fallback
- **Alternatives**: Structure-only with pt-BR fallback (original DEC-054 plan, misleading UI)

### DEC-066 — Shared Settings State via Dexie liveQuery (was D-F)
- **Date**: 2026-06-09
- **Status**: APPROVED
- **Decision**: App-wide live settings (theme/language/alert tone) use `useLiveQuery` from dexie-react-hooks (`useLiveSettings` hook in AppShell). No Zustand, no extra Context layer
- **Rationale**: Idiomatic for Dexie, zero new layers; removes the need for zustand
- **Alternatives**: Zustand store (new dependency surface), React Context (manual invalidation)

### DEC-067 — Partial Orchestrator Layer (was D-H)
- **Date**: 2026-06-09
- **Status**: APPROVED
- **Decision**: Orchestrators created only for the flows touched in the gap-fix session: `registerExpense` (atomic tx+shares), `endOutingSession`, `withdrawCash`, `transferBetweenWallets`, `reconcileWallet`, plus backup orchestrators — all in `src/domain/orchestrators/` with tests. Full refactor of untouched pages is registered as technical debt
- **Rationale**: Fixes the real risk (orphan shares) without an out-of-scope refactor
- **Alternatives**: Full refactor (too large), no orchestrators (atomicity risk remains)

### DEC-068 — Remove Unused Dependencies (was D-G)
- **Date**: 2026-06-09
- **Status**: APPROVED
- **Decision**: `zustand` and `react-hook-form` removed from package.json (zero imports in src/). `@capacitor/core` stays per DEC-017 ("later")
- **Rationale**: Hygiene §4.1 of the engineering guidelines
- **Alternatives**: Keep them installed (dead weight)

### DEC-069 — Future Floor: Manual Only in V1 (was D-I)
- **Date**: 2026-06-09
- **Status**: APPROVED
- **Decision**: Future floor is a manual field (`futureFloorCents` on the pool↔phase link) editable in Funds. The automatic calculation from DEC-016 is deferred to D3+ and registered as debt
- **Rationale**: Matches the audit's own scoping; manual floor already fixes the dashboard line
- **Alternatives**: Automatic calculation now (D3+ scope creep)

### DEC-070 — Backup Reminder Banner via lastBackupDate (was D-J)
- **Date**: 2026-06-09
- **Status**: APPROVED
- **Decision**: `lastBackupDate` persists on every export. Dashboard shows a discreet banner (tap → backup page) when `today - lastBackupDate > backupReminderDays`, or when no backup was ever made and data exists. Logic in `isBackupReminderDue` (domain/backup)
- **Rationale**: Only way the reminder toggle stops being decorative
- **Alternatives**: Notifications API (overkill for local-first V1)

### DEC-071 — Explicit Confirmation of Shared Expenses
- **Date**: 2026-06-09
- **Status**: APPROVED (Julio: "ok, eu confirmo" — gap-analysis-r2 §6)
- **Decision**: `ParticipantShare.confirmationStatus: 'pending' | 'confirmed' | 'rejected'` (Dexie v3, default `'confirmed'` for existing data). Creator's share is born `confirmed`; third-party shares born `pending`. `calculateDebts` only consolidates confirmed shares; rejected shares return the value to the payer's personal cost. Dashboard card = third-party pending shares with tap → confirm/reject/adjust sheet; card disappears when all confirmed, regardless of netting/settlement
- **Rationale**: The user understands "pending confirmation" as an action expected from them; the derived-from-debt proxy (DEC-063) offered no action. Finally implements DEC-019
- **Supersedes**: DEC-063 · **Implements**: DEC-019 · **Design**: gap-analysis-r2 §3 FIELD-03

### DEC-072 — Planned Events via Extended PlannedOccurrence
- **Date**: 2026-06-09
- **Status**: APPROVED (Julio: "ok, eu confirmo")
- **Decision**: Extend `PlannedOccurrence` (Dexie v3): `+endDate: string|null` (multi-day), `+kind: 'event'|'sub_destination'`, `+reservedCents: number|null`, `+linkedSessionId: string|null`; `activityProfileId` becomes nullable. Index `[phaseId+plannedDate]`. UI: "Eventos desta fase" in phase editing + informative line in Planner + day card on dashboard with "Iniciar agora"/"Adiar". `reservedCents` deducts from freeToSpend until the occurrence is confirmed/linked to a session — then the real spending takes over
- **Rationale**: The table existed since DEC-043 with zero UI; extending 5 fields covers 1-day events, multi-day and sub-destinations with one UI
- **Reactivates**: DEC-043 · **Design**: gap-analysis-r2 §5 FIELD-05

### DEC-073 — One-Off Session Does Not Create a Recurring Profile
- **Date**: 2026-06-09
- **Status**: APPROVED (Julio: "ok, eu confirmo")
- **Decision**: The custom session flow asks "is this a one-off event?" → YES creates a PlannedOccurrence linked to the session (no ActivityProfile); NO keeps the current custom profile flow. `createCustomActivityProfile` is only reachable via Profiles/Planner/onboarding
- **Rationale**: One-off event ≠ recurring profile — root cause of the Parral contamination (FIELD-04)
- **Affects**: DEC-037 · **Fixes**: FIELD-04 · **Design**: gap-analysis-r2 §5 FIELD-05

### DEC-074 — Activities Enabled Per Phase
- **Date**: 2026-06-09
- **Status**: APPROVED (Julio: "ok, eu confirmo" + pediu catálogo maior de presets populares de viagem)
- **Decision**: New table `phaseProfileSettings` (SyncMetadata + phaseId + activityProfileId + isEnabled), index `[phaseId+activityProfileId]`; absence of row = enabled (permissive default). Chips in phase editing (preset catalog of popular travel activities + existing trip profiles + "+ Outro"); Planner hydrates/persists only enabled profiles; counters and QuickAdd respect enabled
- **Rationale**: Each phase has its own activity "menu"; structurally kills the FIELD-04 Planner contamination
- **Affects**: DEC-015 · **Design**: gap-analysis-r2 §5 FIELD-01 + Julio's catalog adjustment

### DEC-075 — Phase Rhythm + Peak Days
- **Date**: 2026-06-09
- **Status**: APPROVED (Julio: "ok, eu confirmo")
- **Decision**: `Phase.rhythmPreset: 'intense'|'moderate'|'relaxed'|'custom'|null` + `Phase.peakDays: number[]|null` (0-6; null = uniform, current behavior). Domain: `calculateEffectiveSpendingDays` weights remaining days (peak=1.5, normal=1.0, calm per preset); `freeToSpendPerDay` weighted; "today is a peak day" microcopy in hero
- **Rationale**: Real trips have rhythm; "effective days" feeds forecasting with a single concept
- **Extends**: DEC-006 · **Design**: gap-analysis-r2 §5 FIELD-02

### DEC-076 — Counters Carousel Ordered by Usage
- **Date**: 2026-06-09
- **Status**: APPROVED (Julio: "ok, eu confirmo")
- **Decision**: Horizontal scroll-snap carousel (pure CSS), 3 visible, dots if >3; all profiles enabled in the phase, ordered: with spending in phase (desc by transaction count) → planned without usage; no usage at all → 3 most planned. Cards clickable → filtered expense list
- **Rationale**: Fixed bar/market/restaurant counters hide other profiles
- **Extends**: DEC-055 · **Design**: gap-analysis-r2 §5 FIELD-06

### DEC-077 — Dashboard Insights V1
- **Date**: 2026-06-09
- **Status**: APPROVED (Julio: "ok, eu confirmo")
- **Decision**: Rotating "Insights" block (1 card at a time, dots, max 4/day) with 6 V1 cards: end-of-phase projection (uses effective days), real vs planned rhythm, days without spending, average cost per outing, balance with participants, next event. Significance rules (e.g. projection only with ≥3 days of data); daily calculation persisted in `forecastSnapshots`
- **Rationale**: Model data should become insight without polluting the dashboard
- **Reactivates**: forecastSnapshots · **Design**: gap-analysis-r2 §5 FIELD-07

### DEC-078 — Quick Post-Value Categorization
- **Date**: 2026-06-09
- **Status**: APPROVED (Julio: "ok, eu confirmo")
- **Decision**: Optional inline stepper after session quick-add (transaction saved BEFORE any question): "what was it?" (category icons) → "who paid?" → "split?"; each step 1 tap = record and advance; skip or 3s without interaction = dismiss. Updates category/paidByParticipantId/shares via `buildSharesWithPayer`; shares follow DEC-071
- **Rationale**: Registration stays 1 tap (DEC-053); enrichment is optional and instantaneous
- **Reinforces**: DEC-053 · **Design**: gap-analysis-r2 §5 FIELD-08

### DEC-079 — Outing History
- **Date**: 2026-06-09
- **Status**: APPROVED (Julio: "ok, eu confirmo")
- **Decision**: "Saídas" tab inside Expenses (segmented control) + shortcut in "Mais"; list with name/date/duration/total/item count/profile badge; detail at `/outings/:id/review` reusing the end-of-session review screen in read-only mode
- **Rationale**: Outings ARE grouped expenses; users look for them in Expenses
- **Design**: gap-analysis-r2 §5 FIELD-09

### DEC-080 — Fund/Phase Edit-Delete Policy
- **Date**: 2026-06-09
- **Status**: APPROVED (Julio: "ok, eu confirmo")
- **Decision**: Soft delete everywhere. Fund: editable name/value; delete only without active transactions — with transactions, offer reassignment to another pool or block with explanation; cascade soft delete to links/envelopes/policies. Phase: delete only without transactions/sessions — with data, block with explanation; reorder remaining phases; never delete the last phase. All via BottomSheet confirmation
- **Rationale**: CRUD was intentionally incomplete; safety rules prevent orphan data
- **Design**: gap-analysis-r2 §3 FIELD-11

### DEC-081 — Global Mobile Feel
- **Date**: 2026-06-09
- **Status**: APPROVED (Julio: "ok, eu confirmo")
- **Decision**: `user-select: none` global with inputs/textarea/contenteditable preserved; `-webkit-tap-highlight-color: transparent`; `touch-action: manipulation` on interactive elements
- **Rationale**: Browser text-selection defaults break the native-app feel
- **Design**: gap-analysis-r2 §3 FIELD-10

### DEC-082 — Visible Version Updates
- **Date**: 2026-06-09
- **Status**: APPROVED (Julio: "ok, eu confirmo")
- **Decision**: Service worker becomes network-first with offline fallback for navigation/`index.html` (hashed assets stay cache-first); persistent toast "Nova versão disponível — toque para atualizar" triggering `skipWaiting` + reload when a new SW is waiting
- **Rationale**: Cache-first index.html + silent update trapped users on old bundles — root cause of FIELD-03/FIELD-12a field reports
- **Extends**: DEC-053d / GAP-036 · **Design**: gap-analysis-r2 §4 GAP-R2-001

### DEC-083 — Complete Light Theme
- **Date**: 2026-06-09
- **Status**: APPROVED (Julio: "ok, eu confirmo")
- **Decision**: Theme + language applied at root level (all routes, including those outside the AppShell); the 12 hardcoded dark colors → tokens; dynamic `theme-color` meta via JS per theme
- **Rationale**: BottomNav invisible in light theme (hardcoded dark) + routes outside the shell never applied `data-theme`
- **Extends**: DEC-066, DEC-022 · **Design**: gap-analysis-r2 §3 FIELD-12 / §4 GAP-R2-002/003

### DEC-084 — Fixed Headers on All Screens
- **Date**: 2026-06-10
- **Status**: APPROVED (Julio R3 audio review)
- **Decision**: Header + key controls stay fixed at the top on Dashboard (date range + phase name + bell), Expenses (header + filter bar) and Planner (header + phase selector + summary + over-budget warning); only content scrolls. Single technical pattern (sticky/fixed + scroll container) with solid theme background and subtle elevation on scroll
- **Rationale**: "Quando eu rolo a página, o header deveria continuar sempre fixo em cima — dá um ar mais profissional"
- **Design**: gap-fix-r3 R-01

### DEC-085 — Compact Standardized Margins
- **Date**: 2026-06-10
- **Status**: APPROVED (Julio R3 audio review)
- **Decision**: Single page side-padding token (~16px) applied to ALL pages; dashboard loses its extra margin; all dashboard cards share the same width/margin aligned with the carousel; carousel counter cards get identical fixed height (2-line name space)
- **Rationale**: "Todas as páginas estão com margens laterais muito grandes — a de início é a pior"; uneven card heights look broken
- **Design**: gap-fix-r3 R-02/R-03

### DEC-086 — Invisible Horizontal Scrollbars
- **Date**: 2026-06-10
- **Status**: APPROVED (Julio R3 audio review)
- **Decision**: Scroll behavior kept, scrollbar visuals removed (CSS utility with `scrollbar-width: none` + `::-webkit-scrollbar`) on the Expenses filter bar, counters carousel and any other horizontal scroller
- **Rationale**: Visible horizontal scrollbars scream "web page", not app
- **Design**: gap-fix-r3 R-04

### DEC-087 — Pull-to-Refresh Disabled in PWA
- **Date**: 2026-06-10
- **Status**: APPROVED (Julio R3 audio review)
- **Decision**: `overscroll-behavior-y: none` to eliminate the browser reload gesture in the installed app (standalone display-mode)
- **Rationale**: "Se eu puxo a tela para baixo aparece o ícone de recarregar do navegador — mostra que é uma página web"
- **Design**: gap-fix-r3 R-05

### DEC-088 — Subtractive "Free to Use Today"
- **Date**: 2026-06-10
- **Status**: APPROVED (Julio R3 audio review)
- **Decision**: "Free to use today" = today's allowance (fixed at day start, computed WITHOUT today's spending) − amount spent today. The recalculated daily average becomes a secondary metric with an explicit name
- **Rationale**: "Se eu gasto €2, deveria sobrar €4" — the recalculated average barely moves and breaks the promise of the title
- **Design**: gap-fix-r3 R-06

### DEC-089 — Remove "Reserved for [next phase]" from Hero
- **Date**: 2026-06-10
- **Status**: APPROVED (Julio R3 audio review) · **RECONCILED by DEC-219** (2026-06-18) — the per-phase-fund direction this decision pointed at became **canonical**: each trecho owns its dedicated pool and the dashboard now follows the **active phase's** pool (fixing the `linkedPools[0]` bug). No contradiction — DEC-219 finishes what this started.
- **Decision**: Remove the future-floor line from the dashboard hero; each phase now has its own fund, nothing from the current phase rolls to the next. Future floor mechanics stay intact and visible in Funds/Planner
- **Rationale**: Line is a leftover from the single-fund era and confuses the current per-phase model
- **Design**: gap-fix-r3 R-07

### DEC-090 — Notifications Center
- **Date**: 2026-06-10
- **Status**: APPROVED (Julio R3 audio review)
- **Decision**: Bell → `/notifications` screen with notifications DERIVED from existing data (pending share confirmations, today's event, overdue backup, long-running outing, phase over-budget); each with icon, text and destination; badge = active notification count; pretty empty state. Bell never points to /shared again
- **Rationale**: "Clico no sino e vai para participantes e dívidas — não faz sentido nenhum"
- **Design**: gap-fix-r3 R-08

### DEC-091 — Insights: Swipe Navigates, Tap Details
- **Date**: 2026-06-10
- **Status**: APPROVED (Julio R3 audio review)
- **Decision**: Insight carousel switches by horizontal swipe (scroll-snap, dots kept); tap opens the content of THAT insight: projection/rhythm → calculation detail sheet; debt → /shared; next event → event editor; outing cost → /expenses?tab=outings
- **Rationale**: "O usuário vai querer clicar em tudo — tem que levar para algum lugar"
- **Design**: gap-fix-r3 R-09

### DEC-092 — Contextual Savings Card Copy
- **Date**: 2026-06-10
- **Status**: APPROVED (Julio R3 audio review)
- **Decision**: Savings copy references the specific last outing explicitly with reference values ("Na sua última saída de [perfil], você gastou €X — €Y abaixo do seu normal (€Z)"); shown only with a recent closed outing AND reliable typical value
- **Rationale**: Percentage without base reads as trip-wide savings when it is event-specific
- **Design**: gap-fix-r3 R-10

### DEC-093 — Honest Friend v2 Based on the Plan
- **Date**: 2026-06-10
- **Status**: APPROVED (Julio R3 audio review)
- **Decision**: Honest Friend compares against the PLANNED occasions (ScenarioPlan allocations), projects the date the reserve starts being used; positive reinforcement when within plan; honest fallback without a plan. "Ver impacto completo" opens an Impact Detail screen (planned vs spent, projection, reserve risk date, CTA to Planner) — never the simulator
- **Rationale**: "Suas saídas de bar caíram de 197 para 195 — eu nunca teria 195 saídas de bar!"
- **Design**: gap-fix-r3 R-11

### DEC-094 — Multi-Metric Simulator
- **Date**: 2026-06-10
- **Status**: APPROVED (Julio R3 audio review)
- **Decision**: Simulation result shows 3 perspectives: % of available + remainder; equivalence in days of daily allowance; impact on planned occasions. Verdict (ok/attention/risk) takes the worst of the three
- **Rationale**: "'Posso gastar?' é diferente de 'tenho dinheiro?' — €20 são 4 dias do meu orçamento diário"
- **Design**: gap-fix-r3 R-12

### DEC-095 — Expense Subcategory Taxonomy per Outing Type
- **Date**: 2026-06-10
- **Status**: APPROVED (Julio R3 audio review)
- **Decision**: Data-driven catalog (`expense-taxonomy.ts`) with subcategories per outing/profile type (bar → drink, beer, food...; market → proteins, pasta...), each with i18n label, icon and typical value in cents; options ordered by proximity to the typed amount; new non-indexed `subcategoryId` field on Transaction (no Dexie v4)
- **Rationale**: "Estou numa saída de BAR e ele me pergunta se o gasto é 'bar, restaurante, transporte' — isso é tipo de SAÍDA, não tipo de GASTO!"
- **Design**: gap-fix-r3 R-13

### DEC-096 — Stepper ≥10s + Category in Split + 2 Levels for Events
- **Date**: 2026-06-10
- **Status**: APPROVED (Julio R3 audio review)
- **Decision**: Enrich stepper auto-dismiss raised from 3s to 10s with any interaction resetting the timer; session split flow gains the subcategory step; single-event sessions ask in 2 levels (context → subcategory of that context)
- **Rationale**: "Ele some muito rápido — não consegui clicar"; split and events left expenses without any item info
- **Design**: gap-fix-r3 R-14/R-16/R-17

### DEC-097 — Session Items Show the Subcategory
- **Date**: 2026-06-10
- **Status**: APPROVED (Julio R3 audio review)
- **Decision**: Active-session history and outing detail show WHAT was bought (subcategory icon + name), never the session/outing type repeated; uncategorized items show value + "tap to detail" reopening the stepper
- **Rationale**: "Aparece 'restaurante, restaurante, restaurante' — eu JÁ SEI que estou no restaurante!"
- **Design**: gap-fix-r3 R-15/R-18

### DEC-098 — Planner: Live Free Margin + Top Alert
- **Date**: 2026-06-10
- **Status**: APPROVED (Julio R3 audio review)
- **Decision**: Free margin recalculates on EVERY allocation tap; when over budget it shows the NEGATIVE value in error color (not 0) and an emphatic over-budget banner moves into the fixed header block, visible without scrolling. Reduction recommendation card stays where it is
- **Rationale**: "Estourei o valor e olhando o topo está tudo normal — o aviso está escondido lá embaixo"
- **Design**: gap-fix-r3 R-19/R-20

### DEC-099 — Category Menu in Planner + Editable Profiles
- **Date**: 2026-06-10
- **Status**: APPROVED (Julio R3 audio review)
- **Decision**: Tap on a category name in Planner opens a BottomSheet menu: edit profile typical value, remove from this phase, classification. ProfilesPage gains edit (name, icon, typical, safe) and remove (soft delete with in-use safety rule)
- **Rationale**: "O transporte está €8 — um transporte pode ser €1!"; "não consigo TIRAR uma categoria do planejador"
- **Design**: gap-fix-r3 R-21/R-24

### DEC-100 — Per-Phase Classification + Lock with Real Effect
- **Date**: 2026-06-10
- **Status**: APPROVED (Julio R3 audio review)
- **Decision**: Essential/planned/optional classification lives PER PHASE (phaseProfileSettings); essential is never suggested for reduction, optional is the first candidate; locked item is ignored by presets and "apply recommendation" with visual feedback
- **Rationale**: "Mercado é essencial em Burgos mas NÃO na eurotrip"; "o cadeado não faz NADA"
- **Design**: gap-fix-r3 R-22

### DEC-101 — Planner Event Opens the Event Editor
- **Date**: 2026-06-10
- **Status**: APPROVED (Julio R3 audio review)
- **Decision**: Tap on an event in Planner opens the occurrence edit sheet directly (not Trip Edit at the top); same destination reused by the "next event" insight and the day card
- **Rationale**: "Cliquei em Veneza e ele abriu o Editar Viagem lá no topo"
- **Design**: gap-fix-r3 R-23

### DEC-102 — Debt Statement per Participant
- **Date**: 2026-06-10
- **Status**: APPROVED (Julio R3 audio review)
- **Decision**: Tap on a participant in /shared expands the statement: every share composing the balance (expense description/subcategory, date, share value, payer, status) plus applied settlements
- **Rationale**: "Eu clico na Débora e ele deveria mostrar exatamente DE ONDE veio o €1,12"
- **Design**: gap-fix-r3 R-25

### DEC-103 — Device-to-Device Sync Channel (R4)
- **Date**: 2026-06-10
- **Status**: APPROVED (Julio: council session on P2P sync — "registre no brain e implemente")
- **Decision**: TripPilot gains a user-initiated, session-based device-to-device channel: WebRTC DataChannel between two phones, with signaling via a minimal Cloudflare Worker + Durable Object (free tier). All payloads are end-to-end encrypted (AES-GCM 256; the key travels inside the QR code and never reaches the server). Fallback chain: (a) encrypted relay through the same signaling WebSocket when direct P2P fails; (b) two-QR manual signaling for offline use on a shared Wi-Fi/hotspot; (c) single-QR payload transfer when the compressed payload fits one scannable QR (~1.2 KB)
- **Rationale**: Council (4 perspectives) converged: the data model was sync-ready since D1 (SyncMetadata, Device, DEC-018/056) and the highest-value flows (device migration, debt statements) need no backend and no accounts. Sessions are explicit user actions — the V1 exclusion "no AUTOMATIC background sync" still stands
- **Alternatives**: Web Bluetooth (unsupported on iOS Safari), backend with accounts (violates local-first), QR-only animated transfer (poor UX for 182 KB, kept out per DEC-108)

### DEC-104 — Device Migration via Direct Transfer
- **Date**: 2026-06-10
- **Status**: APPROVED
- **Decision**: "Receber de outro aparelho" on the Welcome screen and send/receive options on the Backup page. The full backup (BackupData JSON) travels over the DEC-103 channel; the receiver goes through the existing import preview (analysis + merge/replace choice). The JSON file export/import (DEC-013) remains as manual fallback
- **Rationale**: Highest-value, lowest-risk use case (council consensus): one-directional, no merge semantics beyond what import already does
- **Alternatives**: Cloud backup (needs backend), file-only transfer (friction was the original complaint)

### DEC-105 — Actor Identity Without Accounts
- **Date**: 2026-06-10
- **Status**: APPROVED
- **Decision**: Each install's identity (actorId) is the existing per-install device id (`trippilot_device_id`). The identity QR carries `{ actorId, displayName }`. Scanning it registers a Participant with the new non-indexed field `Participant.linkedActorId`. Typing a name stays the default path; pairing is an optional upgrade and can be done retroactively on an existing participant
- **Rationale**: Executes DEC-018/DEC-056 without accounts or login; no Dexie migration needed for the field
- **Alternatives**: UserAccount entity now (overkill), email-based identity (privacy + friction)

### DEC-106 — Owner/Mirror Debt Model (no bidirectional merge of money)
- **Date**: 2026-06-10
- **Status**: APPROVED
- **Decision**: Financial truth for a shared expense lives ONLY on the owner device (who registered it). Peers receive a read-only mirrored statement (new `mirroredStatements` table, one per peer actor) and can confirm/reject pending lines on their own phone; those responses flow back and update `ParticipantShare.confirmationStatus` on the owner device (DEC-071 semantics). Responses produced while disconnected are queued inside the mirrored statement and flushed on the next session. New Dexie v4: `peerLinks` + `mirroredStatements` tables; backup format v4 includes both
- **Rationale**: Critic's HIGH risk: last-write-wins merge silently rewrites money. Owner/mirror keeps the engine single-device while giving the peer real visibility and real actions
- **Alternatives**: CRDT/event-log bidirectional sync (distributed-system complexity, V2+ at most)

### DEC-107 — Signaling Worker Scope
- **Date**: 2026-06-10
- **Status**: APPROVED
- **Decision**: The `trippilot-sync` Worker only creates short-lived rooms (6-char codes, ~10 min expiry via DO alarm) and relays opaque messages between exactly 2 WebSocket peers. It never stores payloads, never sees plaintext (E2E key stays in the QR), has no database beyond the in-room state, and lives in `worker/` inside the repo
- **Rationale**: Keeps the "no backend" promise honest: the Worker is a introduction service, not a data service. Free tier covers it (~10 small messages per pairing)
- **Alternatives**: TURN server (cost/complexity; encrypted relay over the same WebSocket covers the failure case), third-party signaling (new dependency surface)

### DEC-108 — P2P V2 Deferrals
- **Date**: 2026-06-10
- **Status**: APPROVED
- **Decision**: Explicitly deferred to V2+: real-time table split (each person confirming at the table), group trips with multi-device merge, live shared outing sessions, settlement handshake (simultaneous settlement records on both devices), animated multi-QR transfer
- **Rationale**: Council ranking — each needs either bidirectional merge maturity or has niche value; shipping the owner/mirror foundation first de-risks all of them
- **Alternatives**: Big-bang group sync (rejected: HIGH risk of becoming a regret feature)

### DEC-109 — DB Failure Never Becomes Onboarding
- **Date**: 2026-06-10
- **Status**: APPROVED
- **Decision**: `useAppData` gains an explicit error state (catch + 10s watchdog). On failure the app shows a recovery screen ("your data was NOT deleted" + retry that reopens Dexie) and NEVER redirects to /welcome. Welcome redirect only happens when the load SUCCEEDED and `onboardingCompleted === false`
- **Rationale**: R5 field test: an IndexedDB hang/failure (known WebKit issue in standalone PWAs after share-sheet/backgrounding) made the app look wiped — data was still on disk. Treating read failure as "empty state" invites destructive re-onboarding/imports
- **Alternatives**: Silent retry loop (hides the problem), auto-clearing the DB (destructive)

### DEC-110 — iOS-Safe File Export via Web Share
- **Date**: 2026-06-10
- **Status**: APPROVED
- **Decision**: File export prefers `navigator.share({ files })` when supported; fallback is a blob anchor with `target="_blank"` and `URL.revokeObjectURL` deferred by 10s. All export/import button handlers get try/catch + danger toast + busy state. The current page is never navigated to a blob URL
- **Rationale**: R5: JSON export froze the standalone PWA — iOS ignores `a.download`, navigates the webview to a blob URL that was already revoked synchronously
- **Alternatives**: File System Access API (no iOS support), data: URLs (size limits)

### DEC-111 — Demo Repair Restricted to Demo Trips
- **Date**: 2026-06-10
- **Status**: APPROVED
- **Decision**: `repairDemoTripIfNeeded` only rewrites trip/phase dates when `settings.isDemo === true`. Recreating missing activity profiles remains allowed for any trip
- **Rationale**: The repair ran for ANY active trip with no currently-active phase (future or finished trips), silently rewriting real user dates around "today" — data corruption
- **Alternatives**: Keep behavior with a confirmation dialog (still wrong: real dates are user truth)

### DEC-112 — Planner Deficit Warning Derived from State, Not Session
- **Date**: 2026-06-10
- **Status**: APPROVED
- **Decision**: The recommendation card ("reduce X and Y") renders whenever a deficit exists, including after re-entering the Planner (when session baselines equal persisted counts, the deficit is `-liveMarginCents`). The "you added N" headline stays conditioned on session additions, itemized per category
- **Rationale**: R5: the guidance disappeared after navigating away because the block required `modifiedProfiles.length > 0` — but the plan was still over budget
- **Alternatives**: Persisting session baselines (complex, wrong concept)

### DEC-113 — Outing Gauge Piecewise Mapping
- **Date**: 2026-06-10
- **Status**: APPROVED
- **Decision**: The spending dot position maps piecewise onto the fixed visual segments: spent∈[0,target]→[0,42.86%], (target,ceiling]→(42.86,71.43%], (ceiling,max]→(71.43,100%], >max→100%. Pure domain function with degenerate-case handling; marker redesigned as a clamped value pill above the dot
- **Rationale**: R5: segments have fixed 3:2:1:1 widths but the dot used linear spent/max — 40 of 35/45/55 landed visually past the 45 threshold
- **Alternatives**: Proportional segment widths (breaks the deliberate visual rhythm of the bar)

### DEC-114 — Universal Payer Semantics (D-R4-A)
- **Date**: 2026-06-11
- **Status**: APPROVED
- **Decision**: Registering an expense means registering MY COST. "Someone else paid" NEVER means a gift: my personal cost is kept (my share when split, the FULL amount when not split) and a debt to the payer is created; my wallet is not moved. Applies to ALL flows (QuickAdd, outing stepper, outing split, shared expenses). Implemented as a single reusable domain truth-table function
- **Rationale**: R4 field review: +€15 paid by Ana without splitting reset the outing total to €20 — the app treated it as a gift. The user owes the full €15; the app must remember the debt and keep the personal cost
- **Alternatives**: Treat as gift (rejected: hides real debt), force manual split for the simple case (rejected: friction)

### DEC-115 — Occasion = Session (D-R4-B)
- **Date**: 2026-06-11
- **Status**: APPROVED
- **Decision**: Occasion counting groups transactions by session: 1 outing/session = 1 occasion of its profile; standalone expenses with a profile/category = 1 occasion each. Never count session items as occasions
- **Rationale**: R4 field review: Honest Friend showed "bar: 20 of 5 occasions — within plan" while the user had 3 bar outings (9+8+3 items). Users plan "go to the bar 5 times", not "5 bar items"
- **Alternatives**: Count items (rejected: wrong mental model), time-window clustering (rejected: sessions already exist)

### DEC-116 — Simulator v3 Contextual (D-R4-C)
- **Date**: 2026-06-11
- **Status**: APPROVED
- **Decision**: Simulator asks amount + WHERE the money will be spent (enabled phase profiles + upcoming events + "other"); the engine looks in the right place (category plan occasions, event reservedCents, free/daily allowance) and every output line is a full labeled sentence; the verdict always states the concrete reason ("risky because…", "fine: you reserved for this")
- **Rationale**: R4 field review: "0 days of your daily free €524.10" and "10 + 2 = 5x transporte" were unreadable; verdicts said "risky" without the risk; without knowing WHERE, the simulator cannot know whether money is already reserved
- **Alternatives**: Keep context-free simulation (rejected: produces wrong verdicts when money is reserved)

### DEC-117 — Honest Outing Limit Semantics (D-R4-D)
- **Date**: 2026-06-11
- **Status**: APPROVED
- **Decision**: Outing zone colors and copy change AT the target, not near the max. Below target = green/neutral; target→ceiling = orange "you passed the target by €X — this comes out of other things"; ceiling→max = red "compromising the phase budget"; max = strong red + confirmation. "Safe ceiling" naming dropped ("Teto"); no text above the target may invite further spending
- **Rationale**: R4 field review: "safe ceiling" invited spending up to it; above the target the app still said "you can spend with ease: €0" and "the next €3.50 drink still fits" — encouraging overspending
- **Alternatives**: Keep yellow until near max (rejected: dishonest), hard block at target (rejected: paternalistic)

### DEC-118 — Long-Press Multi-Select in Lists (D-R4-E)
- **Date**: 2026-06-11
- **Status**: APPROVED
- **Decision**: Reusable selection-mode infrastructure: long-press enters selection, tap toggles items, a bottom action bar offers batch actions (delete via soft delete + single confirmation), X cancels. Applied to the expense list and outing history; other lists as useful
- **Rationale**: R4 field review: deleting several expenses one by one is painful; standard mobile pattern
- **Alternatives**: Swipe-to-delete per item (rejected: no batch), checkbox edit mode behind a menu (rejected: hidden)

### DEC-119 — Configurable Dashboard (D-R4-F)
- **Date**: 2026-06-11
- **Status**: APPROVED
- **Decision**: Long-press on a dashboard card opens a sheet: hide card + contextual quick action (data-driven per card type). Persisted in settings as `hiddenDashboardCards: string[]` + `dashboardCardOrder: string[]` (non-indexed, no Dexie bump). Hero and active-outing card are not hideable/movable. A slim "Configure home screen" card appears at the end when cards are hidden (plus a Settings entry); the config screen lists cards in order with ↑↓ reorder and visibility toggles
- **Rationale**: R4 field review: users want to hide cards they don't use and reorder the home screen; "delete that doesn't delete"
- **Alternatives**: Drag-and-drop reorder in V1 (rejected: ↑↓ buttons are enough and robust), fixed layout (rejected)

### DEC-120 — Persistent Active-Outing Notification, PWA Best Effort (D-R4-G)
- **Date**: 2026-06-11
- **Status**: APPROVED
- **Decision**: During an active outing, show a Service Worker notification with a fixed tag (name + current total) and quick-add action buttons (+€3, +€5, "Other" opens the app); button clicks register the expense from the SW (pure domain reused over IndexedDB) and update the notification; a follow-up notification asks the likely subcategory. Permission is requested at first session start with an explanation, never at boot. PWA platform limits are researched and documented; whatever PWA cannot do is registered for the Capacitor package (DEC-017)
- **Rationale**: R4 field review: "register without opening the app" — Spotify-style live notification with shortcuts
- **Alternatives**: Wait for Capacitor (rejected: PWA can deliver a useful subset now)

### DEC-121 — Contextual Help Mode (D-R4-H)
- **Date**: 2026-06-11
- **Status**: APPROVED
- **Decision**: Data-driven help registry in the domain (`help-content.ts`): per screen, a list of topics anchored to real UI sections, with i18n title + explanation containing CONCRETE examples. A "?" icon in complex screens' headers opens an overlay over the real screen annotating the actual elements, with next/previous navigation. V1 screens: Funds, Planner, Wallets, Phase/Events editing, Active outing, Backup
- **Rationale**: R4 field review: "I enter Funds and don't know what each thing is" — help must annotate the real screen with real examples, not abstract definitions
- **Alternatives**: Static help page (rejected: detached from the UI), first-run tour only (rejected: not on demand)

### DEC-122 — Carousels: One Item per Gesture, Consistent Alignment (D-R4-I)
- **Date**: 2026-06-11
- **Status**: APPROVED
- **Decision**: All carousels use `scroll-snap-stop: always` (one gesture = one slide) and `scroll-padding` aligned to the page margins so the initial state is identical to the post-snap state (first card aligned, exactly N visible)
- **Rationale**: R4 field review: first carousel card glued to the left edge showing a 4th icon; a strong insight swipe jumped from slide 1 to 4
- **Alternatives**: JS-driven carousel (rejected: CSS snap is enough)

### DEC-123 — "Who Paid?" as a First-Level Question (D-R4-J)
- **Date**: 2026-06-11
- **Status**: APPROVED
- **Decision**: Expense registration asks "Who paid?" (Me / Someone else) as a first-level post-amount question; if someone else: "they paid everything for you" OR "you split it" — without requiring a manual split setup for the simple case. Follows DEC-114 math
- **Rationale**: R4 field review: the common real-world case "Ana paid for me" needed an artificial split flow
- **Alternatives**: Keep payer buried inside split UI (rejected: the simple case is the frequent one)

### DEC-124 — Outing Notification v2: SW Single-Path + Settings Toggle + Rich Body (R-11 follow-up)
- **Date**: 2026-06-11
- **Status**: APPROVED
- **Decision**: (1) Notification action clicks are handled ENTIRELY by the service worker — direct IndexedDB write (mirroring `quickAddSessionExpense`, whose unit tests are the executable spec) + notification re-render from fresh DB state + `OUTING_DATA_CHANGED` broadcast to open windows. The v1 "delegate to open window" path is removed. (2) New `AppSettings.outingNotificationEnabled` toggle in Settings (status + blocked/unsupported hints) and an inline "enable notification" banner on the active outing screen whenever permission is missing. (3) Notification re-syncs on app boot, on tab refocus (visibilitychange) and on toggle-on — an active outing always has its notification. (4) Rich body: total vs target, remaining (or overshoot) and "≈N drinks until the target", re-rendered by the SW on every update via embedded templates + session limits. (5) Notification "open" goes to `/outings/active` (v1 pointed at a nonexistent `/outing` route)
- **Rationale**: Field test on Android: the v1 window-delegation path silently dropped postMessage on frozen background tabs — the expense only landed on refocus and the notification stayed stuck at €0 with no follow-up; there was also no way to (re)activate notifications after dismissing the one-time offer
- **Alternatives**: ACK + timeout fallback keeping the window path (rejected: two code paths, the rarely-exercised one rots; SW-only means the fallback is exercised on every click)

### DEC-125 — Overlays Escape Page Stacking Contexts (portal) + Draggable Help Card (R-09/R-12 follow-up)
- **Date**: 2026-06-11
- **Status**: APPROVED
- **Decision**: `SelectionBar` and the help overlay render through `createPortal(document.body)` — `.page-sticky-header` (position: sticky + z-index: 30) creates a stacking context that trapped any overlay rendered inside it under the bottom nav (z-40). SelectionBar sits at z-45 (covers the nav, below sheets at z-50, min-height covers the FAB notch); the help overlay sits at z-80, above nav and FAB. The help explanation card gains a grab handle and is draggable vertically (pointer events, clamped to the viewport) so it never hides the highlighted element
- **Rationale**: R4 field feedback: the selection bar appeared under the main bottom menu in Expenses, and the help card was behind the bottom menu on screens with sticky headers, sometimes covering content the user wanted to read
- **Alternatives**: Raising z-index inside the page tree (rejected: stacking context makes inner z-index irrelevant), fixed top position for the help card (rejected: still covers content; dragging lets the user decide)

### DEC-126 — Universal Undo via Toast Action (F2, v0.8.0)
- **Date**: 2026-06-12
- **Status**: APPROVED
- **Decision**: Every destructive action (single/batch expense delete, outing delete) shows a 6s toast with an "Undo" action instead of relying on confirmation dialogs alone. Soft deletes (Core Rule 4) gain restore twins (`restoreTransactionsBatch`, `restoreOutingSessionsBatch`) that clear `deletedAt` on the full cascade (transaction + shares + session items). A global `trippilot:data-changed` event makes `useAppData` consumers reload after restores
- **Rationale**: Brainstorm council: forgiveness beats confirmation friction; soft deletes already store everything needed for a perfect undo
- **Alternatives**: Trash screen with manual restore (rejected for V1: heavier UX for the same safety), hard confirmation dialogs everywhere (rejected: slows down the common case)

### DEC-127 — Bar Mode: Fullscreen Outing View with Wake Lock (F1, v0.8.0)
- **Date**: 2026-06-12
- **Status**: APPROVED
- **Decision**: Active outing gains a "Bar Mode" — a fullscreen portal (dark OLED background, oversized total + quick-add buttons) with Screen Wake Lock while open, designed for one-thumb use in dark venues. Quick-adds in bar mode skip the enrichment stepper and show an undo toast instead (`softDeleteSessionExpense`); over-ceiling/max confirmations exit bar mode and fall back to the normal sheets
- **Rationale**: Brainstorm council: the #1 real usage context (bar at night) deserves a dedicated ergonomic mode; wake lock prevents screen sleep between rounds
- **Alternatives**: Auto-entering bar mode on session start (rejected: explicit entry keeps control), Capacitor-native screen-on flag (kept for DEC-017)

### DEC-128 — Mental Currency Anchor (F4, v0.8.0)
- **Date**: 2026-06-12
- **Status**: APPROVED
- **Decision**: Optional "mental anchor": user picks a home currency and a MANUAL rate in Settings (`anchorCurrency`, `anchorRatePer1` in AppSettings); amounts in Quick Add, expense detail and Bar Mode show "≈ R$ 124" hints (whole units only). Never fetched from the network — offline-first, user-owned rate
- **Rationale**: Brainstorm council: travelers think in their home currency; a rough manual anchor kills the "is €20 a lot?" doubt without exchange-rate infrastructure
- **Alternatives**: Live exchange rates via API (rejected: network dependency + false precision), automatic per-currency formatting everywhere (rejected: clutter — hint only at decision points)

### DEC-129 — Yesterday Recap Dashboard Card (F7, v0.8.0)
- **Date**: 2026-06-12
- **Status**: APPROVED
- **Decision**: Movable dashboard card "Ontem": yesterday's spend vs that day's reconstructed allowance (DEC-088 add-back trick applied backwards), saved/overshoot delta and a streak counter ("3º dia seguido dentro do plano"). Hidden while there is no spending history
- **Rationale**: Brainstorm council: closing the loop on yesterday is the cheapest motivational insight the data already affords
- **Alternatives**: Weekly summary email/notification (rejected: out of scope), full history analytics screen (exists via Impact — the card is the glanceable summary)

### DEC-130 — Phase Burn-down Card (F5, v0.8.0)
- **Date**: 2026-06-12
- **Status**: APPROVED
- **Decision**: Movable dashboard card with an SVG burn-down: cumulative actual spending vs the ideal pace line for the active phase + pool. The ideal line follows rhythm weights (DEC-075), so peak days release more budget. Shows "€X acima do ritmo / de folga" and a today marker
- **Rationale**: Brainstorm council: "am I on pace for the PHASE?" needs a trend, not a daily snapshot; the rhythm-aware ideal avoids false alarms on planned peak days
- **Alternatives**: Naive linear ideal line (rejected: contradicts DEC-075 rhythm planning), full chart screen (rejected: card is enough for V1)

### DEC-131 — Month Spending Heatmap Card (F6, v0.8.0)
- **Date**: 2026-06-12
- **Status**: APPROVED
- **Decision**: Movable dashboard card: calendar grid of the month where each day's color intensity is its spend relative to the month's peak day (quartile buckets). Month navigation (capped to trip-relevant months), tap on a day opens a bottom sheet listing that day's transactions. Trip-wide (all pools) — it answers "how was my behavior", not pool accounting
- **Rationale**: Brainstorm council: pattern recognition ("weekends explode") emerges visually with zero math exposed to the user
- **Alternatives**: GitHub-style year heatmap (rejected: trips are weeks, month granularity fits), per-pool filtering (deferred until requested)

### DEC-132 — Rescue Mode Calculator (F8, v0.8.0)
- **Date**: 2026-06-12
- **Status**: APPROVED
- **Decision**: `/rescue` page (More menu + simulator cross-link): user types "I need to save €X"; the app shows the new daily allowance until the phase end, the daily cut, feasibility, and a greedy list of planned occasions to skip (most expensive first) with covered/partial summary. Pure calculator — nothing is persisted, the plan stays untouched
- **Rationale**: Brainstorm council: the "I overspent, now what?" moment is when users abandon budget apps; an actionable exit plan retains them
- **Alternatives**: Persisting the rescue as a plan revision (rejected: high complexity, low trust — users want a what-if first), automatic suggestions on overspend detection (deferred: notification fatigue risk)

### DEC-133 — Shareable Trip Summary Card (F9, v0.8.0)
- **Date**: 2026-06-12
- **Status**: APPROVED
- **Decision**: Share button on Trip Overview renders a 1080×1350 PNG via canvas (spent, budget %, day N of M, top category, progress bar) and hands it to the OS share sheet (Web Share API Level 2, download fallback). Scope exception to DEC-011 explicitly recorded: this is a LOCAL image export — the app gains no social surface, no accounts, no feed
- **Rationale**: Brainstorm council: zero-cost word-of-mouth; travelers already share trip stats manually
- **Alternatives**: Multiple card themes (deferred), in-app social features (rejected: DEC-011 stands)

### DEC-134 — PWA App Shortcuts (F3, v0.8.0)
- **Date**: 2026-06-12
- **Status**: APPROVED
- **Decision**: `manifest.json` ships three app shortcuts (long-press on the launcher icon): Register expense (`/quick-add`), Start outing (`/outings/new`), Simulate purchase (`/simulator`), with proper `short_name`s
- **Rationale**: Brainstorm council: free OS-level entry points into the three most frequent actions
- **Alternatives**: Dynamic shortcuts per state (not supported by PWA manifests)

### DEC-135 — In-App Install Button + Manual Update Check (v0.8.1)
- **Date**: 2026-06-12
- **Status**: APPROVED
- **Decision**: (1) `beforeinstallprompt` is captured at boot; when available (not installed, Chromium) the More menu and Settings show an "Add to home screen" button that replays the native prompt. (2) Settings gains an "App" section with the real version (`APP_VERSION`, replacing a hardcoded "v1.0") and a "Check for update" button: forces `registration.update()`, and when a new SW lands it skips waiting immediately (user asked explicitly) — the existing controllerchange handler reloads. Toasts report "updating" / "already latest" / "check failed"
- **Rationale**: Field request: the browser tab updates but the INSTALLED app stays stale with no user-visible way to force a version check; install discoverability relied on browser UI only
- **Alternatives**: Auto-update on every boot without asking (already happens via SW update flow — the button covers the "now" case), custom iOS instructions sheet (deferred: Julio is on Android; iOS never fires beforeinstallprompt)

### DEC-136 — Burn-down Ideal Line Follows the Full Plan (v0.8.1)
- **Date**: 2026-06-12
- **Status**: APPROVED
- **Decision**: The burn-down ideal line (DEC-130) now releases planned occurrences (DEC-072 events/sub-destinations) as STEPS on their planned day — single-day events jump on that date, multi-day ones spread evenly over their interval; undated reserves stay diluted in the daily rhythm. Pending reserves are added back to the chart envelope (free-to-spend had deducted them); confirmed/linked events keep their step without double counting. The remaining (non-event) budget follows the rhythm weights as before
- **Rationale**: Field feedback on v0.8.0: "the chart must rise according to the real phase rhythm — we chose the low-spend days, the high days, events, outings — everything should shape the chart"
- **Alternatives**: Dating planned occasions (bar nights etc.) individually (rejected: occasions are per-phase counts without dates by design — DEC-074), naive linear ideal (superseded)

### DEC-137 — Stability Hardening: Boot Guard, Recovery, Crash Anti-Loop, Shared Data, Code Split (v0.8.2)
- **Date**: 2026-06-13
- **Status**: APPROVED
- **Decision**: A 20-bug stability pass (`brain/documents/stability-audit-2026-06-13.md`, log in `src/stability-fix-log.md`) that makes the production PWA usable again. The non-negotiable principles it codifies:
  1. **A failed/slow DB read is NEVER "no data."** Boot routes through a `BootGate` that only sends to Welcome after a SUCCESSFUL empty load; every data screen renders `DataErrorScreen` ("your data was NOT deleted" + retry that reopens Dexie) on error and uses declarative `<Navigate>` (never `navigate()` in the render body — it crashed under React 19).
  2. **appSettings is non-destructive.** `get()` never writes a default row; a missing settings row with existing trips triggers a recovery flow, not a silent reset.
  3. **Crash anti-loop.** The root `ErrorBoundary` keeps a crash-log buffer; ≥4 crashes in a short window shows a persistent recovery screen (clear-cache / export) instead of an infinite reload loop. `formatMoney` and date coercion (`toSafeIsoDate`) never throw.
  4. **All `localStorage` goes through `safeLocalStorage`** (in-memory fallback when storage throws/blocked) — zero direct access elsewhere.
  5. **The Service Worker may not sabotage Dexie.** It opens IndexedDB version-less (attaches to the app schema), aborts empty-DB creation, rejects on `onblocked`, closes on `onversionchange`, guards `hasStores()` before any transaction, and SW-triggered reloads are deferred while an outing is active.
  6. **iOS eviction safety.** Diagnostics around `persisted()`; an emergency JSON snapshot is written to `localStorage` every 5 expenses and on outing end; an empty DB + a snapshot shows `EmergencyRestoreScreen` (one-tap restore); the Dashboard storage banner is reinforced for non-persisted devices.
  7. **Onboarding is atomic.** `createTripFromOnboarding` wraps all inserts in one Dexie transaction; `activeTrip` flips only after commit. Demo repair (`repairDemoTripIfNeeded`) is gated by `isDemo` so real trips never get profiles resurrected.
  8. **Single shared read + lighter app.** `AppDataProvider` (React context in `RootLayout`) runs the loader ONCE; `useAppData()` is a consumer. Foreground auto-retry is throttled (30s cooldown, max 3) with a plain reload (no `db.close()` storm). The bundle is code-split via Vite `manualChunks` (main `index` 729 KB → 156 KB; QR libs stay lazy). The Android hardware back button no longer exits the PWA on home routes.
- **Rationale**: Field report: the deployed app was effectively unusable — cold starts with real data landed on onboarding, transient IndexedDB hiccups looked like "all my data is gone," and crashes could loop. The audit traced each symptom to a concrete file:line; the fixes are defensive (degrade to recovery, never to data loss) and were each covered by new tests (+44, 460 → 504).
- **Alternatives**: Patch only the boot redirect (rejected: the same "DB error == empty" fallacy reappears on every data screen), full rewrite of the data layer (rejected: surgical guards + one shared provider deliver the safety without churn)

### DEC-138 — "What's New" in the About screen (Package 1, v0.8.3)
- **Date**: 2026-06-13
- **Status**: APPROVED
- **Decision**: The About screen lists "What's new in this version" (the items of `APP_VERSION`) plus an expandable "Previous versions". Notes live in `src/utils/release-notes.ts` (`RELEASE_NOTES`, descending by version, with pt-BR/en/es copy) and pure helpers (`resolveReleaseNoteLang`, `findReleaseNote`, `getPreviousReleaseNotes`). Every gate of the feature-expansion package appends one entry in the same commit as the version bump.
- **Rationale**: Julio tests each gate on his phone — he needs to see what shipped and what to try, in his language.
- **Alternatives**: External changelog (rejected: offline-first app, must live in the bundle), single-language notes (rejected: app is tri-lingual)

### DEC-139 — Amount Field Is a Calculator (Package 1, v0.8.4)
- **Date**: 2026-06-13
- **Status**: APPROVED
- **Decision**: The QuickAdd amount field accepts arithmetic expressions (`12+3,50`, `10*2`, `5+5+2`) evaluated by a safe pure parser `evaluateAmountExpression` (digits and `+ - * / . ,` only — NO `eval`; locale-aware via `parseLocaleNumber`, which rejects malformed input like `1.2.3,4`). Invalid input falls back to the existing parse without breaking; result is integer cents.
- **Rationale**: Splitting a bill or summing a few items at the counter is the most common real-world capture friction; a calculator removes mental math without leaving the field.
- **Alternatives**: A separate calculator sheet (rejected: extra taps), `eval`/`Function` (rejected: unsafe), a math library (rejected: overkill, bundle cost)

### DEC-140 — Description Memory + Frequent Favorites (Package 1, v0.8.4)
- **Date**: 2026-06-13
- **Status**: APPROVED
- **Decision**: Two zero-AI helpers derived from the in-memory transactions (no new table): `suggestFromDescription(transactions, text)` proposes category/subcategory/value from the last matching entry (chip under the description), and `getFrequentExpenses(transactions, n)` surfaces the 3-4 most frequent expenses as one-tap chips at the top of QuickAdd. Tapping fills the form; nothing is written until the user saves.
- **Rationale**: Most travel spending is repetitive ("café", "metrô"); reusing the last/known value is faster and more accurate than retyping — without any model or network.
- **Alternatives**: ML categorization (rejected: offline, privacy, complexity), a dedicated "templates" table (rejected: the history already is the data — DEC-004)

### DEC-141 — Round-Trip Transport Capture (Package 1, v0.8.4)
- **Date**: 2026-06-13
- **Status**: APPROVED
- **Decision**: Saving a `transport` expense offers "register the return too?" in a BottomSheet; confirming writes a second identical transaction. Never blocks (DEC-053) — declining saves exactly one.
- **Rationale**: Transport is almost always round-trip; one tap avoids a full second capture.
- **Alternatives**: A permanent "x2" toggle (rejected: noisy for non-transport), auto-duplicating silently (rejected: violates DEC-007 — never change the user's data unasked)

### DEC-142 — Amount Anomaly Confirmation (Package 1, v0.8.4)
- **Date**: 2026-06-13
- **Status**: APPROVED
- **Decision**: When an amount is ≥3× the category's typical value, a BottomSheet confirms ("€180? your usual is ~€6") to catch typos. Typical is the MEDIAN of that category's transactions (≥3 samples) — derived from the data already in `useAppData`, so QuickAdd does not need to load ActivityProfiles (avoids expanding the provider). Confirming saves; with no prior data there is no warning. Never blocks (DEC-053).
- **Rationale**: A misplaced decimal (€6 → €60) silently wrecks the budget; a confirm (not a block) catches it while honoring "warnings confirm, never prevent".
- **Alternatives**: Hard validation/rejection (rejected: DEC-053), profile `typicalValueCents` only (rejected: QuickAdd doesn't load profiles; median of history is available and robust)

### DEC-143 — Outing v2: Last Values, Repeat, Round, Payer Rotation, Time Projection (Package 1, v0.8.5)
- **Date**: 2026-06-13
- **Status**: APPROVED
- **Decision**: Five additions to the active outing, all reusing the atomic session orchestrators: (1) `updateQuickValuesFromItem` makes the amount buttons learn the last used value (replaces the nearest, keeps order/size; learned on the quick-add path, not on total adjustments); (2) repeat-last-item via `repeatLastSessionItem` (respects the split through `resolvePayerExpense`, confirmed with an undo toast — no enrich stepper); (3) `addRoundExpenses` logs N × price as N faithful items atomically (split per item; bypasses the over-max gate as an explicit action); (4) `suggestNextPayer` shows a discreet fair-rotation hint (≥2 participants); (5) `projectTimeToCeiling` shows "at this pace, ~1h to the ceiling" (≥2 items and ≥10 min). All read-only suggestions; none mutate data on their own.
- **Rationale**: The bar/outing flow is the highest-tempo capture moment; these remove taps and add foresight without changing the money math (DEC-047/114).
- **Alternatives**: A free-form "add many" form (rejected: rounds are the real pattern), auto-rotating the payer (rejected: DEC-007 — suggest only)

### DEC-144 — Voice Quick-Add (Package 1, v0.9.0)
- **Date**: 2026-06-13
- **Status**: APPROVED
- **Decision**: An optional microphone button in QuickAdd uses the Web Speech API behind a thin boundary (`utils/speech-recognition.ts`, with support detection) — the button only renders where `SpeechRecognition`/`webkitSpeechRecognition` exists, degrading cleanly to nothing elsewhere. A pure parser `parseVoiceExpense(transcript)` takes the first number as the amount and the cleaned remainder as the description (strips spend verbs and currency words). It pre-fills the form; the user still reviews and saves.
- **Rationale**: Hands-busy capture (carrying bags, walking) is faster by voice; isolating it as additive keeps the feature from ever breaking unsupported browsers.
- **Alternatives**: A cloud speech service (rejected: offline, privacy, cost), full NLP parsing (rejected: a forgiving "first number + rest" is enough and predictable). M11 was marked CUTTABLE in the package but fit within budget — shipped, not deferred.

### DEC-145 — Simulator "Borrow From Tomorrow" Notice (Package 1, v0.9.0)
- **Date**: 2026-06-13
- **Status**: APPROVED
- **Decision**: `evaluateBorrowFromTomorrow` (in `honest-friend.ts`) distinguishes a spend that fits the phase but overflows TODAY (borrow from tomorrow) from one that overflows the whole phase (real overspend). The SimulatorPage shows a non-blocking warning card with the trade-off only in the borrow case, reusing the freeToSpend/todayAllowance already computed there. Never blocks (DEC-053).
- **Rationale**: "It leaves you €8 negative today, but you can pull from tomorrow if you won't spend then" is the honest framing a traveler actually needs — an alarm, not a barrier.
- **Alternatives**: Treating any negative-today as overspend (rejected: conflates two very different situations), blocking the simulated spend (rejected: it's a simulator, and DEC-053)

### DEC-146 — Simple Mode (appMode) (Package 1, v0.9.1–0.9.2)
- **Date**: 2026-06-13
- **Status**: APPROVED
- **Decision**: A new non-indexed `appMode: 'simple' | 'complete'` in AppSettings (default `complete`; backfilled in `repository.get()` so old records/backups stay full — no Dexie migration; not merged on backup import, it is a local device preference). Simple mode is presentation-only and only HIDES, never deletes data or routes (ÂNCORA 9): (M18) a lean `SimpleHome` shows "free today" + a register button reusing the same dashboard model; (M19) data-driven `visibleInMode` hides advanced items (Planner in the nav; Outing + Simulator in the FAB) via an `advanced` flag; (M20) a `ModeGuard` wraps advanced routes (`/planner`, `/outings/*`, `/simulator`) showing an interstitial with a per-visit "open anyway" escape hatch (no preference change — ÂNCORA 11) plus "go to settings"; (M21) a Settings toggle switches mode live (no destructive reload). Shared logic lives in `domain/app-mode/` (`visibleInMode`, `isAdvancedRouteBlocked`).
- **Rationale**: The "two doors" reorientation: many travelers want only "what can I spend today?" — the full feature set overwhelms them. Hiding (reversibly) instead of forking the app keeps one codebase and one source of data truth.
- **Alternatives**: Separate "lite" build (rejected: duplicate maintenance), deleting/disabling features (rejected: ÂNCORA 9 — data and routes must persist), per-feature flags (rejected: a single mode is simpler and matches the mental model)

### DEC-147 — One-Question Onboarding + Mode Choice (Package 1, v0.9.1)
- **Date**: 2026-06-13
- **Status**: APPROVED
- **Decision**: Onboarding has two doors: a default quick flow ("how much do you have and until when?") that builds trip+phase+fund+daily via the existing atomic `createTripFromOnboarding` (BUG-013), with a "customize everything" link to the preserved 5-step detailed flow (zero regression). Both flows END on a mode-choice step ("start simple, add later — or complete?") that sets `appMode`. The quick path uses a pure `buildQuickOnboardingInput` helper.
- **Rationale**: First-run friction is where users churn; one question to a working dashboard is the fastest path to value, and asking the mode at the end frames the whole experience.
- **Alternatives**: Replacing the detailed flow (rejected: power users and presets need it), asking the mode first (rejected: the choice is more meaningful after they've seen the quick result)

### DEC-148 — Smart Defaults by Trip Preset (Package 1, v0.9.1)
- **Date**: 2026-06-13
- **Status**: APPROVED
- **Decision**: `domain/profiles/trip-presets.ts` defines trip archetypes (Urban / Family / Festival) each carrying a default rhythm, peak days and protected-reserve rate; `applyTripPreset(preset, totalCents)` maps them to onboarding defaults (`calculatePresetReserveCents` rounds the reserve). Offered as optional chips in the quick onboarding — the preset only suggests plausible values; the user can adjust and nothing is forced (ÂNCORA 10). Kept separate from activity `profile-presets.ts` (trip presets ≠ activity presets) to avoid mixing responsibilities.
- **Rationale**: A first-time user has no idea what "rhythm" or "reserve" to set; a one-tap archetype gives a sensible, editable starting point.
- **Alternatives**: A single global default (rejected: a festival and a family trip differ wildly), forcing the preset's values (rejected: DEC-007/ÂNCORA 10)

### DEC-149 — Adaptive Reveal of Complete Mode (Package 1, v0.10.0)
- **Date**: 2026-06-13
- **Status**: APPROVED
- **Decision**: After a simple-mode user logs ≥`MODE_REVEAL_MIN_EXPENSES` (5) expenses, a discreet, dismissible `SimpleRevealCard` offers to unlock complete mode. The decision is the pure `shouldOfferModeReveal(appMode, dismissed, expenseCount, threshold)`; a single non-indexed `simpleRevealDismissed` flag (default false, backfilled) makes the offer appear ONCE — set on both accept and dismiss. Accepting switches `appMode` to `complete` (explicit user action — ÂNCORA 10); dismissing only silences it.
- **Rationale**: Progressive disclosure: let users settle into the simple flow, then invite (never push) them to the richer features once they're comfortable.
- **Alternatives**: Repeating the nudge (rejected: nagging), unlocking automatically at the threshold (rejected: ÂNCORA 10 — the user decides), a time-based trigger (rejected: usage/expense count reflects real readiness better)

### DEC-150 — Insights v2: No Cap, Priority Ordering, Auto-Rotation (Package 2, v0.10.2)
- **Date**: 2026-06-13
- **Status**: APPROVED
- **Decision**: The dashboard insight carousel drops the fixed cap of 4 in favor of a data-driven priority (`INSIGHT_PRIORITY`: end-of-day 100 > projection 80 > dangerous-day 70 > category-rhythm 65 > rhythm 60 > countdown 55 > balance 50 > next 40 > avg 30 > streak 20), sorted by priority desc with `warning` tone breaking ties first; a safety cap (`INSIGHT_SAFETY_CAP=12`) only prevents runaway. Cards auto-rotate every 7s (`INSIGHT_AUTO_ROTATE_MS`), pausing for 12s after interaction (pointer/wheel/dot, NOT self-scroll) and fully respecting `prefers-reduced-motion`. Simple mode shows at most ONE insight — the highest priority and only if `warning` (never a carousel, ÂNCORA 14).
- **Rationale**: A hard limit hid the most useful insight at the wrong moment; ranking by what matters now (and rotating) surfaces the right nudge without a wall of cards.
- **Alternatives**: Keep the fixed cap (rejected: arbitrary, hid relevant insights), manual-only paging (rejected: travelers don't swipe; rotation invites discovery), no Simple-mode guard (rejected: ÂNCORA 14)

### DEC-151 — Calibrated Insight Builders: Category Rhythm, Dangerous Day, End of Day (Package 2, v0.10.3)
- **Date**: 2026-06-13
- **Status**: APPROVED
- **Decision**: Three pure, anti-spam insight builders. Category rhythm fires only with ≥3 elapsed days AND consumed fraction ≥ elapsed × `CATEGORY_RHYTHM_FACTOR(1.5)`, naming the worst category (tap → filtered expenses). Dangerous day aggregates spend per weekday over the phase's PAST transactions (excludes today — it's a forecast), firing only with `DANGER_DAY_MIN_SAMPLES(2)` AND the day's average ≥ `DANGER_DAY_FACTOR(1.8)`× the other days. End of day fires only if `nowHour ≥ END_OF_DAY_HOUR(18)` AND nothing logged today within the phase window (tap → quick-add). All weekday labels localize via Intl.
- **Rationale**: Generic "you're spending fast" noise trains users to ignore insights; calibrated thresholds make each builder return null unless the signal is real — anti-spam is sacred.
- **Alternatives**: Lower thresholds / always-on builders (rejected: noise and false alarms), reacting to today's spend for the dangerous-day card (rejected: that's hindsight, not a forecast)

### DEC-152 — Daily Check-In: Card + Responsive Notification (Package 2, v0.10.3)
- **Date**: 2026-06-13
- **Status**: APPROVED
- **Decision**: A one-tap "intent of the day" (calm / outing / night) sets context (read-only, never writes a user value — ÂNCORA 12). Stored as a non-indexed `dailyCheckIn:{date,intent}|null` in AppSettings (backfilled + seeded, no Dexie migration — ÂNCORA 18); pure domain in `domain/check-in`. A movable `daily_checkin` card sits below the hero (Simple mode excluded — ÂNCORA 14). M8 ships COMPLETE: the morning notification is responsive — the service worker (`CHECKIN_TAG`) writes the intent straight into AppSettings via read-modify-write (never creating the row, BUG-003) and broadcasts `APP_DATA_CHANGED`; without Notification Actions support it degrades to opening the dashboard. Firing is best-effort (boot, 5–13h window, 1×/day, permission granted); true background scheduling needs push/Triggers (unavailable offline-first) — documented honestly as a limitation.
- **Rationale**: The day's plan ("quiet night in" vs "big night out") should color tone and pacing; answering it from the notification removes all friction.
- **Alternatives**: A required prompt (rejected: friction; it's optional), scheduling via background push (rejected: not available in an offline-first PWA — best-effort is the honest contract)

### DEC-153 — Phase Cycle: Leftover Sheet, Atomic Move, Countdown (Package 2, v0.11.0 — Phase 3 complete)
- **Date**: 2026-06-13
- **Status**: APPROVED · **RECONCILED by DEC-219** (2026-06-18) — the leftover mechanics (carry-next / reserve / shopping pool→pool transfer, totals preserved) **remain valid**. The model is now explicitly **1 trecho = 1 dedicated pool**, so the "leftover" is that trecho's own free-to-spend flowing into the next one — the same honest number, now with a clearer mental frame than the old "subtractive shared-pool, no per-phase wallet" premise.
- **Decision**: When a phase closes with a successor (pure `findEndedPhaseWithSuccessor`, inclusive end-of-day BUG-002) and free-to-spend > 0, a BottomSheet offers what to do with the leftover (auto-opens in Complete mode only — ÂNCORA 14). The leftover is the operational pool's free-to-spend evaluated with the NEXT phase as current — an honest, conservative number that respects reserves/floors. The atomic `applyPhaseLeftover` (transaction over pools+envelopes+appSettings) has three destinations: carry-next (no-op, stays free), reserve (new protected_reserve envelope — totals intact), shopping (pool→pool transfer via pure `computePoolTransfer` — preserves the trip total, ÂNCORA 13/15); all mark `phaseLeftoverHandled` (idempotent, non-indexed). A countdown builder (`buildPhaseCountdown`) shows "X days to the next phase — you have €Y/day until then" within a `COUNTDOWN_WINDOW_DAYS(5)` window.
- **Rationale**: A subtractive shared-pool model has no per-phase wallet, so the honest "leftover" is the money that flows free into the next phase; letting the traveler steer it (keep / protect / spend) without ever changing the total respects the money-math invariants.
- **Alternatives**: Auto-rolling the leftover (rejected: ÂNCORA 12 — the user decides), a separate per-phase wallet (rejected: contradicts the shared-pool model), showing the leftover with the closed phase as current (rejected: not the number that actually carries forward)

### DEC-154 — Savings Goal + Piggy Bank (read-only motivation) (Package 2, v0.11.1)
- **Date**: 2026-06-13
- **Status**: APPROVED
- **Decision**: A motivation layer that is PURE and read-only. `projectTripEndSurplus` extrapolates the daily pace over the remaining days (can be negative); `calculateSavingsGoalProgress` gives ratio/gap/on-track vs projection; `calculatePiggyBank` is accumulated under-spend (ideal-linear-to-today − spent, clamped ≥0) at the trip level. Goal stored as non-indexed `savingsGoalCents:number|null` in AppSettings (backfill+seed — ÂNCORA 18); movable `savings_goal` and `piggy_bank` cards appear only when relevant. CRITICAL (ÂNCORA 11): neither is ever an input to `calculateFreeToSpend` — proven by a structural invariance test (free-to-spend is identical with and without a goal).
- **Rationale**: Travelers are motivated by a concrete "come home with €X" target and by seeing what they've banked — but motivation must never quietly shrink today's spendable money (DEC-088).
- **Alternatives**: Deducting the goal from the daily allowance (rejected: ÂNCORA 11 — it would corrupt the core number), a weighted/non-linear piggy bank (rejected: a simple linear pace is honest and legible)

### DEC-155 — In-Trip Learning: Occasion-Average Value Suggestion (accept-only) (Package 2, v0.11.2)
- **Date**: 2026-06-13
- **Status**: APPROVED
- **Decision**: A second, occasion-level learning path (separate from the existing per-item EWMA `updateProfileFromTransaction`, which stays intact). `computeProfileOccasionAverages` treats one closed session as ONE occasion (DEC-115), summing its transactions' personal cost and excluding `isSpecialOccasion`/`excludeFromLearning` items (ÂNCORA 12), over the `VALUE_SUGGESTION_RECENT_OUTINGS(5)` most recent sessions per profile. `detectValueSuggestion` fires with ≥`MIN_SAMPLES(3)` occasions AND |avg−typical| ≥ `MIN_DELTA_CENTS(500)` AND ratio ≥ `MIN_RATIO(0.2)`, returning the most-divergent non-dismissed profile. A BottomSheet proposes the update; accepting calls the atomic `applyValueSuggestion` (writes `typicalValueCents`), keeping/closing records the id in non-indexed `valueSuggestionsDismissed` (won't nag again this trip). Detection is read-only — the profile only changes on explicit accept (ÂNCORA 12 proven). Simple mode excluded (ÂNCORA 14).
- **Rationale**: Per-item EWMA drifts silently; an occasion-level "your bar nights actually run ~€22, update from €15?" is the honest, legible learning a traveler can approve — never an automatic rewrite.
- **Alternatives**: Auto-updating the profile (rejected: ÂNCORA 12), folding it into the existing EWMA (rejected: different granularity and semantics; keeping them separate avoids coupling), per-item suggestions (rejected: the occasion is the unit travelers reason about)

### DEC-156 — Trip Continuity: End-of-Trip Priors + Save/Apply Templates (Package 2, v0.12.0 — Phase 4 complete)
- **Date**: 2026-06-13
- **Status**: APPROVED
- **Decision**: Learnings carry to the next trip. (M21) `detectTripPriorsOffer` fires once after a trip's end date (with live profiles, not yet in non-indexed `tripPriorsHandled`) via a dashboard BottomSheet — "save model" builds+saves a template; "not now" just marks handled (anti-nag, ÂNCORA 8). (M22) `buildTripTemplate` (pure) serializes a trip into a reusable mold — phases (name, order, date-derived `durationDays`, rhythm/peak) and profiles (typical/safe/cost shape, stripped of ids/tripId/dataPointCount); persisted in non-indexed `tripTemplates:TripTemplate[]` (newest-first, capped 20) via the atomic `saveTripTemplate`; managed in a Settings section. (M23) `instantiateTemplate` (pure) recreates a new trip's entities — phases laid contiguously across the new range proportional to their stored duration (first starts on start, last ends on end), one link per phase to the operational pool, and profiles recreated COLD (confidence low, zero data points — the new trip re-learns). The atomic `createTripFromTemplate` mirrors `createTripFromOnboarding` (BUG-013) but persists the template's MANY phases+links in one transaction; an onboarding picker applies it. Brand-new ids always — applying can never collide with the source trip (ÂNCORA 12). All non-indexed fields keep ÂNCORA 18 (no Dexie migration).
- **Rationale**: A second trip to a similar place shouldn't start from zero; capturing the structure and the learned cost shape (then re-learning cold) turns each trip into a better starting point for the next without ever overwriting history.
- **Alternatives**: Copying profiles hot (rejected: a new trip has its own prices — cold re-learning is honest), reusing the single-phase onboarding orchestrator (rejected: templates are multi-phase; a dedicated atomic path avoids half-applied templates), a new Dexie table for templates (rejected: ÂNCORA 18 — a non-indexed AppSettings field needs no migration)

### DEC-157 — Location & Time Context on Every Expense (Package 3, v0.12.2→v0.12.3 — Phase 5 GATE 1-2)
- **Date**: 2026-06-13
- **Status**: APPROVED
- **Decision**: Each expense can carry an optional place + time, 100% on-device (ÂNCORA: privacy). `Transaction` gains four NON-indexed fields (`placeLabel`, `latitude`, `longitude`, `placeId`) — no Dexie migration; backfilled to null and added to backup v5 via `normalizeBackupToV5`. GPS is opt-in (`AppSettings.locationCaptureEnabled`, off by default): the boundary `utils/geolocation.ts` (`getCurrentCoords`, timeout, null on deny/error/unsupported) never blocks a save. The place is "sticky" (`AppSettings.currentPlace`), reused across expenses and only re-asked after moving > `DEFAULT_REASK_THRESHOLD_METERS` (150 m); pure haversine/`shouldReaskPlace`/`placesEqual` live in `domain/location`. Nearby naming is opt-in + online-only via reverse-geocode (Nominatim, `utils/places.ts`) behind an explicit "find name" tap; recent places are derived offline from history (`deriveRecentPlaces`), and a manual name always works without GPS (coords stay null). Time shows from the local clock; the expense list filters by place (`?place=`) with spend-by-place chips (`aggregateByPlace`). The POI list (Overpass, M4) was CUT — reverse-geocode + recents + manual name cover the need.
- **Rationale**: "Where/when did I spend?" is the context a traveler wants, but location is privacy-sensitive and travel is often offline — so it must be opt-in, on-device, network only on explicit taps, and never a blocker.
- **Alternatives**: Always-on GPS (rejected: privacy + battery + offline), indexed columns / a places table (rejected: ÂNCORA 14 — non-indexed fields need no migration), bundling a POI provider (rejected: cost/weight; reverse-geocode + history recents suffice)

### DEC-158 — Multi-Currency Expenses + Currency-Aware Wallets + Frozen FX Snapshot (Package 3, v0.13.0 — Phase 5 GATE 3, Phase 5 complete)
- **Date**: 2026-06-13
- **Status**: APPROVED
- **Decision**: An expense can be logged in a foreign currency while the budget stays in the trip's base currency. `createExpenseTransaction` accepts optional `baseCurrencyAmountCents` + `exchangeRate` (default = amount / null → 100% backward-compatible). QuickAdd shows a data-driven currency selector (only when a foreign option exists — a wallet currency or a frozen-rate snapshot), a rate field "1 {foreign} = ? {base}" pre-filled from the frozen snapshot and editable, with a live "≈ base" conversion; saving is blocked without a positive rate. Pure helpers in `domain/money/exchange.ts` (`convertToBaseCents`, `transactionBasePersonalCostCents`, `resolveFrozenRate`, `listSelectableCurrencies`). Budget impact (`calculatePoolSpent`, `calculateSpentOnDate`) routes through the BASE value so "free to spend"/"spent today" are correct with foreign spend (NO-OP for single-currency — zero regression). Wallet debit is currency-aware (`calculateWalletBalance(wallet, txs, baseCurrency)` + `transactionWalletAmountCents`: same currency → original; base-holding wallet → converted). An opt-in, online-only FX snapshot (`utils/exchange-rates.ts`, open.er-api.com, no key, timeout, null fallback) freezes today's rates into non-indexed `AppSettings.frozenRates` for offline use; the original amount is always preserved (ÂNCORA 11). The expense detail shows "X CZK (≈ Y EUR)" and editing recomputes the base.
- **Rationale**: Cross-border travel mixes currencies; the honest model keeps the original amount the traveler actually paid AND a base equivalent for one coherent budget — converting once, offline, with a frozen or manual rate so it works on a plane.
- **Alternatives**: Live rate lookups on every entry (rejected: offline-first — rates are frozen/manual), storing only the converted value (rejected: ÂNCORA 11 — the original is the truth), a separate currency table (rejected: non-indexed fields + a settings snapshot need no migration)

### DEC-159 — Local Daily Snapshots + Restore-to-Yesterday (Package 3, v0.13.1 — Phase 6 GATE 4)
- **Date**: 2026-06-13
- **Status**: APPROVED
- **Decision**: A rolling on-device safety net of the last 7 daily full backups. This is the package's ONE Dexie migration: SCHEMA_VERSION 4→5 adds a `localSnapshots` table (`'id, createdAt'`) via `this.version(5).stores(SCHEMA_V5)` with NO `upgrade()` callback (a new table is created without touching existing data). The table is LOCAL-only — it is NOT in `BACKUP_TABLE_KEYS`, so `buildFullBackup` never exports it and `importBackup` never touches it. `LocalSnapshot {id=YYYY-MM-DD, createdAt, expenseCount, json}` is not SyncMetadata (standalone repository, no BaseRepository); the day key makes the daily write naturally dedup via `put`. Pure helpers in `domain/local-snapshots` (`snapshotDayId`, `sortSnapshotsNewestFirst`, `hasSnapshotForDay`, `selectSnapshotsToPrune`, `parseSnapshotJson`); the boundary `utils/local-snapshot.ts` records best-effort (build → put → prune beyond N=7) on the same triggers as the emergency snapshot (QuickAdd save + outing end), and restores by parsing the JSON into the atomic `importBackup('replace')` — invalid JSON returns false and leaves the DB intact. Settings › Advanced lists the points (date + local time + expense count) and restores via a confirm BottomSheet.
- **Rationale**: Cloud-less local-first means a single corrupting action could be unrecoverable; a small rolling window of daily restore points gives "undo a bad day" without any backend, and reusing the atomic backup import guarantees an all-or-nothing restore.
- **Alternatives**: Per-change versioning (rejected: storage blowup; daily is enough), a remote backup (rejected: DEC-004 local-first/no backend), exporting snapshots in the user backup (rejected: they are device-local restore points, not portable data)

### DEC-160 — Vault via Share Sheet + Read-only HTML Trip Report (Package 3, v0.13.2 — Phase 6 GATE 5)
- **Date**: 2026-06-13
- **Status**: APPROVED
- **Decision**: Two ways to take the trip off the device, both reusing existing boundaries. (1) "Send backup": the existing `downloadFile` already does share-first (`navigator.share` with a File) + download fallback, so the JSON backup button is re-framed as a primary share action (no redundant second button) and a reminder banner appears when `isBackupReminderDue(settings, now)`. (2) "Export summary (HTML)": `domain/sharing/trip-report.ts` — `buildTripReport` (pure) aggregates EVERYTHING in base currency via `transactionBasePersonalCostCents` (consistent with the budget): total spent/budget/%, by phase (chronological), by category and by place (desc), outing count + total, expense count; `renderTripReportHtml(report, labels)` emits a self-contained HTML document (inline CSS, ZERO network/script, `escapeHtml` on all user text, i18n labels injected) that opens offline in any browser.
- **Rationale**: A traveler wants to back up and to SHOW the trip without an account or internet; sharing the real backup file (recoverable) plus a human-readable offline infographic covers both, and reusing `downloadFile`/the base-currency aggregation keeps it DRY and consistent.
- **Alternatives**: A hosted/share-link report (rejected: DEC-011/DEC-004 — no backend, no social surface), a PDF (rejected: heavier; self-contained HTML is universal and offline), recomputing totals in raw currency (rejected: must match the in-app base-currency budget)

### DEC-161 — App Lock (PIN, off by default) + Web Share Target (Package 3, v0.14.0 — Phase 6 GATE 6, Phase 6 complete; Package 3 / V1-expanded complete)
- **Date**: 2026-06-13
- **Status**: APPROVED
- **Decision**: (App lock) An opt-in PIN asked at boot. `AppSettings` gains non-indexed `appLockEnabled` (default false), `appLockPinHash`, `appLockPinSalt` (backfilled, no migration). The PIN is NEVER stored in clear: `utils/app-lock.ts` derives a PBKDF2-SHA256 hash (100k iterations, random 16-byte salt) via Web Crypto; `hashPin`/`verifyPin` (timing-safe hex compare, never throws) + `isValidPin` (4–8 digits). `AppLockGate` (in `RootLayout`, below `AppDataProvider`) shows a `LockScreen` that only verifies the PIN — it cannot read or export the data behind it — and NEVER locks the recovery/onboarding allowlist (`/`, `/welcome`, `/onboarding`, `/rescue`, `/sync`); an evicted/empty DB has no settings so the lock simply cannot engage (ÂNCORA 12: recovery is never trapped). A session that starts WITHOUT a lock stays unlocked (enabling mid-session never locks the current screen); cold start with the lock on asks for the PIN. Biometrics (WebAuthn) were CUT — PIN-only shipped (sanctioned cut). (Share Target) The static `manifest.json` gains `share_target` (GET → `/quick-add`, params `title/text/url`); the pure `parseSharedExpense` extracts the first money-like token (locale-tolerant) as the amount + a description, and QuickAdd pre-fills both. It only PRE-FILLS, never auto-saves (ÂNCORA 13). The SW already serves `/quick-add` offline (navigation network-first → SPA fallback to index.html); `CACHE_NAME` bumped v9→v10 so the new manifest reaches installed clients via the update toast (DEC-082).
- **Rationale**: Financial data on a phone deserves an optional lock, but a local-first app must never let a forgotten PIN trap the user's data — hence a verify-only screen, an always-open recovery path, and a PIN hash that never persists in clear. Share Target is a near-free, offline capture entry point that respects the "never auto-save" anchor.
- **Alternatives**: Mandatory lock (rejected: off by default — most travelers won't want friction), storing the PIN/comparing in clear (rejected: security), locking every route including recovery (rejected: ÂNCORA 12 — would brick a forgotten PIN), WebAuthn now (deferred: PIN is the baseline; biometrics is a later enhancement), Share Target that auto-creates the expense (rejected: ÂNCORA 13 — review before saving)

### DEC-162 — Dashboard Density: Consolidated Alerts + Card Reorder + Collapsible Trip-Analytics Drawer (UX Polish Pass, v0.14.2 — Gate 2)
- **Date**: 2026-06-14
- **Status**: APPROVED
- **Decision**: Reduce dashboard clutter WITHOUT removing anything. (D1) The two stacked data-safety banners (non-persistent-storage warning + backup reminder) become mutually exclusive — at most one shows at a time (eviction-risk wins; otherwise the backup nudge), so the hero rises. (D2) The default `DASHBOARD_CARD_CATALOG` order puts contextual/actionable cards on top and read-only analytics near "recent expenses". (D3) The three always-open analytics cards (yesterday recap, phase burndown, spend heatmap) are grouped into ONE collapsible `trip_analytics` drawer, collapsed by default and persisted per-user in non-indexed `AppSettings.collapsedDashboardCards` (helpers `isDashboardCardCollapsed`/`toggleDashboardCardCollapsed`, `DEFAULT_COLLAPSED_CARDS=['trip_analytics']`; default seeded in `createDefaultAppSettings`). No Dexie migration (non-indexed field, ÂNCORA 18). PROTECTED ZONE untouched: the insights carousel (DEC-077/091/150) and occasion counters (DEC-076) keep their exact behavior.
- **Rationale**: The hero ("free to spend") was pushed below the fold by redundant alerts and a stack of read-only analytics; progressive disclosure (collapse the read-only, keep the actionable) restores hierarchy while preserving every feature and the charm Julio approved.
- **Alternatives**: Removing analytics cards (rejected: ZERO functionality removed), collapsing each analytics card individually (rejected: one "Trip analytics" drawer is cleaner), a new Dexie column for the collapsed set (rejected: non-indexed AppSettings field needs no migration)

### DEC-163 — QuickAdd Sticky Action Bar (UX Polish Pass, v0.14.3 — Gate 3)
- **Date**: 2026-06-14
- **Status**: APPROVED
- **Decision**: The QuickAdd Cancel/Save buttons move from the end of a long scrolling form to a `sticky bottom-0` action bar (full-bleed via `-mx-5 px-5`, `var(--surface)` background + `var(--border-faint)` top border, safe-area bottom padding) — same bottom-bar idiom as `SelectionBar`/`BottomNav`. The page scrolls under it; the form's trailing `pb-4` is dropped so the bar sits flush. ZERO behavior change: identical buttons and `disabled` rules (amount>0, fund, rate, valid transfer).
- **Rationale**: Saving an expense is the app's most frequent action; requiring a scroll to reach Save added friction on a long form — pinning it removes the friction without changing any logic.
- **Alternatives**: A floating Save FAB (rejected: clashes with the global FAB), shortening the form (rejected: every field is opt-in already and removing fields loses function)

### DEC-164 — Settings Grouped Into Labeled Sections (UX Polish Pass, v0.14.4 — Gate 5)
- **Date**: 2026-06-14
- **Status**: SUPERSEDED by DEC-211 (Wave C / F11, 2026-06-17) — Settings moved from one labeled list to a **category list → per-category subpages** (Samsung-style); the seven group labels live on as the category set, nothing removed (ÂNCORA 9). [reconciled 2026-06-17]
- **Decision**: The flat "wall of sections" in Settings gains seven discreet group headers (presentational `GroupHeader`, same `text-xs uppercase tracking-wider text-on-surface-faint` idiom as the More page): Preferences · Notifications & privacy · Money & goals · Home screen · Backup & security · Device & capture · About. Inserted at the EXISTING natural boundaries — NOTHING reordered, hidden or removed; i18n `settings.group_*` in pt/en/es. Backup, Shared, About, More and Dashboard-config were reviewed and left unchanged (already card-based / already grouped).
- **Rationale**: A long undifferentiated list is hard to scan; labeling the existing blocks adds findability with zero risk and no change to any option's place or behavior.
- **Alternatives**: Collapsible setting groups (rejected: adds taps for low-frequency-but-quick settings; labels suffice), reordering for "logical" grouping (rejected: would break muscle memory — order preserved)

### DEC-165 — Unified Back-Button & Header Style Across Screens (UX Polish Pass, v0.14.5 — Gate 6)
- **Date**: 2026-06-14
- **Status**: APPROVED
- **Decision**: Two back-button/header styles existed: 16 sub-pages used a bare back button (`btn-press p-1`, icon 24) + `text-heading font-bold` title, while NotificationsPage and ImpactDetailPage used a circular back button (`w-10 h-10 rounded-full bg-surface-container`, icon 20) + `text-xl font-extrabold` title. The two outliers are aligned to the dominant bare style. Their `page-sticky-header` wrapper + `useScrolled` sticky behavior is PRESERVED (sticky stays the pattern for primary scrollable pages — dashboard/expenses/planner); only the button/title styling changed. Purely visual; `navigate(-1)` unchanged. Bottom nav (single `BottomNav` component), side padding (`--page-padding-x`) and empty states (shared `bg-surface-container` card + 32px icon) were audited and already consistent — left untouched.
- **Rationale**: Consistency over preference — one back-button look everywhere is more coherent than two; converging the 2 outliers to the 16-page majority is the lowest-risk way to achieve it (a full sticky+circular refactor of 16 screens was rejected as high-risk for no proportional gain).
- **Alternatives**: Converging everything UP to circular+sticky via a shared `PageHeader` (rejected: 18-file refactor with layout-shift risk overnight), removing sticky from the 2 outliers (rejected: ImpactDetail is long — sticky helps; kept it)

### DEC-166 — Nearby Establishments Picker (completes the deferred M4 POI list, v0.14.18)
- **Date**: 2026-06-14
- **Status**: APPROVED
- **Decision**: Phase 5's M4 had deferred the "nearby places list" (the phase-5-6 log: *"Lista de POIs (Overpass) NÃO feita"*), shipping only a single-name reverse-geocode tap. This completes it: when location capture is ON and online, both QuickAdd and the active outing auto-list named establishments **near the current GPS fix, biased by the spend/session category** (data-driven `category → OSM tag` map; unmapped categories fall back to a broad named-POI query), **nearest first**, and **pre-select the closest as the sticky place** — but ONLY while the place is still the raw coordinate placeholder, so a typed/picked/sticky name is never overwritten. The traveler can tap another nearby option or type a specific name (existing manual fallback); offline → recent places + manual, exactly as before. Provider: **OpenStreetMap Overpass API** (free, no key, © OSM) — consistent with the existing Nominatim choice and the no-API-key precedent (DEC rejected paid exchange-rate APIs). Pure helpers (`osmFiltersForCategory`/`buildOverpassQuery`/`parseOverpassPlaces`/`formatDistanceShort`) live in `domain/location/nearby.ts`; the network call is isolated in the `utils/places.ts` boundary (`searchNearbyPlaces`) and NEVER throws/blocks (offline/timeout/HTTP error → `[]`). Shared presentational `NearbyPlaceList` used by both surfaces.
- **Privacy posture (extends ÂNCORA 8/10, recorded explicitly)**: the lookup remains opt-in at the feature level (location capture is OFF by default) and online-only with a full offline fallback, but coordinates are now sent to Overpass **automatically when capturing with location ON + online** (previously only on an explicit "find name" tap). Nothing from the lookup is stored beyond the name the traveler picks; raw GPS storage stays 100% local. The `location_privacy_hint` microcopy was updated in all three locales to state this honestly.
- **Rationale**: Julio's field request — "when I'm at a restaurant it should find nearby restaurants and let me pick from a dropdown, pre-selecting the closest, for every category, both when logging an expense and during an outing." This was the originally-intended M4 behavior, cut for provider rate-limit/attribution concerns; the sticky-place model (ÂNCORA 9) plus per-(coords,category) fetch de-duplication keeps Overpass usage modest.
- **Alternatives**: Google Places Nearby Search (rejected: requires an API key + billing + a stronger data-sharing posture, against the no-key/local-first precedent), keeping reverse-geocode only (rejected: it returns one guessed name, not a category-filtered choosable list — the actual user need), a name-search-via-API manual box (deferred: typing a free-text name already covers the "search a specific name" fallback).

### DEC-167 — Check-in as "Lens of the Day" (structural, v0.14.19 — Gate S)
- **Date**: 2026-06-14
- **Status**: APPROVED (Julio: "pode seguir sim" with the proposed mapping)
- **Decision**: The daily check-in mode no longer only relabels its own card — it now brings ONE other dashboard signal into focus, so picking a mode visibly reshapes the home screen. Mapping (data-driven `getCheckInLens(intent)` in `domain/check-in/lens.ts`): **calm → piggy bank** (Cofrinho card gets a soft primary ring + a "No foco de hoje" chip), **outing → occasion counters** (the counters carousel gets the chip), **night → no card focus**; instead the night reserve projects inline on the check-in card as **"≈ N rounds"** (`estimateNightRounds(reserveCents, avgRoundCents)`, floored, returns null below one full round so it never reads "≈ 0 rounds"). The round price is the traveler's own (`deriveAvgRoundCents` prefers a bar/night profile's `defaultAvgDrinkPriceCents`, else the cheapest configured, else null → line omitted). The check-in card also gains a one-line explanation ("Hoje em foco: o cofrinho/suas ocasiões, logo abaixo.") so the connection is explicit, not just a ring far below. Focus is only applied when the target card is actually visible (not hidden, has content), so the explanation never points at nothing.
- **Read-only (ÂNCORA 12 — unchanged)**: this is pure framing. No budget number moves; the hero free-today and `planCheckInDay` outputs are untouched. The lens only decides which already-present card to spotlight and adds a derived projection line. No new persisted state, no new network.
- **Rationale**: Julio repeatedly flagged the check-in as a dead toggle ("escolho o modo e o valor é o mesmo"). DEC after the council brainstorm gave each mode distinct numbers (Gate K1); this closes the loop the council named ("lens of the day") so the chosen intent reorders/spotlights the home, making the choice felt across the screen rather than inside one card.
- **Alternatives**: auto-scroll the focused card into view (rejected: contradicts the just-fixed "no surprise scroll jumps" continuity work — DEC silent-refresh), a full reorder of the card sequence per mode (rejected: too disruptive/disorienting day-to-day; a ring + chip + explanation conveys focus without moving the furniture), a fixed assumed round price for night (rejected: dishonest — derive from the traveler's own profile or omit).

### DEC-168 — Hero "Where This Number Comes From" (structural explainability, v0.14.20 — Gate T)
- **Date**: 2026-06-14
- **Status**: APPROVED
- **Decision**: The dashboard hero (free-to-spend) — the app's single most important figure — becomes **tappable** and opens a bottom sheet that shows the exact arithmetic behind it: **phase budget − already spent − protected reserve − set aside for next phases − reserved for occasions = free to spend**. A pure, tested `buildFreeToSpendBreakdown(fts)` (in `domain/budget/budget.ts`) emits the ordered line items directly from the `FreeToSpendResult` terms, **dropping any zero-valued term** so the sheet stays signal. The lines reconcile exactly to the displayed hero number; when commitments exceed the budget (freeToSpend clamps at 0) a **deficit line** surfaces the overflow ("os compromissos passam do orçamento em X") instead of silently hiding it. The card gains a small `help`-icon affordance ("de onde vem") for discoverability; the sheet reuses the existing `BottomSheet` and is wired through `DashboardPage` state like the other dashboard sheets.
- **Read-only (ÂNCORA 12 — unchanged)**: pure explanation of an already-computed number; no value moves, no new persisted state, no network. The pre-existing at-a-glance footer (fund balance / protected reserve) stays as the quick glance; the sheet is the full, operator-by-operator truth (and is the only place that also accounts for the future-floor term).
- **Rationale**: Julio's recurring theme across the whole pass — "quero sentir que tudo que faço tem motivo e resultado, visual, explicado". The biggest unexplained number was the hero itself; making its formula visible on demand is the highest-leverage explainability win and mirrors the insights' existing "como cheguei nisso" sheet pattern.
- **Alternatives**: always-expanded inline breakdown under the hero (rejected: clutters the most-glanced card; a tap keeps the hero calm and reveals depth on demand), a separate full "budget math" page (rejected: heavier than needed and breaks the in-place continuity the pass has been protecting), showing the raw negative value when over budget instead of clamp+deficit-note (rejected: the hero must never show a negative "free" — the note explains the clamp honestly).

### DEC-169 — Fluidity & A11y Round (evidence-based audit, v0.14.21 — Gate U)
- **Date**: 2026-06-14
- **Status**: APPROVED
- **Decision**: A scripted multi-route audit (`scripts/ux-audit.mjs`: console/page errors, horizontal overflow, tiny tap targets, unlabeled inputs across 10 key routes) found the app stable (0 console errors, no overflow on 9/10 routes) and surfaced a small, concrete punch-list, all fixed in one round: **(1)** the dashboard had a ~14px horizontal page-scroll leak from the insight/occasion carousels — fixed app-wide by adding `overflow-x-clip` to the AppShell column (kills sideways jiggle without disabling `position: sticky`/`fixed`, unlike `overflow: hidden`, and without cutting the intended full-bleed carousels, which reach exactly the column edge); **(2)** three inputs lacked an accessible name — QuickAdd `datetime-local`, Settings backup-reminder `<select>`, Settings device-name text input — each given an `aria-label` reusing its existing visible label key; **(3)** the insight pagination dots were ~14px tap targets — bumped to ≥24px (`p-1`→`p-2.5`) to meet WCAG 2.2 AA (the occasion-carousel dots are decorative `aria-hidden` spans, left as-is). No new i18n keys; verified by re-running the audit (dashboard overflow → false, unlabeled inputs → 0 on every route).
- **Rationale**: Julio asked for "uma rodada boa de melhorias" after the two structural changes, with the same rigor. Rather than invent risky changes on an already-mature app, the round is grounded in a reproducible audit: fix the one real fluidity defect (the sideways jiggle he'd feel) plus the correctness/accessibility gaps, and stop — honesty over padding the changelog.
- **Alternatives**: `overflow-x: hidden` on the shell (rejected: can clip sticky headers / create an unwanted scroll container — `clip` is the surgical choice), bumping every sub-40px control (rejected: most are intentional compact segmented chips that already pass WCAG 24px; only the 14px dots actually failed), associating labels via `htmlFor`/`id` (rejected: `aria-label` matches the codebase's prevailing icon-button pattern and needs no DOM-id plumbing).

### DEC-170 — IndexedDB Connection Resilience: never a "can't load your data" dead end (critical stability, v0.15.0 — Gate Z)
- **Date**: 2026-06-14
- **Status**: APPROVED (Julio reported a hard blocker: after deleting a just-ended outing the app got stuck on "Não foi possível carregar seus dados", every screen spun forever, "Tentar novamente" did nothing, and even fully closing/reopening the installed app did not recover — "isso não pode acontecer de forma nenhuma… se acontecer, o app tem que se auto-resolver, reiniciar por dentro, nunca deixar o usuário sem acesso aos dados").
- **Root cause (confirmed, not the delete code)**: The delete-outing path (`softDeleteOutingSessionsBatch`) is a clean atomic Dexie transaction with every table in scope and no external async awaited inside — it does **not** deadlock. The freeze is the well-documented **WebKit/iOS IndexedDB failure family**: (a) WebKit bugs 273827/277615 (iOS 17.4+) where a live connection starts throwing `UnknownError: Connection to Indexed Database server lost` because the OS killed the per-origin IDB server process (a write while backgrounding/under memory pressure — exactly an outing's heavy write + share-sheet/notification activity); and (b) the 2021 first-open hang where `indexedDB.open()` stays pending forever with **no event firing** → an infinite spinner. The previous recovery (`db.close()` + in-page re-read) only fixes ~1/3 of (a) and nothing of (b), so "Tentar novamente" looked dead and the spinner never ended.
- **Decision**: Build a single, owned **escalation ladder** (`data/db/db-recovery.ts`) and wire every data entry point through it so the app self-heals and is NEVER a dead end:
  1. **Watchdog on open** (`openWithWatchdog`, 8 s) and on the whole load (`withTimeout`, 10 s) — a hung WebKit open/read fails loudly instead of spinning forever.
  2. **Tier 1 self-heal** (`recoverConnection`): close the (possibly dead) handle, back off, reopen under the watchdog, re-read. Silent — `useAppData.runLoad` tries this on any load failure before surfacing anything.
  3. **Tier 2 bounded reload** (`escalateToReload`): the only reliable WebKit recovery is a full `location.reload()` (the user-approved "blink / reinicia por dentro"). A **localStorage-persisted budget** (max 3 per 90 s) survives the reload it triggers, making a reload loop impossible; a healthy load clears the budget.
  4. **Tier 3 never-dead-end UI** (`DataErrorScreen`): only after the ladder is exhausted. It states the data is SAFE, **auto-retries every 10 s on its own** (so the moment the OS frees the IDB process the screen heals with zero user action), offers a reload button that actually works, and an **emergency export** (kept in the main bundle) so the user can always rescue data. It NEVER routes to the destructive `/welcome`.
  5. **Multi-context guards** (`database.ts`): `versionchange` closes our connection so a new deploy/tab's schema upgrade is never blocked (a classic "database didn't respond" hang); `blocked` is logged to the crash buffer.
  6. **Resilient code-split** (`lazyWithRetry` + `LoadingFallback` 12 s stall watchdog): a chunk that never resolves (same WebKit stall, or a flaky post-deploy fetch) becomes a "reload" prompt instead of an eternal Suspense spinner — this is the "Planejar fica carregando e nunca sai" symptom.
- **Why this fully satisfies the mandate**: it implements exactly what Julio asked — auto-resolve, restart-from-within (bounded reload), a "blink" is acceptable, and the user is never trapped or told the data is gone. Soft-delete (Core Rule 4) plus local-first means the data is physically present throughout; the only failure mode was *access*, which the ladder restores automatically or, worst case, lets the user export immediately.
- **Tests**: `db-recovery.test.ts` (watchdog timeout, connection-lost classification, bounded reload budget across the persisted guard, auto vs manual escalation, real close+reopen on a fake-indexeddb instance), `data-error-screen.test.tsx` (safe-data messaging + working retry/reload/export), and a rewritten `use-app-data-error.test.tsx` (silent self-heal on a transient blip; error surfaced only when recovery is genuinely exhausted; throttled foreground auto-retry). Full suite: 863 passing.
- **Alternatives**: keep `db.close()`+re-read only (rejected: the field evidence is that it does not recover this WebKit family — it is precisely what failed Julio); auto-`deleteDatabase()`+rebuild on wedge (rejected outright: destroys local-first data — the one thing that must never happen); close the connection on every background (`visibilitychange`) as prevention (deferred: real risk of aborting an in-flight write and a bigger behavioral change — the recovery ladder already neutralizes the wedge when it happens; revisit only if incidents persist); an unbounded auto-reload (rejected: a permanently wedged engine would loop forever — the persisted budget degrades gracefully to the self-retrying manual screen instead).

---

### DEC-171 — One consistent first-use empty state across the app (v0.16.0 — Gate X)
- **Date**: 2026-06-14
- **Status**: APPROVED (Julio: "estados vazios do 1º uso com texto amigável + CTA"; part of the "all fronts, autonomous" batch).
- **Decision**: Add a single presentational `components/EmptyState.tsx` (calm icon badge, warm title, one-line "what goes here", optional primary CTA) and use it on every first-run surface: Expenses (both the expenses tab and the outings-history tab), Wallets and Funds. Each empty state now starts the obvious next flow — Expenses → `/quick-add`, Outings → `/outings/new`, Wallets → open the add-wallet form, Funds → open the create-fund form.
- **Why**: Before this each screen rolled its own empty treatment (some had a CTA, most were a bare line of text), so the very first impression felt unfinished and inconsistent. One component makes the empty state reassuring and actionable everywhere with shared copy keys in pt-BR/en/es.
- **Scope note**: The Planner's empty state is deliberately deferred — a trip almost always has phases, the screen is a complex sticky-header layout, and forcing an `EmptyState` there carried real regression risk for little first-run value.

### DEC-172 — Spread the "where this number comes from" pattern (v0.16.0 — Gate W)
- **Date**: 2026-06-14
- **Status**: APPROVED (Julio: "espalhar o de onde vem" — extend the Dashboard hero's explainer to other derived figures).
- **Decision**: Extract the hero's arithmetic rows into a reusable `components/Breakdown.tsx` (`BreakdownRows` + a `BreakdownSheet` wrapper) — each line is a magnitude plus a `kind` (base/subtract/add) and the **total is rendered signed** so an over-allocation shows as a real negative, never a hidden zero. Apply it to: (a) **Fund balance** — inline inside the expanded fund card: `total − spent = available`; (b) **Planner margin** — the margin figure becomes tappable ("de onde vem?") and opens a sheet: `free to spend − planned = margin`, with a footnote when a future-phase floor is held out.
- **Why**: Julio's recurring ask is to "always feel that what I do has a reason and a result". The hero proved the pattern (DEC-168); reusing one component keeps it visually identical and avoids three bespoke copies. The Dashboard hero itself was intentionally left untouched (working code, no need to refactor under risk).
- **Deferred**: "Compras pessoais" — the label exists but is not bound to a single concrete figure in a clean spot; the personal-spent number that matters lives in the outing context, addressed by DEC-173 instead.

### DEC-173 — End-of-outing recap (v0.16.0 — Gate Y)
- **Date**: 2026-06-14
- **Status**: APPROVED (Julio: "aprofundar a saída ativa — ritmo, rodadas restantes, encerrar com resumo").
- **Decision**: Add a compact recap to the outing review's total card — **duration · items (rounds) · vs target** (green when at/under the comfort target, amber when over). The active-outing "pace projection to the ceiling" and "rounds remaining" already existed (E3/M10, DEC-117), so this closes the loop with a satisfying summary at the moment the outing ends.
- **Why**: Ending an outing was a bare total + form; the recap answers "how did it go?" before any data entry, reinforcing that the session had a result.

### DEC-174 — app-lock crypto test runs in the node environment (test infra, v0.16.0)
- **Date**: 2026-06-14
- **Status**: APPROVED (encountered while verifying the suite; surgical infra fix).
- **Decision**: `app-lock.test.ts` declares `// @vitest-environment node`. jsdom exposes `crypto` (for `getRandomValues`) but **not** `crypto.subtle`, so the PBKDF2-based PIN hashing test cannot run under jsdom; the shared setup deliberately refuses to graft Node's `subtle` onto jsdom's `crypto` (cross-realm TypedArray hazard). Running just this one suite in the node environment gives it full WebCrypto with same-realm typed arrays.
- **Why**: Keeps the whole suite green (863) without weakening the global setup or touching production code; it is the canonical Vitest pattern for a node-only API.

### DEC-175 — Planned Purchases: earmark known future buys against free-to-spend (v0.17.0)
- **Date**: 2026-06-14
- **Status**: APPROVED (Julio: "vou fazer uma compra que sei que preciso… colocar como algo que já vai sair do orçamento para ver o que realmente posso gastar"; chose direction `lista_earmark`; scope "completo, total, função madura").
- **Problem**: There was no clean home for a *known, intended* purchase (skincare creams across pharmacy/Primor/Druni, clothes "at some point"). The global personal-shopping pool and event reserves existed but neither let the user say "this specific buy is coming, hold it out of what I can spend, and let me mark it bought later and have everything update." The user was confused as a user — the signal that the feature was missing or unclear.
- **Decision**: A NEW first-class entity `PlannedPurchase` (NOT an overload of `PlannedOccurrence`, which is dated/session-linked). Fields: `tripId`, `budgetPoolId`, `name`, `category`, `estimatedCostCents`, `reservedCents | null`, `status (planned|bought|cancelled)`, `linkedTransactionIds[]`, `store`, `targetDate`, `notes`. Dexie schema **V6** (`plannedPurchases: 'id, tripId, budgetPoolId, status, deletedAt'`), backup **V6** (`normalizeBackupToV6`). Two modes via one toggle:
  - **Reserve ON** (`reservedCents` set): the estimate is **subtracted from free-to-spend immediately** — a new subtractive term `plannedPurchasesCents` in `calculateFreeToSpend` (7th param) and a `planned_purchases` line in the FTS breakdown. The reserve **shrinks by real linked spend** so there is no double counting (`plannedPurchaseReservedRemainingCents = max(0, reserved − linkedSpent)`).
  - **Track only** (`reservedCents === null`): records the intention without touching FTS; never auto-closes, so multi-store buys accumulate.
- **"Comprei" flow**: `logPlannedPurchaseExpense` orchestrator creates a real `Transaction` (reusing the standard expense/payer path), links it, and optionally closes the purchase; `undoLogPlannedPurchaseExpense` soft-deletes the txn and restores the prior state. Multi-store is first-class: tap "Comprei" per store, "keep open" until the last one, reserve draws down each time.
- **Surfaces**: dedicated `/planned` page (list, add/edit form, reserve toggle, progress bar, breakdown `estimated − spent = remaining`, Done bucket with reopen); dashboard card `planned_purchases` (total reserved + top 3, hidden when empty); FAB → "Plan a purchase" (`/planned?new=1`); More-menu entry; help screen with 5 topics; simulator target (planned reserves reuse the **event reserve mechanic & copy** — `SimulationReserveContext`, a `{kind:'planned'}` target routed through the existing reserve logic, so no new verdict/fact kinds or i18n).
- **Why this shape**: maximizes reuse (FTS deduction pattern from event reserves DEC-072; `Breakdown` component DEC-172; `EmptyState` DEC-171; standard expense orchestration) and keeps semantics clean (a purchase is not an occasion). Track-vs-reserve in one toggle covers both "I know the amount, hold it" and "I'll buy eventually, just remember".
- **Cuts / deferred**: a parallel QuickAdd-prefill route for "Comprei" was **dropped as redundant** — the in-page buy sheet logs + links + closes with undo in fewer taps and is the superior UX. Linking *pre-existing* arbitrary expenses to a planned purchase retroactively is deferred (the per-store "Comprei" tap already covers the multi-store case).
- **Verification**: full suite green (898), `tsc` clean, production build OK. Shipped as **0.17.0** (sw cache `trippilot-v34`).

### DEC-176 — Android stability: bfcache recovery + always-on wedge telemetry (v0.18.0–0.19.0)
- **Date**: 2026-06-15
- **Status**: APPROVED (Julio reported recurring "Não foi possível carregar seus dados" on the Android PWA).
- **Decision**: (1) In-app diagnostics screen (`utils/diagnostics.ts`, surfaced in About) so a wedge can be inspected without a cable. (2) `useAppData` reconnects the Dexie handle on `pageshow` (bfcache restore) before any read, and **always records the exact failure cause** in a crash log (even when the app self-recovers). (3) `DataErrorScreen` retries with exponential backoff instead of a single immediate retry.
- **Why**: Returning the PWA from the background could leave the IndexedDB connection stale and stall loading for no reason; the failure was invisible. The app now self-heals at the bfcache moment and leaves a trace when it can't.

### DEC-180 — Navigation redesign: "Mais" → Viagem + Copiloto, gear for Settings (v0.20.0–0.21.0)
- **Date**: 2026-06-15
- **Status**: APPROVED (Julio: the "Mais" tab hid too many functions; an icon to enter a 4-option menu is too costly for one of five prime slots).
- **Decision**: Replace the bottom bar's `Mais` + `Planejar` with two purposeful tabs — **Viagem** (`/viagem`, the plan + structure: cross-phase selector, planning preview, planned purchases, funds, phases, wallets, profiles, people, outing history) and **Copiloto** (`/copiloto`, intelligence; `advanced`). Settings moves to a **gear** next to the bell on the home header; backup/CSV export/About live inside it. `/more` redirects to `/viagem`; `MorePage` deleted. Nothing was removed — only reorganized for discoverability. The Viagem phase selector also delivers Julio's cross-phase ask (view/plan any phase from one screen).
- **Why**: Surfaces buried functions naturally and frees the nav from a generic "More" bucket; settings-type items don't deserve a prime tab.

### DEC-177 — Copiloto is the trip's intelligence screen: 3 questions + data-gated modules (v0.22.0)
- **Date**: 2026-06-15
- **Status**: APPROVED (Julio: the most interesting/important part of the app can't hide; the Início must keep its key insights, Copiloto holds the processed story).
- **Decision**: The Copiloto answers three questions at the top, one line each — **Estou bem?** (verdict from the burn-down delta), **Pra onde vou?** (the existing `phase_projection` insight: "neste ritmo fecha em ~€X, €Y abaixo/acima · reserva") and **O que faria?** (the shared Amigo Sincero with a "simular" shortcut). It then deepens by module — De onde veio (categories), Mapa do mês (+ biggest day / avg), Ritmo (burn-down), vs previous phase, Social×solo, Settlements — and a Tools footer (simulate · rescue · impact). **Every module is data-gated** (renders only with real signal); a fresh trip shows a short warming-up invite, never an empty screen. The Início keeps its rotating insights and key cards (no regression); analytics that were heavy on the home now also live here.
- **Why**: The app collects a lot; the Copiloto cross-references it into information the user can't read at a glance ("am I doing well? where is this going? how did it turn out vs how it should have?"). Reuses the dashboard model end-to-end — no recomputation.

### DEC-178 — Copiloto cross-cuts live in `src/domain/copilot/` (pure + tested) (v0.22.0)
- **Date**: 2026-06-15
- **Status**: APPROVED.
- **Decision**: New calculations the Copiloto needs (`buildCopilotVerdict`, `summarizeByCategory`, `summarizeDailySpending`, `summarizeSocialVsSolo`, `comparePhasePace`) are pure functions in `src/domain/copilot/` with unit tests (math-verified); the page only orchestrates and presents. The Amigo Sincero rendering was extracted to `cards/AmigoSinceroCard.tsx` so Home and Copiloto share one source (its copy is reconciled once, in G6).
- **Why**: Keeps business logic out of the UI layer (engineering guideline) and the new intelligence honestly testable.

### DEC-179 — Phase comparison & weekday signals appear only with enough data (v0.22.0)
- **Date**: 2026-06-15
- **Status**: APPROVED.
- **Decision**: Cross-cuts that need volume (compare-to-previous-phase needs both phases with real spend; the weekday pattern needs ≥7 days — deferred to a later gate) stay hidden until the data supports them. Each Copiloto module self-censors via its own data gate so the screen never shows a hollow or misleading card.
- **Why**: Premature "intelligence" on three data points is noise; the council's anti-pollution rule keeps the screen trustworthy.

### DEC-181 — Copiloto "course correction": trend over the forecast snapshots (v0.27.0)
- **Date**: 2026-06-15
- **Status**: APPROVED (2nd Copiloto council — `brain/documents/copilot-expansion-2026-06-15.md`).
- **Decision**: The Copiloto reads the persisted `forecast_snapshots` series (the only time series the app keeps, recorded once per phase per day since M8.3 and barely surfaced) into "Como vinha × como está" — `summarizeForecastTrend(snapshots)`: the trend of the projected end-of-phase spend. Shows "há N dias projetava €X; agora €Y" with an improving/worsening read. Gate: ≥2 snapshots and Δ above tolerance (3%, floor €5); flat self-censors. Repository gained `getByPhaseId`.
- **Why**: Directly answers Julio's "como era pra ser × como ficou / o que faço certo". Uses data we already collect — the highest-value, most differentiated new cross-cut.

### DEC-182 — Copiloto runway: how long the free-to-spend lasts (v0.27.0)
- **Date**: 2026-06-15
- **Status**: APPROVED.
- **Decision**: `calculateRunway(freeToSpendCents, avgDailyCents, daysLeftInPhase)` → whole days the free budget lasts at today's pace, and whether it outlasts the phase. The page shows "no ritmo de hoje, seu livre dura ~N dias (até DATA)" or a reassuring "cobre o resto da fase com folga". Pure reuse, no new data; null until there's both free budget and a real pace.
- **Why**: Visceral, decision-changing ("can I spend today?") — the Waze-ETA of the budget.

### DEC-183 — Copiloto weekday pattern enters with ≥1 weekend + ≥1 weekday (v0.27.0)
- **Date**: 2026-06-15
- **Status**: APPROVED (relaxes the ≥7-day defer in DEC-179: averaging per distinct day needs only one of each kind to be meaningful).
- **Decision**: `summarizeWeekdayPattern(transactions)` buckets expenses by local day (BUG-001 `localDayOf`), then averages per distinct weekend vs weekday day, exposing the ratio ("fim de semana custa 2,1× um dia útil"). Gate: ≥1 weekend day and ≥1 weekday with spend.
- **Why**: Classic, recognizable behavior insight (YNAB/Mint) that helps plan the weekend; cheap and grounded in `tx.date`.

### DEC-184 — Copiloto outing efficiency: beat-target rate + average saving (v0.27.0)
- **Date**: 2026-06-15
- **Status**: APPROVED.
- **Decision**: `summarizeOutingEfficiency(outings)` over closed outings that set a target — how many finished within target and the average saving. Gate: ≥2 such outings (one is not a pattern). Pure function + unit tests; the page maps closed sessions → {target, total} via `calculateSessionTotal`.
- **Why**: Validates the outing feature and motivates the user who uses it.
- **Backlog (council, not built)**: cash×card split (method reliability), total in home currency (anchor), peak hour / discipline streak, end-of-trip "Wrapped" (V2 — needs the trip closed).

---

> ### Numbering reconciliation — DEC-185…199 and DEC-201 (added 2026-06-17)
>
> **No formal entry for these IDs was ever written into THIS log — but the IDs are NOT free and the
> work they name DID ship.** The log jumps DEC-184 → DEC-200 → DEC-202 because, during the fast
> native + animation arc (web v0.28.0 → v0.40.0), the numbers were assigned *in narration*
> (`project-status.md` and `src/dev-log.md`) without back-filling a formal block here. This note
> records that mapping so the canon stays honest (Truth Policy) and so nobody reuses a "free" slot.
>
> **Canonical record for these IDs = `project-status.md` § "Native Android arc + Wise import
> (v0.28.0 → v0.40.0)" + `src/dev-log.md` + the dated plans in `documents/`.** Mapping:
> - **DEC-185…193 — Capacitor native shell (v0.28.0→v0.35.0)**: Android wrapper, CSS safe-areas,
>   hardware back-button, softened haptics, runtime GPS/notification permissions, persistent
>   storage, native live-update scaffolding. Sources: `documents/android-native-strategy-2026-06-15.md`,
>   `documents/phase1-native-execution-package-2026-06-15.md`.
> - **DEC-194 — Motion system (v0.36.0)**: CSS-first page transitions, staggered lists, FAB/sheet/
>   toast/nav micro-interactions. Source: `documents/animation-system-spec-2026-06-15.md`.
> - **DEC-195…199, 201 — Post-animation fixes (v0.37.0→v0.39.0)**: detail-sheet portal rest,
>   first-entry transition, bidirectional swipe, one-screen active outing, FAB speed-dial, and the
>   no-open quick-add notification. Sources: `documents/post-apk-improvements-plan-2026-06-15.md`,
>   `documents/live-update-nowbar-technical-spec-2026-06-15.md`.
> - Adjacent, properly-logged work in the same window: **DEC-180** (navigation redesign), **DEC-177,
>   178, 179, 181, 182, 183, 184** (Copiloto — note these sit *after* DEC-180 in the file: history,
>   not error), **DEC-200** (Wise import), **DEC-204/205/210** (later native decisions).
>
> **Policy going forward:** the next NEW decision id is **DEC-212**. Do not reuse 185–199/201 for
> anything else — they belong to the native/animation arc above. If that arc ever needs a fully
> formal entry, write it as a NEW id (≥212) that back-references the sources here.

---

### DEC-200 — Wise CSV statement import (v0.40.0)
- **Date**: 2026-06-15
- **Status**: APPROVED & SHIPPED (Julio provided 3 real Wise card statements; plan `brain/documents/post-animation-fixes-and-wise-import-plan-2026-06-15.md`).
- **Decision**: Import Wise card statements as expenses. (1) **Schema** is additive only — `Transaction.externalRef?: string|null` (non-indexed, no Dexie migration) stores `wise:<TransferWise ID>` as the dedupe key; imports also set `excludeFromLearning` so a historical batch never skews quick-value learning. (2) **Pure domain** in `src/domain/import/`: an RFC4180 parser (locale-robust amounts — rightmost `.`/`,` is the decimal; DD-MM-YYYY dates) and a classifier that dedupes cross-file by ID, guesses category from merchant/description keywords, extracts the city from the trailing UPPERCASE token(s), assigns the phase by date, and flags each row `new` / `duplicate_import` (ref already on device) / `possible_manual_dup` (same day+amount as a MANUAL expense → shown unchecked). Credits are shown but never imported; fees import as `other`. (3) **Atomic commit** (`commitWiseImport`, one Dexie transaction) with undo via the existing `softDeleteTransactionsBatch`. (4) **UI** `/import/wise` (entry from the Wallets header): multi-file picker → summary → target wallet (existing or one-tap "Wise EUR") → editable per-row review → "Import N · total" + undo. i18n pt-BR/en/es.
- **Why**: Turns the card statement (where the real per-purchase spend lives) into TripPilot expenses with the least manual work, while the `externalRef` + manual-dup heuristic guarantee "no duplicating what already exists". The importer never invents FX rates: base = original amount (exact for the EUR wallet on the EUR trip; documented fallback otherwise). 968 tests (24 new, run against the 3 real statements).

### DEC-202 — Reset the app: backup-first, two modes (v0.48.0, item 3)
- **Date**: 2026-06-16
- **Status**: APPROVED & SHIPPED (Julio field feedback item 3; option A — web slice first).
- **Decision**: Settings › Data & security gains "Zerar o app". It ALWAYS exports a full backup JSON first (safety net), then offers two modes behind a type-to-confirm word: (a) **keep structure** — `resetKeepStructure` clears only the recorded entries (transactions, shares, sessions, sessionItems, settlements, forecastSnapshots, mirroredStatements, mailboxQueue) and reopens planned items (purchases → `planned`, links cleared; occurrences → `linkedSessionId` null) so reserves stay active; it also writes a `localSnapshot` restore point (undoable). (b) **wipe all** — `resetWipeAll` clears every table, re-seeds default appSettings + a fresh device, clears the emergency snapshot, and hard-reloads into onboarding. Both DB paths run in a single Dexie transaction (all-or-nothing). Pure orchestrators in `domain/orchestrators/reset-orchestrators.ts` + 3 tests.
- **Why**: Julio wanted a clean restart "do zero" with a restore point + backup beforehand; keep-structure lets him re-run the same trip from a blank ledger without rebuilding phases/funds/participants.

### DEC-203 — Version awareness + Pages deploy topology correction (v0.48.0, item 20 / G8a)
- **Date**: 2026-06-16
- **Status**: APPROVED & SHIPPED (Julio field feedback item 20; G8a — the web half of the OTA plan).
- **Decision**: (1) Publish a manifest at `public/version.json` (`version`, `requiredNativeVersion`, `apkUrl`, `notes`). (2) Pure `domain/version/version-check.ts` (`compareSemver`, `evaluateVersionStatus` → `up_to_date | web_update_available | apk_outdated | unknown`) decides the honest state from the running web version, the installed APK version (`@capacitor/app` `App.getInfo()`), and the manifest. (3) Settings "About" shows the web bundle version always and the APK version on native; "Check for update" keeps the service-worker flow on PWA but on native answers honestly (incl. a tap-to-download link when the APK is too old). The actual OTA bundle swap is deferred to G8b (Capgo, in the native APK).
- **Deploy topology correction**: discovered while wiring the manifest — the Cloudflare Pages project's PRODUCTION branch is **`master`** (apex `trippilot.pages.dev`); CLI deploys to `--branch=main` had been landing as **Preview** (`main.trippilot.pages.dev`), leaving the apex frozen at `trippilot-v35`. Fixed by deploying with `--branch=master`; the apex now serves the current bundle + `/version.json`. Production deploys must use `--branch=master` going forward (or push local `master` to origin so the Git build matches).
- **Why**: Julio could not tell why "buscar atualização" did nothing in the APK; the app now explains the real situation, and the manifest is the foundation for true OTA (G8b). The deploy fix also unfroze the public production URL.

### DEC-204 — Native backup share/save + Capgo live-update (v0.49.0, items 6/7/10/11/20 / G6-native+G7+G8b)
- **Date**: 2026-06-16
- **Status**: APPROVED & SHIPPED (Julio field feedback; "one APK" batch — he chose to bundle all native changes + host the OTA bundle on the same Pages).
- **Decision**: One APK (versionCode 15 / 0.49.0) lands four native items. (1) **Backup share/save (items 6/7)** — `@capacitor/share` + `@capacitor/filesystem`; boundary `utils/native/file-share.ts` (`shareFileNative` → Cache + OS share sheet; `saveFileToDevice` → `Directory.Documents`); `downloadFile` prefers the native share, new `saveFile` + "Salvar no aparelho" button. (2) **Outing notif → screen (item 10)** — `OutingNotificationPlugin` emits a `quickAdd` Capacitor event (static `liveInstance`/`notifyQuickAdd`) fired by `OutingActionReceiver`, reconciled live in JS. (3) **Outing zoom/shake (item 11)** — full-screen `minHeight` pre-divided by `--native-zoom` to cancel the `#root { zoom:1.06 }` overflow. (4) **Live-update (item 20 / G8b)** — `@capgo/capacitor-updater` self-hosted (`autoUpdate:false`, `resetWhenUpdate:true`); boundary `utils/native/live-update.ts` + cold-start boot `utils/live-update-boot.ts`; manifest gains `bundleUrl`; `scripts/make-ota-bundle.mjs` zips `dist/` → `dist/bundles/<version>.zip` published on Pages. OTA applies on cold start only and is gated by `requiredNativeVersion` (an APK older than the bundle requires is told to reinstall, never silently OTA'd).
- **Why**: "Enviar backup" did nothing in the WebView (`navigator.share({files})` fails) and there was no save-to-device; the value tapped on the notification never reached the active outing; the outing screen looked zoomed and shook; and web-only releases never reached the installed APK. This batch makes the native shell honor all four, and from 0.49.0 on, web-only releases ship over the internet without a new APK — only native changes (which bump `requiredNativeVersion` + versionCode) need a rebuild.

### DEC-205 — Field Round 2 · Wave F native APK: QR camera, public Downloads, no overscroll (v0.50.0, items 1/12/13)
- **Date**: 2026-06-16
- **Status**: APPROVED & SHIPPED (Julio field feedback round 2; he chose order F→A→B→C→D→E — ship the native wave FIRST so the APK is testable early. Plan `brain/documents/improvements-master-plan-2026-06-16-round2.md`; council ran inline per `tech-lead-delegation.mdc`).
- **Decision**: One APK (versionCode 16 / 0.50.0) lands three native fixes. (1) **QR camera (item 12)** — added `android.permission.CAMERA` (+ `uses-feature camera required=false`) to the manifest. Root cause confirmed in the Capacitor 8 source: `BridgeWebChromeClient.onPermissionRequest` already LAUNCHES the runtime CAMERA request for `getUserMedia`; it only failed because the permission was undeclared (Android denies an undeclared permission before any prompt). No WebChromeClient subclass, no new dependency. (2) **Save backup to public Downloads (item 1)** — `@capacitor/filesystem` has no `Directory.Downloads` and its Documents path is sandboxed on Android 11+, so a small native plugin `DeviceFilePlugin` (`@CapacitorPlugin("DeviceFile")`, `saveToDownloads`) writes via `MediaStore.Downloads` (API 29+, no permission, `@RequiresApi(Q)`) with a legacy public-Downloads fallback; JS boundary `utils/native/device-file.ts` → `file-share.ts` `saveFileToDevice` prefers Downloads and falls back to Documents (an older APK or any failure still saves). (3) **No overscroll stretch (item 13)** — `MainActivity` sets `getBridge().getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER)` (CSS cannot suppress the Android 12+ edge glow) + defensive `overscroll-behavior:none` under `.cap-native`. `requiredNativeVersion` bumped to 0.50.0 (these are native capabilities a 0.49.0 APK lacks). Web/PWA untouched — every native path is `isNativeApp()`-guarded / `.cap-native`-scoped.
- **Why**: Julio could not grant the camera to read a QR ("a câmera não está liberada para pedir permissão"), backups landed where he could not find them, and the whole UI (header/footer included) stretched on overscroll. Shipping the native wave first gives a testable APK before the larger web waves (A–E) that follow over the air.
- **Env note**: this build machine defaults to Node v18, which lacks `globalThis.crypto.subtle` → the 6 `domain/sync/ecies.test.ts` tests fail spuriously. Use Node 22 (`nvm`) for tests/build/`cap sync`/`gradlew`.

### DEC-206 — Receipt OCR/AI → items → split: build NOW, device-local images, Groq cloud opt-in in V1 (reopens D4)
- **Date**: 2026-06-16
- **Status**: APPROVED (Julio, via AskQuestion). Research/spec: `brain/documents/receipt-ocr-item-split-research-2026-06-16.md`.
- **Decision**: Build "photo on any expense + read receipt → items → select → split", prioritized **NOW** (field Waves A–E paused). Locked choices: (1) **WHEN** — now, top priority; (2) **IMAGES** — stored **device-local only** (new Dexie **v8** `attachments` table, NOT in `BACKUP_TABLE_KEYS`; images do not travel in backup/restore — same pattern as `localSnapshots`); (3) **CLOUD AI** — included in V1 as an **opt-in turbo** via **Groq `meta-llama/llama-4-scout-17b-16e-instruct`** behind the existing `trippilot-sync` Worker (key = Worker secret, never in the client), with the default remaining **100% on-device** (ML Kit Text Recognition native; tesseract.js web fallback); (4) **SOURCE** — camera + gallery; (5) **PROVIDER** — Groq (does **not** train on data) over Gemini-free (which trains on free-tier content + human review). Reuses the Wise-import `parse→review→commit` pattern and the `Session`/`SessionItem`/`participantShares` outing+split engine — receipt items are `Transaction`s (no new persistent entity). **Reopens D4** (2026-06-13, `feature-expansion-master-plan-2026-06-13.md`), which had deferred OCR (tesseract-only, pre-native).
- **Gate plan (V1 = G1+G2+G3)**: G1 attach image (schema v8) · G2 on-device read → items → split → Outing · G3 Groq turbo (opt-in, Worker proxy) · G4 polish.
- **Why**: Julio's real need (split a market receipt by item among people) + the app now being native unlocks on-device ML Kit, and Groq free vision (already used in `groupResume`) makes structured extraction reliable. Privacy anchor preserved: on-device default, cloud opt-in with honest disclosure, no-train provider.
- **Addendum (2026-06-16, same day)**: Julio added two constraints → (a) the app is **not on the Play Store** (maybe never): use the **bundled** ML Kit Text Recognition (`com.google.mlkit:text-recognition`, model linked into the APK) so OCR runs with **no Play Services / no Play Store** (sideload-safe, fully offline) — VERIFIED 2026-06-16. (b) **iOS users are WEB users** (no PWA, no native shell) → they have no on-device OCR, so the **Groq cloud path is the universal primary experience**, not a mere opt-in turbo. **Gate order revised to cloud-first**: G1 attach photo (OTA) → **G2 cloud extraction + review/split → Outing (OTA; serves iOS+web+Android in one gate)** → G3 on-device ML Kit bundled (Android APK; private/offline default) → G4 polish. G1+G2 ship over the air (no APK); only G3 needs a new APK. Cloud stays opt-in with honest disclosure; on Android, G3 makes on-device the private default.

### DEC-207 — Shared Participant Link (guest → permanent user): async E2E persistent share, portable backend, owner/mirror reused
- **Date**: 2026-06-16
- **Status**: **APPROVED — direction & key decisions locked by Julio**, then **REVISED 2026-06-16 (night): real-time IS desired** (best-effort, see decision 1c + the doc ADDENDUM). Build is the active epic (after the receipt fixes). Full research + inline council + portable-backend research + gates **S0–S9** (S7 = real-time) in `brain/documents/shared-participant-link-research-and-plan-2026-06-16.md`.
- **Context**: Julio wants to share a split via a link with someone who **does not have the app**; they open it, see **only their slice** (what they owe / are owed), **without seeing the whole trip** and **without a signup** — and can **approve** expenses and **mark them settled**, with an optional **"start my own trip"** upgrade later.
- **Finding**: the financial model already exists — **DEC-106 owner/mirror** (owner is the truth; peer gets a read-only statement, confirms/rejects; responses flow back), **DEC-102** itemized statement, **DEC-071** share confirmation. The missing piece is the **transport**: today sharing is synchronous P2P / in-person QR with **ephemeral** rooms (DEC-107, ~10 min). The link is **asynchronous** (guest opens it later; owner may be offline) → needs a **persistent server-hosted artifact** addressed by the link.
- **Decision (locked)**:
  1. **Persist on the server: YES** ("hoje não tem problema") — store **ciphertext only**, E2E (the key rides in the link `#fragment`, never reaches the server — same principle as DEC-103's QR key), with TTL + revoke. **Two hard constraints from Julio: (a) zero cost / best cost-benefit for a long time; (b) full portability — NO vendor lock-in, must be easy to migrate off Cloudflare later** (he has seen a project trapped in Supabase). **(c) REVISED 2026-06-16 (night): real-time IS desired** — Julio clarified he *does* want "criar a divisão e já chegar no celular do outro em tempo real + notificação". Done as **best-effort (S7) on top of the async-pull floor**: a **WebSocket relay reusing the existing `SyncRoom` Durable Object** (transport only; persistent data stays in **portable D1**, so no new lock-in) delivers live when both online + fires an **Android notification with the app open**. **Honest limits (out of scope):** push with the app **closed** (needs FCM/Play Services — we are sideload-only, DEC-206) and **iOS-web** (no native, web push too limited) → both fall back to the async pull (seen on next open). Async pull remains the guaranteed floor.
  2. **Guest = a permanent, signup-less user**, not an ephemeral session: opening the link **provisions a persistent local `actorId`** (the link is the credential, no account — coherent with DEC-105) with two areas — **"Minhas viagens"** (own trips, 0..N) and **"Compartilhadas comigo"** (received slices). The guest can **view / edit / add** on the slice ("almost a group") and later **create their own trip**. This introduces a new top-level "Shared with me" area in the app shell (symmetric: any user can be owner of their trips AND guest of others' slices).
  3. **Settle = guest proposes "paguei" → flows back → OWNER confirms** (round-trip; owner/mirror DEC-106). The guest never rewrites money; their edits/additions are **proposals the owner reconciles** (extends DEC-071 confirm/reject from shares to added/edited lines). PIX-first / Wise hints = nice-to-have, not required.
  4. **Timing**: dedicated epic **now (after the receipt epic), before resuming round2 Waves A–E**.
  5. **Backend (Julio: "você decide, mas pesquise certo")** → researched, free + portable (VERIFIED 2026-06-16): **API in Web Standards via Hono** (runs on Workers/Deno/Bun/Node/Vercel — "no vendor lock-in, start on a cheap Node and move to edge without rewriting"); **storage behind a `ShareStore` interface** over **D1 (SQLite, primary** — 5 GB free forever, portable via `wrangler d1 export` → standard `.sql`**)**, **R2 (S3-compatible, optional** for blobs — 10 GB free, zero egress, universal S3 API**)**; **NO Durable Object** in the persistent path (it is the one truly CF-locked primitive — kept only for the existing ephemeral signaling, which is NOT expanded). TTL + revoke; per-link PIN **default OFF**.
- **Reverses (made honest, not silent)**: **DEC-107 / spec "no remote database / Worker stores nothing"** — this feature **stores ciphertext** (TTL'd, revocable, rate-limited, **portable**). It **keeps** "the server never sees plaintext" **and** adds "stores ciphertext only". The product-spec "V1 NOT in scope" line must be rewritten (README truth policy) at S0.
- **Guardrails (council)**: owner/mirror (no guest money rewrite); E2E key only in `#fragment`; redaction at the source via `buildGuestShareSlice` (a leaked link exposes only that one guest's slice); TTL + revoke/rotate; rate-limit + size cap on the public endpoint; **portability by design** (interface + standards); **async pull is the floor; real-time is a best-effort relay (transport only, data in portable D1)** — see 1c; **do NOT** drift into bidirectional merge / CRDT / full real-time group sync (DEC-108 stays deferred).
- **Recommended v1 cut**: ship **view + approve + add OWN expense (as proposal) + settle**; defer **edit/delete of others' expenses** to v1.1 (heavier reconciliation). Confirm at epic kickoff.
- **Subsumes**: F19 (link pairing, round2 master plan Wave C) — same `/s`+`/pair` routing and "share/connection" hub.
- **IMPLEMENTED 2026-06-16 (night) — shipped 0.57.0 (async E2E) + 0.58.0 (S7 real-time), web-only OTA**. Two honest deltas from the plan above, both preserving the constraints (zero-cost, portable, E2E):
  1. **Storage = Cloudflare KV (`SHARE_STORE`), not D1.** The deploy token lacked the `d1` write scope but had `workers_kv`; KV is an even simpler portable `id→ciphertext` store (self-contained ciphertext values + native per-key TTL; migrate by copying keys to any KV/object store — no schema lock-in). Routes: `POST/GET/PUT/DELETE /share`, `POST/GET /share/:id/responses`; owner ops gated by a write-token whose SHA-256 hash is all that is stored.
  2. **S7 real-time = a new `ShareSignal` Durable Object (the SyncRoom *pattern*, not the same instance).** A pure WebSocket fanout relay keyed by `shareId`, **transport only** — it carries tiny `{t:'upd'|'resp'}` "go-pull" signals and stores nothing; the statement/responses stay E2E-encrypted in **KV**. Portability preserved (the DO is disposable transport: swap for any WS server; data is untouched in KV). Guest live: auto-refresh + in-app toast "Fulano atualizou os gastos compartilhados com você". Owner live: auto-pull on guest response. **Honest limits unchanged:** app-open only (no FCM/Play Services for app-closed push; iOS-web falls back) → async pull stays the floor.
  - **Verified**: 1096 unit tests (incl. real AES-GCM owner↔guest cycle) + worker WS-fanout smoke + **Playwright across two isolated browser contexts**: owner→guest→owner reconcile (share flips Pendente→Confirmado), receipt split-picker defaults to personal (DEC-208), and the S7 live toast arriving with **no guest action**.
  - **Deferred to S8 (native, documented):** Android App Links for `/s/:id` (assetlinks) + a native LocalNotification when the app is foregrounded — both require an APK rebuild/bump, so they ride the next native release, not OTA.

---

### DEC-208 — Receipt split: explicit participant picker (no auto-all)
- **Date**: 2026-06-16
- **Status**: APPROVED (field feedback) — implemented.
- **Context**: Julio scanned a 40-item market receipt; the AI read was "100% perfect", but the split step **auto-included every registered participant**. He must be able to **choose who** to split with (1, 2, … people), not "split equally with everyone".
- **Decision**: at the receipt level, replace the "Equal (everyone)" preset with an **explicit participant multi-select** ("split with whom?"). Selecting a subset splits the included items **equally among the selected set** (owner implied when ≥1 other is chosen); selecting none = personal. The per-item editor's "split on" no longer defaults to everyone — it seeds from the receipt-level selection (or just the owner), never the whole roster.
- **Guardrails**: pure UI/state over the existing `ReceiptDraftItem.participantIds`; no engine/math change; keeps "personal" as the zero-state.

### DEC-209 — Receipt OCR: cloud AI is the sole scan engine (on-device removed)
- **Date**: 2026-06-16
- **Status**: APPROVED (field feedback) — implemented. **Reverses DEC-206 G3** (on-device OCR).
- **Context**: Julio: cloud-AI scan "funcionou 100%, perfeito"; the **on-device (ML Kit / tesseract) read "simplesmente não funciona, não leu nada certo"**. He asked to **remove it and keep only the AI** (heuristic text parsing of raw OCR is fundamentally weaker than the vision LLM; likely a tech limitation).
- **Decision**: remove the on-device path from the scan UI; **cloud AI (Groq, opt-in consent) is the only reader**, with **manual entry** as the always-available fallback. Drop `@jcesarmobile/capacitor-ocr` (native ML Kit, ~13 MB) and `tesseract.js`, plus the now-dead `device-ocr.ts` / `parse-text.ts` — this **shrinks the APK** (good for the new auto-updater download) and the web bundle.
- **Guardrails**: privacy story preserved (Groq does not train on data per DEC-206; opt-in consent stays); manual entry covers the offline/no-consent case.

### DEC-210 — Native APK self-update (in-app installer) + APK always to Downloads
- **Date**: 2026-06-16
- **Status**: APPROVED (field feedback) — implemented.
- **Context**: Julio confirmed **web OTA now works** (check-update pulls the new web bundle). But the **APK never auto-updates** — he manually finds the built APK, sends it to the phone, installs. Reason: OTA (Capgo) only swaps the **web bundle**; the **native shell** can only change by reinstalling, and `requiredNativeVersion` only flags the APK as outdated when a bundle *requires* a newer shell — so a newer-but-not-required APK is invisible.
- **Decision**:
  1. Manifest gains **`latestNativeVersion`** (the versionName of the APK at `apkUrl`). The app flags **`nativeUpdateAvailable`** when installed native < latestNativeVersion (distinct from the hard `apk_outdated`).
  2. **Android in-app updater**: download the APK (Filesystem) → launch the system **package-installer Intent** via a small native plugin + a FileProvider, gated by **`REQUEST_INSTALL_PACKAGES`** (Android still shows its own one-tap install/consent screen — we cannot install silently, and should not). iOS/web: no-op (PWA self-updates).
  3. Build pipeline always **copies the freshly built APK to `/mnt/c/Users/julio/Downloads/TripPilot-<version>.apk`** so it is one place away even if the in-app path is skipped.
- **Guardrails**: honest — "one-tap install" (user still confirms in the OS dialog), never silent; no Play Services/FCM assumed; fully degrades to the existing "download link" when the installer is unavailable (older shells).

### DEC-211 — Field Round 2 web waves A–E shipped (v0.59.0 → v0.63.0, OTA)
- **Date**: 2026-06-17
- **Status**: APPROVED & SHIPPED. Plan: `brain/documents/improvements-master-plan-2026-06-16-round2.md` (decisions locked in its §4; Wave F native was DEC-205). Per-wave detail in `src/dev-log.md`.
- **Context**: Julio's second field list after the 0.50.0 native APK. Locked order F→A→B→C→D→E; non-negotiable **zero regression** (nothing removed — ÂNCORA 9; meta/cofrinho/renda-futura read-only — ÂNCORA 11; check-in never writes — ÂNCORA 12).
- **Decision (delivered)**:
  1. **Wave A (0.59.0)** — home/UX quick wins: global scrollbar hidden (FastScroller kept), BottomSheet drag-to-close, recent-expenses relative day/time, Amigo Sincero recolored by tone + `on_plan` hidden on home, Gastos swipe-bug fix, contextual+pinnable piggy bank, check-in fused into the hero, amigo/divisions not paired, **F10 interactive drag page transition**.
  2. **Wave B (0.60.0)** — phase map: one card, two visible tabs ("Disponível por dia" calendar default + "Gastos por dia" heatmap, no auto-rotate); each day total = **free + reserved** with a tap-to-breakdown; math stays consistent with `calculateTodayFreeBudget`.
  3. **Wave C (0.61.0)** — Settings as Samsung-style category list → focused subpages (global search kept); pair **by link** (`/pair#<identity>` open-and-confirm) + a Connections hub. Native App Links deferred to a device-verified native batch.
  4. **Wave D (0.62.0)** — future vision: read-only **phase preview** ("dia 1") reusing the live allowance math + **planned income per phase** that feeds ONLY the projection (ÂNCORA 11 invariance proven by test).
  5. **Wave E (0.63.0)** — smart Wise import, all three F16 intelligences, suggestion-only: **F16a** reimbursement bridge (link an incoming repayment to a near purchase → split + settle in one import), **F16b** create-phase inline for out-of-phase rows, **F16c** ticketing/festival category guess (Paylogic/Eventim/Tomorrowland → entertainment).
  6. **F14 web (0.64.0)** — outing place-picker parity: the active-outing place sheet now has the **same place intelligence as the expense quick-add** — a pure `buildPlaceSuggestions` unifies online **nearby** + offline **recent history** into one **searchable** list (accent-insensitive; the field both searches and names), plus a reverse-geocode "find name (online)". The web part the plan had deferred from waves A/B (only the native GPS grant was Wave F, already shipped). Expense flow untouched (zero regression).
- **Guardrails**: every wave gated on full unit suite + tsc + web build + E2E + Playwright visual QA, then OTA deploy `--branch=master` (apex). Web/pure only → no new APK; `requiredNativeVersion` 0.50.0, `latestNativeVersion` 0.56.0 unchanged. Final state: **1147 tests / 128 files**, HEAD `8a6c923` (0.64.0).
- **Deferred (by design, next native APK batch)**: native App Links for `/pair` + `/s/:id` (need device cert verification); F15 receive-`.csv` intent; F14 **native GPS-grant** part only (the web search/recents/find-online shipped in 0.64.0). F10 was delivered in Wave A per Julio's accept-the-cost decision.

### DEC-212 — Real income transaction type (B8, v0.67.0, OTA)
- **Date**: 2026-06-17
- **Status**: APPROVED & SHIPPED. Plan: `brain/documents/master-fix-and-skipped-features-plan-2026-06-17.md` (Wave 2-B). Per-wave detail in `src/dev-log.md`.
- **Context**: until now money could only LEAVE (expense/transfer/withdrawal) or be projected (F17 planned income = projection only, ÂNCORA 11). Field need: money that really arrives mid-trip — a reimbursement, someone paying you back, an unexpected extra — had nowhere to go, so users faked it (a negative expense, or editing the fund total) which corrupted "spent", learning, and history.
- **Decision**: add a fifth `TransactionType` = **`income`** — a REAL transaction that **grows the chosen pool** (`calculatePoolIncome`, additive to budget in `calculateFreeToSpend`) and **credits the chosen wallet** (`calculateWalletBalance`). It is **never** a personal cost (`personalCostCents: null`), **never** counted as spend (`calculatePoolSpent` stays expense+adjustment only), **never** categorized (`category: null`), and **always** excluded from value learning (`excludeFromLearning: true` — income is not a spending pattern). New dedicated `IncomePage` (FAB → "Registrar entrada") so the critical expense flow (`QuickAddPage`) is untouched. Surfaced as a green "+" additive line in the FTS hero breakdown ("Entradas recebidas") and a green/savings row in recent activity.
- **Invariance (proven by `income.test.ts`, 18 cases)**: with **zero** income transactions every downstream number is **bit-identical** to before income existed — FTS, pool remaining, pool-summary %used, wallet balance, breakdown lines (the income line is omitted entirely when 0). Math verified end-to-end via E2E: 1500 + 250 − 101.80 − 150 − 200 = 1298.20.
- **Scope (V1)**: income is recorded in the **trip base currency** (foreign-currency income via `baseCurrencyAmountCents` is supported by the factory/domain but the dedicated page collects base only — documented limitation, deferrable). `ExpenseDetailPage` views/edits/deletes income generically (no type-specific UI yet — consistent with how transfers/adjustments already render there).
- **Guardrails**: additive only; gated on full unit suite (1187 tests / 132 files) + tsc + web build + E2E Playwright visual QA, then OTA deploy `--branch=master`. Web/pure → no new APK; `requiredNativeVersion` 0.50.0 / `latestNativeVersion` 0.56.0 unchanged.

### DEC-213 — Biometric unlock as a layer over the PIN (B6, v0.68.0, OTA)
- **Date**: 2026-06-17
- **Status**: APPROVED & SHIPPED. Plan: `master-fix-and-skipped-features-plan-2026-06-17.md` (Wave 3). Per-wave detail in `src/dev-log.md`.
- **Context**: the app lock (DEC-161 / E6 M20) shipped PIN-only (PBKDF2-SHA256, salt+hash, never the PIN in clear). The plan's B6 asked for biometric unlock as a **convenience layer on top of** the PIN, never a replacement, with recovery never trapped (ÂNCORA 12).
- **Decision**: on web/PWA, add a **WebAuthn platform authenticator** unlock (`navigator.credentials` boundary in `utils/biometric-unlock.ts`). Enabling it (Settings → app lock → "Desbloquear com biometria", only shown when `isUserVerifyingPlatformAuthenticatorAvailable()` is true and a PIN exists) **registers a local platform credential** and stores only its id (base64url). The lock screen offers a biometric shortcut (auto-prompt once + button) and, on success, unlocks. There is **no server**, so the assertion signature is not verified — the value is purely the OS user-verification ceremony for a device-bound credential; the **PIN remains the real secret and the always-available fallback**.
- **ÂNCORA 12 (never trapped)**: biometrics can only be ON when a PIN is set; turning the PIN off clears biometrics; any biometric failure/cancel/unsupported device silently falls back to the PIN field; the credential id is device-local (useless after a backup restore to another device, where the PIN simply takes over). Settings fields `appLockBiometricEnabled` / `appLockBiometricCredentialId` are non-indexed, default off/null, backfilled in the repository.
- **Verification**: pure parts unit-tested (`biometric-unlock.test.ts`: base64url round-trip + the `isBiometricUnlockReady` gate). Full flow E2E with a **CDP virtual authenticator**: enable → register → reload → (a) biometrics FORCED to fail → PIN still unlocks (ÂNCORA 12 proven), (b) biometrics succeed → auto-unlock. Screenshots reviewed (settings toggle, lock screen with "Usar biometria"). Native biometric (Capacitor plugin) intentionally **deferred to the native batch (Wave 4)** — this wave is web/OTA only.
- **Guardrails**: additive, opt-in; gated on full suite (1208 tests / 133 files) + tsc + web build + E2E + OTA deploy `--branch=master`. Web/pure → no new APK; native versions unchanged.

### DEC-214 — Copilot v3 data-gated cross-cuts (B10, v0.68.0, OTA)
- **Date**: 2026-06-17
- **Status**: APPROVED & SHIPPED. Backlog of DEC-184 (Copilot intelligence). Plan: Wave 3.
- **Decision**: add four more **pure, self-censoring** Copilot reads in `domain/copilot/copilot-insights.ts`, wired into `CopilotPage` as memos that render only when their function returns non-null: **`summarizeHomeCurrencyTotal`** (whole-trip anchor in the home currency), **`summarizePaymentMix`** (cash vs card, where card = debit/credit/digital and `other`/wallet-less is "untracked"; needs BOTH sides), **`summarizePeakHour`** (local hour with the most spend; needs ≥3 expenses), **`summarizeDisciplineStreak`** (consecutive spending days at/under the phase's per-day pace; needs a positive target and a ≥2-day run). All ignore deleted/non-expense rows and use `transactionBasePersonalCostCents`.
- **Rationale**: more "honest friend" signal without clutter — every module hides itself when the data is thin, consistent with the existing data-gated sections. No new dependencies, no schema change.
- **Verification**: 16 new unit cases (`copilot-insights.test.ts`, total 42) covering math, tie-breaks, exact-on-target, deleted/non-expense exclusion, and the self-censor thresholds. E2E screenshot of `/copiloto` on demo data shows all four rendering.

### DEC-215 — Native batch: receive `.csv` + App Links + native GPS (B1+B2+B3, APK 0.69.0, device-pending)
- **Date**: 2026-06-17
- **Status**: CODE-COMPLETE, NOT PROMOTED — APK built (versionCode 22 / 0.69.0) and all CI gates green, but **not shipped to `apkUrl` and `version.json` unchanged** because the acceptance criteria are `[device]` and there is no physical Android in this session. Plan: `master-fix-and-skipped-features-plan-2026-06-17.md` (Wave 4 / Bloco 1). Per-wave detail in `src/dev-log.md`.
- **Context**: three features were blocked only on the native shell: **B1** receive a `.csv` shared from another app (Wise/Files → TripPilot), **B2** open `/pair` and `/s/:id` App Links inside the app (today they only resolve in the browser/PWA), **B3** the native GPS permission grant (the F14 web search/recents/find-online shipped in 0.64.0; only the runtime grant was left). The plan groups them into **one APK** since the expensive part is the device cycle, not the code.
- **Decision (B1 — shared CSV)**: a native `ShareTargetPlugin` (`@CapacitorPlugin("ShareTarget")`) reads the CSV from the launch/`onNewIntent` intent (ACTION_SEND `EXTRA_STREAM`/`EXTRA_TEXT`, or ACTION_VIEW `content://`/`file://`, CSV MIME types only so generic text shares are not hijacked) and buffers it. JS boundary `utils/native/share-target.ts` keeps the CSV **in memory** (not the URL — a statement is too big for a query string), `RootLayout` routes the user to `/import/wise?shared=1`, and `WiseImportPage` drains it through the **exact same pure `parseWiseCsv` path** as a manual upload (refactored into one `ingestCsvTexts`). Manifest intent-filters for `text/csv` / `text/comma-separated-values` / `application/csv`.
- **Decision (B2 — App Links)**: `public/.well-known/assetlinks.json` published at the apex with the **debug keystore SHA-256** (`C9:D3:…:AC`); manifest `<intent-filter android:autoVerify="true">` for `https://trippilot.pages.dev/pair` and `/s/*`; `utils/native/deep-link.ts` parses the incoming URL and navigates **preserving the `#fragment`** (where the `/s/:id` key `#k=` and the `/pair` identity live). Pure `parseDeepLink` is unit-tested; only our host + `/pair`/`/s/` prefixes are owned (foreign hosts rejected). **Open risk to verify on device**: whether Android delivers the fragment — if it is stripped, the honest fallback (already documented in the plan) is App Links for `/pair` only and keep QR/scan for `/s/:id` (the key must never go to the query string where it would leak).
- **Decision (B3 — native GPS)**: already code-complete — `ensureLocationPermission()` (`utils/geolocation.ts`) does the native `checkPermissions`/`requestPermissions` via `@capacitor/geolocation` and `SettingsPage` calls it before capture; the manifest already declares `ACCESS_FINE/COARSE_LOCATION`. No code change; only the runtime grant prompt needs device confirmation.
- **Anti-regression**: every native entry point is guarded by `isNativeApp()`, so the web/PWA build is byte-for-byte unaffected — the PWA Web Share Target (DEC-161, `/quick-add`) and all web routes are untouched. Proven green: tsc 0, **1221 unit tests / 135 files** (incl. 13 new: 9 `deep-link` + 4 `share-target`), web build, `cap sync`, `assembleDebug` (8.35 MB), **E2E 33/33** (regression guard for the shared `RootLayout`/`WiseImportPage` edits).
- **Why not promoted**: shipping App Links without a device is exactly the "opens but doesn't navigate" bug the plan warns against, and an unverified APK at `apkUrl` would push an untested shell to users. So `version.json` keeps `latestNativeVersion` 0.56.0 / `requiredNativeVersion` 0.50.0; the built APK waits at `android/app/build/outputs/apk/debug/app-debug.apk` for the device session (which also validates the B18 backlog). `assetlinks.json` ships with the next web deploy (Wave 5) so it is live at the apex before the device check. **Release-keystore SHA-256 must be appended to `assetlinks.json` when a release build is signed** (the array already accepts multiple fingerprints; this environment has no `keystore.properties`).

### DEC-216 — E2E in CI (B15) + FundsPage atomic pool creation (B13), v0.70.0 (web/OTA)
- **Date**: 2026-06-17
- **Status**: APPROVED & SHIPPED. Plan: `master-fix-and-skipped-features-plan-2026-06-17.md` (Wave 5). Per-wave detail in `src/dev-log.md`.
- **B15 (E2E in CI)**: the Playwright suite used to run only locally (DEC-054). Added `.github/workflows/ci.yml` (repo root; the app lives in `TripPilot/`) with two jobs on push/PR — **unit** (Node 22 `npm ci` → `typecheck` → `test` → `build`) and **e2e** (`npx playwright install --with-deps chromium` → `npm run test:e2e`, uploading the HTML report as an artifact). Node 22 because the suite needs Web Crypto. `playwright.config.ts` already self-starts the dev server and tightens retries/workers when `CI=true`, so no config change was needed. `.gitignore` now excludes `playwright-report/` / `test-results/`.
- **B13 (orchestrator, opportunistic per DEC-067)**: `FundsPage.handleSave` created a budget pool and then its phase links in **separate** repository calls — a failure between them could leave an orphan pool or partial links. Extracted **`createBudgetPoolWithPhaseLinks`** into `crud-orchestrators.ts` (symmetric to the existing `deleteBudgetPool`), which builds the pool + links via the domain factories and persists them in **one Dexie `rw` transaction**; `global` pools ignore any links, `linked_phases` normalize a `<= 0`/null floor to null. FundsPage now calls the orchestrator and no longer imports the entity factories. Behaviour-preserving (3 new unit tests lock the contract). The remaining DEC-067 debt (other pages doing single-table writes / settings updates — low atomicity risk) is left as documented opportunistic follow-up; a sweeping refactor was deliberately NOT done (out of scope + regression risk).
- **Guardrails**: gated on full unit suite (**1224 tests / 136 files**, +9 deep-link +4 share-target from Wave 4 in-tree + 3 new orchestrator), tsc 0, web build, **E2E 33/33**, then OTA deploy `--branch=master` → apex **0.70.0** verified (version.json `no-store`+CORS, `bundles/0.70.0.zip` 200, **`/.well-known/assetlinks.json` now real JSON** `application/json`, `/trippilot.apk` preserved byte-identical at the verified 0.56.0 shell — 8,283,527 B — re-fetched from the live apex so the unverified 0.69.0 native APK was NOT promoted, `/pair` + `/s/:id` SPA 200). Web/pure → no new APK; `requiredNativeVersion` 0.50.0 / `latestNativeVersion` 0.56.0 unchanged. Web version bumped to **0.70.0** (0.69.0 reserved for the device-pending native APK).

### DEC-217 — Device-Test Force-Task: Ondas 1–4 web/OTA bug-fix + UX batch (v0.71.0 → v0.75.0)
- **Date**: 2026-06-17
- **Status**: APPROVED & SHIPPED. Source: Julio's field test of the 0.50–0.70 builds → `brain/documents/device-test-results-2026-06-17.md`, triaged into `brain/documents/device-test-fixes-masterplan-2026-06-17.md` (5 waves). Per-wave/per-item detail in `src/dev-log.md`.
- **Context**: Julio tested the installed app across versions 50–70 and filed a batch of bugs + improvements. The masterplan split them into four **web/OTA-deliverable** waves (canonical behaviors below) and one **native + device** wave (DEC-218). Non-negotiables carried throughout: nothing removed (ÂNCORA 9); income/goal/piggy never corrupt "spent" (ÂNCORA 11); check-in never writes (ÂNCORA 12); `navigator.share` always has a copy fallback; web/PWA untouched by `isNativeApp()` guards.
- **Decision (canonical behaviors locked, by wave)**:
  1. **Onda 1 (0.71.0)** — **D-BUG-01** share/pair links are built from `getShareOrigin()` (the canonical apex on native, never the WebView's `https://localhost`); **D-BUG-02** iOS no longer auto-zooms on input focus (viewport `maximum-scale=1`); **D-BUG-14** the expenses search shows a single custom clear ×; **D-BUG-07** scrollbar re-hidden on `html.cap-native` (device re-confirm folded into Onda 5).
  2. **Onda 2 (0.72.0)** — **D-BUG-03** the QR scanner is a front↔back `facingMode` toggle with re-derived 1×/2×/3× zoom presets (no more deviceId round-robin); **D-BUG-17** the photo viewer has internal pinch/double-tap/pan + theme background; **D-BUG-16** a compact photo block on the active outing; **D-BUG-05** photos render on the read-only outing review; **D-BUG-15** (full-bleed margins) could not be reproduced in emulation → device-deferred (Onda 5).
  3. **Onda 3 (0.73.0)** — **D-BUG-11** the "honest friend" uses a calm `steady` (dusty-blue) tone instead of a fake green when over pace but within phase slack; **D-BUG-04** `type:'income'` rows now appear in the expenses list (distinct green `+` row) but the header total + day subtotals stay **expense-only** (pure `expense-feed.ts` locks the invariant); **D-BUG-06** a pure statement credit imports as `income`; **D-BUG-08** the QuickAdd place apparatus is a shared `PlaceField` reused on expense edit (opt-in "use my location", no now≠then override).
  4. **Onda 4 (0.74.0)** — **D-BUG-13** Home recent expenses roll a browsed session into one line (reuses `buildSessionFeed`); **D-IMP-06** `LockScreen` auto-unlocks the instant a valid PIN verifies (silent, `pinRef`-guarded; button = loud fallback); **D-IMP-03** link an existing expense to a planned purchase from the expense detail (pure `compatiblePlannedPurchasesForExpense` + reused link/undo orchestrators); **D-IMP-01** `formatMoneyCompact` shows the day's € in the calendar/heatmap cells; **D-BUG-20** a "receive from another device / QR" door in People & debts (reuses `/sync`); **D-BUG-10** tab switches animate by tab order (`app/nav-direction.ts` one-shot override); **D-BUG-12** `BottomSheet` drag-to-close can start from the body at the top (pure `decideBodyDrag`); **D-BUG-18** clearer receipt item split microcopy (pt/en/es); **D-IMP-02** the phase "see preview" door surfaced on the Viagem tab (route unchanged); **D-IMP-04** native share-or-copy for the statement link (`shareOrCopyLink`, silent on cancel) in `ShareLinkSheet` + `SharedExpensesPage`.
- **Guardrails**: every wave gated on the full unit suite + tsc + web build + E2E (33/33) + Playwright (Pixel 5) visual QA, then OTA deploy `--branch=master` (apex). Web/pure → **no new APK**; `/trippilot.apk` re-fetched from the live apex and re-published byte-identical at the verified **0.56.0** shell (8,283,527 B) every deploy, so the unverified 0.69.0 native APK (DEC-215) was never promoted; `requiredNativeVersion` 0.50.0 / `latestNativeVersion` 0.56.0 unchanged. Final state: **1299 tests / 144 files** (v0.75.0), apex verified each wave. **Onda 4C (v0.75.0) — web/OTA scope close-out**: investigation found the two Onda-4 "se couber" items already shipped — **D-IMP-07** (the outing `ProfileForm` already defaults an icon AND offers a full picker; a real cover-image is a new design surface, not the `[A VERIFICAR — cosmético]` fix → device/design-deferred) and **D-IMP-05 core** (the receipt note name already defaults to the read merchant) — so 4C added only the genuine gap behind Julio's *"ficou só 'nota'"*: a receipt the model read ITEMS but no merchant from is now titled by its **dominant category** ("Mercado"/"Restaurante") via pure `dominantReceiptCategory`. The deeper "note category/subgroup as metadata" overlaps the **deferred D-DEC-A** (per-item category) → stays in the future OCR package. No schema/Worker/native change.
- **Deferred to Onda 5 (device)**: see DEC-218 (native biometric, QR pairing + mailbox repro, device re-confirmation of D-BUG-07/15/01, promotion of the device-pending APK, B18).

### DEC-218 — Native biometric (D-DEC-C) + Onda 5 sync/device batch (APPROVED, device-pending)
- **Date**: 2026-06-17
- **Status**: APPROVED (decision) — **implementation device-pending**. Not executable in a session without a physical Android (and a second device for pairing). Plan: `device-test-fixes-masterplan-2026-06-17.md` (Onda 5).
- **Decision (D-DEC-C)**: implement **native biometric unlock** behind `isNativeApp()` via a Capacitor biometric plugin, as a convenience layer **over** the PIN — same `isBiometricUnlockReady` gate as the web WebAuthn path (DEC-213), PIN always the real secret and fallback (ÂNCORA 12, never trapped). Today biometrics exist only via web WebAuthn, which the Android WebView does not expose, so it is invisible in the installed app. This changes native → a **new APK + device verification** before promotion.
- **Onda 5 also folds in** (all device/native): **D-BUG-19 + D-BUG-09** (QR pairing "connects then stops" + mailbox "delivered but nothing received" — root cause still *A VERIFICAR*; requires reproduction on **two paired physical devices** and the `Mailbox` DO relay); device re-confirmation of **D-BUG-07** (scrollbar) and **D-BUG-15** (full-bleed margins) — exact element only visible on hardware; device verification of **D-BUG-01** App-Link `#fragment` delivery; **promotion of the device-pending native APK** (DEC-215 B1/B2/B3, 0.69.0 → re-sign + verify) only after device OK; the remaining **B18** verification backlog.
- **Why not now**: the acceptance criteria are `[device]`; the gate is "**promote the APK only after device OK**". Shipping native biometric or App Links without a device is exactly the "opens but does nothing" failure the plan exists to prevent, and pairing/mailbox cannot even be root-caused without two devices. Onda 5 is therefore a **Julio device-QA session**, not a code-only deliverable — kept explicitly out of the autonomous web/OTA loop.

---

## Budget Model Reform — Implementation Package #1 (DEC-219 → DEC-225)

> Source of truth: `brain/documents/budget-model-master-decision-2026-06-17.md` (decisions D1–D19) + `budget-model-implementation-prompt-2026-06-17.md` (6 gates). Shipped autonomously across **v0.76.0 → v0.81.0** as the closed, self-contained "budget model v2" package. These DECs record what was approved-and-shipped and reconcile the two opposing money eras (DEC-007 shared-pool ↔ DEC-089 per-phase-fund) into one canonical model (D19).

### DEC-219 — Canonical budget model: Trecho / Pote / Evento / Compra planejada (reconciles DEC-007 × DEC-089 × DEC-153) (Package #1, v0.76.0–0.81.0)
- **Date**: 2026-06-18
- **Status**: APPROVED & SHIPPED (GATE 1 v0.76.0 + GATE 2 v0.77.0 + GATE 6 v0.81.0)
- **Context (D19)**: the app carried **two opposing money models** — "shared pool + reserves" (DEC-007/153 era) and "1 fund per phase" (DEC-089 era) — so the dashboard read the wrong fund (`linkedPools[0]`) and ~10 backend terms (fund/pool/link/envelope/future-floor/occurrence…) leaked to the user. Julio modelled a real trip and got confused about where each value goes.
- **Decision (D1–D4)**: the user sees **4 real-world concepts** — **Trecho** (a leg: dates + a budget → `Phase`+dedicated `BudgetPool(linked_phases)`+1:1 `BudgetPoolPhaseLink`), **Pote** (money set aside → `BudgetPool(global)`), **Evento** (something on a date → `PlannedOccurrence(kind:'event')`), **Compra planejada** (something I'll buy → `PlannedPurchase`). Canonical rules: **(D3)** the dashboard follows the **active phase**'s pool (kills `linkedPools[0]`); **(D4)** **1 trecho = 1 dedicated budget** (Phase+Pool+Link created atomically), sharing a pool across trechos is an *advanced* path; the technical vocabulary **never** appears on the happy path.
- **Anti-regression (D16 / §8 — permanent rule)**: simplify only the **information architecture & nomenclature** that confuses, never **capability**. Everything that exists today (phase rhythm/peak DEC-075, events, activity profiles, multi-currency DEC-158, Wise import DEC-200, outings) stays possible — it just stops being mandatory/visible on the happy path. Audited at GATE 6: full suite green, all old entry points reachable.
- **Advanced view (D17)**: "**Visão avançada da viagem**" in Settings surfaces the raw backend (funds + scope + links + envelopes + wallets with balances) for the curious and deep-links to the existing `/funds` and `/wallets` editors — no duplicated logic (GATE 6, v0.81.0).
- **Reconciliation**: **DEC-007** (cross-phase shared pool) → demoted to advanced; the link primitive stays in the backend. **DEC-089** (per-phase fund) → its direction became canonical. **DEC-153** (phase-cycle leftover) → mechanics intact, now framed as the trecho's own pool flowing into the next.
- **Rationale**: one simple, canonical mental model with all power preserved in the backend; ends the era ambiguity that caused the original confusion.

### DEC-220 — Pote unificado (global pool with optional date + goal) + D8 Home visibility + "Potes e planejados" section (Package #1, v0.78.0)
- **Date**: 2026-06-18
- **Status**: APPROVED & SHIPPED (GATE 3, v0.78.0)
- **Decision (D7/D8/D9/D15)**: a **Pote** is one concept — a `global`-scope `BudgetPool` with **optional** `dateStart`/`dateEnd` and an **optional** `goalCents` (Dexie v10 backfills to null; pre-existing pools/trecho pools stay valid). **(D8)** a dated Pote/Evento surfaces on the **Home** only when its owner trecho is active **OR** inside the **D-7** window of its date — never in a trecho that isn't its owner — and is **always** reachable in the dedicated section (pure `selectVisiblePots`). **(D9)** a "**Potes e planejados**" section in the Viagem hub (`TripHubPage`) lists every pote/event/planned-purchase always. **(D15)** creation uses guided **example chips** + a "why" microcopy.
- **Rationale**: collapses the old "pot vs reserve vs envelope" jargon into one understandable object; D8 keeps the Home clean while never hiding money.

### DEC-221 — Evento with funding (3 ways) + single planning door + first-class event (Package #1, v0.79.0)
- **Date**: 2026-06-18
- **Status**: APPROVED & SHIPPED (GATE 4, v0.79.0)
- **Decision (D6/D5/D15)**: planning a future expense is **one guided door** ("Planejar um gasto") answering **2 questions** — *(1) does it happen on a date?* (yes → Evento · no → Compra/Pote) and *(2) where does the money come from?* with **3 funding options**: **eat from the trecho** (reserves from the active leg — the default), **create a new Pote** for it (e.g. Tomorrowland €200, born linked to the event), or **use an existing Pote**. A pure `routePlannedExpense` picks the entity; an atomic `createPlannedExpense` orchestrator creates it and wires funding (trecho funding subtracts from free-to-spend; pote funding doesn't). Events are now **first-class** (FAB + Viagem section + D8 Home surfacing via `selectVisibleEvents`), not buried inside phase editing. **(D5)** an over-budget trecho suggests a 1-tap remanage, never blocks (DEC-053).
- **Rationale**: dissolves the "Evento vs Pote" confusion (Tomorrowland is **both** — an event whose money is a pote) into a single flow; the user never picks jargon.

### DEC-222 — Progressive wallet tracking (auto-on with 2+ wallets or Wise import + manual override) (Package #1, v0.80.0)
- **Date**: 2026-06-18
- **Status**: APPROVED & SHIPPED (GATE 5, v0.80.0)
- **Decision (D10/D11, option C)**: the "de onde saiu o dinheiro?" wallet question is **invisible** for a single-source traveler and **lights up automatically** with **2+ active wallets** or a **Wise import** (pure `isWalletTrackingActive`/`countActiveWallets`/`hasWiseImportedTransactions`), **and** a manual 3-state override lives in Settings (`walletTrackingOverride: null|true|false` — auto / always-ask / never-ask; null default, non-indexed, backfilled). When active it applies to **all** spends ("sem carteira" remains chargeable, DEC-051). The wallet picker is gated on QuickAdd / ExpenseDetail / Income / Outing review.
- **Rationale**: zero friction for the common single-wallet case; the capability reveals itself exactly when it becomes useful, with an escape hatch either way.

### DEC-223 — Sequential phases: anti-overlap validation + boundary day belongs to the starting trecho (Package #1, v0.77.0)
- **Date**: 2026-06-18
- **Status**: APPROVED & SHIPPED (GATE 2, v0.77.0)
- **Decision (D12/D13)**: trechos are **always sequential** — creation/edit **validates and prevents overlap**. **(D13, option A)** a boundary day belongs to the trecho that **starts** that day (Eurotrip takes 15/07), always editable afterward.
- **Rationale**: removes the ambiguity of overlapping legs that fragments the budget and the dashboard; a deterministic boundary rule keeps day-counts and per-day allowances honest.

### DEC-224 — Trip total = sum of trechos (+ pots counted separately), warns on overflow, never blocks (Package #1, v0.77.0)
- **Date**: 2026-06-18
- **Status**: APPROVED & SHIPPED (GATE 2, v0.77.0)
- **Decision (D14, option A)**: the **trip total = the sum of its trechos** (Burgos 628 + Eurotrip 678 + Volta 131 = 1.437 €), with **pots set aside summed separately** (+200 €), always visible; exceeding it **warns/suggests**, never blocks (DEC-053). A declared trip *ceiling* (master §10.2 option B) is documented backlog, **not** in this package.
- **Rationale**: a single, always-true total that composes from the parts the user actually edits; honesty over hard limits.

### DEC-225 — Nested sub-trecho = V2 (radar; `sub_destination` is the seed) (Package #1 scope boundary)
- **Date**: 2026-06-18
- **Status**: APPROVED as **V2 / radar** — explicitly **NOT** in the 6 gates (D18).
- **Decision (D18)**: a **sub-trecho** (a city *inside* a trecho, e.g. Eurotrip → Amsterdam) is deferred to V2. The backend seed already exists — `PlannedOccurrence(kind:'sub_destination')` (DEC-072) with date-range spend tracking. Direction when promoted: a period nested in the parent trecho (dates contained), optional own rhythm/peak/activities, **no own budget by default** (spends from the parent, just tracks "how much here"), never overlaps the parent's time axis (coherent with D12).
- **Rationale**: real value, but adds a nesting layer that only pays off once Trecho+Pote+Evento has settled; promoting it early risks reintroducing the complexity this reform removed. Trigger to revisit: concrete demand (e.g. Julio running the Eurotrip).

### DEC-226 — Capture progressive disclosure: FAB thumb reorder + expanders, Quick Add "Detalhes" (Package #2, v0.82.0)
- **Date**: 2026-06-18
- **Status**: APPROVED & SHIPPED (Package #2, v0.82.0)
- **Source**: `brain/documents/ux-clarity-audit-2026-06-17.md` §3 (P0) + §4.3 (P1). First package out of the UX-clarity audit; does **not** touch Package #1.
- **Decision (FAB, §3.3/§3.4 — Julio's explicit call "manter as 9, só reorganizar"):** keep **all 9 actions** and the visual language (orange hero, indigo "smart" scan card, tonal chips, spring). Reorder for the thumb — the **heroes ("Registrar gasto", "Escanear nota") sit at the BASE** of the sheet (closest to the "+"); capture chips ("Iniciar saída", "Registrar mercado") above; and the rarer entries collapse behind two **expanders**: **"Outros registros…"** (Transferência/Saque/Receita) and **"Planejar"** (Planejar compra/Simular). Collapsed at rest → short sheet; nothing removed (ÂNCORA 9); simple mode still hides the advanced ones.
- **Decision (Quick Add, §4.3 / G2):** progressive disclosure — **visible by default: valor + categoria + descrição**; **date, local, fundo, carteira, anexos collapse under a "Detalhes" toggle**. The **fund picker is hidden when there's nothing to choose** (0 → empty-state prompt stays visible; 1 → auto-selected, shown read-only inside Detalhes; >1 → picker inside Detalhes, and a *required* multi-fund choice forces the block open). A subtle dot marks a customized-but-collapsed Detalhes. "Quem pagou?/dividir" stays outside Detalhes (only appears with 2+ participants). Goal: a typical expense in ~3 taps.
- **Anti-regression**: all 9 FAB actions remain reachable; transfers/withdrawals keep their full (non-collapsed) wallet flow; wallet question stays progressive (DEC-222); split/anomaly/zero-budget/round-trip/photos/voice all preserved. New permanent E2E `e2e/capture-disclosure.spec.ts`; `wallet-tracking.spec.ts` updated to open Detalhes.
- **Rationale**: the audit's dominant risk is conceptual overload + bad thumb ergonomics, not missing capability — reorder + disclose, don't prune.

### DEC-227 — Copiloto prioritized into four collapsible theme groups (Package #3, v0.83.0)
- **Date**: 2026-06-18
- **Status**: APPROVED & SHIPPED (Package #3 · G7, v0.83.0)
- **Source**: `brain/documents/ux-clarity-audit-2026-06-17.md` §2 (G3) + §4.6 (P1 "priorizar 3–5 seções-chave + ver mais" / P2 "agrupar por tema: Agora / Para onde vai / Padrões / Pessoas colapsável"). Second package out of the UX-clarity audit; does **not** touch Package #1 or #2.
- **Decision (§4.6):** the Copiloto's ~18 self-censoring reads (the "parede de cards", G3) are now organized into **four collapsible theme groups**: **"Agora"** (verdict · yesterday recap · honest friend · whole-trip anchor · discipline streak), **"Para onde vai"** (projection · course-correction trend · runway · phase pace · vs previous phase), **"Padrões"** (where it came from · month map · weekday · peak hour · outing efficiency), **"Pessoas"** (social × solo · payment mix · settlements). The **first non-empty group opens by default**; the rest are one tap away, each header showing a **count badge** of its non-empty reads. An **empty group never renders** (each group is gated by a per-theme count derived from each section's own render guard, so a head never shows with no body). The always-on tools grid (Impacto/Simular/Resgate/Guia) stays in the footer.
- **Anti-regression**: **nothing removed** (ÂNCORA 9) — all reads keep their exact JSX, render guards and i18n; only their containers changed. Each section still self-censors on no data. New permanent E2E `e2e/copilot-groups.spec.ts` (first group open, others collapse content, every group collapsible, tools footer survives). 1380 unit tests + full E2E green; Playwright visual QA (Pixel 5) on demo data confirmed the default (Agora open, 3 collapsed with counts) + fully-expanded + collapsed-Agora states.
- **Rationale**: the reads were individually useful but, with data, became a flat wall where the user didn't know where to look first; grouping by the question each read answers gives a scannable hierarchy without pruning any intelligence. The "ver mais / fixar favoritas" (P3) is deferred — the collapsible groups already satisfy the P1/P2 intent.

### DEC-228 — "Perfis" → "Atividades" (UI rename); Trecho/Pote funds-vocab migration scoped to a dedicated pass (Package #3 · G8, v0.84.0)
- **Date**: 2026-06-18
- **Status**: APPROVED & SHIPPED (Package #3 · G8, v0.84.0)
- **Source**: `brain/documents/ux-clarity-audit-2026-06-17.md` §4.16 + §5 (P2 "Renomear 'Perfis'→'Categorias/Atividades'") + §2 (G1 "estender vocabulário a todo o app"). Julio's pick of the two audit options = **"Atividades"** (not "Categorias", which would collide with the expense-category field/`categories.*` namespace).
- **Decision (P2 — rename, SHIPPED):** the activity-profile feature's **user-facing label** is renamed **"Perfis"/"Perfil" → "Atividades"/"Atividade"** (pt-BR), **"Profiles"/"Profile" → "Activities"/"Activity"** (en), **"Perfiles"/"Perfil" → "Actividades"/"Actividad"** (es). **UI strings only** — every i18n KEY (`profiles.*`, `more.profiles`, `planner.profiles`, …), the `{{profile}}` interpolation variable (the activity's name), and all code identifiers (`ActivityProfile`, `activityProfileId`, `/profiles` route, repositories) are **unchanged**. Covers the page title, add/empty/updated/remove/in-use copy, the TripHub "Estrutura" tile, the Planner section, the Settings "Atividades e típicos" entry, the template summaries, the mode-complete description and the outing/onboarding hints, across all three locales (grammar/gender adjusted, e.g. "atividade … removida/desabilitada").
- **Decision (P1 — Trecho/Pote funds vocab, SCOPED/DEFERRED):** a **blanket** rename of "Fundo" → Trecho/Pote across the app is **NOT** done here. The happy path already speaks Trecho/Pote (Package #1: dashboard active-phase, TripHub "Potes e planejados", `AddTrechoSheet`/`PlanExpenseSheet`), and the residual "Fundo" jargon is **intentionally confined to the advanced `/funds` editor** (reached via Settings → "Visão avançada da viagem", DEC-219/D17) and the QuickAdd fund picker. A pool can be a **trecho OR a pote**, so a single generic relabel is semantically ambiguous; doing it half-way (e.g. only the Hub section) would make the vocabulary *inconsistent* with the editor/dashboard cards, which is worse than the status quo. Per the Package #1 master principle ("nunca forçado", cf. DEC-225), the full Fundo→Trecho/Pote migration + "esconder envelope/escopo/piso" is deferred to a **dedicated, coherent pass** rather than forced as a risky partial rename.
- **Anti-regression**: nothing removed (ÂNCORA 9) — the activity-profile capability (typical values, per-phase frequency, presets, planner integration, outing start) is untouched; only the word changed. 1380 unit tests + full E2E green (`budget-model-golden.spec.ts` updated to assert the new "Atividades" heading); Playwright visual QA (Pixel 5) confirmed `/profiles` ("Atividades" + "Adicionar atividade") and the TripHub "Estrutura" tile.
- **Rationale**: "Perfis" is a technical noun the audit flagged as opaque to first-time users; "Atividades" names what they are (the activity types the app learns) without colliding with expense categories. The funds-vocab migration is real but coupled and ambiguous, so it gets its own pass instead of a regression-prone partial rename.

### DEC-229 — Expense-list filter chips grouped/labelled behind a collapsible "Filtros"; "Saídas" tab explainer (Package #4 · GATE 9, v0.85.0)
- **Date**: 2026-06-18
- **Status**: APPROVED & SHIPPED (Package #4 · GATE 9, v0.85.0)
- **Source**: `brain/documents/ux-clarity-audit-2026-06-17.md` §4.4 (P2 "agrupar/rotular chips por tipo e permitir recolher"; P2 "microcopy do que é 'Saída' na aba"; P3 edge-swipe discoverability). First gate of **Package #4** (the audit's remaining P2/P3 polish). Does NOT alter Packages #1–#3.
- **Decision (M9.1 — grouped/collapsible filter chips):** the Expenses list's filter chips — which mixed three natures (category, place, the active profile/no-wallet flag) in a single unlabelled scroll row on an already-dense header — now live behind a single **"Filtros (N)"** toggle (collapsed by default). Collapsed, the header shows only the **"Todos"** clear-all chip + the toggle; when a scope is active a compact, removable summary row of the active chips stays visible (so what's filtering is never hidden) and the toggle carries a count badge. Expanded, the chips are split into labelled, horizontally-scrollable groups — **"Categorias"**, **"Lugares"**, **"Outros"** (the profile/no-wallet flags). Driven by a pure `expense-filters.ts` (`countActiveFilters`/`hasActiveFilter`).
- **Decision (M9.2 — "Saídas" tab explainer):** the Outings tab now carries a one-line explainer ("uma saída agrupa os gastos de um rolê — uma noite, um passeio — numa linha só") in pt-BR/en/es, naming the previously-unannounced model.
- **Scope (M9.3 — edge-swipe discoverability, P3, DEFERRED):** making the at-the-edge tab-handoff gesture discoverable needs a one-time coachmark pattern that doesn't exist yet; adding persistent hint UI would re-clutter the header the gate is trying to thin. Deferred (noted, not shipped) — consistent with the "clarity without regression" mandate.
- **Anti-regression**: nothing removed (ÂNCORA 9) — every scope filter (category, place, profile, no-wallet) is still reachable, one tap away; the rollup/income/search/multi-select behaviour is untouched. New permanent `e2e/expense-list-filters.spec.ts`; +4 unit tests (`expense-filters.test.ts`). The header is strictly shorter at rest.
- **Rationale**: the audit's dominant risk is "sobrecarga conceitual e descoberta", not missing function; grouping + labelling + collapsing the chips removes the flat-mix confusion and shortens the header without taking any capability away, and the explainer turns an unannounced tab into a self-describing one.

### DEC-230 — Planner guided microcopy ("margem/alocado/classificação/presets"); advanced-gating confirmed pre-existing (Package #4 · GATE 10, v0.86.0)
- **Date**: 2026-06-18
- **Status**: APPROVED & SHIPPED (Package #4 · GATE 10, v0.86.0)
- **Source**: `brain/documents/ux-clarity-audit-2026-06-17.md` §4.9 (P2 "tratar Planner como avançado + modo guiado leve"; P2 "microcopy dos termos margem/alocação"). Second gate of Package #4.
- **Decision (M10 — guided microcopy):** the Planner — the app's most conceptual surface ("fundo da piscina") — gains plain-language guidance without changing any behaviour: (1) a one-line **intro** under the header naming what the page does; (2) a one-line **summary hint** under the budget card defining the two key numbers ("margem livre = o que sobra do fundo desta fase; alocado = quanto o seu plano soma"); (3) a **presets hint** above the preset row ("pontos de partida rápidos — depois ajuste item a item"); (4) a **classification hint** in the category menu explaining what essential/planned/optional actually controls (cut order). pt-BR/en/es.
- **Decision (advanced-gating — CONFIRMED, no change):** the audit's "esconder o Planner no modo simples por padrão" is **already implemented** — `/planner` is wrapped in `<ModeGuard>` (M20) so simple mode shows the "recurso avançado / abrir mesmo assim" interstitial, and the Planner is flagged `advanced` in the nav/FAB. The route is intentionally **not** removed (ÂNCORA 9) and the entry points are intentionally **not** hidden (the guard's "open anyway" is the soft, reversible treatment; hiding entries would hurt discoverability for a simple-mode user who wants to plan). So GATE 10 ships the microcopy and confirms the gating rather than re-implementing it.
- **Decision (single planning door — DONE in Package #1):** the audit's "(P1) integrar à porta única de planejamento" was delivered by Package #1 GATE 4 (DEC-221, "Planejar um gasto"). Noted, no GATE 10 work.
- **Anti-regression**: pure additive microcopy — zero logic/behaviour change; the scenario math, persistence, recommendation engine, presets, lock and per-phase classification are all untouched. New permanent assertion in `e2e/planner.spec.ts`; 1384 unit tests unchanged (no new logic to test — trivial "key exists" assertions are intentionally avoided per the test guidelines).
- **Rationale**: the Planner's capability is excellent but its vocabulary (margem/alocação/prioridade/preset) is opaque; naming each term in one plain line is the "modo guiado leve" the audit asked for, at zero regression risk, while the heavier "esconder no simples" goal was already satisfied by the existing ModeGuard.

### DEC-231 — Single shared "how splitting works" explainer across the split surfaces; flow/cost microcopy on the expense detail (Package #4 · GATE 11, v0.87.0)
- **Date**: 2026-06-18
- **Status**: APPROVED & SHIPPED (Package #4 · GATE 11, v0.87.0)
- **Source**: `brain/documents/ux-clarity-audit-2026-06-17.md` G9 + §4.15 (P2 "um explicador único 'como funciona a divisão'"; P3 "consistência de microcopy com QuickAdd/Recibo/Wise"), §4.13 (P3 "alinhar UI de divisão"), §4.5 (P3 "microcopy/explicador de 1 linha nos rótulos 'Fluxo financeiro' × 'Custo pessoal' quando há divisão"). Third gate of Package #4.
- **Decision (M11 — one explainer, one source of copy):** the split model surfaces in four places (QuickAdd, Receipt, Shared, Wise) with drifting wording — the audit's G9 "divisão repetida em 4 telas". A single reusable component **`features/shared/SplitExplainer.tsx`** now owns that copy: a collapsed-by-default "**Como funciona a divisão**" disclosure that expands to **3 numbered steps** (who paid → your share becomes a balance → settle later with the fewest transfers). It reads from a **single new `split.*` i18n namespace** (pt-BR/en/es) so the explanation is *defined once* and reads identically everywhere it's shown.
- **Decision (placement):** the explainer is mounted on the three **first-class** split surfaces — **QuickAdd** (top of the "Quem pagou?" block), **Receipt** (top of the "dividir com" block), **Shared** (under the page header). Collapsed at rest → no added clutter for the returning user; one tap for the first-timer. 
- **Decision (M11b — flow/cost microcopy, §4.5):** the expense detail's two technical labels gain one plain line below them when the expense is shared — **"Fluxo financeiro = o que saiu da sua carteira. Custo pessoal = só a sua parte."** (same `split.*` namespace).
- **Scope (Wise — DEFERRED, P3):** the Wise importer's split lives inside the per-transfer **allocation** sheet (the app's most complex, power-user flow; the audit marks its split-consistency as **P3** and "manter como fluxo avançado"). Surfacing the explainer there means threading it into the allocation BottomSheet — deeper, riskier, and against the "keep advanced flows lean" stance. Noted, not shipped — the single source of copy is in place for when a clean anchor is added.
- **Anti-regression**: pure additive UI — zero change to the splitting domain (`resolvePayerExpense`, `calculateDebts`, shares, settlements all untouched); the explainer holds only local open/close state. New permanent `e2e/split-explainer.spec.ts` (QuickAdd collapsed→expanded + Shared shows the same component); 1384 unit tests unchanged (presentational component, no logic to unit-test — trivial render assertions are intentionally avoided per the test guidelines).
- **Rationale**: G9's problem is *inconsistency + silence*, not a missing capability; one component with one copy source makes the split model self-describing and identical across screens, and the §4.5 line names the two accounting terms without changing the (correct) labels — both at zero behaviour risk.

### DEC-232 — Outing opener microcopy + contextual SOS on the "amigo sincero" card; SOS "is a simulation" confirmed already present (Package #4 · GATE 12, v0.88.0)
- **Date**: 2026-06-18
- **Status**: APPROVED & SHIPPED (Package #4 · GATE 12, v0.88.0)
- **Source**: `brain/documents/ux-clarity-audit-2026-06-17.md` §4.12 (P2 "microcopy de abertura da Saída") + §4.8 (P2 "oferecer SOS contextualmente quando um trecho fura feio"; P3 "deixar claro que é simulação"). Fourth gate of Package #4.
- **Decision (M12a — Saída opener microcopy, §4.12):** the Outing start screen — whose "saída" concept was an unannounced model — now opens with one plain line naming it: **"Uma saída é um rolê com teto — uma noite, um passeio. Registre cada rodada em 1 toque e acompanhe quanto ainda cabe."** (pt-BR/en/es), above the existing type picker. Nothing else on the start screen changes.
- **Decision (M12b — contextual SOS, §4.8):** rescue mode was only reachable from the Simulator/Copiloto-tools/Guide. The shared **`AmigoSinceroCard`** (Home + Copiloto) now renders a **"Plano de resgate"** CTA → `/rescue`, but **only in the dire `alert` tone** — i.e. over plan/pace AND the pace projects into the protected reserve ("o trecho fura feio"). In calmer tones (positive/steady/caution/neutral) the CTA stays hidden, so it surfaces exactly when it's useful and adds no noise otherwise. Wired via a new optional `onRescue` prop on both render sites.
- **Decision (SOS "is a simulation", §4.8 P3 — CONFIRMED, no change):** the Rescue page already states this twice — `rescue.intro` ("…nada é gravado") and `rescue.note` ("Nada é gravado — o modo resgate é uma calculadora."). The P3 ask is already satisfied; GATE 12 keeps it and adds the contextual door, rather than restating it.
- **Decision ("alinhar narrativa com remanejar de outro trecho", §4.8 P2 — N/A here):** the "remanejar trecho" relationship is a Package #1 (D5) concept; the contextual SOS complements it (SOS = simulate a recovery within the phase; remanejar = move budget between trechos) without overlap. No copy change needed in GATE 12.
- **Anti-regression**: pure additive — the rescue engine (`buildRescuePlan`), the honest-friend math (`buildHonestFriendV2`/`getHonestFriendTone`) and the outing flow are untouched; the SOS CTA is a presentational conditional reusing the already-unit-tested `alert` tone gate. New permanent `e2e/outing-explainer.spec.ts` + **component test** `amigo-sincero-card.test.tsx` (+3 unit tests: alert→CTA fires onRescue; caution→hidden; no-handler→hidden) → 1387 unit tests.
- **Rationale**: §4.12 turns an unannounced model into a self-describing screen at zero risk; §4.8's contextual SOS puts the recovery tool one tap away precisely when the reserve is at risk — the moment the user most needs it — gated by the already-tested dire-tone signal so it never nags in calmer states.

### DEC-233 — Home insight cap (top N + "ver mais") + "why shown" confirmed present on the insight detail (Package #4 · GATE 13, v0.89.0)
- **Date**: 2026-06-18
- **Status**: APPROVED & SHIPPED (Package #4 · GATE 13, v0.89.0)
- **Source**: `brain/documents/ux-clarity-audit-2026-06-17.md` §4.2 (P2 "teto/ordem de no máx. N avisos por vez"; P3 "por que esse card apareceu?" nos contextuais). Fifth gate of Package #4. The audit rates the Home **4.5/5 — "a área mais saudável do app"**, so GATE 13 is deliberately a light touch.
- **Decision (M13a — cap/order, §4.2 P2):** the complete-mode Home insight carousel auto-accumulated up to 12 analytical insights (a long dot strip + endless auto-rotation). A new pure helper **`features/dashboard/home-insights.ts` → `capHomeInsights(insights, showAll, max=4)`** caps the carousel to the **top 4** insights at rest and reports the overflow; a **"Ver mais N"** control reveals the rest **in place** (nothing is dropped — ÂNCORA 9). The insights arrive **priority-sorted** from `buildDashboardInsights` (warnings first), so the visible slice is always the most important — a cap, not a filter. Auto-rotation + the dot pager now key off the *visible* slice.
- **Decision (scope — only the carousel needs a forced cap):** the other "avisos contextuais" the audit lists (storage, phase leftover, value suggestion, priors) are **user-configurable cards** (`DashboardConfigPage`: reorder/hide/pin/pair) or **single gated banners** (the storage-eviction banner; DEC-176 already moved the routine backup reminder off the Home). The user already owns that vertical cap, and forcing another one would override their choice — so GATE 13 caps **only** the one surface that auto-stacks without user control: the insight carousel. **Simple mode** is already capped to a single warning insight (`SimpleHome`, ÂNCORA 14) — unchanged.
- **Decision (M13b — "why shown", §4.2 P3 — CONFIRMED, no new affordance):** tapping any analytical insight already opens the `InsightDetail` sheet titled **"Como cheguei nisso"** with a full per-kind breakdown **plus** an explainer paragraph (`detail_projection_explainer`, `detail_rhythm_explainer`, `detail_danger_explainer`, `detail_streak_explainer`). The P3 "por que apareceu?" ask is already satisfied for the insights; GATE 13 keeps it rather than restating it (same confirmed-present pattern as DEC-232's SOS-simulation copy).
- **Anti-regression**: pure additive — `buildDashboardInsights` (ordering + `INSIGHT_SAFETY_CAP`) and the insight detail sheets are untouched; the cap is a presentational slice driven by local `showAllInsights` state. The carousel auto-rotation/index-clamp now read the *visible* length, so the cap can never desync the pager. New deterministic unit suite `home-insights.test.ts` (6 tests: at-cap pass-through, over-cap top-N + overflow, order preserved, expand reveals all, custom cap, empty-safe) → **1393 unit tests**; new permanent `e2e/home-insights-cap.spec.ts` (reveals overflow + home stays healthy). Demo data produces ≤4 insights, so Playwright visual QA (393×851) confirmed the carousel renders calm and correct with the cap in place (overflow path is proven by the unit suite).
- **Rationale**: §4.2's "wall of warnings" risk is real only on the one surface that grows without user input; capping it to the 4 most important (already priority-sorted) with a one-tap "ver mais" removes the wall without removing anything, and the "why shown" question was already answered by the existing "Como cheguei nisso" detail — so the healthiest screen in the app gets calmer at zero behaviour risk.

### DEC-234 — P3 clarity polish: onboarding mode recommendation + "reserva protegida" example, Trip-Edit term softening, /trip role microcopy + planned-income nuance, and a dedicated "Conexões e compartilhamento" Settings group (Package #4 · GATE 14 — FINAL, v0.90.0)
- **Date**: 2026-06-18
- **Status**: APPROVED & SHIPPED (Package #4 · GATE 14, v0.90.0). **Closes Package #4 and the entire UX-clarity audit backlog.**
- **Source**: `brain/documents/ux-clarity-audit-2026-06-17.md` §4.1 (P3 onboarding), §4.11 (P3 Trip-Edit term softening + P3 "renda planejada" + P2/G7 `/viagem`×`/trip` role), §4.17 (P3 break "Conexões/Compartilhamento" out of "Dados e segurança" + house "Visão avançada"). The remaining P3 polish — the audit rates these screens 4–4.5/5, so the gate is deliberately microcopy + one low-risk Settings reorg.
- **Decision (M14a — onboarding, §4.1):** the mode-choice step (a bifurcation a first-timer can't reason about) now badges **"Começar simples"** as **"Recomendado"** (the safe default), and the budget step names the **"reserva protegida"** jargon with a money example ("um dinheiro que fica intocável até o fim — ex.: 150 guardados pra um imprevisto; deixe 0…"). The **"dá pra mudar depois"** ask was already satisfied (`mode_subtitle`: "Dá pra trocar quando quiser, em Ajustes."). The "(P3) colapsar template/tipo sob Mais opções" is **DEFERRED** — collapsing the quick-start screen risks the genuinely-fast path the audit praised; it's a structural change, not microcopy, and low value vs. risk.
- **Decision (M14b — Trip-Edit term softening, §4.11):** the editor's "sala de máquinas" jargon gains one plain line each — **"Ritmo da fase"** ("quão corrido é esse trecho — ajusta o gasto sugerido por dia"), **"Dias de pico"** ("os dias em que você costuma gastar mais — ex.: sexta e sábado"), and the **evento × sub-destino** picker ("evento = um rolê pontual; sub-destino = uma parada dentro da fase"). pt-BR/en/es.
- **Decision (M14c — `/trip` role + planned-income, §4.11/G7):** the two trip screens "compete" (G7); rather than the still-open full merge (§6 Q3), the **Overview (`/trip`)** now declares its role in one line ("um resumo só de leitura: total, fases e cartão de compartilhar; para planejar ou editar, use a Viagem") — complementing the Hub's existing "Seu plano e a estrutura da viagem" subtitle, so each screen's purpose is explicit. The Phase **Preview** surfaces the subtle "renda planejada só alimenta a projeção" inline ("conta só nesta projeção de futuro — não mexe no seu dinheiro real"), previously only visible after opening the editor sheet.
- **Decision (M14d — Settings "Conexões" split, §4.17):** "Dados e segurança" was too broad. A **new top-level Settings category "Conexões e compartilhamento"** (`connections`, icon `hub`) now owns the three network/sharing surfaces — **Conexões** (pairing/links → `/shared`), **Caixa postal** (mailbox/worker) and **Ler notas com IA** (cloud receipt OCR) — leaving **"Backup e segurança"** a coherent core (backup/export, backup reminder, app-lock/biometric, restore points, reset). The multilingual search keywords were rebalanced across the two groups so every section is still one search away; nothing is removed (ÂNCORA 9). The **"abrigar Visão avançada da viagem"** ask is **CONFIRMED already done** (Package #1 GATE 6 → `AdvancedTripView` in the "Dinheiro e metas" group).
- **Anti-regression**: pure-additive microcopy + a presentational Settings re-grouping (the moved sections keep their exact logic — mailbox toggle, OCR toggle, `/shared` link — only their containing `CollapsibleGroup id` changed). No code deep-links to `/settings/c/data_security` expecting the moved sections (verified); the moved sections stay reachable via `/settings/c/connections` and via search. 1393 unit tests unchanged (no domain logic; trivial render/key assertions intentionally avoided per the test guidelines). New permanent `e2e/settings-connections.spec.ts` (new category owns the sharing sections; data/security keeps its core and drops them; search still surfaces a moved section) + `e2e/onboarding.spec.ts` extended (recommended-mode badge). Playwright visual QA (393×851): onboarding, Trip-Edit (rhythm/peak hints), Overview (role line), and the Settings split (new "Conexões e compartilhamento" page with the 3 sections; "Backup e segurança" reduced to its core) — all correct.
- **Rationale**: every item here is a self-describing line that turns an unannounced model or a piece of jargon into something a first-timer reads and understands, plus the one structural fix the audit named (a legible Settings split) done at low risk — closing the UX-clarity backlog without changing a single behaviour.

### DEC-235 — Active-outing declutter (no inline photos, no payer-hint line) + photo source chooser (camera/gallery) + undo-toast (chip-only undo + swipe-dismiss) + Home insights→Copiloto bar (Device Test 2026-06-18 · GATE 15, v0.91.0)
- **Date**: 2026-06-18
- **Status**: APPROVED & SHIPPED (GATE 15, v0.91.0).
- **Source**: Julio device test 2026-06-18 — four UI quick wins. The larger asks from the same session (the Amigo-Sincero redesign, the Home carousel order, the FAB rebalance, the daily-detail explainers) are split into their own gates (DEC-236+).
- **Decision (active outing)**: the active-session screen must not scroll. Removed the inline photo `AttachmentSection` (DEC-206's mid-outing attach) — photos are added on the OUTING REVIEW (and history) instead, where a receipt/ticket naturally belongs — and removed the standalone "próxima rodada: vez de {name}?" payer-rotation hint (E3/M9), which consumed a full row. Kept the next-drink impact warning (Julio: "super importante"), the 4 most-recent expenses and the pace projection. The `suggestNextPayer` domain fn stays (unit-tested) — only its always-on render was dropped.
- **Decision (photo source)**: every attach entry now asks the source — "Tirar foto agora" opens the camera (`capture="environment"`) or "Escolher da galeria" the picker — so a traveler can shoot the receipt in the moment. The hidden-input click stays inside the tap gesture so the native CAMERA permission holds; the old `compact` prop (only used by the now-removed outing slot) was deleted.
- **Decision (toast)**: a toast's action (e.g. Desfazer) fires ONLY from its action chip — a stray tap on the toast body no longer undoes — and the toast can be SWIPED sideways to clear it without firing the action; the tap-anywhere body is retained ONLY for chip-less action prompts (the persistent "tap to update" toast).
- **Decision (Home insights→Copiloto)**: instead of the "ver mais N" in-place expander, the insight carousel keeps the top-4 cap and gains a thin "Veja mais no copiloto" bar linking to `/copiloto`, turning the cap into a doorway to the fuller analytical reads (nothing hidden; the per-insight "Como cheguei nisso" detail is untouched).
- **Anti-regression**: 1396 unit tests (+3 toast) green; `outing-flow` E2E asserts the photo block is absent live + present on review; `home-insights-cap` asserts the bar routes to `/copiloto`. Backend/schema untouched; web/OTA only; APK byte-identical at the verified 0.56.0 shell.
- **Rationale**: each fix removes friction Julio hit on-device — a scrolling outing screen, a gallery-only photo flow, an over-eager undo, and a Home that capped insights without telling you where the rest live.

### DEC-236 — Amigo Sincero deep redesign: phase-truth dominance (`over_budget`), correct culprit (biggest spend), present-tense reserve copy, recovery-mode rescue (Device Test 2026-06-18 · GATE 16, v0.92.0)
- **Date**: 2026-06-18
- **Status**: APPROVED & SHIPPED (GATE 16, v0.92.0).
- **Source**: Julio device test 2026-06-18 — the Amigo Sincero card was "complicado quando falta dinheiro". Reproduced from his backup (`trippilot-backup-2026-06-18-0928.json`): a €600 "Outros" drained the Burgos phase; the card still said "cabem só 1 dos 2 dentro do plano" (a lie), pointed at a €3 bar as the culprit, projected a reserve date that was already today, and the rescue plan offered a "save €X" calculator that couldn't fit anything.
- **Root cause (the lie)**: the broke check used the **pool** free-to-spend, which was still **positive (+€127.71)** because the protected reserve (€150) hadn't been touched — but the **TRUE free** (the hero "livre para usar" = pool free − the scenario plan still reserved) was **negative (−€22.54 / €0 clamped)**. The card read the pool number, so it ran the category-plan path ("1 of 2 fit") instead of telling the user the phase was out of spendable money.
- **Decision (phase truth first)**: a new dominant `over_budget` kind pre-empts every category read when the **TRUE free ≤ 0**. Copy is precise to the case: (a) **reserve dip** when pool free < 0 ("já usou €X da reserva protegida"), (b) **plan-committed** when the reserve is intact but the plan needs more than what's left ("o que resta está reservado pro seu plano — faltam €X"), (c) **edge** at exactly 0. Tone is always `alert`. The signed pool free is exposed once at the source as `FreeToSpendResult.freeToSpendRawCents` (additive, bit-identical for existing consumers); the true-free signed value is `poolFreeRaw − planReserved`, computed identically in the dashboard hook, the impact page and the rescue page so the three never disagree.
- **Decision (non-profile blindness)**: the triggering spend is no longer filtered to activity-profile expenses, so a plain "Outros" is finally seen. The card's `no_plan` fallback dropped the profile label and now states the honest impact % of the phase free margin. The **ImpactDetailPage culprit** is now the **biggest expense of the phase** (any category) — "Maior gasto desta fase" — instead of the most-recent profiled spend, so it names the real cause (€600), not a €3 beer.
- **Decision (reserve-date copy)**: when the reserve is already in use (projected date ≤ today, or broke), the impact page says present-tense "A reserva protegida já está sendo usada agora" instead of projecting a date that has passed.
- **Decision (rescue → recovery)**: when the TRUE free ≤ 0 the Rescue page drops the "save €X" calculator (every target was infeasible — Julio's "guardar 20 não cabe") and flips to a **recovery plan**: a red truth banner (reserve/plan/edge, same three cases) plus "O que dá pra cortar" — the remaining planned occasions sorted by value with their savings and a "cortando tudo, você recupera €Y" total. Nothing is persisted (still a calculator).
- **Anti-regression**: 1403 unit tests green (+ over_budget reserve/plan/edge cases incl. Julio's exact +€127/−€22.54 numbers; the card's broke message + recovery CTA; `FreeToSpendResult.freeToSpendRawCents` added to the two fixture literals). The healthy reads (`on_plan`/`over_pace`/`over_plan`/`no_plan`) are gated behind `over_budget` so they're untouched when free > 0. Playwright visual QA imported Julio's real backup and confirmed all three screens (Home card, Impact culprit + banner, Rescue recovery). Backend/schema untouched; web/OTA only; APK byte-identical at the verified 0.56.0 shell.
- **Rationale**: the whole promise of "amigo sincero" is brutal honesty — saying "fits within your plan" when there is €0 to spend destroys that trust. Measuring "broke" by the number the user actually sees (the hero true free), naming the real culprit, and turning the dead-end rescue into a concrete recovery plan makes the feature finally tell the truth.

---

### DEC-237 — Home occasion carousel opens on the planned metas: keep planned-first ordering + drop scroll-snap to stop the browser's involuntary re-snap (Device Test 2026-06-18 · GATE 17, v0.93.0)
- **Date**: 2026-06-18
- **Status**: APPROVED & SHIPPED (GATE 17, v0.93.0).
- **Source**: Julio device test 2026-06-18 — "os cards em carrossel na página de início… ele está entrando já e o primeiro card que ele está mostrando é o outros gastos (42)… se eu quiser ver o planejamento tenho que rolar". He explicitly asked the **council** to decide whether the carousel should keep opening on the planned metas or on the highest-count activity.
- **Council (inline: User Advocate / Architect / Critic / Strategist)** → **planned-first stays.** The planned metas (bar/restaurante/mercado) are the user's stated intention and carry the app's colour+icon language; the activity-count cards ("Outros 42") are raw history, not goals. The leftmost card is the highest-value glance, so it must be a meta. Spend-desc ordering was rejected as it surfaces noise over intention.
- **Finding**: the ordering was **already** planned-first (`domain/dashboard/occasion-counters.ts` → `buildOccasionCounters`, since v0.31.0; confirmed by git history + a Playwright DOM probe of Julio's backup). The actual defect was the **scroll position**: the carousel was a `scroll-snap-type: x` container and, **when it scrolls into the viewport** (the user swiping the page down), Chromium **re-snaps it to card 3** (scrollLeft 373/497 = the first "Outros" card), so it *looked* like it opened on Outros. Isolation: `snap-mandatory` → 373; `snap-proximity` → 373; `snap-none` → holds at 0 (FINAL 0/0). Not a JS scroll (instrumented `scrollLeft`/`scrollTo`/`scrollIntoView` — none fired).
- **Decision**: keep `buildOccasionCounters` planned-first (locked with a new unit test mirroring Julio's "Outros 42 vs metas" shape), and **drop scroll-snap on this one carousel** (`features/dashboard/DashboardCards.tsx`: `snap-x snap-mandatory` → `snap-none`; remove the now-inert `snap-start snap-always` on the card wrappers). The carousel scrolls freely; the existing dot pager still tracks position via `onScroll`. A cheap mount-time `scrollLeft = 0` pin (ref callback + 1 rAF) guards against device scroll-restoration on back-nav.
- **Trade-off**: forced 3-per-page snapping on THIS carousel is gone (free horizontal scroll instead). This is the only reliable way to stop the browser's involuntary re-snap (both mandatory and proximity re-snap); the dot indicator stays, and a counter row is a natural free-scroll surface. Other carousels (insights) keep their own snap.
- **Anti-regression**: 1404 unit tests green (+1 `occasion-counters.test.ts`). Playwright (Julio's real backup, Pixel 5) confirmed the carousel opens on Bar/Restaurante/Mercado with the first dot active and stays at scrollLeft 0 after the page is scrolled to reveal it. (A scroll-snap fix can't be exercised in jsdom and the demo seeds no occasion carousel, so the unit test locks ordering while the code comment + this DEC lock the no-snap rationale.) Backend/schema untouched; web/OTA only; APK byte-identical at the verified 0.56.0 shell.
- **Alternatives considered**: (a) `snap-proximity` — rejected, still re-snapped to 373; (b) keep snap + an `onScroll` guard that resets scrollLeft to 0 until the user engages — works but flashes the wrong card for ~1 frame when scrolling into view, and is more code; (c) reorder to spend-desc — rejected by the council.

---

### DEC-238 — FAB hierarchy rebalanced: planning tools promoted to visible, "Registrar mercado" demoted into "Outros registros" (Device Test 2026-06-18 · GATE 18, v0.94.0)
- **Date**: 2026-06-18
- **Status**: APPROVED & SHIPPED (GATE 18, v0.94.0).
- **Source**: Julio device test 2026-06-18 — in the FAB, "Planejar" was a collapsed submenu while the visible secondary chips were "Começar saída" + "Registrar mercado". Julio: "registrar mercado não é mais importante que planejar um gasto ou simular compra… é basicamente registrar gasto que vem preenchido com mercado, muito simples pra estar tão para fora; planejar e simular têm muito mais apelo e estão escondidos". He asked the **council** to re-rank.
- **Council (inline: User Advocate / Architect / Critic / Strategist)** → **promote planning, demote mercado.** The visible secondary tier should hold DISTINCT, high-intent actions. "Iniciar saída" (a live-capture session) and the two PLANNING tools are the differentiators; "Registrar mercado" is the orange "Registrar gasto" hero pre-filtered to one category (`/quick-add?cat=market`) — a ~1-tap convenience that duplicates the hero, not a top-tier action. Critic's guards: keep advanced-gating so simple mode stays minimal; avoid a lopsided grid when only one planning chip shows (simple mode); don't bury "Simular compra" with the transfers (Julio ranks it above mercado) → keep it a visible chip. Strategist: surfacing planning one tap from the FAB reinforces "plan, don't just log" — capture still owns the base (two accented heroes).
- **Decision (`components/FAB.tsx`, data-driven via the `group` field)**: `register_market` `capture` → `other` (joins the collapsed "Outros registros" with transfer/withdrawal/income); the `plan` group renders as **visible 2-col chips** (no more "Planejar" expander); "Iniciar saída" renders as a **full-width leader** just above the two heroes. Render order top→bottom (bottom = thumb): "Outros registros" (collapsed) → planning chips → "Iniciar saída" → scan hero → register-expense hero. Plan chips use `grid-cols-1` when a single chip is visible so there's never an empty cell. The only collapsible group left is "Outros registros" (state simplified to one `otherOpen` boolean).
- **i18n**: `fab.group_other_desc` now names mercado in all three locales; the unused `fab.group_plan`/`fab.group_plan_desc` keys were removed (pt-BR/en/es).
- **Anti-regression**: nothing removed (ÂNCORA 9) — all 9 actions present and reachable; simple mode still hides advanced via `visibleInMode`. 1404 unit tests green (FAB is presentational, no domain logic). `e2e/capture-disclosure.spec.ts` updated + green: planning + "Começar saída" visible at rest with no "Planejar" expander; "Registrar mercado" absent until "Outros registros" opens. Playwright visual QA (Pixel 5) confirmed the rebalanced sheet and the 4 demoted entries inside the expander. Backend/schema untouched; web/OTA only; APK byte-identical at the verified 0.56.0 shell.
- **Alternatives considered**: (a) keep "Registrar mercado" as a visible chip but reorder — rejected, the user's point is it's not chip-worthy; (b) make BOTH planning tools full-width rows — taller sheet, rejected for the compact 2-col chips; (c) leave "Simular compra" in a collapsed group with mercado — rejected, the user ranks Simular above mercado in prominence.

---

### DEC-239 — Daily-detail explainers: "free per day" tells where the number comes from (base + peak), "spent per day" breaks the total down by category (Device Test 2026-06-18 · GATE 19, v0.95.0)
- **Date**: 2026-06-18
- **Status**: APPROVED & SHIPPED (GATE 19, v0.95.0).
- **Source**: Julio device test 2026-06-18 — in the hero "De onde vem esse número" sheet → "Por dia nesta fase": (1) tapping a day on **Disponível por dia** only repeated the free amount already printed under the date ("quando clico na data eu quero ver MAIS informações… de onde vem aquele número; num dia menor diga que é o valor padrão = reserva ÷ dias; num sábado de pico explique POR QUE está maior"); (2) tapping a day on **Gastos por dia** only showed the day total ("seria legal já mostrar o que foi gasto: gastei tanto de tal, tanto de tal… resumo por categoria; não os 40 itens — a lista completa já está em Gastos recentes").
- **Council (inline: User Advocate / Architect / Critic / Strategist)** → **explain, don't just restate.** User Advocate: the detail must answer "why is THIS number what it is" without a wall of text — name the base, flag peak days with a concrete regular-day reference, and (for spend) a per-category mini-list. Architect: keep the math in the domain — expose `normalAllowanceCents`/`hasRhythm` on the allowance map (the day already carries `isPeakDay`/`weight`/`allowanceCents`) and add a pure `spentByCategoryOnDate` reused by the heatmap (`HeatmapDay.byCategory`); the UI only renders. Critic: the category split MUST reconcile to the day total (same filter + base-personal-cost rule as `calculateSpentOnDate`); phrase the base as "reserva livre da fase distribuída pelos dias" (truthful under rhythm presets where a relaxed day is *below* reserve÷days, not a flat divide); show the peak line only on actual peak days; cap the list (top 5 + "+N em outras categorias") so a 40-item day never sprawls. Strategist: turns two opaque numbers into a teaching moment — reinforces that the budget is rhythm-aware and that spend is categorized — without adding screens.
- **Decision**:
  - **Domain** — `phases/rhythm.ts`: added `phaseHasRhythm(phase)` + `getBaseDayWeight(phase)` (the non-peak day weight; 1.0 uniform, preset base otherwise) and refactored `getDaySpendingWeight` to reuse them. `phases/allowance-map.ts`: `PhaseAllowanceMap` now carries `normalAllowanceCents` (`baseFreeCents × baseWeight ÷ effectiveDays` — the regular-day reference a peak day is compared against) and `hasRhythm`. `transactions/transactions.ts`: added `spentByCategoryOnDate()` → `DayCategorySpend[]` (same day filter + `transactionBasePersonalCostCents` as `calculateSpentOnDate`, null category bucketed as `other`, sorted spend-desc). `dashboard/heatmap.ts`: each `HeatmapDay` now has `byCategory` (computed only for days with spend; sums to `totalCents`).
  - **UI** — `dashboard/PhaseMapTabs.tsx`: `DayBreakdown` gained an optional `explain={{ normalAllowanceCents, hasRhythm }}` prop → renders, below the existing rows, a base caption (always), a peak caption with the regular-day amount (only when `hasRhythm && day.isPeakDay`), and a "planned reserves are already set aside" caption (when the day has plan items). New `SpentDayBreakdown` replaces the bare spent total with the day total + capped per-category rows (icon + label + amount) + a pointer to Gastos recentes. `phases/PhasePreviewPage.tsx` passes the same `explain` prop (its preview map already has the fields) so the projection reads identically.
  - **i18n** — `dashboard.day_explain_base` / `day_explain_peak` ({{amount}}) / `day_explain_planned`, `dashboard.day_spent_more` ({{count}}) / `day_spent_none` / `day_spent_recent_hint`, all in pt-BR/en/es.
- **Anti-regression**: additive interface fields only — no existing field changed; the explainer is gated behind the optional prop so the math/rendering is identical for callers that don't opt in. Full suite green: **1416 unit tests / 159 files**. New math-verified tests: rhythm base-weight (uniform/preset/peak-only), `normalAllowanceCents` (uniform = every day; moderate+Sat-peak: normal €80,00 vs peak €150,00 from €460 over 4.6 effective days), `spentByCategoryOnDate` (sorts desc, reconciles to `calculateSpentOnDate`, buckets null→other, ignores deleted/other-day), heatmap `byCategory` sum. Playwright visual QA (Pixel 5) on Julio's real backup confirmed: base line on a normal day; a Saturday peak reading "recebe mais que um dia comum (~€53,02)" with the calendar showing peak Saturdays at €99 vs weekdays at €53; and 17-jun spent split as Outros €203,66 · Bar €63,00 · Restaurante €35,82 · Transporte €3,43 (= €305,91 total). Backend/schema untouched; web/OTA only; APK byte-identical at the verified 0.56.0 shell.
- **Alternatives considered**: (a) precompute `byCategory` for ALL days inside one transactions pass — marginally faster but couples the heatmap builder to a category accumulator; kept the focused `spentByCategoryOnDate` call per spending day (a month is ~30 days, negligible); (b) show the literal "reserva ÷ N dias" division — misleading under rhythm presets where `effectiveDays` is weighted, so kept the qualitative base phrasing + a concrete peak reference number; (c) list every transaction on the day — rejected per Julio ("não os 40 itens"); the full itemized list already lives in Gastos recentes.

---

### DEC-240 — Bill Split "saída de bar" hardening batch: full who-got-what history (by person / by item), "O que é meu" hero, persistent live-split notification, and the pass-the-phone round-the-table mode (v0.99.3→v0.99.4)
- **Date**: 2026-06-19
- **Status**: APPROVED & SHIPPED (v0.99.4).
- **Source**: Julio — after confirming the live-table sync FIX on two real devices ("Já testei nos 2 celulares e funcionou Muito bom"), he asked for the follow-up batch: (1) "implementar as notificações do split (service worker)"; (2) "refinar o histórico/registro: mostrar o que paguei para mim em destaque na hora de registrar, e o histórico tem que estar bom o bastante para eu entrar e ver o que cada um pegou — vê todos os itens e fala esse item foi para tal pessoa, isso tem que estar muito claro"; (3) a new "vou entregar meu celular para a mesa e eles vão anotando os deles, meu celular vai girando a mesa: coloca nome → escolhe produtos → próximo → coloca nome → escolhe produtos… e mesclar com quem tem app também, se fizer sentido — vê tudo com o conselho"; plus "atualiza o brain, faz o commit e o push, e se tiver coisas pra melhorar nessa função pode melhorar".
- **Council (inline: Architect / User-Advocate / Critic / Realtime)** — on the pass-the-phone + merge-with-app idea: **build it as a thin orchestration over the existing session mutations, NOT a new data model.** The domain already models `adhoc` participants and equal-share claims, so a "guided round-the-table" flow = (add participant) + (toggle claim) wrapped in a wizard; it rides the live link untouched because the owner stays the single source of truth (people the owner adds on the device sync out to guests automatically). Merge-with-app = the existing companion shortcut (a `linked` participant). Critic's guards adopted: a **dup-name guard** (a second "João" reuses the existing person instead of duplicating), and the channel for these people is correctly `manual` ("você adicionou na mão"). On the notification: **DO NOT build web push (VAPID/FCM)** — the honest limit (DEC-220) stands (no app-closed push without Play Services); instead a single **persistent, informational** notification mirroring the active table, reusing the proven surfaces (Service Worker `showNotification` on web, Capacitor `LocalNotifications` ongoing on native), permission asked on the real gesture of going live. On `claimedAt` timestamps for the history: **dropped** — the live protocol carries only a batch `at` the owner-reducer collapses, so per-line wall-clock would be invented; adding it also risked destabilising the proven `JSON.stringify` session-diff in `useSplitLiveLink` (republish-loop churn). History anchors the moment with `createdAt` + channel + bill order instead.
- **Decision**:
  - **History clarity — domain (`domain/split/history.ts`)**: `buildSplitHistory` extended with an **item-first view** (`SplitHistoryItem` + `SplitHistoryItemTaker`) answering "esse item foi pra quem" in every mode (itemized = real claims prorated by weight; equal = whole table shares each line; mine = all to the owner), reconciling to the same per-cent proration as `computeSplitTotals`. The per-person view keeps each participant's lines + **channel** (`owner`/`guest_link`/`manual`/`app_linked`/`companion` via `splitClaimChannel`). Orphans ("ninguém pegou") are surfaced as `unclaimed` with the "cai em você" semantics.
  - **History clarity — UI (`features/split/SplitHistorySheet.tsx`)**: a segmented control switches **Por pessoa ↔ Por item**; the person view lists each person (avatar by channel, channel label, lines, service/adjustment) **and an unclaimed card** ("Ninguém pegou · cai em você ao registrar" — so "a conta toda" is always fully shown); the item view lists every line with its takers, share, "dividido entre N", and "Ninguém pegou esse" for orphans. Reused by the live split screen ("Ver divisão completa" on the commit card) AND the committed-expense review (`ExpenseDetailPage` → "Ver quem ficou com o quê" when a `SplitRecord` backs the expense).
  - **"O que é meu" hero (`SplitPage.tsx`)**: the owner's personal cost is promoted to a prominent hero block on the commit card ("O que é meu · €X · de uma conta de €Y") so "mostrar o que paguei para mim em destaque" is the first thing seen at register time (copy `split.my_part` = "O que é meu" / "What's mine" / "Lo que es mío").
  - **Persistent split notification (`utils/split-notification.ts` + `utils/native/split-notifier.ts` + `public/sw.js` + `main.tsx`)**: a single tagged notification (`trippilot-active-split`) mirrors the active table (name + bill total + who's in), updated silently on every owner edit / guest join via the `SPLIT_LIVE_CHANGED_EVENT` bridge, on tab refocus, and on boot; a tap deep-links to `/split/scan` (SW `notificationclick` routes the tag through the existing navigate bridge). Permission is requested ONCE, on the gesture that starts the live table. Web = `ServiceWorkerRegistration.showNotification` (`silent`, `requireInteraction`); native = Capacitor `LocalNotifications` ongoing (one stable id). SW `CACHE_NAME` → `trippilot-v52`.
  - **Pass-the-phone (`features/split/PassThePhoneSheet.tsx` + `SplitPage.tsx`)**: a guided wizard launched from the itemized board — step "who" (name input + app-companion shortcuts + a dup-name guard + a list of who already went) → step "pick" (the person taps their items, sees a running total) → "Próximo (passar o celular)" loops, "Concluir" closes. It reuses a new parametrized `toggleClaimFor(itemId, participantId)` (the existing `toggleClaim` now delegates) and deterministic id-returning add helpers (`addAdhocReturningId`, `pickCompanionReturningId`) so each add→claim→next cadence is robust to React batching. Adhoc people sync out via the live link automatically (owner is the source of truth).
- **Anti-regression**: nothing removed (ÂNCORA 9) — every change is additive over already-tested orchestrators (`computeSplitTotals`, `splitItemBetween`, `addParticipant`, `BottomSheet`, the outing-notification bridge pattern). No schema/worker change; web/OTA only; APK byte-identical at the verified 0.56.0 shell. **Verified**: tsc `--noEmit` clean; **142 split-domain unit tests** (incl. the item-first history suite) + 162 notification-area unit tests green; **ALL split Playwright E2E green** — new `split-pass-phone.spec.ts` (two people each mark their item, the by-item history reads Pizza→Zeca / Cerveja→Bia), `split-flow`, `split-persistence` (the unclaimed orphan now shows in the person view, fixing the "Pizza in history" expectation), `split-share-sheet`, `split-live`, **`split-live-2device` (the two-device sync re-confirmed: owner sees the guest marking, guest sees the owner's later edit)**, `split-explainer`, `receipt-split`.
- **Alternatives considered**: (a) per-claim `claimedAt` timestamps in the history — rejected (no trustworthy per-line time in the live protocol; high regression risk to the proven session-diff); (b) real web push for the split — rejected (DEC-220 honest limit: no app-closed push without Play Services; the persistent local notification covers the in-app/foreground need at zero new infra); (c) a separate data model for pass-the-phone identities — rejected (the `adhoc` participant + equal-share claim already express it exactly; a new model would fork the live-sync path).

---

### DEC-241 — Debt ("está me devendo") becomes real from the owner's ledger + "Acerto de contas" hub redesign + remind/cobrar (deep-dive batch, v0.99.5→v0.99.7)
- **Date**: 2026-06-19
- **Status**: ✅ **SHIPPED — EPIC COMPLETE.** **G1 (v0.99.5, 1545/172)** + **G2 (v0.99.6, 1552/173)** + **G3 (v0.99.7, deployed `trippilot.pages.dev`, 1552/173 green)**. Councils run, decisions locked. One deploy per version. Full spec: `documents/debt-and-split-ux-deep-dive-and-plan-2026-06-19.md`.
- **G3 delivered (DL-5)**: the post-commit moment becomes the natural **"cobrar"** point — `SplitShareNudgeSheet` (fired by `QuickAddPage` when a split gives someone a slice) now offers per debtor **"Lembrar"** beside **"Enviar link"**, a ready-to-send "você me deve {amount}" via the OS share sheet (clipboard fallback, `shareOrCopyText`), reusing the G2 `shared.remind_*` copy. The sheet takes `amountByParticipantId`+`currency`+`tripName`; QuickAdd builds the per-debtor cents map from the persisted `shares`, passed **only when the owner is the payer** (`effectivePaidById === owner.id`) so a third-party-paid split never shows a wrong charge. **Pix-ready**: pt-BR remind copy now says "…me manda no Pix? 🙏" (en/es neutral); the stored Pix key/QR stays the **G4 future epic** (T6/§16), not V1. **Polish**: `/shared` debt rows now lead with the bold amount (`text-sm font-semibold tabular`), the names demoted to caption; "simplify debts" left as-is (already discoverable, shown only when ≥3 people AND it reduces transfers). Additive only (ÂNCORA 9) — `collectSplitNotifyTargets` + `/s` infra untouched; web/OTA only; APK byte-identical.
- **G2 delivered (DL-3/DL-4)**: pure **`summarizeOwnerDebts(debts, ownerId)`** (`OwnerDebtSummary`/`OwnerDebtCounterparty`, 7 unit tests) over `calculateDebts` drives `/shared` reframed as **"Acerto de contas"** — answer-first **A receber / A pagar / net hero** (calm "Tudo em dia" empty-state), per-debt **Lembrar** (new `shareOrCopyText`, ready-to-send message) beside **Liquidar**, visible **Pessoas**, connected-pending shown display-only as **"Aguardando aceite"**, and the P2P machinery (my-QR + receive + `MirroredStatementsSection`) demoted into a **collapsed "Conexões"** kept **CSS-hidden/mounted** so the live mirror sockets never drop. Dashboard gains a **`debt_summary`** card (A receber/A pagar → `/shared`, hidden when even) via `summarizeOwnerDebts` in `useDashboardModel`; the legacy `pending_shares` card (auto-gated by G1) reframed to **"Aguardando aceite"**; settle-up vocabulary unified across entry points (`more.participants`/`guide.shared_t`/`dashboard.*`) in pt-BR/en/es. Demo gained connected friend **"Beto"** (`linkedActorId`, born-`pending`) so both paths showcase at once (Ana offline→confirmed vs Beto awaiting). `share-link` E2E retargeted to Beto (the connected-pending statement). `calculateDebts`/statements/settlements/mirror untouched (ÂNCORA 9); web/OTA only; APK byte-identical.
- **G1 delivered (DL-1)**: pure `resolveShareBirthStatus(participantId, isPayerOrOwner, connectedSet)` — owner/payer + non-connected third parties born `confirmed`, connected (`linkedActorId`/`actorId`) stay `pending`. Threaded `connectedParticipantIds` into `resolvePayerExpense` (QuickAdd + OutingPage) and a self-derived (`actorId`) connected set into `commitSplit`. `calculateDebts` untouched, so `/shared` + dashboard + Copiloto surface offline-friend debts immediately and `findPendingConfirmationShares` lists only connected-pending (DL-2 realized at the data layer). `buildSharesWithPayer`/`createEqualShares` (edit/enrich/crud) left as-is (ÂNCORA 9).
- **Source**: Julio — "a função de divisão de gasto, aquela de 'a pessoa está me devendo', ainda não está boa o bastante, não está funcionando tão bem; passa o conselho na questão de UX e de fluxo (e código se precisar), faz um documento extremamente aprofundado e já implementa, juntando outras melhorias que achar — qualquer dúvida joga pro conselho, faz direto sem perguntar; planeja tão bem que a implementação não gere nenhum bug".
- **Root cause found (grounded in code)**: a **confirmation asymmetry** (DEC-071). Owner-authored third-party shares are born `pending` (`buildSharesWithPayer`; live table `split-orchestrators.ts:122`) and `calculateDebts` counts **only `confirmed`** (`splitting.ts:210-215`). So "eu devo a alguém" shows instantly (owner's own share is confirmed) but "**alguém me deve**" is **invisible** in the balances + "Dívidas pendentes" until that person confirms via a synced channel — which never happens for an offline friend. The `/shared` page then shows the person as "Em dia" while the same expense's share reads "Pendente", and the dashboard nags the **owner** to confirm a split the owner authored, with copy saying *the other person* must confirm.
- **Council (4 inline passes, no subagents)**: (A) **DEBATE** on the model → **born-`confirmed` for NON-connected participants**, `pending` only for **connected** (`linkedActorId !== null` or active share link/peerLink), `calculateDebts` left intact (Option A beat "count regardless of status" Option B on blast-radius). (B) **REVIEW** of the hub → answer-first **"Acerto de contas"** with a derived summary hero, per-person **Liquidar**/**Lembrar**, a visible **"Pessoas"** subsection, P2P machinery demoted into a collapsible **"Conexões"** (sockets kept mounted), connected-pending shown as an explicit "Aguardando aceite" group; **G1 before G2** is a hard prerequisite. (C) **ASSESS** → 3 gates, strict order, G1 fully tested in isolation (confirmation-contract regressions are the main risk), **hard cap** on app-wide extras. (D) **BRAINSTORM** → ship the Simplifier's three (born-confirmed, dashboard "te devem/você deve" card, "Lembrar") + Pix-ready remind message; defer Pix QR / trip-end netting / statement-visual unification.
- **Decision (locked DL-1..DL-6)**: DL-1 born-confirmed for non-connected via a `connectedParticipantIds` input threaded into `resolvePayerExpense` + `commitSplit`; DL-2 reframe "Pendente" copy to mean "aguardando aceite de quem tem app/link" (never shown for offline friends); DL-3 hub redesign "Acerto de contas"; DL-4 dashboard "te devem/você deve" card; DL-5 "Lembrar/Cobrar" share message (Pix-ready, Pix QR deferred); DL-6 strict gate order + scope cap, web/OTA only (no native change → no APK).
- **Anti-regression**: `calculateDebts`/statements/settlements/mirror loop untouched; the only behavior change is the birth status of non-connected third-party shares. Confirmation-contract unit suites (`payer-semantics`, `splitting`, `split-share`, `split-commit`, mirror/statement, `migration-v3`, `backup`) updated to the new semantics + connected-case tests added; demo seed aligned (keep one connected-pending example). Full split+sync suites + tsc green at each gate; targeted Playwright per touched screen; one Pages deploy per version, live `version.json`/`APP_VERSION` verified.
- **Alternatives considered**: (a) Option B "count owner-authored shares regardless of status + ack badge" — rejected for global `calculateDebts` blast radius (dashboard/insights/statements/mirror) under the no-bugs mandate; revisit if multi-owner/group editing arrives. (b) "make everything confirmed" (drop the gate) — rejected, breaks the legit mirror confirm/reject loop for connected peers. (c) full Pix QR / trip-end settle-all now — rejected as out-of-scope (needs payment metadata + reconciliation); seeded via the "Lembrar" message.

### DEC-242 — Open decisions councils & future-apply plan (Hub×Overview, Fundo→Trecho/Pote, Wise explainer)
- **Date**: 2026-06-19
- **Status**: 🔬 **RESEARCHED — DEFERRED to dedicated gates** (not yet implemented). Full doc: `documents/open-decisions-councils-and-future-plan-2026-06-19.md`.
- **Source**: Julio — "rode o conselho para essas decisões em aberto e faça uma pesquisa grande, crie uma documentação para eu aplicar no futuro."
- **OD-1 (`/viagem` Hub × `/trip` Overview, audit G7/§6 Q3)**: council (Architect/Advocate/Critic/Strategist) → **keep two, do NOT structurally merge** (the Hub is already the densest screen; a merge regresses it). Sharpen roles instead: make Overview strictly read-only + share-card; funnel all plan/edit to the Hub (Path A). A light merge (fold share-card+total into the Hub header, redirect `/trip`→`/viagem`, audit deep-links) is Path B, **only if** the overlap still bothers Julio after the GATE-14 role microcopy. Confidence HIGH.
- **OD-2 (Fundo→Trecho/Pote vocab, DEC-228 deferred half)**: council DEBATE (Proponent/Opponent/Judge) → do it as **ONE nature-aware pass** (`poolNature(pool)` → trecho|pote|generic with a neutral fallback), **never a blanket "Fundo"→"Trecho"** (a pool can be a trecho OR a pote). UI strings only; keep `Fund`/`pool` code ids (same discipline as DEC-228's "Perfis"→"Atividades"). Prereq: Julio validates the term map (Trecho / Pote / fallback "Reserva"?). Confidence HIGH.
- **OD-3 (Wise split explainer, DEC-231 deferred)**: quick council (Advocate/Architect) → **mount the existing `SplitExplainer` in the Wise allocation sheet, collapsed**, top of the split block. Lowest-risk; copy source already exists. Confidence HIGH.
- **Sequencing**: OD-3 (quick, any OTA) → OD-2 (needs term validation) → OD-1 (only if still needed; prefer Path A). All web/OTA, none block G4 or the audit. To execute later: "apply OD-1 Path A" / "apply OD-2" / "apply OD-3".

### DEC-243 — APK / OTA self-update study (web OTA + native installer confirmed working; promotion-gated)
- **Date**: 2026-06-19
- **Status**: 🔬 **STUDY — for future application** (no code changed). Full doc: `documents/apk-ota-self-update-study-2026-06-19.md`.
- **Source**: Julio — "entenda se há como atualizar o APK via OTA também… faça um estudo e salve para aplicarmos no futuro" (currently grabbing the APK from Downloads).
- **Finding (VERIFIED in code)**: TripPilot already has **two** update channels — (1) **web bundle OTA** (Capgo `@capgo/capacitor-updater`, silent on cold start — why all 0.9x.x ship "web-only OTA"); (2) **native APK in-app self-update** (DEC-210): `utils/live-update-boot.ts` shows a one-tap "atualização do app" toast → `downloadAndInstallApk` → `ApkInstallerPlugin.java` launches the OS installer (gated by `REQUEST_INSTALL_PACKAGES` + FileProvider; user confirms in the OS dialog — never silent).
- **Why the Downloads detour now**: `latestNativeVersion` is **0.56.0** (== installed); the **0.69.0** shell is **device-pending** (DEC-218) and policy forbids promoting an unverified shell, so the in-app updater correctly offers nothing and the build pipeline's Downloads copy (DEC-210 #3) is the override path. Not a bug.
- **Hard limit (Android, HIGH/GENERAL)**: a sideloaded APK can **never** be replaced silently — every install needs the OS PackageInstaller confirm + a one-time "allow this source" grant. True background updates require the **Play Store** (reverses DEC-206 sideload-only) or MDM — out of scope.
- **Council ASSESS** → keep the architecture; **keep the verify-before-promote gate** (the main risk is shipping an unverified shell to all installs). Future-apply: **OTA-1** (process) verify shell on device → bump `latestNativeVersion` → the existing toast delivers one-tap install; **OTA-2** (~1–2h) a manual "Buscar atualização do app" button in Settings reusing `resolveAppVersionStatus()`+`downloadAndInstallApk()`; **OTA-3** optional pre-download+cache. Confidence HIGH.

### DEC-244 — G4 · User-defined payment methods appended to the "Lembrar/Cobrar" reminder (v0.99.9)
- **Date**: 2026-06-19
- **Status**: ✅ **SHIPPED (v0.99.9, web-only OTA).** Council run, decision locked. Built directly on the DEC-241 remind flow.
- **Source**: Julio — "a parte de pagamento não é só pix, e sim o pagamento que o user tiver, pode ser tag da wise, chave do pix, dados bancários, o user que fala quais e quantos quer deixar disponíveis".
- **Decision**: the owner publishes a list of repayment methods — any mix of **Pix key / Wise @tag / bank details / free text** — choosing which and how many. **Enabled** methods (with a non-empty value) are appended to the settle-up reminder under a "Pode pagar por:" header. Persisted as a flat `paymentMethods: PaymentMethod[]` on **AppSettings** (non-indexed, no migration; travels in the backup). One `useRemindMessage()` hook is the single source for both remind sites (settle-up hub + post-split nudge).
- **Inline council (Architect / Critic / Advocate / Simplifier)**: flat data-driven model (kind → default label+icon), no per-trip methods/validation beyond trim (Simplifier); an `enabled` flag so a method can be saved-but-excluded (Advocate) with `enabled:true` on create to avoid two-state confusion (Critic); base reminder made **payment-neutral** so zero-method users are byte-identical to before (Critic's regression guard). Red team: a method with an empty value or appending when the owner isn't the creditor → mitigated by `enabledPaymentMethods` (drops empty) + the existing nudge guard (amounts only when owner is payer).
- **Scope**: `domain/payment/payment-methods.ts` (+barrel) pure domain & mutators; `AppSettings.paymentMethods` + seed + repo backfill; `features/settings/PaymentMethodsPage.tsx` (route `/settings/payment-methods`, linked from Conexões); `useRemindMessage()` feeding `SharedExpensesPage` + `SplitShareNudgeSheet`; pt-BR reminder neutralized; `shared.pay_via` + `payment.*` in pt-BR/en/es. Tests: 14 domain + 3 Playwright.
- **Alternatives considered**: (a) a Pix-only key field — rejected, the user explicitly wants any method. (b) per-trip payment methods — rejected as over-modeled (Simplifier); methods are about the person, not the trip. (c) restoring methods cross-device on import — deferred; consistent with every other AppSettings field (backup carries the data, import only patches activeTrip/identity).
- **Follow-up (v0.99.10, web-only OTA) — discoverability + polish from the broad-audit pass**: a Playwright console+visual sweep of 29 screens came back clean (zero runtime/page/nav errors; 1572 baseline tests green), so per the council's hard scope cap the close-out is **additive only**. (1) **Discoverability** — `/shared` shows a calm nudge to publish a payment method **only when the owner is owed AND none is enabled** (pure derivation; `shared.add_payment_hint` ×3 locales; self-hides once one exists), closing G4's loop without burying it in Settings. (2) **Haptics gesture-gating (`utils/haptics.ts`)** — the only real defect the audit surfaced: the web `navigator.vibrate` path now waits for the first user gesture (one-time `pointerdown/keydown/touchstart` capture listener) so a boot-time haptic is a clean no-op rather than an engine-logged "blocked" error; native plugin path untouched. Tests: +3 `haptics.test.ts`, +2 Playwright (the `/shared` hint + the real "Lembrar" message carrying the published Pix value end-to-end). Date 2026-06-20.

### DEC-245 — Ranked improvement backlog (researched-but-unbuilt, still-valid) — garimpo & ranking
- **Date**: 2026-06-19
- **Status**: 📋 **RESEARCH / BACKLOG (not implemented)** — a discovery pass, no code changed. Source doc: `brain/documents/improvement-backlog-ranked-2026-06-19.md`.
- **Source**: Julio — "faça uma pesquisa completa de coisas que pesquisamos para melhorias mas não fizemos, que ainda fazem sentido hoje e não foram impactadas por outras mudanças; ache uma lista bem grande e rankeie por facilidade × valor × encaixe × ganho".
- **Method**: cross-referenced the old plans (master-fix B1–B18, UX-clarity §5, OD-1/2/3, OTA-1/2/3, Copilot A–H, V2 roadmap) against DEC-212..244 to drop everything already shipped/superseded, then scored survivors. Confirmed-done-and-excluded: income type, web biometric, all Copilot modules except Wrapped, E2E-in-CI, B7/B9/B12/B17 (v0.65.0), the 4 UX packages, bill-split, debt deep-dive, G4 payment, plus several P3s already present (DEC-232/233, income "aumenta o fundo" copy).
- **Decision**: five buckets — **A (do today, web/OTA, additive, low risk):** OD-3 Wise split explainer · receipt consent microcopy · simulator generic "avulso" target + "Posso gastar?" label · Wise import discoverability · OTA-2 Settings check-for-update button. **B (needs one Julio input):** OD-2 nature-aware Fundo→Trecho/Pote (term map) · OD-1 Path A sharpen Hub×Overview (only if overlap still felt). **C (bigger/delight):** Copilot end-of-trip "Wrapped" · auto-suggest start-Outing on consecutive bar/restaurant spend. **D (device-blocked):** OTA-1 promote verified shell (the real fix for the Downloads detour) · native batch B1/B2/B3 · native biometric · B18 device QA. **E (deferred by design):** SW build plugin, orchestrator refactor, P2P V2, close-on-background, shared-link v1.1 (frozen), FCM push, login/accounts/remote-sync/widget (V2), onboarding collapse, edge-swipe coachmark.
- **Top pick**: bucket A is fully autonomous and closes already-researched loops; execute on "manda o balde A".
- **Update (2026-06-20, 0.99.11 — executed bucket A with a live-code recheck)**: cross-checking the code before building revealed the backlog (built from older study/audit docs) **oversold bucket A** — **A2** (receipt consent), **A3's "Posso gastar?" label** + the generic `{kind:'other'}` simulator target, and **A5** (`SettingsPage.handleCheckUpdate→handleCheckUpdateNative`) were **already shipped**. The only genuinely-open, zero-risk item was **A1 / OD-3 — the Wise split explainer**, now **DONE in 0.99.11**: `<SplitExplainer />` mounted collapsed in the Wise `TransferClassificationSheet` (4th and final split surface → G9 complete on QuickAdd/Receipt/Shared/Wise). Verified: full suite 1575/1575, build green, `e2e/split-explainer.spec.ts` 3/3 (new Wise-upload test + screenshot `test-results/audit/wise-split-explainer.png`). The backlog doc was corrected in place (A2/A3-label/A5 → already-shipped; A3 "avulso-as-default" residue → balde B; A4 → optional). Net honest finding: the "do-today-solo" bucket was effectively just A1 — the app was already more complete than the old docs implied; the remaining real work needs Julio's **decision** (balde B) or **device** (balde D).

---

### DEC-246 — AI Quick Entry: natural-language router (text + voice) wired to every core action (v0.99.12; split-accuracy hardening v0.99.14)
- **Date**: 2026-06-20
- **Status**: ✅ **SHIPPED + DEPLOYED + LIVE (v0.99.12)** — committed (`ef7793f`), pushed, CI-deployed to the apex; the Worker `/assistant`+`/transcribe` routes shipped via `wrangler deploy` (reusing the existing `GROQ_API_KEY` that `/ocr` uses). **Live-probed 2026-06-20:** `POST /assistant {"text":"o Bruno me pagou uma cerveja de 2 euros"}` → `{action:"someone_paid",person:"Bruno",amount:2,currency:"EUR",category:"bar",direction:"i_owe",confidence:1}`, HTTP 200 — the exact canonical routing. Plan doc: `documents/ai-quick-entry-natural-language-router-plan-2026-06-20.md` (5 inline councils).
- **Amendment v0.99.14 (2026-06-20) — split-accuracy QA pass (Julio: "coloquei isso pra IA e não fez certo… testar uns 20 tipos de entradas e fazer todas funcionarem até as mais complicadas")**: a field input — *"Bruno pagou 12,80 pelas tortilhas, dividimos entre ele, eu e a Débora"* — was mis-recorded as `someone_paid` (I owed the **full €12.80** instead of my **€4.27** share). Root causes + fixes: **(1) Worker prompt (planner)** — added an explicit "decide SPLIT first" rule + worked examples so *someone-else-paid-AND-divided* routes to `split_expense` with `payer="other"`, `person=<who paid>`, `participants=[the sharers]`; added pronoun resolution ("ele"→the named person), a "never list the user (`eu`/`me`) as a participant" rule, comma/thousands decimal guidance, and "**don't guess currency** when none is spoken → null (device uses base)". **(2) Device `plan.ts`** — `split_expense` now honors a **named non-owner payer** (and includes them as a sharer) instead of only inferring a lone non-owner; a **safety-net reroute** turns any `someone_paid` that still carries extra sharers into the correct equal split (a planner misclassification can **never** overcharge); added a shared `equalSplit` builder, self/pronoun filtering, multi-person `i_paid_for`, and a whole-trip fallback. **(3) `intent.ts coerceNumber`** — parses `"12,80"→12.8`, `"1.250,00"→1250`, `"1,250.00"→1250`. **Verified:** +16 assistant unit tests (57 total green), full suite green except the 2 pre-existing `split-live-loop` env tests; Worker **re-deployed** (`wrangler deploy`, version `96b494f1`) and **live-re-probed** — the exact bug input now returns `split_expense`/`payer:other`/`Bruno`/`["Bruno","Débora"]`/`12.8`. Device fixes ship web/OTA in **v0.99.14**.
- **Source**: Julio — field pain at a bar: "toda vez que pego a bebida ir lá e marcar… parece que perco tempo marcando o que foi, onde foi". Wanted one fast box (text **and** voice) — "o Bruno me pagou uma cerveja de 2 euros" — that infers place/time/person, asks only when needed (add/disambiguate person), and routes to the right existing function (debt, split, scan, outing, transfer, plan…). "Expor todas as funções para a IA."
- **Decision**: a **planner (cloud) / executor (device)** split. The cloud model (Groq `llama-3.3-70b-versatile`, JSON mode) is a pure **router**: it returns ONE typed `AiIntent` (an action + entities **by name**, never ids, never math). The **device** owns everything that matters — it resolves names→ids, plans the concrete op, and runs it through the SAME orchestrators QuickAdd uses (`resolvePayerExpense`, `registerExpense`, `transferBetweenWallets`, `withdrawCash`, `registerIncome`, `createSettlement`, `createPlannedPurchase`). Financial math/persistence stay 100% on-device. Voice = Web Speech first, Groq **Whisper** (`whisper-large-v3-turbo`) fallback for the APK.
- **Architecture**: new pure domain module `src/domain/assistant/` — `intent.ts` (Zod-coerced, untrusted-input-safe parse), `context.ts` (names-only context pack), `resolve.ts` (category/amount/person/wallet/date resolvers), `plan.ts` (`buildActionPlan` → ready `ExecOp` | `navigate` | `needs` clarification | `unsupported`), `dispatch.ts` (the only impure boundary; each op returns an `undo`). Worker gains stateless `/assistant` (JSON) + `/transcribe` (Whisper) proxies next to `/ocr` (key never leaves the Worker). UI: a single global `AssistantSheet` (mounted in `AppShell`) opened from a new gradient **AI hero** at the base of the FAB (the new #1), with a text box + mic, a one-tap **preview → confirm**, a tap-loop for clarifications, **undo** toast (DEC-126), and graceful fallback to manual QuickAdd on any failure/offline.
- **Privacy (ÂNCORA 8)**: opt-out master switch `aiQuickEntryEnabled` (default **ON** for the owner's headline tool; degrades gracefully when the Worker key/network is absent) + `aiQuickEntryPrivateNames` (opt-in: withholds people/wallet names, device then always asks "who?"). The context pack carries only first names/labels, the place label, language, base currency and the category list — **never** amounts, balances, ids or history.
- **Mapped actions**: execute — `log_expense`, `someone_paid` (I owe), `i_paid_for` (they owe me), `split_expense` (equal), `record_income`, `transfer`, `withdraw`, `settle_debt`, `plan_purchase`; navigate — `open_split_bill`, `open_scan_receipt`, `open_outing`, `open_plan_expense`, `open_simulator`, `open_screen` (debts/expenses/dashboard/wallets/planner/income/trip).
- **Correctness note**: "o Bruno me pagou uma cerveja" → `someone_paid` → `resolvePayerExpense` row 4 (payer = Bruno, not split) → I owe the full amount, no wallet move; a non-connected Bruno's debt is born **confirmed** (DEC-241). A new name triggers an inline "Adicionar Bruno?" that creates the participant, then re-plans.
- **Verification**: 3 new pure test files (`intent`/`resolve`/`plan`, **41 tests**), full suite **1655 passing** (the only 2 failures are the pre-existing `split-live-loop` *real-worker* integration test that needs Web Crypto + network, untouched by this work), `tsc --noEmit` app + worker green, `vite build` green, i18n pt-BR/en/es complete.
- **Alternatives considered**: (a) cloud tool-calling that writes directly — rejected (Groq can't combine tool-calling + structured output in one call, and it would push financial logic/data to the cloud); (b) on-device-only regex parser (the existing `parseVoiceExpense`) — kept as the offline fallback but too brittle for free-form intent; (c) sending full state for "smarter" inference — rejected on privacy.

---

### DEC-247 — Copilot "Trip Wrapped" end-of-trip retrospective (v0.99.13)
- **Date**: 2026-06-20
- **Status**: ✅ **SHIPPED (v0.99.13)** — in-app core, deployed web/OTA. The last unbuilt Copilot module (H) from DEC-245 bucket C.
- **Source**: ranked backlog `documents/improvement-backlog-ranked-2026-06-19.md` (item C1) — the end-of-trip "Wrapped"/superlatives recap was the only Copilot read still unshipped; surfaced as the recommended autonomous next step after bucket A.
- **Decision**: a pure orchestrator `domain/copilot/wrapped.ts` (`buildTripWrapped`) assembles trip-wide superlatives by **reusing the existing copilot-insights derivations** (`summarizeHomeCurrencyTotal`, `summarizeByCategory`, `summarizeSocialVsSolo`, `summarizePeakHour`, `summarizeDisciplineStreak`) + two small local helpers (`biggestSpendingDay`, `countActiveDays`); each stat **self-censors** (null when the data is too thin — no fabrication). Presented by `features/copilot/TripWrappedSheet.tsx` (a `BottomSheet`): hero total + biggest day + #1 category + social split + peak hour + discipline streak, each rendered only when present. The entry is a gradient row at the top of `/copiloto`, gated on `hasAnySignal && totalCents > 0`, reachable **any time** and labeled a **preview** until the trip's end date passes (`isTripEnded`). "Compartilhar" reuses the existing 1080×1350 `renderShareCard`/`deliverShareCard` (DEC-133); a bespoke Wrapped canvas is deferred.
- **Privacy/derivation note**: 100% on-device, no new data, no schema/worker change — purely additive over existing derivations (ÂNCORA 9).
- **Verification**: 7 new unit tests (`tests/unit/domain/copilot/wrapped.test.ts` — `isTripEnded` edges, superlative assembly, thin-data censoring, social/streak math, deleted/zero-cost ignored), full unit suite green, tsc app+worker clean, vite build green, and `e2e/copilot-wrapped.spec.ts` (demo data → entry visible → sheet opens with hero + share; screenshot `test-results/audit/wrapped-sheet.png`).
- **Alternatives considered**: (a) a bespoke "Wrapped" canvas/story format now — deferred (reuse the proven share card first; lower design risk); (b) end-only visibility — rejected (a mid-trip preview is more visible and testable); (c) placeholder stats when data is thin — rejected (each stat self-censors).

---

### DEC-248 — Admin dashboard v1: anonymous-by-install usage telemetry (names yes, money never) + `/admin` panel
- **Date**: 2026-06-21
- **Status**: 🚧 **IN PROGRESS (same session).** Worker side **SHIPPED + LIVE**; client + `/admin` UI building now. Plan doc: `documents/admin-dashboard-v1-plan-2026-06-21.md`.
- **Source**: Julio — "um painel inicial de administração… ter noção de quem está usando o app e como… quais funções usam, quantas compras dividiu, quantos gastos, última vez que usou, com quem". Privacy calibration (2nd msg): "a marca é privacy-first mas não precisa ser extremo — **quero nome de quem está usando, quanto está usando, só não passar valores monetários**, que aí cruza a linha. Consentimento **on-by-default** com aviso claro + opção de desativar nas configs (aprendizado/debug, deixando claro que não enviamos infos sensíveis, só das funções do app). Enviar **ao abrir o app** (o user pode não entrar todo dia)."
- **Decision — the privacy line**: telemetry may carry the **owner's display name** + **non-monetary usage signals** (counts of trips/expenses/outings/splits/settlements/planned/wallets/participants/connections/ai-entries/receipt-scans/crashes; adoption flags; app version/platform/locale; country from CF header). It may **NEVER** carry monetary values, item text, balances, place names, dates of expenses, or any per-transaction content. The line is **enforced server-side**: `ingest` accepts only keys present in the `TELEMETRY_COUNTERS`/`TELEMETRY_FLAGS` allowlists — any unknown key (e.g. `totalSpent`) is rejected with HTTP 400, so a money value can never even be persisted.
- **Architecture**: a **heartbeat** model (not an event stream). The device keeps cumulative per-install counters locally and, **on app open** (throttled to ≤1 successful send per UTC day, best-effort `keepalive` fetch), POSTs an aggregate snapshot to the Worker `POST /t`. Storage is ONE global **Durable Object with SQLite** (`TelemetryStore`, migration tag `v5`) — chosen over D1 to reuse the existing DO pattern and avoid separate provisioning. Tables: `installs` (one row/device, upserted, holds name+counters+flags+meta+`active_days`) and `heartbeats` (`install_id`+`day` PK → DAU/WAU/MAU via `COUNT(DISTINCT)`). Identity = the existing anonymous `getInstallationId()` UUID (`trippilot_device_id`); the human name comes from the owner `Participant.isOwner` (fallback `AppSettings.deviceName`).
- **Admin access**: read-only `GET /admin/*` (overview, installs, timeseries) + `DELETE /admin/install?id=` (drop test/junk rows), all gated by a `Bearer` `ADMIN_TOKEN` Worker secret (set via `wrangler secret put`, not in code). 401 without it (verified live). The `/admin` route in the SPA prompts for the token (kept in-memory/localStorage), never bundled.
- **Consent**: `AppSettings.telemetryEnabled` **default true** (on-by-default per Julio), with a Settings toggle + a plain-language disclosure ("dados de uso anônimos por dispositivo para melhorar o app — nunca enviamos valores nem o conteúdo dos seus gastos") and one-tap opt-out; when off, zero network calls.
- **Worker verification (live, 2026-06-21)**: `wrangler deploy` registered `env.TELEMETRY (TelemetryStore)`; live probes — valid UUID ingest → `{ok:true}`; `counters:{totalSpent:999}` → `400 bad_counter:totalSpent` (money guard); `/admin/overview` no token → **401**, with token → aggregated JSON; `/admin/installs` → row with `displayName`; `DELETE /admin/install` no token → **401**, with token → `{ok,deleted:1}` (smoke row cleaned). Worker `tsc --noEmit` green.
- **Alternatives considered**: (a) full event stream / analytics SaaS — rejected (privacy surface + cost + over-engineering for a solo-lead v1); (b) D1 instead of a DO — rejected (extra provisioning; DO+SQLite already in the stack); (c) fully anonymous UUID-only (no name) — rejected by Julio's explicit calibration (names wanted, only money is the red line); (d) opt-in consent — rejected by Julio (on-by-default with clear opt-out).

---

### DEC-249 — Multiple trips at once (multi-trip switcher + `/spaces` list + in-app create; `activeTrip` pointer; anti-error chip + confirm)
- **Date**: 2026-06-21
- **Status**: ✅ **RATIFIED** (Julio confirmed: "ok, então é clicando no nome da viagem mesmo"). Building this session. Study: `documents/multi-space-and-admin-v2-study-2026-06-21.md` §2.
- **Source**: Julio — plan a second trip without touching the active one, switch between them, see each ("talvez clicando no nome da viagem").
- **Decision**: the data layer is already multi-`Trip` (everything scoped by `tripId`; `useAppData` reads a single `appSettings.activeTrip` pointer; create is additive/atomic). Expose it as UX+orchestration only: (1) an **active-space chip** in the shell (name + dates/status) that opens the switcher; (2) a **`/spaces` list** grouping all non-deleted trips by status (active / planning / completed) + Dia a dia; tapping swaps `activeTrip` + `reload()` + toast; (3) **"+ Novo"** reuses the onboarding builder/orchestrator in-app (status by start date; future → `planning`) without touching the current trip. **Anti-error (Critic):** confirm on switch, never auto-switch, the AI/quick-entry echoes the active trip name. `completed` trips are **fully editable** when reopened (Julio: "Editável ao reabrir") — not read-only.
- **Why**: cheapest retention feature available; data risk LOW (`useAppData` is the single read bottleneck); it is also the prerequisite funnel for the Dia a dia mode (DEC-250).

### DEC-250 — Continuous "Dia a dia" mode via `Trip.kind='ongoing'` + capability gate; MULTIPLE named spaces (no internal grouping primitive)
- **Date**: 2026-06-21
- **Status**: ✅ **RATIFIED + extended by council** (this session). Study §3 + inline Council A (2026-06-21).
- **Source**: Julio — the brother-in-law case (always splitting at home, no trip dates); plus "um dia a dia com a esposa, um com o irmão — coisas diferentes?".
- **Decision**: reuse `Trip` with `kind: 'trip' | 'ongoing'` (default `'trip'`; existing trips untouched — ÂNCORA 9), NOT a new entity. A **capability gate** hides date-coupled features (phases, daily budget, "days left", forecasting, simulator, check-in lens) when `kind==='ongoing'`; the ongoing home shows balances + recent + split + "who owes whom". **Council A verdict (HIGH confidence):** the "wife space / brother space" are **separate `Trip(kind='ongoing')` spaces** in the same multi-trip switcher — **NOT** one space with an internal grouping primitive. Rationale: separate spaces isolate balances by construction (no mixing the wife's and brother's "who owes whom"), reuse 100% of the `tripId` plumbing (a grouping primitive would be NEW code touching split/settle/filters — higher risk), and match the user's mental model. Proliferation is handled by **archive**; recurring people are reused via the global `peerLink`, not recreated.
- **Budget (Julio's answer to OQ1)**: monthly budget is **OPTIONAL** (a no-date pot/cap, reusing the existing date-less pot model). If the user sets none, the space just records things — totally open.
- **Naming (Julio's answer to OQ2)**: user-facing label is **"Dia a dia"**. Vocabulary of "viagem" is hidden in this kind.
- **Sequence**: multi-trip (DEC-249) ships first; Dia a dia is just another entry in its switcher.

### DEC-251 — Admin v2: AI tokens (server-authoritative) + error capture (same wave) + per-user detail view + DAU chart/search/CSV
- **Date**: 2026-06-21
- **Status**: ✅ **RATIFIED** (Julio: "já faz os dois juntos" for tokens **and** errors; "trazer para a tela de auditoria todas as informações disponiveis sobre um usuario quando eu clicar no usuario"). Study §1.
- **Decision**: extend the DEC-248 `TelemetryStore` (DO + SQLite) + `/admin`. **(a) AI tokens** server-authoritative: the client passes `installId` to `/assistant` and `/ocr`; the Worker reads `usage.total_tokens` from the Groq response and UPSERTs `ai_usage(install_id, day, fn, tokens, runs)`; admin aggregates tokens per user / per function / time series. **(b) Error capture**: `POST /e` ingest (anonymous, `installId`), server-side scrub (truncate, strip long digit runs, allowlist) → `errors(install_id, day, msg_hash, message, count, last_seen, app_version, platform)` deduped by hash; admin shows top errors + #users affected. **(c) Per-user detail**: clicking a user in `/admin` opens a panel with **everything available** for that install (all counters, all flags, platform, version, locale, country, first/last seen, active days, AI tokens, recent errors). **(d)** DAU line (endpoint exists), sort/search/CSV export. **Privacy**: tokens/errors carry no monetary value; same allowlist/scrub contract as DEC-248. Email is **NOT** transmitted (stays local — see DEC-252).

### DEC-252 — Onboarding identity: ask the owner's NAME always (both flows), e-mail OPTIONAL and LOCAL-only
- **Date**: 2026-06-21
- **Status**: ✅ **RATIFIED by council** (inline Council B, 2026-06-21). Building this session.
- **Source**: Julio — a simple-mode trip created on iPhone showed up in admin as **"Eu"** because the quick flow never asks the name; "pelo menos o nome do user tem que pedir sempre, e acho que é legal salvar o email também".
- **Decision**: a new **first step "Quem é você?"** shared by BOTH onboarding flows — **name required** (kills the `default_owner_name` "Eu"), **e-mail optional + skippable** (fills the existing `Participant.email`, zero migration). **Privacy (Critic):** the e-mail is stored **locally only** and is **NOT** sent to telemetry/admin in v1 (DEC-248 contract "names yes, money never" did not approve transmitting e-mail) — surfacing e-mail in admin would be a separate explicit decision. The name still powers `telemetry.displayName` and the `isOwner` participant used in splitting.
- **Why**: the name is the single highest-value datum (admin identity + split clarity + greeting) and costs one pre-focused field; only a *mandatory e-mail* would hurt the fast flow, so e-mail stays optional.

### DEC-253 — Telemetry platform reports the real OS (iPhone PWA = `ios-web`, not `web`)
- **Date**: 2026-06-21
- **Status**: ✅ Building this session.
- **Source**: Julio — an iPhone user showed up in admin as platform **"WEB"**; "todo IOS acho que vai ser Web" (iPhone users run the PWA, not the native shell).
- **Decision**: `telemetryPlatform()` no longer returns only `Capacitor.getPlatform()` (which is `'web'` for any non-native shell, including the iOS PWA). It now reports the real OS: native shells stay `ios`/`android`; the web build detects the OS and reports `ios-web` (iPhone/iPad PWA or Safari), `android-web`, or `web` (desktop). This makes the admin "Plataformas" distribution honest.

### DEC-254 — Admin user-detail panel (click a row → all available info for that install)
- **Date**: 2026-06-21
- **Status**: ✅ Building this session (part of DEC-251 (c), recorded separately for traceability).
- **Decision**: the `/admin` users table becomes clickable; a row opens a detail view showing every field the telemetry already holds for that install (identity, meta, all counters, all flags, dates, active days, and — once Onda B ships — AI tokens + recent errors). No new data is collected; it just fully surfaces what exists.

### DEC-255 — New app icon (web manifest + Android adaptive + iOS), purpose-built for TripPilot
- **Date**: 2026-06-21
- **Status**: ✅ Building this session.
- **Source**: Julio — "criar um novo icone do app, um melhor mais condizente com o app, tanto para android o apk, quanto para web e para ios".
- **Decision**: design a new mark and regenerate every icon target (`public/icons/*`, manifest `icon-192/512`, maskable, Android `mipmap` via the icon pipeline, iOS/Capacitor assets). Keep a single SVG source of truth driving `scripts/generate-icons.mjs`.

---

## Field Feedback batch (2026-06-22) — DEC-256..278

> All from Julio's 2026-06-22 field-feedback session. **Direction APPROVED / ratified by Julio; implementation PENDING.** Full root-cause + ACs + tests + gates + the inline councils (C1–C15) are in `documents/field-feedback-master-plan-and-councils-2026-06-22.md` (v2). Next new id after this batch = **DEC-281**.

### DEC-256 — Currency conversion calculator (dedicated `/converter`) + AI "how much is X in Y?" intent
- **Date**: 2026-06-22
- **Status**: ✅ APPROVED (ratified) — implementation pending. Plan: field-feedback master plan §C1, FB-04.
- **Decision**: a minimalist dedicated `/converter` screen (amount + two currency selectors + ⇄ swap + big result), **reusing** the existing `fetchExchangeRates`/`frozenRates`/`convertToBaseCents` (no new provider/key); always shows the **rate age** + 1-tap refresh + manual-rate override; offline uses the frozen snapshot with an age stamp. Pre-fills `from = trip/last currency → to = anchorCurrency ?? home`. First-class entry from the FAB + a Copilot/Guide shortcut. **Also** ships an **informational AI intent** ("quanto é 20 euros em reais?") that does NOT create an expense — the AI only extracts `{amount,from,to}` and the **device computes locally** from cached rates (cheap, offline-friendly, no token waste).
- **Rationale**: the traveler checks "how much is this back home?" dozens of times/day; reusing the rate infra keeps it honest and cheap; the AI intent serves casual users without a screen visit.
- **Alternatives**: only-AI (rejected — power users want a screen); new FX provider (rejected — `open.er-api.com` already in use).

### DEC-257 — Stitch the three capture surfaces (photo in AI + "✨ AI" in manual); NO single wizard
- **Date**: 2026-06-22
- **Status**: ✅ APPROVED (ratified). Plan: §C2, FB-09.
- **Decision**: keep the three entry surfaces (AI text/voice, manual `/quick-add`, "Dividir conta" scan) and **stitch shortcuts** instead of building a unified wizard: (a) a **camera button in the AssistantSheet** (gated by `cloudReceiptOcrEnabled`) that reuses `extractReceiptViaCloud`; (b) a **"✨ Preencher com IA" chip** atop `/quick-add`; (c) clearer FAB labels ("Lançar gasto" / "Registro detalhado" / "Dividir conta"). No mandatory "how do you want to register?" step.
- **Rationale**: the detailed manual entry is the richest surface and must not be diluted; stitching is low-risk vs a new engine.
- **Alternatives**: single unified entry wizard (rejected — friction for the 90% typing case + cannibalizes the detailed entry).

### DEC-258 — Field parity for AI-read receipts (category, location, receipt date) + collapsed pre-filled UI; photo→1 summarized expense
- **Date**: 2026-06-22
- **Status**: ✅ APPROVED (ratified). Plan: §FB-10.
- **Decision**: AI-read receipts must carry the same fields a manual expense has. The Worker `/ocr` + `parseReceiptResponse` extract **date**, **merchant/place**, and a **per-item category mapped to our taxonomy** (`EXPENSE_CATEGORY_KEYS`, fallback `guessCategory`); `commitReceipt` sets `category` + place fields (via `placeToTransactionFields`, gated by `locationCaptureEnabled`) + the **receipt date**. Receipt review shows a collapsed "Detalhes (IA preencheu)" block (category/location/date) editable via the existing `ExpenseEditor`/`PlaceField`. **A photo taken inside the AI becomes 1 summarized expense by default** (with an optional "abrir itens" to the receipt flow); "Dividir conta" keeps the N-item flow.
- **Rationale**: history must be uniform; missing fields make AI expenses second-class.
- **Alternatives**: leave receipts without location/date (rejected — the field gap was the complaint).

### DEC-259 — Inline "add participant" everywhere (no forced trip to Settings)
- **Date**: 2026-06-22
- **Status**: ✅ APPROVED (ratified). Plan: §C4, FB-06/FB-24.
- **Decision**: replace the `no_participants_hint` ("go to Mais → Participantes") with an inline **"+ Adicionar quem participou"** button. Extract a reusable `AddParticipantSheet` (overlay that never unmounts the current screen → no lost form state) with two paths: "type a name" (creates a local participant on the spot, idempotent) and "connected friends" (existing list). Mount it in `QuickAddPage`, the receipt flow, and the AssistantSheet clarify.
- **Rationale**: forcing a Settings trip mid-registration kills the split (the most social feature) and loses typed data.
- **Alternatives**: just a better deep-link (rejected — still loses state).

### DEC-260 — FAB closes on the back button (native + web) via overlay-dismiss
- **Date**: 2026-06-22
- **Status**: ✅ APPROVED. Plan: §FB-07.
- **Decision**: register the open `FABMenu`'s `onClose` in the `overlay-dismiss` LIFO registry (same pattern as `BottomSheet`), so the native back button (`initBackButton` → `dismissTopOverlay()`) closes it; on web/PWA, wire `popstate` on the home route to call `dismissTopOverlay()` before re-seeding history. No-overlay back stays normal.
- **Rationale**: an open overlay must intercept back; the FAB was the one overlay not registered.

### DEC-261 — Cofrinho becomes a BUFFER (consumes savings on a day-overshoot before cutting future days)
- **Date**: 2026-06-22
- **Status**: ✅ APPROVED (Julio's explicit v2 decision) — **amendment to the savings mechanic (ÂNCORA 11)**; implementation pending. Plan: §C13, FB-08.
- **Decision**: Option A (unify the "saved money" story on the cofrinho) **+** make the cofrinho an automatic **cushion**: when a day exceeds its allowance, the excess is **debited from the cofrinho first**; only when the cofrinho hits 0 does the **future daily allowance** get cut. Model (still a **pure derivation**, nothing stored mutable): `cofrinho = max(0, idealToDate − spentToDate)`; the displayed free/day stays at `baseDailyIdeal` while `cofrinho > 0` (an overshoot shows as the cofrinho going down, not the daily dropping), and reverts to `(phaseBudget − spentToDate)/daysRemaining` once `cofrinho = 0`. The "não vou gastar hoje" check-in shows the cofrinho **rising**. No double counting (a no-spend day lowers `spentToDate`, which raises the cofrinho by the same amount).
- **Rationale**: "guardei esse dinheiro" must have one tangible place (the cofrinho); a steady daily that a buffer protects matches the user's mental model better than silent re-averaging.
- **Risk note**: this changes how "free per day" reacts to overspend (budget-engine change, not just UI) → needs a dedicated math mini-spec + strong tests (under-pace, single overshoot covered by cofrinho, cofrinho depleted, no-date phase) and the anti-double-count invariant.
- **Alternatives**: Option B (keep carry-forward, only reword copy) — rejected by Julio (less satisfying, doesn't make the cofrinho real).
- **Refinement**: **DEC-279 / council C14** revisits the calculation model (the truthful ledger needs a day-ordered running balance, "Model B") and adds legibility (voice + statement + movement insight). Model A (trophy, end-clamped, no daily effect) vs Model B (buffer ledger) is **pending Julio** — see §5.3 of the field-feedback plan.

### DEC-262 — Home occasion carousel counts a receipt/outing as ONE occasion (not per item)
- **Date**: 2026-06-22
- **Status**: ✅ APPROVED. Plan: §FB-14.
- **Decision**: the activity counters in `occasion-counters.ts` count **distinct sessions as 1** (mirroring the planned counters' DEC-115 "a session counts once"), so a 40-item receipt is "1", not "Outros · 40". Loose expenses still count 1 each; financial aggregations are untouched (ÂNCORA 9 — only the card's count/geometry).
- **Rationale**: receipt line-items (each an `other` tx) inflate "Outros" and uglify the home.

### DEC-263 — Outing setup is context-aware + standard layout padding + "finish & discard"
- **Date**: 2026-06-22
- **Status**: ✅ APPROVED (ratified — trim, not full redesign). Plan: §C3, FB-15/FB-16/FB-23.
- **Decision**: keep the live outing (it's a differentiator); fix the screen to use the **standard padding container**; make the setup questions **data-driven by `EventContext`** (e.g. "avg drink price" only for bar/night, not "mercado"; `deriveSessionLimits` covers the rest); audit all `avgDrinkPriceCents` reads to be null-safe outside bar; add a **"Finalizar e descartar"** action on the active session (soft-delete session+items, distinct from "Finalizar" which saves).
- **Rationale**: the setup asking bar questions everywhere felt disconnected; users want to discard a mis-started outing.
- **Alternatives**: full outing redesign (deferred — only if the audit finds deep "outing = bar" coupling).

### DEC-264 — Amigo Sincero: phrase bank by band × voice + end-of-carousel discovery reveal
- **Date**: 2026-06-22
- **Status**: ✅ APPROVED (+ selectable voices + reveal). **Final voice list ratified: `padrao` / `zen` / `durao` / `economico` (default `padrao`).** Plan: §C6, FB-12.
- **Decision**: replace the single `phase_progress` template (one phrase for the whole 0–100%+ range) with a `honest-friend-voice.ts` mapping **bands** (`under_easy`/`under_ok`/`tight`/`edge`/`broke`/`reserve`) **× voice** to i18n keys (4–6 phrases/band × 3 languages), picked by band + a stable daily index — the tone always matches the number (never "segura" at 100%+). Add a **voice selector in Settings** (default / zen / durão / econômico). Add an **end-of-carousel discovery card**: pulling **past the real end** reveals "Quer mudar o tom? → Configurações"; the **auto-rotation never shows it** (gesture-only easter egg).
- **Rationale**: one phrase for all percentages reads wrong at 100%; users want variety + control over tone.

### DEC-265 — Location capture default ON (explicit amendment to ÂNCORA 8; 1-tap opt-out; no GPS read without OS permission)
- **Date**: 2026-06-22
- **Status**: ✅ APPROVED (ratified — privacy amendment accepted). Plan: §C5(a), FB-03.
- **Decision**: change the `locationCaptureEnabled` seed default to **true**, with: (1) **no GPS read without the OS permission** (still on-demand); (2) a transparent first-run notice ("Registro de local: Ligado — você desliga quando quiser nas Configurações"); (3) **this is a recorded amendment to ÂNCORA 8** — the default went ON by product decision, keeping 1-tap opt-out and no silent GPS. Existing users keep their current choice; telemetry stays coordinate-free.
- **Rationale**: location-based insights were under-used because the feature shipped OFF; opt-out with transparency balances privacy and value.
- **Alternatives**: keep default OFF (rejected by Julio); silent GPS read (rejected — privacy violation).

### DEC-266 — Auto device name when blank (platform + browser, never raw model)
- **Date**: 2026-06-22
- **Status**: ✅ APPROVED. Plan: §C5(b), FB-05.
- **Decision**: a pure `suggestDeviceName()` (platform + browser family, e.g. "Android · Chrome", "iPhone · Safari", "PC · Edge"; native: "Android"/"iPhone") used as the field **placeholder** and as the **effective value when left blank**; never overwrites a typed name or a backup-restored name; never the raw model (unreliable/ugly on the web).
- **Rationale**: kills the repeated "Meu dispositivo" in connections/admin without exposing a technical model string.

### DEC-267 — Delete an event from its edit screen, ASKING what to do with its expenses
- **Date**: 2026-06-22
- **Status**: ✅ APPROVED (changed from "expenses stay" to **ask the user**). Plan: §FB-11.
- **Decision**: add a "Excluir evento" action on the event edit screen (`/trip/edit?occurrence=`) with a confirmation that **counts the linked expenses** and offers **"Apagar tudo"** (event + expenses, soft-delete) vs **"Manter os gastos"** (soft-delete the occurrence, unlink and keep the expenses). Available from every point where the event is edited.
- **Rationale**: deletion was hidden in one place; silently keeping or deleting expenses is wrong — the user must choose.
- **Alternatives**: always keep / always delete (rejected by Julio — "perguntar para o user na hora").

### DEC-268 — Admin: AI tokens per function (and run counts) in the user detail
- **Date**: 2026-06-22
- **Status**: ✅ APPROVED. Plan: §FB-17.
- **Decision**: the install detail modal shows tokens **and** call counts **per function** (`SELECT fn, SUM(tokens), SUM(runs) FROM ai_usage WHERE install_id=? GROUP BY fn`), reusing `ai_usage` (no ingest change); the sum matches the total already shown.

### DEC-269 — Admin: Groq token governance — server-side real-time (rate-limit headers + minute/day/month rollups + projection/bottleneck)
- **Date**: 2026-06-22
- **Status**: ✅ APPROVED (confirmed server-side, no heartbeat dependency). Plan: §C8, FB-18.
- **Decision**: the Worker (the single Groq proxy) persists the latest snapshot of the Groq response headers (`x-ratelimit-limit/remaining/reset-{requests,tokens}`, `retry-after`) per model/function → **real quota now**; admin "IA — governança Groq" shows usage by **day** + **month** + **minute** (true, timestamped server-side), **% of limit** with the **bottleneck** highlighted (TPM usually binds first), and a **projection** ("avg tokens/active user/day × DAU → how many active users fit before TPD/RPD", noting TPM/RPM may bind earlier). Free-tier limits verified 2026-06-22 (~30 RPM, 6,000 TPM, RPD 1,000–14,400/model).
- **Rationale**: we proxy every call, so token accounting is fully server-side and real-time; projections must show all three ceilings, not a single number.
- **Final round (Julio)**: the Admin must **actively signal** when usage starts approaching a ceiling (RPD/TPM/TPD) — a visible alert/threshold, not just charts — so we can then evaluate a **2nd key/organization or a paid upgrade as a business decision**. This signal also feeds the 429 counter (FB-26/DEC-276).

### DEC-270 — The "00000000" install: investigate & name before dropping (no "lost" spend)
- **Date**: 2026-06-22
- **Status**: ✅ APPROVED (changed from "just drop" to investigate-first). Plan: §FB-19.
- **Decision**: the all-zeros `00000000-0000-0000-0000-000000000000` is emitted by no real client (`getInstallationId` = uuidv4). **Phase 1 — observe:** route its requests to a labeled "Sistema/desconhecido" bucket with context (UA, function, time, app version) to identify the origin (deploy probe / scanner / old client) — no data deleted yet. **Phase 2 — once identified:** if our probe → give it a clearly-labeled "system" id excluded from user metrics; if external abuse → reject the sentinel in `recordAiUsage`/ingest. **Phase 3:** then clean/reallocate history out of the user ranking, preserving the total in the Sistema bucket (no token "disappears" from accounting).
- **Rationale**: Julio — it may be real spend we don't account for; understand it before hiding it.

### DEC-271 — Telemetry platform distinguishes PWA (standalone) + browser family
- **Date**: 2026-06-22
- **Status**: ✅ APPROVED. Plan: §FB-20, FB-21.
- **Decision**: refine the telemetry platform tag using `isStandaloneDisplayMode()` → `android-pwa`/`ios-pwa` when standalone, `android-web`/`ios-web` in a tab, native stays `android`/`ios`; also capture the **browser family** (coarse, e.g. "Chrome"/"Safari") + app version. Admin "Plataformas" distribution + the user detail show e.g. "Android · Chrome · PWA · v0.99.39". **Coarse granularity only — never the exact model/serial, no monetary data** (privacy).
- **Rationale**: distinguishing Android web/iOS web/PWA/native matters for debugging; coarse device info aids support without fingerprinting.

### DEC-272 — Admin: per-user recent errors in the detail + centered/2-column modal on desktop
- **Date**: 2026-06-22
- **Status**: ✅ APPROVED. Plan: §C7, FB-21/FB-22.
- **Decision**: (a) the user detail lists that install's **recent errors** (reusing the existing server-side scrub, capped to N); (b) the modal is **centered in the viewport** at all sizes (not bottom-anchored) with internal scroll, and on desktop distributes in **2 columns** (counters/flags | tokens/errors/platform). No new data displayed beyond what telemetry holds; coarse granularity.
- **Rationale**: errors tied to a user + device/browser/version make debugging real; the modal opened bottom-fixed on mobile and wasted desktop space.

### DEC-273 — Release notes + "Tudo o que dá para fazer" guide brought up to date
- **Date**: 2026-06-22
- **Status**: ✅ APPROVED. Plan: §FB-01, FB-02.
- **Decision**: audit DEC↔release-note coverage (DEC-240..255+) and **add** user-facing release-note items (3 languages) for shipped-but-undocumented features (multi-trip, Dia a dia, AI Quick Entry, Trip Wrapped, Dividir conta, Acerto de contas/connections, new icon, onboarding identity); fix `brain/README.md` "Last updated". Update `GUIDE_SECTIONS` to include every first-class feature (each route must exist — the guide route test guards it). Additive only; no rewriting of published history.

### DEC-274 — Planner/pre-fill: opening a screen never writes; Dia-a-dia guards; no negative balance from missing config
- **Date**: 2026-06-22
- **Status**: ✅ APPROVED. Plan: §C9, FB-25.
- **Decision**: **opening the planner must not create or pre-fill plans** (separate ephemeral "suggestions" from explicitly-saved plans); date-coupled planning/pre-fill surfaces are hidden behind a centralized capability gate when `kind==='ongoing'`; with no config, show an empty state ("set income/limit") instead of a **negative** number. Smoke: opening any planning screen in an `ongoing` space = zero writes, no crash, no absurd number.
- **Rationale**: Julio — entering the planner auto-added plans and went negative in Dia a dia; opening a screen must never write.

### DEC-275 — Single image-capture pattern (take photo / gallery chooser) everywhere
- **Date**: 2026-06-22
- **Status**: ✅ APPROVED (new). Plan: §CC-IMG.
- **Decision**: every image entry shows a **chooser** ("Tirar foto agora" `capture="environment"` vs "Escolher da galeria"), **extracting the existing validated pattern** from `AttachmentSection` (DEC-206) into a reusable component/hook (`ImageSourceChooser`/`usePickImage`) and applying it to the receipt scan, the new AI photo (DEC-257), and any future image entry. Preserve the synchronous user gesture (iOS camera permission).
- **Rationale**: Julio — "todo lugar de entrada de imagem, tem que ter duas opções: enviar imagem ou capturar com a câmera." One pattern, no second implementation.

### DEC-276 — Graceful AI degradation when the Groq free tier is exhausted
- **Date**: 2026-06-22
- **Status**: ✅ APPROVED (new). Plan: §C10, FB-26.
- **Decision**: on a Groq 429 (or `x-ratelimit-remaining-*` ≈ 0), the Worker returns a structured body `{ aiUnavailable: true, retryAfterSec, scope: 'minute'|'day' }` derived from `retry-after`/`x-ratelimit-reset-*` (for assistant/ocr/transcribe); the client sets an `aiCooldownUntil`, disables AI triggers, and shows a warm message with a **real countdown** (`scope:'minute'` → "tente em ~{n}s") or "volta mais tarde" (`scope:'day'`), **without revealing billing** — always offering a 1-tap **"Registrar manualmente"** that opens `/quick-add` **preserving the typed/spoken input**. Admin logs the 429 count (upgrade signal). Never a fake countdown.
- **Rationale**: the free tier runs out; turn the failure into a predictable wait + immediate manual path, never a dead AI or a lost expense.

### DEC-277 — Record a received repayment (Pix/Wise/cash/transfer) in the split
- **Date**: 2026-06-22
- **Status**: ✅ APPROVED (new). **Final round: structured method field** (not free-text) + registration must be **accessible without breaking the flow**. Plan: §FB-27.
- **Decision**: in "Acerto de contas", add a **"Registrar pagamento recebido"** action that creates a `Settlement` (debtor = who paid, creditor = me, `amountCents`, `settledAt`) with a **structured** `method?: PaymentMethodKind` (pix/wise/bank/cash/other) added to the `Settlement` type (optional, backward-compatible), reducing that person's owed balance; reuses `settlement-repository`/`reimbursement-bridge` + the DEC-244 payment-method selector; inline sheet that keeps the user in the hub (no flow break). Supports partial repayments. No new type (rides on the existing `Settlement`); the Wise→settlement dedupe (DEC-200) is preserved.
- **Rationale**: the user pays the whole bill and others repay via Pix/Wise/cash — the app must close the loop (we already list HOW to pay back via DEC-244).

### DEC-278 — In-app AI help/concierge — comprehensive V1 (local search, 0 token); AI fallback only in V2 behind a token budget
- **Date**: 2026-06-22
- **Status**: ✅ APPROVED (new; V1 "bem completo"). Plan: §C11, FB-28.
- **Decision**: **V1 = no AI, 0 token** — a **comprehensive** help KB (`domain/help/help-catalog.ts`) covering **every** feature + common doubts (Q&A + steps + deep-link + search tags, 3 languages), with local keyword/synonym search over the KB **and** the guide catalog (DEC-273/FB-02), a first-class "Ajuda / Como funciona" entry, and answers that link to the screen. **V2 (later, conditional)** = AI fallback only when local search misses, with **minimal context** (2–3 KB snippets), forbidden to invent beyond the context, behind a **token-budget gate** (tied to DEC-269/DEC-276). **Never** send the whole brain. The concierge must never degrade the core AI (registration).
- **Rationale**: Julio — users should get all doubts answered; but reading lots of text per question could blow the free tier and kill the core AI, so local-first (0 token) delivers ~80% of the value safely.

### DEC-279 — Cofrinho legibility: voice + statement (ledger) + movement insight; pick calculation model (B recommended)
- **Date**: 2026-06-22
- **Status**: ✅ APPROVED — **Julio ratified Model B** (2026-06-22 final round). Refines DEC-261. Implementation pending (Gate 2). Plan: §C14, FB-08.
- **Context**: the cofrinho today is an opaque derived number (`max(0, idealToDate − spentToDate)`) with no voice and no statement; Julio (and users) can't tell what it is, where the money came from, or why it moved. He asked the council whether the buffer dynamic is even right and to make it legible.
- **Decision (direction)**: give the cofrinho three legibility layers — **(1) voice**: a short explainer on the card + a full entry in the help KB (FB-28/DEC-278), showing *effective = base + cofrinho* side by side (rollover best practice); **(2) statement/ledger**: tapping the card/insight opens an Activity-Timeline of **+deposits** (a day under the daily ideal) and **−withdrawals** (a day over, linked to the causing expenses), including **partial coverage**, with a running balance; **(3) movement insight**: a new `piggy_movement` extra in `honest-friend-extras.ts` (shown only when the balance changed), Amigo-Sincero tone, deep-linking to the statement. Card is **on-demand** (check-in `no_spend`/`calm` + recent movement), **not pinned** by default (user may pin via existing toggle). Ongoing/no-date trips hide the cofrinho.
- **Calculation model (RATIFIED = Model B)**: a truthful statement needs a **day-ordered running balance** (`bal_d = max(0, bal_{d-1} + dailyIdeal − daySpend)`), derived purely by replaying immutable transactions in date order in a dedicated `domain/budget/piggy-ledger.ts` (no mutable balance stored; recalculates forward on edits, like FreeBudget rollover). **Model B** is the only one that makes the statement reconcile **and** implements the DEC-261 buffer honestly — **Julio chose B**. **Model A** (current end-clamped, read-only trophy, no daily effect) is kept only as a documented safety-net fallback if a usability test later shows the path-dependent buffer confuses. The statement/insight UI works in both models.
- **Invariant (non-negotiable, Critic)**: `statement balance == displayed balance == the buffer the free/day respects` — no cent double-counted or lost. Strong tests incl. "dip-and-recover".
- **Anchor (ÂNCORA 11)**: amendment — the **per-day** reading reflects the buffer; `calculateFreeToSpend` total stays byte-identical and the derivation stays pure (nothing mutable persisted).
- **Research grounding (verified 2026-06-22)**: YNAB "Roll With the Punches" (seeing money leave savings to cover an overshoot is what makes budgeting click); FreeBudget/FinWise rollover (never modifies originals, recalculates forward, show planned+rollover+effective + icon/tooltip); audit-trail "Activity Timeline" pattern.
- **Rationale**: the cofrinho's value is **behavioral** (a visible save→grow / overshoot→withdraw loop), not just a number; without voice + statement + felt movement it's an opaque trophy that appears and vanishes.

### DEC-280 — Single-session delivery protocol: deploy + context-reset per gate (council C15)
- **Date**: 2026-06-22
- **Status**: ✅ APPROVED (Julio)
- **Context**: gates are being implemented in ONE continuous chat session (cost model = per request, not per token). Julio asked whether the accumulating context degrades quality across gates and whether the gates should be **reordered** (heavy-first while context is fresh, light-last).
- **Decision**: **keep the current gate order**; the lever is the ritual between gates, not the order. The order already front-loads quick-wins (G1) → the **heaviest-logic gate (G2: cofrinho ledger) while context is freshest** → mediums; respects the only hard dependency (CC-IMG/G4 → Nota-IA/G5); groups the worker-touching gates (G5/G7); and each gate is a coherent, shippable surface for phone testing. **Mandatory per-gate ritual**: (1) gate-scoped tests (the gate + impacted areas, not the whole suite every time) + `build`/`tsc` + 3-screen smoke green; (2) **deploy to Cloudflare Pages (web/OTA)** — bump `public/version.json` (the `package.json`/`APP_VERSION` bump does NOT update the OTA manifest — caught at 0.99.39) + scoped commit + push `master` → auto-build runs `build:pages`; verify `/version.json` + `/bundles/<v>.zip`; (3) **Context Reset in-session (0 extra request)**; (4) refresh: re-read master plan §4 of the next gate + `dev-log.md` Current State + rules; (5) mid-gate refresh every 3 milestones, and the heaviest gate's **math sub-gate is locked by invariant tests before any UI**.
- **Test policy**: not the entire suite every time, but **every test the gate touches + impacted areas must be green before deploy**.
- **Rationale**: bounding the context **per gate** (reset + durable spec in dev-log/plan) preserves quality better than any static ordering, and shipping each completed gate lets Julio test on his phone immediately.
- **Plan ref**: §4.1 (C15) of `documents/field-feedback-master-plan-and-councils-2026-06-22.md`.

---

### DEC-283 — Cost-benefit comparator (price per kg/L/unit) — V1 shipped
- **Date**: 2026-06-22
- **Status**: ✅ APPROVED (Julio) — V1 IMPLEMENTED
- **Id note**: the stale header pointer said "next = DEC-281", but **DEC-281/DEC-282 were consumed by Gate 3** (FB-16 conditional drink-price + FB-23 discard outing, shipped in 0.99.42 — see `dev-log.md` + `OutingPage.tsx`/`outing.ts`). The next genuinely free id was therefore **DEC-283**.
- **Context**: Julio asked the council whether a "comparador de custo-benefício" (which package is cheaper *per unit* — e.g. 120 g for €1 vs 200 g for €2, or "5 × 20 g vs 1 × 100 g") fits TripPilot, who it serves, and where it lives. The "Dia a dia" mode (DEC-250) makes grocery-shelf comparison a real, recurring need; it is also useful mid-trip. Council study: `documents/cost-benefit-comparator-council-2026-06-22.md`.
- **Decision**: ship it as the **twin of the currency converter (DEC-256)** — a PURE, deterministic, **0-token, offline** mini-tool. V1 is **lean & deterministic**: text + voice + manual entry, no photo/OCR (photo is V2, conditioned on real demand — mirrors the converter's staged rollout and the Critic's anti-scope-creep stance).
- **Scope (V1, what shipped)**:
  - **Pure domain** `domain/shopping/unit-price.ts` — `resolveUnit` / `normalizeQuantity` / `compareUnitPrice`. Normalizes to a dimension base unit (weight=g, volume=ml, count=unit), ranks by price-per-base-unit, reports the friendly per-kg/L/unit figure, the % the best beats the worst, a 3% **tie** band, and an honest **mixed-dimensions** flag (it refuses to compare weight vs units instead of lying). 20 unit tests.
  - **Mini-screen** `/comparator` (`features/comparator/ComparatorPage.tsx`), mode-agnostic (outside ModeGuard, like `/converter`). 2–6 item rows (price + quantity + unit), live verdict, best-buy highlight.
  - **AI intent** `compare_unit_price` (inform action; never creates an expense). New typed `AiIntent.comparisonItems` (untrusted-coerced); `plan.ts` navigates to `/comparator?items=<json>`; worker prompt taught with a rule + example.
  - **Discovery**: FAB chip (group *plan*), feature-guide entry, help-center article — all 3 languages (pt-BR/en/es).
- **Out of scope (V2, deferred)**: photo/OCR of shelf labels; %-composition ("X% de cacau") comparison; saving/history of comparisons.
- **Rationale**: reuses the converter's proven shape (pure core + dedicated page + inform-intent), adds zero recurring cost/risk, and turns a universal market pain into a daily hook for "Dia a dia". Honesty-first math (tie band + mixed-dimension refusal) keeps it trustworthy.
- **Refs**: study `documents/cost-benefit-comparator-council-2026-06-22.md`; precedent DEC-256 (converter), DEC-250 ("Dia a dia").

---

### DEC-284 — Comparator V2: multi-image photo extraction (DEC-283's deferred photo path)
- **Date**: 2026-06-22
- **Status**: ✅ APPROVED (Julio) — IMPLEMENTED (0.99.50)
- **Context**: DEC-283 deferred photo/OCR to V2 "conditioned on real demand". Julio asked to ship it now, with a twist: **send several shelf photos at once**, read each one, then compare them together — the natural in-store flow (snap 2–3 tags, get the verdict).
- **Decision**: reuse the existing cloud-vision pipeline (DEC-206 receipt OCR) — **one product per image**, several images sent as **parallel** calls — and feed the readings into the V1 comparator engine (DEC-283). No new model, no new statefulness, graceful degradation identical to OCR.
- **Scope (what shipped)**:
  - **Worker** `POST /unit-extract` — stateless proxy to Groq vision with a tight prompt returning `{price, quantity, unit, label, currency, confidence}` for ONE product. Same vision model, same size guard (`OCR_MAX_IMAGE_CHARS`), same stable error statuses (503/429/4xx) and `recordAiUsage` accounting bucket as `/ocr`.
  - **Pure domain** `domain/shopping/unit-extract.ts` — `parseUnitExtractResponse` normalizes one raw reading: validates numbers, resolves the unit to the picker set (rare mg/cl converted to g/ml so quantity stays consistent), clamps confidence, and sets `needsReview` when price/quantity/unit is missing or confidence < 0.6. 12 unit tests.
  - **Client transport** `utils/ai-unit-extract.ts` — mirrors `ai-ocr.ts`; never throws (typed `not_configured | rate_limited | offline | failed`), so N photos can `Promise.all` independently.
  - **UI** `ComparatorPage` — "Adicionar por foto" hero entry → source sheet (camera = one tag at a time; gallery = **multiple**). Each photo becomes a row; existing typed rows are kept, scanned rows fill the remaining slots up to 6. Live progress ("Lendo X de Y…"), per-row amber **"confira"** review badge + ring on uncertain/failed reads (cleared on any manual edit), a soft review hint, and a hard error line only when NOTHING could be read. i18n in all 3 languages.
- **FAB reorg (same request)**: the comparator no longer occupies a visible chip — promoted **"Registrar mercado"** back into the visible "smart tools" row (a daily-life capture, especially in "Dia a dia"), and moved the comparator into the collapsed **"Mais ações"** group (still one tap; ÂNCORA 9 — hide, never delete). Group relabeled "Outros registros" → "Mais ações".
- **Honesty (Critic)**: the model can misread a tag, so a photo read is NEVER trusted silently — every uncertain/failed field is flagged for human confirmation before the verdict is believed. The engine still refuses mixed-dimension comparisons (DEC-283).
- **Refs**: plan `documents/comparator-v2-multi-image-plan-2026-06-22.md`; precedents DEC-206 (vision OCR), DEC-283 (comparator V1), DEC-256 (converter), DEC-275 (image source chooser).

---

## UI/UX pass (2026-06-24) — DEC-285→294

> Source of execution: `documents/2026-06-24-ui-ux-implementation-orchestrator.md` (§7) + scope `documents/ui-ux-change-checklist-2026-06-23.md`. The §16 questions were answered & locked by Julio (2026-06-24); the gate order was ratified by **Council C5** (single-session). All councils ran **inline (1 request, no subagents)** — only the synthesis is recorded. These ship as **PROPOSED** and graduate to APPROVED as each gate deploys.

### DEC-285 — Global visible keyboard focus (M01)
- **Date**: 2026-06-24
- **Status**: APPROVED — implemented G1, shipped 0.99.51 (2026-06-24)
- **Decision**: add **one** global `:focus-visible` rule in `globals.css` (ring built from `--glow`/`--primary`, theme-aware). Keyboard/tab navigation shows a visible ring on buttons/links/inputs in both themes; **touch is unchanged** (pointer focus does not draw the ring).
- **Rationale**: WCAG 2.4.7 (F78) — the app strips native outlines (`outline-none` utility spread across inputs) with **no** `:focus-visible` substitute. Cheapest, most global a11y win; tokens already exist (`--glow`).
- **Refines**: audit A-1 / §3.3 / N1. **Gate G1.**

### DEC-286 — AA contrast: faint token, white CTA, error (M02)
- **Date**: 2026-06-24
- **Status**: APPROVED — implemented G1, shipped 0.99.51 (2026-06-24)
- **Decision**: raise `--on-surface-faint` alpha to ≈`80` (from `70`, ~3.79:1 → ≥4.5:1); the **primary CTA uses pure white text** over `--primary` (a `.btn-primary` helper / `text-white`), NOT a darkened token; nudge `--error` to clear AA.
- **Rationale (Council C2, `/debate`)**: cream-on-terracotta = 3.46:1 (< AA). Darkening `--primary` globally has a high blast radius (icons, `.nav-ind`, rings, badges) and risks the light theme; white-on-CTA is surgical, reversible, and fixes the contrast exactly where the text-on-button problem is (white on #C75B39 ≈ 4.7:1). A darker terracotta, if wanted, is a separate aesthetic item.
- **Refines**: audit A-2 / D-3 / G-1; answers §16-Q2 (white CTA). **Gate G1.**

### DEC-287 — Tokenize the AI accent (M12)
- **Date**: 2026-06-24
- **Status**: APPROVED — implemented G1, shipped 0.99.51 (2026-06-24)
- **Decision**: introduce `--ai` / `--ai-2` (+ `--ai-gradient`) in `tokens.css` for both themes; replace the hard-coded indigo/violet (`#6366F1`/`#818CF8`/`#8B5CF6` + gradient) in the 9 files that use it; document in the design system ("terracotta = brand; indigo = AI").
- **Rationale**: a second accent family exists, hard-coded and undocumented (heuristic #4), with light-theme risk (it does not inherit). Tokenizing makes the meaning predictable and theme-safe.
- **Refines**: audit A-4 / E / N3 / G-2. **Gate G1.**
- **Implementation**: `--ai`/`--ai-2`/`--ai-strong`/`--ai-gradient` (+ `--ai-bg-soft`/`--ai-bg`/`--ai-border`/`--ai-glow`) added to `tokens.css` for both themes; all 9 files repointed (grep verifies **0** literal `#6366F1/#818CF8/#8B5CF6` outside `tokens.css` + the hygiene test). **Doc note (re-verification 2026-06-24):** the code shipped in G1/0.99.51 but the design-system documentation was missing; the "document in the design system" clause is now satisfied — `design-system.md` gained an **AI Accent** subsection (terracotta = brand, indigo = AI) and the "NEVER use AI palette" color rule was corrected to sanction the scoped `--ai` family; the stale `--on-surface-faint`/`--error` palette rows were synced to the M02 values. Doc-only change, no deploy.

### DEC-288 — Consolidate /viagem × /trip (M15)
- **Date**: 2026-06-24
- **Status**: APPROVED — implemented G2, shipped 0.99.52 (2026-06-24)
- **Decision**: one map (`/viagem` = `TripHubPage`) + one editor (`/trip/edit`). The share card (the only exclusive content of `TripOverviewPage`) moves to the **Viagem hub header**; `/trip` → `<Navigate to="/viagem" replace/>`; the "Visão geral" tile is removed from the Hub; Dashboard (phase-name link + `phase_countdown` insight) and Planner are repointed; `trip.overview_*` i18n retired/relocated; `TripOverviewPage.tsx` deleted **after** the share card is migrated.
- **Rationale**: the two "viagem" surfaces overlap (heuristic #4 / "which screen is the trip?"). The migration plan (checklist Appendix) makes the G/High-risk change an M controlled by a proven redirect.
- **Refines**: DEC-249 (multi-trip IA); audit C-5 / G7 / V-2; Julio approved 2026-06-24. **Gate G2.**
- **Implementation**: share button in `TripHubPage` header (renderShareCard + deliverShareCard, migrated verbatim); `/trip`→`/viagem` redirect in `router.tsx`; `navigate('/trip')` repointed in Dashboard/Planner/TripEdit; `overview` entry removed from guide-catalog & help-catalog (viagem keywords enriched); 18 `overview_*` i18n keys removed across pt-BR/en/es; `TripOverviewPage.tsx` deleted + boot-recovery guard cases dropped; e2e redirect test added. Commits `e77dbb2` (feat) + `d8c053a` (release).

### DEC-289 — Tap glossary (M05)
- **Date**: 2026-06-24
- **Status**: APPROVED — implemented G4, shipped 0.99.54 (2026-06-24)
- **Decision**: a single data-driven registry `domain/help/glossary.ts` (term → short gloss → help slug) + a tappable `<InfoDot>` on each money concept's first appearance; deep-links into `/help` (DEC-278). Domain stays i18n-free (copy lives in the locale files); no term may be orphaned (every gloss maps to a real help article).
- **Rationale**: vocabulary density is the recurring weak point (heuristics #2/#8); inline glosses are scattered. The help center exists — this adds the contextual hook into it.
- **Refines**: audit B-4 / V-1 / G1; precedent DEC-278 (help center). **Gate G4.**
- **Implementation**: `GLOSSARY` registry (`free_to_spend`→funds, `protected_reserve`→funds, `plan_reserve`→planner) with `glossaryTermKey`/`glossaryGlossKey`/`glossaryHelpRoute`; `components/InfoDot.tsx` (tappable ⓘ, `stopPropagation`, opens a `BottomSheet` with the gloss + "Saiba mais na Ajuda" → `/help?a=<id>`); `HelpPage` reads `?a=` to open the article expanded. Wired at first appearance: SimpleHome headline eyebrow + the hero breakdown sheet rows (total/protected/plan), terms aligned with the existing `fts_*` labels. i18n `glossary.*` pt-BR/en/es. Tests: unit `glossary` (6, incl. no-orphan + i18n ×3) + component `info-dot` (3). Commit `8ae98a9`.

### DEC-290 — Multi-space onboarding on the Welcome (M-Onb)
- **Date**: 2026-06-24
- **Status**: APPROVED — implemented G3, shipped 0.99.53 (2026-06-24)
- **Decision**: the Welcome offers **two primary choices** — "Criar viagem" (→ `/onboarding`, current flow) and "Começar no Dia a dia" (a `kind:'ongoing'` first-run reusing the `NewSpacePage` path: `createOnboardingEntities` + `createTripFromOnboarding`, finalizing like onboarding: `onboardingCompleted` + `appMode` + `activeTrip`). Import-backup / receive-from-device / demo are **demoted to a secondary tier on the Welcome itself** (NOT Settings — pre-onboarding has no Settings), nothing removed (Â9). Includes M20 (legible demo button) + M23 (value line).
- **Rationale (answers §16-Q4)**: the app is already multi-space (several trips + several "Dia a dia" — DEC-249/250/251) and the fork already exists in `NewSpacePage`; the first screen should match that and ask trip-vs-daily up front, instead of only creating a trip behind four equal-weight doors. Corrects the §16-Q4 "move to Settings" premise (no Settings yet at first run).
- **Refines**: DEC-249/250/251 (multi-space, Dia a dia); audit C-1/W-1/W-2. **Gate G3.**
- **Implementation**: rather than a separate daily screen, `OnboardingPage` gained `?kind=ongoing` so the day-to-day reuses the **same** flow — shared identity step + mode chooser + atomic create + finalize — with one day-to-day step (name + optional monthly cap, no end date) replacing the trip steps; nothing required beyond identity. Pure domain `buildOngoingOnboardingInput` + `ONGOING_SEED_PHASE_DAYS` (mirrors NewSpacePage's bounded ~1-month seed phase, stamps `kind:'ongoing'`). `WelcomePage` redesigned: 2 primary `PrimaryChoice` cards + a demoted "já tenho dados" tier (import/receive as light ghost rows) + a legible primary-colored demo link (M20) + a value line (M23). i18n pt-BR/en/es. Tests: unit `ongoing-onboarding` (4) + e2e (create daily from Welcome; all five entries persist, Â9). Commits `618a044` (feat) + `caaefa3` (release).

### DEC-291 — Make the honest-friend voice actually sound like one (M16b)
- **Date**: 2026-06-24
- **Status**: APPROVED — implemented G5, shipped 0.99.55 (2026-06-24)
- **Decision**: rewrite the strings in `domain/budget/honest-friend-voice.ts` (+ `-extras.ts`) so they read like a real candid friend, and make the **tone choice change the text** — gentle / honest / blunt must be clearly distinct (blunt is more direct). Voice/content only, not density.
- **Rationale (Council C4, answers §16-Q6)**: Julio reports the tones feel the same and "blunt doesn't bite". This is a voice problem (cheap, high emotional return), separate from card density (M16, which stays DEPOIS).
- **Refines**: audit C-6 / G3 (split out from M16). **Gate G5.**
- **Implementation**: rewrote the **entire `amigo_voice` bank** (4 voices × 3 bands × 2 lines) in pt-BR/en/es so each voice is unmistakable — zen genuinely gentle, durão genuinely blunt, padrão warm-and-straight, econômico reserve-framed; verdict logic untouched (the voice only flavors the lead line). Tests `honest-friend-voice`: for the same band+index the 4 voices yield 4 distinct lines in every locale, and no line repeats within a voice (coverage extended pt-BR→all 3 locales). Commit `c5e7632`.

### DEC-292 — Light closing recap (M17-lite)
- **Date**: 2026-06-24
- **Status**: APPROVED — implemented G5, shipped 0.99.55 (2026-06-24)
- **Decision**: build a **minimal closing recap** reusing `OutingReviewPage` / existing data when an outing/day closes — a low-risk seed. The full "o fim que dá orgulho" closing screen stays **post-validation** (kit §15/D; build only if emotion-check avg ≥4).
- **Rationale (Council C3, `/assess`, answers §16-Q5)**: Peak-End is high emotional value but the least-validated bet; a recap reusing existing surfaces gives a taste at ~0 risk without committing the largest block of the pass to an unvalidated screen.
- **Refines**: study EXP-4 / Peak-End. **Gate G5.**
- **Implementation**: pure `domain/outing/outing-recap.ts` `buildOutingRecap()` → `{totalCents,itemCount,durationMin,targetCents,vsTargetCents,outcome:under|on|over|no_target}` (+ `recapHeadlineKey`, `formatRecapDuration`) as the single source for the recap figures (the existing `SessionReview` chips now read from it; the duplicated local duration formatter was removed). `ClosingRecapSheet.tsx` shows an outcome-tuned headline + final total + duration/rounds/vs-target chips on close, with "Ver resumo completo" → `/outings/:id/review` (reuses the read-only `OutingReviewPage`; **no new heavy screen**). Wired in `OutingPage.handleConfirmEnd` (recap replaces the bare toast; dashboard on dismiss; expense recording never blocked, Â9). Tests `outing-recap` (11). Commit `a740043`.

### DEC-293 — Dashboard top as an alert carousel (M03/M10)
- **Date**: 2026-06-24
- **Status**: APPROVED — implemented G4, shipped 0.99.54 (2026-06-24)
- **Decision**: the top alerts/notices (demo banner, location notice, storage warning, etc.) **rotate in a single slot** (the pattern the Amigo Sincero already uses) instead of stacking — **nothing disappears** (Â9); one primary action per state; in demo, no fear banner; location/storage only on real risk; light header/hero polish.
- **Rationale (answers §16-Q9)**: the first glance stacks fear banners and pushes the hero number down. A carousel calms the open without removing any function (Julio: "talvez um carrossel de problemas?").
- **Refines**: audit B-1 / B-2 / D-1 / D-2. **Gate G4.**
- **Implementation**: pure selector `features/dashboard/home-alerts.ts` `selectHomeAlertIds({isDemo,storageAtRisk,locationNoticeActive})` — demo shows ONLY the calm notice (no fear banner), a real install orders storage-risk before the location notice. `HomeAlertsCarousel.tsx` reuses the snap+dots technique (reduced-motion aware); 1 active alert renders inline, 2+ become swipe+dots. `DashboardPage` renders one carousel in place of the 3 stacked blocks (storage warning also gated by `!isDemo`). Tests: unit `home-alerts` (5) + component `home-alerts-carousel` (3). Commit `c76c08e`. _Also in G4: M04 anchor free-today + ask-to-spend + M06 reassuring phase-zero (`d83ebe6`); M09 mode label on the chip (`627e583`)._

### DEC-294 — Split: always-legible balance + all-settled seal (M18)
- **Date**: 2026-06-24
- **Status**: APPROVED (shipped 0.99.57 via G7, 2026-06-24)
- **Decision**: build **both** — "você recebe €X / você deve €Y" always legible in the split/settlement flow, **and** the "tudo acertado ✓" seal exactly when the balance zeroes.
- **Rationale (answers §16-Q7)**: legibility is low-risk and clearly positive; the seal is cheap and marks the social "end" of the split positively (trust lives here).
- **Refines**: study §5.4 / §8 (latent need #4). **Gate G7.**
- **Implementation**: G7.1 legibility was already carried by DL-3's owner settle-up hero ("A receber/A pagar" + net line) and the per-person rows ("Deve/Recebe/Em dia") in `SharedExpensesPage` — kept intact and verified. G7.2 added a **pure** `resolveSettlementStanding(debts, sharedExpenseCount, settlementCount)` in `domain/splitting` returning `{hasActivity, outstandingCents, allSettled}`; `allSettled` is true ONLY after real splitting (a shared expense or a settlement exists) AND zero outstanding, so a fresh trip never shows a false seal and the seal appears exactly when the group balance zeros. The settle-up hero's even-state now renders a proud "Tudo acertado ✓" seal (`verified` icon, success tint) when `allSettled`, falling back to the neutral "Tudo em dia" otherwise. **Tests:** `settlement-standing` (6: seal only with activity+zero, not while outstanding, no false positive on a new trip, settlement-only activity, positive-debts-only sum, multi-debt outstanding total). +2 i18n keys (`shared.all_settled_title/_hint`) ×3 langs.

---

## Coherence & Tricount wave (2026-06-24) — DEC-295→305 (PROPOSED at G0)

> Execution truth: `brain/documents/2026-06-24-coherence-implementation-orchestrator.md` (gates G0→G8). Councils ran inline (1 request, no subagents) per `inline-council-no-subagents.mdc`. Registered PROPOSED at G0; flipped to APPROVED as each gate ships.

### DEC-295 — Gate order for the single-session Coherence wave (Council C-A)
- **Date**: 2026-06-24
- **Status**: APPROVED — executed end-to-end in this order G1→G8 in one continuous session (0.99.58→1.0.0-rc, 2026-06-24); no regression across gates.
- **Decision**: execute the 28-point briefing + Tricount as gates **G1 (global/cheap hygiene) → G2 (grouped reading) → G3 (actionable outing) → G4 (copilot/piggy coherence) → G5 (Amigo Sincero) → G6 (settlement/connected/share) → G7 (structure/polish/help) → G8 (Tricount, last)**.
- **Rationale**: minimize context drift and regression in a single continuous session; start global/low-risk to calibrate, then data clarity (biggest pain), then message coherence, then people/share, then polish/help, then the new big feature last on a stable base.
- **Refines**: orchestrator §7 C-A / §10. **Gate G0→G8.**

### DEC-296 — Outing×Item collapse semantics under filter (Council C-B / §16 Q2)
- **Date**: 2026-06-24
- **Status**: APPROVED — Coherence wave (Gate G2, shipped 0.99.59)
- **Decision**: summaries/filters/carousel/recents/map/patterns show the **outing** (1 entity); only **text search** itemizes. Under a category filter the collapsed row shows a **filtered subtotal** ("Mercado · N itens nesta categoria · €X") and tap opens the full outing (full total + all items). An item always references its parent outing.
- **Rationale**: the core pain is summaries "exploding" a receipt into loose items; collapse by `sessionId` among the transactions that match the filter is honest to the filter while keeping the outing as one entity.
- **Refines**: orchestrator §6 C01 / §7 C-B. **Gate G2.**

### DEC-297 — Tricount: new aggregate entity reusing share/claim/settlement (Council C-C / §16 Q4)
- **Date**: 2026-06-24
- **Status**: APPROVED — implemented G8 (m1→m6), shipped 1.0.0-rc (2026-06-24); `domain/group-split/*` aggregate + `/groups` UI + `/g/` claim board + AI/receipt prefill, reusing the `/share` transport/crypto/claim 100% (worker unchanged).
- **Decision**: build a **new aggregate entity** ("group-split event") that **reuses** the existing public link (`/t/`/`/s/`), `claim-response`, `mirrored-statement`, `settlement` and worker — instead of overloading the single-bill `Split`. Scope is **COMPLETE** (§16 Q3): manual expenses + **AI/receipt reading** + **equal AND custom** split.
- **Rationale**: single-bill split and a persistent multi-expense/multi-payer event have different mental models and life cycles; overloading the critical single-bill flow risks regression. Reuse transport/crypto/claim 100%; only the aggregate (event = list of expenses + participants) is new.
- **Red team**: "two similar entities = debt" → mitigated by sharing transport/crypto/claim entirely; only the aggregate is new.
- **Refines**: orchestrator §6 C23 / §7 C-C. **Gate G8.**

### DEC-298 — Simple-mode bottom nav layout 2+2 (Council C-D / §16 Q1)
- **Date**: 2026-06-24
- **Status**: APPROVED — implemented G7, shipped 0.99.64 (2026-06-24); `simpleOnly` flag in `visibleInMode` + `/settings` in `RIGHT_NAV`.
- **Decision**: simple-mode bottom nav is **2+2 symmetric** — Início, Gastos · (+) · Viagem, **Ajustes** (Settings takes the slot the hidden Copilot leaves, beginner-safe). Data-driven via `visibleInMode`.
- **Rationale**: removing Copilot in simple mode leaves a 2-1 layout; symmetry matters more than keeping a specific item. Julio locked 2+2.
- **Refines**: orchestrator §6 C06 / §7 C-D. **Gate G7.**

### DEC-299 — Bar color policy: red only on real risk (C12 / §16 Q5)
- **Date**: 2026-06-24
- **Status**: APPROVED — implemented G1, shipped 0.99.58 (2026-06-24); pure `resolveProgressTone` + hero bar tone.
- **Decision**: normal progress = neutral/positive (`--success`/`--steady`/`--surface`); `--error` only when money is out / over limit / into reserve / critical phase. Tokenized, inherits in light theme.
- **Rationale**: terracotta `--primary` reads as alert in gradients; being near the end of a phase is not a problem. Red must mean a real problem.
- **Refines**: orchestrator §6 C12. **Gate G1.**

### DEC-300 — Piggy fixed in Copilot + simulated/will-be-saved/saved states (C09/C10 / §16 Q7)
- **Date**: 2026-06-24
- **Status**: APPROVED — implemented G4, shipped 0.99.61 (2026-06-24); fixed piggy section in `CopilotPage` (reuses `piggy-ledger`/`PiggyStatementSheet`) + `piggy_states_hint` (simulated / will be saved / already saved).
- **Decision**: a **fixed piggy section** in the Copilot (reusing `PiggyStatementSheet`/`piggy-ledger`), and explicit copy **simulated / will be saved at close / already saved** everywhere the piggy is touched (check-in, card, statement). Never say "the piggy now has X" before it actually entered.
- **Rationale**: Model B (DEC-279/261) keeps the balance derived (closed days only); simulation is a forecast. The fix is UI clarity, not math.
- **Refines**: orchestrator §6 C09/C10. **Gate G4.**

### DEC-301 — Amigo Sincero contextual CTA per slide (C07 / §16 Q6)
- **Date**: 2026-06-24
- **Status**: APPROVED — implemented G5, shipped 0.99.62 (2026-06-24); pure `resolveAmigoSlideCtas` (per-slide CTA, hide when no useful action) + `filterHomeAmigoExtras` (home de-dupe by topic vs the insights carousel).
- **Decision**: the Amigo Sincero CTA is a **function of the active slide** (`safeIndex`): verdict→impact; `top_category`→category impact; `piggy_movement`→piggy; `daily_left`→simulate; no useful action → **hide the button**. On the home, show only when actionable/new (no insight duplication).
- **Rationale**: a fixed "Ver impacto" button on every slide reads as a dead/fake affordance. The `piggy_movement` slide already has its own CTA — generalize that precedent.
- **Refines**: orchestrator §6 C07/C08. **Gate G5.**

### DEC-302 — Actionable outing detail + item→outing back-link (C02)
- **Date**: 2026-06-24
- **Status**: APPROVED — Coherence wave (Gate G3, shipped 0.99.60)
- **Decision**: the outing detail gains edit (name/date), view/edit **split** and **payer**, **personal cost**, **items** (each item → `ExpenseDetailPage`), **settlement status**. The item gains a "parte de · [outing]" back-link. **No new entity** (reuses Session/Transaction).
- **Rationale**: `OutingReviewPage` is read-only (DEC-079); opening an outing and "not being able to do almost anything" is a top pain. Reuse `ExpenseDetailPage` edit patterns.
- **Refines**: orchestrator §6 C02. **Gate G3.**

### DEC-303 — Universal share feedback (C05)
- **Date**: 2026-06-24
- **Status**: APPROVED — implemented G6, shipped 0.99.63 (2026-06-24); pure `shareOutcomeToast` (shared/downloaded/failed visible, aborted silent) routed through `TripWrappedSheet` + `TripHubPage`.
- **Decision**: every share action gives visible feedback (toast on shared/downloaded/failed), mirroring `TripOverviewPage`'s correct handling; ensure the canvas is not tainted; on desktop, a silent download gets a visible notice.
- **Rationale**: `TripWrappedSheet.handleShare` only toasts on `failed`; on desktop the silent download reads as "nothing happens".
- **Refines**: orchestrator §6 C05. **Gate G6.**

### DEC-304 — State dictionary (the app's "same language")
- **Date**: 2026-06-24
- **Status**: APPROVED — finalized G8, shipped 1.0.0-rc (2026-06-24). **Advanced at G4 (0.99.61):** first concrete reconciliation via pure `classifyBudgetSignal` — the Planner's allocation red and the Copilot's verdict now say whether a red is a *real problem* or just a *plan adjustment* (`real_over` is the only red-worthy case). **Advanced at G6 (0.99.63):** pure `resolveShareStage` gives the settle-up screen a consistent share lifecycle label (pending → confirmed → paid → rejected; green-solid only when paid). **Finalized at G8:** the Tricount payment lifecycle (unpaid → marked[amber] → confirmed[green], never red) and the worded Copilot pattern reads (good/watch/neutral, G7/C20) close the dictionary across the wave.
- **Decision**: real / planned / allocated / free / piggy / simulated / saved / outing / item / settlement have a **consistent label and color** across the whole app (see orchestrator appendix). Every alert explains: what happened · why it matters · what to do · whether it's a real problem or just a plan adjustment. Red = real problem.
- **Rationale**: one screen says "you're in control" while another shows red without explaining the difference; the app must speak one language.
- **Refines**: orchestrator §3 / appendix. **Cross-gate.**

### DEC-305 — Neutral, very subtle input focus (C25, addendum 2026-06-24)
- **Date**: 2026-06-24
- **Status**: APPROVED — implemented G1, shipped 0.99.58 (2026-06-24); `input/textarea/select/[contenteditable]:focus-visible` neutral ring, no `--primary`/`--glow`.
- **Decision**: for `input/textarea/select/[contenteditable]`, replace the global orange focus ring (`outline: 2px solid var(--primary)` + `--glow`, from DEC-285) with a **minimal, neutral, very subtle** focus — no orange, no glow; e.g. a slight neutral `border-color` lift **or** a thin 1–2px ring in `--border-subtle`. Keep the minimum perceptible by keyboard (WCAG 2.4.7 / DEC-285 preserved). Buttons/links/cards keep the current ring.
- **Rationale**: Julio: the orange ring is ugly on text fields (`:focus-visible` fires on mouse click too); make it the most subtle possible without removing it entirely.
- **Refines**: DEC-285 / orchestrator §6 C25. **Gate G1.**

### DEC-306 — Tricount ↔ trip settle-up: contained read-only bridge (C23/m6)
- **Date**: 2026-06-24
- **Status**: APPROVED — implemented G8/m6, shipped 1.0.0-rc (2026-06-24); pure `groupSplitToDebts`/`groupSplitsToTripDebts` → read-only "Em divisões de grupo" section on `SharedExpensesPage` + trip-people quick-add (linked) in `GroupSplitDetailPage`. Decided via inline council (assess; Architect/Risk dominant).
- **Decision**: a group split "enters the trip settle-up" through a **pure bridge** `groupSplitToDebts(event) → DebtEntry[]` (trip-participant space; only participants with `linkedParticipantId`; the debtor's transfer is dropped once their group `paymentStatus === 'confirmed'`; only when the group currency == the trip base). It is surfaced **read-only** in `SharedExpensesPage` (a contained "Em divisões de grupo" section: receivable/payable via the reused `summarizeOwnerDebts`/`suggestSimplifiedSettlements`, deep-linking each trip-linked group). The settle ACTION stays in the group (mark→confirm, m5) — the single source of truth for a group debt. The trip ledger (`calculateDebts`/`Transaction`/`ParticipantShare`/`Settlement` write path) is **never** mutated (no phantom transactions, no cross-source settlement). To make non-owner debts real, the owner can add **trip participants (linked)** to a trip-scoped group.
- **Rationale**: the trip settle-up is a mutable money graph consumed by 5 surfaces; merging group debts into its write path at the end of a long wave risks a trip settlement silently clearing a group debt (and vice-versa). The contained bridge satisfies the AC ("entra nos acertos" = visible; "pagamento atualiza o acerto" = confirming in-group drops it) with one source of truth per debt, no migration, fully reversible, and leaves the formal seam for a future unified-settlement wave.
- **Refines**: orchestrator §6 C23 / DEC-297, §10 G8/m6. **Gate G8.**

---

## Discovery & Clarity wave (2026-06-25) — DEC-307→319 (§16 lock WAIVED — adopted; APPROVED per gate)

> Source: `brain/documents/2026-06-25-discovery-clarity-implementation-orchestrator.md` (change-set D01→D15, councils
> C-A→C-J, gates G0→G6). DEC-307→316 came from the 10 inline councils on the briefing's open questions (§16); DEC-317→319 are
> direct decisions (clear briefing directives). **Julio waived the §16 lock (2026-06-25) and adopted the council recommendations
> as the execution path**; each DEC is promoted to **APPROVED** by the gate that ships it (G1: 317/318 · G2: 319 · G3: 307/308/309/310/311 · G4: 312/313/316 · G5: 314/315).

### DEC-307 — Discovery entry: one discreet home-header hub (D02 / §16 Q1)
- **Date**: 2026-06-25 · **Status**: APPROVED (G3, 1.1.0-rc)
- **Decision**: expose discovery via ONE discreet entry in the home header (chip/icon near notifications/settings) opening a **unified discovery hub** = search-by-intent + the feature guide + the help center, on one screen. The Settings entries for guide/help stay (ÂNCORA 9).
- **Rationale**: guide/help live hidden in Settings today; a single memorable "what can I do?" door beats three scattered entries, and a header icon (not a card) doesn't compete with the anchor number.
- **Refines**: orchestrator §6 D02 / §7 C-A. **Gate G3.**

### DEC-308 — Function search by intent, local (no new AI) (D02 / §16 Q2)
- **Date**: 2026-06-25 · **Status**: APPROVED (G3, 1.1.0-rc)
- **Decision**: V1 of the "intelligent function finder" reuses the existing local, 0-token `searchHelp` (multilingual synonyms) over guide+help, extending keywords to **intent phrases** ("quero dividir um valor…" → Divisão em grupo). The intent glossary is the same screen in browse mode. No new AI in V1 (the existing assistant can route free text to the hub as a future fallback).
- **Rationale**: a local matcher already resolves natural-language doubts offline at zero recurring cost; promising real AI search is scope/cost the V1 doesn't need.
- **Refines**: orchestrator §6 D02 / §7 C-B. **Gate G3.**

### DEC-309 — Unify the "Dividir" ENTRY, not the code (D03 / §16 Q3)
- **Date**: 2026-06-25 · **Status**: APPROVED (G3, 1.1.0-rc) — implemented as a pure chooser; "Valor em grupo" routes `/groups?new=1` (auto-opens create) since `/groups/new` is not a router path.
- **Decision**: a single "Dividir" action opens a chooser "Como você quer dividir?" → **Por itens da conta** (`/split/scan`) × **Valor em grupo** (`/groups`), each explained. The two underlying entities/flows (single-bill split vs group-split, DEC-297) stay **fully separate in code**. The fine call (pure chooser vs chooser + a direct "Por itens" shortcut for the common bar case) is left to implementation/§16.
- **Rationale**: the confusion is mental-model, not code; merging the bill-split (proven on two devices) into group-split would risk a critical flow. Unify the door, keep the rooms.
- **Refines**: orchestrator §6 D03 / §7 C-C. **Gate G3.**

### DEC-310 — Group split visibility via the FAB "Dividir" (D04 / §16 Q4)
- **Date**: 2026-06-25 · **Status**: APPROVED (G3, 1.1.0-rc)
- **Decision**: the FAB carries "Dividir" (the chooser) paired with "Iniciar saída", replacing the current standalone "Dividir conta"; group split becomes reachable in one level, and is also added to the guide (people) and the discovery hub.
- **Rationale**: `/groups` is currently only reachable via Acerto de contas — far too hidden for a Tricount-like, widely used feature.
- **Refines**: orchestrator §6 D04 / §7 C-D. **Gate G3.**

### DEC-311 — "Registrar mercado" out of the FAB first tier (mode-aware) (D08 / §16 Q5)
- **Date**: 2026-06-25 · **Status**: APPROVED (G3, 1.1.0-rc) — mode-aware resolves the conflict: hidden under "Mais ações" in trip mode, promoted to the visible tier in day-to-day mode (honors Julio's 2026-06-22 promotion).
- **Decision**: move "Registrar mercado" to "Mais ações" in **trip mode** (freeing the visible row for "Dividir"); keep it visible in **day-to-day mode** (it's a daily-life capture there).
- **Rationale**: the briefing rates market less used than group split/cost-benefit, but Julio just promoted it — so make it mode-aware and confirm with him.
- **Refines**: orchestrator §6 D08 / §7 C-E. **Gate G3.**

### DEC-312 — Official cofrinho rule = the implemented Model B (D12 / §16 Q6)
- **Date**: 2026-06-25 · **Status**: APPROVED (G4, 1.1.1-rc) — rule documented in `product-spec.md` §30; the plain-language copy surfaces in the cofrinho statement, the check-in destination and the hero "De onde vem?" sheet. Math untouched (`buildPiggyLedger` tests stay green, Â11).
- **Decision**: formalize the cofrinho rule exactly as the user described it (briefing #12) — it **already is** the implemented behavior (`buildPiggyLedger`, Model B, DEC-279/261): spending under the day's ideal deposits into the piggy; spending over it withdraws from the piggy first (next days unaffected); only what the piggy can't cover (`uncovered`) cuts the following days. **Document + explain in UI; do NOT change the math** (ÂNCORA 11).
- **Rationale**: the central doubt is resolved by code reading — the math is correct; the gap is clarity, not logic.
- **Refines**: orchestrator §6 D12 / §7 C-F. **Gate G4.**

### DEC-313 — One destination for the day's saving (D11/D14 / §16 Q7)
- **Date**: 2026-06-25 · **Status**: APPROVED (G4, 1.1.1-rc) — pure `resolveSavingDestination` picks one (piggy when active, else next days); the check-in renders a single "Destino da economia de hoje" block and the duplicate cofrinho lens caption was removed.
- **Decision**: the day's saving has ONE shown destination — when the cofrinho is active (dated phase) it goes to the **cofrinho** (the piggy then protects future days; do not also say "+X/day to next days"); when there's no cofrinho, it dilutes into the next days. Never both at once.
- **Rationale**: per Model B, under-spending deposits into the piggy (not a separate "next days" bucket); showing both is the double-count the briefing flags (#14).
- **Refines**: orchestrator §6 D11/D14 / §7 C-G. **Gate G4.**

### DEC-314 — Phase-scoped pots hidden off-phase, still selectable (D15 / §16 Q8)
- **Date**: 2026-06-25 · **Status**: APPROVED (G5, 2026-06-25)
- **Decision**: the current phase's home shows in focus only pots linked to the active phase (or global); pots of other phases go into a secondary collapsed **"Potes de outras fases"** and stay **selectable** when logging an expense (reuse `selectActivePhasePool`/scope). The `BudgetPoolScope linked_phases` already exists.
- **Rationale**: a future pot ("Hospedagens Eurotrip") must not pollute the current phase (Burgos) yet must accept expenses now (payments can start early).
- **Implementation (G5)**: pure `selectOtherPhasePots` (complement of `selectVisiblePots` among dated global pots) in `domain/budget/pots.ts`; `useDashboardModel` exposes `otherPhasePotSummaries`; `DashboardCards` renders a collapsed `OtherPhasePotsSection` (`[data-other-phase-pots]`). Selectability is unchanged (`getAvailablePoolsForPhase` lists every global pot) and now locked by test. The pot math is untouched (ÂNCORA 11).
- **Refines**: orchestrator §6 D15 / §7 C-H. **Gate G5.**

### DEC-315 — Creation separates Event (dated) from Pot/Fund (phase) (D15 / §16 Q9)
- **Date**: 2026-06-25 · **Status**: APPROVED (G5, 2026-06-25)
- **Decision**: the creation flow explicitly asks **"Event"** (a date, countdown, reserve distributed across the event's days — `OccasionCounter`/`allowance-map`) vs **"Pot/Fund"** (linked to a phase/period, no countdown, accepts entries anytime — pool/envelope). A pot never becomes an event nor shows "faltam X dias".
- **Rationale**: creating a "pot with a date" currently looks like creating an event; the two concepts must be chosen explicitly.
- **Implementation (G5)**: the single `PlanExpenseSheet` "Planejar um gasto" door already forks on Q1 (has a date → Event; no date → Pote/Fundo). G5 sharpens the Q1 copy and adds a `[data-plan-kind-note]` line that states the no-countdown rule for a pote; the routing already guarantees a standalone pote carries `dateStart = null` (no countdown is ever possible), now pinned by an explicit Event×Pote regression test.
- **Refines**: orchestrator §6 D15 / §7 C-I. **Gate G5.**

### DEC-316 — Keep "Posso gastar", compact (D10 / §16 Q10)
- **Date**: 2026-06-25 · **Status**: APPROVED (G4, 1.1.1-rc) — `AskToSpendShortcut` is now a discreet inline pill below "free today" instead of a full-width card; the action (simulator prefill) is unchanged.
- **Decision**: keep "Posso gastar um valor" (DEC-289/M04) but compact it into a **discreet chip** below "Livre hoje" (the natural next question after the anchor number); don't remove it. Alternative: move to the FAB/hub.
- **Rationale**: useful and recently added (Julio's), but it shouldn't take a large card on the home — a chip preserves access without clutter.
- **Refines**: orchestrator §6 D10 / §7 C-J. **Gate G4.**

### DEC-317 — Amigo Sincero = voice only; factual extras become insights (D06)
- **Date**: 2026-06-25 · **Status**: APPROVED (shipped 1.0.2-rc, G1) — direct decision (clear briefing directive).
- **Decision**: the Amigo Sincero carousel contains **only opinionated, personality-driven phrases**; the factual extras (`piggy_movement`, `phase_progress`, `daily_left`, `top_category`, `receivable`) leave the card and become **insights** in the insights carousel (no duplication). AC: "no common insight appears inside Amigo Sincero".
- **Rationale**: the card mixes objective data with the honest-friend voice; the briefing wants a clean separation (insight ≠ opinion). Refines DEC-301 (per-slide CTA) — the factual slides no longer exist in the Amigo.
- **Refines**: orchestrator §6 D06. **Gate G1.**

### DEC-318 — Close the FAB on any context switch (D09)
- **Date**: 2026-06-25 · **Status**: APPROVED (shipped 1.0.2-rc, G1) — direct decision.
- **Decision**: `isFabOpen` closes on any route change (tab/card/screen) and on outside tap — `useEffect(() => setIsFabOpen(false), [location.pathname])` in `BottomNav` + closing on the tab/center onClick. No exception.
- **Rationale**: today the nav sits at `z-[60]` above the FAB scrim, so tapping a tab navigates while the FAB stays open, covering the new screen (reads as a bug).
- **Refines**: orchestrator §6 D09. **Gate G1.**

### DEC-319 — Wave versioning + permanent help-coverage policy
- **Date**: 2026-06-25 · **Status**: APPROVED (G2, 1.0.3-rc) — the `guide ⊆ help ⊆ router` coverage test is now hardened with a curated FIRST_CLASS_ROUTES contract; the patch-per-gate cadence continues across the wave.
- **Decision**: bump a **patch per gate** (1.0.2-rc → 1.0.6-rc); **1.1.0-rc** as the milestone when the discovery hub (G3) ships. **Permanent policy:** every new first-class feature must enter the `guide-catalog` AND the `help-catalog` in the same wave, guarded by the `guide ⊆ help ⊆ router` coverage test.
- **Rationale**: the discovery hub is a new capability (minor bump); keeping guide/help in lockstep with features is what made them drift (the root of D01).
- **Refines**: orchestrator §5 / §10 / §14. **Cross-gate.**

---

*New decisions will be added as the project progresses.*
