# TripPilot Brain — Source of Truth

> Last updated: 2026-06-08

## Truth Policy

1. This folder is the **single source of truth** for all product decisions about TripPilot
2. If something is not documented here, it has NOT been decided
3. AI agents MUST read relevant brain files before answering product questions
4. Contradictions between brain files must be flagged, not silently resolved
5. All updates must include `> Last updated: YYYY-MM-DD` at the top

## File Index

| File | Purpose | When to read |
|------|---------|--------------|
| `product-spec.md` | V1 features, rules, scope boundaries | Any product question |
| `decision-log.md` | All 113 decisions with status (approved/pending/superseded) | Before making new decisions |
| `technical-direction.md` | Stack (locked), database, architecture, deployment | Any technical question |
| `implementation-phases.md` | 6 deliveries with acceptance criteria and estimates | Planning, scheduling |
| `project-status.md` | Current status, pending tasks, next steps | Status checks, standups |
| `competitive-landscape.md` | TravelSpend analysis, feature gap matrix, positioning | Marketing, positioning |
| `meetings-log.md` | Chronological log of meetings, decisions, action items | History, accountability |
| `research/` | Research outputs and raw source material | Deep dives on specific topics |

## Research Files

| File | Topic |
|------|-------|
| `research/base.txt` | Raw product definition conversation (source material) |
| `research/2026-06-08-product-definition-session.md` | Structured summary of all findings and decisions |

## How to Update

1. Read the existing file first
2. Make the update
3. Update the `> Last updated` date
4. If it's a decision, add it to `decision-log.md`
5. If it contradicts an existing entry, mark the old one as `SUPERSEDED` with a reference

## Naming Conventions

- Files: `kebab-case.md`
- Research: `research/YYYY-MM-DD-topic-name.md`
- Decisions: `DEC-NNN` format in decision-log.md
- Meetings: `MTG-YYYY-MM-DD` format in meetings-log.md
