# TripPilot — Master Specification: Delivery 1

> Version: 1.0 | Date: 2026-06-08
> Purpose: Single reference document for any implementation agent building Delivery 1.
> Status: All product decisions finalized (60 decisions). Design system approved. Pre-implementation Q&A complete.

---

## 1. Product Overview

### What Is TripPilot?

A travel budget copilot that helps users make spending decisions **in real-time** during trips. Not just an expense tracker — it answers: **"Can I spend this right now without hurting the rest of my trip?"**

### Core Problem

Existing financial apps look backward ("you spent €42 yesterday"). TripPilot looks forward: "You already spent €28 tonight. One more €7 drink still fits the safe ceiling. After that, stop."

### Target Users

| Segment | Need |
|---------|------|
| Travelers staying with family/friends | Mixed zero-spend and outing days, irregular patterns |
| Budget-conscious multi-phase travelers | Shared money pools across non-consecutive trip phases |
| Groups sharing expenses | Tricount replacement with budget intelligence |
| "How many bar nights left?" users | Real-time occasion-based forecasting |

### Platform

Progressive Web App (PWA), mobile-first, offline-capable, local-first data storage (DEC-002, DEC-004).

---

## 2. Delivery 1 Scope

### What's IN Scope

| Area | What D1 Delivers |
|------|-------------------|
| **Project Setup** | React + TypeScript + Vite + Tailwind CSS + React Router v7 + react-i18next + Zustand |
| **Database** | IndexedDB via Dexie — full schema with migrations, sync metadata on all entities |
| **Core Entities** | Trip, Phase, BudgetPool (with scope field), BudgetPoolPhaseLink, Envelope (protected_reserve + allocation) |
| **Participants** | Name + nickname; schema prepared for future email/linkedUserAccountId (DEC-056) |
| **Wallets** | Create, edit, default wallet, optional selection, "Carteira não informada" tracking (DEC-051) |
| **Expense Registration** | Quick-add with optional wallet, categories, fund selection |
| **Dashboard** | "Livre para usar" hero, fund balance breakdown, protected reserve, future floor, personal shopping card, recent expenses, FAB menu. **Engine-dependent cards HIDDEN** (DEC-055) |
| **"Planejar" Tab** | Basic editor: phases, funds, protected reserve, future floor, personal shopping, initial activity profiles (DEC-055) |
| **JSON Backup** | Export + Import with merge, replace, conflict resolution, pre-import summary |
| **CSV Export** | 17 basic fields + 6 advanced optional fields (DEC-058) |
| **Welcome Screen** | Create trip (minimal onboarding) / Import backup / Load demo data |
| **Demo Data** | Complete fictional trip per DEC-038 |
| **Design System** | Mobile-first responsive layout with full token system, dark-first theme |
| **i18n** | pt-BR strings via react-i18next; en/es empty structures prepared (DEC-054) |
| **Testing** | Vitest (domain logic), RTL (critical UI), Playwright (main flows) — from D1 (DEC-054) |
| **Settings** | Alert tone, default wallet, vibration toggle, backup reminder, theme, language, device name (DEC-057) |
| **"Mais" Tab** | Sectioned list: Viagem, Dados, Aplicativo (DEC-059) |

### What's NOT in D1 (Exists in Later Deliveries)

| Feature | Delivery | Why Deferred |
|---------|----------|--------------|
| Shared expense splitting (who paid, who participated) | D2 | Requires split engine |
| ParticipantShare with equal/custom split | D2 | Depends on split engine |
| Debt tracking and settlement | D2 | Depends on split engine |
| Cash withdrawal as wallet transfer | D2 | Financial flow complexity |
| Cash spending tracking | D2 | Depends on wallet transfer |
| Occasion-based forecasting engine | D3 | Requires learning engine + data |
| Scenario Planner with [-]/[+] controls | D3 | Requires forecast engine |
| Simulator ("Can I Spend?") | D3 | Requires simulation engine |
| Future phase reserve auto-calculation | D3 | Requires forecast engine |
| Trade-off suggestions | D3 | Requires scenario engine |
| Outing Mode (active sessions) | D4 | Requires session + alert engines |
| Progressive alerts during outings | D4 | Requires alert engine |
| "Next drink impact" calculation | D4 | Requires forecast + session engines |
| PWA manifest, service worker, offline cache | D5 | Polish phase |
| Persistent storage, safe updates | D5 | Polish phase |
| PWA shortcuts | D5 | Polish phase |
| Cloudflare Pages deployment | D5 | Polish phase |
| Light mode theme | D5 | Dark mode is primary |
| Capacitor / Android APK | D6 | Post-MVP native layer |
| Local notifications | D6 | Requires native layer |

### Dashboard Cards: Hidden Until Engines Exist (DEC-055)

These dashboard elements are designed but MUST NOT appear in D1 (no fake/placeholder data):

| Card | Requires | Delivery |
|------|----------|----------|
| Occasion counters ("4 bar nights left") | Forecast engine | D3 |
| Savings equivalence message | Forecast engine | D3 |
| Amigo Sincero card (with before/after) | Simulation engine | D3 |
| Active outing card | Session engine | D4 |
| Pending shared expenses card | Split engine | D2 |

### FAB Menu Actions in D1

| Action | D1 Status | Notes |
|--------|-----------|-------|
| Registrar gasto | **Active** | Core D1 feature |
| Começar saída | Hidden | Requires Outing Mode (D4) |
| Simular compra | Hidden | Requires Simulator (D3) |
| Registrar mercado | **Active** | Expense with market category pre-selected |
| Registrar transferência | Hidden | Requires wallet transfer engine (D2) |
| Registrar saque | Hidden | Requires cash withdrawal flow (D2) |

---

## 3. Core Rules

These 17 rules are non-negotiable and apply across all deliveries.

### Rule 1 — Occasion-Based Forecasting Is Primary (DEC-006)
Simple daily average is a **secondary indicator only**. The product's core value is occasion-based forecasting (bar nights, markets, outings — not "€X/day"). D1 does not implement the forecasting engine, but the data model and UI must prepare for it.

### Rule 2 — Financial Flow ≠ Personal Cost
Always track both separately. When 3 people split a €60 bar tab and Julio pays: financial flow = €60 from Julio's wallet; personal cost = €20 for Julio's budget. This distinction is fundamental to every expense entity.

### Rule 3 — Cash Withdrawal ≠ Expense (DEC-052)
Taking €50 from an ATM is a wallet transfer (bank → cash wallet), NOT an expense. It does not reduce the budget. This is implemented in D2 but the data model must support it from D1.

