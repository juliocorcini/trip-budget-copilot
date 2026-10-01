<p align="center">
  <img src="TripPilot/public/icons/icon-512.png" alt="TripPilot" width="120" />
</p>

<h1 align="center">TripPilot</h1>

<p align="center">
  <strong>A real-time travel budget copilot that tells you what you <em>can</em> spend — not just what you already did.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-ELv2-blue" alt="Elastic License 2.0" />
  <img src="https://img.shields.io/badge/version-2.13-teal" alt="Version" />
  <img src="https://img.shields.io/badge/tests-3%2C241%2B%20passing-brightgreen" alt="Tests" />
  <img src="https://img.shields.io/badge/TypeScript-strict-blue" alt="TypeScript Strict" />
  <img src="https://img.shields.io/badge/React-19-61DAFB" alt="React 19" />
  <img src="https://img.shields.io/badge/offline--first-PWA-orange" alt="PWA" />
  <img src="https://img.shields.io/badge/platform-Web%20%2B%20Android-green" alt="Platform" />
  <img src="https://img.shields.io/badge/languages-pt--BR%20·%20en%20·%20es-yellow" alt="i18n" />
</p>

<p align="center">
  <a href="https://trippilot.pages.dev">🌐 Live App</a>
</p>

---

## The Problem

Every travel finance app looks **backward**: *"you spent €42 yesterday."*

TripPilot looks **forward**: *"You already spent €28 tonight. One more €7 drink still fits the safe ceiling. After that, stop."*

No existing app answers **"how many bar nights can I still afford?"** in real-time. TripPilot does.

---

## What I Built

A full-stack, production-grade travel budget app — from database schema to AI integrations to native Android widgets — used in real trips across Europe. Sole developer, end-to-end.

### By the Numbers

| Metric | Value |
|--------|-------|
| TypeScript source files | 612 (+ 334 test files) |
| Lines of code | ~126,000 (+ ~51,000 test lines) |
| React components (.tsx) | 157 |
| Domain modules (pure TS) | 52 |
| Feature modules (UI + hooks) | 45 |
| Automated tests (`it()` blocks) | ~3,400 |
| i18n keys per language | ~4,300 (pt-BR, en, es) |
| Commits | 580+ |
| Cloudflare Worker | ~3,900 lines (Durable Objects, KV, R2) |

---

## Key Features

### 🧠 Intelligent Budget Engine
Not just an expense tracker — a **decision engine**. The core domain layer is pure TypeScript with zero UI dependencies. All money is stored as integers (cents), with invariant-tested arithmetic across every surface.

- **Occasion-based forecasting** — thinks in "bar nights" and "market trips", not just raw numbers
- **Cofrinho (piggy bank buffer)** — under-budget days build a buffer; over-budget days draw from it first
- **Phase-scoped budgets** — multi-leg trips with independent budgets per phase
- **Rhythm & peak days** — weighted spending by day type (weekday vs weekend)

### 🍻 Outing Mode
Start a bar/restaurant session and get **live progressive alerts** as you spend:

- Quick-add buttons that learn your usual amounts
- Four escalating zones: under target → over target → over ceiling → over max
- "Next drink impact" always visible
- **"Amigo Sincero"** (Honest Friend) — contextual, factual voice that tells you where you stand

### 🤖 AI Integration (Groq LLM)
Three AI-powered features, all opt-in with privacy controls:

- **Natural language entry** — say *"Bruno paid €12.80 for tortillas, split between him, me and Débora"* → the AI plans the action, the device executes it through the same engines as manual entry
- **Receipt scanning** — photo → structured items → split among people
- **AI Copilot Planning** — bi-directional flow where AI asks about your destination, then generates a justified spending plan with local price intelligence

### 📊 Simulator & Scenario Planner
- **"Can I Spend?"** — input an amount, see the impact on everything before committing
- **Interactive planner** — `[-] N [+]` controls for each activity type, real-time margin recalculation
- **Trade-off suggestions** — *"1 fewer bar night = 2 more market trips"*

### 👥 Group Splits (Tricount Replacement)
Full **Tricount-style group expense splitting** — but with budget intelligence:

- Multi-payer, multi-expense events with running balances
- Minimum-transfer settlement algorithm
- **Public claim links** — shareable to anyone, no app needed
- Real-time live board via encrypted WebSocket relay
- **Rich WhatsApp previews** with OG cards generated server-side

### 🔗 P2P Device Sync (E2E Encrypted)
Two phones connect without accounts or a central database:

