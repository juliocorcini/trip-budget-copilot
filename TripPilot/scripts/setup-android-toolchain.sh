#!/usr/bin/env bash
#
# TripPilot — one-shot Android toolchain setup for WSL/Linux.
#
# This installs everything needed to build the Android AAB from the command line,
# WITHOUT Android Studio. If you prefer, you can skip this entirely and just open
# TripPilot/android in Android Studio (Windows) — it bundles the JDK + SDK.
#
# What it does:
#   1. Ensures a JDK 21 is available (Capacitor 8 compiles its native module at Java 21).
#   2. Installs the Android command-line tools + SDK platform 36 + build-tools.
#   3. Accepts the SDK licenses.
#   4. Writes android/local.properties so Gradle finds the SDK.
#
# Usage:
#   bash scripts/setup-android-toolchain.sh
#
# Override the command-line tools URL if the default 404s (get the latest "Linux"
# link from https://developer.android.com/studio#command-line-tools-only):
#   CMDLINE_TOOLS_URL="https://dl.google.com/android/repository/commandlinetools-linux-XXXXXXXX_latest.zip" bash scripts/setup-android-toolchain.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"          # TripPilot/
ANDROID_DIR="$PROJECT_DIR/android"
SDK_ROOT="${ANDROID_SDK_ROOT:-$HOME/android-sdk}"
CMDLINE_TOOLS_URL="${CMDLINE_TOOLS_URL:-https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip}"

echo "==> Project:   $PROJECT_DIR"
echo "==> SDK root:  $SDK_ROOT"

# --- 1. JDK 17 ---------------------------------------------------------------
need_jdk=true
if command -v java >/dev/null 2>&1; then
  jver="$(java -version 2>&1 | head -n1 | sed -E 's/.*version "([0-9]+).*/\1/')"
  if [ "${jver:-0}" -ge 21 ] 2>/dev/null; then
    echo "==> JDK $jver already present."
    need_jdk=false
  fi
fi
if [ "$need_jdk" = true ]; then
  echo "==> Installing OpenJDK 21 (requires sudo)..."
  sudo apt-get update -y
  sudo apt-get install -y openjdk-21-jdk unzip curl
fi

# --- 2. Command-line tools ---------------------------------------------------
if [ ! -x "$SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" ]; then
  echo "==> Downloading Android command-line tools..."
  mkdir -p "$SDK_ROOT/cmdline-tools"
  tmpzip="$(mktemp --suffix=.zip)"
  curl -fL "$CMDLINE_TOOLS_URL" -o "$tmpzip"
  rm -rf "$SDK_ROOT/cmdline-tools/latest" "$SDK_ROOT/cmdline-tools/cmdline-tools"
  unzip -q "$tmpzip" -d "$SDK_ROOT/cmdline-tools"
  mv "$SDK_ROOT/cmdline-tools/cmdline-tools" "$SDK_ROOT/cmdline-tools/latest"
  rm -f "$tmpzip"
else
  echo "==> Command-line tools already installed."
fi

export ANDROID_SDK_ROOT="$SDK_ROOT"
export PATH="$SDK_ROOT/cmdline-tools/latest/bin:$SDK_ROOT/platform-tools:$PATH"

# --- 3. SDK packages + licenses ---------------------------------------------
echo "==> Accepting licenses + installing SDK packages (platform 36, build-tools)..."
# `|| true`: `yes` gets SIGPIPE when sdkmanager stops reading; with pipefail that
# would abort the script even though the licenses were accepted fine.
yes | sdkmanager --licenses >/dev/null || true
sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"

# --- 4. local.properties -----------------------------------------------------
echo "sdk.dir=$SDK_ROOT" > "$ANDROID_DIR/local.properties"
echo "==> Wrote $ANDROID_DIR/local.properties"

cat <<EOF

✅ Android toolchain ready.

Next:
  1. Create your upload keystore (once) and keystore.properties — see
     android/keystore.properties.example.
  2. Build the web + sync + bundle:
       nvm use 22 && npm run build && npx cap sync android
       cd android && ./gradlew bundleRelease
  3. The signed AAB will be at:
       android/app/build/outputs/bundle/release/app-release.aab

If 'curl' failed on the tools URL, grab the latest "Linux" link from
https://developer.android.com/studio#command-line-tools-only and re-run with
CMDLINE_TOOLS_URL=... bash scripts/setup-android-toolchain.sh
EOF
