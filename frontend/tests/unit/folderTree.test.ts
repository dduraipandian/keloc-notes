import { describe, expect, it } from 'vitest';
import { FolderTreeHelper } from '../../src/lib/stores/domain/folderTree';
import type { FolderID, FolderItem } from '../../src/lib/stores/folders.svelte';
import type { NoteItem } from '../../src/lib/stores/notes.svelte';

describe('FolderTreeHelper', () => {
	const mockFolders = (foldersMap: Map<FolderID, FolderItem>) => ({
		folders: foldersMap,
		findItemById: (id: FolderID) => foldersMap.get(id) || null,
		items: Array.from(foldersMap.keys()).filter((id) => !foldersMap.get(id)?.parentId),
		trashItems: Array.from(foldersMap.keys()).filter(
			(id) =>
				foldersMap.get(id)?.deletedAt != null &&
				(!foldersMap.get(id)?.parentId || foldersMap.get(foldersMap.get(id)!.parentId!)?.deletedAt == null)
		)
	});

	const mockNotes = (notesList: NoteItem[]) => ({
		listNotes: () => notesList
	});

	describe('findTopDeletedAncestor', () => {
		it('should find the root of a deleted subtree', () => {
			const folders = new Map<FolderID, FolderItem>([
				{ id: 'root', title: 'Root', deletedAt: 100, parentId: null } as any,
				{ id: 'child', title: 'Child', deletedAt: 100, parentId: 'root' } as any,
				{ id: 'grandchild', title: 'Grandchild', deletedAt: 100, parentId: 'child' } as any
			].map(f => [f.id, f]));

			const helper = new FolderTreeHelper(mockFolders(folders) as any);
			expect(helper.findTopDeletedAncestor('grandchild')?.id).toBe('root');
		});

		it('should return null if folder is not deleted', () => {
			const folders = new Map<FolderID, FolderItem>([
				{ id: 'root', title: 'Root', deletedAt: null, parentId: null } as any
			].map(f => [f.id, f]));

			const helper = new FolderTreeHelper(mockFolders(folders) as any);
			expect(helper.findTopDeletedAncestor('root')).toBeNull();
		});
	});

	describe('getFolderPath', () => {
		it('should build a hierarchical path string', () => {
			const folders = new Map<FolderID, FolderItem>([
				{ id: 'f1', title: 'Work', parentId: null } as any,
				{ id: 'f2', title: 'Projects', parentId: 'f1' } as any,
				{ id: 'f3', title: 'MDNotes', parentId: 'f2' } as any
			].map(f => [f.id, f]));

			const helper = new FolderTreeHelper(mockFolders(folders) as any);
			expect(helper.getFolderPath('f3')).toBe('Work:f1/Projects:f2/MDNotes:f3');
		});
	});

	describe('getNotesForFolder', () => {
		const notes: NoteItem[] = [
			{ id: 'n1', title: 'Active Note', folderId: 'f1', deletedAt: null, updatedAt: '2025-01-01T12:00:00Z' } as any,
			{ id: 'n2', title: 'Deleted Note', folderId: 'f1', deletedAt: 500, updatedAt: '2025-01-01T12:00:00Z' } as any,
			{ id: 'n3', title: 'Child Note', folderId: 'f2', deletedAt: 500, updatedAt: '2025-01-01T11:00:00Z' } as any
		];

		it('should return regular notes for active folder', () => {
			const folders = new Map<FolderID, FolderItem>([
				{ id: 'f1', title: 'Work', deletedAt: null } as any
			].map(f => [f.id, f]));

			const helper = new FolderTreeHelper(mockFolders(folders) as any, mockNotes(notes) as any);
			const result = helper.getNotesForFolder('f1');
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('n1');
		});

		it('should return all notes in a deleted subtree sharing the same batch', () => {
			const folders = new Map<FolderID, FolderItem>([
				{ id: 'f1', title: 'Work', deletedAt: 500, items: ['f2'] } as any,
				{ id: 'f2', title: 'Sub', deletedAt: 500, parentId: 'f1' } as any
			].map(f => [f.id, f]));

			const helper = new FolderTreeHelper(mockFolders(folders) as any, mockNotes(notes) as any);
			const result = helper.getNotesForFolder('f1');
			expect(result).toHaveLength(2);
			expect(result.map(n => n.id)).toContain('n2');
			expect(result.map(n => n.id)).toContain('n3');
		});

		it('should support "all" virtual view', () => {
			const helper = new FolderTreeHelper(mockFolders(new Map()) as any, mockNotes(notes) as any);
			const result = helper.getNotesForFolder(null, 'all');
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('n1');
		});
	});

	describe('restoreParentPath', () => {
		it('should recursively restore parents', () => {
			const restoreFolder = vi.fn();
			const folders = new Map<FolderID, FolderItem>([
				{ id: 'p1', title: 'Grandparent', deletedAt: 100, parentId: null } as any,
				{ id: 'p2', title: 'Parent', deletedAt: 100, parentId: 'p1' } as any
			].map(f => [f.id, f]));

			const mockFoldersStore = {
				findItemById: (id: string) => folders.get(id),
				restoreFolder
			};

			const helper = new FolderTreeHelper(mockFoldersStore as any);
			helper.restoreParentPath('p2');

			expect(restoreFolder).toHaveBeenCalledWith('p2', 100);
			expect(restoreFolder).toHaveBeenCalledWith('p1', 100);
		});
	});
});
