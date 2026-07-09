#!/usr/bin/env bash
set -euo pipefail

#
# TripPilot — unified deploy script.
#
# Targets (mix and match):
#   pages   — Cloudflare Pages (frontend + landing + OTA bundle)
#   worker  — Cloudflare Worker (sync backend)
#   apk     — Android APK (Capacitor + Gradle)
#   all     — everything above
#
# Usage:
#   ./scripts/deploy.sh                    # default: pages (auto-bump patch)
#   ./scripts/deploy.sh pages              # same as default
#   ./scripts/deploy.sh worker             # only the sync worker
#   ./scripts/deploy.sh apk               # only the Android APK
#   ./scripts/deploy.sh pages worker       # pages + worker
#   ./scripts/deploy.sh all                # pages + worker + apk
#   ./scripts/deploy.sh pages 3.0.0-rc     # pages with explicit version
#   ./scripts/deploy.sh --skip-tests       # skip the pre-deploy type check
#   ./scripts/deploy.sh --dry-run          # show what would happen
#   ./scripts/deploy.sh --force            # skip production version check
#
# The script ALWAYS bumps version (auto-increment patch) unless an explicit
# version is provided. There is no --skip-bump: every deploy must result in
# a version the user can actually receive.
#

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKER_DIR="$PROJECT_DIR/worker"
ANDROID_DIR="$PROJECT_DIR/android"

PAGES_PROJECT="trippilot"
PRODUCTION_BRANCH="master"
PRODUCTION_URL="https://trippilot.pages.dev"
VERIFY_URL="$PRODUCTION_URL/version.json"
BUNDLE_BASE_URL="$PRODUCTION_URL/bundles"
VERIFY_RETRIES=6
VERIFY_INTERVAL=5

cd "$PROJECT_DIR"

# ── Parse arguments ──────────────────────────────────────────────────────────

TARGETS=()
EXPLICIT_VERSION=""
SKIP_TESTS=false
DRY_RUN=false
FORCE=false

for arg in "$@"; do
  case "$arg" in
    --skip-tests) SKIP_TESTS=true ;;
    --dry-run)    DRY_RUN=true ;;
    --force)      FORCE=true ;;
    pages|worker|apk|all) TARGETS+=("$arg") ;;
    *)
      if [[ "$arg" =~ ^[0-9]+\.[0-9]+\.[0-9]+ ]]; then
        EXPLICIT_VERSION="$arg"
      else
        echo "ERROR: Unknown argument: $arg"
        echo ""
        echo "Usage: ./scripts/deploy.sh [pages|worker|apk|all] [version] [--skip-tests] [--dry-run] [--force]"
        echo ""
        echo "Examples:"
        echo "  ./scripts/deploy.sh              # pages only, auto-bump"
        echo "  ./scripts/deploy.sh all           # everything, auto-bump"
        echo "  ./scripts/deploy.sh pages 3.0.0   # pages with explicit version"
        echo "  ./scripts/deploy.sh all --dry-run  # preview without executing"
        exit 1
      fi
      ;;
  esac
done

if [[ ${#TARGETS[@]} -eq 0 ]]; then
  TARGETS=("pages")
fi

if [[ " ${TARGETS[*]} " == *" all "* ]]; then
  TARGETS=("pages" "worker" "apk")
fi

TARGETS=($(echo "${TARGETS[@]}" | tr ' ' '\n' | sort -u | tr '\n' ' '))

DO_PAGES=false
DO_WORKER=false
DO_APK=false
for t in "${TARGETS[@]}"; do
  case "$t" in
    pages)  DO_PAGES=true ;;
    worker) DO_WORKER=true ;;
    apk)    DO_APK=true ;;
  esac
done

echo "═══════════════════════════════════════════════"
echo "  TripPilot Deploy"
echo "  Targets: ${TARGETS[*]}"
echo "═══════════════════════════════════════════════"
echo ""

# ── Ensure Node ≥22 via nvm ──────────────────────────────────────────────────

