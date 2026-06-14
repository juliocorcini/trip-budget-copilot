# Stability Fix — IndexedDB "Couldn't load your data" dead end (DEC-170)

**Date**: 2026-06-14
**Version shipped**: 0.15.0 (SW cache v32)
**Status**: Fixed, tested (863 green), deployed to production
**Trigger report (Julio)**: After deleting a just-ended outing, the app got stuck on
"Não foi possível carregar seus dados". Every screen span forever or showed empty,
"Tentar novamente" did nothing, and **even fully closing and reopening the installed
app did not recover**. Backup/export also failed. Mandate: this must *never* reach the
user; if it happens internally the app must self-heal (reconnect / restart from within
/ "blink") and never leave the user without access to their data.

---

## 1. What the user saw (symptom map)

| Surface | Behavior reported |
|---|---|
| Delete a just-ended outing | Immediately threw the "couldn't load your data" screen |
| Re-open Expenses → Outings | The outing was gone (so the delete *did* commit) |
| Dashboard / home | Stuck on the error screen; "Tentar novamente" inert |
| Planner, Edit phases | Spinner that never ends ("fica carregando e nunca sai") |
| Funds, Wallets, Profiles, Debts, Outing history | Loaded but **empty** ("nenhum perfil", "nenhuma saída") |
| Backup / export / send-to-device | "A operação falhou, nada foi alterado" |
| Full app restart (from the phone) | Still the error screen — **did not recover** |

The tell-tale combination — *the write committed, then every connection went bad, and a
full restart didn't fix it* — is the signature of a wedged IndexedDB engine, not a logic
bug in our delete.

## 2. Root cause (the "porquê")

### 2.1 It is NOT the delete code
`softDeleteOutingSessionsBatch` (`domain/orchestrators/batch-orchestrators.ts`) is a
single atomic `db.transaction('rw', [...all four tables...], …)` that only awaits Dexie
calls inside the callback — no external promise, no nested transaction, no out-of-scope
table. That is the exact shape that **cannot** deadlock Dexie. Audited the sibling
delete/cascade paths (`deleteBudgetPool`, `deletePhase`, `endOutingSession`) — all clean.
So the delete is only the *straw*: a burst of writes right as the app is being
backgrounded / under memory pressure.

### 2.2 It IS the WebKit/iOS IndexedDB failure family
Two well-documented WebKit bugs explain every symptom:

- **Connection lost** — WebKit bugs **273827 / 277615** (regressed on iOS **17.4+**):
  a live connection starts throwing `UnknownError: Connection to Indexed Database server
  lost` because the OS **killed the per-origin IDB server process** (memory pressure, or
  a write racing a background transition — an outing keeps notifications/camera/frequent
  writes alive, then the app is backgrounded). The handle is dead; the community finding
  (Dexie maintainers, Odoo POS fix, "Safari Showstoppers") is that `db.close()`+reopen
  alone recovers only ~1/3 of cases — a **full page reload** is the reliable fix.
- **First-open hang** — the **2021** WebKit bug where `indexedDB.open()` stays `pending`
  forever and **no event fires** (not even `onblocked`). Any code that `await`s open with
  no timeout spins forever → the infinite spinners.

### 2.3 Why the OLD recovery couldn't escape
The previous `retry()` did `db.close()` + an in-page re-read. Against this family that
(a) often fails to revive a dead connection and (b) does nothing for a hung *open* — so
"Tentar novamente" looked dead, the spinner never ended, and there was **no escalation to
the one thing that works (a reload)**. Hence the inescapable dead end.

### 2.4 Why "empty" on some pages was extra dangerous
A half-recovered connection can resolve a read with an empty result. Pages that treated
"no rows" as "no data" risked showing emptiness (and historically risked bouncing to the
destructive `/welcome`). The data was always physically on disk (soft-delete + local
first) — the failure was purely *access*.

## 3. The fix — one owned escalation ladder (`data/db/db-recovery.ts`)

Every data entry point now flows through this ladder, so the app self-heals and is never a
dead end:

1. **Watchdogs** — `openWithWatchdog` (8 s) on every open + `withTimeout` (10 s) on the
   whole load. A hung WebKit open/read now *fails fast* into recovery instead of spinning.
2. **Tier 1 — silent self-heal** (`recoverConnection`): close the (possibly dead) handle,
   400 ms backoff, reopen under the watchdog, re-read. `useAppData.runLoad` runs this on
   any failure before showing anything; a transient blip is invisible to the user.
3. **Tier 2 — bounded reload** (`escalateToReload`): the reliable WebKit recovery is a
   full `location.reload()` (the user-approved "blink / reinicia por dentro"). A
   **localStorage-persisted budget (max 3 / 90 s)** survives the reload it triggers, so a
   reload loop is *impossible*; a healthy load clears the budget.
4. **Tier 3 — never-dead-end UI** (`DataErrorScreen`): only after the ladder is spent. It
   states the data is SAFE, **auto-retries every 10 s on its own** (the moment the OS frees
   the IDB process it heals with zero user action), has a reload button that actually
   works, and an **emergency export kept in the main bundle** so data can always be
   rescued. It never routes to `/welcome`.
5. **Multi-context guards** (`database.ts`): `versionchange` closes our connection so a new
   deploy/tab's upgrade is never *blocked* (another "database didn't respond" hang);
   `blocked` is logged to the crash buffer.
6. **Resilient code-split** (`lazyWithRetry` + `LoadingFallback` 12 s stall watchdog): a
   chunk that never resolves (WebKit stall or flaky post-deploy fetch) becomes a "reload"
   prompt instead of an eternal Suspense spinner — the "Planejar fica carregando" symptom.

## 4. How each original symptom is now handled

| Original symptom | Now |
|---|---|
| Stuck on error after delete | `runLoad` catches → `recoverConnection`; if dead → bounded reload; data returns |
| "Tentar novamente" does nothing | `retry()` now runs the real close+reopen+re-read ladder |
| Spinner that never ends | open watchdog (8 s) + load timeout (10 s) + lazy stall watchdog (12 s) |
| Full restart didn't recover | `DataErrorScreen` auto-retries every 10 s → heals itself once the OS frees IDB |
| Backup/export failed, no way out | Emergency export button on the recovery screen, in the main bundle |
| Bounced toward empty/welcome | Every page guards `error → DataErrorScreen`, never `/welcome` on error |

## 5. Tests

- `src/tests/unit/data/db-recovery.test.ts` — watchdog timeout, connection-lost
  classification, the persisted bounded-reload budget, auto vs manual escalation, and a
  real close+reopen on a fake-indexeddb instance.
- `src/tests/unit/components/data-error-screen.test.tsx` — safe-data messaging + working
  retry / reload / emergency-export.
- `src/tests/unit/hooks/use-app-data-error.test.tsx` (rewritten) — silent self-heal on a
  transient blip; error surfaced only when recovery is genuinely exhausted; throttled
  foreground auto-retry.
- Full suite: **863 passing / 103 files**; `tsc --noEmit` clean; build clean.

## 6. Deliberately deferred (with reason)

- **Close the connection on every background (`visibilitychange`) as prevention** — real
  risk of aborting an in-flight write and a larger behavioral change. The recovery ladder
  already neutralizes the wedge when it occurs; revisit only if incidents persist in the
  field.
- **Auto `deleteDatabase()` + rebuild on wedge** — rejected outright: it would destroy
  local-first data, the one outcome that must never happen.

## 7. Field follow-up

If a wedge is ever observed again, the crash buffer (`recordCrash`) now tags
`db-recovery: reopen failed …` and `idb-blocked …`, so the next investigation starts with
evidence instead of guesswork.
