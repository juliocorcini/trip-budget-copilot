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
#   ./scripts/deploy.sh --skip-bump        # deploy current version, no bump
#   ./scripts/deploy.sh --skip-bump worker # worker-only, no bump
#
# Flags (can appear anywhere in args):
#   --skip-bump    don't bump version
#   --skip-tests   skip the pre-deploy type check
#   --dry-run      show what would happen without executing
#

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKER_DIR="$PROJECT_DIR/worker"
ANDROID_DIR="$PROJECT_DIR/android"

PAGES_PROJECT="trippilot"
PRODUCTION_BRANCH="master"
VERIFY_URL="https://trippilot.pages.dev/version.json"
VERIFY_RETRIES=6
VERIFY_INTERVAL=5

cd "$PROJECT_DIR"

# ── Parse arguments ──────────────────────────────────────────────────────────

TARGETS=()
EXPLICIT_VERSION=""
SKIP_BUMP=false
SKIP_TESTS=false
DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    --skip-bump)  SKIP_BUMP=true ;;
    --skip-tests) SKIP_TESTS=true ;;
    --dry-run)    DRY_RUN=true ;;
    pages|worker|apk|all) TARGETS+=("$arg") ;;
    *)
      if [[ "$arg" =~ ^[0-9]+\.[0-9]+\.[0-9]+ ]]; then
        EXPLICIT_VERSION="$arg"
      else
        echo "Unknown argument: $arg"
        echo "Usage: ./scripts/deploy.sh [pages|worker|apk|all] [version] [--skip-bump] [--skip-tests] [--dry-run]"
        exit 1
      fi
      ;;
  esac
done

