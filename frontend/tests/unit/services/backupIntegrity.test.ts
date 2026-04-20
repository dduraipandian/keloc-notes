import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { NoteService } from '../../../src/lib/stores/services/noteService';
import { NotesStore } from '../../../src/lib/stores/notes.svelte';
import { FolderStore } from '../../../src/lib/stores/folders.svelte';
import { SelectionStore } from '../../../src/lib/stores/selection.svelte';
import { notesRepository } from '../../../src/lib/infrastructure/repositories';
import { 
	initDB, 
	putNoteMeta, 
	putNoteContent, 
	putNoteAsset,
	getNoteAsset,
	permanentDeleteNoteTransactionally,
	permanentDeleteFolderTransactionally
} from '../../../src/lib/infrastructure/idbr';

vi.mock('../../../src/lib/infrastructure/repositories', () => ({
	notesRepository: {
		getBulkContents: vi.fn(),
		saveMeta: vi.fn(),
		saveContent: vi.fn(),
		list: vi.fn(),
		getContent: vi.fn()
	}
}));

describe('Backup & Export Integrity', () => {
    let mockFolderStore: FolderStore;
    let selectionStore: SelectionStore;
    let mockNotesStore: NotesStore;

	beforeEach(() => {
		vi.resetAllMocks();
        mockFolderStore = new FolderStore();
        selectionStore = new SelectionStore(mockFolderStore);
        mockNotesStore = new NotesStore();
	});

	describe('Note Service Export Harvesting', () => {
		it('should merge content from repository when content is missing in memory', async () => {
			const noteId = 'target-id';
			mockNotesStore.notes.set(noteId, {
				id: noteId,
				title: 'Test Note',
				content: '', // Empty in memory
				updatedAt: new Date().toISOString(),
				isContentLoaded: false,
				folderId: null,
				summary: 'Summary'
			} as any);

			vi.mocked(notesRepository.getBulkContents).mockResolvedValue({
				[noteId]: 'Actual Content from IDB'
			});

			const noteService = new NoteService(mockFolderStore, mockNotesStore, {} as any);
			const exportData = await noteService.getExportData([noteId]);

			expect(exportData[0].content).toBe('Actual Content from IDB');
		});
	});

	describe('Database Transactional Integrity (idbr.ts)', () => {
		it('should CORRECTLY backup content even if called with the path signature (3 args)', async () => {
			const note = { id: 'n1', title: 'Note 1' };
			const content = 'Actual Markdown Content';
			await putNoteMeta(note as any);
			await putNoteContent('n1', content);

			const epoch = Date.now();
			
			await permanentDeleteNoteTransactionally(note as any, 'Fake/Path', epoch);

			const db = await initDB();
			const backup = await db.get('backups', 'note_n1');
			
			expect(backup).toBeDefined();
			expect(backup.data.content).toBe(content);
		});

		it('should NOT rollback when passed correctly structured note objects ({note, path})', async () => {
			const note = { id: 'batch-n1', title: 'Batch Note' };
			const content = 'Batch Content';
			await putNoteMeta(note as any);
			await putNoteContent(note.id, content);

			const epoch = Date.now();
			const notesToDelete = [{ note: note as any, path: 'Home/Batch Note' }];

			await permanentDeleteFolderTransactionally(notesToDelete, [], epoch);

			const db = await initDB();
			const meta = await db.get('notes_meta', note.id);
			expect(meta).toBeUndefined();

			const backup = await db.get('backups', `note_${note.id}`);
			expect(backup).toBeDefined();
			expect(backup.data.content).toBe(content);
		});

		it('should archive multiple assets per note during folder permanent delete', async () => {
			const note1 = { id: 'batch-a', title: 'Batch A' };
			const note2 = { id: 'batch-b', title: 'Batch B' };
			await putNoteMeta(note1 as any);
			await putNoteMeta(note2 as any);
			await putNoteContent(note1.id, 'Content A');
			await putNoteContent(note2.id, 'Content B');

			await putNoteAsset({
				id: 'asset-a1',
				noteId: note1.id,
				mimeType: 'image/webp',
				data: new Blob(['a1'], { type: 'image/webp' })
			});
			await putNoteAsset({
				id: 'asset-a2',
				noteId: note1.id,
				mimeType: 'image/png',
				data: new Blob(['a2'], { type: 'image/png' })
			});
			await putNoteAsset({
				id: 'asset-b1',
				noteId: note2.id,
				mimeType: 'image/webp',
				data: new Blob(['b1'], { type: 'image/webp' })
			});

			const epoch = Date.now();
			await permanentDeleteFolderTransactionally(
				[
					{ note: note1 as any, path: 'Home/Batch A' },
					{ note: note2 as any, path: 'Home/Batch B' }
				],
				[],
				epoch
			);

			const db = await initDB();
			const backupA = await db.get('backups', `note_${note1.id}`);
			const backupB = await db.get('backups', `note_${note2.id}`);

			expect(backupA.data.assets).toHaveLength(2);
			expect(backupB.data.assets).toHaveLength(1);
			expect(await getNoteAsset('asset-a1')).toBeUndefined();
			expect(await getNoteAsset('asset-a2')).toBeUndefined();
			expect(await getNoteAsset('asset-b1')).toBeUndefined();
		});
	});
});
