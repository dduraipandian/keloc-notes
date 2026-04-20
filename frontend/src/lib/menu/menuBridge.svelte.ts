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
	const { uiState, theme, ui, selection, folders, notes, folderService, noteService, trashService } = stores;
	const unsubscribers: Array<() => void> = [];
	const formatError = (err: unknown) => (err instanceof Error ? err.message : String(err));
	const triggerReload = callbacks?.onReload ?? (() => window.location.reload());

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
				const input = document.querySelector('[data-testid="notes-pane"] input') as HTMLInputElement;
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
					const harvested = await noteService.getNotesForExport([noteId]);
					if (harvested.length > 0) {
						await ExportNoteToFile(harvested[0].title, harvested[0].content);
					}
				} catch (err) {
					console.error('Failed to export note:', err);
					ui.showOperationError('Export Current Note Failed', formatError(err));
				}
			}
		})
	);

	unsubscribers.push(
		EventsOn('menu:export-all-markdown', async () => {
			try {
				// Collect all active (non-deleted) notes
				const activeNoteIds = Array.from(notes.notes.values())
					.filter((n) => !n.deletedAt)
					.map((n) => n.id);

				const notesToExport = await noteService.getNotesForExport(activeNoteIds);
				await (ExportNotesZip as any)(notesToExport);
			} catch (err) {
				console.error('Failed to export notes:', err);
				ui.showOperationError('Export All Notes Failed', formatError(err));
			}
		})
	);

	unsubscribers.push(
		EventsOn('menu:export-backup', async () => {
			try {
				const json = await exportBackup(noteService, folders, notes);
				await SaveBackupFile(json);
			} catch (err) {
				console.error('Failed to export backup:', err);
				ui.showOperationError('Export Backup Failed', formatError(err));
			}
		})
	);

	unsubscribers.push(
		EventsOn('menu:import-markdown', async () => {
			try {
				const importedNotes = await ImportNotesZip();

				if (!importedNotes || importedNotes.length === 0) {
					return;
				}

				// Create folders and notes
				for (const importedNote of importedNotes) {
					// Use the logic-encapsulated ensurePath in FolderService
					const targetFolderId = folderService.ensurePath(importedNote.FolderPath);

					// Create note with silent: true and extract its id for updating
					const newNote = noteService.create(targetFolderId, { silent: true });
					if (newNote) {
						noteService.update(newNote.id, {
							title: importedNote.Title,
							content: importedNote.Content
						});
					}
				}
			} catch (err) {
				console.error('Failed to import notes:', err);
				ui.showOperationError('Import Markdown Archive Failed', formatError(err));
			}
		})
	);

	unsubscribers.push(
		EventsOn('menu:import-backup', async () => {
			if (uiState.backupImportStatus?.active) {
				return;
			}

			try {
				const json = await ReadBackupFile();
				if (json) {
					uiState.showBackupImportStatus(
						'Importing backup...',
						'Rebuilding your library. The app will reopen when finished.'
					);
					await importBackup(json, folders, notes);
					uiState.showBackupImportStatus('Import complete', 'Reloading your library...');
					setTimeout(() => {
						triggerReload();
					}, 150);
				}
			} catch (err) {
				uiState.clearBackupImportStatus();
				console.error('Failed to import backup:', err);
				ui.showOperationError('Import Backup Failed', formatError(err));
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
export function initMenuStateEffect(stores: {
	theme: ThemeStore;
	notes: NotesStore;
}): () => void {
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
