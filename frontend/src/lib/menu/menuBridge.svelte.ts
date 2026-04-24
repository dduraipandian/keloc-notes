import { EventsOn } from '$lib/wailsjs/runtime/runtime';
import {
	UpdateMenuState,
	ExportNoteToFile,
	ExportNotesZip,
	ImportNotesZip,
	SaveBackupFile,
	ReadBackupFile
} from '$lib/wailsjs/go/main/App';
import { menu } from '$lib/wailsjs/go/models';
import type { NoteService, FolderService, TrashService } from '$lib/stores/services';
import type { NotesStore } from '$lib/stores/notes.svelte';
import type { FolderStore } from '$lib/stores/folders.svelte';
import type { SelectionStore } from '$lib/stores/selection.svelte';
import type { UIStore } from '$lib/stores/dialog.svelte';
import type { ThemeStore } from '$lib/stores/theme.svelte';
import type { UIStateStore } from '$lib/stores/uiState.svelte';
import { hasWailsRuntime } from '$lib/wails.svelte';
import { exportBackup, importBackup } from '$lib/backup/backup';
import { importedMarkdownToEditorContent } from '$lib/editor/serializer';
import {
	analyzeMarkdownImportConflicts,
	buildMarkdownImportExecutionPlan,
	type MarkdownImportAction
} from '$lib/import/markdownImport';
import { resolveProfile } from '$lib/stores/domain/profiles';
import {
	buildFileOperationFailureMessage,
	type FileOperationKind
} from '$lib/fileOperationFailures';

/**
 * Initialize menu event listeners and wire them to store actions.
 * Returns an unsubscribe function for cleanup.
 */
