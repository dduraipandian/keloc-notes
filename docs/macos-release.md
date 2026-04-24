# macOS Release Packaging

This project currently treats macOS as the primary release target.

## Goal

Produce a `.dmg` that contains:

- `Keloc Notes.app`
- an `Applications` shortcut so the install flow is drag-and-drop

## Current State

- distribution format: `.dmg`
- notarization: deferred for now
- consequence: first launch may require a manual Gatekeeper override

## Build The App Icon

The macOS icon source is:

```text
frontend/src/lib/assets/app-icon.svg
```

Generate the `.icns` asset with:

```bash
./scripts/build-icon.sh frontend/src/lib/assets/app-icon.svg build/appicon
```

That produces:

```text
build/appicon.icns
```

Requirements:

- `rsvg-convert`
- `iconutil` (included with macOS)

## Build The App Bundle

From the repo root:

```bash
./scripts/build-icon.sh frontend/src/lib/assets/app-icon.svg build/appicon
wails build
```

That should produce `build/bin/Keloc Notes.app`.

Note: Wails still generates the app bundle icon from its normal build inputs. In this repo, the `.dmg` packaging step replaces the staged bundle icon with `build/appicon.icns` if that file exists.

## Build The DMG

From the repo root:

```bash
./scripts/build-icon.sh frontend/src/lib/assets/app-icon.svg build/appicon
wails build
./scripts/create-dmg.sh
```

Default output:

```text
build/bin/keloc-notes-macos.dmg
```

If `build/appicon.icns` exists, `create-dmg.sh` will copy it into the staged app bundle as `Contents/Resources/iconfile.icns` before creating the disk image.

## Script Inputs

The packaging script accepts a few environment overrides:

```bash
APP_NAME="Keloc Notes" \
APP_BUNDLE="build/bin/Keloc Notes.app" \
DMG_NAME="keloc-notes-macos.dmg" \
OUTPUT_DIR="build/bin" \
VOLUME_NAME="Keloc Notes" \
CUSTOM_ICNS="build/appicon.icns" \
./scripts/create-dmg.sh
```

## Manual Verification

Before calling the packaging step complete, verify on a clean macOS machine or VM:

1. Open the `.dmg`.
2. Drag `Keloc Notes.app` into `Applications`.
3. Launch the app from `Applications`.
4. Confirm the expected Gatekeeper friction for an unsigned / unnotarized build.
5. Verify the documented workaround actually works.
6. Confirm the app opens and basic note creation works.

## Not Yet Included

- code signing
- notarization
- custom `.dmg` background/layout polish
- automated release workflow
