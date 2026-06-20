# APK / OTA Self-Update — Study & Future Plan

> Last updated: 2026-06-19
> Status: **STUDY (for future application)** — grounded in the current code + DEC-204 / DEC-210. No code changed by this doc.
> Trigger: Julio (2026-06-19) — "entenda se há como atualizar o APK via OTA também, pois lembro de já ter feito isso, e agora estou tendo que pegar da pasta downloads. Faça um estudo e salve para aplicarmos no futuro."
> Confidence tags per `fact-verification.mdc`: **VERIFIED** = read in this session's code; **HIGH/GENERAL** = established Android platform behavior.

---

## 0. TL;DR (the honest answer)

**Yes — and it already exists. You built it (DEC-210).** TripPilot has **two** update channels:

1. **Web bundle OTA (automatic, silent)** — Capgo `@capgo/capacitor-updater`. On every cold start the app pulls the new HTML/CSS/JS bundle from Pages and swaps it in. **This is why ~all releases (0.9x.x) ship "web-only OTA" with no APK.** [VERIFIED: `utils/native/live-update.ts`, `utils/live-update-boot.ts`, DEC-204]
2. **Native APK self-update (in-app, one-tap, NOT silent)** — when a *newer published APK* exists, a cold-start toast offers it; tapping downloads the APK and launches the **Android system installer** (you confirm in the OS dialog). [VERIFIED: `utils/live-update-boot.ts` lines 38-47, `utils/native/apk-installer.ts`, `android/.../ApkInstallerPlugin.java`, `AndroidManifest.xml` `REQUEST_INSTALL_PACKAGES` + FileProvider, DEC-210]

