# Fix Log — TripPilot Functional Issues

## Current State
- **Active Block**: DONE (all 7 blocks complete)
- **Active Issue**: none
- **Build Status**: clean (tsc clean, vite build clean, 105 unit tests passing)
- **Issues Fixed**: 13/13 + 2 extras found

## Completed

### BLOCO 1 — Fases
- [x] ISSUE-01: "Add phase" button in `TripEditPage` — phase draft form (name, dates, optional pool link), persisted via `createPhase` + `getNextPhaseOrder` (new `domain/phases` module)
- [x] ISSUE-02: `/funds` (`FundsPage`) and `/profiles` (`ProfilesPage`) created — list pools/profiles, create new ones, link pools to phases. `MorePage` now points to them instead of PlannerPage
- [x] ISSUE-03: Circular navigation fixed — `/trip` = overview (read-only + edit CTA), `/trip/edit` = editable phases list; save navigates with `replace: true`

### BLOCO 2 — Planner
- [x] ISSUE-04: Planner persists `ScenarioPlan` + `ScenarioAllocationItem` to Dexie with 500ms debounced auto-save; reload restores state (new `domain/planning` module + 2 repositories)
- [x] ISSUE-05: Over-allocation warning banner (amber) when allocated total exceeds free margin, via `calculateOverAllocationCents`
- [x] ISSUE-06: "+ Adicionar categoria" inline form in planner creates custom `ActivityProfile` (`ProfileForm` shared component, `createCustomActivityProfile`)

### BLOCO 3 — Outing
- [x] ISSUE-07: Icons mapped per category via `utils/category-icons.ts` (`getCategoryIcon`); OutingPage active session shows the session profile's icon; quick-add uses session category, not hardcoded "bar"
- [x] ISSUE-08: "Personalizado" option when starting an outing — inline `ProfileForm` creates a custom profile with chosen icon

### BLOCO 4 — Gastos
- [x] ISSUE-09: Shared expense support in QuickAddPage — "Gasto compartilhado?" toggle, participant selector, payer selector, equal/custom split. Saves `amountCents` (financial flow) + `personalCostCents` (my share) + `ParticipantShare` rows. Budget impact uses `personalCostCents` (`calculatePoolSpent` updated)
- [x] ISSUE-10: `ExpenseDetailPage` at `/expenses/:id` — view/edit/soft-delete, shows shares for shared expenses, proportional share rescaling on amount change. Expense list items are clickable

### BLOCO 5 — Amigo Sincero
- [x] ISSUE-11: `generateAmigoSinceroInsight` now returns the profile category; dashboard message names the specific outing type via i18n interpolation
- [x] ISSUE-12: "Ver impacto completo" navigates to `/simulator?amount=X&source=amigoSincero`; SimulatorPage pre-fills and auto-runs the simulation

### BLOCO 6 — Participantes
- [x] ISSUE-13: SharedExpensesPage — "Adicionar participante" form (name required, nickname optional, `createParticipant`); per-participant net balances via `calculateParticipantBalances`; settle action

### BLOCO 7 — Varredura geral
- [x] All MorePage links point to real routes (`/trip`, `/trip/edit`, `/funds`, `/profiles`, `/shared`, `/wallets`, `/settings/backup`, `/settings`)
- [x] No empty handlers (`() => {}`) left except intentional `.catch(() => {})` on backup import
- [x] No hardcoded pt-BR strings in `.tsx` (all via `t()`; data values like demo profile names are data, not UI text)
- [x] All `navigate()` targets exist in `router.tsx`
- [x] `npm run build` clean, `tsc --noEmit` clean, 105 unit tests passing

## Extra Issues Found
- [EXT-01] BackupPage exported empty `participantShares` and `activityProfiles` arrays and never imported them → data loss for splits and custom profiles. Fixed: `buildLocalBackup()` fetches both, export/import/replace now include them
- [EXT-02] Onboarding created trips with ZERO activity profiles → planner empty, impossible to start an outing on a fresh trip. Fixed: `createDefaultActivityProfiles` (bar/restaurant/market per DEC-037) seeded on onboarding finish

## Verification (last run)
- `npx tsc --noEmit` → 0 errors
- `npm run build` → success
- `npm run test` → 12 files, 105 tests, all passing
