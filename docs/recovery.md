# Recovery Guide

This guide explains what to try when Keloc Notes cannot start, import, export, or finish saving normally.

## Startup Problems

If startup says another Keloc Notes window is blocking a database upgrade, close every other Keloc Notes window and retry startup. This usually means the local database is busy, not corrupted. Do not reset local data unless retry still fails after the other window is closed.

If startup says the local notes database may be corrupted or unavailable, try retrying startup first. If retry fails, copy diagnostics before using reset options. Reset Local Data removes the local database on this device, so keep or create a JSON backup whenever possible.

## Backup Restore

JSON backup import is only for a new or reset app library. It does not merge into an existing library.

A valid restore replaces the empty local database with folders, notes, note contents, settings, and note assets from the backup. If the backup is malformed, uses an unsupported schema version, or cannot fully restore, the restore fails without leaving a partial imported library.

Permanent deletes also create local safety archives before notes are removed. These archives are stored in IndexedDB and are automatically pruned by age. The retention window is configurable in Settings and defaults to 30 days.

## Import And Export Failures

Failed exports do not change local notes. Depending on where the failure happened, the destination Markdown, ZIP, or backup file may not have been written.

Failed Markdown imports can leave notes changed if the failure happened after import actions started. Review the notes list before retrying.

Failed JSON backup imports leave local notes unchanged when the backup is invalid or restore cannot complete.

Canceling a file dialog leaves local notes unchanged. Permission errors usually mean the selected file or folder could not be read or written; choose another location and retry.

## Crashes And Force Quit

Note edits are normally written after a short debounce. Keloc Notes forces pending note writes to flush when switching notes, exporting, importing, or closing normally.

Force quit, process crashes, and OS kills can still interrupt writes before the flush path starts. After a crash, reopen the app and check the last edited note before continuing.
