# Post-Animation Fixes + Wise Statement Import — Master Plan

> Created: 2026-06-15 · Author: AI (TripPilot dev) · Status: APPROVED-IN-SESSION (executing gate by gate)
> Baseline: v0.36.0 (motion system). Target: v0.37.0 → v0.40.0.

## Mandate (Julio)

Two threads in one request:

1. **New feature — Wise statement import.** Receive Wise CSV statements (card
   purchases) and create as much as possible from them: an "import expenses"
   flow. The statement maps to a wallet (the Wise card); each line is a card
   purchase. "Analyze everything, plan where/how, best use, no duplication. Use
   the council. Use our standard. Commit + deploy."
2. **Post-animation fixes (regressions + UX) and polish:**
   - **N1 (regression)** Card "floating menus" (detail bottom-sheets) now open at
     the *very bottom of the page*, off-screen, instead of at the bottom of the
     *visible viewport*.
   - **N2 (regression)** Screen transition only plays on the *second* entry to a
     screen; the first entry shows no animation.
   - **N3** Swipe (e.g. Expenses tabs) only works in one direction — must work
     both ways, AND the tab/phase change should be animated (Expenses, Viagem…).
   - **N4** Active-outing screen has a big empty gap in the middle; buttons and
     some numbers fall below the fold and require scrolling though there is room.
   - **N5** Active-outing notification regressed: it lost the value quick-add
     buttons. It should carry buttons (same values as the active-outing screen)
     that log an expense *without opening the app*.
   - **N6** Notification is visually poor — must look good and work well even as
     the fallback (Julio is on One UI 7 = Android 15).
   - **N7** Improve the FAB ("+") menu visuals — make it feel like a proper FAB.

Process: research deeply, plan thoroughly, then implement gate by gate with
commit + Cloudflare deploy + APK + UI verification per gate.

---

## Inline Council — strategic decisions

### Decision A — How to stop overlays opening at the page bottom (N1)

**Root cause (verified in code):** `.route-view` animates with
`animation: page-in-* … both`. `both` retains the final keyframe
`transform: translate3d(0,0,0)`. A non-`none` transform makes the element the
**containing block for `position: fixed` descendants** (CSS spec). Every
`BottomSheet` (`fixed inset-0 items-end`) rendered inside a routed page is then
positioned relative to the (tall) page, so `items-end` drops it to the bottom of
the page instead of the viewport.

- **Architect:** Two independent fixes, both cheap: (1) portal `BottomSheet` to a
  host *outside* the transformed subtree — the codebase already does this for
  `SelectionBar`/`HelpMode`/`BarMode` (DEC-125), so it is the established pattern;
  (2) make `.route-view` not retain a transform (`to { transform: none }`), so no
  `position:fixed` descendant is ever trapped again. Defense in depth.
- **User Advocate:** The portal also lets a sheet open *during* a page entrance
  without being trapped. Portal to a host **inside `#root`** so it keeps the
  `cap-native` zoom (1.06) — otherwise sheets render 6% smaller than the app.
- **Critic:** Don't portal to `document.body` blindly (that loses the zoom and
  the 430px column is handled by the sheet's own flex, so fine). A dedicated
  `#app-overlay-root` rendered as a sibling of the router inside `#root` is the
  correct host.
- **Decision (DEC-195):** Add `#app-overlay-root` inside `#root`; `BottomSheet`
  renders through `createPortal` into it. Also set the page keyframes'
  end-state to `transform: none`. Result: sheets always anchor to the viewport
  bottom; no fixed descendant can be trapped by the page transform again.

### Decision B — Why the first screen entry isn't animated (N2)

**Root cause (verified):** routes are `lazyWithRetry` + `<Suspense>`; the
fallback is `null` for the first 220 ms. On first navigation the `.route-view`
mounts *empty* (chunk still loading) and its 320 ms animation runs on nothing;
when the chunk resolves the wrapper does NOT remount, so the content appears with
the animation already over. Second visit: chunk cached → content mounts inside a
fresh `.route-view` → it animates.

- **Architect:** Move `.route-view` to *inside* the Suspense boundary, wrapping
  the lazy child. A component that suspends doesn't commit its parent until it
  resolves, so the animated wrapper mounts **with content present**, every time.
  One change in `LazyRoute` unifies all ~35 routes and removes the
  per-page/`AppShell` ad-hoc `.route-view` usage (less code, consistent).
- **Critic:** Keep direction (`data-nav`) on `<html>` — independent of where the
  wrapper lives. Key the wrapper by `pathname` so same-component param changes
  still replay.
