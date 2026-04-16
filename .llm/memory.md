# Session Memory

## Checklist Execution Pattern

- The user is working through [CHECKLIST.md](/Users/dduraipandian/apps/mdnotes/CHECKLIST.md) item by item and expects status to stay aligned with the actual codebase, not just with prior notes.
- When the user asks for checklist status or pending work, audit the code before answering. Earlier checklist entries drifted from implementation and had to be corrected.
- The user prefers tackling checklist work in priority order and often asks for the next concrete item rather than a broad roadmap.

## Testing Expectations

- For bug fixes and data integrity work, the expected flow is:
  1. write or update a test
  2. confirm the test fails for the current bug
  3. implement the fix
  4. run the test again to confirm the fix
- After meaningful storage or state changes, run broader regression coverage when practical. The user explicitly asked for full test runs to catch regressions.
- When a change is primarily UX or markup, `npm run check` is still expected as a sanity gate.

## Deletion Model And R4 Decision

- Do not overload `deletedAt` for batch identity. `deletedAt` must remain a timestamp and should not store UUIDs or mixed-purpose values.
- Batch deletion identity must live in a separate field such as `deletedBatchId`.
- `deletedBatchId` must not be derived from a source id like note id or folder id.
- No fallback or backfill behavior is required for old data in this area. The app is still in development, so clean forward-only implementation is acceptable.
- Code in notes/folders delete and restore paths needs to treat `deletedAt` and `deletedBatchId` as related state. A code comment warning about this coupling was explicitly requested because it is a tech-debt hotspot.

## Persistence And Error Handling

- Persistence failures should notify the user consistently across all stores, not just notes.
- `folderStore`, `selectionStore`, and `notesStore` should all surface persistence failures through the same quit/error dialog path in [frontend/src/routes/+layout.svelte](/Users/dduraipandian/apps/mdnotes/frontend/src/routes/+layout.svelte).
- Before app close, pending note writes should be flushed, and the close flow should wait for the flush completion event.

## IndexedDB Upgrade Work

- There is explicit interest in keeping IndexedDB upgrade behavior disciplined.
- Upgrade skeletons and blocked handlers matter even before complex migrations exist, because the user is trying to harden local persistence early.
- Development-stage simplifications are acceptable, but upgrade-related structure should still be explicit rather than implied.

## Search And View UX

- Note-list search was intentionally debounced to avoid wasteful UI churn while typing.
- The user expects view behavior to feel desktop-native, not webby. Small UX rough edges are considered real defects, not polish-only issues.
- Sidebar, note list, and editor interactions should avoid accidental selection flashes during drag or resize operations.

## Pane Resize UX

- Pane resizing must be performance-first. Directly applying every pointer move caused visible lag.
- Resize updates should be coalesced with `requestAnimationFrame`.
- Widths should be clamped for usability, but responsiveness matters more than decorative behavior.
- If live interaction feels wrong, trust the runtime UX over the initial implementation assumptions.
- Specific failures already seen in this session:
  - note-pane resize moved in the opposite direction
  - sidebar resize caused note-pane flashing/selection artifacts
  - plain left-click text-selection behavior in panes made the UI feel less desktop-native

## Startup Shell And Hydration

- Keep the startup shell in [frontend/src/app.html](/Users/dduraipandian/apps/mdnotes/frontend/src/app.html), not as a second loading state inside the mounted app.
- The shell should stay static until the app is actually ready. Avoid per-pane hydration states after mount because they make startup feel jittery.
- The intended flow is:
  1. native Wails window opens
  2. `app.html` startup shell is immediately visible
  3. app initializes behind it
  4. shell fades only when initialization is complete
- [frontend/src/routes/+layout.svelte](/Users/dduraipandian/apps/mdnotes/frontend/src/routes/+layout.svelte) drives shell dismissal through `document.documentElement.dataset.appReady`.
- The user cares about the blank-window interval before the shell appears in Wails dev mode. Startup UX is judged from first visible paint, not just from post-hydration behavior.

## Loading Placeholder Design Rules

- The startup shell should suggest layout and structure, not mimic live content too literally.
- Overly realistic fake sidebar rows or fake note content made the UX feel worse and had to be reverted.
- Good compromise:
  - sidebar placeholder reads like a folder tree
  - note-list placeholder reads like a stacked notes list
  - editor pane stays generic
- When improving loading UX, favor calm and readable over high-fidelity mock UI.
- Structural placeholders are safer than “fake real UI” placeholders.
- If a refinement makes the interface feel heavier or more artificial, revert quickly and return to the simpler shell.

## Status And Review Discipline

- When the user asks for “review” or comments on a diff, they want real impact analysis, especially around state coupling and behavioral regressions.
- Design objections should be treated seriously. In the R4 work, the user rejected the initial UUID-in-`deletedAt` direction and expected a redesign rather than a defense of the implementation.
- If the user asks for a plan before implementation, provide the plan first and wait for confirmation before editing.

## Theme Management And Aesthetics
 
 - **Zero-FOUC Pattern**: To avoid theme flashing on startup, theme detection must happen in `app.html` before hydration.
   - A pre-hydration script in `<head>` reads `IndexedDB` directly.
   - It sets the `.dark` class and CSS variables on `document.documentElement` before the first paint.
   - The `themeStore` in Svelte then synchronizes with this state once mounted.
 - **Apple Notes Replication Spec**:
   - Sidebar: Light utility gray (`#F2F2F2` / `oklch(0.965 0 0)`).
   - Content Panes (List/Editor): Pure focused white (`#FFFFFF`).
   - Selections: Solid, rounded gray pills (`#DCDCDC`) rather than translucent accents.
   - Icon Language: Specific semantic colors (Green Home, Yellow Favorites, Red Trash).
 - If a design shift feels “too white” or “flat,” favor adding structural contrast through distinct pane backgrounds rather than adding borders or shadows.
 - Avoid applying the `.dark` class to specific panes for "high contrast" light modes; instead, redefine the sidebar variables within the `:root` scope.
 
 ## Commit Workflow Preference

- The user allows the assistant to use its own commit convention. `fix(ux): ...` style messages were accepted.
- Still inspect the worktree before committing. This repo often has unrelated local changes, so commits should be scoped carefully.
- If only one file or concern should be committed, avoid sweeping unrelated edits into the same commit.
