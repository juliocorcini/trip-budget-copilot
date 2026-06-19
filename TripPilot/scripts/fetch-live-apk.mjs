/**
 * CI (Cloudflare Pages git build) parity for the deploy flow.
 *
 * The manual deploy re-fetches the live `/trippilot.apk` into `dist/` before
 * bundling so the published APK + OTA stay byte-identical to the verified native
 * shell (no APK rebuild in CI — see make-ota-bundle.mjs). This script does the
 * same fetch so an auto-build triggered by a `git push` produces the same set of
 * artifacts a `wrangler pages deploy dist` would.
 *
 *   npm run build && node scripts/fetch-live-apk.mjs && node scripts/make-ota-bundle.mjs
 *
 * Best-effort: a transient miss only affects the standalone /trippilot.apk
 * download (the web app + the web OTA bundle do NOT contain the APK), so we WARN
 * instead of failing the whole web release.
 */
import { writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(root, 'dist');
const dest = join(distDir, 'trippilot.apk');
const url = 'https://trippilot.pages.dev/trippilot.apk';

if (!existsSync(distDir)) {
  console.error('[fetch-apk] dist/ missing — run `npm run build` first.');
  process.exit(1);
}

try {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  // Guard against an error page (HTML) being saved as the APK.
  if (buf.length < 1_000_000) throw new Error(`suspiciously small (${buf.length} B)`);
  writeFileSync(dest, buf);
  console.log(`[fetch-apk] live APK → dist/trippilot.apk (${(buf.length / 1024 / 1024).toFixed(0)} MB)`);
} catch (err) {
  console.warn(
    `[fetch-apk] WARNING: could not fetch the live APK (${err.message}). ` +
      'The web app + OTA bundle still ship; only /trippilot.apk may be stale/missing this deploy.',
  );
}
