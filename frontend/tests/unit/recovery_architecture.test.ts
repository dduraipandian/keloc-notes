import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { 
	initDB, 
	putNoteMeta, 
	putNoteContent, 
	getNoteMeta, 
	getNoteContent, 
	permanentDeleteNoteTransactionally,
	permanentDeleteFolderTransactionally
} from '../../src/lib/stores/idbr';

describe('Recovery Architecture Integrity (idbr.ts)', () => {
	beforeEach(async () => {
		// fake-indexeddb handles cleanup between tests automatically
	});

	describe('Permanent Delete Note (Single)', () => {
		it('should CORRECTLY backup content even if called with the path signature (3 args)', async () => {
			const note = { id: 'n1', title: 'Note 1' };
			const content = 'Actual Markdown Content';
			await putNoteMeta(note);
			await putNoteContent('n1', content);

			const epoch = Date.now();
			
			// New robust signature (3 args)
			await permanentDeleteNoteTransactionally(note, 'Fake/Path', epoch);

			const db = await initDB();
			const backup = await db.get('backups', 'note_n1');
			
			expect(backup).toBeDefined();
			// BUG: In the buggy version, backup.data.content will be 'Fake/Path' instead of 'Actual Markdown Content'
			expect(backup.data.content).toBe(content);
		});
	});

	describe('Permanent Delete Folder (Batch)', () => {
		it('should NOT rollback when passed correctly structured note objects ({note, path})', async () => {
			const note = { id: 'batch-n1', title: 'Batch Note' };
			const content = 'Batch Content';
			await putNoteMeta(note);
			await putNoteContent(note.id, content);

			const epoch = Date.now();
			const notesToDelete = [{ note, path: 'Home/Batch Note' }];

			// This should succeed. 
			// BUG: In the buggy version, it destructures {meta} instead of {note}, 
			// access meta.id (undefined.id) and throws, rolling back everything.
			try {
				await permanentDeleteFolderTransactionally(notesToDelete, [], epoch);
			} catch (e) {
				// We want to see if it threw
			}

			const db = await initDB();
			
			// Verify note was deleted (proving no rollback)
			const meta = await getNoteMeta(note.id);
			expect(meta).toBeUndefined();

			// Verify backup exists
			const backup = await db.get('backups', `note_${note.id}`);
			expect(backup).toBeDefined();
			expect(backup.data.content).toBe(content);
		});
	});
});