# Default to "pages" if no targets specified
if [[ ${#TARGETS[@]} -eq 0 ]]; then
  TARGETS=("pages")
fi

# Expand "all" to all targets
if [[ " ${TARGETS[*]} " == *" all "* ]]; then
  TARGETS=("pages" "worker" "apk")
fi

# De-duplicate targets
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

# ── Read current version ─────────────────────────────────────────────────────

CURRENT_VERSION=$(node -e "process.stdout.write(require('./package.json').version)")
echo "Current version: $CURRENT_VERSION"

# ── Determine target version ─────────────────────────────────────────────────

TARGET_VERSION="$CURRENT_VERSION"

if [[ "$SKIP_BUMP" == true ]]; then
  echo "Skipping version bump — deploying $CURRENT_VERSION as-is."
elif [[ -n "$EXPLICIT_VERSION" ]]; then
  TARGET_VERSION="$EXPLICIT_VERSION"
  echo "Explicit version: $TARGET_VERSION"
else
  # Auto-bump: increment the patch number (handles -rc suffix).
  SUFFIX=""
  BASE_VERSION="$CURRENT_VERSION"
  if [[ "$CURRENT_VERSION" == *-* ]]; then
    SUFFIX="-${CURRENT_VERSION#*-}"
    BASE_VERSION="${CURRENT_VERSION%%-*}"
  fi
  IFS='.' read -ra PARTS <<< "$BASE_VERSION"
  PATCH=$(( ${PARTS[2]:-0} + 1 ))
  TARGET_VERSION="${PARTS[0]}.${PARTS[1]}.$PATCH$SUFFIX"
  echo "Auto-bumped: $CURRENT_VERSION → $TARGET_VERSION"
fi

if [[ "$DRY_RUN" == true ]]; then
  echo ""
  echo "[DRY RUN] Would deploy v$TARGET_VERSION to: ${TARGETS[*]}"
  [[ "$DO_PAGES" == true ]]  && echo "  - Cloudflare Pages (branch: $PRODUCTION_BRANCH) + OTA bundle"
  [[ "$DO_WORKER" == true ]] && echo "  - Cloudflare Worker (wrangler deploy from worker/)"
  [[ "$DO_APK" == true ]]    && echo "  - Android APK (cap sync + gradle assembleDebug)"
  exit 0
fi

# ── Bump version in all files ────────────────────────────────────────────────

if [[ "$SKIP_BUMP" == false && "$TARGET_VERSION" != "$CURRENT_VERSION" ]]; then
  echo ""
  echo "=== Bumping version: $CURRENT_VERSION → $TARGET_VERSION ==="

  # package.json
  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    pkg.version = '$TARGET_VERSION';
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
  "
  echo "  ✓ package.json"

  # app-version.ts
  sed -i "s/export const APP_VERSION = '.*'/export const APP_VERSION = '$TARGET_VERSION'/" \
    src/utils/app-version.ts
  echo "  ✓ src/utils/app-version.ts"

  # version.json (OTA manifest)
  node -e "
    const fs = require('fs');
    const manifest = JSON.parse(fs.readFileSync('public/version.json', 'utf8'));
    manifest.version = '$TARGET_VERSION';
    manifest.bundleUrl = 'https://trippilot.pages.dev/bundles/$TARGET_VERSION.zip';
    fs.writeFileSync('public/version.json', JSON.stringify(manifest, null, 2) + '\n');
  "
  echo "  ✓ public/version.json"

  # sw.js cache name (bump numeric suffix)
  CURRENT_SW_VERSION=$(grep -oP "trippilot-v\K\d+" public/sw.js)
  NEW_SW_VERSION=$((CURRENT_SW_VERSION + 1))
  sed -i "s/trippilot-v${CURRENT_SW_VERSION}/trippilot-v${NEW_SW_VERSION}/" public/sw.js
  echo "  ✓ public/sw.js (cache v${CURRENT_SW_VERSION} → v${NEW_SW_VERSION})"
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

  # Fetch live APK into dist/ (keeps /trippilot.apk available on Pages)
  echo ""
  echo "--- Fetching live APK ---"
  node scripts/fetch-live-apk.mjs

  # Generate OTA bundle (dist.zip for Capgo live-update)
  echo ""
  echo "--- Generating OTA bundle ---"
  node scripts/make-ota-bundle.mjs

  # Deploy to Cloudflare Pages (production = master)
  echo ""
  echo "--- Deploying to Cloudflare Pages (branch: $PRODUCTION_BRANCH) ---"
  npx wrangler pages deploy dist \
    --project-name="$PAGES_PROJECT" \
    --branch="$PRODUCTION_BRANCH" \
    --commit-dirty=true \
    --commit-message="v$TARGET_VERSION"

  # Verify production
  echo ""
  echo "--- Verifying production ---"
  VERIFIED=false
  for i in $(seq 1 "$VERIFY_RETRIES"); do
    sleep "$VERIFY_INTERVAL"
    LIVE_VERSION=$(curl -sf "$VERIFY_URL" | node -e "
      let d=''; process.stdin.on('data',c=>d+=c);
      process.stdin.on('end',()=>{try{process.stdout.write(JSON.parse(d).version||'?')}catch{process.stdout.write('?')}})
    " 2>/dev/null || echo "?")
    if [[ "$LIVE_VERSION" == "$TARGET_VERSION" ]]; then
      echo "  ✓ Production verified: $LIVE_VERSION"
      VERIFIED=true
      break
    fi
    echo "  attempt $i/$VERIFY_RETRIES: got '$LIVE_VERSION', expected '$TARGET_VERSION'..."
  done
  if [[ "$VERIFIED" == false ]]; then
    echo "  ⚠ Verification timed out — check manually in a minute."
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

  # Check prerequisites
  if [[ ! -d "$ANDROID_DIR" ]]; then
    echo "  ERROR: android/ directory not found. Run 'npx cap add android' first."
    exit 1
  fi

  if ! command -v java &>/dev/null; then
    echo "  ERROR: Java not found. Install JDK 17+ for Gradle."
    exit 1
  fi

  # Read current APK version for the bump prompt
  CURRENT_APK_VERSION=$(grep -oP 'versionName "\K[^"]+' "$ANDROID_DIR/app/build.gradle")
  CURRENT_APK_CODE=$(grep -oP 'versionCode \K\d+' "$ANDROID_DIR/app/build.gradle")
  echo "  Current APK: v$CURRENT_APK_VERSION (code $CURRENT_APK_CODE)"

  # Bump APK versionCode (always +1) and versionName (use target or prompt)
  if [[ "$SKIP_BUMP" == false ]]; then
    NEW_APK_CODE=$((CURRENT_APK_CODE + 1))
    # The APK versionName follows its own scheme (0.77.0 → 0.78.0)
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

    # Update version.json with the new native version
    node -e "
      const fs = require('fs');
      const manifest = JSON.parse(fs.readFileSync('public/version.json', 'utf8'));
      manifest.latestNativeVersion = '$NEW_APK_VERSION';
      fs.writeFileSync('public/version.json', JSON.stringify(manifest, null, 2) + '\n');
    "
    echo "  ✓ version.json latestNativeVersion → $NEW_APK_VERSION"
  fi

  # Sync web assets into the Android project
  echo ""
  echo "--- Capacitor sync ---"
  npx cap sync android
  echo "  ✓ cap sync complete"

  # Build APK
  echo ""
  echo "--- Gradle assembleDebug ---"
  cd "$ANDROID_DIR"
  ./gradlew assembleDebug --quiet
  cd "$PROJECT_DIR"

  APK_PATH="$ANDROID_DIR/app/build/outputs/apk/debug/app-debug.apk"
  if [[ -f "$APK_PATH" ]]; then
    APK_SIZE=$(($(stat -c%s "$APK_PATH") / 1024 / 1024))
    echo "  ✓ APK built: $APK_PATH (${APK_SIZE} MB)"

    # Copy to Downloads for easy install
    DOWNLOADS="/mnt/c/Users/julio/Downloads"
    if [[ -d "$DOWNLOADS" ]]; then
      FINAL_VERSION="${NEW_APK_VERSION:-$CURRENT_APK_VERSION}"
      cp "$APK_PATH" "$DOWNLOADS/TripPilot-${FINAL_VERSION}.apk"
      echo "  ✓ Copied to $DOWNLOADS/TripPilot-${FINAL_VERSION}.apk"
    fi

    # If also deploying pages, rebuild OTA + redeploy with updated APK + version.json
    if [[ "$DO_PAGES" == true ]]; then
      echo ""
      echo "--- Rebuilding OTA bundle with new APK ---"
      npm run build
      node scripts/make-ota-bundle.mjs
      npx wrangler pages deploy dist \
        --project-name="$PAGES_PROJECT" \
        --branch="$PRODUCTION_BRANCH" \
        --commit-dirty=true \
        --commit-message="v$TARGET_VERSION (APK ${FINAL_VERSION})"
      echo "  ✓ Pages redeployed with new APK + OTA"
    fi
  else
    echo "  ✗ APK build failed — file not found at $APK_PATH"
    exit 1
  fi
fi

# ── Summary ──────────────────────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════"
echo "  Deploy complete — v$TARGET_VERSION"
echo ""
[[ "$DO_PAGES" == true ]]  && echo "  ✓ Pages:  https://trippilot.pages.dev"
[[ "$DO_WORKER" == true ]] && echo "  ✓ Worker: trippilot-sync"
[[ "$DO_APK" == true ]]    && echo "  ✓ APK:    ${NEW_APK_VERSION:-$CURRENT_APK_VERSION} (code ${NEW_APK_CODE:-$CURRENT_APK_CODE})"
echo "═══════════════════════════════════════════════"