ensure_node22() {
  local major
  major=$(node -e 'process.stdout.write(process.versions.node.split(".")[0])')
  if [[ "$major" -ge 22 ]]; then
    return 0
  fi
  if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
    # shellcheck source=/dev/null
    . "$HOME/.nvm/nvm.sh"
    nvm use 22 --silent 2>/dev/null || nvm use 22
  else
    echo "ERROR: Node ≥22 required (current: $(node --version)). Install via nvm."
    exit 1
  fi
}

ensure_node22

# ── Read current local versions ──────────────────────────────────────────────

CURRENT_PKG_VERSION=$(node -e "process.stdout.write(require('./package.json').version)")
CURRENT_APP_VERSION=$(grep -oP "APP_VERSION = '\K[^']+" src/utils/app-version.ts)
CURRENT_MANIFEST_VERSION=$(node -e "process.stdout.write(require('./public/version.json').version)")
CURRENT_SW_VERSION=$(grep -oP "trippilot-v\K\d+" public/sw.js)

echo "Local versions:"
echo "  package.json:    $CURRENT_PKG_VERSION"
echo "  app-version.ts:  $CURRENT_APP_VERSION"
echo "  version.json:    $CURRENT_MANIFEST_VERSION"
echo "  sw.js cache:     v$CURRENT_SW_VERSION"

# ── Check version consistency ────────────────────────────────────────────────

VERSION_MISMATCH=false
if [[ "$CURRENT_PKG_VERSION" != "$CURRENT_APP_VERSION" ]]; then
  echo ""
  echo "  ⚠ MISMATCH: package.json ($CURRENT_PKG_VERSION) ≠ app-version.ts ($CURRENT_APP_VERSION)"
  VERSION_MISMATCH=true
fi
if [[ "$CURRENT_PKG_VERSION" != "$CURRENT_MANIFEST_VERSION" ]]; then
  echo "  ⚠ MISMATCH: package.json ($CURRENT_PKG_VERSION) ≠ version.json ($CURRENT_MANIFEST_VERSION)"
  VERSION_MISMATCH=true
fi
if [[ "$VERSION_MISMATCH" == true ]]; then
  echo ""
  echo "  The version bump will fix all files. Proceeding..."
fi

# ── Check production version ─────────────────────────────────────────────────

LIVE_VERSION="?"
if [[ "$DO_PAGES" == true || "$DO_APK" == true ]]; then
  echo ""
  echo "Checking production version..."
  LIVE_VERSION=$(curl -sf "$VERIFY_URL" 2>/dev/null | node -e "
    let d=''; process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{try{process.stdout.write(JSON.parse(d).version||'?')}catch{process.stdout.write('?')}})
  " 2>/dev/null || echo "?")
  echo "  Production:      $LIVE_VERSION"
fi

# ── Determine target version ─────────────────────────────────────────────────

TARGET_VERSION="$CURRENT_PKG_VERSION"

if [[ -n "$EXPLICIT_VERSION" ]]; then
  TARGET_VERSION="$EXPLICIT_VERSION"
  echo ""
  echo "Explicit version: $TARGET_VERSION"
else
  # Auto-bump: increment the patch number.
  SUFFIX=""
  BASE_VERSION="$CURRENT_PKG_VERSION"
  if [[ "$CURRENT_PKG_VERSION" == *-* ]]; then
    SUFFIX="-${CURRENT_PKG_VERSION#*-}"
    BASE_VERSION="${CURRENT_PKG_VERSION%%-*}"
  fi
  IFS='.' read -ra PARTS <<< "$BASE_VERSION"
  PATCH=$(( ${PARTS[2]:-0} + 1 ))
  TARGET_VERSION="${PARTS[0]}.${PARTS[1]}.$PATCH$SUFFIX"
  echo ""
  echo "Auto-bump: $CURRENT_PKG_VERSION → $TARGET_VERSION"
fi

# ── Block if target version already matches production ───────────────────────

