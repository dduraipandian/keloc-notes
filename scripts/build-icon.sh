#!/usr/bin/env bash
set -euo pipefail

SVG="${1:-icon.svg}"
NAME="${2:-AppIcon}"
ICONSET="${NAME}.iconset"
OUT="${NAME}.icns"
PNG="${NAME}.png"

rm -rf "$ICONSET" "$OUT"
mkdir -p "$ICONSET"

render() {
  local points="$1"
  local scale="$2"
  local suffix=""
  local pixels=$((points * scale))

  if [ "$scale" -eq 2 ]; then
    suffix="@2x"
  fi

  rsvg-convert \
    -w "$pixels" \
    -h "$pixels" \
    "$SVG" \
    -o "$ICONSET/icon_${points}x${points}${suffix}.png"
}

render 16 1
render 16 2
render 32 1
render 32 2
render 128 1
render 128 2
render 256 1
render 256 2
render 512 1
render 512 2

rsvg-convert \
  -w 1024 \
  -h 1024 \
  "$SVG" \
  -o "$PNG"

iconutil -c icns "$ICONSET" -o "$OUT"

echo "Created $PNG and $OUT"
