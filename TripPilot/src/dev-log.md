# Dev Log — TripPilot Implementation

## Current State
- **Active Delivery**: Field Feedback Round 2 — plan `brain/documents/improvements-master-plan-2026-06-16-round2.md` (22 items F1–F22, waves F→A→B→C→D→E). Julio chose to ship the NATIVE wave FIRST (testable APK early), then the web waves over the air. Council ran inline (`tech-lead-delegation.mdc`).
- **Active Milestone**: WAVE F DONE (0.50.0) — F12 QR camera permission, F1 backup → public Downloads (MediaStore), F13 no overscroll stretch. APK rebuilt (versionCode 16).
- **Last Green Test Run**: 0.50.0 — 1038 tests pass (117 files), tsc/web build clean. **Node 22 required** — Node 18 lacks `globalThis.crypto.subtle` and fails the 6 `domain/sync/ecies.test.ts` tests spuriously.
- **Build Status**: clean — web build green; `npx cap sync android` OK (8 npm plugins + local `DeviceFile`/`OutingNotifier`/`LiveOuting` classes); `assembleDebug` BUILD SUCCESSFUL.
- **APK**: `dist/trippilot.apk` (versionCode **16**, versionName **0.50.0**, 8.26 MB); convenience copy at `/mnt/c/Users/julio/Downloads/TripPilot-0.50.0-debug.apk`.
- **Deploy**: Production apex `trippilot.pages.dev` via `--branch=master` (verified serving `/version.json` 0.50.0, `/bundles/0.50.0.zip` 618 KB, `/trippilot.apk`). `requiredNativeVersion` 0.50.0 (a 0.49.0 APK is told to reinstall, never silently OTA'd).
- **Next**: Wave A (web, ships over the air to the 0.50.0 APK): F2 scrollbar hide, F3 sheet swipe-to-close, F7 recents polish, F21 amigo-sincero color + hide on_plan, F9 swipe-back bug, F5 cofrinho contextual, F8 check-in folded into hero, F6 compact (not 2-up), F10 interactive drag.
- **Confidence**: web/boundary 90% (1038 green; native paths `isNativeApp()`-guarded). Native runtime 70% until on-device — camera grant for QR, MediaStore Downloads write, and overscroll-never are `[device]` ACs.

#### Field Round 2 · Wave F — native APK (0.50.0) [items 1/12/13]
Source: Julio field feedback round 2 (big list). Order F→A→B→C→D→E: ship the native wave FIRST so the APK is testable on the phone, then the web waves OTA. Council ran inline (no subagents).
- [x] **F12 QR camera permission**: added `android.permission.CAMERA` + `uses-feature camera required=false` to the manifest. Root cause: Capacitor 8 `BridgeWebChromeClient.onPermissionRequest` ALREADY launches the runtime CAMERA request for `getUserMedia` (verified in `node_modules/@capacitor/android/.../BridgeWebChromeClient.java:113`), but Android denies an UNDECLARED permission before any prompt — so the only fix is declaring it. No WebChromeClient subclass, no new dep.
- [x] **F1 backup → public Downloads**: `@capacitor/filesystem` has no `Directory.Downloads` and Documents is sandboxed on Android 11+. New native plugin `DeviceFilePlugin.java` (`@CapacitorPlugin("DeviceFile")`, `saveToDownloads`) writes via `MediaStore.Downloads` (API 29+, no permission, `@RequiresApi(Q)`) with a legacy `getExternalStoragePublicDirectory(DIRECTORY_DOWNLOADS)` fallback. Registered in `MainActivity`. JS adapter `utils/native/device-file.ts` (`registerPlugin`); `file-share.ts` `saveFileToDevice` tries Downloads first, falls back to Documents (so an old APK / failure still saves). `_mimeType` is now used.
- [x] **F13 no overscroll stretch**: `MainActivity` sets `getBridge().getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER)` after `super.onCreate` — CSS cannot suppress the Android 12+ stretch edge effect. Added defensive `overscroll-behavior:none` under `html.cap-native` for scroll-chain bleed. Web/PWA untouched.
- [x] **Publish/APK**: `package.json` + `build.gradle` (versionCode 16 / 0.50.0) + `public/version.json` (version 0.50.0, `requiredNativeVersion` 0.50.0, `bundleUrl` 0.50.0.zip). `npm run build` → `cap sync` → `make-ota-bundle` (618 KB) → `assembleDebug` (8.26 MB) → `dist/trippilot.apk`. Deployed `--branch=master`; apex verified serving version.json/apk/bundle.
- [x] **Verify**: 1038 tests pass (Node 22), tsc/web build clean, `cap sync` OK, `assembleDebug` SUCCESSFUL. `[device]` ACs: scan a QR (camera prompt → opens), save a backup (lands in Downloads), scroll past the end (no stretch).

#### G6 native + G7 + G8b — One APK (0.49.0)
Source: Julio field feedback — item 6 ("enviar backup não abre o menu do celular"), item 7 ("ter uma opção de só salvar o backup … cria o json e salva no celular"), item 10 ("na saída ativa não chega o valor que cliquei na notificação"), item 11 ("a saída ativa parece com zoom e fica sambando ao arrastar"), item 20 ("atualizar a versão interna pela internet sem gerar APK para toda versão … e avisar quando o APK precisa ser atualizado"). Julio chose: do everything native in ONE APK; host the Capgo bundle + manifest on the same Cloudflare Pages.
- [x] **G6 native send/save (items 6/7)**: installed `@capacitor/share` + `@capacitor/filesystem`. New boundary `utils/native/file-share.ts`: `shareFileNative` (writes to `Directory.Cache` then opens the OS share sheet via `Share.share({url})`) and `saveFileToDevice` (writes to `Directory.Documents`, returns the URI). `domain/backup/csv-export.ts` `downloadFile` now routes through `shareFileNative` first on native (falls back to the web anchor/blob path); new `saveFile` (native → Documents, web → download). `BackupPage` "Enviar backup" unchanged in copy but works in the APK now; new "Salvar no aparelho" button (`handleSaveToDevice`, records `lastBackupDate`, toasts where it landed). i18n `backup.save_device*` (pt/en/es).
- [x] **G7 zoom/shake (item 11, CSS)**: `OutingPage` full-screen container `minHeight` was `calc(100dvh - var(--safe-top))`, but `.cap-native #root { zoom: 1.06 }` scales the layout so `100dvh` overflowed → the "zoomed/shaking" feel until the browser settled. Fixed to `calc(100dvh / var(--native-zoom, 1) - var(--safe-top))` so the height is pre-divided by the same zoom (web `--native-zoom` defaults to 1 → no change off-native).
- [x] **G7 notif value→screen (item 10, native event)**: `OutingNotificationPlugin.java` keeps a static `liveInstance` (set in `load()`, cleared in `handleOnDestroy()`) and a `notifyQuickAdd(amountCents)` that emits a Capacitor `quickAdd` event to JS; `OutingActionReceiver.java` calls it right after enqueuing a tap + reposting the notification. `utils/native/outing-notifier.ts` adds `addOutingQuickAddListener`; `utils/outing-notification.ts` registers it so a quick-add reconciles into the active-outing screen immediately (not only on the next resume).
- [x] **G8b Capgo live-update (item 20)**: installed `@capgo/capacitor-updater@8.49.3`; `capacitor.config.ts` → `CapacitorUpdater { autoUpdate:false, resetWhenUpdate:true }` (self-hosted/manual; never contacts Capgo Cloud; a fresh APK drops stale OTA bundles). Domain `version-check.ts` += `bundleUrl` on the manifest + status. Boundary `utils/native/live-update.ts` (all `isNativeApp()`-guarded, dynamic-imported): `notifyLiveUpdateReady` (commit current bundle so no rollback), `getCurrentBundleVersion`, `downloadAndApplyBundle` (skips if already on that version → `download` → `set` reloads). Boot `utils/live-update-boot.ts` (`registerLiveUpdate` in `main.tsx`): on a native cold start confirms the bundle then, when `web_update_available` + `bundleUrl`, pulls the zip and swaps it (silent on `apk_outdated` — Settings explains that). Settings "Buscar atualização" native path now APPLIES the OTA when eligible (toast `settings.update_web_applying`).
- [x] **Publish pipeline**: `public/version.json` → 0.49.0, `requiredNativeVersion` 0.49.0 (this APK introduces the native plugins), `bundleUrl` `https://trippilot.pages.dev/bundles/0.49.0.zip`. New reusable `scripts/make-ota-bundle.mjs` (fflate) zips `dist/` (minus `bundles/` + `trippilot.apk`) → `dist/bundles/<version>.zip`; run AFTER `cap sync` so the zip never bloats the APK. APK copied to `dist/trippilot.apk` so `apkUrl` serves the latest.
- [x] **Verify**: 1038 tests pass (117 files; version-check now asserts `bundleUrl` round-trips through parse + the two web-update branches), tsc --noEmit clean (app), web build green (`SettingsPage` 32.0 kB, `BackupPage` 16.8 kB, `OutingPage` 61.5 kB), `cap sync` lists all 8 plugins, `assembleDebug` SUCCESSFUL (versionCode 15 / 0.49.0). Native runtime ACs are `[device]` — to be confirmed on the phone.
- **Scope note**: live-update applies on COLD START only (no mid-session reload — respects ÂNCORA 10); a backgrounded→foregrounded app keeps its bundle until next launch, matching the mailbox "arrives on next open" model. The 0.49.0 OTA zip is published for pipeline validation but is never downloaded by a 0.49.0 APK (it reports up-to-date); it pays off on the next web-only release.

#### G6 (web slice) — Reset the app (item 3) + G8a — version awareness (item 20) (0.48.0)
Source: Julio field feedback item 3 ("colocar nas configurações uma opção para zerar o app … faz um ponto de restauração e um backup, e depois zera") and item 20 (the installed APK never updates its internal version from web deploys; he wants honest "check for update" + a warning when the bundle needs a newer APK). Option A: do these web-only slices first and deploy; the native backup share/save and Capgo live-update join the single APK later.
- [x] **Reset orchestrators (`domain/orchestrators/reset-orchestrators.ts`, pure)**: `resetKeepStructure` clears the transactional tables (`TRANSACTIONAL_TABLE_NAMES`: transactions, shares, sessions, sessionItems, settlements, forecastSnapshots, mirroredStatements, mailboxQueue) and reopens planned items (purchases → status `planned`, `linkedTransactionIds` []; occurrences → `linkedSessionId` null) so reserves stay active but their dangling links to the wiped activity are severed — all in ONE `db.transaction`. `resetWipeAll` clears every table then re-seeds default `appSettings` + a fresh device (next boot → onboarding).
- [x] **Reset UI (`SettingsPage`)**: Data & security → "Zerar o app…" opens a BottomSheet: pick a mode (keep structure / wipe all), type the localized confirm word (ZERAR/RESET/BORRAR), execute. `handleReset` ALWAYS downloads a full backup JSON first; keep-mode also writes a `localSnapshot` restore point then `resetKeepStructure` + reload; wipe-mode `clearEmergencySnapshot()` then `resetWipeAll` + `window.location.reload()` (so boot does not offer to restore the just-wiped data). i18n `reset.*` (pt/en/es).
- [x] **Version awareness domain (`domain/version/version-check.ts`, pure)**: `compareSemver` (numeric, segment-tolerant), `isNewerVersion`, `parseVersionManifest` (guard), `evaluateVersionStatus` → `up_to_date | web_update_available | apk_outdated | unknown`. The native-vs-OTA branch only fires when a newer bundle exists AND the installed APK predates `requiredNativeVersion`.
- [x] **Version awareness boundary (`utils/app-update.ts`) + UI**: `getNativeAppVersion` (via `@capacitor/app` `App.getInfo()`, null on web), `fetchVersionManifest` (absolute `https://trippilot.pages.dev/version.json`, no-store), `resolveAppVersionStatus` (parallel fetch → pure eval). `SettingsPage` "About" shows the web bundle version always and the installed APK version on native; "Buscar atualização" keeps the SW flow on PWA but on native answers honestly (up to date / web update available / APK outdated with a tap-to-download link). Manifest published at `public/version.json`. i18n `settings.version_native_label`/`update_web_available`/`update_apk_outdated`.
- [x] **Verify**: 1038 tests pass (117 files; +3 reset [keep clears entries/keeps skeleton/reopens plans+severs links; wipe re-seeds onboarding], +14 version-check [compare, parse, all 4 status branches]), tsc --noEmit clean, web build green (`SettingsPage` 33.9 kB). No schema/dep change (G8a reuses installed `@capacitor/app`). Deployed to Production apex (0.48.0).

### Field Feedback Round — plan `improvements-master-plan-2026-06-16.md`

#### G5 — P2P encrypted mailbox (item 8) (0.47.0)
Source: Julio field feedback item 8 — "agora usando o cloudflare worker a parte de comunicação entre aparelhos não dá pra ficar melhor? conexão entre celulares pelo worker, envio de notificações de divisão, envio de backup e restauração". AskQuestion decisions: mailbox ON by default (drains on open), the device key lives INSIDE the encrypted backup (restore keeps pairing — accepted trade-off), and incoming items always preview/confirm.
- [x] **Worker mailbox (`worker/src/index.ts`)**: new `Mailbox` Durable Object addressed by recipient `actorId` (`/mailbox/:actorId` — POST puts a sealed blob, GET drains+deletes). Chunks values under the 128 KiB DO limit (120 KB), caps (40 msgs / 4 MB total / 1 MB per msg), sliding 7-day TTL via `alarm()`. Stores ONLY opaque ciphertext — never plaintext, never who-talks-to-whom (sender id is inside the sealed blob). `wrangler.jsonc` += MAILBOX binding + migration v2. Deployed; smoke-tested via curl.
- [x] **End-to-end crypto (`domain/sync/ecies.ts`, pure)**: ECIES — per-message ephemeral ECDH P-256 → HKDF-SHA256 → AES-256-GCM, blob = `ephPub||iv||ct` (base64url). `open()` returns null on tamper / wrong-recipient (caller silently skips). Device identity (`data/sync/identity-crypto.ts`) is a load-or-create EXTRACTABLE keypair persisted in `AppSettings.deviceIdentity` (JWK) so it travels in the backup; `mailbox-envelope.ts` deflates+packs the `{kind,fromActorId,fromName,data}` envelope before sealing.
- [x] **Identity carries the key**: `IdentityQrPayload` += optional `pk` (base64url raw public key); `upsertPeerLink` stores the peer's `publicKey` (PeerLink += `publicKey`, additive non-indexed) and never wipes it when a later statement arrives without one. `setInstallationId` lets a replace-import adopt the backed-up `actorId` (pairing survives a new phone, per Julio).
- [x] **Send/drain orchestrators (`domain/orchestrators/mailbox-orchestrators.ts`)**: `sendPayloadToPeerMailbox` (seal → queue in local-only `mailboxQueue` table [schema v7] → flush); `flushOutbox` (POST pending, retry on next open); `drainMailboxIntoApp` (drain → open → route: statement → `storeMirroredStatement` [the existing confirm surface]; backup → local inbox awaiting confirm); `applyInboxBackup`/`dismissInboxItem`. Driven from outside React by `utils/mailbox-boot.ts` on boot + `online` + foreground (30s throttle), dispatching `MAILBOX_DRAINED_EVENT`.
- [x] **UI**: Shared expenses — "Enviar pela caixa postal" on the send sheet when the peer has a key (reuses the exact statement payload). Backup — received-backups inbox (merge/replace + apply/dismiss; nothing auto-applies) and "send via mailbox" to a paired device. Settings › Data — "Caixa postal · Buscar mensagens ao abrir" toggle (default on, ÂNCORA 8 escape hatch) with a privacy hint. i18n pt/en/es (`mailbox.*`, `common.dismiss`).
- [x] **Verify**: 1021 tests pass (115 files; +9 ECIES: round-trip, ephemeral-uniqueness, wrong-recipient null, tamper null, malformed null, envelope pack/unpack, name-trim, garbage/unknown-kind reject, full seal→unseal→unpack), tsc --noEmit clean (app + worker), web build green (`BackupPage` 19.3 kB, `SharedExpensesPage` 22.1 kB), worker deployed + curl smoke test green. Local-only queue table (not in BACKUP_TABLE_KEYS); additive non-indexed AppSettings/PeerLink fields → no migration. Deployed to Production (0.47.0).
- **Scope note (V1)**: statements deliver one-way owner→peer over the mailbox (the confirm/response handshake still uses the live channel); backups deliver one-way with an inbox confirm. The mailbox is account-less and addressed by `actorId` — to receive, a peer's public key must have been captured at QR pairing (links paired before 0.47.0 must re-share once).

#### G4 — Settings overhaul + savings goal on its card + curated 2-up grid (0.46.0)
Source: Julio field feedback items 4, 5, 16 — Settings was "extremamente difícil de usar, desorganizada, uma lista muito grande" (nothing may disappear, only reorganize); the savings goal felt "jogado lá" in Settings and should be editable where it lives (its home card); the home should not be a pure list — compact cards (his example: "compras pessoais e compras planejadas") should be able to share a row, but only when curated/opted-in and there are enough of them.
- [x] **Settings — single page, search + collapsible (item 4)**: `SettingsPage` keeps every existing control but wraps the 7 sections in `CollapsibleGroup` (collapsed by default, open/closed persisted in `localStorage` `tp.settingsGroupsOpen`). A search header filters by each group's translated label + a multilingual `keywords` string (`SETTINGS_GROUPS`); while searching, matching groups force-expand and non-matching ones self-hide, with a "nada encontrado para …" line. ÂNCORA 9 — nothing removed, all one tap/one search away. i18n `settings.search_placeholder`/`search_no_results`.
- [x] **Savings goal editable from its card (item 5)**: the `savings_goal` dashboard card now opens a `SavingsGoalSheet` (edit amount / remove) instead of routing to Settings; `DashboardPage.handleSaveSavingsGoal` persists `savingsGoalCents` (null clears) and reloads. Read-only motivation preserved (ÂNCORA 11 — never an input to free-to-spend). The Settings › Money goal control stays as the secondary shortcut. i18n `dashboard.goal_edit`.
- [x] **Curated 2-up grid (item 16)**: catalog `pairable` flag on the compact single-number cards (`savings_goal`, `piggy_bank`, `planned_purchases`, `funds_summary`); per-card opt-in stored in new `AppSettings.dashboardPairedCards` (non-indexed, backfill `?? []` + seed `[]`, backup `.passthrough()` → no migration). Pure `groupDashboardRows(sequence, pairableNow)` folds the visible sequence into full rows or side-by-side pairs — a card pairs only when opted-in AND has content AND is adjacent to another such card; the day's lens-focus card is excluded so it keeps full width. Uniform compact tiles (`renderCompactCard`) render half-width pairs; full rows render the rich card unchanged. Opt-in is reachable from the long-press card sheet and the "Configurar tela inicial" page (`view_column` toggle). i18n `dashboard.card_pair_on`/`card_pair_off`.
- [x] **Verify**: 1012 tests pass (114 files; +12 dashboard tests: `pairable`/opt-in toggles + `groupDashboardRows` full/pair/separator/leftover/adjacency cases), tsc --noEmit clean, web build green (`SettingsPage` 27.4 kB, `DashboardPage` 59.5 kB). Additive non-indexed setting, no schema/migration, no budget mutation. Deployed to Production (0.46.0).

#### FIELD-19 — Per-day allowance map + clearer hero math (0.45.0)
Source: Julio field feedback round 2 — "livre hoje €3.96" was scary in isolation (is that every day, or just this weekday?); he wanted a Copilot-map-like view of how much is free *per day* across the phase, plus the planned items per day, and the hero secondary line spelled out as a subtraction.
- [x] **Per-day map domain (`domain/phases/allowance-map.ts`, pure)**: `buildPhaseAllowanceMap` projects the SAME start-of-day base (`trueFree + todaySpent`) over every remaining day using the rhythm weights/effective-days denominator — so the today cell equals `calculateTodayFreeBudget` exactly (pinned by a test), and future weekend peaks read taller than weekdays. Dated reserves overlay their day (occurrences by `plannedDate` unless linked; planned buys by `targetDate`, status `planned`); trip-wide undated planned buys returned apart. Exposed via `model.phaseDayMap`.
- [x] **UI (hero breakdown sheet)**: below the existing "where this number comes from" lines, a `PhaseDayMapSection` — one row per remaining day with a proportional bar (purple=today, orange=peak, green=normal), the day's free amount, dated reserve chips beneath, an "undated planned" group, and a legend. Lives where Julio already looks (tap the hero), as he asked.
- [x] **Hero copy (item 18 follow-up)**: `dashboard.hero_phase_total` changed from "de X na fase · Y no plano" to "X na fase − Y no plano" (pt/en/es) so the 522 − 356 = 166 math is explicit.
- [x] **Verify**: 1004 tests pass (114 files; +8 `allowance-map`: even split, today==hero, peak>weekday, dated reserve placement, undated separation, bought/cancelled/linked ignored, phase-over empty, estimated fallback), tsc --noEmit clean, web build green. No schema/dep change, no budget mutation (ÂNCORA 12). Deployed to Production (0.45.0).

#### Item 20 — OTA update + version awareness (PLANNED — awaiting decision, G8)
Source: Julio field feedback round 2 — the installed APK never updates its internal version from web deploys; he wants web-only releases to update over the air without rebuilding the APK, and to be warned when a web bundle needs a newer APK. Diagnosis confirmed: no `server.url` → APK serves bundled `dist`, so `reg.update()` re-fetches the local `sw.js` (never changes). Recommended path documented in the master plan (G8): `@capgo/capacitor-updater` self-hosted (zip + `latest.json` with `requiredNativeVersion` on Pages), with `@capacitor/app` (already installed) reading the native APK build for the "APK outdated" warning. Blocked on Julio's approach choice (adds a native dependency + hosting scheme → one APK rebuild).

#### G3b — Wise TRANSFER intelligence + split (0.44.0)
Source: Julio field feedback item 14 + AskQuestion decisions — a `detailsType=TRANSFER` row to a PERSON (e.g. "Enviou dinheiro para Bruno Pessoa de Oliveira", −44€) is not a card purchase: it can pay a debt, reimburse an expense the person paid for me, move money between my wallets, or be my own expense — and one transfer can mix several (his real case: 30€ owed back + 14€ of outing expenses Bruno covered). Decisions: split into pay_debt / person_paid_expense / wallet_transfer / my_expense; suggest the most likely participant pre-selected (I confirm); incoming = offer "they paid me back" (settles what they owe me).
- [x] **Classification (`domain/import`)**: `WiseDraftKind` += `transfer` (a `TRANSFER` row WITH a counterparty, either direction) — checked before credit/fee/expense; drafts gain `counterpartyName` + `direction` (`out`/`in`). Transfers are NOT `importable` (the plain-expense commit path skips them) so a transfer never gets accidentally booked as a stray expense. Manual-dup hint restricted to expense/fee. New `summary.transferCount`.
- [x] **Transfer engine (`domain/import/wise-transfer.ts`, pure)**: `matchParticipantByName` (accent/case-insensitive, token-containment + first-name boost, owner excluded, confidence floor — "Bruno" ⊂ "Bruno Pessoa de Oliveira" scores ≥80); `WiseAllocation` model + `transferAllocationStatus` (the commit gate: slices must sum EXACTLY, each positive; `ignore` drops a slice); `buildDefaultAllocations` (out: settle existing debt first then reimbursed-expense remainder; no participant → plain expense; in: settle what they owe me, surplus left to the user).
- [x] **Commit orchestrator `commitWiseTransfers`**: maps each slice to tested primitives, atomic across transactions+shares+settlements — pay_debt → `createSettlement(I→person)`; person_paid_expense → expense paid-by-person (my full cost via `resolvePayerExpense`, budget hit) + `createSettlement(I→person)` (debt born & paid, net 0); wallet_transfer → `createTransferTransaction(Wise→other)`; my_expense → plain expense from Wise; settle_incoming → `createSettlement(person→me)`. Every record carries the transfer's `externalRef`. `undoWiseImportBatch` soft-deletes transactions(+shares)+settlements together.
- [x] **Dedupe**: added `Settlement.externalRef?` (optional, non-indexed → additive, no migration, backup-transparent) so a re-imported transfer that only paid a debt (settlement, no transaction) is still caught; classifier now also reads existing settlements' refs.
- [x] **UI (`WiseImportPage`)**: a "Transferências" section (separate from the expense review) lists each person transfer with a Pronto/Revisar chip + a one-line split summary; tap opens a classify sheet — participant chips (suggested one badged, inline "new person" create) + the debt context ("Você deve €X / te deve €Y") + a split editor (per-slice kind chips by direction, amount, category picker for expense slices, target-wallet picker for wallet moves, add/remove, live "Restante" that must hit 0). Commit button now imports expenses + ready transfers in one undoable batch. i18n pt/en/es (`wiseImport.transfer_*`, `alloc_*`).
- [x] **Verify**: 996 tests pass (113 files; +18 `wise-transfer`: match, split-sum, defaults, person_paid_expense net-zero, pay_debt clears pre-existing debt, wallet move, incoming, undo; +1 `wise-import` transfer-classification), tsc --noEmit clean, web build green (`WiseImportPage` 33.5 kB). Deployed to Production (0.44.0).
- **Scope note**: incoming "wallet inflow" (an arbitrary top-up) intentionally NOT built — there is no income transaction type (only expense/transfer/settlement/adjustment), so it would need a schema change (high-impact, deferred). Incoming settle-back (the valuable case) shipped.

#### G3a — Wise import made visible (0.43.0)
Source: Julio field feedback item 13 — the statement importer was buried inside Wallets ("muito escondida"); wanted it at the top of Gastos, kept in Wallets too.
- [x] **Entry on Gastos (item 13)**: an `upload_file` icon button in the Expenses header (visible on both sub-tabs) → `/import/wise`. Kept the existing Wallets entry untouched. Copy `expenses.import_statement` ("Importar gastos e movimentações") pt/en/es.
- [x] **Verify**: 977 tests pass (112 files; no new tests — pure UI entry), tsc --noEmit clean, web build green. No domain/schema/dep change. Deployed to Production (0.43.0).

#### G2 — Home numbers: truly-free + real check-in lens (0.42.0)
Source: Julio field feedback items 18, 17, 9. The hero "livre na fase" (988) ignored the planner reserve (alocado 414 → margem 574); the check-in was a read-only suggestion that didn't visibly change "free today"; and the piggy bank always sat under the check-in even when it wasn't the day's focus.
- [x] **Truly-free hero (item 18)**: new pure `calculateTrueFree(phaseFree, allocated, allocatedSpent)` in `domain/budget` subtracts only the *remaining* planner reserve (`allocated − allocatedSpent`, ≥0) so already-spent plan money isn't double-counted. `useDashboardModel` accumulates `allocatedCents`/`allocatedSpentCents` per planned profile (spent capped at planned) and exposes `model.trueFree`; hero number + today budget now derive from `trueFree.trueFreeCents`. Secondary line under the big number ("de €X na fase · €Y no plano") + a "Reservado p/ planejador" row in the hero mini-breakdown and in the tap-through sheet (`buildFreeToSpendBreakdown(fts, planReserved)` now reconciles to trueFree).
- [x] **Check-in real lens, compact (item 17)**: the hero "livre hoje" is now reframed by the active mode via existing pure `planCheckInDay` (calm trims, night reserves part, no-spend → 0); the complement ("guardado"/"antes da noite") shows as a small primary line. Read-only (ÂNCORA 12): trueFree hero + budget never move, only today's framing; an already-over day (base ≤ 0) keeps its real negative. The check-in result card lost its two tall stat boxes — now a one-line summary + the redistribute/lens payoff.
- [x] **Focus under check-in (item 9)**: `DashboardCards` reorders the *visible* sequence so the lens `focusCardId` (piggy bank / counters) renders right under `daily_checkin` — what sits below the check-in is the day's focus, not always the piggy bank. Pure reposition of an already-visible card (ÂNCORA 9: nothing hidden/removed).
- [x] **Verify**: 977 tests pass (112 files; +7 `true-free` tests covering the 988→574 example, anti-double-count, zero-reserve, negative clamp), tsc --noEmit clean, web build green. No schema change, no new deps, no budget mutation. Deployed to Production (0.42.0).

#### G1 — Navigation & continuity (0.41.0)
Source: Julio field feedback items 1, 2, 12, 15. Swipe must work from the empty background and page between the bottom-nav tabs; sub-pages opened scrolled; recents too tall.
- [x] **Global swipe pager (items 1+2)**: detector lifted to `AppShell` (full-height container) so a swipe from the background pages the tabs. Order is the single source `app/nav-tabs.ts` (Início · Gastos · Viagem · Copiloto; Copiloto drops in simple mode) via new `useTabPaging`. Gestures starting inside a horizontal scroller (carousels, chip rows — detected by computed `overflow-x` + real overflow) or a `data-inpage-swipe`/`data-no-tab-swipe` region are ignored, so carousels/insights keep their natural gesture. FAB overlay marked `data-no-tab-swipe`.
- [x] **In-page handoff**: Expenses (expenses↔outings) and Viagem (phase sequence) keep their internal swipe but, at the first/last sub-tab, hand the gesture to the neighbouring app tab — full bidirectional chain across all 4 tabs. Their swipe roots are tagged `data-inpage-swipe` so the shell pager defers to them (no double-fire).
- [x] **ScrollRestoration (item 12)**: `<ScrollRestoration/>` added in `RootLayout` — forward navigations reset to top (title + back button visible), back restores. Fixes Compras pessoais/planejadas etc. opening pre-scrolled.
- [x] **Compact recents (item 15)**: home "Gastos recentes" card is now one container with dense divided rows (icon + description + date·category + amount), max 3, "ver todos" → full list. Was a tall stack of full-size cards.
- [x] **Verify**: 970 tests pass (111 files; +2 `nav-tabs` order tests), tsc -b clean, web build green. No domain/logic changes, no new deps, no schema change. Deployed to Production (0.41.0).

### Gate 4 — Wise CSV statement import (0.40.0)
Source: user request — import the Wise card statements (3 real .csv files; file 1 == file 2, file 3 empty) as expenses, "best use of the data, without duplicating what already exists". Plan/council DEC-200. Wise = a wallet; the statement is where the card purchases live.
- [x] **Additive schema (no migration)**: `Transaction.externalRef?: string|null` (non-indexed) + `excludeFromLearning?` on `CreateExpenseInput`/`createExpenseTransaction`; zod `externalRef: z.string().nullable().optional()`. A historical batch never skews quick-value learning and a re-import is recognized by ref.
- [x] **Parser `domain/import/wise-csv.ts`**: RFC4180 tokenizer (quoted fields, escaped quotes, embedded newlines), `parseAmountCents` locale-robust (rightmost `.`/`,` is the decimal → handles `1.234,56` and `1,234.56`), `parseWiseDate` (DD-MM-YYYY[+time] → ISO), `parseWiseCsv` maps headers→`WiseStatementRow`, skips malformed/empty.
- [x] **Classifier `domain/import/wise-import.ts`**: cross-file dedupe by `TransferWise ID` (collapses the duplicated file), `guessCategory` (data-driven keyword rules, accent/case-insensitive, stems match inflections while short tokens like `bar`/`pub` stay whole-word), `extractCity` (trailing UPPERCASE merchant tokens), kind = expense|fee|credit (credits shown, never imported), status = new | duplicate_import (ref already on device) | possible_manual_dup (same day+amount as a MANUAL expense → shown unchecked), phase-by-date via `resolveActivePhase`.
- [x] **Orchestrator `commitWiseImport`**: atomic `bulkAdd` of the chosen drafts as expenses (externalRef `wise:<id>`, excludeFromLearning, exchangeRate null → base = amount, exact for the EUR wallet/EUR trip), returns ids for the undo toast (reuses `softDeleteTransactionsBatch`).
- [x] **UI `features/import/WiseImportPage.tsx`** (route `/import/wise`, entry from the Wallets header): multi-file picker → summary (found / new / already-imported / possible-dup / fees / credits) → target wallet chips (existing or one-tap "Wise EUR" creation) → per-row review (checkbox, category icon, merchant, day·city, signed amount, status chip) with select-new / clear-all → sticky "Import N · total" → undo. i18n pt-BR/en/es (`wiseImport.*` + `wallets.import_statement`).
- [x] **Verify**: 968 tests pass (110 files; +24 import tests run against the 3 real statements), tsc -b clean, web build (`WiseImportPage` chunk 15.96 kB) + cap sync + assembleDebug green, APK 0.40.0 (versionCode 14). Deployed to `main.trippilot.pages.dev`.

### Gate 3 — active-outing notification: value buttons + rich fallback (0.39.0)
Source: user report on One UI 7 (Android 15, no Live Update) — the fallback notification regressed: no value buttons, "visually not nice", and it should let you log an expense WITHOUT opening the app, using the SAME quick-add values as the outing screen. Plan/council DEC-199.
- [x] **Native plugin `OutingNotifier`** (`OutingNotificationPlugin.java`): a styled ongoing notification (accent color + colorized + BigTextStyle body computed from the i18n templates) with one action button per quick-add value. State (title, accent, base total, target, avg-drink, locale/currency, templates, the quick list, and the pending queue) lives in SharedPreferences so it can re-render with no WebView.
- [x] **Background tap → no app launch** (`OutingActionReceiver.java`): each button is a broadcast PendingIntent. The receiver enqueues `{amountCents, ts}`, bumps the running total and re-posts the notification — even if the process was killed (Android cold-starts it for the broadcast). Registered in the manifest (`exported=false`).
- [x] **JS reconciliation** (`utils/outing-notification.ts` + `utils/native/outing-notifier.ts`): the fallback branch now calls `OutingNotifier.show(...)` with the first 3 distinct session quick values (Android's action budget) + accent + body templates. `reconcileOutingQuickAdds()` drains the native queue on boot, on `appStateChange(isActive)` and on visibility-visible, persists each via the canonical `quickAddSessionExpense` orchestrator (same record the in-app quick-add and the SW produce), fires `OUTING_CHANGED_EVENT` (open OutingPage reloads) and re-syncs the authoritative total. End-of-outing drains before cancel so a last-second tap is never lost.
- [x] **Cleanup**: `utils/native/notifications.ts` reduced to the permission flow only (the old `LocalNotifications` outing notification + its open-only action listener are replaced by the plugin). `MainActivity` registers the new plugin.
- [x] **Verify**: 944 tests pass (108 files), tsc -b clean, web build + cap sync + assembleDebug green (native Java compiles), APK 0.39.0 (versionCode 13). Domain untouched; reconciliation reuses the tested orchestrator. Device-pending: tap-to-log on One UI 7.

### Gate 2 — active-outing height + FAB redesign (0.38.0)
Source: user report — (N4) the active-outing screen "lacks height mid-page", pushing quick-add buttons/values below the fold and forcing a scroll despite empty space; (N7) the "+" menu should look "more beautiful, perfect — what you expect from a FAB". Plan/council DEC-198 + DEC-201.
- [x] **N4 — outing fits one screen (DEC-198)**: root cause = the active-session container used `minHeight: 100vh`, but every route renders inside RootLayout's `.app-safe-top` (padding-top: var(--safe-top)), so the page overflowed the viewport by exactly the status-bar band and the bottom `flex-1` spacer pushed the quick-add grid off-screen. Fix: container → `minHeight: calc(100dvh - var(--safe-top))` (matches the AppShell pattern) and the quick-add block clears the system gesture bar with `padding-bottom: calc(var(--safe-bottom) + 12px)`. Header → quick-add now live on one screen.
- [x] **N7 — FAB speed-dial redesign (DEC-201)**: `components/FAB.tsx` reworked into a titled, sheet-like floating panel (grabber + "Ações rápidas" header, rounded 28px, surface card, shadow). The hero action ("Registrar gasto") spans full width with the primary accent (tint bg + ring + 48px chip + forward arrow); the rest read as a clean 2-col grid of tonal tiles (icon chip + label + 1-line desc). Reuses `sheet-up`/`sheet-down` (panel), `.stagger` (per-cell cascade) and the existing scrim. Still clears the (taller, safe-area) nav + center button. Dead `itemBg` field removed from the action model.
- [x] **Verify**: 944 tests pass (108 files), tsc -b clean, web build + cap sync + assembleDebug green, APK 0.38.0 (versionCode 12). No domain/logic changes; no new deps.

### Gate 1 — post-animation regressions (0.37.0)
Source: user report after 0.36.0 motion — (N1) floating detail sheets opening off-viewport at the page bottom; (N2) page transitions only animating from the 2nd visit; (N3) swipe working one way only and without animation, on Expenses + Trip. Plan/council: `post-animation-fixes-and-wise-import-plan-2026-06-15.md`.
- [x] **N1 — sheets back at the viewport bottom (DEC-195)**: root cause = `.route-view` page animation kept a `transform` at rest (`translate3d(0,0,0)` via `fill-mode: both`), and a non-`none` transform makes the element the containing block for its `position: fixed` descendants → every in-page `BottomSheet` anchored to the tall page bottom instead of the viewport. Fix: (a) page keyframes now end at `transform: none`; (b) `BottomSheet` is `createPortal`-ed to a new `#app-overlay-root` mounted **inside `#root`** (keeps the `cap-native` zoom) but **outside** the routed page (defense in depth). `main.tsx` adds the host.
- [x] **N2 — first-entry transition (DEC-196)**: root cause = `.route-view` wrapper lived in `AppShell`, so on the first visit it mounted empty during the lazy-chunk `Suspense` gap and the enter animation finished before the content arrived (only the cached 2nd visit looked animated). Fix: moved the wrapper into a new `RouteView` **inside** `LazyRoute`'s `Suspense` boundary — a suspending child doesn't commit its parent until resolved, so the wrapper always mounts with content. Removed the duplicate `route-view` from `AppShell` + QuickAdd/Simulator roots.
- [x] **N3 — bidirectional swipe + slide (DEC-197)**: `useHorizontalSwipe` already detected both directions; the gap was zero visual feedback (instant swap) and one-sided guards. Added `.pane-next`/`.pane-prev` keyframes (slide from the side matching travel) and a `paneDir` ref + ordered tab list driving both swipe and tap. `ExpenseListPage` (Expenses ↔ Outings) and `TripHubPage` (phase paging) now wrap their swappable content in a keyed pane that animates on every change, both ways.
- [x] **Verify**: 944 tests pass (108 files), tsc -b clean, web build + cap sync + assembleDebug green, APK 0.37.0 (versionCode 11). No domain/logic changes; no new deps.

### Motion Gate M1 — app-wide animation system (0.36.0)
Source: user request — "quero que o app tenha transições/animações, que eu me sinta abrindo uma página, componentes animados, fluido e profissional, sem exagero" + bug: FAB "+" shortcuts overlapping the bottom bar. Council (inline) + research → spec `brain/documents/animation-system-spec-2026-06-15.md` (DEC-194). CSS-first (View Transitions API rejected for global/hardware-back fragility; Framer Motion rejected for ~50KB + main-thread cost on mid-tier Android). Every animation is transform/opacity only.
- [x] **Motion tokens** (`styles/tokens.css`): `--motion-fast/base/slow` (120/220/320ms) + M3 curves `--ease-standard`, `--ease-accelerate` (exits) alongside the existing `--ease-out`/`--ease-spring`. `.btn-press` retuned to the token (scale 0.96).
- [x] **Foundation** (`styles/globals.css`): page keyframes (`page-in-fwd`/`page-in-back`), `.stagger` (nth-child cascade), FAB/sheet/toast keyframes, `.nav-ind` active-tab indicator, `.money-pulse`, and a **global `prefers-reduced-motion` reset** (animate skill / WCAG baseline).
- [x] **Page transition (the "open a page" feel)**: `RootLayout` `useNavDirection()` sets `<html data-nav=forward|back>` from `history.state.idx` (covers hardware/gesture back without touching navigate() call sites). `AppShell` wraps the Outlet in `<div key={pathname} class="route-view">` so only the routed content remounts+animates while the chrome stays put. Standalone task pages (QuickAdd, Simulator) get `route-view` on their root (mount-fresh). Outing skipped on purpose (multiple return branches + fullscreen Bar Mode).
- [x] **FAB fix + animation** (`components/FAB.tsx`): bug fixed — actions now clear the taller safe-area nav (`paddingBottom: calc(112px+var(--safe-bottom))`) AND the protruding center button, and the list scrolls internally (`max-h:100dvh`, `overflow-y-auto`) so the lowest item never lands on the bar. Enter = scrim fade + `.stagger`; exit = scrim-out + `.fab-panel-out`, kept mounted via new `useAnimatedPresence` hook.
- [x] **Sheet / toast / nav / money**: `BottomSheet` now animates **closed** too (presence hook, `sheet-up`/`sheet-down`); `Toast` reuses the shared `toast-in`; `BottomNav` active-tab indicator (`.nav-ind`) + `+`/`close` glyph spin; `AnimatedMoney` gains `pulseOnChange` (fires only on a real in-place change) — enabled on the piggy bank + wallet balances (the "money reacts" moment).
- [x] **Reusable hook**: `hooks/useAnimatedPresence.ts` keeps an overlay mounted through its exit (`{mounted, state}`); used by FAB + BottomSheet.
- [x] **Verify**: 944 tests pass (108 files), tsc -b clean, web build + cap sync + assembleDebug green, APK 0.36.0. No domain/logic changes; no new deps.

### Hotfix Gate H1 — device feedback (0.35.0)
Source: user diagnostics on SM-S918B / Android 15 (0.29.0 build) — `"LocalNotifications.then()" is not implemented on android` crash loop + UI feedback.
- [x] **Notification crash (root cause)**: `utils/native/notifications.ts` `loadPlugin()` returned the
      Capacitor `registerPlugin` proxy **from an async function**. The proxy traps every property get, so
      it looks thenable (`plugin.then` → a function); the Promise machinery then calls `.then()` on it and
      Capacitor throws `"LocalNotifications.then()" is not implemented`. Fired on every permission probe /
      visibility sync → the ~0.5s crash loop that left notifications permanently broken. Fix: `loadPlugin`
      now resolves a **plain holder** `{ plugin }` (non-thenable); all 5 callers updated. Permission
      request + ongoing outing notification now actually run.
- [x] **N1 redo — edge-to-edge safe areas (ALL screens)**: Android 15 forces a transparent overlaid status
      bar that `StatusBar.setOverlaysWebView({overlay:false})` can't fully cancel, so content bled behind it
      and standalone-screen back buttons (expense entry, outing) slid under it. Fix is CSS-driven:
      `--safe-bottom` token added; `.app-status-band` (fixed, `height:var(--safe-top)`, `var(--surface)`,
      z-45, pointer-events:none) paints the inset opaque so nothing shows through; `.app-safe-top` pads
      content. Both live in **RootLayout** so EVERY route (in and out of the shell) is covered. AppShell
      drops its own `pt` (now from RootLayout) and uses `min-h-[calc(100dvh-var(--safe-top))]` to avoid a
      phantom scroll. Toasts offset to `calc(var(--safe-top)+1rem)`.
- [x] **Bottom nav spacing**: `BottomNav` gets `paddingBottom: max(var(--safe-bottom),10px)` (lifts the 4
      buttons above the gesture bar / off the bottom edge); AppShell bottom padding bumped to
      `calc(100px+var(--safe-bottom))` so content still clears the taller bar.
- [x] **Haptics softer (N8 tuning)**: `utils/haptics.ts` impact tiers softened one step (medium→Light,
      heavy→Medium; Light stays Light) and web-vibrate durations reduced — a discrete tick, not a buzz.

## Post-APK Improvements — Phase 1 (Native Shell Hardening)
Master plan: `brain/documents/post-apk-improvements-plan-2026-06-15.md`
Phase 1 package: `brain/documents/phase1-native-execution-package-2026-06-15.md`
Live Update spec: `brain/documents/live-update-nowbar-technical-spec-2026-06-15.md`

### Gate 4 — Android 16 Live Update + Now Bar ✅ (0.34.0) — [device]-pending: promotion/visual on real A16
Master plan Track B / Phase 4 (B1, B2). Spec: `live-update-nowbar-technical-spec-2026-06-15.md`.
- [x] **B1/B2 — Live Update for the active outing**: new custom Capacitor plugin
      `android/.../LiveOutingPlugin.java` (`isSupported`/`update`/`end`, registered in
      `MainActivity`). Posts a **promoted ongoing** notification via `NotificationManagerCompat`
      with `NotificationCompat.ProgressStyle` (a single app-colored segment, spend→target),
      `setRequestPromotedOngoing(true)`, `setShortCriticalText` (status-bar chip), `setColor`
      (app accent), ongoing, dedicated `outing_live` channel (IMPORTANCE_DEFAULT so it can be
      promoted), and an "open" content intent. On One UI 8 this surfaces in the **Now Bar**
      for free (consumes Android 16 Live Updates — no Samsung SDK needed, per spec §3).
- [x] **Adapter + integration (domain stays pure)**: `utils/native/live-outing.ts` wraps the
      plugin (cached `isSupported`, reads `--primary` for the accent, no-op on Web). The
      existing active-outing **notification bridge** (`utils/outing-notification.ts`) now routes
      to the Live Update when supported, else the proven LocalNotifications path.
- [x] **Gating = zero regression**: `isSupported()` returns true only on **API ≥ 36**. On the
      user's current (pre-16) device the LocalNotifications path is untouched; the Live Update
      lights up only where Android 16 exists. Manifest: `POST_PROMOTED_NOTIFICATIONS`. Pinned
      `androidx.core:core:1.17.0` for the Live Update NotificationCompat APIs.
- [x] **Verify**: 944 tests pass (108 files), tsc -b clean, web build + cap sync OK,
      **assembleDebug BUILD SUCCESSFUL** (native compiles against core 1.17.0), APK 0.34.0.
- **Self-check / regression**: domain untouched; only the infra notification boundary changed,
      behind `isNativeApp()` + `isSupported()`. Web/PWA + tests never load native code.
- **[device]-pending (next)**: real Android 16 validation of promotion (chip), live updates,
      color, Now Bar on Samsung One UI 8; optional B1.1+ (foreground service to survive process
      death, broadcast actions "+ rodada"/"encerrar", richer segments/points per the spec).

### Gate 3 — Gesture navigation + day fast-scroller ✅ (0.33.0) — [device]-pending: G1, G3 feel
Master plan §Phase 3 (G1, G3). Pure web/PWA UI (no native-only code).
- [x] **G1 — Swipe between tabs/phases**: new reusable `hooks/useHorizontalSwipe.ts`
      (decision on touch-end, no preventDefault, requires horizontal dominance 1.5× +
      60px threshold so vertical scroll is never hijacked). Wired into ExpenseListPage
      (swipe ↔ Gastos/Saídas) and TripHubPage (swipe through `['all', ...phases]`,
      clamped at the ends — cross-section bottom-nav swipe stays deferred per the plan).
      The horizontally-scrollable chip rows stop-propagate touch so they keep their own
      scroll instead of paging.
- [x] **G3 — Day fast-scroller (Google-Photos style)**: new `features/expenses/FastScroller.tsx`.
      Window-scrolled feed → a fixed right-edge rail that only mounts when the feed is long
      (≥8 day groups AND >800px overflow). Only the thumb is interactive
      (`pointer-events-none` rail so row taps pass through); grabbing it scrubs the page via
      `window.scrollTo` and a floating bubble shows the day currently under the finger, read
      live from the list's `[data-expense-day]` anchors. ResizeObserver keeps it synced when
      filters/search change the content height.
- [x] **Verify**: 944 tests pass (108 files), tsc -b clean, web build + cap sync OK,
      assembleDebug BUILD SUCCESSFUL, APK 0.33.0 → Downloads.
- **Self-check / regression**: no domain logic touched; expense list grouping/anchors are a
      pure DOM addition (`data-expense-*`); swipe + scrubber are additive. Filters/search/
      selection bar untouched. `[device]`-pending: gesture feel (thresholds) on real hardware.
- **Next (Gate 4)**: B1 Live Update (foreground service / ProgressStyle), B2 Now Bar.

### Gate 2B — Notifications reorg + day sheet + expense search ✅ (0.32.0)
Master plan §Phase 2 (U1, U4) + §Phase 3 (G2). Pure web/PWA UI (no native-only code).
- [x] **U1 — Notifications center reorg (DEC-090)**: the flat list is now grouped into
      labeled sections — `action` ("Precisa de você": pending_share, phase_over_budget),
      `today` ("Hoje": event_today, long_outing), `reminders` ("Lembretes": backup_due).
      Data-driven via `NOTIFICATION_GROUP`/`GROUP_ORDER`/`GROUP_LABEL_KEY`; empty groups are
      dropped, each header shows a count. Cards keep icon/tone/destination behavior.
- [x] **U4 — Month-map day sheet (DEC-131 moved to Copiloto)**: tapping a day on the
      Copiloto month map opens a `BottomSheet` listing that day's expenses (reuses the model's
      `heatmapDayTxs`, now fed by `heatmapDayIso` state) with per-item navigation + a day total,
      instead of jumping straight to the expense list. Empty day → `copilot.map_day_empty`.
- [x] **G2 — Expense search**: a search input atop the expenses tab filters the feed by
      description / place / translated category (case-insensitive substring). Clear button +
      a dedicated `search_off` empty state (`search_empty_title/body` with the query).
- [x] **i18n**: added `notifications.group_action/today/reminders`, `copilot.map_day_empty`,
      `expenses.search_placeholder/clear/search_empty_title/search_empty_body` (pt/en/es).
- [x] **Verify**: 944 tests pass (108 files), tsc -b clean, web build + cap sync OK,
      assembleDebug BUILD SUCCESSFUL, APK 0.32.0 → Downloads.
- **Self-check / regression**: no domain logic changed (UI-only); `heatmapDayTxs` was already
      in the shared model (was `[]` on Home, now actively used by the Copiloto sheet); expense
      filters compose with the existing category/profile/wallet/place chips.
- **Next (Gate 3)**: G1 swipe between tabs/phases, G3 fast-scroll/scrubber.

### Gate 2A — Home/Copiloto reorg + counters ✅ (0.31.0)
Master plan §Phase 2 (U2, U3, U5, U6). Web/PWA + APK (no native-only code in this gate).
- [x] **U5 — Daily analytics → Copiloto (DEC-180 G4)**: removed the `trip_analytics`
      collapsible drawer (yesterday recap + phase burn-down + month heatmap) from the
      Home. Copiloto already rendered the burn-down + month map; added the `RecapCard`
      (yesterday) there too, so ALL intelligence lives in the Copiloto. Removed the Home
      heatmap month/day state, the day-drill `BottomSheet` (DashboardSheets), and the
      `onToggleCollapse`/heatmap props through DashboardPage→DashboardCards. The collapse
      machinery (`isDashboardCardCollapsed`/`toggleDashboardCardCollapsed`/`collapsible`/
      `DEFAULT_COLLAPSED_CARDS=[]`) stays as dormant generic infra (still exported + tested;
      `collapsedDashboardCards` settings field kept → no migration).
- [x] **U6 — Unified occasion counters (DEC-180)**: new pure domain
      `domain/dashboard/occasion-counters.ts` → `buildOccasionCounters` returns ONE
      ordered list: planned metas first (forecasts with `totalPlanned>0` → remaining/done,
      occasion-counted per DEC-115), then per-category ITEM counts for every other category
      with expenses (phase-scoped), each with the unit label "gastos". A category covered by
      a meta is excluded from the activity counts (no double-count). Replaces the old
      forecast-only carousel + the hardcoded 3-cell bar/market/restaurant fallback. Model
      drops `barCount/marketCount/restaurantCount/hasOccasionData`, adds `occasionCounters`.
      5 unit tests (ordering, exclusion, unplanned-as-activity, expense-only, empty).
- [x] **U2 — Trip structure grid**: `TripHubPage` "Estrutura" is now a 3-col grid of icon
      tiles (6 destinations) instead of a vertical list.
- [x] **U3 — Copiloto tools grid**: the bottom "Ferramentas" list is now a 2-col grid of
      cards (icon + label + description).
- [x] **i18n**: added `dashboard.occasion_items` (pt/en/es); removed the now-unused
      `occasion_bar/market/restaurant`. `card_trip_analytics` left dormant (no catalog ref).
- [x] **Verify**: 944 tests pass (108 files), type-check (tsc -b) clean, web build + cap
      sync OK, `assembleDebug` BUILD SUCCESSFUL, APK 0.31.0 → Downloads.
- **Self-check / regression**: dashboard card sequence/hide/move tests updated (catalog no
      longer has `trip_analytics`); occasion card visibility now keys on
      `occasionCounters.length`; the model still computes recap/burndown/heatmap (Copiloto
      consumes them) — only the Home rendering moved. `heatmapDayTxs` left in the model
      (always `[]` now; harmless) to avoid reshaping the shared model.
- **Next (Gate 2B)**: U1 notifications center reorg (cards/groups), U4 month-map day sheet
      in the Copiloto, G2 expense search.

### Gate 1C — DPI calibration + haptics ✅ (0.30.0) — Phase 1 COMPLETE — [device]-pending: N7, N8
- [x] **M1C.1 — Haptics boundary (N8)**: new `utils/haptics.ts` — native uses
      `@capacitor/haptics` (lazy import: `impact` light/medium, `notification`
      success/warning/error); Web/PWA falls back to `navigator.vibrate`. Honors the
      "Vibration" setting via `setHapticsEnabled`, synced live in RootLayout
      (`useHapticsPreference`). Curated triggers: long-press select (`useLongPress`),
      FAB open + tab switch (`BottomNav`), action pick (`FAB`), and every
      success/warning/danger toast (`Toast.showToast` — the single source, info stays
      silent). Migrated the 4 old `navigator.vibrate` sites (didn't fire in the WebView)
      to the boundary and removed the now-redundant `triggerSaveHaptic` + `ALERT_VIBRATION`
      (toast carries those). Fixes "no vibration in the app".
- [x] **M1C.2 — UI scale calibration (N7)** [device]: the WebView rendered ~smaller
      than the installed PWA (Chrome applies the user's page-zoom/font prefs, a fresh
      WebView doesn't). `initNativeShell` tags `<html class="cap-native">`; CSS applies a
      single tunable `zoom: var(--native-zoom)` (default 1.06) on `#root` — scales px+rem
      uniformly (root font-size can't, the design mixes both). No-op on web (class never
      added). Knob lives in `globals.css` for a fast second pass after device check.
- [x] **Verify**: 941 tests pass, type-check (tsc -b) clean, web build OK, `cap sync`
      reports 5 plugins (app, geolocation, haptics, local-notifications, status-bar),
      `assembleDebug` BUILD SUCCESSFUL, APK copied to Downloads.
- **Self-check / regression**: haptics gated by `enabled` flag (off → fully silent) and
      `isNativeApp()` for the plugin branch; web bundle keeps the plugin out via lazy
      `import()`. Toast haptic only on success/warning/danger (no buzz on info). N7 zoom
      scoped to `.cap-native #root` → zero web impact. Changes confined to `utils/haptics.ts`,
      `useLongPress`, `BottomNav`, `FAB`, `Toast`, `RootLayout`, `utils/native/index.ts`,
      `globals.css`, and the 4 migrated feature files (QuickAdd, ExpenseDetail, Outing,
      DashboardCards), plus version files.
- **[device] pending**: N8 real haptic patterns + toggle on a real phone; N7 final zoom
      value (1.06 is a measured-guess — confirm/tune on device).
- **Next (Gate 2A)**: U5 daily analytics → Copiloto, U6 occasion counters model, U2
      structure grid, U3 tools grid.

### Gate 1B — Permissions & services ✅ (0.29.0) — [device]-pending: N5, N6
- [x] **M1B.1 — Native persistence reality (N4)**: storage is app-private in the
      APK (no browser eviction), so the data-loss warning + the persistent-storage
      Settings section are gated behind `!isNativeApp()`. Dashboard `showStorageWarning`
      and the Settings section hidden natively; Web/PWA unchanged; manual backup intact.
- [x] **M1B.2 — Native GPS permission (N5)** [device]: `utils/geolocation.ts` is now
      native-aware — `ensureLocationPermission()` calls Capacitor Geolocation
      (check/request) on the APK; `getCurrentCoords()` reads via the plugin natively
      and via `navigator.geolocation` on the Web (unchanged → existing tests pass).
      Settings location toggle requests permission BEFORE enabling and toasts on
      denial (`settings.location_denied`, 3 locales). Manifest gains
      `ACCESS_FINE/COARSE_LOCATION`.
- [x] **M1B.3 — Native notification base (N6)** [device]: new `utils/native/notifications.ts`
      (Capacitor LocalNotifications, lazy-imported). `outing-notification.ts` routes to
      the native path when `isNativeApp()` — permission (kills "browser does not support"),
      ongoing active-outing notification reusing the domain payload (`buildOutingNotificationPayload`,
      rich body), and a working "open" action (listener → `/outings/active`). Quick-add
      action buttons that WRITE to the DB are deferred to Track B (Live Update / foreground
      service). Web/PWA keeps the SW path untouched. Manifest gains `POST_NOTIFICATIONS`.
      Settings refreshes the async native permission on mount.
- [x] **Verify**: 941 tests pass, type-check (tsc -b) clean, web build OK,
      `cap sync` reports 4 plugins (app, geolocation, local-notifications, status-bar).
- **Self-check / regression**: every native path guarded by `isNativeApp()`; Web bundle
      keeps the plugins out via lazy `import()`; geolocation/outing-notification unit
      tests still green (web branch unchanged). Changes confined to `utils/geolocation.ts`,
      `utils/native/notifications.ts`, `utils/native/index.ts`, `utils/outing-notification.ts`,
      `SettingsPage`, `DashboardPage`, manifest, locales, version files.
- **[device] pending**: N5 OS dialog + coords on a real phone; N6 permission prompt +
      ongoing notification + open action on a real phone.
- **Next (Gate 1C)**: N7 DPI/scaling calibration (measure APK vs PWA), N8 haptics.

### Gate 1A — Native shell foundations ✅ (0.28.0)
- [x] **M1A.0 — Native boundary (N0)**: installed `@capacitor/status-bar@8` +
      `@capacitor/app@8`. New `src/utils/native/` module isolates all native calls
      behind `isNativeApp()` (Capacitor.isNativePlatform). Bootstrap via
      `initNativeShell()` in `main.tsx` — no-op on web, so PWA/domain stay pure.
- [x] **M1A.1 — Safe-area top (N1)**: `--safe-top` token = `env(safe-area-inset-top)`.
      AppShell pads `pt-[var(--safe-top)]`; sticky headers use `top: var(--safe-top)`.
      Fixes content (titles/back button) hiding behind the status bar.
- [x] **M1A.2 — Status bar follows theme (N2)** (DEC-192): `applyNativeStatusBar()`
      runs on every theme change in RootLayout — sets bar background to app color and
      icon style (Light/Dark) so icons stay legible in light theme.
- [x] **M1A.3 — Native back button (N3)** (DEC-193): `@capacitor/app` backButton
      listener → LIFO overlay-dismiss registry (BottomSheet registers on open) →
      `history.back()` → on home, double-tap-to-exit toast (`common.press_again_to_exit`,
      3 locales). PWA `useBackButtonGuard` history hack gated off when native.
- [x] **Verify**: tsc clean, 941 tests pass, web build OK, cap sync OK,
      `assembleDebug` BUILD SUCCESSFUL, APK copied to Downloads.
- **Self-check / regression**: changes confined to `utils/native/*`, `overlay-dismiss.ts`,
      `AppShell`, `RootLayout`, `BottomSheet`, tokens/globals CSS, locales, version files.
      Web behavior unchanged (every native path guarded by `isNativeApp()`).
- **Next (Gate 1B)**: N4 persistence reality (hide banner/toggle), N5 native GPS
      permission, N7 DPI/scaling calibration, N8 haptics.

## Redesign 2026-06-15 — Navigation & Copiloto (G1–G8)
Plan: `brain/documents/navigation-redesign-plan-2026-06-15.md`
Copiloto intelligence (G3): `brain/documents/copilot-intelligence-2026-06-15.md`
Copiloto expansion (G8): `brain/documents/copilot-expansion-2026-06-15.md`

### G8 — Copiloto intelligence expansion ✅ (0.27.0, sw v44)
- [x] 2ª rodada de conselho (inline, 4 lentes brainstorm + priorização) →
      `copilot-expansion-2026-06-15.md`. Auditou a matéria-prima subaproveitada;
      escolheu 4 cruzamentos NOVOS que "mudam uma decisão" (regra do Simplificador).
- [x] **Rota corrigindo** (DEC-181): `summarizeForecastTrend(snapshots)` sobre a
      série de `forecast_snapshots` (a única série temporal do app, já persistida e
      quase não exibida). "Há N dias projetava €X; agora €Y." Gate: ≥2 snapshots e
      Δ acima da tolerância (3%, piso €5). Repo ganhou `getByPhaseId`.
- [x] **Runway** (DEC-182): `calculateRunway(fts, avgDaily, daysLeft)` — "seu livre
      dura ~N dias (até DATA)" ou "cobre a fase com folga". Reuso puro; sem dado novo.
- [x] **Dia da semana** (DEC-183): `summarizeWeekdayPattern(tx)` — fds × dia útil
      (média por dia distinto, bucket via localDayOf). Gate: ≥1 de cada com gasto.
- [x] **Eficiência de saídas** (DEC-184): `summarizeOutingEfficiency(outings)` —
      bateu o alvo + economia média. Gate: ≥2 saídas fechadas com alvo.
- [x] Ordem na tela (conselho): trend+runway logo após "Pra onde vai"; weekday após
      o mapa do mês; outings após a comparação de fases. Todos data-gated (anti-poluição).
- [x] i18n pt/en/es: bloco copilot.{trend_*,runway_*,weekday_*,outings_*}. +`addDaysIso`.
- [x] Tests: +13 em copilot-insights.test.ts (math verificada p/ cada fn) → 941 total.
- Tests 941/0 · typecheck clean · build clean · Playwright OK
  (`.ux-shots/g8/g8-copiloto.png`). Backlog (conselho): cash×cartão, total em R$,
  hora/streak, Wrapped de fim de viagem.

### G7 — Guide "Tudo que dá pra fazer" ✅ (0.26.0, sw v43)
- [x] Julio: "tem muita função que fica escondida — uma página falando todas as
      funções, o que faz, como faz, e um atalho pra ir". Built as a data-driven
      catalog so the page only renders (Core Rule 8).
- [x] Domain `guide/guide-catalog.ts`: 6 sections / 21 entries (daily, planning,
      trip & phases, people, copilot, settings). Each: icon + titleKey + descKey
      + route. Routes are real router paths — unit-guarded.
- [x] `GuidePage` (`/guide`, lazy, under AppShell): grouped tappable rows
      (icon chip + title + one-line "what you can do" + chevron → navigate).
- [x] Entry points: prominent highlighted card at the TOP of Settings (the gear =
      catch-all menu now) + a row in the Copiloto tools footer (`copilot.guide`).
- [x] i18n pt/en/es: full `guide.*` block (title, intro, 6 section titles, 21
      title+desc pairs) + `settings.guide_hint` + `copilot.guide`/`guide_desc`.
- [x] Test `guide-catalog.test.ts` (11): unique section/entry ids, every route is
      registered in the actual router (traverses `router.routes`), every key
      resolves to a string in all 3 locales.
- Tests 928/0 · typecheck clean · build clean · Playwright OK
  (`.ux-shots/g7/g7-guide.png`, `g7-settings-top.png`).

### G6 — Amigo sincero reconciled (category × phase slack) ✅ (0.25.0, sw v42)
- [x] Root of Julio's confusion: amigo's `over_pace` count is CATEGORY-scoped
      ("only 3 of 4 bars fit") while the phase shows slack ("€115 under plan") —
      both true, but unreconciled they read as broken.
- [x] Domain (honest-friend `over_pace`): added `overflowCount`, `phaseFreeCents`,
      `overflowFitsPhase` (phase slack ≥ overflow × typical). Pure; +1 test
      asserting both the with-slack and no-slack branches.
- [x] Shared `AmigoSinceroCard` (one source for Home + Copiloto, plan §4): when
      `overflowFitsPhase`, shows `amigo_over_pace_slack` — "no plano de {type}
      cabem só {fit}; mas a fase tem €X livres — o resto cabe sem culpa; pra
      seguir o plano, segura {hold}". Else keeps the reserve-date warning (tight
      case). Card now takes `currency` (threaded from Dashboard + Copiloto).
- [x] i18n pt/en/es: `amigo_over_pace_slack`. No colored side-bar (already).
- Tests 917/0 · typecheck clean · build clean · Playwright OK (Copiloto amigo
  renders + simulate button; `.ux-shots/g6/g6-copiloto.png`). over_pace copy
  path is unit-verified (demo seed shows the `no_plan` state).

### G5 — Check-in: real effect + 'Sem gastos' + microcopy ✅ (0.24.0, sw v41)
- [x] Micro-explanation on the prompt: "Diz como vai ser o dia que eu mostro
      quanto dá pra gastar e ajusto o ritmo dos próximos dias" — answers Julio's
      "pra que serve / o que significa".
- [x] New `no_spend` intent (CheckInIntent + catalog + lens + planCheckInDay):
      a no-spend day → primary €0, the whole free amount carries forward.
- [x] "Efeito real" (still READ-ONLY — ÂNCORA 12 preserved, per plan §3): new pure
      `projectDailyBoostCents(saved, effDaysAfterToday)`. Calm & no-spend now show
      "Guardando €X hoje, seus próximos dias ganham +€Y/dia" (trending_up). Page
      derives effDaysAfter from the phase weights (`calculateEffectiveSpendingDays
      − getDaySpendingWeight`). Verified math: €38,12/10d ≈ +€3,81/d; €95,29/10d
      ≈ +€9,53/d.
- [x] 4 modes fit one row (Tranquilo/Passeio/Noite/Sem gastos) — no wrap.
- [x] i18n pt/en/es: checkin_no_spend, checkin_plan_no_spend, stat labels,
      checkin_redistribute, reworded checkin_prompt.
- [x] Tests: catalog now 4 intents; +no_spend plan asserts; +3
      `projectDailyBoostCents` tests (916 total).
- Tests 916/0 · typecheck clean · build clean · Playwright OK
  (`.ux-shots/g5/g5-no-spend.png`, `g5-calm.png`, `g5-night.png`).
- ÂNCORA 12 note: the check-in stays a projection/lens — it never writes an
  expense nor moves the hero's free-today (plan §3: "projeção/realce, reversível,
  nunca grava gasto"). Julio's "muda o livre dos outros dias" is shown AS a
  projection, not by mutating data.

### G4 — Início: focus + hero clarity ✅ (0.23.0, sw v40)
- [x] Hero overline reframed: `dashboard.free_to_spend_phase` ("Livre para usar
      nesta fase") instead of repeating the phase end date already shown in the
      header (Julio: "ele repete 2× 25 de junho"). Robust to long phase names.
- [x] Kept everything Julio asked to keep on the home: explicit "Livre para usar
      hoje: €X", rotating INSIGHTS carousel, Amigo sincero (no colored side-bar —
      verified none exists), divisões, compras pessoais, gastos recentes.
- [x] Analytics focus: the deep analysis (month map, phase pace, projection) now
      lives in Copiloto (G3). Home keeps the `trip_analytics` drawer COLLAPSED by
      default (D3) — zero regression, recap preserved, one tap to peek.
- [x] Backup advisory already correct (DEC-176): routine reminder is in the
      notifications center; only the urgent eviction-risk warning stays on the
      home, and only when storage isn't persisted (not the case on Julio's
      device, persisted=true). No change needed.
- Removed now-unused `formatDate` import from DashboardCards.
- Tests 913/0 · typecheck clean · build clean · Playwright visual OK
  (`.ux-shots/g4/g4-home.png`, `g4-home-top.png`).
- Regression check: insights carousel intact (insight-rotation test green); card
  catalog unchanged; no business logic touched.

### G3 — Copiloto (the intelligence) ✅ (0.22.0, sw v39)
- [x] New pure domain module `src/domain/copilot/` (DEC-178): verdict, category
      summary, daily-spend summary, social×solo, phase-pace comparison. 15 unit
      tests (math-verified).
- [x] `CopilotPage` rewritten to orchestrate `useDashboardModel` + the new
      module into the council narrative (DEC-177): Verdict → Where it's heading
      (reuses phase_projection insight) → Amigo (shared card) → Where it came
      from (category bars) → Month map (HeatmapCard + biggest day/avg) → Phase
      pace (BurndownCard) → vs previous phase → Social×solo → Settlements →
      Tools. Each module data-gated; empty trip shows a warming-up invite.
- [x] Extracted `cards/AmigoSinceroCard.tsx` so Home + Copiloto share ONE source
      (G6 reconciles the copy once). Dashboard refactored to use it.
- [x] i18n: full `copilot.*` block (verdict/where/from/map/rhythm/social/debts/
      compare/empty) in pt-BR, en, es.
- Tests 913/0 · typecheck clean · build clean · Playwright visual OK (all
  modules render with demo data).
- Regression check: Dashboard amigo unchanged (same keys via shared card); no
  new routes; reuses existing derivations; no business logic in the page.

### G2 — Viagem hub + cross-phase ✅ (0.21.0, sw v38)
- [x] Phase selector at top (chips): `Todas as fases` × each phase — filters the whole page. Lets user view/plan past, current or future phases.
- [x] "All phases" view: trip summary card (budget × spent) + a card per phase (spent / free), funds, structure.
- [x] Specific-phase view: inline planning preview (free-to-spend + per-category allocation from forecasts) with "Editar plano" → `/planner`.
- [x] Planned purchases section (open items + reserved remaining) — conditional render.
- [x] Funds section context-aware (selected phase pool or all), with plain microcopy explaining what a fund is + "Gerenciar fundos".
- [x] Structure links: overview, phases, profiles, participants, wallets, outing history. Nothing lost vs old Mais/Planner.
- Tests 898/0 · typecheck clean · build clean · Playwright visual OK (phase + all views).
- Regression check: reuses existing domain fns (calculateFreeToSpend, createPoolSummary, calculateOccasionForecasts, plannedPurchase helpers); no new shared modules.

### G1 — Navigation & Settings entry ✅ (0.20.0, sw v37)
- [x] Bottom bar: removed "Mais"/"Planejar"; now `Início · Gastos · ( + ) · Viagem · Copiloto`.
- [x] New `/viagem` hub (TripHubPage): Planning (planner, planned) + Structure (overview, phases, funds, wallets, profiles, people, outing history). Nothing lost.
- [x] New `/copiloto` (CopilotPage): tools (impact, simulator, rescue). Narrative lands in G3.
- [x] Gear in Início header → `/settings`; Settings now exposes backup/CSV export + About (the old "Mais → Dados/App").
- [x] `/more` → redirect to `/viagem`; MorePage.tsx deleted (superseded). Copiloto is `advanced` (hidden in simple mode).
- Tests 898/0 · typecheck clean · build clean · Playwright visual OK.
- Regression check: nav routes intact, no other `/more` references, demo data renders all screens.

## Completed

### D1 — Foundation ✅ (52 tests at completion)
- [x] D1.M1 - Project Scaffold
- [x] D1.M2 - Domain Types + Validation (8 tests)
- [x] D1.M3 - Repositories (base + 9 entity repos)
- [x] D1.M4 - Budget Engine (26 tests)
- [x] D1.M5 - Backup Engine (8 tests)
- [x] D1.M6 - Demo Data + Onboarding
- [x] D1.M7 - Shell + Dashboard
- [x] D1.M8 - Expense Form (QuickAdd)
- [x] D1.M9 - Expense List
- [x] D1.M10 - Planner
- [x] D1.M11 - Settings + Backup UI
- [x] D1.M12 - Polish

### D2 — Splitting ✅ (+9 tests = 61 cumulative)
- [x] Split engine (equal/custom shares)
- [x] Debt tracker (calculateDebts)
- [x] Settlement creation
- [x] ParticipantShare + Settlement repositories
- [x] SharedExpensesPage UI

### D3 — Forecasting ✅ (+9 tests = 70 cumulative)
- [x] Profile learning engine (weighted avg, confidence)
- [x] Occasion forecasts (remaining/planned/spent)
- [x] Simulator (risk levels: low/medium/high/critical)
- [x] Scenario cost calculator
- [x] SimulatorPage UI

### D4 — Outing Mode ✅ (+10 tests = 80 cumulative)
- [x] Session engine (create/end)
- [x] Quick-add buttons (configurable per profile)
- [x] Progressive alerts (50/75/90/100%)
- [x] Next drink impact calculator
- [x] OutingPage UI with real-time tracking

### D5 — PWA ✅
- [x] manifest.json with shortcuts
- [x] Service worker (stale-while-revalidate)
- [x] PWA registration
- [x] Persistent storage utility
- [x] Apple mobile web app meta tags

### D6 — Native Layer ✅
- [x] capacitor.config.ts
- [x] Notification utilities (Web API + Capacitor ready)
- [x] APK-ready configuration

## Decisions Made (not in decision-log)
- EntityTable ID casting with `as any` for Dexie 4 strict types
- parseISO in tests for timezone safety
- Service worker: stale-while-revalidate strategy
- Capacitor config with @anthropic/capacitor-cli type reference (placeholder)
- Web Notifications API as fallback, Capacitor for native

## Known Issues
- Bundle size > 500KB (needs code-splitting with lazy imports)
- No PWA icon images generated (need actual PNG files in /icons/)
- Capacitor not installed as dep (requires `npx cap init` at build time)
- E2E Playwright tests not written (future iteration)
