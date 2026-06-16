/**
 * FIELD item 20 (G8b): build the self-hosted live-update bundle.
 *
 * Zips the built web app (`dist/`) into `dist/bundles/<version>.zip`, which is the
 * payload Capgo downloads and swaps in on installed APKs. Run AFTER `npm run build`
 * and AFTER `npx cap sync` (so the zip is not copied into the APK assets):
 *
 *   npm run build && npx cap sync android && node scripts/make-ota-bundle.mjs
 *
 * The version is read from package.json so it always matches `version.json`.
 * Excludes the bundles folder itself (no recursion) and the published APK.
 */
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  statSync,
  copyFileSync,
  existsSync,
} from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(root, 'dist');
const bundlesDir = join(distDir, 'bundles');
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;

const EXCLUDED_TOP_LEVEL = new Set(['bundles', 'trippilot.apk']);

function collectFiles(dir, files) {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    const rel = relative(distDir, abs);
    const top = rel.split('/')[0];
    if (EXCLUDED_TOP_LEVEL.has(top)) continue;
    if (statSync(abs).isDirectory()) {
      collectFiles(abs, files);
    } else {
      files[rel] = new Uint8Array(readFileSync(abs));
    }
  }
  return files;
}

const files = collectFiles(distDir, {});
const fileCount = Object.keys(files).length;
if (fileCount === 0) {
  console.error('[ota-bundle] no files in dist/ — run `npm run build` first.');
  process.exit(1);
}

mkdirSync(bundlesDir, { recursive: true });
const zipped = zipSync(files, { level: 9 });
const outPath = join(bundlesDir, `${version}.zip`);
writeFileSync(outPath, zipped);

console.log(`[ota-bundle] ${fileCount} files → bundles/${version}.zip (${(zipped.length / 1024).toFixed(0)} KB)`);

// Republish the APK alongside the bundle. `npm run build` empties dist/, so the
// last-built native APK must be re-copied here or a deploy after a web-only
// rebuild would silently drop it (serving a broken /trippilot.apk). Copy from
// the latest native build output when present; warn loudly if nothing exists.
const builtApk = join(root, 'android/app/build/outputs/apk/debug/app-debug.apk');
const publishedApk = join(distDir, 'trippilot.apk');
if (existsSync(builtApk)) {
  copyFileSync(builtApk, publishedApk);
  const mb = (statSync(publishedApk).size / 1024 / 1024).toFixed(0);
  console.log(`[ota-bundle] published APK → trippilot.apk (${mb} MB)`);

  // DEC-210 convenience: also drop a versioned copy into the dev machine's
  // Downloads folder (WSL → Windows) so the freshly built APK is one click away
  // even when the in-app self-update path is skipped. Best-effort: skip silently
  // if the folder is absent (CI / another machine).
  const downloads = '/mnt/c/Users/julio/Downloads';
  if (existsSync(downloads)) {
    const named = join(downloads, `TripPilot-${version}.apk`);
    try {
      copyFileSync(builtApk, named);
      console.log(`[ota-bundle] copied APK → ${named}`);
    } catch (err) {
      console.warn(`[ota-bundle] could not copy APK to Downloads: ${err.message}`);
    }
  }
} else if (!existsSync(publishedApk)) {
  console.warn('[ota-bundle] WARNING: no APK build output and none in dist/ — /trippilot.apk will be missing from this deploy.');
}
