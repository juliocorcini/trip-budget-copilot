# Gap-Fix Log — R6 (audit bugs + field test fixes)

- **Prompt**: `brain/documents/r6-full-fix-prompt.md`
- **Baseline (Gate 0)**: 317 unit ✅ · typecheck ✅ · build ✅ · 29 E2E ✅ (v0.5.1)
- **Nota node**: wrangler/playwright exigem Node 22 → `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"`

## Current State

- Active gate: G3 (QR scanner)
- Last milestone: G2 complete (R6-06..07)
- Tests: 337 unit / 29 e2e
- Build: OK (typecheck clean)
- Risks: date projection now local everywhere — watch DashboardPage day card (already local via GAP-R2-007)

## Gates

- [x] G0 — Setup + baseline
- [x] G1 — Domain bugs (R6-01..05: BUG-001..004, PAR-006)
- [x] G2 — P2P sync reliability (R6-06..07)
- [ ] G3 — QR scanner camera switch + zoom (R6-08..10)
- [ ] G4 — UI polish: carousel, gauge, iOS banner, keyboard (R6-11..14)
- [ ] G5 — Locale formatting (R6-15..18)
- [ ] G6 — Simulator v3 + learning prior (R6-19..22)
- [ ] G7 — Housekeeping + validation + deploy (R6-23..25)

## Milestones

### G2 — P2P sync reliability (R6-06..07)

- **R6-06 (P2P-09/12/13 "sender always errors")**: `runSender` now consumes the receiver's
  hello symmetrically (tolerant 15s expect). Previously the orphan hello was dequeued by
  `expect('ack')` → protocol_error → error screen on every successful send; same defect
  broke `waitForResponses` on the owner side.
- **R6-07 (P2P-09 "first attempt fails")**: `createMessageBuffer` in `data/sync/channel.ts`;
  `wrapDataChannel` (webrtc/manual) and `createRelayChannel` (relay) buffer frames until
  `setMessageHandler` attaches — no more silent drops in the open-to-listen window.
- Tests: +3 (`sync-reliability.test.ts`) — buffer ordering, first-attempt race simulation,
  full statement round-trip (hello × 2 → payload → ack → responses → ack). 337 unit ✅.
- Regression named: R4 channel kinds untouched (webrtc/relay/manual), sync-session tests
  still green, crypto/signaling untouched.

### G1 — Domain bugs (R6-01..05)

- **R6-01 (BUG-001)**: added `localDayOf`/`localClockTime`/`moveToLocalDay` to `domain/dates`;
  used in `calculateSpentOnDate`, `sumSpentInOccurrenceInterval`, `buildNoSpendStreak`, CSV
  date/time columns, ExpenseList/Detail/OutingReview/ImpactDetail displays and date editing.
  Stored timestamps stay UTC; only the day projection changed (no data migration).
- **R6-02 (BUG-002)**: `findActivePhase` compares local day strings (end date inclusive);
  QuickAdd/Wallets/Simulator switched from `findActivePhase ?? phases[0]` to `resolveActivePhase`.
- **R6-03 (BUG-003)**: `calculateDebts` allocates against mutable remaining credits.
- **R6-04 (BUG-004)**: shared-expense edit uses `calculateOwnerPersonalCost` (DEC-071).
- **R6-05 (PAR-006)**: rhythm cursor uses local day instead of `toISOString()`.
- Tests: +17 (`r6-gate1-fixes.test.ts`), csv-export test updated to local time expectation.
  334 unit ✅, typecheck ✅. Regression check: DEC-088 free-today (U), R-25 statement (U),
  GAP-027 retroactive (covered by moveToLocalDay test).
