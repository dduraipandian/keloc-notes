# keloc-notes

A local-first desktop notes app for people who like the shape of Apple Notes or Bear, but want their data to stay local and export cleanly.

## Why This Exists

Most note apps force a tradeoff:

- fast capture, but your data is trapped in a proprietary format
- markdown files, but the UX feels like a text editor instead of a notes app
- sync-first products, but you lose the speed and privacy of local storage

That is the gap `keloc-notes` is trying to fill. It uses a three-pane notes UI, keeps data on the machine, and gives you import/export paths that are actually useful.

It is mainly aimed at:

- developers who want a local-first notes app they can hack on
- users who want a native-feeling desktop app without mandatory accounts
- maintainers who care about clear data ownership and simple recovery flows

## Features

- Local-first storage. Notes, folders, and settings are stored on-device in IndexedDB.
- Native desktop shell. Built with Wails, so the app runs as a desktop window instead of a browser tab.
- Three-pane note workflow. Browse folders, scan note lists, and edit the selected note side by side.
- Folder-scoped full-text search. Search matches note titles and note content inside the active folder subtree.
- Favorites and trash views. Keep important notes close and recover deleted notes before permanent removal.
- Folder hierarchy. Create nested folders and move through a structured note library.
- Practical export paths. Export one note as `.md`, export all notes as a folder-preserving `.zip`, or export a JSON backup.
- Import support. Restore from JSON backup or import markdown archives.
- Native menu integration on macOS. Menu actions drive app behavior such as new note, search, export, theme, and trash actions.
- Theme and appearance settings. Light, dark, or follow-system theme, plus customizable folder accent color.
- Test coverage across stores, services, infrastructure, and end-to-end flows.

## Platform Support

Right now this should be treated as a macOS-first app.

| Platform | Status | Notes |
| --- | --- | --- |
| macOS | Supported | Primary release target. Native menu integration is implemented and the app experience is designed around this path today. |
| Windows | Preview | Core app logic may run, but native menu parity and release polish are not complete yet. |
| Linux | Preview | Core app logic may run, but native menu parity and release polish are not complete yet. |

Release policy for now:

- Public release messaging should treat macOS as the supported platform.
- Windows and Linux should be described as preview or unsupported-for-production until parity work is complete.
- Bugs that reproduce only on preview platforms should not block a macOS-first public release unless they affect shared data integrity.

## How It Works

The app is mostly a local-first frontend running inside a thin Wails shell:

1. The Svelte app boots and loads folders, notes, and saved UI settings from IndexedDB.
2. Note metadata and note content are stored separately, so the app can load the note list first and fetch full content on demand.
3. Service classes coordinate user actions such as creating folders, deleting notes, restoring from trash, and exporting data.
4. MiniSearch builds a local full-text index for titles and content, scoped to the currently selected folder tree.
5. The Go/Wails layer handles native window behavior, file dialogs, single-instance behavior, and the native macOS menu.

Repo layout at a glance:

```text
.
├── app.go / main.go          # Wails desktop shell and file dialog bindings
├── exporter/                 # Markdown zip import/export helpers
├── menu/                     # Native menu integration (macOS implemented, others stubbed)
└── frontend/
    ├── src/lib/stores/       # App state
    ├── src/lib/services/     # User action orchestration
    ├── src/lib/infrastructure/ # IndexedDB and repositories
    └── tests/                # Unit and E2E coverage
```

## Quick Start

## Install

### macOS

The intended install path is a macOS `.dmg`.

Maintainers can package that release artifact with:

```bash
./scripts/build-icon.sh frontend/src/lib/assets/app-icon.svg build/appicon
wails build
./scripts/create-dmg.sh
```

More detail is in [docs/macos-release.md](docs/macos-release.md).

Once that release artifact is published, the install flow should be:

1. Download the latest `.dmg`.
2. Open it and drag `Keloc Notes.app` into `Applications`.
3. Open the app from `Applications`.

For now, macOS notarization is still deferred. That means the first launch may be blocked by Gatekeeper.

If macOS says the app cannot be opened because it is from an unidentified developer:

1. Open `System Settings` → `Privacy & Security`.
2. Scroll to the security section near the bottom.
3. Click `Open Anyway` for `Keloc Notes`.
4. Confirm the prompt and open the app again.

You can also use the Finder shortcut:

1. Open `Applications`.
2. Right-click `Keloc Notes.app`.
3. Choose `Open`.
4. Confirm the dialog.

This is not the long-term goal. A polished public release should be signed and notarized so this extra step is not needed.

### Run From Source

If you want to run it from source:

### Prerequisites