### Rule 4 — Debt Settlement ≠ New Expense
When Bruno pays Julio €20 he owes, it closes an existing obligation — it does NOT create a new €20 expense. Implemented in D2.

### Rule 5 — Protected Reserve ≠ Free Money (DEC-042)
The protected reserve is visible on the dashboard but NEVER suggested for casual spending. It is stored as an Envelope with `kind: "protected_reserve"` — single source of truth, never duplicated as a BudgetPool field.

### Rule 6 — Personal Shopping Never Silently Reduces Daily Budget (DEC-041)
Personal shopping (clothes, gifts, cosmetics) goes to a separate global BudgetPool with `scope: "global"`. It is an independent fund that does NOT reduce the main phase budget.

### Rule 7 — No Silent Preference Changes (DEC-015)
The app NEVER changes user preferences without showing impact and offering alternatives. Always show what happens, let the user decide.

### Rule 8 — Every Number Must Be Explainable
The user can tap any calculated value and see the breakdown. No magic numbers. If the dashboard says "Livre para usar: €412", the user can see: fund balance €760 − future reserve €248 − protected reserve €100 = €412.

### Rule 9 — The App Should Also Encourage Spending
"You saved enough for an extra bar night!" is as important as warnings. The app is a companion, not a nag. Positive reinforcement when the budget is healthy.

### Rule 10 — No Personal Data in Public Build (DEC-014)
The PWA starts empty. Demo uses fictional data only (DEC-038). Real data comes via private JSON import. Multiple people can share the same URL without seeing each other's data.

### Rule 11 — All Code in English
Variable names, function names, comments, error messages, type definitions — everything in code is English. User-facing text is Portuguese via i18n.

### Rule 12 — Mobile-First Design
Large buttons (min 44px touch targets), minimal forms, readable on small screens. Outing Mode quick-add buttons: 56px+ height. Design for one-handed use.

### Rule 13 — Never Block Registration (DEC-053)
Budget at zero, outing over maximum, phase boundary crossed → **warn, don't block**. Specific behaviors:
- **Budget at zero**: Show critical state (red), simulator classifies optional spending as "Evitar", allow continuation with confirmation.
- **Outing exceeds max**: Don't block; change to risk state, show direct message, require confirmation for new quick-adds (15-minute unlock to avoid repetition).
- **Session crosses phase boundary**: Don't auto-close; on manual close offer: keep in original phase / move to current / split by time.
- **First offline use**: Requires initial online load to cache service worker; show "Pronto para uso offline" only after confirmed caching.

### Rule 14 — Never Delete History Silently (DEC-046)
"Registrar total atual" creates a reconciliation adjustment, not a replacement. If user reports €35 total and existing items sum to €21: keep all items, create an "Ajuste para total informado" entry of +€14. If reported total < existing sum: warn of conflict, allow correcting items or creating negative adjustment with confirmation.

### Rule 15 — The App Is Generic (DEC-014)
No hardcoded references to Julio, Burgos, or any specific trip. All personal data comes via private JSON import. Demo data uses fictional names and places.

### Rule 16 — Wallet Selection Is Optional (DEC-051)
Missing wallet is marked as "Carteira não informada" for later review. Dashboard/wallet area shows: "Você possui N gastos sem carteira informada. Revisar agora". Expense list has filter "Somente gastos sem carteira". Default wallet pre-selects but can be cleared. No generic "Outra carteira" option.

### Rule 17 — Protected Reserve Single Source (DEC-042)
Protected reserve is stored as an Envelope with `kind: "protected_reserve"` inside the BudgetPool. Dashboard derives the display value from this envelope. NEVER store the reserve amount as a standalone field on BudgetPool.

---

## 4. Data Model Summary

> Full TypeScript interfaces are Jessica's responsibility. This section defines entities, purpose, and critical relationships only.

### Entity Overview

| Entity | Purpose | D1 Status |
|--------|---------|-----------|
| **Trip** | Top-level container. Name, dates, base currency | Active |
| **Phase** | Chronological period within a trip (e.g., "Burgos antes") | Active |
| **BudgetPool** | Financial fund. Has `scope`: "global" or "linked_phases" | Active |
| **BudgetPoolPhaseLink** | Links a BudgetPool to one or more Phases | Active |
| **Envelope** | Purpose allocation within a pool. Kinds: `protected_reserve`, `allocation` | Active |
| **Participant** | Person in shared expenses. Fields: name (required), nickname (optional) | Active |
| **Wallet** | Payment method: Wise, cash, credit card | Active |
| **Transaction** | Every financial event (expense, adjustment, future: transfer, settlement) | Active |
| **ActivityProfile** | Occasion type with cost estimates. Fields: typical value, safe value, confidence, optional frequency | Schema only in D1 |
| **ScenarioAllocationItem** | Aggregate planned quantity for a phase/pool (e.g., "4 bar nights") | Schema only in D1 |
| **PlannedOccurrence** | Specific committed event with optional date (e.g., "Valladolid outing, 10/07, €35") | Schema only in D1 |
| **Session** | Active outing tracking session | Schema only in D1 |
| **Settlement** | Debt settlement record | Schema only in D1 |
| **ParticipantShare** | Individual share in a shared expense | Schema only in D1 |
| **ForecastSnapshot** | Point-in-time forecast state | Schema only in D1 |
| **AlertRule** | Alert configuration per profile/session | Schema only in D1 |
| **AppSettings** | App-wide preferences (singleton) | Active |
| **ScenarioPlan** | Saved scenario configuration | Schema only in D1 |
| **FuturePhaseReservePolicy** | Reserve calculation policy for future phases | Schema only in D1 |
| **Device** | Device identification for backup metadata | Active |
| **Actor** | User identity (local actor in V1) | Active |

### Future Entities (Types Defined, Not Persisted)

UserAccount, Group, GroupMembership, SharedExpenseConfirmation — prepared for multi-user architecture (DEC-018).

### Key Relationships

```
Trip
 └── Phase (1:N, chronological periods)
       └── BudgetPoolPhaseLink (N:M with BudgetPool)

BudgetPool (scope: "global" | "linked_phases")
 ├── BudgetPoolPhaseLink → Phase (1:N, a pool can serve multiple non-consecutive phases)
 └── Envelope (1:N, kinds: protected_reserve, allocation)

Transaction
 ├── → BudgetPool (each expense points to exactly one pool)
 ├── → Wallet (optional — "Carteira não informada" if skipped)
 ├── → Session (optional — if registered during an outing)
 └── → Phase (the phase context of the expense)

Participant
 └── → ParticipantShare (per-transaction split, D2+)
```

