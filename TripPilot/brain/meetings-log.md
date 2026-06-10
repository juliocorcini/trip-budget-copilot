# TripPilot — Meetings Log

> Last updated: 2026-06-10

## Format

- **ID**: MTG-YYYY-MM-DD
- **Date**: YYYY-MM-DD
- **Participants**: Who was there
- **Topic**: What was discussed
- **Decisions**: What was decided (linked to decision-log.md)
- **Action Items**: Who does what by when

---

## Meetings

### MTG-2026-06-08 — Product Definition Session

- **Date**: 2026-06-08
- **Participants**: Julio (Product Lead)
- **Topic**: Complete product definition from travel expense analysis to MVP specification
- **Duration**: Extended session (multiple iterations with 4 addenda)

**What happened**:
1. Analyzed Julio's 2024 Europe trip expenses using Wise statements and Tricount data
2. Identified core problem: no app answers "can I spend this now?" in real-time
3. Researched TravelSpend and identified feature gaps
4. Defined occasion-based forecasting model (vs. simple daily average)
5. Designed BudgetPool system for multi-phase trips
6. Specified Outing Mode with progressive alerts
7. Designed Scenario Planner with interactive trade-offs
8. Made technical stack decisions (PWA + React + Dexie)
9. Defined data model with 20+ entities
10. Established privacy rules (no personal data in public build)
11. Answered all blocking questions (budget splits, participants, alert tone, etc.)

**Decisions made**:
- DEC-001 through DEC-021 (see [decision-log.md](decision-log.md))

**Action Items**:
- [ ] Design system + wireframes — @Julio
- [ ] Generate Delivery 1 START-HERE.md — @Carol
- [ ] Implement Delivery 1 — @Marcelo @Carla
- [ ] Create private seed JSON for Julio — @Julio (after Delivery 1)

**Source material**: `research/base.txt` (raw conversation), `research/2026-06-08-product-definition-session.md` (structured summary)

---

### MTG-2026-06-10 — P2P Sync Council Session (R4)

- **Date**: 2026-06-10
- **Participants**: Julio (Product Lead) + Council (Strategist, Architect, Critic, User Advocate)
- **Topic**: Adding QR pairing + device-to-device sync (debts, backup migration) without a backend

**What happened**:
1. Julio researched transfer options for a backend-less PWA (Bluetooth ruled out on iOS; QR + WebRTC + minimal Cloudflare signaling chosen)
2. Council (4 perspectives) analyzed strategy, architecture, risks, and UX
3. Consensus: device migration first; pairing as optional upgrade; never bidirectional merge of money (owner/mirror model reusing DEC-071 confirmations)
4. Defined fallback chain: WebRTC → encrypted relay → two-QR offline → single-QR payload
5. Scoped V2 deferrals (group merge, real-time split, settlement handshake)

**Decisions made**: DEC-103..DEC-108 (see [decision-log.md](decision-log.md))

**Action Items**:
- [x] Register decisions in brain — @AI
- [ ] Implementation plan `documents/p2p-sync-implementation-prompt.md` — @AI
- [ ] Implement R4 gates + tests + deploy v0.5.0 — @AI
- [ ] Field-test pairing/migration between Julio's iPhone-Android pair — @Julio

---

*New meetings will be added as the project progresses.*
