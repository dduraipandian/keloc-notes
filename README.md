# Keloc Notes

Keloc Notes is a local-first desktop notes app for macOS.

It is for people who like the simple shape of Apple Notes or Bear, but want their notes stored locally, practical Markdown export, and a codebase they can understand and improve.

There is no account system, no cloud sync, and no server dependency. Your notes live on your machine.

## Screenshots

Screenshots will be added before the public release.

Suggested set:

- main three-pane notes view
- rich text editor with toolbar
- folder-scoped search
- import/export or backup flow
- first-run empty state

## What It Does

- Three-pane notes workflow: folders, note list, editor.
- Rich text editing with a Tiptap-based editor.
- Local folder hierarchy with nested folders.
- Favorites and Trash.
- Folder-scoped search across note titles and note content.
- Markdown export for the current note.
- Markdown ZIP export and import for folder-preserving portability.
- JSON backup export and restore.
- Light, dark, and system theme support.
- macOS native menu integration for common app actions.

The app is intentionally quiet and local. It is not trying to be a team wiki, a cloud notebook, or a Markdown IDE.

## Platform Support

Keloc Notes is currently targeted at macOS.

| Platform | Status | Notes |
| --- | --- | --- |
| macOS | Supported target | Primary release path. Native menu behavior and packaging are built around macOS first. |
| Windows | Preview | Core app logic may run, but release polish and native menu parity are not complete. |
| Linux | Preview | Core app logic may run, but release polish and native menu parity are not complete. |

For now, public release messaging should treat this as a macOS app. Windows and Linux are preview paths until they receive their own release pass.

## Install On macOS

The intended install path is a macOS `.dmg`.

Once a release is published:

1. Download the latest `.dmg` from GitHub Releases.
2. Open it.
3. Drag `Keloc Notes.app` into `Applications`.
4. Launch the app from `Applications`.

The current macOS build is not signed or notarized. That is a deliberate deferral for the current release pass, not an accidental omission.

If macOS blocks the first launch:

1. Open `System Settings` -> `Privacy & Security`.
2. Find the blocked `Keloc Notes` message.
3. Choose `Open Anyway`.
4. Confirm the prompt and launch again.

You can also right-click `Keloc Notes.app` in Finder and choose `Open`.

## Release Channel

The release channel is intentionally simple:

- macOS builds are distributed as `.dmg` files through GitHub Releases
- updates are manual
- there is no auto-update system yet

When a new version is available, download the new `.dmg` and replace the app in `Applications`.

## First Run

On a fresh library, the app guides you through the basic flow:

1. Create a folder.
2. Create a note.
3. Write in the editor.
4. Search inside the active folder tree.
5. Export or back up when you want a portable copy.

The app is designed around repeated daily use: open it, write, search, organize, and leave without thinking about accounts or network state.

## Data Ownership

Keloc Notes is local-first in the practical sense:

- notes, folders, settings, and note assets are stored on the local machine
- the app does not require a network connection to work
- there is no built-in sync service
- import and export use user-chosen local files

The current storage layer is IndexedDB inside the embedded desktop webview runtime. The app does not currently add its own encryption before writing notes to local storage.

More detail is in [docs/security-and-storage.md](docs/security-and-storage.md).

## Backup And Restore

Keloc Notes has two portability paths:

- Markdown export/import for human-readable note portability.
- JSON backup export/import for app-level recovery.

JSON backup behavior today:

- backups use `schemaVersion: 1`
- backup import is only for a new or reset app library
- backup import does not merge into an existing notes library
- a valid restore replaces the empty local database with folders, notes, note contents, settings, and note assets from the backup
- unsupported or malformed backups fail before changing local notes
- if any folder, note, asset, or setting cannot be restored, the whole restore fails without leaving a partial imported library

Markdown ZIP import/export is useful for portability, but it is not the same thing as a full JSON backup.

Permanent deletes also create local safety archives in IndexedDB before the note is removed. Those archives are automatically trimmed by age. The retention window is configurable in Settings, with 30 days as the default.

Recovery guidance is in [docs/recovery.md](docs/recovery.md).

## Save And Failure Behavior