**Why you're pulling from Downloads right now:** the manifest's `latestNativeVersion` is **0.56.0** — the same shell you have installed — so the in-app updater correctly offers nothing. The **0.69.0** APK is built but **device-pending** (DEC-218/Onda 5): project policy forbids promoting an APK/App-Links shell that hasn't been verified on a real device. So the only place the unverified 0.69.0 lives is the build pipeline's **Downloads copy** (DEC-210 #3, the deliberate fallback). The OTA path isn't broken — it's *waiting for you to verify + promote a shell*.

**The hard limit (cannot be removed):** Android will **never silently replace a sideloaded APK**. Every install goes through the OS PackageInstaller UI with a user confirm (and a one-time "allow this source to install apps" grant). True background self-replacement requires the **Play Store** (in-app updates / auto-update) or an **MDM** — and TripPilot is **sideload-only by choice** (DEC-206: "not on the Play Store, maybe never"). So "one-tap, you confirm" is the *correct ceiling*, not a gap. [HIGH/GENERAL — Android security model]

---

## 1. Current architecture (grounded)

### 1.1 The manifest (`/version.json`, served by Pages, CORS `*`, `no-store`)
```jsonc
{
  "version": "0.99.8",              // latest WEB bundle (OTA target)
  "requiredNativeVersion": "0.50.0",// min APK that can run that bundle
  "latestNativeVersion": "0.56.0",  // newest PUBLISHED (verified) APK shell
  "apkUrl": ".../trippilot.apk",    // where the APK lives
  "bundleUrl": ".../bundles/0.99.8.zip", // the OTA web zip
  "notes": "..."
}
```
[VERIFIED: `public/version.json`, `domain/version/version-check.ts`]

### 1.2 The pure decision (`domain/version/version-check.ts` — `evaluateVersionStatus`)
Four honest states from (web bundle version × installed APK × manifest):
- `up_to_date` — nothing to do.
- `web_update_available` — newer bundle, APK recent enough → **OTA applies silently**.
- `apk_outdated` — newer bundle but installed APK `< requiredNativeVersion` → **must reinstall** (OTA can't run the new bundle).
- plus an orthogonal **`nativeUpdateAvailable`** flag = installed APK `< latestNativeVersion` (a newer *verified* shell exists, even if not required). [VERIFIED]

### 1.3 The boot flow (`utils/live-update-boot.ts`, native only, cold start, +2.5s)
1. `notifyLiveUpdateReady()` — commit the running bundle so Capgo doesn't roll it back. [VERIFIED]
2. `web_update_available` + `bundleUrl` → `downloadAndApplyBundle()` (silent; `set()` reloads into the new bundle). [VERIFIED]
3. `nativeUpdateAvailable` + `apkUrl` + installer supported → a **12 s one-tap "atualização do app disponível" toast** → `downloadAndInstallApk()` (download APK + launch OS installer). Deliberately NOT auto-downloaded (a ~20 MB pull on every boot is hostile). [VERIFIED]

### 1.4 The native installer (DEC-210)
- `android/app/src/main/java/com/trippilot/app/ApkInstallerPlugin.java` — downloads to app storage, exposes it via a **FileProvider**, fires the **package-installer Intent**. Gated by **`REQUEST_INSTALL_PACKAGES`** (manifest). The OS still shows its own install/consent screen. [VERIFIED]
- iOS/web: no-op (PWA self-updates via the service worker). [VERIFIED]

### 1.5 The build pipeline (`scripts/`)
- `build:pages` = `vite build` → `fetch-live-apk.mjs` (re-fetch the byte-identical published APK into `dist/`) → `make-ota-bundle.mjs` (zip `dist/` → `bundles/<version>.zip`). [VERIFIED]
- DEC-210 #3: the freshly built APK is also copied to **`/mnt/c/Users/julio/Downloads/TripPilot-<version>.apk`** — the manual fallback you're currently using. [DEC-210]

---

## 2. Diagnosis — why "I'm grabbing it from Downloads"

| Symptom | Root cause | Status |
|---|---|---|
| In-app updater never offers the new APK | `latestNativeVersion` (0.56.0) == installed; the 0.69.0 shell is **device-pending**, not promoted (DEC-218) | **Working as designed** — the promotion gate is intentional |
| You manually install from Downloads | The build pipeline always drops the APK there (DEC-210 #3) as the override path for unverified shells | **By design** — it's the safety valve, not the primary path |
| Web features still arrive without an APK | Capgo OTA is live and silent | **Working** (every 0.9x.x web release) |

**Conclusion:** nothing is broken. The native-APK OTA is dormant **only because no newer *verified* shell has been promoted**. Unblock = verify a shell on a device, then bump `latestNativeVersion`.

---

## 3. Inline council — ASSESS (Risk / Opportunity / Cost / Timeline)

**Decision Brief (neutral):** The native-APK in-app updater exists and works but is dormant (no promoted shell). Android cannot silently replace a sideloaded APK. Question: how to make native updates flow smoothly without weakening the "verify before promote" safety anchor and without joining the Play Store. Chat lean to resist: "make the APK auto-update fully in the background" (impossible for sideload without Play/MDM).

**Risk Analyst (blind).** The dominant risk is **promoting an unverified shell** (App Links/permissions/crash) to all users via `latestNativeVersion` — that's exactly what the device-pending policy prevents; do NOT relax it. Secondary: a background auto-download could ship a broken APK that bricks installs. Mitigation: keep promotion manual + device-gated; never auto-*install*; the OS confirm is a feature. **Rec:** keep the gate; improve only the *offer* UX. **Confidence:** HIGH. **Others miss:** the `REQUEST_INSTALL_PACKAGES` one-time grant is a silent drop-off point — document/guide it.

**Opportunity Scout (blind).** The win is **removing the Downloads detour for verified shells**: once you bump `latestNativeVersion`, the existing toast already delivers one-tap install — so the opportunity is mostly *process* (promote routinely), plus a small **"Buscar atualização do app" button in Settings** so you can pull the published APK on demand instead of waiting for the boot toast. **Rec:** add a manual check button; routinize promotion. **Confidence:** HIGH.

**Cost Analyst (blind).** Near-zero code cost — the machinery exists. A Settings "check for app update" button reusing `resolveAppVersionStatus()` + `downloadAndInstallApk()` is ~1–2h. Routine promotion is a 1-line `version.json` bump per verified shell. Play Store path (true background updates) is **high cost** (account, review, policy, signing, the sideload-only stance reversal) — out of scope. **Rec:** cheap in-app polish only. **Confidence:** HIGH.

**Timeline Realist (blind).** The only real dependency is **your device session** to verify 0.69.0 (biometric, App Links, QR pairing — DEC-218/Onda 5). Until then, Downloads is the correct path. After verification: bump `latestNativeVersion` → everyone gets the one-tap toast on next boot. **Rec:** sequence = verify-on-device → promote → (optional) ship the Settings button. **Confidence:** HIGH. **Optimism flag:** don't pre-bump `latestNativeVersion` "to test the flow" — that promotes an unverified shell.

**Red team.** The way this fails: someone bumps `latestNativeVersion` to 0.69.0 before device verification "to make OTA work," and an App-Links/permission regression ships to all installs. Kill it: the bump MUST come *after* a green device session, logged in the dev-log + a DEC.

**Synthesis (Chair).** Consensus: **the OTA APK path is sound and should not be re-architected.** Tension: convenience (auto-everything) vs safety (verify-before-promote) → resolved firmly toward safety (Android can't silently install anyway). Recommendation: (1) **routinize promotion** (verify shell on device → bump `latestNativeVersion` → the existing toast delivers it); (2) add a small **manual "check for app update" button** in Settings for on-demand pulls; (3) optionally **pre-download + cache** the APK when a new version is detected so the eventual install is instant (still user-confirmed). Do **not** auto-install, do **not** join Play Store, do **not** relax the device gate. **Confidence:** HIGH. **What would flip it:** if you ever decide to go on the Play Store, switch to `@capawesome/capacitor-app-update` (Play in-app updates) for true background updates — a strategic reversal of DEC-206, not a polish item.

---

## 4. Future-apply plan

### Gate "OTA-1" — close the Downloads loop for verified shells (the real unblock)
**This is process, not code.** When a native shell is device-verified (DEC-218/Onda 5):
1. Bump `latestNativeVersion` in `public/version.json` to the verified shell's versionName.
2. Ensure `apkUrl` serves that exact APK (the pipeline already re-fetches the live APK).
3. On users' next cold start, the existing toast offers one-tap install. **No code change.**
4. Log it (dev-log + DEC) so the promotion is auditable.

### Gate "OTA-2" — manual "Buscar atualização do app" button (optional, ~1–2h, web/OTA)
1. In Settings (the existing version/update area), add a button that calls `resolveAppVersionStatus()`; if `nativeUpdateAvailable` → `downloadAndInstallApk(apkUrl, latestNative)`; else show "você já está na versão mais recente".
2. Guard to native only (web/PWA hide it). Reuses everything; no new native code.
3. AC: tapping with a newer published shell launches the OS installer; with none, shows the up-to-date state. Unit-cover the decision via the existing `version-check` suite; Playwright only for the button's presence/guard.

### Gate "OTA-3" — pre-download + cache (optional, nice-to-have)
1. When `nativeUpdateAvailable` is first detected, download the APK once in the background (with a small consent), cache it, then the toast's tap becomes an instant install (no re-download).
2. AC: at most one background download per new version; install is immediate after; still user-confirmed by the OS. Higher complexity — only if the download wait becomes a real annoyance.

### Explicitly OUT of scope (documented, not lost)
- **Silent/auto APK install** — impossible for sideloaded apps (Android security). [HIGH/GENERAL]
- **Play Store in-app updates / auto-update** — reverses the sideload-only stance (DEC-206); strategic decision, not polish.
- **Relaxing the device-pending promotion gate** — it's a safety anchor; keep it.

---

## 5. One-time user note (for the README/onboarding of native updates)
The first time you tap "atualizar o app", Android shows **"Permitir que esta fonte instale apps?"** — grant it once for TripPilot; afterwards the one-tap install works directly. This is the OS protecting sideloaded installs, not a TripPilot prompt. [HIGH/GENERAL]

## 6. Decision-log hook
- Add **DEC-243** = "APK/OTA self-update study: web OTA (Capgo) + native in-app installer (DEC-210) confirmed working; native updates flow once a device-verified shell is promoted via `latestNativeVersion`; optional Settings 'check for update' button (OTA-2); silent install / Play Store explicitly out of scope" once accepted.