- **WebRTC DataChannel** for direct P2P (DTLS encrypted)
- **Cloudflare Durable Object** for signaling only (opaque relay, never sees plaintext)
- **AES-GCM encryption** — the key travels in the QR code, never reaches the server
- Debt mirroring, statement sharing, and undo propagation across devices
- Fallback paths: encrypted WebSocket relay, offline QR transfer

### 🗺️ Maps & Location
- **Satellite map** of every geotagged expense (Leaflet + Esri)
- Cluster tap to zoom, **long-press cluster to list** expenses
- Place names from reverse geocoding (OSM Nominatim), sticky for repeat venues
- Wise import derives merchant names automatically

### 📱 Android Native (Capacitor)
- **7 resizable home screen widgets**: free-today hero, quick actions, occasion counters, piggy bank, next event, converter with built-in calculator, daily summary
- **3-layer push notifications**: in-app WebSocket → Web Push VAPID → FCM
- OTA updates via Capgo (web changes ship without new APK)
- Hardware back button, safe areas, native camera/GPS/haptics

### 🌍 Multi-Currency
- Log expenses in any currency; the app converts and preserves both values forever
- Live exchange rates with automatic background refresh
- Freeze a rate per currency to avoid market drift
- **"See in my currency"** — pick a reference currency and see equivalents everywhere
- Built-in currency converter always ready

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React 19 + Vite 6                     │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────────┐ │
│  │ Features │  │Components│  │     181 .tsx files      │ │
│  │ (46 modules) │  │ (shared) │  │                        │ │
│  └────┬─────┘  └──────────┘  └────────────────────────┘ │
│       │                                                   │
│  ┌────▼──────────────────────────────────────────────┐   │
│  │              Domain Layer (pure TS)                │   │
│  │  52 modules · zero React imports · cents-based    │   │
│  │  budget/ forecasting/ splitting/ sync/ assistant/  │   │
│  │  outing/ planning/ insights/ group-split/ ...     │   │
│  └────┬──────────────────────────────────────────────┘   │
│       │                                                   │
│  ┌────▼──────────────────────────────────────────────┐   │
│  │            Data Layer (IndexedDB / Dexie)         │   │
│  │  Repositories · Schema v9 · Soft-delete · Sync   │   │
│  └───────────────────────────────────────────────────┘   │
│                                                           │
│  PWA · Service Worker · Offline-first · Capacitor 8      │
└──────────────────┬───────────────────────────────────────┘
                   │
        ┌──────────▼──────────┐
        │  Cloudflare Edge    │
        │  (zero-cost tier)   │
        ├─────────────────────┤
        │ Workers + DO        │  ← P2P signaling, AI proxy,
        │ KV                  │    share storage, push
        │ R2                  │    notifications, OG previews
        │ Pages + Functions   │
        └─────────────────────┘
