import type { FolderID } from '../folders.svelte';
import type { NoteID, NoteItem } from '../notes.svelte';
import type { FolderStoreLike, NotesStoreLike, SelectionStoreLike } from './types';
import { FolderTreeHelper } from '../domain/folderTree';
import { resolveProfile } from '../domain/profiles';
import { assetsRepository } from '$lib/infrastructure/repositories';
import { collectAssetIds } from '$lib/editor/imageHandler';
import { jsonToMarkdown, parseContent } from '$lib/editor/serializer';

export class NoteService {
	private readonly tree: FolderTreeHelper;
	private readonly selection: SelectionStoreLike;

	constructor(
		private readonly folders: FolderStoreLike,
		private readonly notes: NotesStoreLike,
		selection: SelectionStoreLike
	) {
		this.tree = new FolderTreeHelper(folders, notes);
		this.selection = selection;
	}

	create(
		folderId: FolderID | null,
		{
			silent = false,
			suppressLibraryUsageMark = false
		}: { silent?: boolean; suppressLibraryUsageMark?: boolean } = {}
	) {
		const actualFolderId = folderId === 'home' || folderId === null ? null : folderId;
		const folder = actualFolderId
			? this.folders.findItemById(actualFolderId)
			: this.folders.findItemById('home');
		const createNote = (targetFolderId: FolderID | null) =>
			suppressLibraryUsageMark
				? this.notes.createNote(targetFolderId, { suppressLibraryUsageMark })
				: this.notes.createNote(targetFolderId);

		if (!folder || !resolveProfile(folder).capabilities.createNote) {
			const defaultId = this.folders.getDefaultFolderId();
			if (!silent) this.selection.selectFolder(defaultId);
			return createNote(defaultId);
		} else {
			if (!silent) this.selection.selectFolder(folderId);
			return createNote(folderId);
		}
	}

	update(
		noteId: NoteID,
		updates: Partial<Omit<NoteItem, 'id'>>,
		opts?: { updatedTimestamp?: boolean }
	) {
		this.notes.updateNote(noteId, updates, opts);
	}

	select(noteId: NoteID | null) {
		this.notes.selectNote(noteId);
	}

	delete(noteId: NoteID, deletedBatchId?: string) {
		const currentFolder = this.selection.getSelectedFolder();
		const visibleNotes = this.tree.getNotesForFolder(
			this.selection.selectedFolderID ?? null,
			currentFolder?.profile
		);
		const currentIndex = visibleNotes.findIndex((note) => note.id === noteId);
		let nextNoteId: NoteID | null = null;

		if (currentIndex >= 0) {
			if (visibleNotes[currentIndex + 1]) {
				nextNoteId = visibleNotes[currentIndex + 1].id;
			} else if (visibleNotes[currentIndex - 1]) {
				nextNoteId = visibleNotes[currentIndex - 1].id;
			}
		}

		this.notes.deleteNote(noteId, Date.now(), deletedBatchId);
		this.notes.selectNote(nextNoteId);
	}

	setFavorite(noteId: NoteID, isFavorite: boolean) {
		this.notes.setFavorite(noteId, isFavorite);
	}

	getNotesForFolder(folderId: FolderID | null, folderProfile?: string) {
		return this.tree.getNotesForFolder(folderId, folderProfile);
	}

	getNoteCountForFolder(folderId: FolderID | null, folderProfile?: string) {
		return this.notes.getNoteCount(folderId, folderProfile);
	}

	async getExportData(ids: NoteID[]) {
		if (ids.length === 0) return [];

		const results: Array<{
			id: string;
			title: string;
			content: string;
			updatedAt: string;
			folderId: string | null;
		}> = [];

		// Chunk processing for scalability and main-thread stability
		const CHUNK_SIZE = 50;
		for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
			const chunkIds = ids.slice(i, i + CHUNK_SIZE);
			const contents = await this.notes.getBulkNoteContents(chunkIds);

			chunkIds.forEach((id) => {
				const note = this.notes.getNote(id);
				if (note) {
					results.push({
						id,
						title: note.title,
						content: contents[id] ?? note.content,
						updatedAt: note.updatedAt,
						folderId: note.folderId
					});
				}
			});
		}

		return results;
	}

	async getNotesForExport(
		ids: NoteID[],
		options: { relativeToFolderId?: FolderID | null; includeAssets?: boolean } = {}
	) {
		const harvested = await this.getExportData(ids);
		const relativeRootPath = options.relativeToFolderId
			? this.tree.getPlainFolderPath(options.relativeToFolderId)
			: '';

		return Promise.all(
			harvested.map(async (note) => {
				let folderPath = '';
				if (note.folderId) {
					folderPath = this.tree.getPlainFolderPath(note.folderId);
				}

				if (relativeRootPath && folderPath.startsWith(relativeRootPath)) {
					folderPath = folderPath.slice(relativeRootPath.length).replace(/^\/+/, '');
				}

				const content = jsonToMarkdown(note.content);
				const exportNote = {
					title: note.title,
					content,
					folderPath,
					updatedAt: new Date(note.updatedAt ?? 0).toISOString()
				};

				if (!options.includeAssets) {
					return exportNote;
				}

				const doc = parseContent(note.content);
				const assetIds = collectAssetIds(doc);
				if (assetIds.size === 0) {
					return { ...exportNote, assets: [] };
				}

				const assets = await this.buildExportAssets(note.title, content, note.id, assetIds);
				return {
					...exportNote,
					content: assets.content,
					assets: assets.assets
				};
			})
		);
	}

	private async buildExportAssets(
		title: string,
		markdown: string,
		noteId: string,
		assetIds: Set<string>
	) {
		const storedAssets = await assetsRepository.getByNoteId(noteId);
		const assetFolder = `${sanitizeExportSegment(title)}.assets`;
		const matchingAssets = storedAssets.filter((asset) => assetIds.has(asset.id));
		let rewrittenMarkdown = markdown;
		const assets: Array<{ path: string; dataBase64: string }> = [];

		for (const asset of matchingAssets) {
			const assetFilename = `${asset.id}.${mimeTypeToExtension(asset.mimeType)}`;
			const assetPath = `${assetFolder}/${assetFilename}`;
			rewrittenMarkdown = rewrittenMarkdown.replaceAll(`(asset:${asset.id})`, `(${assetPath})`);
			assets.push({
				path: assetPath,
				dataBase64: await blobToBase64(asset.data)
			});
		}

		return {
			content: rewrittenMarkdown,
			assets
		};
	}
}

function sanitizeExportSegment(value: string): string {
	return value.replace(/[/:*?"<>|]/g, '').trim() || 'Untitled Note';
}

function mimeTypeToExtension(mimeType: string): string {
	switch (mimeType) {
		case 'image/png':
			return 'png';
		case 'image/jpeg':
			return 'jpg';
		case 'image/gif':
			return 'gif';
		case 'image/svg+xml':
			return 'svg';
		case 'image/webp':
			return 'webp';
		default:
			return 'bin';
	}
}

async function blobToBase64(blob: Blob): Promise<string> {
	const buffer = await blob.arrayBuffer();
	let binary = '';
	const bytes = new Uint8Array(buffer);

	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary);
}