### Critical Data Rules

| Rule | Details | Decision |
|------|---------|----------|
| **Cents-based money** | All monetary values stored as integer cents. €12.34 = 1234. No floating-point for financial calculations | DEC-020 |
| **Sync metadata** | Every entity has: `id` (UUID v4), `createdAt`, `updatedAt`, `deletedAt`, `revision`, `sourceDeviceId` | DEC-004 |
| **Soft delete** | `deletedAt` timestamp instead of hard delete. Required for merge-safe backup/import operations | DEC-004 |
| **Protected reserve source** | Stored ONLY as Envelope (kind: protected_reserve). Never duplicated on BudgetPool | DEC-042 |
| **Envelope kinds** | Only two kinds in V1: `protected_reserve` and `allocation`. "informational" removed from MVP | DEC-042 |
| **BudgetPool scope** | `"global"` = applies to entire trip (personal shopping, emergency). `"linked_phases"` = linked to specific phases via BudgetPoolPhaseLink | DEC-041 |
| **Phase without pool** | Allowed. When registering an expense in such a phase, require selecting an accessible pool or creating a new one | DEC-039 |
| **Multiple pools per phase** | Allowed. Each expense → exactly one pool. When only one operational pool exists, auto-select it | DEC-040 |
| **EUR-only initial** | V1 interface works with EUR only. Data model prepared for multi-currency | DEC-021 |
| **UUID v4 for IDs** | Globally unique, merge-safe across devices | DEC-003 |
| **Schema versioned** | Dexie migrations for IndexedDB schema changes. JSON backup includes schema version | DEC-004 |
| **ScenarioAllocationItem vs PlannedOccurrence** | Allocation = aggregate quantity ("4 bar nights"). Occurrence = specific committed event with optional date ("Valladolid outing, Jul 10, €35") | DEC-043 |
| **Profile cost model** | ActivityProfile stores: typical value, safe value, confidence, optional frequency. Three-limit (meta/teto/máx) is only for Outing Mode sessions | DEC-044 |

---

## 5. Screens & Navigation (D1 Only)

### Screen Inventory for D1

| # | Screen | Route | Layout | D1 Notes |
|---|--------|-------|--------|----------|
| 1 | Welcome | `/` | Centered, no nav | Create trip / Import backup / Load demo |
| 2 | Onboarding Wizard | `/onboarding` | Full-screen stepper | Minimal flow: trip name → phase → amount → dashboard |
| 3 | Phase Dashboard | `/dashboard` | App Shell (bottom nav) | Limited cards — only implemented features (DEC-055) |
| 4 | Trip Overview | `/trip` | App Shell | All phases, total budget, spending summary |
| 5 | Add Expense | `/quick-add` | Bottom Sheet | Quick form: amount, category, fund, optional wallet |
| 6 | Expense Detail | `/expenses/:id` | App Shell | View/edit single expense |
| 7 | Expense List | `/expenses` | App Shell | Filterable by phase, category, date, wallet |
| 8 | Wallets | `/wallets` | App Shell | Wallet list with balances |
| 9 | Settings | `/settings` | App Shell | Per DEC-057 |
| 10 | Backup & Data | `/settings/backup` | App Shell | JSON export/import, CSV export |
| 11 | Trip Editor | `/trip/edit` | App Shell | Edit trip, phases, budget pools, envelopes |
| 12 | "Mais" Menu | `/more` | App Shell | Sectioned list per DEC-059 |

### Screens That Exist in Design but NOT in D1

| Screen | Route | Delivery | Reason |
|--------|-------|----------|--------|
| Outing Mode (active) | `/outings/active` | D4 | Requires session engine |
| Start Outing | `/outings/new` | D4 | Requires session engine |
| Simulator | `/simulator` | D3 | Requires simulation engine |
| Scenario Planner (full) | `/planner` | D3 | Requires forecast engine |
| Shared Expenses | `/shared` | D2 | Requires split engine |
| Debt Settlement | `/shared/debts` | D2 | Requires split engine |
| Reports | `/reports` | D3+ | Requires data accumulation |

### Navigation Architecture (D1)

```
Bottom Navigation (persistent on App Shell screens):
├── Início (/dashboard)     — Phase Dashboard
├── Gastos (/expenses)      — Expense List
├── + (FAB)                 — Opens full-screen overlay menu
├── Planejar (/planner)     — Basic editor (D1 version per DEC-055)
└── Mais (/more)            — Sectioned settings/config list
```

### Bottom Navigation Details
- 5 items including central FAB button
- Glass effect: `--surface` at 90% + `backdrop-blur`
- Border-top: 1px `--on-surface` at 2%
- Active item: `--primary` color, FILL 1 icon, bold label
- Inactive: `--on-surface-faint`
- FAB: elevated -12px, rounded-2xl, `--primary` background with shadow

### FAB Quick Action Menu (DEC-027, DEC-034)
- Full-screen dark overlay (`--surface-deep` at 94%)
- Action items bottom-aligned near thumb zone
- FAB icon changes from `+` to `×` when open
- D1: only "Registrar gasto" and "Registrar mercado" active; others hidden until their delivery

### "Mais" Tab Structure (DEC-059)

| Section | Items |
|---------|-------|
| **Viagem** | Visão geral, Editar fases, Fundos, Perfis, Participantes e dívidas, Carteiras |
| **Dados** | Relatórios, Exportar para planilha, Backup e importação |
| **Aplicativo** | Configurações, Sobre |

Items that link to unimplemented screens show appropriate empty states or are hidden in D1.

### Trip Overview Navigation Logic (DEC-060)

| Condition | Behavior |
|-----------|----------|
| Single active phase | Open phase dashboard directly |
| No active phase | Open trip overview |
| Multiple active phases | Open trip overview with phase selection |
| Phase name tap in header | Navigate to trip overview |
| `/outings/active` with no active session | Redirect to `/outings/new` or show "Nenhuma saída ativa" (D4) |

### Screen States (All Screens)

Every screen must handle:
- **Empty**: First use, no data → guide to create/import with CTA
- **Loading**: Skeleton shimmer matching layout structure
- **Populated**: Normal data view
- **Error**: Clear message with recovery action
- **Offline indicator**: Subtle but visible (informational only — app works fully offline)

---

## 6. Onboarding Flow (D1)

