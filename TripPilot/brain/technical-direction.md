# TripPilot — Technical Direction

> Last updated: 2026-06-17 (reconciled: native arc, receipt epic, shared-link backend, schema v9; corrected stale stack rows)

## Stack (LOCKED — DEC-003)

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| UI Framework | React 19 | Julio's JS expertise, large ecosystem |
| Language | TypeScript (strict) | End-to-end type safety |
| Build Tool | Vite | Fast dev server, optimized builds |
| Styling | Tailwind CSS | Utility-first, mobile-friendly |
| Local DB | IndexedDB via Dexie | Structured storage, reactive queries |
| State | React Context (`AppDataProvider` + `useAppData`) + repositories | Zustand was removed in D1 (DEC-068) — no global store |
| Forms | Controlled React state + Zod (`domain/validation/schemas.ts`) | Zod used for validation; React Hook Form NOT adopted |
| Dates | date-fns | Tree-shakeable, no moment.js weight |
| Unit Tests | Vitest | Vite-native, fast |
| Component Tests | React Testing Library | User-centric testing |
| E2E Tests | Playwright | Cross-browser PWA testing |
| PWA | Hand-written service worker (`public/sw.js`) + static `manifest.json` | Network-first nav + cache-first assets; Workbox/vite-plugin-pwa NOT used (DEC-082) |
| Hosting | Cloudflare Pages | Free tier, auto-deploy, Functions support |
| IDs | UUID v4 | Globally unique, merge-safe |
| Router | React Router v7 (Data Mode) | createBrowserRouter, sufficient for MVP |
| i18n | react-i18next | pt-BR initial, en/es structure prepared |
| Linting | ESLint + Prettier | Code consistency |

## Architecture Principles

1. **Local-first, offline-capable** — All data in IndexedDB, works without internet
2. **Domain logic is pure TypeScript** — No financial calculations in React components
3. **Orchestrator pattern** — Engines coordinate smaller functions
4. **Data model prepared for sync** — SyncMetadata (revision, deletedAt, sourceDeviceId) on all entities
5. **Cents-based money** — All amounts stored as integers (€12.34 = 1234)
6. **Explicit timestamps** — ISO 8601, local timezone considered
7. **Schema versioned** — Dexie migrations for IndexedDB schema changes

## Project Structure

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

## Database (IndexedDB via Dexie)

### Core Entities
Trip, Phase, BudgetPool, BudgetPoolPhaseLink, Envelope, Participant, Wallet, Transaction, ParticipantShare, Session, ActivityProfile, PlannedOccurrence, Settlement, ForecastSnapshot, AlertRule, AppSettings, ScenarioPlan, FuturePhaseReservePolicy, Device, Actor

### Device-local Entities (not in user backup, not synced)
LocalSnapshot — rolling 7-day on-device restore points (DEC-159); PlannedPurchase (DEC-175);
MailboxQueue (async encrypted outbox); Attachment — receipt photos (DEC-206);
ShareLink — owner-side AES key + write token for a shared participant link (DEC-207)

### Future Entities (types defined, not persisted yet)
UserAccount, Group, GroupMembership, SharedExpenseConfirmation

### Schema Version — Dexie v9 (as of 2026-06-17)
- Dexie **v9**. Device-local tables added since v5 (each a brand-new table, no `upgrade()` callback;
  NONE in `BACKUP_TABLE_KEYS`, so they never travel in backup/restore): `localSnapshots` (v5,
  restore-to-yesterday — DEC-159), `plannedPurchases` (v6 — DEC-175), `mailboxQueue` (v7, async
  encrypted mailbox), `attachments` (v8, receipt photos — DEC-206), `shareLinks` (v9, owner-side
  shared-link AES key + write token — DEC-207).
- Backup format advanced to **v6** (`normalizeBackupToV6`, chains from v1); planned-purchases
  included; the device-local tables above are excluded by design.
- Many additions are NON-indexed (no migration — ÂNCORA 18): `Transaction.externalRef` (Wise
  dedupe — DEC-200), location fields (DEC-157), `baseCurrencyAmountCents`/`exchangeRate` (DEC-158),
  app-lock fields (DEC-161, PIN stored only as a PBKDF2-SHA256 hash + salt), planned-income per
  phase (DEC-211 Wave D).
- `TransactionType = 'expense' | 'transfer' | 'settlement' | 'adjustment'` — there is **no `income`
  type yet**; a real money-in is planned as a new type (master-fix plan B8, DECIDED 2026-06-17).

### Key Design Rules
- All entities have SyncMetadata (id, createdAt, updatedAt, deletedAt, revision, sourceDeviceId) — except device-local `LocalSnapshot` (standalone, keyed by day)
- Soft delete (deletedAt) for merge-safe operations
- JSON backup includes schema version for migration compatibility
- `public/manifest.json` is static (no PWA build plugin); it declares PWA `shortcuts` and a `share_target` (GET → `/quick-add?title&text&url`) so the OS share sheet can pre-fill an expense (DEC-161). The hand-written service worker (`public/sw.js`) is network-first for navigations (SPA fallback to `index.html`, so shared routes work offline) and cache-first for hashed assets; bump `CACHE_NAME` to push a new manifest/SW to installed clients via the update toast (DEC-082).

