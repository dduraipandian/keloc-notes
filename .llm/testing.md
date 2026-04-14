# Testing And Verification

## Current test stack

### Unit tests

- Vitest
- JSDOM environment

Config lives in [frontend/vitest.config.ts](/Users/dduraipandian/apps/mdnotes/frontend/vitest.config.ts).

Current important settings:

- test files are matched from `tests/**/*.{test,spec}.{js,ts}`
- `tests/e2e` is excluded
- globals are enabled

### End-to-end tests

- Playwright

Config lives in [frontend/playwright.config.ts](/Users/dduraipandian/apps/mdnotes/frontend/playwright.config.ts).

Current important settings:

- Playwright builds the frontend and runs `npm run preview`
- preview server is served on `127.0.0.1:4173`
- tests match `**/*.e2e.{ts,js}`

## What the tests currently cover

### Unit tests

The unit suite mainly covers the domain and service rules:

- folder store behavior
- notes store behavior
- selection behavior
- dialog behavior
- folder profile resolution
- folder tree traversal
- sidebar projection behavior
- note list view behavior
- service-layer coordination
- recovery architecture
- permanent deletion and archival behavior

### End-to-end tests

The e2e suite covers user-facing flows such as:

- creating and renaming folders
- creating notes
- selecting folders and auto-selecting notes
- deleting selected notes
- deleting folders and choosing next selection
- recovering notes and folders from trash
- favorite notes and favorite folders
- favorite behavior across delete/restore cycles

## Behavioral expectations encoded by tests

These are especially important because they describe intended app behavior better than comments do:

- selecting a folder should select its first visible note
- deleting a selected note should move selection to the next visible note
- deleting a selected folder should move selection to the next available folder
- `Home`, `Favorites`, and `Recently Deleted` act as virtual contexts, not ordinary folders
- recovery should preserve location when possible and eject to root/home when necessary
- favorites should hide deleted items until they are restored

## Best places to read for intent

If you want to know what the app is supposed to do, start here:

- [frontend/tests/unit/services.test.ts](/Users/dduraipandian/apps/mdnotes/frontend/tests/unit/services.test.ts)
- [frontend/tests/unit/folderSidebarView.test.ts](/Users/dduraipandian/apps/mdnotes/frontend/tests/unit/folderSidebarView.test.ts)
- [frontend/tests/unit/recovery_architecture.test.ts](/Users/dduraipandian/apps/mdnotes/frontend/tests/unit/recovery_architecture.test.ts)
- [frontend/tests/e2e/folders.e2e.ts](/Users/dduraipandian/apps/mdnotes/frontend/tests/e2e/folders.e2e.ts)
- [frontend/tests/e2e/note_recovery.e2e.ts](/Users/dduraipandian/apps/mdnotes/frontend/tests/e2e/note_recovery.e2e.ts)

## Useful commands

Run from `frontend/`:

```bash
npm run test
npx vitest run tests/unit/services.test.ts
npm run test:e2e
```

Run full app dev shell from repo root:

```bash
wails dev
```

## Guidance for future agents

When changing behavior:

- update or read unit tests first for service/store rules
- use e2e tests to validate real user flows
- if UI behavior and tests disagree, inspect both tests and current store/service code before assuming either is correct