### Welcome Screen Options

| Option | Action |
|--------|--------|
| **Criar viagem** | Starts minimal onboarding wizard |
| **Importar backup** | Opens file picker for JSON import |
| **Carregar demonstração** | Loads fictional demo trip |

### Minimal Required Fields (DEC-036)

The onboarding wizard requires ONLY:

1. **Trip name** (text)
2. **Phase name** (text)
3. **Start date** (date picker)
4. **End date** (date picker)
5. **Currency** (EUR fixed in V1, selector ready for future)
6. **Amount** (numeric — creates the first BudgetPool)
7. **Protected reserve** (optional numeric — creates Envelope if provided)

After these fields → user lands on the dashboard. Everything else is configured later.

### Profile Presets (DEC-037)

After the minimal wizard (or accessible from the Planejar tab later), the app suggests activity profiles with low-confidence initial estimates:

| Preset | Target User | Profiles Included |
|--------|-------------|-------------------|
| **Hospedado com família** | Staying with family, mixed days | Home day, Market, Bar, Restaurant, Outing |
| **Viagem urbana** | City tourism | Restaurant, Bar, Transport, Outing, Market |
| **Festival** | Music/culture events | Festival, Bar, Restaurant, Transport |
| **Personalizado** | Custom setup | User picks from full list |

- User can accept, edit values, remove profiles, or skip entirely
- Profiles are NOT required for the app to function
- Users can create custom profiles (e.g., "Café da manhã fora", "Lavanderia")
- Initial estimates are marked as low-confidence

### Demo Data Contents (DEC-038)

The demo includes a complete fictional trip to demonstrate all D1 features:

| Element | Content |
|---------|---------|
| Trip | 1 fictional trip with clear "Dados de demonstração" banner |
| Phases | 2 non-consecutive phases linked to the same pool |
| BudgetPools | 1 operational (linked_phases) + 1 personal shopping (global) |
| Participants | 3 fictional people |
| Wallets | 2 wallets |
| Expenses | 8–12 varied expenses |
| Shared expense | 1 shared market (for demonstrating the concept) |
| Cash withdrawal | 1 (shows wallet transfer, not expense) |
| Outing session | 1 completed bar session + 1 active demo session |
| Pending shared | 1 pending shared expense |
| Scenario | 1 scenario with trade-off recommendation |
| UI | "Dados de demonstração" banner + "Apagar e começar do zero" button |

---

## 7. Feature Specifications (D1 Only)

### 7.1 Expense Registration

**What it does**: Quick registration of any expense with minimal required fields.

**User flow**:
1. User taps FAB → "Registrar gasto" (or "Registrar mercado" for market shortcut)
2. Bottom sheet opens with form
3. Required: amount (numeric input)
4. Auto-selected: BudgetPool (if only one operational pool exists for current phase)
5. Optional: category, description, wallet, date/time override
6. User taps "Registrar" → expense saved → dashboard updates

**Business rules**:
- Amount stored in cents (DEC-020)
- If phase has no BudgetPool: prompt to select an accessible pool or create one (DEC-039)
- If phase has multiple pools: user must select (DEC-040). Auto-select only when one operational pool
- Wallet selection is optional. If skipped: save as "Carteira não informada" (DEC-051)
- Default wallet pre-selects but can be cleared (DEC-051)
- "Registrar mercado" = same form with market category pre-selected
- Never block registration even at zero budget — warn with confirmation (DEC-053)

**Edge cases**:
- Budget at zero: show critical state (red), allow with confirmation
- No BudgetPool on phase: require pool selection before saving
- Amount = 0: reject (validation error)

**What's NOT included yet**:
- Shared expense splitting (who paid, who participated) — D2
- Cash withdrawal tracking — D2
- "Registrar transferência" and "Registrar saque" — D2

### 7.2 Dashboard

**What it does**: Shows current financial status for the active phase. THE main screen.

**What D1 shows** (DEC-055, DEC-030):

| Element | Visual Priority | Details |
|---------|----------------|---------|
| **Phase info header** | — | Phase name (real name, e.g. "Burgos antes"), date range, action button |
| **"Livre para usar" hero** | Strongest | Primary number = fund balance − future reserve − protected reserve. Label: "Livre para usar até [data final da fase]" (DEC-023) |
| **Fund balance breakdown** | Secondary | Saldo restante do fundo: €X / Reservado para fases futuras: €X / Reserva protegida: €X / = Livre para usar: €X |
| **Personal shopping card** | Medium | Shows remaining amount in personal shopping global pool (DEC-041) |
| **Recent expenses** | Low-medium | Last few expenses with category, amount, time |
| **FAB button** | Persistent | Central `+` button for quick actions |
| **Empty states** | When applicable | Appropriate empty states with CTAs |

**Budget hierarchy rule (CRITICAL)**:
1. Hero number: "Livre para usar até [end date]" — the ONLY number that matters
2. Below: breakdown showing how the hero number is derived
3. NEVER show raw fund balance as the primary number without subtracting reserves

**What D1 does NOT show** (hidden, not placeholder):
- Occasion counters ("4 bar nights left")
- Savings equivalence message
- Amigo Sincero card
- Active outing card
- Pending shared expenses card

### 7.3 BudgetPool Management

**What it does**: Create and manage financial funds for the trip.

**User flow**:
1. During onboarding: first pool created automatically from the amount field
2. Post-onboarding: via Trip Editor or "Mais" → Fundos
3. Create pool: name, total amount, scope selection
4. Link pool to phases via BudgetPoolPhaseLink

**Business rules**:
- BudgetPool has `scope` field: `"global"` or `"linked_phases"` (DEC-041)
- `"global"`: applies to entire trip, not linked to specific phases (e.g., personal shopping, emergencies)
- `"linked_phases"`: linked to one or more phases via BudgetPoolPhaseLink
- A pool can serve multiple non-consecutive phases (DEC-007) — e.g., €760 shared across two Burgos stays
- A phase can access multiple pools (DEC-040)
- Personal shopping is a separate global pool, not an envelope inside the main pool (DEC-041)

**Edge cases**:
- Creating a phase without a pool: allowed (DEC-039)
- Deleting a pool that has expenses: soft delete, expenses remain but pool marked as deleted
- Pool amount = 0: allowed (user might add money later)

### 7.4 Envelope Management

**What it does**: Allocate money within a BudgetPool for specific purposes.

