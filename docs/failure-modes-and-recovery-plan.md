# Failure Modes And Recovery Plan

This plan is separate from the general release tracker because failure handling is core product trust for a notes app.

Goal:

- define how the app behaves when storage, startup, import/export, or shutdown goes wrong
- reduce the chance of silent data loss
- give users a recovery path when something does fail

## Principles

- Never fail silently when user data may be at risk.
- Prefer atomic writes over best-effort multi-step persistence.
- If recovery is incomplete, say exactly what is known and unknown.
- Avoid destructive repair actions unless the user explicitly chooses them.
- Keep backup and restore paths simpler and safer than the main editing path.

## Current State

What is already strong:

- blocked IndexedDB upgrades surface a real user dialog
- backup restore is transactional across folders, notes, settings, and assets
- permanent delete archives data before removal
- app close attempts to flush pending note writes before exit
- backup import is restricted to a brand-new app to avoid destructive merges

What is still weak:

- note metadata and note content are persisted separately
- close-time flush is best-effort and time-bounded
- startup failures mostly end in a quit dialog
- note content load failures are logged but not clearly recoverable in UI
- corrupted local storage does not yet have a documented reset-and-restore path
- import/export failure guarantees are not explicit enough for users

## Risk Areas

### 1. Live Editing And Save Integrity

Primary risk:

- title / summary / timestamp can be persisted separately from note content
- a crash or forced quit can leave partial note state

Required outcome:

- saving one note should be atomic from the user point of view

Plan:

1. Add a repository path that persists note meta and content in one IndexedDB transaction.
2. Route debounced note persistence through that transactional path.
3. Keep pending-write tracking, but treat one note save as one write unit.
4. Add tests for:
   - meta write failure
   - content write failure
   - interrupted close during pending writes
   - flush with multiple dirty notes

Acceptance criteria:

- a note cannot end up with updated metadata but stale body content from the same edit batch
- flush-before-close waits on whole-note writes, not split writes

## 2. Startup Failure Recovery

Primary risk:

- if IndexedDB init or settings load fails, the app currently tells the user it failed and exits

Required outcome:

- startup failures must present recovery choices, not just a dead end

Plan:

1. Replace the single quit-only startup error dialog with a recovery dialog.
2. Offer:
   - retry startup
   - open recovery help
   - copy diagnostic details
   - reset local database
   - import backup after reset
3. Separate user-facing wording from raw exception details.
4. Add tests for:
   - IndexedDB init failure
   - blocked upgrade at startup
   - malformed settings data

Acceptance criteria:

- users can understand what failed
- users have at least one non-destructive next step
- destructive reset requires explicit confirmation

## 3. Corrupted IndexedDB And Blocked Upgrade Recovery

Primary risk:

- storage corruption or an upgrade blocked by another window can leave the app unusable

Required outcome:

- users can distinguish temporary blockage from genuine local data corruption

Plan:

1. Document blocked-upgrade recovery separately from corruption recovery.
2. Add a recovery doc section covering:
   - another app window blocking upgrade
   - browser/runtime storage failure
   - app restart expectations
   - when reset is required
3. Add a guided in-app message that explains:
   - what happened
   - whether data is likely still intact
   - what to try next

Acceptance criteria:

- blocked upgrade is recoverable without guesswork
- reset flow is documented and consistent with the app’s actual behavior

## 4. Backup Restore Guarantees

Primary risk:

- users assume restore will merge, partially restore, or preserve current local state unless told otherwise

Required outcome:

- the restore contract must be explicit and safe

Plan:

1. Document that backup import is allowed only on a new app.
2. Document that restore is replace-all, not merge.
3. Document that restore is transactional and should either fully apply or fail without partial replacement.
4. Document backup schema compatibility expectations and failure behavior.
5. Add tests for:
   - unsupported schema version
   - malformed JSON
   - asset restore failure
   - settings restore failure

Acceptance criteria:

- users know exactly what restore does before they run it
- failed restore does not leave partial imported state

## 5. Import / Export Failure Guidance

Primary risk:

- users may not know whether a failed export lost local data or whether a failed import changed anything

Required outcome:

- import/export operations must state what succeeded, what failed, and what remained unchanged

Plan:

1. Define user-facing guarantees for:
   - markdown export
   - full markdown zip export
   - backup export
   - markdown import
   - backup import
2. Ensure every failure message answers:
   - did local notes change?
   - was any file written?
   - can the user retry safely?
3. Add docs for common file-system failure cases:
   - cancel dialog
   - permission denied
   - invalid archive
   - invalid backup file

Acceptance criteria:

- users never have to infer whether their local notes are safe after a file operation fails

## 6. Crash Recovery And Interrupted Shutdown

Primary risk:

- app close currently relies on a timed flush window
- an OS kill, crash, or timeout can interrupt pending writes

Required outcome:

- interrupted shutdown behavior is measured, documented, and minimized

Plan:

1. Audit all deferred note writes and their timing.
2. Verify whether writes can remain in memory only at close time.
3. Add manual test scenarios for:
   - force quit while typing
   - close during long pending writes
   - crash during backup export
   - crash during import
4. Decide whether certain user actions should force an immediate flush:
   - app close
   - note switch
   - export
   - backup

Acceptance criteria:

- the team knows the maximum unsaved edit window
- close/quit behavior is documented and intentionally chosen

## 7. User-Facing Recovery UX

Primary risk:

- raw technical errors are not enough for non-developer users

Required outcome:

- recovery messaging must be calm, specific, and actionable

Plan:

1. Standardize recovery dialog structure:
   - what happened
   - what data is affected
   - what did not change
   - what the user can do now
2. Add a dedicated recovery/help doc linked from failure dialogs.
3. Keep destructive actions visually distinct from retry/safe actions.

Acceptance criteria:

- every critical failure path has actionable user guidance
- no major storage failure relies only on console logging

## Suggested Execution Order

1. Atomic note save path
2. Startup recovery dialog and reset path
3. Corrupted DB / blocked upgrade documentation
4. Backup restore contract documentation
5. Import/export failure contract
6. Crash-recovery audit and manual test matrix
7. Recovery-focused automated tests

## Release Gate For This Area

Do not call Failure Modes And Recovery complete until:

- note save is atomic or an equivalent guarantee exists
- startup failure gives recovery options
- blocked upgrade and corrupted storage recovery are documented
- backup restore guarantees are documented
- import/export failure guarantees are documented
- crash/quit behavior has been manually verified
