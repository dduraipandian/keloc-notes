import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TrashService, FolderService } from '../../src/lib/stores/services';
import { folderStore, type FolderItem, type FolderID } from '../../src/lib/stores/folders.svelte';
import { notesStore, type NoteItem, type NoteID } from '../../src/lib/stores/notes.svelte';
import { selectionStore } from '../../src/lib/stores/selection.svelte';
import { trashRepository } from '../../src/lib/stores/repositories';
import { SvelteMap } from 'svelte/reactivity';

// Mock Repositories
vi.mock('../../src/lib/stores/repositories', () => ({
	foldersRepository: { list: vi.fn(), save: vi.fn() },
	notesRepository: { list: vi.fn(), save: vi.fn() },
	settingsRepository: { getAll: vi.fn(), save: vi.fn() },
	trashRepository: { permanentlyDeleteFolderTree: vi.fn(), permanentlyDeleteNote: vi.fn() }
}));

describe('Recovery Architecture: Comprehensive Suite', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		
		// Reset Stores
		(folderStore as any).items = [];
		(folderStore as any).folders = new SvelteMap<string, FolderItem>();
		(folderStore as any).isInitialized = true;
		
		(notesStore as any).notes = new SvelteMap<string, NoteItem>();
		(notesStore as any).isInitialized = true;
		
		selectionStore.__resetForTest();
	});

	const setupHierarchy = () => {
		// Active Root
		const f1: FolderItem = { id: 'f1', title: 'F1', parentId: null, deletedAt: null, items: ['f2'] };
		// Deleted Branch
		const f2: FolderItem = { id: 'f2', title: 'F2', parentId: 'f1', deletedAt: 100, items: ['f3'] };
		const f3: FolderItem = { id: 'f3', title: 'F3', parentId: 'f2', deletedAt: 100, items: [] };
		// Note in deleted branch
		const n1: NoteItem = { id: 'n1', title: 'N1', folderId: 'f3', deletedAt: 100, updatedAt: '2025-01-01T00:00:00Z', content: '' };
		// Note directly in trash (no parent)
		const nR: NoteItem = { id: 'nR', title: 'NR', folderId: null, deletedAt: 100, updatedAt: '2025-01-01T00:00:00Z', content: '' };

		folderStore.folders.set('f1', f1);
		folderStore.folders.set('f2', f2);
		folderStore.folders.set('f3', f3);
		folderStore.items = ['f1'];

		notesStore.notes.set('n1', n1);
		notesStore.notes.set('nR', nR);

		return { f1, f2, f3, n1, nR };
	};

	describe('TrashService: Flat Recovery Model (Scenario A & B follows B)', () => {
		const trash = new TrashService(folderStore, notesStore, trashRepository, selectionStore);

		it('Scenario 1.1: Recover note to ACTIVE parent', () => {
			const { f1 } = setupHierarchy();
			const nActive: NoteItem = { id: 'nA', title: 'NA', folderId: 'f1', deletedAt: 100, updatedAt: '2025-01-01T00:00:00Z', content: '' };
			notesStore.notes.set('nA', nActive);

			trash.recoverNote('nA');

			const restored = notesStore.notes.get('nA');
			expect(restored?.deletedAt).toBeNull();
			expect(restored?.folderId).toBe('f1'); // Preserved
			expect(selectionStore.selectedFolderID).toBe('f1');
		});

		it('Scenario 1.2: Recover note from DELETED parent -> Eject to Home (Root)', () => {
			const { n1, f2, f3 } = setupHierarchy();
			
			trash.recoverNote('n1');

			const restored = notesStore.notes.get('n1');
			expect(restored?.deletedAt).toBeNull();
			expect(restored?.folderId).toBeNull(); // Ejected to Home
			expect(selectionStore.selectedFolderID).toBeNull();
			
			// Parent should remain deleted
			expect(folderStore.folders.get('f3')?.deletedAt).toBe(100);
			expect(folderStore.folders.get('f2')?.deletedAt).toBe(100);
		});

		it('Scenario 1.3: Recover note from MISSING parent -> Eject to Home (Root)', () => {
			const nOrphan: NoteItem = { id: 'nO', title: 'NO', folderId: 'non-existent', deletedAt: 100, updatedAt: '2025-01-01T00:00:00Z', content: '' };
			notesStore.notes.set('nO', nOrphan);

			trash.recoverNote('nO');

			const restored = notesStore.notes.get('nO');
			expect(restored?.deletedAt).toBeNull();
			expect(restored?.folderId).toBeNull(); // Ejected to Home
		});

		it('Scenario 2.1: Recover folder to ACTIVE parent', () => {
			const fParent: FolderItem = { id: 'p', title: 'P', items: ['c'], deletedAt: null };
			const fChild: FolderItem = { id: 'c', title: 'C', parentId: 'p', deletedAt: 100 };
			folderStore.folders.set('p', fParent);
			folderStore.folders.set('c', fChild);
			folderStore.items = ['p'];

			trash.recoverFolder('c', 100);

			const restored = folderStore.folders.get('c');
			expect(restored?.deletedAt).toBeNull();
			expect(restored?.parentId).toBe('p'); // Preserved
			expect(folderStore.items).not.toContain('c'); // Still child
		});

		it('Scenario 2.2: Recover folder from DELETED parent -> Eject to Home (Root)', () => {
			const { f2, f3 } = setupHierarchy();
			
			trash.recoverFolder('f3', 100);

			const restored = folderStore.folders.get('f3');
			expect(restored?.deletedAt).toBeNull();
			expect(restored?.parentId).toBeNull(); // Ejected to Home
			expect(folderStore.items).toContain('f3'); // Visible as root
		});

		it('Scenario 2.3: Recover folder from MISSING parent -> Eject to Home (Root)', () => {
			const fOrphan: FolderItem = { id: 'fO', title: 'FO', parentId: 'ghost', deletedAt: 100 };
			folderStore.folders.set('fO', fOrphan);

			trash.recoverFolder('fO', 100);

			const restored = folderStore.folders.get('fO');
			expect(restored?.deletedAt).toBeNull();
			expect(restored?.parentId).toBeNull(); // Ejected to Home
			expect(folderStore.items).toContain('fO'); // Visible as root
		});
	});

	describe('FolderStore: Rooting & Visibility Verification', () => {
		it('should ensure visibility when rooting via rootFolderIfParentMissing', () => {
			const f: FolderItem = { id: 'f', title: 'F', parentId: 'missing', deletedAt: 100 };
			folderStore.folders.set('f', f);
			
			folderStore.rootFolderIfParentMissing('f');
			
			expect(folderStore.folders.get('f')?.parentId).toBeNull();
			expect(folderStore.items).toContain('f');
		});

		it('should ensure visibility when rooting a child of a deleted parent', () => {
			const p: FolderItem = { id: 'p', title: 'P', deletedAt: 100, items: ['c'] };
			const c: FolderItem = { id: 'c', title: 'C', parentId: 'p', deletedAt: 100 };
			folderStore.folders.set('p', p);
			folderStore.folders.set('c', c);

			folderStore.rootFolderIfParentMissing('c');
			
			expect(folderStore.folders.get('c')?.parentId).toBeNull();
			expect(folderStore.items).toContain('c');
		});
	});

	describe('Service Layer Integrity: TypeError Prevention', () => {
		const service = new FolderService(folderStore, notesStore, selectionStore);

		it('should have getHomeFolderChildIds method', () => {
			expect(typeof service.getHomeFolderChildIds).toBe('function');
		});

		it('should have getTrashRootIds method', () => {
			expect(typeof service.getTrashRootIds).toBe('function');
		});

		it('should have getFavoriteFolderIds method', () => {
			expect(typeof service.getFavoriteFolderIds).toBe('function');
		});

		it('should NOT have findTopDeletedAncestor method (Dead Code Cleanup)', () => {
			// This verifies that we successfully removed the orphaned proxy method
			expect((service as any).findTopDeletedAncestor).toBeUndefined();
		});
	});
});
