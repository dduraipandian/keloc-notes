#!/bin/zsh

set -euo pipefail

APP_NAME="${APP_NAME:-Keloc Notes}"
APP_BUNDLE="${APP_BUNDLE:-build/bin/${APP_NAME}.app}"
DMG_NAME="${DMG_NAME:-keloc-notes-macos.dmg}"
OUTPUT_DIR="${OUTPUT_DIR:-build/bin}"
STAGING_DIR="${STAGING_DIR:-build/tmp/dmg}"
VOLUME_NAME="${VOLUME_NAME:-Keloc Notes}"
APPLICATIONS_LINK="${STAGING_DIR}/Applications"
DMG_PATH="${OUTPUT_DIR}/${DMG_NAME}"
CUSTOM_ICNS="${CUSTOM_ICNS:-build/appicon.icns}"

replace_icon() {
  local app_path="$1"
  local icon_path="${app_path}/Contents/Resources/iconfile.icns"

  if [[ -f "${icon_path}" ]]; then
    cp "${CUSTOM_ICNS}" "${icon_path}"
    echo "Replaced app icon in ${app_path}"
  fi
}

if [[ ! -d "${APP_BUNDLE}" ]]; then
  echo "App bundle not found: ${APP_BUNDLE}"
  echo "Run 'wails build' first."
  exit 1
fi

if ! command -v hdiutil >/dev/null 2>&1; then
  echo "hdiutil is required to build a macOS dmg."
  exit 1
fi

rm -rf "${STAGING_DIR}"
mkdir -p "${STAGING_DIR}"
mkdir -p "${OUTPUT_DIR}"

if [[ -f "${CUSTOM_ICNS}" ]]; then
  replace_icon "${APP_BUNDLE}"
fi

cp -R "${APP_BUNDLE}" "${STAGING_DIR}/"

if [[ -f "${CUSTOM_ICNS}" ]]; then
  STAGED_APP="${STAGING_DIR}/${APP_NAME}.app"
  replace_icon "${STAGED_APP}"
fi

ln -s /Applications "${APPLICATIONS_LINK}"
rm -f "${DMG_PATH}"

hdiutil create \
  -volname "${VOLUME_NAME}" \
  -srcfolder "${STAGING_DIR}" \
  -ov \
  -format UDZO \
  "${DMG_PATH}"

echo "Created ${DMG_PATH}"