**Business rules**:
- Only two envelope kinds in V1: `protected_reserve` and `allocation` (DEC-042)
- `protected_reserve`: visible on dashboard but NEVER treated as free money. Single source of truth for the reserve amount
- `allocation`: general-purpose budget allocation within the pool
- Dashboard derives protected reserve display from the Envelope entity — not from any BudgetPool field
- "informational" envelope kind removed from MVP (DEC-042)

**User flow**:
1. When creating a pool (or during onboarding): optionally set protected reserve amount
2. System creates an Envelope with kind `protected_reserve` inside that pool
3. User can later adjust the reserve via the pool/fund editor
4. Additional allocation envelopes can be created for budgeting purposes

### 7.5 Wallet Management

**What it does**: Track payment methods used for expenses.

**User flow**:
1. Create wallets: name, type (e.g., Wise, cash EUR, credit card)
2. Set one as default (pre-selects on expense form but can be cleared)
3. Register expenses with or without wallet selection
4. Review expenses missing wallet assignment

**Business rules** (DEC-051):
- Wallet selection is optional during quick-add
- If skipped: expense saved with "Carteira não informada" flag
- Dashboard/wallet area shows: "Você possui N gastos sem carteira informada. Revisar agora"
- Expense list has filter: "Somente gastos sem carteira"
- Wallet correction later doesn't affect personal cost, category, fund, or forecasts
- Default wallet pre-selects but can be cleared
- Include a generic editable "Cartão de crédito" wallet option
- No generic "Outra carteira" option

**What's NOT included yet**:
- Cash reconciliation flow (D2, DEC-052)
- Wallet-to-wallet transfers (D2)
- Cash withdrawal tracking (D2)

### 7.6 Participant Management

**What it does**: Register people involved in shared expenses.

**Business rules** (DEC-056):
- V1 fields: name (required), nickname (optional)
- Schema prepared with optional `email` and `linkedUserAccountId` for future multi-user sync
- No phone number field
- Participants are local entities — no cross-device linking in V1

**What's NOT included yet**:
- Shared expense creation with participants (D2)
- Debt tracking between participants (D2)
- Cross-device participant linking (V2)

### 7.7 Basic "Planejar" Tab (DEC-055)

**What it does**: Basic editor for trip financial structure. NOT the full Scenario Planner.

**D1 contents**:
- Phase editor: view, create, edit, delete phases
- Fund/pool editor: view, create, edit pools and their phase links
- Protected reserve editor: set/adjust reserve amount per pool
- Future floor editor: set manual floor for future phase reserves
- Personal shopping: configure global shopping pool amount
- Initial activity profiles: create/edit profiles with typical and safe values

**What's NOT included (D3)**:
- Interactive [-]/[+] controls per profile
- Real-time recalculation
- Trade-off suggestions
- Lock/unlock items
- Priority presets (Econômico, Equilibrado, Mais Social, Personalizado)

### 7.8 JSON Backup & Import

**What it does**: Manual device-to-device data transfer via JSON file (DEC-013).

**Export flow**:
1. User navigates to Backup & Data
2. Taps "Exportar backup"
3. System generates JSON with: all entities, schema version, export date, device info
4. File downloads to device

**Import flow**:
1. User selects "Importar backup" (from Welcome screen or Backup & Data)
2. File picker opens
3. System reads and validates JSON
4. **Pre-import summary** displayed: schema version, export date, device origin, counts of new/updated/conflicting records
5. User chooses mode:

| Mode | Behavior |
|------|----------|
| **Merge** (default) | Add new records, update existing by revision, flag conflicts |
| **Replace** | Delete all local data, import everything fresh |

6. For merge conflicts (same ID, different revision): user chooses per record — keep local / use imported / compare side-by-side
7. Import executes → confirmation with summary

**Business rules**:
- JSON includes schema version for migration compatibility
- Merge uses `revision` field and `updatedAt` for conflict detection
- Soft-deleted records are included in export (needed for proper merge)
- `sourceDeviceId` tracks origin for conflict resolution

**Edge cases**:
- Schema version mismatch: attempt migration, warn if impossible
- Corrupt JSON: show error, don't import
- Empty import file: show error

### 7.9 CSV Export (DEC-058)

**What it does**: Export expense data for spreadsheet analysis.

**Basic CSV — 17 fields**:

| # | Field | Portuguese Header |
|---|-------|-------------------|
| 1 | Date | Data |
| 2 | Time | Hora |
| 3 | Trip name | Viagem |
| 4 | Phase name | Fase |
| 5 | BudgetPool name | Fundo |
| 6 | Envelope name | Caixa |
| 7 | Category | Categoria |
| 8 | Session name | Sessão |
| 9 | Description | Descrição |
| 10 | Original amount | Valor original |
| 11 | Currency | Moeda |
| 12 | Amount in base currency | Valor em moeda base |
| 13 | Wallet name | Carteira |
| 14 | Payer name | Quem pagou |
| 15 | Personal cost | Custo pessoal |
| 16 | Shared amount | Valor compartilhado |
| 17 | Notes | Observações |

**Advanced CSV — 6 additional fields**:

| # | Field | Portuguese Header |
|---|-------|-------------------|
| 18 | Record ID | ID |
| 19 | Transaction type | Tipo da movimentação |
| 20 | Status | Status |
| 21 | Created timestamp | Criado em |
| 22 | Updated timestamp | Atualizado em |
| 23 | Source device | Dispositivo de origem |

**User flow**:
1. Navigate to Backup & Data → "Exportar para planilha"
2. Choose: Basic (17 fields) or Advanced (23 fields)
3. Optional: filter by phase, date range
4. File downloads as `.csv`

### 7.10 Settings (DEC-057)

**What it does**: App-wide preferences. Trip-specific configurations are in their respective editors.

| Setting | Type | Default | Notes |
|---------|------|---------|-------|
| Alert tone | Select: amigo sincero / calmo / direto | amigo sincero | Affects message phrasing (D3+) |
| Default currency | Display only (EUR) | EUR | Structure ready for others |
| Quick-add default values | Editable number list | +€3, +€5, +€7, +€10, +€15, Outro | Configurable at 4 levels (DEC-045) |
| Default wallet | Wallet selector | (none) | Pre-selects on expense form |
| Vibration toggle | Boolean | On | Uses browser Vibration API when supported (DEC-048) |
| Backup reminder | On/Off + interval in days | On, 7 days | Triggers reminder after N days without export |
| Theme | Select: dark / light / system | dark | Light mode deferred to D5 |
| Language | Display only (pt-BR) | pt-BR | Structure ready for en/es |
| Device name | Text (optional) | (empty) | Included in backup metadata |
| Persistent storage status | Read-only indicator | — | Shows if browser granted persistent storage |