## Deployment

```
React + Vite → Build → Cloudflare Pages (static)
                         ↓
                    PWA installed on phone
                         ↓
                    IndexedDB local storage
```

Local-first: all user data lives in IndexedDB. A small, portable, zero-cost edge layer exists for
opt-in features only (see "Edge/Server Layer" below) — it is never the source of truth and is E2E
wherever it touches user data (it sees ciphertext only).

## P2P Sync Layer (R4 — DEC-103..108)

```
Phone A (PWA)  ──QR (room code + E2E key)──▶  Phone B (PWA)
      │                                            │
      └────── wss://trippilot-sync Worker ─────────┘   ← signaling only
                  (Durable Object room)
      ◀═══════ WebRTC DataChannel (DTLS) ═══════▶      ← payload path
        fallback: AES-GCM ciphertext relayed
        through the same WebSocket room
```

- `worker/` — `trippilot-sync` Worker + `SyncRoom` Durable Object (SQLite class, free
  tier). Creates 6-char rooms, relays opaque messages between exactly 2 peers, expires
  via alarm. Deployed with `npx wrangler deploy` from `worker/`
- App layers: `src/domain/sync/` (pure protocol: envelopes, chunking, SHA-256 checksum,
  QR codec with CompressionStream + base64url, statement payloads) and `src/data/sync/`
  (WebRTC transport, signaling client, AES-GCM crypto, connection orchestrator)
- QR libs: `qrcode` (generation), `jsqr` (camera decode via getUserMedia)
- Dexie v4: `peerLinks`, `mirroredStatements`; `Participant.linkedActorId` (non-indexed)
- Backup format v4 (includes the new tables; v1–v3 files normalize on import)

## Edge/Server Layer (opt-in, E2E, zero-cost) — DEC-206/207

The same `worker/` project now exposes more than P2P signaling. It stays free-tier and never
holds plaintext user data:

- **Shared participant link** — `POST/GET/DELETE` over Cloudflare **KV** (`SHARE_STORE`). The
  owner uploads AES-GCM **ciphertext** of one participant's slice; the AES key lives only in the
  link `#fragment` (never sent to the server). TTL + revoke (delete) supported. The recipient is a
  no-install web view that pulls and decrypts client-side; "live" updates are best-effort while the
  owner app is open, otherwise async pull (DEC-207).
- **Receipt OCR `/ocr`** — proxies an opt-in image to Groq (no-train provider) and returns parsed
  items; disclosed in-app; manual entry always available; nothing is persisted server-side
  (DEC-206/209).

## Native Layer (Capacitor) — DELIVERED (DEC-204/205/210)

- **Capacitor 8** Android shell wrapping the same React build → installable **APK** (sideload-first;
  Play Store optional/future — B5 2026-06-17).
- Native local notifications with **no-open quick-add** value buttons; runtime permissions for
  GPS/notifications/camera; CSS safe-areas; hardware back-button; softened haptics.
- **Capgo** self-hosted **OTA**: web-only releases reach installed APKs without a new APK; an
  in-app self-update flow exists for full APK bumps. Web/OTA version (0.64.0) runs ahead of the
  latest packaged APK (0.56.0; minimum required 0.50.0) by design.

## Future Expansion Path

1. ✅ **Capacitor** → APK with native notifications + OTA (DEC-204/205/210) — DONE
2. ✅ **Cloudflare edge endpoints** → shared-link KV + OCR proxy (DEC-206/207) — DONE (opt-in, E2E)
3. **Remote multi-user GROUP sync** → still open (DEC-108 deferrals); 1:1 slice sharing done
4. ✅ **Multi-currency** → shipped frozen/manual FX (DEC-158)
5. **P2P V2** → group merge, real-time split, settlement handshake (DEC-108 deferrals)
6. **Money-in** → new `TransactionType = 'income'` (master-fix plan B8, DECIDED 2026-06-17)

## Testing Strategy (from Delivery 1)

- **Vitest**: Domain logic — budget calculations, splits, withdrawals, settlements, multi-phase pools, reserves, backup/import
- **React Testing Library**: Critical UI components
- **Playwright**: Main user flows (create trip, register expense, backup/restore)
- Priority: domain correctness first, then UI, then E2E

## i18n Strategy

- react-i18next from Delivery 1
- pt-BR as initial language, en/es structures prepared (empty)
- No hardcoded user-facing strings in components
- Code (variables, comments, functions) always in English

## Deployment Notes

- Cloudflare Pages handles SPA routing by default
- No _redirects needed initially; add only if refresh fails on sub-routes after testing
- Test direct refresh on: /quick_add, /outings/new, /outings/active, /simulator

## Development Methodology

- Tier 3 velocity standard (brain + phases + AI = ~3.3× compression)
- Phase-delivery packages with gate checkpoints
- Director-style delegation (Carol plans → specialists implement)
- Jessica reviews all schema decisions
- Domain logic tested before UI implementation

---

*Stack decisions are LOCKED. Changes require new DEC entry with council review.*
