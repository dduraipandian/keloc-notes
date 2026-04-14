# Backend And Wails Shell

## Current role of the backend

The backend is intentionally thin right now.

Most application logic is not in Go. The Go/Wails side currently provides:

- desktop window creation
- app lifecycle hooks
- binding of the Go app object to the frontend
- second-instance activation behavior
- access to Wails runtime functions from the frontend

## Main Go files

### `main.go`

[main.go](/Users/dduraipandian/apps/mdnotes/main.go) configures and launches the Wails app.

Current behavior:

- app title is `mdnotes`
- initial window size is `1024x768`
- window starts maximized
- default context menu is disabled
- built frontend assets are embedded from `frontend/build`
- single-instance lock is enabled
- the Go `App` instance is bound into the frontend

### `app.go`

[app.go](/Users/dduraipandian/apps/mdnotes/app.go) defines the bound `App` struct.

Current responsibilities:

- store Wails runtime context on startup
- handle second-instance launches by unminimizing/showing the window
- emit `launchArgs` event to the frontend

It also still contains a template-style `Greet()` method that is not part of current app behavior.

## Wails configuration

[wails.json](/Users/dduraipandian/apps/mdnotes/wails.json) is the authoritative Wails config.

Current important settings:

- generated Wails JS lives in `frontend/src/lib`
- frontend install command is `npm install`
- frontend build command is `npm run build`
- frontend dev watcher is `npm run dev`
- frontend dev server URL is auto-detected

## Frontend bridge

Generated bridge code lives under:

- [frontend/src/lib/wailsjs](/Users/dduraipandian/apps/mdnotes/frontend/src/lib/wailsjs)

There are two main categories here:

- runtime helpers such as `Quit`
- generated bindings for Go methods on `App`

The frontend currently imports runtime helpers directly, for example from:

- [frontend/src/lib/wailsjs/runtime/runtime.js](/Users/dduraipandian/apps/mdnotes/frontend/src/lib/wailsjs/runtime/runtime.js)

## What is not yet in Go

As of current code, these are not backend responsibilities:

- note CRUD
- folder CRUD
- persistence of notes/folders/settings
- search
- delete/recover flows
- backup/archive logic
- sidebar projection logic

All of those live in the frontend and IndexedDB layer.

## Likely next backend expansion points

This is not a roadmap, just a practical list of places where Go/Wails could grow later if you move logic out of the frontend:

- filesystem-backed note storage
- native menus and shortcuts
- OS integrations
- import/export
- archival and backup management
- richer multi-window or second-instance behavior

Right now those are not implemented and should not be assumed.
