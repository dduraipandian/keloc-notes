# Backend & Wails Shell Architecture

## Role of the Go Backend

In `keloc-notes`, the Go backend serves as the native desktop shell. Most business logic is deferred to the Svelte frontend and IndexedDB, while Go handles OS-level integrations, window management, and native system features.

## Core Backend Components

### 1. Application Entry (`main.go`)

Configures the Wails application instance with:

- **Single Instance Lock**: Ensures only one instance of the app runs at a time.
- **Window Management**: Sets initial size, start state (maximized), and disabled default browser context menus.
- **Menu Configuration**: Connects the custom native menu (see below).
- **Binding**: Exposes the `App` struct methods to the frontend.

### 2. The `App` Struct (`app.go`)

Acts as the central bridge between Go and JS.

- **Lifecycle Hooks**: Manages `startup` (capturing context) and `beforeClose` (triggering frontend flushes).
- **Secondary Activation**: If a second instance is launched, the existing window is unminimized and focused, and any launch arguments are emitted as events.
- **Native Events**: Uses `runtime.EventsEmit` to communicate high-level OS changes to the frontend.

## Native macOS Integration

One of the most critical backend responsibilities is providing a **HIG-compliant Native Menu Bar**.

### Native Roles (Darwin)

To ensure standard macOS behaviors (Undo, Redo, Copy, Paste, Select All) work within the `WKWebView` textareas, `keloc-notes` uses native Wails roles:

- **Edit Menu**: Uses `menu.EditMenu()` (Role 2). This allows the OS to route keyboard shortcuts directly to the focused input field without Go-side interception.
- **Window Menu**: Uses `menu.WindowMenu()` (Role 3).

### Menu Event Bridging

For non-standard actions (e.g., "New Note" or "Export"), the Go menu items trigger specific Wails events. A frontend **Menu Bridge** ($effect.root) listens for these events and routes them to the appropriate Svelte services.

### Native Menu Completeness

The macOS menu bar is no longer only structural; previously placeholder actions are now wired:

- **File > Close Window** delegates to `OnCloseWindow()`.
- **View > Enter Full Screen** delegates to `OnToggleFullscreen()`.
- **Help > keloc-notes Help** and **Help > Report a Bug** delegate to `OnHelp(...)`.

This matters for release readiness because menu presence without real behavior reads as unfinished desktop software.

## Safe Shutdown & Data Integrity

To prevent data loss during rapid exits (e.g., Cmd+Q while typing), the backend implements a "Graceful Flush" protocol:

1.  **BeforeClose Hook**: When a quit is initiated, Go intercepts the close and emits an `app:before-close` event.
2.  **Frontend Acknowledge**: The frontend captures this event, flushes all pending debounced writes to IndexedDB, and then emits `app:flush-complete`.
3.  **Final Quit**: Go waits (with a timeout) for the flush to settle before allowing the window to close.

## Next Expansion Points

As the app matures, the Go side is expected to take on:

- **Filesystem Access**: Allowing users to save notes as local `.md` files directly.
- **System Tray / Menu Bar Item**: For quick note-taking.
- **Deep Linking**: Handling `keloc-notes://` protocols.
- **Advanced Networking**: If a sync engine or web-view bridge for external tools is needed.

## Guidance for AI Agents

- **Avoid Logic Heavy Go**: Keep the backend "thin" unless direct OS access is required.
- **Prefer Bindings over Events**: For request/response flows, use bound methods on `App`. Use Events only for one-way OS -> Frontend notifications.
- **Check menu_darwin.go**: When adding new keyboard shortcuts, verify they don't conflict with native roles.
- **Release Readiness**: For macOS-specific polish items, verify both the Go menu definition and the `App` handlers. A menu item being present is not evidence that the platform feature is actually complete.