- **Decision (DEC-196):** `LazyRoute` renders `<Suspense><RouteView keyed>
  {children}</RouteView></Suspense>`. Remove `.route-view` from `AppShell` and
  the two standalone pages that had it.

### Decision C — Swipe both ways + animation (N3)

**Findings:** the `useHorizontalSwipe` hook is already bidirectional; Expenses
and Viagem wire both directions. The real gaps: (a) no visual feedback, so a
no-op direction *feels* broken, and the system edge-back gesture can eat an
edge swipe; (b) the content swap is instant (no transition).

- **Architect:** Add a tiny **`SwipePager`/animated content** layer: keep the
  existing state-based tabs/phases, but wrap the swappable content in a keyed
  node that slides in from the correct side (a new `.pane-in-left/right` keyframe
  set driven by a `data-dir`). Reuse the existing `useHorizontalSwipe`. Don't
  rebuild paging with finger-following transforms (heavy, risky with the sticky
  headers + vertical scroll).
- **User Advocate:** Make both directions visibly do something — when at the end
  of the range, a subtle resistance is nice but optional; minimum bar is "both
  directions change the page and animate".
- **Decision (DEC-197):** Add directional content-slide animation on tab/phase
  change (Expenses + Viagem), driven by the change direction; keep the
  bidirectional swipe; lower friction (don't fight vertical scroll).

### Decision D — Active-outing height (N4)

**Root cause (verified):** the active-session container is `minHeight: 100vh`
inside the parent `.app-safe-top` (which adds `padding-top: var(--safe-top)`),
so total height = `safe-top + 100vh` → the bottom (quick-add buttons) sits
`safe-top` px below the viewport. A `flex-1` spacer inflates the mid-page gap.

- **Decision (DEC-198):** container height → `calc(100dvh - var(--safe-top))`;
  cap the greedy spacer and add `padding-bottom: max(var(--safe-bottom), …)` so
  the quick-add grid is fully visible without scrolling on a normal screen.

### Decision E — Notification with value buttons that log without opening (N5/N6)

**Findings:** the domain already builds value actions
(`buildOutingNotificationPayload.actions`), but the native `showOutingNotification`
only registers `open`. On One UI 7 (Android 15, SDK 35) the Live Update plugin
reports unsupported, so the LocalNotifications path is what Julio sees → no value
buttons, plain look.

- **Architect:** Two layers. (1) **Rich content now** (reliable): a `BigTextStyle`
  body ("Total €X · meta €Y · faltam €Z · ~N drinks"), accent color, ongoing,
  status chip. (2) **Value action buttons that don't open the app**: this needs
  NATIVE handling — Capacitor's `LocalNotifications` action taps wake the
  WebView/foreground and are unreliable on frozen Samsung tabs (that was the v1
  bug). The robust path is a native `BroadcastReceiver` whose `PendingIntent`
  does NOT launch the Activity: it appends the quick-add to a SharedPreferences
  queue, bumps a native running total, and re-posts the notification. JS drains
  the queue on resume and reconciles the authoritative total.
- **Critic:** This is OEM-sensitive and cannot be fully validated without Julio's
  device. Keep the existing LocalNotifications path as the guaranteed fallback;
  gate the native action path so any failure degrades gracefully. Ship it as
  "device-validation pending".
- **Strategist:** Highest certain value = the rich body + accent (works on every
  Android). The value-button-without-opening is the ambitious add; build it on
  the custom plugin (extend `LiveOuting` → a general "OutingNotification" native
  capability) and lower its support gate to Android 13+ so One UI 7 gets it.
- **Decision (DEC-199):** Implement (1) rich content for the LocalNotifications
  fallback now; (2) a native action-button + BroadcastReceiver + pending-queue
  capability on the custom plugin (Android 13+), with JS reconcile on resume,
  shipped behind graceful fallback and flagged device-pending.

### Decision F — Wise CSV statement import (the feature)

**Statement shape (3 files analyzed):** RFC4180 CSV; header has 23 columns. Key
fields: `TransferWise ID` (unique → dedupe key), `Date`/`Date Time`
(DD-MM-YYYY[…]), `Amount` (signed, dot-decimal; negative = debit), `Currency`
(EUR), `Description`, `Merchant` (free text ending in an UPPERCASE city, e.g.
"Confiteria Juarreno BURGOS"), `Card Last Four Digits`, `Transaction Type`
(DEBIT/CREDIT), `Transaction Details Type` (CARD/TRANSFER/ACCRUAL_CHARGE…).
File 1 and 2 are identical (a double download); file 3 is header-only (empty).
So **cross-file dedupe by `TransferWise ID` is mandatory**, and empty files must
be handled.

- **Architect:** Pure domain, three units (all unit-tested): `parseWiseCsv(text)`
  → `WiseStatementRow[]` (a correct RFC4180 parser — fields are quoted and
  contain commas); `classifyWiseRows(rows, ctx)` → an `ImportPlan` of drafts with
  a per-row `status` (`new` / `duplicate_import` / `possible_manual_dup` /
  `skipped`); a `commitWalletImport` orchestrator that inserts the included
  drafts atomically (one Dexie `rw`), debiting the chosen wallet. Reuse
  `entity-factory`, multi-currency fields, phase-by-date resolution, the
  category-icon map, BottomSheet/EmptyState, toast+undo, and the backup-import
  *preview* UX pattern.
- **Mapping:** CARD/TRANSFER debit → `expense`; positive amount → `transfer`
  (wallet top-up, not budget spend); `ACCRUAL_CHARGE`/fees → `expense` (category
  `other`) or skip (user toggle). `Merchant` → description; trailing uppercase
  token(s) → city → best-effort phase match (else by date). Date Time → ISO
  `date`. Phase = the phase whose date range contains the expense date (fallback
  active/first). Pool = the phase's linked primary pool if resolvable, else null
  ("não informado", DEC-051 parity). Category = keyword heuristic (taxi→transport,
  bar/confiteria/restaurante→food, super/market→market…), default `other`.
- **Dedupe:** store the Wise id on the transaction in a NEW non-indexed field
  `externalRef: string | null` (e.g. `wise:CARD-3927313014`). Non-indexed → **no
  Dexie migration**; backup serializes whole objects so it rides along; import
  normalization defaults missing → null. Re-importing the same file → all rows
  `duplicate_import` (skipped). Same date+amount as an existing *manual* expense →
  `possible_manual_dup` (shown, default excluded, user can include).
- **UX:** entry from Wallets ("Importar extrato") and Backup/Settings. Steps:
  pick file(s) → parse+classify → **preview** (counts: found / new / already
  imported / possible dup / credits) + choose target wallet (existing or create
  "Wise EUR") + confirm auto phase/pool + a per-row reviewable/excludable list →
  **commit** (atomic) → success toast with **undo** (reuse
  `softDeleteTransactionsBatch`).
- **Decision (DEC-200):** Manual, on-device CSV import (no API, no network) —
  consistent with offline-first and the existing JSON/CSV manual flows. The
  product-spec "NOT in scope: Bank integration (Wise API)" refers to *live API*
  integration; a manual file import is explicitly in the same family as
  "JSON backup/import" + "CSV export". Recorded as a new scope addition.

### Decision G — FAB visual polish (N7)

- **Decision (DEC-201):** Redesign the speed-dial: a titled sheet-like panel
  rising from the FAB with a primary "Registrar gasto" action emphasized, the
  rest as clean cards with consistent tonal icon chips, a grabber, refined
  spacing, and the existing stagger/scrim animation; clears the bottom bar (kept
  from 0.36.0). No new deps.

---

## Gate plan

| Gate | Scope | Version |
|---|---|---|
| **1** | N1 sheet position + N2 first-transition + N3 swipe both-ways+anim | 0.37.0 |
| **2** | N4 active-outing height + N7 FAB redesign | 0.38.0 |
| **3** | N5/N6 notification: rich content + native value buttons (background log) | 0.39.0 |
| **4** | Wise CSV import (domain + tests + UI + i18n) | 0.40.0 |
| **Final** | brain/decision-log/status update + final verify + final deploy | — |

Each gate: `tsc -b` + Vitest green + web build + `cap sync` + `assembleDebug` +
commit (git plumbing) + `wrangler pages deploy … --branch=main` + APK copied to
Downloads.

## Risks & caveats

- **Native notification buttons (Gate 3):** OEM-sensitive; cannot be fully
  validated without Julio's S23/One UI 7. Guaranteed fallback = the rich
  LocalNotifications notification. Marked device-pending.
- **Import phase/category mapping (Gate 4):** heuristic; the preview is fully
  reviewable/editable and the commit is undoable, so wrong guesses are cheap.
- **`externalRef` field:** additive, non-indexed, default null; no migration; no
  effect on existing math.

## Out of scope (now)

- Live Wise API / OAuth (stays out — DEC, manual file only).
- PDF/receipt OCR import.
- Cross-section bottom-nav swipe (still a separate experiment).
- iOS notification parity.