```

### Design Principles

- **Local-first** — all data in IndexedDB, works 100% offline
- **Domain purity** — financial logic is pure TypeScript with zero React imports, fully testable
- **Orchestrator pattern** — engines coordinate smaller focused functions; orchestrators never contain heavy logic
- **Integer money** — `€12.34 = 1234 cents`, eliminating floating-point errors across the entire stack
- **E2E encryption** — shared data is AES-GCM ciphertext; the server stores what it can't read
- **Invariant testing** — critical financial paths have mathematical proof tests (e.g., the hero number on Home equals the per-day allowance map by construction)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript (strict), Vite 6, Tailwind CSS |
| **Local Storage** | IndexedDB via Dexie v4 (schema v9, soft-delete, reactive queries) |
| **State** | React Context + repositories (no global store) |
| **Routing** | React Router v7 (Data Mode) |
| **Edge Backend** | Cloudflare Workers + Durable Objects + KV + R2 + Pages Functions |
| **P2P** | WebRTC DataChannel + WebSocket signaling (Durable Objects) |
| **Encryption** | AES-GCM (client-side), DTLS (WebRTC), VAPID ES256 (push) |
| **AI/LLM** | Groq (Llama 3.3 70B + Whisper) via Worker proxy |
| **Native** | Capacitor 8 (Android), FCM push, home screen widgets |
| **OTA Updates** | Capgo self-hosted (web bundle OTA) + in-app APK installer |
| **Maps** | Leaflet + Esri satellite imagery + OSM Nominatim geocoding |
| **i18n** | react-i18next (pt-BR, en, es — ~4,300 keys each) |
| **Testing** | Vitest (unit/integration) + Playwright (E2E) |
| **CI/CD** | Cloudflare Pages auto-deploy, custom deploy script with version sync |

---

## Testing

**~3,400 tests** across 334 test files (~51K lines), covering:

- **Domain logic** — budget calculations, split algorithms, settlement engines, multi-currency conversions, forecast models, piggy bank ledger, debt resolution
- **Financial invariants** — mathematical proof tests ensuring numbers are consistent across surfaces (e.g., the Home hero amount equals the per-day allowance map bit-for-bit)
- **AI integration** — 57+ assistant tests covering intent parsing, entity resolution, plan generation, and edge cases like pronoun resolution in split scenarios
- **Fixture-based verification** — real trip data fixtures (actual spending from European trips) used to verify calculations match reality
- **E2E flows** — Playwright tests for critical user paths: trip creation, expense logging, backup/restore, share link lifecycle

```
npm run test          # ~3,400 unit/integration tests (Vitest)
npx playwright test   # E2E browser tests
```

---

## Project Structure

```
TripPilot/
├── src/
│   ├── app/                  # Routes, providers, layouts
│   ├── domain/               # Pure business logic (52 modules, zero React)
│   │   ├── budget/           # Budget engine, phase spend lens, allowance map
│   │   ├── forecasting/      # Occasion-based prediction, safe estimates
│   │   ├── splitting/        # Split engine, settlement, minimum transfers
│   │   ├── sync/             # P2P protocol, encryption, QR codec, mailbox
│   │   ├── assistant/        # AI intent parsing, resolution, planning
│   │   ├── outing/           # Session engine, alert zones, drink calculations
│   │   ├── group-split/      # Multi-payer events, claim links, balances
│   │   ├── insights/         # Dashboard insights, copilot, honest friend
│   │   ├── planning/         # Scenario planner, trade-off engine
│   │   ├── shopping/         # Unit-price comparator, AI extraction
│   │   └── ...               # 41 more domain modules
│   ├── features/             # Feature modules (46 — UI + hooks)
│   │   ├── dashboard/        # Home screen, cards, hero number
│   │   ├── outing/           # Active outing mode UI
│   │   ├── assistant/        # AI quick entry sheet
│   │   ├── split/            # Live bill split table
│   │   ├── group-split/      # Tricount-style group events
│   │   ├── planning/         # Interactive scenario planner
│   │   ├── simulator/        # "Can I Spend?" impact preview
│   │   ├── map/              # Satellite expense map
│   │   └── ...               # 36 more feature modules
│   ├── data/                 # Persistence (Dexie DB, repositories, sync transport)
│   ├── components/           # Shared UI components
│   ├── i18n/                 # Translations (pt-BR, en, es)
│   └── tests/                # 334 test files, ~51K lines
├── worker/                   # Cloudflare Worker (signaling, AI proxy, shares, push)
├── android/                  # Capacitor Android shell + 7 widgets
├── functions/                # Cloudflare Pages Functions (OG preview injection)
└── public/                   # PWA manifest, service worker, OG cards
```

---

## How It Works — A Real Scenario

You're at a bar in Madrid. It's Thursday night, day 12 of a 30-day trip.

1. **Open the app** → the hero shows **"€47 free today"** (your daily allowance after the cofrinho buffer absorbed yesterday's overspend)
2. **Start an outing** → set target €40, ceiling €55, max €70, avg drink €7
3. **Order a round** → tap +€21 (3×€7) → the app says *"€21 so far · 2 more drinks to the target"*
4. **Order another** → +€7 → *"€28 · 1 more drink to the target"*
5. **Wonder about one more** → the Simulator says *"€7 fits. You'd be at €35 — still under target. 3 bar nights still available this trip."*
6. **A friend paid** → say to the AI: *"Bruno paid 12.80 for the tortillas, split between him, me, and Débora"* → it creates the expense, records your €4.27 debt to Bruno
7. **End the outing** → confirm totals, the Honest Friend says *"On plan. You have 3 bar nights left and 5 market days covered."*
8. **Bruno opens a link** on his phone (no app) → sees the itemized split → marks as paid

All of this works **offline**. The AI features gracefully degrade to manual entry.

---

## Selected Engineering Decisions

| Decision | What & Why |
|----------|-----------|
| **Cents-based arithmetic** | All money is integer cents. No floating-point errors, ever. `€12.34 = 1234`. The sum of split shares always equals the expense total (Largest Remainder method for rounding). |
| **Pure domain layer** | 52 modules with zero React imports. Every financial calculation is a pure function: input → output, fully testable without DOM or mocks. |
| **E2E encryption by default** | Shared links use AES-GCM. The Cloudflare Worker stores ciphertext it cannot read. The key travels in the URL fragment (never sent to the server) or is escrowed for short-link UX. |
| **Orchestrator pattern** | Complex operations (expense registration, outing close, debt settlement) are coordinated by orchestrator functions that call smaller, focused units. No business logic in React components. |
| **Invariant-driven development** | Critical financial paths are verified by mathematical invariant tests. For example: the daily "free to spend" hero on Home must equal the per-day allowance map by construction — a test asserts bit-for-bit equality using real trip fixture data. |
| **Local-first with edge opt-in** | The app is 100% functional with zero network. The Cloudflare edge layer (Workers, KV, R2) only activates for opt-in features (sharing, AI, push) and adds zero cost at the free tier. |
| **Hibernation-aware Durable Objects** | After a production incident where non-hibernating WebSocket DOs exhausted the free-tier duration cap, all DOs were migrated to the Hibernation API — idle connections cost zero. |

---

## Running Locally

```bash
cd TripPilot
npm install
npm run dev         # → http://localhost:5173
```

```bash
npm run test        # Unit + integration tests
npm run typecheck   # TypeScript strict check
npm run build       # Production build
```

---

## Live

The app is deployed and actively used at **[trippilot.pages.dev](https://trippilot.pages.dev)**.

---

## AI-Assisted Development

This project was built with AI as a core part of the engineering workflow — not as a shortcut, but as a **force multiplier** for a solo developer building a production-grade app.

### What AI does in this project

| Role | How AI is used | What stays human |
|------|---------------|-----------------|
| **Implementation** | Cursor (Claude) writes code from detailed specs, following project rules and patterns | Architecture decisions, domain modeling, acceptance criteria |
| **Testing** | AI generates test files from real requirements, with concrete financial assertions | Test strategy, fixture design (real trip data), invariant selection |
| **Code review** | Multi-perspective AI review (correctness, performance, security, maintainability) | Final approval, merge decisions, risk assessment |
| **Documentation** | AI drafts specs, decision records, and orchestrator documents | Product decisions, trade-off resolution, prioritization |
| **Debugging** | AI traces root causes across the full stack from error reports | Field testing on real devices, reproducing edge cases |

### The engineering system behind it

The repo includes a **structured AI orchestration layer** (`.cursor/rules/` and `.agents/`) that makes AI assistance consistent and reliable:

- **Project rules** — always-on constraints the AI follows: code style, deployment checklist, testing standards, scope control
- **Specialist agents** — named roles (backend, frontend, database, security, test creator, debugger) with focused expertise and domain context
- **Implementation orchestrator** — a documented method (`/orchestrator`) for shipping changes as self-contained "waves" with gates, tests, and deploy checkpoints
- **Council system** — multi-perspective analysis for architectural decisions (4 independent viewpoints with red-team pass)
- **Brain as source of truth** — a knowledge base (`TripPilot/brain/`) with 490+ documented decisions, so the AI never contradicts prior choices

### Why this matters

AI-assisted development at this scale requires **engineering discipline**, not just prompting. The AI produces good code because the system around it — specs, rules, invariants, review gates — makes bad code hard to ship. The result is that a single developer can maintain a 126K-line codebase with ~3,400 tests, 52 domain modules, and continuous production deploys.

---

## About Me

I'm **Julio Corcini** — a full-stack developer who built this entire application solo: product design, architecture, domain modeling, frontend, backend, native Android integration, AI features, encryption, deployment, and testing.

This project demonstrates:
- **Full-stack ownership** — from IndexedDB schema design to Cloudflare Durable Objects to Android home screen widgets
- **Domain-driven design** — pure business logic separated from infrastructure, with 52 focused domain modules
- **Production-grade engineering** — ~3,400 automated tests, integer arithmetic for money, E2E encryption, invariant-driven development
- **Real-world AI integration** — LLM-powered features (text/voice entry, receipt scanning, planning) with privacy controls and graceful degradation
- **Shipping discipline** — 580+ commits, field-tested across real European trips, continuously deployed with OTA updates

---

## License

This project is source-available under the [Elastic License 2.0 (ELv2)](LICENSE.txt).

You can **view, fork, study, and learn** from the code. You **cannot** offer it as a hosted/managed service to third parties. See the full license for details.

---

<p align="center">
  Built with ☕ and real travel budgets by <a href="https://github.com/juliocorcini">Julio Corcini</a>
</p>