export function initMenuBridge(
	stores: {
		uiState: UIStateStore;
		theme: ThemeStore;
		ui: UIStore;
		selection: SelectionStore;
		folders: FolderStore;
		notes: NotesStore;
		folderService: FolderService;
		noteService: NoteService;
		trashService: TrashService;
	},
	callbacks?: {
		onOpenAbout?: () => void;
		onOpenPreferences?: () => void;
		onReload?: () => void;
	}
): () => void {
	const {
		uiState,
		theme,
		ui,
		selection,
		folders,
		notes,
		folderService,
		noteService,
		trashService
	} = stores;
	const unsubscribers: Array<() => void> = [];
	const showFileOperationError = (title: string, kind: FileOperationKind, err: unknown) => {
		ui.showOperationError(title, buildFileOperationFailureMessage(kind, err));
	};
	const triggerReload = callbacks?.onReload ?? (() => window.location.reload());
	const getSelectedRegularFolderId = () => {
		const selectedFolderId = selection.selectedFolderID;
		if (!selectedFolderId || selectedFolderId === 'home') {
			return null;
		}

		const selectedFolder = folders.findItemById(selectedFolderId);
		if (!selectedFolder) {
			return null;
		}

		return resolveProfile(selectedFolder).section === 'folders' ? selectedFolderId : null;
	};
	const collectScopedNoteIds = () => {
		const selectedFolderId = getSelectedRegularFolderId();
		const scopedFolderIds = new Set<string>();

		if (selectedFolderId) {
			const visitFolder = (folderId: string) => {
				scopedFolderIds.add(folderId);
				const folder = folders.findItemById(folderId);
				for (const childId of folder?.items ?? []) {
					visitFolder(childId);
				}
			};
			visitFolder(selectedFolderId);
		}

		return Array.from(notes.notes.values())
			.filter((note) => {
				if (note.deletedAt) {
					return false;
				}
				if (!selectedFolderId) {
					return true;
				}
				return note.folderId != null && scopedFolderIds.has(note.folderId);
			})
			.map((note) => note.id);
	};
	const applyImportRoot = (folderPath: string) => {
		const selectedFolderId = getSelectedRegularFolderId();
		if (!selectedFolderId) {
			return folderPath;
		}

		const selectedFolderPath = folderService.getPlainFolderPath(selectedFolderId);
		if (!selectedFolderPath) {
			return folderPath;
		}

		return [selectedFolderPath, folderPath].filter(Boolean).join('/');
	};
	const executeMarkdownImportActions = async (actions: MarkdownImportAction[]) => {
		for (const action of actions) {
			if (action.type === 'overwrite') {
				const nextContent =
					action.importedAssets && action.importedAssets.length > 0
						? await importedMarkdownToEditorContent(
								action.noteId,
								action.content,
								action.importedAssets
							)
						: action.content;
				noteService.update(action.noteId, {
					title: action.title,
					content: nextContent
				});
				continue;
			}

			const targetFolderId = folderService.ensurePath(action.folderPath);
			const newNote = noteService.create(targetFolderId, { silent: true });
			if (newNote) {
				const createdContent =
					action.importedAssets && action.importedAssets.length > 0
						? await importedMarkdownToEditorContent(
								newNote.id,
								action.content,
								action.importedAssets
							)
						: action.content;
				noteService.update(newNote.id, {
					title: action.title,
					content: createdContent
				});
			}
		}
	};

	// File menu events
	unsubscribers.push(
		EventsOn('menu:new-note', () => {
			noteService.create(selection.selectedFolderID ?? null);
		})
	);

	unsubscribers.push(
		EventsOn('menu:new-folder', () => {
			folderService.create();
		})
	);

	unsubscribers.push(
		EventsOn('menu:delete-note', () => {
			const note = notes.selectedNote;
			if (note && !note.deletedAt) {
				ui.confirmNoteDelete(note.title, () => {
					noteService.delete(note.id);
				});
			}
		})
	);

	unsubscribers.push(
		EventsOn('menu:empty-trash', () => {
			ui.confirmEmptyTrash(() => {
				trashService.emptyTrash();
			});
		})
	);

	// Edit menu events
	unsubscribers.push(
		EventsOn('menu:focus-search', () => {
			uiState.setActivePane('notes');
			// Focus the search input after pane change
			setTimeout(() => {
				const input = document.querySelector(
					'[data-testid="notes-pane"] input'
				) as HTMLInputElement;
				if (input) input.focus();
			}, 0);
		})
	);

	// View menu events
	unsubscribers.push(
		EventsOn('menu:toggle-sidebar', () => {
			uiState.toggleSidebar();
		})
	);

	unsubscribers.push(
		EventsOn('menu:toggle-note-list', () => {
			uiState.toggleNoteList();
		})
	);

	unsubscribers.push(
		EventsOn('menu:set-theme', (themeMode: string) => {
			theme.setTheme(themeMode as 'light' | 'dark' | 'system');
		})
	);

	// Dialog events
	unsubscribers.push(
		EventsOn('menu:open-preferences', () => {
			callbacks?.onOpenPreferences?.();
		})
	);

	unsubscribers.push(
		EventsOn('menu:open-about', () => {
			callbacks?.onOpenAbout?.();
		})
	);

	// Export/Import events
	unsubscribers.push(
		EventsOn('menu:export-note', async () => {
			const noteId = notes.selectedNoteID;
			if (noteId) {
				try {
					await notes.flushAllPendingWrites();
					const harvested = await noteService.getNotesForExport([noteId]);
					if (harvested.length > 0) {
						await ExportNoteToFile(harvested[0].title, harvested[0].content);
					}
				} catch (err) {
					console.error('Failed to export note:', err);
					showFileOperationError('Export Current Note Failed', 'markdown-note-export', err);
				}
			}
		})
	);

	unsubscribers.push(
		EventsOn('menu:export-all-markdown', async () => {
			try {
				await notes.flushAllPendingWrites();
				const selectedFolderId = getSelectedRegularFolderId();
				const activeNoteIds = collectScopedNoteIds();
				const notesToExport = selectedFolderId
					? await noteService.getNotesForExport(activeNoteIds, {
							relativeToFolderId: selectedFolderId,
							includeAssets: true
						})
					: await noteService.getNotesForExport(activeNoteIds);
				await (ExportNotesZip as any)(notesToExport);
			} catch (err) {
				console.error('Failed to export notes:', err);
				showFileOperationError('Export All Notes Failed', 'markdown-zip-export', err);
			}
		})
	);

	unsubscribers.push(
		EventsOn('menu:export-backup', async () => {
			try {
				await notes.flushAllPendingWrites();
				const json = await exportBackup(noteService, folders, notes);
				await SaveBackupFile(json);
			} catch (err) {
				console.error('Failed to export backup:', err);
				showFileOperationError('Export Backup Failed', 'backup-export', err);
			}
		})
	);

	unsubscribers.push(
		EventsOn('menu:import-markdown', async () => {
			if (
				uiState.markdownImportConflictDialog?.open ||
				uiState.markdownImportConflictDialog?.isProcessing
			) {
				return;
			}

			try {
				const importedNotes = (await ImportNotesZip())?.map((note) => ({
					...note,
					FolderPath: applyImportRoot(note.FolderPath ?? '')
				}));

				if (!importedNotes || importedNotes.length === 0) {
					return;
				}
				const analysis = analyzeMarkdownImportConflicts(
					importedNotes,
					Array.from(folders.folders.values()),
					Array.from(notes.notes.values())
				);

				if (analysis.conflicts.length > 0) {
					uiState.openMarkdownImportConflictDialog({
						conflicts: analysis.conflicts,
						onConfirm: async (resolution) => {
							try {
								const plan = buildMarkdownImportExecutionPlan(analysis, resolution);
								await executeMarkdownImportActions(plan.actions);
								await notes.flushAllPendingWrites();
								uiState.closeMarkdownImportConflictDialog();
							} catch (err) {
								uiState.closeMarkdownImportConflictDialog();
								console.error('Failed to import notes:', err);
								showFileOperationError('Import Markdown Archive Failed', 'markdown-import', err);
							}
						},
						onCancel: () => {
							uiState.closeMarkdownImportConflictDialog();
						}
					});
					return;
				}

				const plan = buildMarkdownImportExecutionPlan(analysis, 'keep-both');
				await executeMarkdownImportActions(plan.actions);
				await notes.flushAllPendingWrites();
			} catch (err) {
				console.error('Failed to import notes:', err);
				showFileOperationError('Import Markdown Archive Failed', 'markdown-import', err);
			}
		})
	);

	unsubscribers.push(
		EventsOn('menu:import-backup', async () => {
			if (uiState.backupImportStatus?.active) {
				return;
			}

			try {
				uiState.showBackupImportStatus(
					'Importing backup...',
					'Rebuilding your library. The app will reopen when finished.'
				);
				await notes.flushAllPendingWrites();
				const json = await ReadBackupFile();
				if (json) {
					await importBackup(json, folders, notes);
					uiState.showBackupImportStatus('Import complete', 'Reloading your library...');
					setTimeout(() => {
						triggerReload();
					}, 150);
				} else {
					uiState.clearBackupImportStatus();
				}
			} catch (err) {
				uiState.clearBackupImportStatus();
				console.error('Failed to import backup:', err);
				showFileOperationError('Import Backup Failed', 'backup-import', err);
			}
		})
	);

	unsubscribers.push(
		EventsOn('menu:help', (topic: string) => {
			console.log('Help topic:', topic);
		})
	);

	// Return unsubscribe function that cleans up all listeners
	return () => {
		unsubscribers.forEach((unsub) => unsub());
	};
}

/**
 * Initialize menu state synchronization effect.
 * Monitors store state and updates the native menu dynamically.
 * Returns a cleanup function to destroy the effect.
 */
export function initMenuStateEffect(stores: { theme: ThemeStore; notes: NotesStore }): () => void {
	const { theme, notes } = stores;
	return $effect.root(() => {
		$effect(() => {
			// Explicitly access reactive states to ensure tracking
			const noteId = notes.selectedNoteID;
			const selectedNote = notes.selectedNote;
			const hasSelected = noteId !== null;
			const menuState = new menu.MenuState({
				HasSelectedNote: hasSelected,
				SelectedNoteInTrash: selectedNote?.deletedAt != null,
				TrashHasItems: notes.trashCount > 0,
				Theme: theme.theme
			});

			console.log(
				`[MENU] MenuState: noteId=${noteId}, hasSelected=${hasSelected}, trashCount=${notes.trashCount}, theme=${theme.theme}`
			);

			// Update the native menu with current state
			if (hasWailsRuntime()) {
				try {
					UpdateMenuState(menuState);
				} catch (err) {
					console.error('Failed to update native menu state:', err);
				}
			}
		});
	});
}
