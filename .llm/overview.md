# mdnotes Overview

## What the project is

`mdnotes` is a local-first desktop notes application packaged with Wails.

The current user experience is an Apple Notes style three-pane layout:

- left sidebar for folder and virtual-view navigation
- middle pane for note lists and search
- right pane for the selected note editor

The application logic is frontend-heavy. Go/Wails currently acts mostly as the desktop shell and runtime bridge. The app persists user data locally in IndexedDB, not in a remote backend.

## Current stack

### Desktop shell

- Go
- Wails v2

### Frontend

- Svelte 5 in runes mode
- SvelteKit
- TypeScript
- Tailwind CSS v4
- `shadcn-svelte` / `bits-ui`
- Lucide icons

### Storage and testing

- IndexedDB via `idb`
- Vitest for unit tests
- Playwright for end-to-end tests

## Repo shape

### Root

- [main.go](/Users/dduraipandian/apps/mdnotes/main.go) boots Wails and binds the app instance
- [app.go](/Users/dduraipandian/apps/mdnotes/app.go) contains the small Go-side app object and second-instance behavior
- [wails.json](/Users/dduraipandian/apps/mdnotes/wails.json) defines how Wails builds and runs the frontend
- [frontend/](/Users/dduraipandian/apps/mdnotes/frontend) contains the real application logic

### Frontend

- [src/routes/+layout.svelte](/Users/dduraipandian/apps/mdnotes/frontend/src/routes/+layout.svelte) initializes stores and assembles the three-pane shell
- [src/routes/+page.svelte](/Users/dduraipandian/apps/mdnotes/frontend/src/routes/+page.svelte) renders the selected note editor
- [src/lib/stores](/Users/dduraipandian/apps/mdnotes/frontend/src/lib/stores) contains state, persistence, domain helpers, and service layer
- [src/lib/views](/Users/dduraipandian/apps/mdnotes/frontend/src/lib/views) contains UI-facing projection logic for sidebar and note list
- [src/lib/components](/Users/dduraipandian/apps/mdnotes/frontend/src/lib/components) contains app components and reused UI primitives
- [tests/unit](/Users/dduraipandian/apps/mdnotes/frontend/tests/unit) encodes domain and service behavior
- [tests/e2e](/Users/dduraipandian/apps/mdnotes/frontend/tests/e2e) covers real user flows

## Product behavior, as implemented now

The project currently behaves like a personal local notes app with these core concepts:

- folders can be created, renamed, favorited, soft-deleted, restored, and permanently deleted
- notes belong to folders or to root/home
- notes can be favorited, soft-deleted, restored, and permanently deleted
- the sidebar contains both user folders and virtual views
- virtual views include `Home`, `Favorites`, and `Recently Deleted`
- deletion is soft-delete first, using `deletedAt`
- permanent deletion also archives deleted items into a `backups` store

## Current sources of truth

If repo docs disagree with code, trust the code and tests.

Use these as the primary references:

- [frontend/src/lib/stores](/Users/dduraipandian/apps/mdnotes/frontend/src/lib/stores)
- [frontend/src/lib/views](/Users/dduraipandian/apps/mdnotes/frontend/src/lib/views)
- [frontend/tests/unit](/Users/dduraipandian/apps/mdnotes/frontend/tests/unit)
- [frontend/tests/e2e](/Users/dduraipandian/apps/mdnotes/frontend/tests/e2e)

Some existing markdown files in the repo are notes, checklists, or implementation plans rather than guaranteed current truth.

## Recommended reading order

For an agent or engineer trying to understand the app safely:

1. [frontend/src/routes/+layout.svelte](/Users/dduraipandian/apps/mdnotes/frontend/src/routes/+layout.svelte)
2. [frontend/src/lib/stores/folders.svelte.ts](/Users/dduraipandian/apps/mdnotes/frontend/src/lib/stores/folders.svelte.ts)
3. [frontend/src/lib/stores/notes.svelte.ts](/Users/dduraipandian/apps/mdnotes/frontend/src/lib/stores/notes.svelte.ts)
4. [frontend/src/lib/stores/services.ts](/Users/dduraipandian/apps/mdnotes/frontend/src/lib/stores/services.ts)
5. [frontend/src/lib/views/folderSidebarView.svelte.ts](/Users/dduraipandian/apps/mdnotes/frontend/src/lib/views/folderSidebarView.svelte.ts)
6. [frontend/src/lib/views/noteListView.svelte.ts](/Users/dduraipandian/apps/mdnotes/frontend/src/lib/views/noteListView.svelte.ts)
7. representative unit and e2e tests
