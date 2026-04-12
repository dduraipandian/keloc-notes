/**
 * Stable identifiers for built-in sources.
 *
 * PROTECTED_NOTES_FOLDER_ID — the real, undeletable root folder that acts as
 * the orphan sink for notes whose parent folder is gone on recovery.
 *
 * TRASH_VIEW_ID — the virtual view (not a real folder) that aggregates every
 * deleted note across the tree.
 */
export const PROTECTED_NOTES_FOLDER_ID = 'notes';
export const TRASH_VIEW_ID = 'trash';
