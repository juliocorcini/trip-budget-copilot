# Gap-Fix Log — R4 Field Review (Julio's in-trip audio review)

- **Prompt**: `brain/documents/gap-fix-r4-implementation-prompt.md`
- **Note**: the previous file at this path (P2P sync round) was preserved as
  `src/gap-fix-log-r4-p2p-sync.md`. This round's decisions are DEC-114..123
  (D-R4-A..J — last DEC before this round was DEC-113, not DEC-102 as the
  prompt estimated).
- **Node**: `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"`

## Current State

- **Active gate**: GATE 2 (payer math)
- **Progress**: 3/12 requirements
- **Tests**: 343 unit ✅ · 29 e2e ✅ · typecheck ✅ · build ✅
- **Build**: v0.6.0

## GATE 0 — Baseline + decision-log ✅
- [x] DEC-114..123 (D-R4-A..J) registered as APPROVED in decision-log.md
- [x] State file created (old P2P r4 log renamed, references updated)
- [x] Baseline confirmed: unit ✅ 343 · typecheck ✅ · build ✅ · e2e ✅ 29

## GATE 1 — Visual polish ✅
- [x] R-01 carousel alignment — `scroll-pl/pr-[var(--page-padding-x)]` on the counters
      carousel: rest position = initial render (first card aligned, 3 visible)
- [x] R-02 insights one-per-gesture — `snap-always` on insight slides (and counter cards)
- [x] R-03 chip label fit — chip labels wrap with `break-words hyphens-auto line-clamp-2`
      (QuickAdd + ExpenseDetail); `<html lang>` now follows the active language

## GATE 2 — Payer math (CRITICAL)
- [ ] R-04 "someone else paid" keeps personal cost + creates debt (truth table)
- [ ] R-05 session reconciliation over personal cost, shares preserved

## GATE 3 — Occasions = sessions
- [ ] R-06 occasion counting groups by session everywhere

## GATE 4 — Simulator v3
- [ ] R-07 contextual simulator with labeled explanations + justified verdict

## GATE 5 — Honest outing limits
- [ ] R-08 zones/colors/copy change at the target

## GATE 6 — Long-press
- [ ] R-09 multi-select in lists (expenses + outing history)
- [ ] R-10 configurable dashboard (hide, quick action, reorder)

## GATE 7 — PWA outing notification
- [ ] R-11 persistent notification with quick-add actions (research + best effort)

## GATE 8 — Help mode
- [ ] R-12 contextual "?" with annotated screens (Funds, Planner, Wallets, Phase/Events, Outing, Backup)

## GATE 9 — Brain + final verification + deploy
- [ ] Brain updated (decision-log, product-spec, project-status)
- [ ] Version bump minor → 0.7.0
- [ ] Full validation: unit + typecheck + build + e2e
- [ ] R-01..R-12 "DONE quando" table confirmed in code
- [ ] 6 review smokes
- [ ] Deploy + URL

## Extras found (not fixed)

- (none yet)
