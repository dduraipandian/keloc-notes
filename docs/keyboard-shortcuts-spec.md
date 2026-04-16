# Keyboard Shortcuts Spec

Status: draft for future implementation

This document defines the intended keyboard shortcut model for `mdnotes`.
It exists separately from [CHECKLIST.md](/Users/dduraipandian/apps/mdnotes/CHECKLIST.md) so the shortcut behavior can be reviewed before implementation.

## Decisions Already Made

- Shortcuts are split into two categories:
  - global shortcuts
  - pane-scoped shortcuts
- Delete note is **not** a global shortcut.
- Each pane has its own shortcut behavior when that pane is active.
- Clicking empty space inside a pane activates that pane only.
- Clicking empty space in one pane must not clear or change selections in the other panes.

## Goals

- Make keyboard behavior feel desktop-native rather than web-native.
- Keep folder selection, note selection, and input focus from fighting each other.
- Preserve native text-editing behavior inside the editor and input fields.
- Make shortcut routing predictable and easy to extend later.

## Non-Goals

- Multi-select behavior is out of scope.
- Command palette / help overlay is out of scope for the first pass.
- Rich-editor-specific shortcuts are out of scope until the editor is replaced.

## Core Model

Shortcut handling should treat `selection` and `active pane` as separate concepts.

Persistent selection state:
- `selectedFolderId`
- `selectedNoteId`

Transient interaction state:
- `activePane = 'folders' | 'notes' | 'editor'`

This means:
- a folder can remain selected even when the notes pane is active
- a note can remain selected even when the folders pane is active
- clicking blank space in a pane changes only `activePane`

## Pane Activation Rules

Item click behavior:
- Clicking a folder row activates the folders pane and updates folder selection normally.
- Clicking a note row activates the notes pane and updates note selection normally.
- Clicking in the editor activates the editor pane and preserves the current note selection.

Empty-space click behavior:
- Clicking empty space in the folders pane sets `activePane = 'folders'`.
- Clicking empty space in the notes pane sets `activePane = 'notes'`.
- Clicking empty space in the editor sets `activePane = 'editor'`.
- Empty-space clicks do not clear `selectedFolderId`.
- Empty-space clicks do not clear `selectedNoteId`.
- Empty-space clicks do not change another pane's selection.

## Shortcut Routing Order

Shortcut dispatch should use this priority order:

1. Dialog / modal shortcuts
2. Rename-mode shortcuts
3. Native editable control behavior
4. Global shortcuts
5. Active-pane shortcuts

Notes:
- If the event target is an `input`, `textarea`, or `contenteditable`, native editing behavior wins unless a shortcut is explicitly allowed.
- Rename inputs should intercept their own keys before pane-level shortcuts.
- Pane-scoped shortcuts should only run for `activePane`.

## Global Shortcuts

These shortcuts should work regardless of active pane, unless focus is inside a text-editing control that should keep native behavior.

| Shortcut | Action | Notes |
| --- | --- | --- |
| `Cmd/Ctrl+N` | Create note | Uses current folder context and existing `canCreateNote` rules |
| `Cmd/Ctrl+Shift+N` | Create folder | Creates in current allowed parent context |
| `Escape` | Close transient UI first | Dialogs, menus, rename mode; does not clear cross-pane selection by default |

Explicitly excluded from global shortcuts:
- delete note
- delete folder
- destructive trash actions

## Pane-Scoped Shortcuts

### Folders Pane

Applies only when `activePane === 'folders'` and focus is not inside a rename input.

| Key | Action |
| --- | --- |
| `ArrowUp` | Move folder selection to previous visible folder |
| `ArrowDown` | Move folder selection to next visible folder |
| `ArrowLeft` | Collapse current folder if open, otherwise move to parent if applicable |
| `ArrowRight` | Expand current folder if collapsed, otherwise move to first child if applicable |
| `Enter` | Confirm/select current folder |
| `F2` | Start rename on selected folder |
| `Escape` | No-op unless a transient folders-pane state exists |

Rename mode inside the folders pane:
- `Enter` commits rename
- `Escape` cancels rename
- `Blur` behavior remains as currently implemented

### Notes Pane

Applies only when `activePane === 'notes'` and focus is not inside the search input.

| Key | Action |
| --- | --- |
| `ArrowUp` | Move note selection to previous visible note |
| `ArrowDown` | Move note selection to next visible note |
| `Enter` | Activate editor pane for the selected note |
| `Delete` / `Backspace` | Soft-delete selected note when target is not editable |
| `/` | Optional future behavior: focus note search |
| `Escape` | Clear transient note-list state first; otherwise no-op |

Delete note rule:
- Delete remains pane-scoped only.
- It must never be handled as a global shortcut.
- It must never fire while focus is inside an editable control.

### Editor Pane

Applies only when `activePane === 'editor'`.

Editor shortcuts should stay intentionally minimal in the first pass.

| Key | Action |
| --- | --- |
| `Escape` | Optional future behavior: blur editor or return active pane to notes |

Rules:
- Native text editing wins.
- Do not override common text-editing shortcuts.
- Do not add destructive app shortcuts here in the first pass.

## Search And Editable Inputs

The following controls are considered protected editable contexts:
- folder rename input
- note search input
- note title textarea
- note body textarea
- future rich-text editor surface

When one of these controls has focus:
- native typing/editing behavior must win
- pane navigation shortcuts must not fire
- delete-note shortcut must not fire

## Visual Feedback

Do not show a visible pane-focus treatment in the base UI.

Rules:
- `activePane` is an internal interaction state, not a visible selection state.
- The interface should not add outlines, rings, inset borders, or pane highlights just to show keyboard target.
- Folder and note item selection should remain the only obvious visible selection states.

If keyboard discoverability becomes a problem later, solve it with documentation or a lightweight hint pattern, not a persistent pane highlight.

## Implementation Phases

Recommended order:

1. Add `activePane` state.
2. Wire pane activation on item clicks and empty-space clicks.
3. Keep `activePane` internal only. Do not add pane highlight styling.
4. Implement global shortcuts:
   - `Cmd/Ctrl+N`
   - `Cmd/Ctrl+Shift+N`
   - `Escape`
5. Implement folders-pane navigation.
6. Implement notes-pane navigation.
7. Implement pane-scoped note delete.

## Acceptance Criteria

- Empty-space click changes only `activePane`.
- Folder selection remains stable when the notes or editor pane becomes active.
- Note selection remains stable when the folders pane becomes active.
- `Cmd/Ctrl+N` works from any pane where text-editing behavior should not override it.
- Delete note does not work globally.
- Delete note works only from the notes pane and only when focus is not inside an editable field.
- Rename mode continues to own `Enter` and `Escape`.
- Editor typing behavior remains native and unaffected.

## Open Questions For Implementation

- Should `/` in the notes pane focus search in v1, or be omitted?
- Should `Escape` in the editor blur to the notes pane, or do nothing in v1?
- Should `Enter` in the folders pane only select, or also move active pane to notes?
- Should folder rename use only `F2`, or also support `Cmd/Ctrl+R`?
