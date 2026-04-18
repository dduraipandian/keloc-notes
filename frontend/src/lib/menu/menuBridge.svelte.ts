import { EventsOn } from '$lib/wailsjs/runtime/runtime';
import { UpdateMenuState } from '$lib/wailsjs/go/main/App';
import { menu } from '$lib/wailsjs/go/models';
import { noteService, folderService, trashService } from '$lib/stores/services';
import { uiStore } from '$lib/stores/dialog.svelte';
import { notesStore } from '$lib/stores/notes.svelte';
import { folderStore } from '$lib/stores/folders.svelte';
import { selectionStore } from '$lib/stores/selection.svelte';
import { uiStateStore } from '$lib/stores/uiState.svelte';
import { themeStore } from '$lib/stores/theme.svelte';
import { hasWailsRuntime } from '$lib/wails.svelte';

/**
 * Initialize menu event listeners and wire them to store actions.
 * Returns an unsubscribe function for cleanup.
 */
export function initMenuBridge(callbacks?: {
	onOpenAbout?: () => void;
	onOpenPreferences?: () => void;
}): () => void {
	const unsubscribers: Array<() => void> = [];

	// File menu events
	unsubscribers.push(
		EventsOn('menu:new-note', () => {
			noteService.create(selectionStore.selectedFolderID ?? null);
		})
	);

	unsubscribers.push(
		EventsOn('menu:new-folder', () => {
			folderService.create();
		})
	);

	unsubscribers.push(
		EventsOn('menu:delete-note', () => {
			const note = notesStore.selectedNote;
			if (note && !note.deletedAt) {
				uiStore.confirmNoteDelete(note.title, () => {
					noteService.delete(note.id);
				});
			}
		})
	);

	unsubscribers.push(
		EventsOn('menu:empty-trash', () => {
			uiStore.confirmEmptyTrash(() => {
				trashService.emptyTrash();
			});
		})
	);

	// Edit menu events
	unsubscribers.push(
		EventsOn('menu:focus-search', () => {
			uiStateStore.setActivePane('notes');
			// Focus the search input after pane change
			setTimeout(() => {
				const input = document.querySelector('[data-testid="notes-pane"] input') as HTMLInputElement;
				if (input) input.focus();
			}, 0);
		})
	);

	// View menu events
	unsubscribers.push(
		EventsOn('menu:toggle-sidebar', () => {
			uiStateStore.toggleSidebar();
		})
	);

	unsubscribers.push(
		EventsOn('menu:toggle-note-list', () => {
			uiStateStore.toggleNoteList();
		})
	);

	unsubscribers.push(
		EventsOn('menu:set-theme', (theme: string) => {
			themeStore.setTheme(theme as 'light' | 'dark' | 'system');
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
			const note = notesStore.selectedNote;
			if (note && !note.deletedAt) {
				try {
					const { ExportNoteToFile } = await import('$lib/wailsjs/go/main/App');
					await ExportNoteToFile(note.title, note.content);
				} catch (err) {
					console.error('Failed to export note:', err);
				}
			}
		})
	);

	unsubscribers.push(
		EventsOn('menu:export-all-markdown', async () => {
			try {
				const { ExportNotesZip } = await import('$lib/wailsjs/go/main/App');

				// Collect all active (non-deleted) notes with folder paths
				const notesToExport: Array<{ title: string; content: string; folderPath: string; updatedAt: string }> = [];

				notesStore.notes.forEach((note) => {
					if (!note.deletedAt) {
						// Find folder path
						let folderPath = '';
						if (note.folderId) {
							const folder = folderStore.findItemById(note.folderId);
							if (folder) {
								folderPath = folderStore.getPathForFolder(folder);
							}
						}

						notesToExport.push({
							title: note.title,
							content: note.content,
							folderPath,
							updatedAt: new Date(note.updatedAt ?? 0).toISOString()
						});
					}
				});

				await (ExportNotesZip as any)(notesToExport);
			} catch (err) {
				console.error('Failed to export notes:', err);
			}
		})
	);

	unsubscribers.push(
		EventsOn('menu:export-backup', async () => {
			try {
				const appModule = await import('$lib/wailsjs/go/main/App');
				const { exportBackup } = await import('$lib/backup/backup');

				const json = exportBackup();
				const SaveBackupFile = (appModule as any).SaveBackupFile;
				await SaveBackupFile(json);
			} catch (err) {
				console.error('Failed to export backup:', err);
			}
		})
	);

	unsubscribers.push(
		EventsOn('menu:import-markdown', async () => {
			try {
				const { ImportNotesZip } = await import('$lib/wailsjs/go/main/App');
				const importedNotes = await ImportNotesZip();

				if (!importedNotes || importedNotes.length === 0) {
					return;
				}

				// Create folders and notes
				for (const importedNote of importedNotes) {
					let targetFolderId: string | null = null;

					// Create folders if needed
					if (importedNote.FolderPath) {
						const pathParts = importedNote.FolderPath.split('/');
						let parentId: string | null = null;

						for (const part of pathParts) {
							// Find or create folder
							let folderId: string | null = null;
							for (const [id, folder] of folderStore.folders) {
								if (folder.title === part && folder.parentId === parentId && !folder.deletedAt) {
									folderId = id;
									break;
								}
							}

							if (!folderId) {
								// Create new folder in parent
								selectionStore.selectedFolderID = parentId;
								folderService.create();
								// Wait for newly created folder to appear in store
								await new Promise<void>((resolve) => {
									const checkInterval = setInterval(() => {
										for (const [id, folder] of folderStore.folders) {
											if (folder.parentId === parentId && folder.title === '') {
												folderId = id;
												clearInterval(checkInterval);
												resolve();
												return;
											}
										}
									}, 10);
									// Timeout after 1 second to prevent infinite wait
									setTimeout(() => {
										clearInterval(checkInterval);
										resolve();
									}, 1000);
								});

								// Rename newly created folder
								if (folderId) {
									await folderService.rename(folderId, part);
								}
							}

							parentId = folderId ?? null;
						}

						targetFolderId = parentId;
					}

					// Create note
					selectionStore.selectedFolderID = targetFolderId;
					noteService.create(targetFolderId);
				}
			} catch (err) {
				console.error('Failed to import notes:', err);
			}
		})
	);

	unsubscribers.push(
		EventsOn('menu:import-backup', async () => {
			try {
				const appModule = await import('$lib/wailsjs/go/main/App');
				const { importBackup } = await import('$lib/backup/backup');

				const ReadBackupFile = (appModule as any).ReadBackupFile;
				const json = await ReadBackupFile();
				if (json) {
					await importBackup(json);
					// Reload the page to reinitialize with restored data
					window.location.reload();
				}
			} catch (err) {
				console.error('Failed to import backup:', err);
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
 */
export function initMenuStateEffect(): void {
	$effect.root(() => {
		// Explicitly access selectedNoteID to ensure proper reactivity tracking
		const noteId = notesStore.selectedNoteID;
		const selectedNote = notesStore.selectedNote;
		const hasSelected = noteId !== null;
		const menuState = new menu.MenuState({
			HasSelectedNote: hasSelected,
			SelectedNoteInTrash: selectedNote?.deletedAt != null,
			TrashHasItems: notesStore.trashCount > 0,
			Theme: themeStore.theme
		});

		console.log(
			`[MENU] MenuState: noteId=${noteId}, hasSelected=${hasSelected}, trashCount=${notesStore.trashCount}, theme=${themeStore.theme}`
		);

		// Update the native menu with current state
		if (hasWailsRuntime()) {
			try {
				UpdateMenuState(menuState);
			} catch (err) {
				console.error('Failed to update native menu:', err);
			}
		}
	});
}
