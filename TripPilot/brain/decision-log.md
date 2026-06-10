# TripPilot — Decision Log

> Last updated: 2026-06-10

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

---

*New decisions will be added as the project progresses.*
