# Gap-Fix Log — R4 (P2P Sync)

## Current State

- **Active gate**: GATE 2 — worker
- **Progress**: 3/14
- **Tests**: 281 unit green (264 baseline + 17 sync) · typecheck clean
- **Risks**: none yet

## GATE 0 — Baseline + brain ✅

- [x] DEC-103..108 registered in decision-log.md
- [x] product-spec.md feature 25 + scope exclusions amended
- [x] technical-direction.md P2P layer + deps
- [x] meetings-log.md MTG-2026-06-10
- [x] Implementation plan: brain/documents/p2p-sync-implementation-prompt.md
- [x] Baseline tests: 264/264 green

## GATE 1 — Sync domain ✅

- [x] P2P-01 — Actor identity (identity.ts + getInstallationId in entity-factory)
- [x] P2P-02 — Protocol + chunking (protocol.ts, encoding.ts: fflate deflate + base64 + CRC32)
- [x] P2P-03 — QR codec (TPSYNC1: envelope) + statement/migration payloads;
      `Participant.linkedActorId` added (non-indexed) across factories/schema/fixtures

## GATE 2 — Worker

- [ ] P2P-04 — worker/ + SyncRoom DO + deploy

## GATE 3 — Transports

- [ ] P2P-05 — crypto + signaling client
- [ ] P2P-06 — WebRTC + relay fallback + manual 2-QR signaling

## GATE 4 — UI + migration

- [ ] P2P-07 — QrCodeDisplay + QrScanner
- [ ] P2P-08 — SyncTransferFlow + /sync route
- [ ] P2P-09 — Device migration (Backup page + Welcome)

## GATE 5 — Pairing + mirrored statements

- [ ] P2P-10 — Dexie v4 + types + backup v4 + repositories
- [ ] P2P-11 — QR pairing (add + retroactive link)
- [ ] P2P-12 — Send statement (owner → mirror)
- [ ] P2P-13 — Receive statement + confirm/reject + response queue

## GATE 6 — Final

- [ ] P2P-14 — verification, version 0.5.0, deploys, smokes

## Extras found (not fixed)

- (none yet)