if [[ "$LIVE_VERSION" == "$TARGET_VERSION" && "$FORCE" == false ]]; then
  echo ""
  echo "╔═══════════════════════════════════════════════════════════════╗"
  echo "║  BLOCKED: version $TARGET_VERSION is already live!           ║"
  echo "╠═══════════════════════════════════════════════════════════════╣"
  echo "║                                                               ║"
  echo "║  Deploying the same version means users will NOT receive      ║"
  echo "║  an update (OTA checks compare versions and skip same).       ║"
  echo "║                                                               ║"
  echo "║  Files that need a version bump:                              ║"
  echo "║    • package.json         (\"version\")                        ║"
  echo "║    • src/utils/app-version.ts  (APP_VERSION)                  ║"
  echo "║    • public/version.json  (version + bundleUrl)               ║"
  echo "║    • public/sw.js         (CACHE_NAME number)                 ║"
  echo "║                                                               ║"
  echo "║  Fix: remove --skip-bump, or pass a newer explicit version.   ║"
  echo "║  Override: --force (deploy anyway, users won't get an update) ║"
  echo "╚═══════════════════════════════════════════════════════════════╝"
  exit 1
fi

# ── Release notes gate (BEFORE bump — no leftover version drift on failure) ───

echo ""
echo "=== Checking release notes ==="
HAS_RELEASE_NOTE=$(node -e "
  const fs = require('fs');
  const src = fs.readFileSync('src/utils/release-notes.ts', 'utf8');
  const hasEntry = src.includes(\"version: '$TARGET_VERSION'\");
  process.stdout.write(hasEntry ? 'yes' : 'no');
")

if [[ "$HAS_RELEASE_NOTE" == "no" ]]; then
  echo ""
  echo "╔═══════════════════════════════════════════════════════════════╗"
  echo "║  BLOCKED: No release notes for v$TARGET_VERSION"
  echo "╠═══════════════════════════════════════════════════════════════╣"
  echo "║                                                               ║"
  echo "║  Every deploy MUST have a release notes entry so users see    ║"
  echo "║  what changed in the About screen.                            ║"
  echo "║                                                               ║"
  echo "║  File: src/utils/release-notes.ts                             ║"
  echo "║                                                               ║"
  echo "║  Add an entry at the TOP of the RELEASE_NOTES array:          ║"
  echo "║                                                               ║"
  echo "║    {                                                          ║"
  echo "║      version: '$TARGET_VERSION',                              ║"
  echo "║      date: '$(date +%Y-%m-%d)',                               ║"
  echo "║      items: {                                                 ║"
  echo "║        'pt-BR': ['Descrição da mudança em português'],        ║"
  echo "║        en: ['Change description in English'],                 ║"
  echo "║        es: ['Descripción del cambio en español'],             ║"
  echo "║      },                                                       ║"
  echo "║    },                                                         ║"
  echo "║                                                               ║"
  echo "║  Guidelines:                                                  ║"
  echo "║    • Write from the USER perspective (what they see/gain)     ║"
  echo "║    • Keep each item to 1 line, max 3-5 items                  ║"
  echo "║    • No technical jargon — plain language                     ║"
  echo "║    • Include ALL 3 languages (pt-BR, en, es)                  ║"
  echo "║                                                               ║"
  echo "║  After adding, re-run: ./scripts/deploy.sh ${TARGETS[*]}      ║"
  echo "╚═══════════════════════════════════════════════════════════════╝"
  exit 1
fi
echo "  ✓ Release notes found for v$TARGET_VERSION"

if [[ "$DRY_RUN" == true ]]; then
  echo ""
  echo "[DRY RUN] Would deploy v$TARGET_VERSION to: ${TARGETS[*]}"
  [[ "$DO_PAGES" == true ]]  && echo "  - Cloudflare Pages (branch: $PRODUCTION_BRANCH) + OTA bundle"
  [[ "$DO_WORKER" == true ]] && echo "  - Cloudflare Worker (wrangler deploy from worker/)"
  [[ "$DO_APK" == true ]]    && echo "  - Android APK (cap sync + gradle assembleDebug)"
  echo ""
  echo "  Live version:   $LIVE_VERSION"
  echo "  Target version: $TARGET_VERSION"
  echo "  Files to bump:"
  echo "    package.json:       $CURRENT_PKG_VERSION → $TARGET_VERSION"
  echo "    app-version.ts:     $CURRENT_APP_VERSION → $TARGET_VERSION"
  echo "    version.json:       $CURRENT_MANIFEST_VERSION → $TARGET_VERSION"
  echo "    sw.js:              v$CURRENT_SW_VERSION → v$((CURRENT_SW_VERSION + 1))"
  exit 0
fi

# ── Bump version in all files ────────────────────────────────────────────────

if [[ "$TARGET_VERSION" != "$CURRENT_PKG_VERSION" || "$VERSION_MISMATCH" == true ]]; then
  echo ""
  echo "=== Bumping version → $TARGET_VERSION ==="

  # package.json
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    pkg.version = '$TARGET_VERSION';
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
  "
  echo "  ✓ package.json → $TARGET_VERSION"

  # app-version.ts
  sed -i "s/export const APP_VERSION = '.*'/export const APP_VERSION = '$TARGET_VERSION'/" \
    src/utils/app-version.ts
  echo "  ✓ app-version.ts → $TARGET_VERSION"

  # version.json (OTA manifest)
  node -e "
    const fs = require('fs');
    const manifest = JSON.parse(fs.readFileSync('public/version.json', 'utf8'));
    manifest.version = '$TARGET_VERSION';
    manifest.bundleUrl = '$BUNDLE_BASE_URL/$TARGET_VERSION.zip';
    fs.writeFileSync('public/version.json', JSON.stringify(manifest, null, 2) + '\n');
  "
  echo "  ✓ version.json → $TARGET_VERSION (bundleUrl updated)"

  # sw.js cache name (+1)
  NEW_SW_VERSION=$((CURRENT_SW_VERSION + 1))
  sed -i "s/trippilot-v${CURRENT_SW_VERSION}/trippilot-v${NEW_SW_VERSION}/" public/sw.js
  echo "  ✓ sw.js → v${NEW_SW_VERSION}"

  # Verify all files are now consistent
  VERIFY_PKG=$(node -e "process.stdout.write(require('./package.json').version)")
  VERIFY_APP=$(grep -oP "APP_VERSION = '\K[^']+" src/utils/app-version.ts)
  VERIFY_MAN=$(node -e "process.stdout.write(require('./public/version.json').version)")
  if [[ "$VERIFY_PKG" != "$TARGET_VERSION" || "$VERIFY_APP" != "$TARGET_VERSION" || "$VERIFY_MAN" != "$TARGET_VERSION" ]]; then
    echo ""
    echo "  ✗ VERSION SYNC FAILED:"
    echo "    package.json:    $VERIFY_PKG"
    echo "    app-version.ts:  $VERIFY_APP"
    echo "    version.json:    $VERIFY_MAN"
    echo "    Expected:        $TARGET_VERSION"
    exit 1
  fi
  echo "  ✓ All version files synchronized"
fi

# ── Type check (pre-deploy gate) ─────────────────────────────────────────────

if [[ "$SKIP_TESTS" == false ]]; then
  echo ""
  echo "=== Type checking ==="
  npx tsc --noEmit
  echo "  ✓ No type errors"
fi

# ── Build (shared step for pages and apk) ────────────────────────────────────

NEEDS_BUILD=false
[[ "$DO_PAGES" == true || "$DO_APK" == true ]] && NEEDS_BUILD=true

if [[ "$NEEDS_BUILD" == true ]]; then
  echo ""
  echo "=== Building frontend ==="
  npm run build
  echo "  ✓ Build complete"
fi

# ══════════════════════════════════════════════════════════════════════════════
# TARGET: pages (Cloudflare Pages + OTA bundle)
# ══════════════════════════════════════════════════════════════════════════════

if [[ "$DO_PAGES" == true ]]; then
  echo ""
  echo "╔═══════════════════════════════════════════╗"
  echo "║  Deploying: Cloudflare Pages + OTA        ║"
  echo "╚═══════════════════════════════════════════╝"

  echo ""
  echo "--- Fetching live APK ---"
  node scripts/fetch-live-apk.mjs

  echo ""
  echo "--- Generating OTA bundle ---"
  node scripts/make-ota-bundle.mjs

  # Verify the bundle was created
  BUNDLE_PATH="dist/bundles/$TARGET_VERSION.zip"
  if [[ ! -f "$BUNDLE_PATH" ]]; then
    echo "  ✗ OTA bundle not found at $BUNDLE_PATH"
    exit 1
  fi
  BUNDLE_SIZE=$(($(stat -c%s "$BUNDLE_PATH") / 1024))
  echo "  ✓ Bundle: $BUNDLE_PATH (${BUNDLE_SIZE} KB)"

  echo ""
  echo "--- Deploying to Cloudflare Pages (branch: $PRODUCTION_BRANCH) ---"
  npx wrangler pages deploy dist \
    --project-name="$PAGES_PROJECT" \
    --branch="$PRODUCTION_BRANCH" \
    --commit-dirty=true \
    --commit-message="v$TARGET_VERSION"

  echo ""
  echo "--- Verifying production ---"
  VERIFIED=false
  for i in $(seq 1 "$VERIFY_RETRIES"); do
    sleep "$VERIFY_INTERVAL"
    REMOTE_VERSION=$(curl -sf "$VERIFY_URL" | node -e "
      let d=''; process.stdin.on('data',c=>d+=c);
      process.stdin.on('end',()=>{try{process.stdout.write(JSON.parse(d).version||'?')}catch{process.stdout.write('?')}})
    " 2>/dev/null || echo "?")
    if [[ "$REMOTE_VERSION" == "$TARGET_VERSION" ]]; then
      echo "  ✓ Production verified: $REMOTE_VERSION"
      VERIFIED=true
      break
    fi
    echo "  attempt $i/$VERIFY_RETRIES: got '$REMOTE_VERSION', expected '$TARGET_VERSION'..."
  done
  if [[ "$VERIFIED" == false ]]; then
    echo "  ⚠ Verification timed out — check manually in a minute."
  fi

  # Verify bundle is downloadable
  BUNDLE_HTTP=$(curl -sf -o /dev/null -w "%{http_code}" "$BUNDLE_BASE_URL/$TARGET_VERSION.zip" 2>/dev/null || echo "000")
  if [[ "$BUNDLE_HTTP" == "200" ]]; then
    echo "  ✓ OTA bundle downloadable: $BUNDLE_BASE_URL/$TARGET_VERSION.zip"
  else
    echo "  ⚠ OTA bundle returned HTTP $BUNDLE_HTTP (may need propagation time)"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# TARGET: worker (Cloudflare Worker — sync backend)
# ══════════════════════════════════════════════════════════════════════════════

if [[ "$DO_WORKER" == true ]]; then
  echo ""
  echo "╔═══════════════════════════════════════════╗"
  echo "║  Deploying: Cloudflare Worker (sync)       ║"
  echo "╚═══════════════════════════════════════════╝"

  cd "$WORKER_DIR"
  npx wrangler deploy \
    --config wrangler.jsonc \
    --var APP_VERSION:"$TARGET_VERSION"
  cd "$PROJECT_DIR"
  echo "  ✓ Worker deployed"
fi

# ══════════════════════════════════════════════════════════════════════════════
# TARGET: apk (Android native build via Capacitor + Gradle)
# ══════════════════════════════════════════════════════════════════════════════

if [[ "$DO_APK" == true ]]; then
  echo ""
  echo "╔═══════════════════════════════════════════╗"
  echo "║  Building: Android APK                     ║"
  echo "╚═══════════════════════════════════════════╝"

  if [[ ! -d "$ANDROID_DIR" ]]; then
    echo "  ERROR: android/ directory not found. Run 'npx cap add android' first."
    exit 1
  fi

  if ! command -v java &>/dev/null; then
    echo "  ERROR: Java not found. Install JDK 17+ for Gradle."
    exit 1
  fi

  CURRENT_APK_VERSION=$(grep -oP 'versionName "\K[^"]+' "$ANDROID_DIR/app/build.gradle")
  CURRENT_APK_CODE=$(grep -oP 'versionCode \K\d+' "$ANDROID_DIR/app/build.gradle")
  echo "  Current APK: v$CURRENT_APK_VERSION (code $CURRENT_APK_CODE)"

  # Bump APK versionCode (+1) and versionName (minor +1)
  NEW_APK_CODE=$((CURRENT_APK_CODE + 1))
  APK_SUFFIX=""
  APK_BASE="$CURRENT_APK_VERSION"
  if [[ "$CURRENT_APK_VERSION" == *-* ]]; then
    APK_SUFFIX="-${CURRENT_APK_VERSION#*-}"
    APK_BASE="${CURRENT_APK_VERSION%%-*}"
  fi
  IFS='.' read -ra APK_PARTS <<< "$APK_BASE"
  APK_MINOR=$((${APK_PARTS[1]:-0} + 1))
  NEW_APK_VERSION="${APK_PARTS[0]}.$APK_MINOR.${APK_PARTS[2]:-0}$APK_SUFFIX"

  sed -i "s/versionCode $CURRENT_APK_CODE/versionCode $NEW_APK_CODE/" \
    "$ANDROID_DIR/app/build.gradle"
  sed -i "s/versionName \"$CURRENT_APK_VERSION\"/versionName \"$NEW_APK_VERSION\"/" \
    "$ANDROID_DIR/app/build.gradle"
  echo "  Bumped APK: v$NEW_APK_VERSION (code $NEW_APK_CODE)"

  node -e "
    const fs = require('fs');
    const manifest = JSON.parse(fs.readFileSync('public/version.json', 'utf8'));
    manifest.latestNativeVersion = '$NEW_APK_VERSION';
    fs.writeFileSync('public/version.json', JSON.stringify(manifest, null, 2) + '\n');
  "
  echo "  ✓ version.json latestNativeVersion → $NEW_APK_VERSION"

  echo ""
  echo "--- Capacitor sync ---"
  npx cap sync android
  echo "  ✓ cap sync complete"

  echo ""
  echo "--- Gradle assembleDebug ---"
  cd "$ANDROID_DIR"
  ./gradlew assembleDebug --quiet
  cd "$PROJECT_DIR"

  APK_PATH="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
  if [[ -f "$APK_PATH" ]]; then
    APK_SIZE=$(($(stat -c%s "$APK_PATH") / 1024 / 1024))
    echo "  ✓ APK built: ${APK_SIZE} MB"

    DOWNLOADS="/mnt/c/Users/julio/Downloads"
    if [[ -d "$DOWNLOADS" ]]; then
      cp "$APK_PATH" "$DOWNLOADS/TripPilot-${NEW_APK_VERSION}.apk"
      echo "  ✓ Copied to $DOWNLOADS/TripPilot-${NEW_APK_VERSION}.apk"
    fi

    # If also deploying pages, rebuild with the new APK + updated version.json
    if [[ "$DO_PAGES" == true ]]; then
      echo ""
      echo "--- Rebuilding Pages with new APK ---"
      npm run build
      node scripts/make-ota-bundle.mjs
      npx wrangler pages deploy dist \
        --project-name="$PAGES_PROJECT" \
        --branch="$PRODUCTION_BRANCH" \
        --commit-dirty=true \
        --commit-message="v$TARGET_VERSION (APK ${NEW_APK_VERSION})"
      echo "  ✓ Pages redeployed with new APK + OTA"
    fi
  else
    echo "  ✗ APK build failed — file not found"
    exit 1
  fi
fi

# ── Final summary ────────────────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════"
echo "  Deploy complete — v$TARGET_VERSION"
echo ""
[[ "$DO_PAGES" == true ]]  && echo "  ✓ Pages:  $PRODUCTION_URL"
[[ "$DO_WORKER" == true ]] && echo "  ✓ Worker: trippilot-sync"
[[ "$DO_APK" == true ]]    && echo "  ✓ APK:    ${NEW_APK_VERSION:-$CURRENT_APK_VERSION} (code ${NEW_APK_CODE:-$CURRENT_APK_CODE})"
echo ""
echo "  Users will receive this update:"
[[ "$DO_PAGES" == true ]]  && echo "    Web/PWA: next page load (SW v$((CURRENT_SW_VERSION + 1)))"
[[ "$DO_PAGES" == true ]]  && echo "    Native:  next cold start (OTA $TARGET_VERSION.zip)"
[[ "$DO_APK" == true ]]    && echo "    APK:     manual install from Downloads"
echo "═══════════════════════════════════════════════"
