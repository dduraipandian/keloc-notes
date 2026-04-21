# keloc-notes

Local-first desktop notes for people who want Apple Notes simplicity, markdown portability, and no cloud dependency.

## Why This Exists

Most note apps force a tradeoff:

- fast capture, but your data is trapped in a proprietary format
- markdown files, but the UX feels like a text editor instead of a notes app
- sync-first products, but you lose the speed and privacy of local storage

`keloc-notes` takes a different approach. It is a desktop notes app with an Apple Notes-style three-pane layout, local IndexedDB persistence, and practical import/export paths so your notes stay yours.

This project is for:

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

## How It Works

Think of `keloc-notes` as a thin native shell around a local-first frontend application:

1. The Svelte app boots and loads folders, notes, and saved UI settings from IndexedDB.
2. Note metadata and note content are stored separately, so the app can load the note list first and fetch full content on demand.
3. Service classes coordinate user actions such as creating folders, deleting notes, restoring from trash, and exporting data.
4. MiniSearch builds a local full-text index for titles and content, scoped to the currently selected folder tree.
5. The Go/Wails layer handles native window behavior, file dialogs, single-instance behavior, and the native macOS menu.

High-level repo layout:

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

You can get the app running locally in a few minutes.

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

## Use Cases

- Personal knowledge base you want to keep fully local.
- Developer notes that still need clean markdown export.
- Offline-first writing, meeting notes, and idea capture.
- Prototyping a native-feeling desktop app with Svelte 5 and Wails.
- Studying a local-first architecture that keeps most product logic in the frontend.

## Configuration

Most configuration is inside the app, not through environment variables.

- Theme: choose `light`, `dark`, or `system`.
- Folder accent color: customize the folder icon color from Settings.
- Pane sizes: sidebar and note-list widths are persisted locally.
- Selected note and folder: restored locally on next launch.
- IndexedDB database name: defaults to `kelocnotes-db`. Tests can override this with `window.__NOTES_DB_NAME__`.

Important assumptions:

- This is a local-first app. There is no built-in sync service.
- The frontend owns almost all app logic. Go mainly provides desktop capabilities and native dialogs.
- On Linux and Windows, the menu package is currently a stub, so the macOS native menu experience should be treated as the primary path today.

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

The repo does not publish benchmark numbers, but the implementation suggests a practical target:

- note metadata loads before full note bodies
- note content is fetched on demand
- search indexing is incremental and folder-scoped
- persistence is local and debounced for note edits

In practice, this should suit a personal notes library with hundreds to low-thousands of notes on a modern desktop. If you need published performance guarantees, multi-user concurrency, or remote search infrastructure, this project is not there yet.

## Limitations

- No sync, collaboration, sharing, or mobile clients.
- The current editor is a plain textarea-based editor, not a full rich-text editor.
- Linux and Windows native menu support is not implemented yet.
- There are no packaged releases or installers documented in the repo today.
- Backup/import behavior exists, but the repo would benefit from clearer guarantees around backup compatibility and restore semantics across versions.
- Search is local and scoped to the selected folder tree; there is no global cloud index or cross-device search.

## Roadmap

Based on the current codebase, the next high-value improvements are:

- richer editing experience beyond plain textarea input
- polished Windows and Linux native menus
- documented release builds and installable binaries
- clearer backup/restore guarantees and migration strategy
- CI for build, typecheck, lint, and test automation
- screenshots or demo GIFs so first-time visitors can evaluate the UX immediately

## Contributing

Contributions are easiest when they preserve the repo's current architecture:

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

If you try `keloc-notes`, open an issue with:

- what you expected to do
- what blocked you
- what data portability or local-first feature you care about most

That feedback is especially useful right now because the biggest opportunity in this repo is turning a solid architecture into an easier first-run experience.