- Go `1.23+`
- Node.js `20.19+` or `22.12+`
- Wails CLI `v2`
- Your OS-level Wails prerequisites installed

Install the Wails CLI if you do not already have it:

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

### Run The App

```bash
git clone https://github.com/dduraipandian/keloc-notes.git
cd keloc-notes/frontend
npm install
cd ..
wails dev
```

What to expect after launch:

1. Click `New Folder` and name it `Ideas`.
2. Create a note called `Project ideas`.
3. Type a few lines into the editor.
4. Search for a word from the note body in the note-list search box.
5. Export the current note from the File menu as markdown.

Example exported markdown:

```md
# Project ideas

Ship a local-first notes app with markdown export.
```

### Build A Production Binary

```bash
wails build
```

The built desktop app is emitted by Wails using the repo's root configuration.
That produces the app bundle used for packaging. It is still a maintainer/developer step, not the end-user install flow.

## Use Cases

- Personal knowledge base you want to keep fully local.
- Developer notes that still need clean markdown export.
- Offline-first writing, meeting notes, and idea capture.
- Prototyping a native-feeling desktop app with Svelte 5 and Wails.
- Studying a local-first architecture that keeps most product logic in the frontend.

## Configuration

Most settings live in the app itself rather than environment variables.

- Theme: choose `light`, `dark`, or `system`.
- Folder accent color: customize the folder icon color from Settings.
- Pane sizes: sidebar and note-list widths are persisted locally.
- Selected note and folder: restored locally on next launch.
- IndexedDB database name: defaults to `kelocnotes-db`. Tests can override this with `window.__NOTES_DB_NAME__`.

Important assumptions:

- This is a local-first app. There is no built-in sync service.
- The frontend owns almost all app logic. Go mainly provides desktop capabilities and native dialogs.
- On Linux and Windows, the menu package is currently a stub, so those platforms should be treated as preview rather than fully supported.

## Development

### Run Locally

From the repo root:

```bash
wails dev
```

From `frontend/`:

```bash
npm run dev
```

### Frontend Checks

```bash
cd frontend
npm run check
npm run test
npm run test:e2e
npm run lint
```

### Go Tests

From the repo root:

```bash
go test ./...
```

### What Is Worth Reading First

- `frontend/src/routes/+layout.svelte`: app boot, layout, keyboard handling, menu bridge wiring
- `frontend/src/lib/stores/notes.svelte.ts`: note lifecycle and persistence
- `frontend/src/lib/stores/folders.svelte.ts`: folder tree and trash behavior
- `frontend/src/lib/infrastructure/idbr.ts`: IndexedDB schema and transactional deletion/archive logic
- `app.go`: Wails bindings for export/import and native app events

## Performance

There are no benchmark numbers published yet, but the implementation is built around a few practical choices:

- note metadata loads before full note bodies
- note content is fetched on demand
- search indexing is incremental and folder-scoped
- persistence is local and debounced for note edits

In practice, this should be fine for a personal notes library with hundreds to low-thousands of notes on a modern desktop. If you need hard benchmark numbers, multi-user concurrency, or anything server-backed, this project is not there yet.

## Limitations

- No sync, collaboration, sharing, or mobile clients.
- The current editor is a plain textarea-based editor, not a full rich-text editor.
- Windows and Linux are preview platforms today; native menu support is not implemented yet.
- The macOS distribution path is a `.dmg`, but notarization is still deferred for now, so first launch may require a manual Gatekeeper override.
- Backup/import behavior exists, but the repo would benefit from clearer guarantees around backup compatibility and restore semantics across versions.
- Search is local and scoped to the selected folder tree; there is no global cloud index or cross-device search.

## Roadmap

The next obvious pieces of work are:

- richer editing experience beyond plain textarea input
- polished Windows and Linux native menus
- documented release builds and installable binaries
- clearer backup/restore guarantees and migration strategy
- CI for build, typecheck, lint, and test automation
- screenshots or demo GIFs so first-time visitors can evaluate the UX immediately

## Contributing

Contributions are most helpful when they preserve the current architecture:

- keep product logic in the frontend unless desktop-native behavior is required
- add or update tests with behavior changes
- avoid introducing new dependencies without a strong reason
- run the local checks before opening a PR

Suggested workflow:

```bash
cd frontend
npm run test
npm run check

cd ..
go test ./...
```

If you are changing user-visible behavior, verify it in `wails dev` as well.

## License

Apache License 2.0. See [LICENSE](LICENSE).

## Support

If you try `keloc-notes`, opening an issue is useful, especially if you include:

- what you expected to do
- what blocked you
- what data portability or local-first feature you care about most

The biggest gap right now is not the basic architecture. It is packaging, onboarding, and release polish.