**What is NOT in Settings** (lives in trip/fund/planner editors):
- Personal shopping limit
- Protected reserve amount
- Future floor setting
- Activity profile configuration

### 7.11 "Mais" Tab (DEC-059)

**What it does**: Organized access to secondary screens and configuration.

**Structure**:

| Section | Items | D1 Status |
|---------|-------|-----------|
| **Viagem** | Visão geral | Active — links to Trip Overview |
| | Editar fases | Active — links to phase editor |
| | Fundos | Active — links to pool/fund editor |
| | Perfis | Active — links to activity profile editor |
| | Participantes e dívidas | Active (list only) — debt features hidden until D2 |
| | Carteiras | Active — links to wallet management |
| **Dados** | Relatórios | Placeholder/hidden until D3+ |
| | Exportar para planilha | Active — CSV export |
| | Backup e importação | Active — JSON backup/import |
| **Aplicativo** | Configurações | Active — Settings screen |
| | Sobre | Active — App version, credits |

---

## 8. Design System Reference

> Full design system: `TripPilot/brain/documents/design-system.md`. This section covers key implementation tokens only.

### Brand Identity

- **Philosophy**: Warm enough to be a companion, precise enough to trust with money
- **Brand words**: Warm · Precise · Confident
- **Theme**: Mediterranean Cockpit — dark-first, terracotta accent (DEC-022)

### Color Tokens (Essential)

| Token | Value | Usage |
|-------|-------|-------|
| `--surface` | #0F1419 | Page background |
| `--surface-container` | #1A2028 | Card backgrounds |
| `--surface-container-high` | #242C36 | Elevated surfaces, hover |
| `--surface-deep` | #0A0F14 | Immersive backgrounds |
| `--primary` | #C75B39 | Terracotta accent, CTAs |
| `--on-surface` | #EDE8E0 | Primary text (warm cream) |
| `--on-surface-dim` | #EDE8E0b3 | Secondary text (70%) |
| `--on-surface-faint` | #EDE8E070 | Tertiary text (44%) |
| `--on-surface-mute` | #EDE8E035 | Dividers (21%) |
| `--success` | #6B8F71 | Positive / comfortable |
| `--warning` | #D4A843 | Caution / attention |
| `--error` | #D94040 | Danger / avoid |

