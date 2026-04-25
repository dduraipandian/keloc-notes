# Security And Storage

This document describes what `keloc-notes` stores locally, what "local-first" means in practice, and what guarantees the project does and does not make today.

## Local-First In Practice

For this app, "local-first" means:

- notes, folders, settings, and note assets are stored on the local machine
- there is no built-in sync service
- there is no account system
- the app does not upload note data to a remote server as part of normal use
- import and export happen through user-chosen local files

The Go/Wails layer currently opens external URLs only for:

- Help
- Report a Bug

Those links open in the system browser. They are not used to sync or transmit note content.

## What Is Stored Locally

The main persistence layer is IndexedDB in the embedded webview runtime.

Current object stores:

- `folders`
- `notes_meta`
- `notes_contents`
- `settings`
- `backups`
- `note_assets`

At a high level:

- `folders` stores folder structure and folder metadata
- `notes_meta` stores note metadata such as title, summary, timestamps, and folder placement
- `notes_contents` stores note bodies separately from metadata
- `settings` stores UI and preference state
- `backups` is reserved for backup-related state
- `note_assets` stores embedded note image binaries and metadata

The default IndexedDB database name is:

```text
kelocnotes-db
```

Tests may override the database name with `window.__NOTES_DB_NAME__`.

## Storage Location By Platform

`keloc-notes` currently treats macOS as the supported platform. Windows and Linux are still preview platforms.

### macOS

On macOS, app data is stored inside the embedded WKWebView/WebKit browser profile for the app under the current user's Library.

Important caveat:

- the app guarantees the storage technology and schema at the application level: IndexedDB plus the object stores listed above
- the app does **not** currently guarantee a stable on-disk file path for that data
- the exact directory structure is managed by the runtime and browser engine, not by a custom filesystem layer in this repo

### Windows Preview

On Windows, the same logical data is expected to live in the WebView2 browser profile under the current user's app data directories.

This is still preview-only and should not be treated as a stable public storage contract yet.

### Linux Preview

On Linux, the same logical data is expected to live in the embedded webview/browser profile under the current user's XDG-managed data/config locations.

This is still preview-only and should not be treated as a stable public storage contract yet.

## Encryption At Rest

`keloc-notes` does **not** currently implement application-level encryption at rest.

That means:

- note data is stored locally in IndexedDB
- the app does not encrypt notes before writing them to the local browser storage layer
- protection at rest currently depends on OS-level protections such as full-disk encryption, user account security, and device access controls

If you need note data to be encrypted by the app itself before it is written to disk, that is not implemented today.

## File Access And Permissions

The app currently uses native file dialogs for:

- exporting the current note as Markdown
- exporting notes as a Markdown ZIP archive
- exporting a JSON backup
- importing a Markdown ZIP archive
- importing a JSON backup

The app does not need broad filesystem access just to operate normally. File access for import/export is initiated by the user through those dialogs.

## Backup Compatibility

Current JSON backup behavior:

- exports include `schemaVersion`
- exports include `appVersion`
- the app currently accepts only `schemaVersion: 1`
- backup import is intentionally restricted to a brand-new app/library

What this means in practice:

- backups created by the current app are intended to be restorable by compatible builds that still support schema version `1`
- there is **not yet** a published long-term compatibility promise across future major changes
- if backup durability matters to you, keep periodic backups and test restore on a non-primary library before relying on it as your only recovery path

Markdown ZIP import/export is available for portability, but it is a different format and should not be treated as identical to a full JSON backup.

Permanent-delete safety archives:

- when a note is permanently deleted, Keloc Notes archives the note metadata, content, and note assets into the local `backups` IndexedDB store before removal
- these archives are local recovery safety records, not user-exported backup files
- old archive records are pruned by age during permanent-delete operations
- the retention window is configurable in Settings
- the default retention window is 30 days

## Save And Shutdown Guarantees

Current guarantees:

- once a note save begins, note metadata and note content are written together in one IndexedDB transaction
- the app does not intentionally split a single note save into separate metadata/content writes anymore
- normal app close attempts to flush pending debounced note writes before exit
- while that close-time flush is running, the app shows a blocking "Saving Changes" status

Current limits:

- the close-time flush is still best-effort and bounded by the desktop shell close timeout
- force quit, crash, power loss, or OS-level kill can still interrupt work that has not started persisting yet
- the app does not currently claim zero-loss guarantees for abnormal termination

Practical meaning:

- if a note save has already started, the note should not be left with new metadata and old content from the same save
- if you close the app normally, it will try to flush pending writes before exit
- if you hard-kill the app while recent edits are still only in memory or still waiting for debounce, those latest edits may be lost

If you care about durability:

- close the app normally instead of force quitting it
- keep periodic JSON backups
- test backup restore on a non-primary library before treating backups as your only recovery path

## Current Trust Gaps

The project still has some trust work left:

- app-level encryption at rest is not implemented
- code signing is not yet finalized
- notarization is deferred for now
- Windows/Linux storage and release behavior are not yet positioned as stable public contracts
