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
import { noteService, folderService, trashService } from '$lib/stores/services';
import { uiStore } from '$lib/stores/dialog.svelte';
import { notesStore } from '$lib/stores/notes.svelte';
import { folderStore } from '$lib/stores/folders.svelte';
import { selectionStore } from '$lib/stores/selection.svelte';
import { uiStateStore } from '$lib/stores/uiState.svelte';
import { themeStore } from '$lib/stores/theme.svelte';
import { hasWailsRuntime } from '$lib/wails.svelte';
import { exportBackup, importBackup } from '$lib/backup/backup';

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
			const noteId = notesStore.selectedNoteID;
			if (noteId) {
				try {
					const harvested = await noteService.getNotesForExport([noteId]);
					if (harvested.length > 0) {
						await ExportNoteToFile(harvested[0].title, harvested[0].content);
					}
				} catch (err) {
					console.error('Failed to export note:', err);
				}
			}
		})
	);

	unsubscribers.push(
		EventsOn('menu:export-all-markdown', async () => {
			try {
				// Collect all active (non-deleted) notes
				const activeNoteIds = Array.from(notesStore.notes.values())
					.filter((n) => !n.deletedAt)
					.map((n) => n.id);

				const notesToExport = await noteService.getNotesForExport(activeNoteIds);
				await (ExportNotesZip as any)(notesToExport);
			} catch (err) {
				console.error('Failed to export notes:', err);
			}
		})
	);

	unsubscribers.push(
		EventsOn('menu:export-backup', async () => {
			try {
				const json = await exportBackup();
				await SaveBackupFile(json);
			} catch (err) {
				console.error('Failed to export backup:', err);
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
			}
		})
	);

	unsubscribers.push(
		EventsOn('menu:import-backup', async () => {
			try {
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
 * Returns a cleanup function to destroy the effect.
 */
export function initMenuStateEffect(): () => void {
	return $effect.root(() => {
		$effect(() => {
			// Explicitly access reactive states to ensure tracking
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
					console.error('Failed to update native menu state:', err);
				}
			}
		});
	});
}