### Color Rules (Mandatory)
- 60-30-10 ratio: 60% surfaces, 30% secondary text/borders, 10% accent
- NEVER use pure black (#000000) or pure white (#FFFFFF)
- NEVER use blue as primary/accent
- NEVER use "AI palette" (neon, cyan-on-dark, purple gradients)
- All neutrals tinted warm toward terracotta hue

### Typography

| Role | Font | Key Sizes |
|------|------|-----------|
| Display/Headlines | Manrope 700–800 | 2.375rem (hero money), 1.375rem (page title) |
| Body/Labels | Manrope 400–600 | 0.875rem (body), 0.75rem (labels) |
| Monospace (money) | JetBrains Mono 400–600 | Used for aligned numeric displays |

- Fixed rem scale (NOT fluid/clamp)
- `font-variant-numeric: tabular-nums` on ALL monetary values
- NEVER use Inter, Roboto, Arial, DM Sans, Space Grotesk

### Component Patterns to Implement in D1

| Component | Key Specs |
|-----------|-----------|
| **Bottom Navigation** | Glass effect, 5 items + FAB, 48px nav height |
| **FAB Button** | 56px, rounded-2xl, `--primary`, elevated -12px |
| **FAB Menu** | Full-screen overlay at 94% opacity, bottom-aligned actions |
| **Cards** | `--surface-container`, 16px radius, no explicit border, no shadow |
| **Buttons** | 48px height, 12px radius, scale(0.97) on :active |
| **Inputs** | `--surface-container` bg, ghost border, `--primary` focus glow |
| **Bottom Sheet** | `--surface-container`, rounded-t-2xl, drag handle, backdrop blur |
| **Empty States** | Centered, 48px icon, heading + description + CTA |
| **Badges/Status** | Rounded-full pills, status color at 10% bg |
| **Budget Health Bar** | 10px height, rounded-full, gradient fill |
| **Toasts** | Bottom-center mobile, glass effect, auto-dismiss 5s |

### Anti-Patterns (Banned)

- Side-stripe borders (border-left with accent color)
- Gradient text
- Cards inside cards
- `transition: all` (specify exact properties)
- `ease-in` on UI elements
- Duration > 300ms on interactive elements
- Sidebar navigation
- Dropdown menus on mobile (use bottom sheets)
- Emojis in UI

---

## 9. Technical Constraints

### Stack (Locked — DEC-003)

| Layer | Technology |
|-------|-----------|
| UI Framework | React 19 |
| Language | TypeScript (strict mode) |
| Build Tool | Vite |
| Styling | Tailwind CSS |
| Local DB | IndexedDB via Dexie |
| State Management | Zustand |
| Forms | React Hook Form + Zod |
| Dates | date-fns |
| Unit Tests | Vitest |
| Component Tests | React Testing Library |
| E2E Tests | Playwright |
| PWA | vite-plugin-pwa (Workbox) — D5 |
| Hosting | Cloudflare Pages — D5 |
| IDs | UUID v4 |
| Router | React Router v7 (Data Mode — createBrowserRouter) |
| i18n | react-i18next |
| Linting | ESLint + Prettier |

### Architecture Principles

1. **Local-first, offline-capable** — All data in IndexedDB, works without internet
2. **Domain logic is pure TypeScript** — No financial calculations in React components. Domain code lives in `src/domain/`
3. **Orchestrator pattern** — Engines coordinate smaller functions. Orchestrators can call sub-orchestrators
4. **Data model prepared for sync** — SyncMetadata on all entities from day one
5. **Cents-based money** — All amounts as integers
6. **Explicit timestamps** — ISO 8601, local timezone considered
7. **Schema versioned** — Dexie migrations for schema changes

### Project Structure

```
src/
  app/                    # Routes, providers, layouts
  domain/                 # Pure business logic (NO React)
    budget/               # budget-engine, forecast-engine, simulation-engine
    learning/             # profile-learning-engine, statistics
    splitting/            # split-engine, settlement-engine
    wallets/              # wallet-engine
    sessions/             # session-engine, alert-engine
    scenarios/            # scenario-planner, tradeoff-engine
  data/                   # Persistence layer
    db/                   # Dexie database, schema, migrations
    repositories/         # Data access
    backup/               # Export/import JSON, CSV
  features/               # Feature modules (UI + hooks)
    onboarding/
    dashboard/
    trips/
    phases/
    expenses/
    simulator/
    sessions/
    participants/
    settlements/
    wallets/
    planning/
    reports/
    settings/
    backup/
  components/             # Shared UI components
  hooks/                  # Shared hooks
  utils/                  # Utilities (money formatting, etc.)
  styles/                 # Global styles
  pwa/                    # PWA config
```

### i18n Strategy (DEC-054)

- react-i18next from Delivery 1
- pt-BR as the initial and only active language
- en/es directory structures prepared but NOT translated
- No hardcoded user-facing strings in React components — all through `t()` function
- Code (variables, comments, functions) always in English
- All user-facing labels, messages, badges, navigation text in Portuguese (DEC-025)

### Testing Requirements (D1) (DEC-054)

| Layer | Tool | Priority Focus |
|-------|------|----------------|
| **Domain (unit)** | Vitest | Budget calculations, multi-phase pool logic, reserve derivation, cents arithmetic, backup merge/conflict resolution |
| **UI (component)** | React Testing Library | Critical components: expense form, dashboard budget display, wallet selector |
| **E2E (flow)** | Playwright | Create trip → register expense → verify dashboard update → export backup → import on fresh state |

Domain correctness is the highest priority. Test budget calculations, splits, withdrawals, settlements, multi-phase pools, reserves, and backup/import.

### Deployment (D5, but architecture prepared in D1)

```
React + Vite → Build → Cloudflare Pages (static)
                         ↓
                    PWA installed on phone
                         ↓
                    IndexedDB local storage
```

- Cloudflare Pages handles SPA routing by default
- No `_redirects` file needed initially; add only if refresh fails on sub-routes after testing
- Test direct refresh on: `/quick-add`, `/outings/new`, `/outings/active`, `/simulator`
- No server, no monthly cost, no remote database

---

## 10. Decisions Index

All 60 approved decisions grouped by category. Full rationale and alternatives in `TripPilot/brain/decision-log.md`.

### Project & Infrastructure

| ID | Title | Summary |
|----|-------|---------|
| DEC-001 | Project Structure | Director-style tech-lead delegation with 11 subagents + Febracorp planning methodology |
| DEC-002 | Platform: PWA First | Build as Progressive Web App, not native Android/Kotlin. Capacitor later |
| DEC-003 | Tech Stack | React + TypeScript + Vite + Tailwind + Dexie + Zustand + Zod + date-fns + Vitest + Playwright + vite-plugin-pwa |
| DEC-004 | Data Storage: Local-First | IndexedDB via Dexie, no backend, no login, no remote DB. Offline-capable |
| DEC-005 | Hosting: Cloudflare Pages | Free tier, auto-deploy from Git, supports Functions for future backend |
| DEC-017 | Capacitor for Android Later | Add Capacitor after PWA validation for APK + local notifications |
| DEC-054 | Router + i18n + Tests from D1 | React Router v7 Data Mode, react-i18next from D1, tests from D1 with domain priority |

### Budget Architecture

| ID | Title | Summary |
|----|-------|---------|
| DEC-006 | Occasion-Based Forecasting | Main engine uses occasion profiles, NOT simple daily average (secondary only) |
| DEC-007 | BudgetPool Across Phases | A BudgetPool can serve multiple non-consecutive phases via BudgetPoolPhaseLink |
| DEC-008 | Entity Hierarchy | Trip → Phase (when) + BudgetPool (how much) → Envelope (what for). Distinct concepts |
| DEC-011 | Personal Shopping Isolation | Separate global fund with €100 initial limit. Doesn't distort daily budget |
| DEC-016 | Future Phase Reserve | Auto-calculated with 3 levels + manual floor. Applied = max(recommended, floor). Initial: €170 |
| DEC-020 | Money in Cents | Store monetary values as integer cents (€12.34 = 1234) |
| DEC-021 | EUR-Only Initial Interface | V1 uses EUR only. Data model prepared for multi-currency |
| DEC-023 | "Livre para usar" as Hero | Dashboard primary = fund balance − future reserve − protected reserve |
| DEC-039 | Phase Without BudgetPool | Allowed. Require pool selection when registering expenses |
| DEC-040 | Multiple BudgetPools Per Phase | Allowed. Each expense → exactly one pool. Auto-select when only one operational pool |
| DEC-041 | Personal Shopping: Global Pool | Separate BudgetPool with scope "global". BudgetPool gains scope field |
| DEC-042 | Simplified Envelope Model | Two kinds only: protected_reserve and allocation. Reserve = Envelope, never BudgetPool field |
| DEC-043 | ScenarioAllocationItem vs PlannedOccurrence | Allocation = aggregate ("4 bar nights"). Occurrence = specific event with optional date |
| DEC-044 | Profile Costs: Typical + Safe | Each profile: typical value, safe value, confidence, frequency. Three-limit only for Outing sessions |

### User Experience & Design

| ID | Title | Summary |
|----|-------|---------|
| DEC-012 | Alert Tone: "Amigo Sincero" | Direct and natural, not comic or condescending |
| DEC-022 | Design System: Mediterranean Cockpit | Dark-first, terracotta #C75B39, Manrope font, cockpit-style Outing Mode |
| DEC-025 | UI Language: Portuguese | All user-facing text in Portuguese. Code in English |
| DEC-028 | Planner State Chips | Visual color-coded chips instead of text states. Green/gray/yellow + lock icons |
| DEC-029 | Contrast Tier Increase | dim 67%, faint 38% (superseded by DEC-033) |
| DEC-033 | Final Contrast Values | dim 70% (#EDE8E0b3), faint 44% (#EDE8E070). Optimized for mobile low-light |
| DEC-035 | Amigo Sincero: Direct Phrasing | "Se confirmar essa compra, suas saídas de bar caem de 3 para 2." Bold, scannable |

### Dashboard & Navigation

| ID | Title | Summary |
|----|-------|---------|
| DEC-027 | FAB Button: 6 Actions | Full-screen overlay: Registrar gasto, Começar saída, Simular, Mercado, Transferência, Saque |
| DEC-030 | Dashboard Priority Cards | Ordered: Livre hero → active outing → occasions → savings → pending shared → shopping → amigo |
| DEC-031 | Amigo Sincero: Actionable | Before/after comparison + reserve status + "Ver impacto completo" CTA |
| DEC-034 | FAB Menu: Full-Screen Overlay | Dark overlay at 94%, items bottom-aligned, FAB icon → × |
| DEC-055 | D1 Dashboard: Real Data Only | Only implemented features shown. Engine-dependent cards hidden. Basic Planejar tab |
| DEC-059 | "Mais" Tab: Sectioned List | Sections: Viagem, Dados, Aplicativo with specific items |
| DEC-060 | Trip Overview Navigation | Single phase → dashboard direct. No/multiple phases → trip overview. Phase name tap → overview |

### Outing Mode (D4 — Schema in D1)

| ID | Title | Summary |
|----|-------|---------|
| DEC-009 | Outing Mode as Core Feature | Quick buttons, progressive alerts, next-drink calculation. Real-time guidance |
| DEC-010 | Three-Limit System | ideal target, safe ceiling, maximum limit per spending context |
| DEC-024 | Dedicated Full Screen | Immersive, no bottom nav, quick-add visible without scrolling |
| DEC-026 | Dense Layout | No dead space: inline 3-limit indicators, session history, next-drink, "Registrar total" |
| DEC-032 | Gauge: Position Marker + Zone Label | White circle marker, €value label, zone chip ("Dentro da meta" / "Acima da meta" / "Acima do teto") |
| DEC-045 | Quick-Add: Dynamic Values | Based on profile + avg drink price. Editable at 4 levels. Highlight closest to avg price |
| DEC-046 | "Registrar Total": Reconciliation | Keep items + create adjustment entry. Never delete history. Warn on conflict |
| DEC-047 | Shared Expenses in Outing | Allowed. Session personal cost = user's share only |
| DEC-048 | Alerts: Visual + Vibration | Visual primary. Vibration API when supported + enabled. Default: on |
| DEC-049 | End Outing: Single Review Screen | Expandable blocks: total, items, adjustments, shared, wallet, cash, classification |

### Simulator & Planner (D3 — Schema in D1)

| ID | Title | Summary |
|----|-------|---------|
| DEC-015 | Scenario Planner: Manual Mode | Interactive adjustment, app shows alternatives but never changes silently. Manual default |
| DEC-050 | Simulator: Multiple Access Points | Accessible from FAB, Amigo Sincero, Planner, direct URL, "Mais". Combined risk factors |

### Onboarding & Data Management

| ID | Title | Summary |
|----|-------|---------|
| DEC-013 | Device Transfer: JSON/CSV | Manual JSON export/import + CSV export for spreadsheets |
| DEC-014 | No Personal Data in Public Build | PWA starts empty. Demo = fictional data. User imports private JSON |
| DEC-036 | Minimal Onboarding | Trip name, phase name, dates, currency, amount, optional reserve → dashboard |
| DEC-037 | Activity Profiles: Editable Presets | 4 presets with low-confidence estimates. Editable, removable, skippable. Custom profiles allowed |
| DEC-038 | Demo Data: Complete Fictional Trip | 1 trip, 2 phases, 2 pools, 3 participants, 2 wallets, 8-12 expenses, sessions, scenarios |

### Wallets & Financial Tracking

| ID | Title | Summary |
|----|-------|---------|
| DEC-051 | Wallet: Optional + "Não informada" | Skippable, marked for review. Dashboard shows count. Filter available. No "Outra carteira" |
| DEC-052 | Cash Reconciliation Flow | Count cash → compare → create adjustment expense if difference. D2 implementation |
| DEC-053 | Edge Cases: Never Block | Zero budget: warn + confirm. Outing over max: risk state + 15-min unlock. Phase boundary: offer split |

### Shared Expenses & Participants (D2+)

| ID | Title | Summary |
|----|-------|---------|
| DEC-018 | Future Multi-User Architecture | Data model prepared for per-user accounts. Personal budgets remain private |
| DEC-019 | Shared Expense Provisional Impact | Shared expenses affect budget provisionally before confirmation. Clear visual indicator |
| DEC-056 | Participant Data: Minimal | V1: name + nickname. Schema ready for email + linkedUserAccountId |

### Settings & Export

| ID | Title | Summary |
|----|-------|---------|
| DEC-057 | Settings V1 Scope | 10 settings. Trip-specific configs NOT in settings — they live in editors |
| DEC-058 | CSV Export Fields | Basic: 17 fields. Advanced: +6 fields (ID, type, status, timestamps, device) |

---

## Appendix A — Quick-Add Value Configuration Levels (DEC-045)

Quick-add button values can be configured at four levels, each overriding the previous:

| Level | Where | Scope |
|-------|-------|-------|
| 1. Global settings | Settings screen | App-wide default |
| 2. Profile settings | Activity profile editor | Per-profile default |
| 3. Session start | Start outing screen | Per-session override |
| 4. During session | Outing Mode | Live adjustment |

Default values: +€3, +€5, +€7, +€10, +€15, Outro. The value closest to the average drink price gets visual highlight.

## Appendix B — Backup Reminder Logic

- Default: enabled, 7-day interval
- After N days without JSON export: show persistent but dismissable reminder
- Reminder appears in dashboard (subtle) and Backup & Data screen (prominent)
- Configurable in Settings: on/off + interval in days
- Device name (optional) included in backup file metadata for identifying source

## Appendix C — D1 Acceptance Criteria Checklist

- [ ] User can create a trip with phases and budget via minimal onboarding
- [ ] User can register expenses (with/without wallet) and see "Livre para usar" decrease
- [ ] Personal shopping fund works independently from phase budget
- [ ] Protected reserve is stored as Envelope, displayed correctly on dashboard
- [ ] Phase can access multiple BudgetPools
- [ ] User can export and import JSON backup with merge/conflict resolution
- [ ] CSV export produces correct 17-field output
- [ ] Demo data loads and is clearly marked
- [ ] App works on phone browser with design system applied
- [ ] All domain calculations have unit tests
- [ ] i18n strings externalized (no hardcoded Portuguese in components)
- [ ] Dashboard shows only implemented features (no placeholder/fake data)
- [ ] "Planejar" tab shows basic editor (not full Scenario Planner)
- [ ] Settings screen has all DEC-057 items
- [ ] "Mais" tab has sectioned list per DEC-059

---

*This document consolidates: product-spec.md, decision-log.md (60 decisions), technical-direction.md, implementation-phases.md, design-system.md, v1-screen-list.md, and pre-implementation-questions.md. For full details on any topic, consult the source file.*