The app tries hard not to fail silently around user data.

Current save behavior:

- note edits are debounced for about 400 ms
- once a note save starts, note metadata and note content are written together in one IndexedDB transaction
- switching notes, exporting, importing, and normal app close force pending note writes to flush
- normal app close shows a blocking "Saving Changes" status while pending note writes are flushed

Current limits:

- force quit, process crash, or OS kill can still interrupt changes before a flush starts
- Markdown import can leave already-created or already-overwritten notes in place if the app is interrupted after import actions begin
- JSON backup restore is transactional, but you should not intentionally interrupt it

Failed export operations do not change local notes. Failed JSON backup imports leave local notes unchanged when the backup is invalid or restore cannot complete. Failed Markdown imports may have already created or overwritten notes, so review the notes list before retrying.

## Run From Source

### Prerequisites

- Go `1.23+`
- Node.js `20.19+` or `22.12+`
- Wails CLI `v2`
- OS-specific Wails prerequisites for your machine

Install Wails if needed:

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

### Start The App

```bash
git clone https://github.com/dduraipandian/keloc-notes.git
cd keloc-notes/frontend
npm install
cd ..
wails dev
```

### Build Locally

```bash
wails build
```

To create the macOS release package:

```bash
./scripts/build-icon.sh frontend/src/lib/assets/app-icon.svg build/appicon
wails build
./scripts/create-dmg.sh
```

More detail is in [docs/macos-release.md](docs/macos-release.md).

## Project Shape

The desktop shell is Go + Wails. Most product logic lives in the Svelte frontend.

```text
.
├── app.go / main.go              # Wails app shell and native bindings
├── exporter/                     # Markdown ZIP import/export helpers
├── menu/                         # Native menu integration
└── frontend/
    ├── src/lib/stores/           # Svelte 5 stores and local state
    ├── src/lib/stores/services/  # Cross-store user actions
    ├── src/lib/infrastructure/   # IndexedDB and repositories
    ├── src/lib/editor/           # Tiptap editor helpers
    └── tests/                    # Unit and E2E tests
```

Useful starting points:

- `frontend/src/routes/+layout.svelte`: app boot, layout, keyboard handling, menu bridge wiring
- `frontend/src/lib/stores/notes.svelte.ts`: note lifecycle and persistence
- `frontend/src/lib/stores/folders.svelte.ts`: folder tree and trash behavior
- `frontend/src/lib/infrastructure/idbr.ts`: IndexedDB schema and transactional persistence
- `frontend/src/lib/menu/menuBridge.svelte.ts`: native menu event handling
- `app.go`: Wails bindings for file dialogs and native events

## Development Checks

From `frontend/`:

```bash
npm run test
npm run check
npm run test:e2e
npm run lint
```

From the repo root:

```bash
go test ./...
```

Note: `npm run check` currently has known baseline type issues unrelated to the failure-recovery work. Unit tests are the most reliable green gate at the moment.

## Current Limitations

- macOS is the only supported release target for now.
- Windows and Linux are preview paths.
- The macOS build is distributed as a `.dmg`, but signing and notarization are deferred.
- No sync, collaboration, sharing, mobile client, or account system.
- No app-level encryption at rest.
- No auto-update system.
- No published benchmark numbers yet.

## Contributing

The codebase is still release-prep stage, so focused contributions are more useful than broad rewrites.

Good contributions usually:

- keep product logic in the frontend unless native desktop behavior is required
- include tests for behavior changes
- avoid new dependencies unless the tradeoff is clear
- preserve local-first behavior and explicit recovery paths
- verify changes in `wails dev` when they affect user-visible behavior

Public maintainer hygiene is still being filled in. `SECURITY.md` exists, but `CONTRIBUTING.md`, issue templates, PR templates, and CI workflows are still pending.

## License

Apache License 2.0. See [LICENSE](LICENSE).

## Support

If something breaks or feels unclear, open an issue with:

- what you were trying to do
- what happened instead
- whether the problem affects notes, import/export, startup, or packaging
- your macOS version and app version

Reports about data safety, import/export, and first-run experience are especially useful right now.
