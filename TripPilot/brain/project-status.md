# TripPilot — Project Status

> Last updated: 2026-06-12 (v0.8.1 — install/update controls, plan-aware burn-down)

## Current Phase

**Implementation — D1–D5 + gap-fix R1..R3 + P2P sync R4 + reliability R5 + full-fix R6 + field review R4 + field feedback fixes + brainstorm features v0.8.0 deployed** ✅

## Status Summary

| Area | Status | Notes |
|------|--------|-------|
| Project structure | ✅ DONE | Cursor workspace with Director + Febracorp methodology |
| Product spec | ✅ DONE | Full MVP specification + R2 features (events, rhythm, per-phase activities) |
| Technical direction | ✅ DONE | Stack locked: React/TS/Vite/Dexie/Cloudflare + Router v7 + i18next |
| Competitive analysis | ✅ DONE | TravelSpend gap analysis, positioning defined |
| Decision log | ✅ DONE | 136 decisions (DEC-001 to DEC-136); DEC-063 superseded by DEC-071 |
| Implementation phases | ✅ DONE | 6 deliveries defined (~50h Tier 3) |
| Data model | ✅ DONE | 24 entities; Dexie schema **v4** (peerLinks, mirroredStatements, linkedActorId) |
| Domain rules | ✅ DONE | Forecasting, three-limit system, learning, rhythm weighting, event reserves, insights |
| Design system | ✅ DONE | Theme v4; BottomSheet/Toast primitives; zero native dialogs; zero hardcoded colors (tokens only) |
| Implementation D1–D6 | ✅ DONE | All deliveries implemented and deployed to Cloudflare Pages |
| Gap analysis R1 2026-06-09 | ✅ RESOLVED | 36/36 gaps fixed (see `src/gap-fix-log.md`) |
| Gap analysis R2 2026-06-09 | ✅ RESOLVED | 23/23 items fixed: 7 field bugs + 9 R2 gaps + 7 planning features (see `src/gap-fix-log-r2.md`) |
| Field review R3 2026-06-10 | ✅ RESOLVED | 26/26 requirements implemented in 7 gates (see `src/gap-fix-log-r3.md`) |
| P2P sync R4 2026-06-10 | ✅ DONE | 14/14 requirements in 7 gates (see `src/gap-fix-log-r4-p2p-sync.md`); DEC-103..108 |
| Reliability R5 2026-06-10 | ✅ DONE | 9/9 requirements in 4 gates (see `src/gap-fix-log-r5.md`); DEC-109..113 |
| Full-fix R6 2026-06-10 | ✅ DONE | 25/25 items in 7 gates: 4 audit bugs + 6 partials + 8 field-test findings + simulator v3 (see `src/gap-fix-log-r6.md`) |
| Field review R4 2026-06-11 | ✅ DONE | 12/12 requirements in 10 gates: payer truth table, occasions=sessions, simulator v3 contextual, outing zones, multi-select, configurable dashboard, PWA notification, help mode (see `src/gap-fix-log-r4.md`); DEC-114..123 |
| Brainstorm features 2026-06-12 | ✅ DONE | 9/9 features (F1–F9): bar mode + wake lock, universal undo, PWA shortcuts, mental anchor, burndown card, heatmap card, recap card, rescue mode, share card; DEC-126..134 |
| i18n | ✅ DONE | pt-BR + en + es complete and synchronized (950 keys) |
| Tests | ✅ DONE | 460 unit tests + 29 Playwright e2e, all green |
| Deploy | ✅ DONE | v0.8.1 on Cloudflare Pages + `trippilot-sync` Worker; SW network-first + update toast. IMPORTANT: deploy with `--branch=main` (the project's production branch) — plain `master` deploys land as Preview only |
| Repository | ✅ DONE | GitHub `juliocorcini/trip-budget-copilot` (ssh) |

## Gap-Fix Session R2 (2026-06-09)

All 23 items from `documents/gap-analysis-r2-2026-06-09.md` were resolved in a
9-gate session (full log in `src/gap-fix-log-r2.md`). Highlights:

- **Distribution fixed (GAP-R2-001 / DEC-082)**: SW now network-first for navigation with cache fallback; persistent "new version" toast triggers skipWaiting + reload — deploys finally reach users
- **Light theme everywhere (DEC-083)**: 12 hardcoded colors replaced by tokens; `data-theme` + language applied at router root (covers /quick-add, /outings/*, /simulator); dynamic meta theme-color
- **Mobile feel (DEC-081)**: global user-select none (inputs preserved), transparent tap-highlight, touch-action manipulation
- **Dexie v3 unified migration**: share `confirmationStatus`, new `phaseProfileSettings` table, `Phase.rhythmPreset/peakDays`, rich `PlannedOccurrence` (endDate, kind, reservedCents, linkedSessionId); backup v3 with v2 import
- **Share confirmation (DEC-071)**: third-party shares born pending; debts count only confirmed; dashboard card with confirm/reject/adjust sheet (Julio's sister scenario covered by tests)
- **Fund/phase CRUD (DEC-080)**: edit/delete with safety rules (reassign or block), soft-delete cascades via orchestrators
- **Per-phase activities (DEC-074)**: 16-preset catalog + custom; `phaseProfileSettings` drives Planner/counters/outing start; kills cross-phase contamination
- **Phase rhythm (DEC-075)**: intensity presets + peak days; weighted free-to-spend per day with peak microcopy
- **Planned events (DEC-072/073)**: events/sub-destinations per phase with reserves deducting from free-to-spend until confirmed; dashboard day card (start now / postpone); one-off sessions create occurrences, not profiles
- **Rich outing (DEC-078/079)**: post-add enrichment stepper (category → payer → split, skippable, never blocks logging); outing history tab + read-only review
- **Final dashboard (DEC-076/077)**: counters carousel ordered by usage; rotating insights (6 V1 builders with significance rules) persisting daily `forecastSnapshots`; exact 11-position layout
- **Quality**: aria-labels across icon buttons; 7 new e2e tests (29 total); timezone bug fixed (UTC vs local date on day card)

## Gap-Fix Session R3 (2026-06-10)

All 26 requirements from Julio's field review were resolved in a 7-gate session
(full log in `src/gap-fix-log-r3.md`). Highlights:

- **App feel (DEC-084..087)**: sticky headers (Dashboard/Expenses/Planner), unified
  `--page-padding-x` margins, invisible scrollbars (root cause: `no-scrollbar` was never
  defined), no pull-to-refresh in installed PWA
- **Subtractive daily budget (DEC-088)**: "livre hoje" fixed at day start, drops with each
  expense (€6,00 − €2,00 = €4,00), can go negative; average is secondary
- **Notifications center (DEC-090)**: bell → /notifications with 5 derived notification types
- **Honest Friend v2 (DEC-092)**: plan-based (planned vs done vs fits-in-margin) — kills the
  "197 saídas" bug; projects reserve-consumption date; /impact detail page (DEC-093)
- **Multi-metric simulator (DEC-094)**: total + daily + plan perspectives, worst verdict wins
- **Expense taxonomy (DEC-095..097)**: ~110 subcategories, proximity-sorted stepper, 2-level
  event flow, 10s auto-dismiss with interaction reset, split flow enrichment
- **Planner overhaul (DEC-098..101)**: live margin, top over-budget warning, category menu
  (edit value / remove from phase / per-phase classification), real lock, event deep links,
  profile editing with safe removal
- **Debt statement (DEC-102)**: participant tap → itemized breakdown matching the debts engine
- **Clickability sweep (R-26)**: all 22 screens audited; orphan cards now navigate

## P2P Sync Session R4 (2026-06-10)

All 14 requirements from the P2P council session (DEC-103..108, MTG-2026-06-10)
were implemented in 7 gates (full log in `src/gap-fix-log-r4-p2p-sync.md`). Highlights:

- **Sync domain (pure TS)**: actor identity QR, wire protocol (manifest/chunk/ack
  with deflate + CRC32, 12 KB chunks), QR codec (`TPSYNC1:` envelope, 1.6 K char
  budget), statement + migration payloads
- **Worker `trippilot-sync` (DEC-107)**: ephemeral 2-peer rooms (Durable Object,
  SQLite class), opaque relay, 10-min alarm expiry, zero storage — deployed at
  `https://trippilot-sync.trippilot.workers.dev`
- **Transports (DEC-103)**: AES-GCM 256 E2E (key only in the QR), WebRTC DataChannel
  with automatic encrypted-relay fallback after 8 s, offline two-QR manual signaling
- **Device migration (DEC-104)**: BackupPage "send/receive to another device" +
  Welcome "receive from another device"; reuses backup pipeline + import preview
- **Pairing (DEC-105)**: "My QR" + "Add by QR" + retroactive "Connect by QR" +
  link badge; typing a name remains the default path
- **Mirrored debts (DEC-106)**: owner sends read-only statement; mirror confirms/
  rejects lines; responses flow back on the same session or queue offline and flush
  next time; financial truth never merges bidirectionally
- **Data**: Dexie v4 (peerLinks, mirroredStatements), backup v4 with v1-v3 import
  normalization; 35 new unit tests (299 total)

## Reliability Session R5 (2026-06-10)

All 9 requirements from Julio's v0.4/v0.5 field test were resolved in 4 gates
(full log in `src/gap-fix-log-r5.md`). The reported "total data loss" was
diagnosed as: IndexedDB failures being treated as empty state (redirect to
welcome) + an iOS-unsafe blob export that froze the standalone PWA. Highlights:

- **DB failure ≠ empty data (DEC-109)**: `useAppData` error state + 10 s
  watchdog; `DataErrorScreen` ("your data was NOT deleted" + retry that reopens
  Dexie); welcome redirect only after a SUCCESSFUL load; auto-retry on
  visibilitychange
- **iOS-safe export (DEC-110)**: `navigator.share({files})` first, fallback
  anchor `target=_blank` with 10 s deferred `revokeObjectURL`; try/catch +
  busy state on all backup handlers
- **Storage durability (R5-03)**: `requestPersistentStorage()` at boot +
  dashboard banner when not persisted; `repairDemoTripIfNeeded` date rewrite
  gated to `isDemo` (DEC-111 — it was corrupting real future/finished trips)
- **Onboarding keyboard (R5-04)**: `interactive-widget=resizes-content` +
  `useKeyboardInset` (visualViewport) + 100dvh layout — footer buttons stay
  above the keyboard
- **Onboarding details (R5-05)**: dedicated phase step (dates validated in trip
  range, rhythm preset, peak days)
- **Planner (DEC-112)**: itemized "you added 16 transporte, 5 mercado e 2 café"
  headline (was mislabeling the total); deficit = `-liveMargin` so the
  recommendation card survives leaving/re-entering the Planner
- **Outing gauge (DEC-113)**: piecewise `calculateGaugePosition` (spent 40 of
  35/45/55 now lands between meta and teto) + clamped value-pill marker
- **Tests**: +18 unit (317 total), e2e updated for the 5-step onboarding

## Full-Fix Session R6 (2026-06-10)

All 25 items from the full-coverage audit (`documents/full-coverage-audit-2026-06-10.md`)
plus Julio's field-test findings (`documents/field-test-checklist-r3-r5.md`) were resolved
in a 7-gate session (full log in `src/gap-fix-log-r6.md`, prompt in
`documents/r6-full-fix-prompt.md`). Highlights:

- **Timezone bugs killed (BUG-001/002, PAR-006)**: every "which day was this?" projection
  now goes through `localDayOf` (UTC instants no longer shift evening expenses to the next
  day); phase end dates fully inclusive; `resolveActivePhase` replaces `phases[0]` fallbacks
- **Debts engine (BUG-003)**: multi-creditor allocation respects remaining credits
- **Shared edit (BUG-004)**: editing a shared expense re-applies DEC-071 rejected-share math
- **P2P sync reliable on the 1st attempt (P2P-09/12/13)**: sender consumes the receiver's
  hello symmetrically (was erroring on EVERY successful send) + channels buffer messages
  arriving before the app listens (was silently dropping the first attempt)
- **QR scanner (P2P-06/07)**: camera switch button (remembers choice) + zoom chips —
  unblocks the offline 2-QR mode on multi-lens iPhones
- **Dashboard carousel (R-02)**: exactly 3 cards per page + mediterranean per-category colors
- **Outing gauge (R5-09)**: labels/ticks anchored at the real 3:2:1:1 segment boundaries
- **Honest iOS persistence (R5-03)**: install-to-home-screen guidance instead of the
  impossible "enable" CTA; installed PWA no longer alarmed
- **Keyboard viewport (R5-04)**: forced restore on keyboard close
- **Locale formatting (PAR-001/002/004/005)**: dates/numbers/onboarding names/wallet types
  follow the active language via a domain locale bridge
- **Simulator v3 (R-12)**: each metric shows its math, quick chips, post-verdict CTAs;
  learning prior keeps the preset estimate (PAR-003a)
- **Tests**: +26 unit (343 total)

R7 candidate (deferred, product decision): per-category simulation weighting when the
category plan is already blown.

## Field Review Session R4 (2026-06-11)

All 12 requirements from Julio's in-trip audio review were resolved in a 10-gate
session (full log in `src/gap-fix-log-r4.md`, prompt in
`documents/gap-fix-r4-implementation-prompt.md`). Decisions DEC-114..123. Highlights:

- **Payer math fixed (DEC-114, the critical one)**: "Ana paid €15 and we didn't split"
  no longer erases the cost — it stays MY expense AND creates a €15 debt to Ana.
  Single truth-table function `resolvePayerExpense` reused by QuickAdd, outing stepper
  and outing split; end-of-session batch wallet skips items paid by others;
  reconciliation adjusts over the personal total preserving debts
- **Occasions = sessions (DEC-115)**: a 9-item bar night counts as ONE bar occasion
  everywhere (dashboard counters, Honest Friend with new `over_plan` kind, impact,
  simulator) via `countProfileOccasions`
- **Contextual simulator v3 (DEC-116)**: asks WHERE the money goes; explained verdicts
  ("consumes ≈2 of your 4 dinners", "the €60 reserve covers it", "≈4 days of your daily
  free") — zero unlabeled numbers, old raw-equation displays removed
- **Honest outing zones (DEC-117)**: copy/color change AT the target; "can still spend
  comfortably: €0" eliminated; next-drink hint is honest per zone; progressive alerts
  re-anchored (50% target / target / ceiling / max)
- **Multi-select (DEC-118)**: long-press in expense/outing lists → selection bar with
  batch delete / move pool / change category (atomic Dexie orchestrators)
- **Configurable dashboard (DEC-119)**: long-press a card → quick action / hide /
  configure; /settings/dashboard reorder + visibility persisted in AppSettings
- **PWA outing notification (DEC-120, best effort)**: persistent notification with
  +€X quick-add buttons and "what was it?" follow-up; superseded by DEC-124 (v0.7.1):
  the SW now always writes straight to IndexedDB and re-renders itself; research
  VERIFIED 2026-06-11 in `documents/pwa-notification-research.md`; true
  ongoing/media-style → Capacitor backlog (DEC-017)
- **Help mode (DEC-121)**: "?" on 6 complex screens → overlay highlighting the real
  elements with concrete travel examples ×3 languages
- **UI polish (DEC-122)**: carousel opens aligned (3 cards), insights advance one per
  gesture, category chip labels never overflow, `<html lang>` follows the language
- **QuickAdd payer-first (DEC-123)**: "Who paid?" as first-level question with debt hints
- **Tests**: +66 unit (409 total)

### Same-day field feedback on v0.7.0 (→ v0.7.1)

- **Notification v2 (DEC-124)**: SW handles action clicks alone (direct IndexedDB
  write + re-render from fresh DB + broadcast) — v1 window delegation died on
  Android frozen tabs (stuck €0); Settings toggle + outing-screen enable banner +
  boot/refocus re-sync; rich body (total vs target, remaining, ≈N drinks); "open"
  fixed to /outings/active
- **Overlay stacking fix (DEC-125)**: SelectionBar and help overlay portaled to
  <body> (sticky headers trapped them under the bottom nav); help card draggable

## Brainstorm Features Session (2026-06-12, v0.8.0)

Nine features from the creative brainstorm council, all approved by Julio and
implemented in one session. Decisions DEC-126..134. Highlights:

- **Universal undo (DEC-126)**: deletes (single/batch/outing) show a 6s toast with
  "Desfazer" — restore orchestrators clear `deletedAt` on the full cascade;
  `trippilot:data-changed` event refreshes any open page
- **Bar Mode (DEC-127)**: fullscreen dark view for the active outing (huge total,
  giant quick-add buttons, wake lock keeps the screen on); quick-adds skip the
  stepper and offer undo instead
- **Mental anchor (DEC-128)**: "€20 ≈ R$ 124" hints in QuickAdd/detail/bar mode
  with a manual offline rate configured in Settings
- **Dashboard insight cards (DEC-129/130/131)**: yesterday recap (spent vs
  reconstructed allowance + streak), phase burn-down (SVG, rhythm-aware ideal
  line), month heatmap (calendar grid, tap day → transactions sheet) — all
  movable/hideable via DEC-119 infrastructure
- **Rescue mode (DEC-132)**: `/rescue` calculator — "guardar €X" → new daily
  allowance + greedy occasion-skip suggestions; nothing persisted
- **Share card (DEC-133)**: trip overview exports a 1080×1350 PNG via canvas +
  Web Share sheet (local only — DEC-011 stands, no social surface)
- **PWA shortcuts (DEC-134)**: launcher long-press → quick-add / outing / simulator
- **Tests**: +42 unit (456 total); sync-crypto suite moved to node environment
  (jsdom lacks SubtleCrypto)

### Same-day field feedback on v0.8.0 (→ v0.8.1)

- **Install + update controls (DEC-135)**: "Add to home screen" button in More +
  Settings (captured beforeinstallprompt); Settings "App" section shows the real
  version and a "Check for update" button that forces the SW update and reloads —
  covers the "Chrome updated but the installed app is stale" case
- **Burn-down follows the full plan (DEC-136)**: dated events/sub-destinations
  now appear as steps on the ideal line on their planned day (multi-day spread
  evenly); pending reserves added back to the chart envelope; +4 unit tests (460)
- **Width fix**: pending-shares card (and active-outing card) gained `w-full` —
  buttons shrink-to-fit unlike the div cards
- **Repo**: project pushed to GitHub (`juliocorcini/trip-budget-copilot`)

## Registered Technical Debts

| Debt | Origin | Notes |
|------|--------|-------|
| Full orchestrator refactor of untouched pages | DEC-067 (D-H) | Orchestrators exist for expense/outing/wallet/backup/share/CRUD flows; some older pages still call repositories directly |
| Automatic future floor calculation | DEC-069 (D-I) | Manual floor per phase link implemented; automatic calculation is D3+ |
| SW precache via build plugin | GAP-036 | Current approach parses index.html at install; a Workbox/Vite plugin would be more robust |
| E2E (Playwright) in CI | DEC-054 | 29 e2e tests run locally; CI requires browser install |

## Next Steps

1. Julio tests v0.8.0 in the field — focus on bar mode at night, undo toasts,
   anchor hints with his real BRL rate, the three new dashboard cards, rescue
   calculator and the share card on his Samsung
2. Re-test v0.7.1 items still pending field validation — payer math (debts after
   "someone else paid"), occasion counters, contextual simulator verdicts,
   notification quick-add
3. Real-data seed (julio-europa-2026) when trip data is ready
4. D6 / V2 features per `implementation-phases.md` (native layer, reports, automatic
   future floor); Capacitor package now also carries the ongoing-notification item
   (DEC-120 research)
5. P2P V2 deferrals per DEC-108 (live split, group sync, settlement handshake)
6. R7 candidate: per-category simulation weighting (product decision pending)

## Blockers

- None.

## Key Decisions Reference

All decisions documented in [decision-log.md](decision-log.md). R2 session added
DEC-071..DEC-083 (approved 2026-06-09); R3 session added DEC-084..DEC-102
(approved 2026-06-10); R4 session added DEC-103..DEC-108 (approved 2026-06-10);
R5 session added DEC-109..DEC-113 (approved 2026-06-10); field review R4 session
added DEC-114..DEC-123 (approved 2026-06-11); brainstorm session added
DEC-126..DEC-134 (approved 2026-06-12).
