# Gap-Fix Log — R6 (audit bugs + field test fixes)

- **Prompt**: `brain/documents/r6-full-fix-prompt.md`
- **Baseline (Gate 0)**: 317 unit ✅ · typecheck ✅ · build ✅ · 29 E2E ✅ (v0.5.1)
- **Nota node**: wrangler/playwright exigem Node 22 → `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"`

## Current State

- Active gate: G1 (domain bugs)
- Last milestone: G0 baseline
- Tests: 317 unit / 29 e2e
- Build: OK
- Risks: none yet

## Gates

- [x] G0 — Setup + baseline
- [ ] G1 — Domain bugs (R6-01..05: BUG-001..004, PAR-006)
- [ ] G2 — P2P sync reliability (R6-06..07)
- [ ] G3 — QR scanner camera switch + zoom (R6-08..10)
- [ ] G4 — UI polish: carousel, gauge, iOS banner, keyboard (R6-11..14)
- [ ] G5 — Locale formatting (R6-15..18)
- [ ] G6 — Simulator v3 + learning prior (R6-19..22)
- [ ] G7 — Housekeeping + validation + deploy (R6-23..25)

## Milestones
