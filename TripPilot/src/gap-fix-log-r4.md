# Gap-Fix Log — R4 (P2P Sync)

## Current State

- **Active gate**: GATE 6 — final verification + deploy
- **Progress**: 13/14
- **Tests**: 299 unit green (264 baseline + 35 sync/migration) · typecheck + build clean
- **Risks**: manual 2-QR mode depends on compressed SDP fitting the QR limit — verify on real devices

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

## GATE 2 — Worker ✅

- [x] P2P-04 — worker/ + SyncRoom DO + deploy
      (deployed at https://trippilot-sync.trippilot.workers.dev — POST /rooms ok,
      WS smoke: 2 clients, peer-joined + opaque relay verified)

## GATE 3 — Transports ✅

- [x] P2P-05 — crypto (AES-GCM 256, base64url key, unique IV) + signaling client + relay
- [x] P2P-06 — WebRTC transport + connection orchestrator (8s relay fallback decided by host)
      + manual 2-QR signaling + SyncSession protocol runner (tested with FakeChannel pair)

## GATE 4 — UI + migration ✅

- [x] P2P-07 — QrCodeDisplay (white card, quiet zone) + QrScanner (getUserMedia + jsQR,
      stream cleanup, permission-denied message)
- [x] P2P-08 — SyncTransferFlow state machine (send/receive, online QR session,
      offline 2-QR stepper, progress bar, recoverable errors) + /sync route
- [x] P2P-09 — Device migration: BackupPage send/receive cards + Welcome
      "Receive from another device"; receiver reuses existing import preview;
      lastBackupDate updated on successful send

## GATE 5 — Pairing + mirrored statements ✅

- [x] P2P-10 — Dexie v4 (peerLinks, mirroredStatements) + types + backup v4
      (normalizeBackupToV4) + repositories; migration tests on fake-indexeddb
- [x] P2P-11 — "My QR" + "Add by QR" in /shared + retroactive "Connect by QR"
      in the statement sheet + link badge; typing a name untouched
- [x] P2P-12 — "Send statement to [name]" (session QR; single-QR offline option
      when payload fits); responses applied on the same session via applyPeerResponses
- [x] P2P-13 — "Received from other devices" section + sheet with confirm/reject,
      timestamp always visible, pendingResponses queue + flush (owner-mirror-cycle test)

## GATE 6 — Final

- [ ] P2P-14 — verification, version 0.5.0, deploys, smokes

## Extras found (not fixed)

- (none yet)
