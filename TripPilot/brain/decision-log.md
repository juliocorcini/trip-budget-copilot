# TripPilot — Decision Log

> Last updated: 2026-06-14 (v0.14.5 — UX Polish Pass: dashboard density, QuickAdd sticky bar, settings groups, nav consistency; DEC-162..165)

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
- **Status**: APPROVED
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
- **Status**: APPROVED
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
- **Status**: APPROVED
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
- **Status**: APPROVED (Julio R3 audio review)
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
- **Status**: APPROVED
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
- **Status**: APPROVED
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

*New decisions will be added as the project progresses.*
