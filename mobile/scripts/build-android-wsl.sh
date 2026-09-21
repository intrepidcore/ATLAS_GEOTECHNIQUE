#!/usr/bin/env bash
set -euo pipefail

# Build Android reproductible pour le poste Windows/WSL Atlas.
# À lancer depuis PowerShell avec :
# wsl -d Ubuntu-22.04 -- bash /mnt/d/PROJET_ATLAS_MASTER/atlas_reclone/mobile/scripts/build-android-wsl.sh

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="${ATLAS_MOBILE_BUILD_DIR:-$HOME/projects/atlas-mobile-build}"
OUTPUT_NAME="${ATLAS_MOBILE_APK_NAME:-atlas-terrain-tailscale-fixed.apk}"
ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"

case "$BUILD_DIR" in
  "$HOME"/projects/atlas-mobile-build*) ;;
  *)
    echo "Refus : ATLAS_MOBILE_BUILD_DIR doit rester sous $HOME/projects/atlas-mobile-build*" >&2
    exit 2
    ;;
esac

if [[ ! -d "$ANDROID_HOME" ]]; then
  echo "Android SDK introuvable dans $ANDROID_HOME" >&2
  exit 3
fi

mkdir -p "$BUILD_DIR"
rsync -a --delete \
  --exclude node_modules \
  --exclude .git \
  --exclude android \
  --exclude .expo \
  --exclude '*.apk' \
  --exclude '*.7z.*' \
  "$SOURCE_DIR/" "$BUILD_DIR/"

export ANDROID_HOME
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin"

cd "$BUILD_DIR"
npm ci
npx expo prebuild --platform android --no-install --clean

grep -q 'android:usesCleartextTraffic="true"' android/app/src/main/AndroidManifest.xml
grep -q '^reactNativeArchitectures=arm64-v8a$' android/gradle.properties
grep -q 'ndk { abiFilters "arm64-v8a" }' android/app/build.gradle

cd android
./gradlew assembleRelease \
  -PreactNativeArchitectures=arm64-v8a \
  -Pandroid.enableShrinkResourcesInReleaseBuilds=true \
  -Pandroid.enableProguardInReleaseBuilds=true \
  --rerun-tasks \
  --no-daemon

APK_PATH="$BUILD_DIR/android/app/build/outputs/apk/release/app-release.apk"
test -s "$APK_PATH"
cp "$APK_PATH" "$SOURCE_DIR/$OUTPUT_NAME"
sha256sum "$SOURCE_DIR/$OUTPUT_NAME"
echo "APK généré : $SOURCE_DIR/$OUTPUT_NAME"
