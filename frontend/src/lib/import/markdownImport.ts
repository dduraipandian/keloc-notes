import type { FolderItem } from '$lib/stores/folders.svelte';
import type { NoteMeta } from '$lib/stores/notes.svelte';
import { resolveProfile } from '$lib/stores/domain/profiles';

export type MarkdownImportResolution = 'overwrite' | 'keep-both';

export type ImportedMarkdownNote = {
	Title?: string;
	Content?: string;
	FolderPath?: string;
	Assets?: Array<{ Path: string; DataBase64: string }>;
};

export type MarkdownImportConflictItem = {
	importIndex: number;
	title: string;
	folderPath: string;
	existingNoteId: string;
};

type ImportCandidate = {
	importIndex: number;
	title: string;
	content: string;
	folderPath: string;
	conflictNoteId: string | null;
	importedAssets: Array<{ Path: string; DataBase64: string }>;
};

export type MarkdownImportAnalysis = {
	conflicts: MarkdownImportConflictItem[];
	createCandidates: ImportCandidate[];
	allCandidates: ImportCandidate[];
	occupiedKeys: string[];
};

export type MarkdownImportAction =
	| {
			type: 'overwrite';
			noteId: string;
			title: string;
			content: string;
			importedAssets?: Array<{ Path: string; DataBase64: string }>;
	  }
	| {
			type: 'create';
			folderPath: string;
			title: string;
			content: string;
			importedAssets?: Array<{ Path: string; DataBase64: string }>;
	  };

export type MarkdownImportExecutionPlan = {
	actions: MarkdownImportAction[];
};

function normalizeFolderPath(path: string | undefined): string {
	return (path ?? '')
		.split('/')
		.map((part) => part.trim())
		.filter(Boolean)
		.join('/');
}

function normalizeTitle(title: string | undefined): string {
	const trimmed = (title ?? '').trim();
	return trimmed.length > 0 ? trimmed : 'Untitled Note';
}

function buildFolderPathMap(folders: FolderItem[]): Map<string, string> {
	const foldersById = new Map(
		folders
			.filter((folder) => resolveProfile(folder).section === 'folders' && folder.deletedAt == null)
			.map((folder) => [folder.id, folder])
	);
	const pathByFolderId = new Map<string, string>();

	function resolvePath(folderId: string | null | undefined): string {
		if (!folderId) return '';
		if (pathByFolderId.has(folderId)) return pathByFolderId.get(folderId)!;

		const folder = foldersById.get(folderId);
		if (!folder) return '';

		const parentPath = resolvePath(folder.parentId ?? null);
		const path = normalizeFolderPath(parentPath ? `${parentPath}/${folder.title}` : folder.title);
		pathByFolderId.set(folderId, path);
		return path;
	}

	for (const folder of foldersById.values()) {
		resolvePath(folder.id);
	}

	return pathByFolderId;
}

function makeConflictKey(folderPath: string, title: string): string {
	return `${folderPath}::${title}`;
}

function getImportedCopyTitle(
	baseTitle: string,
	reservedKeys: Set<string>,
	folderPath: string
): string {
	let attempt = `${baseTitle} (Imported)`;
	let index = 2;

	while (reservedKeys.has(makeConflictKey(folderPath, attempt))) {
		attempt = `${baseTitle} (Imported ${index})`;
		index += 1;
	}

	return attempt;
}

export function analyzeMarkdownImportConflicts(
	importedNotes: ImportedMarkdownNote[],
	folders: FolderItem[],
	notes: NoteMeta[]
): MarkdownImportAnalysis {
	const folderPaths = buildFolderPathMap(folders);
	const existingConflicts = new Map<string, string>();

	for (const note of notes) {
		if (note.deletedAt != null) continue;
		const folderPath = normalizeFolderPath(folderPaths.get(note.folderId ?? '') ?? '');
		const title = normalizeTitle(note.title);
		existingConflicts.set(makeConflictKey(folderPath, title), note.id);
	}

	const conflicts: MarkdownImportConflictItem[] = [];
	const allCandidates: ImportCandidate[] = [];
	const createCandidates: ImportCandidate[] = [];

	importedNotes.forEach((note, index) => {
		const folderPath = normalizeFolderPath(note.FolderPath);
		const title = normalizeTitle(note.Title);
		const content = note.Content ?? '';
		const conflictNoteId = existingConflicts.get(makeConflictKey(folderPath, title)) ?? null;

		const candidate = {
			importIndex: index,
			title,
			content,
			folderPath,
			conflictNoteId,
			importedAssets: note.Assets ?? []
		};
		allCandidates.push(candidate);

		if (conflictNoteId) {
			conflicts.push({
				importIndex: index,
				title,
				folderPath,
				existingNoteId: conflictNoteId
			});
		} else {
			createCandidates.push(candidate);
		}
	});

	return {
		conflicts,
		createCandidates,
		allCandidates,
		occupiedKeys: Array.from(existingConflicts.keys())
	};
}

export function buildMarkdownImportExecutionPlan(
	analysis: MarkdownImportAnalysis,
	resolution: MarkdownImportResolution
): MarkdownImportExecutionPlan {
	const actions: MarkdownImportAction[] = [];
	const reservedKeys = new Set(analysis.occupiedKeys);

	for (const candidate of analysis.allCandidates) {
		if (candidate.conflictNoteId) {
			if (resolution === 'overwrite') {
				actions.push({
					type: 'overwrite',
					noteId: candidate.conflictNoteId,
					title: candidate.title,
					content: candidate.content,
					...(candidate.importedAssets.length > 0
						? { importedAssets: candidate.importedAssets }
						: {})
				});
				reservedKeys.add(makeConflictKey(candidate.folderPath, candidate.title));
				continue;
			}

			const keepBothTitle = getImportedCopyTitle(
				candidate.title,
				reservedKeys,
				candidate.folderPath
			);
			actions.push({
				type: 'create',
				folderPath: candidate.folderPath,
				title: keepBothTitle,
				content: candidate.content,
				...(candidate.importedAssets.length > 0 ? { importedAssets: candidate.importedAssets } : {})
			});
			reservedKeys.add(makeConflictKey(candidate.folderPath, keepBothTitle));
			continue;
		}

		actions.push({
			type: 'create',
			folderPath: candidate.folderPath,
			title: candidate.title,
			content: candidate.content,
			...(candidate.importedAssets.length > 0 ? { importedAssets: candidate.importedAssets } : {})
		});
		reservedKeys.add(makeConflictKey(candidate.folderPath, candidate.title));
	}

	return { actions };
}
