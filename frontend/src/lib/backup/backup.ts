import { folderStore } from '$lib/stores/folders.svelte';
import { notesStore } from '$lib/stores/notes.svelte';
import { settingsRepository } from '$lib/infrastructure/repositories';

interface BackupPayload {
	schemaVersion: number;
	exportedAt: string;
	appVersion: string;
	folders: unknown[];
	notes: unknown[];
	settings: Record<string, unknown>;
}

export async function exportBackup(): Promise<string> {
	const folders = Array.from(folderStore.folders.values());
	const noteIds = Array.from(notesStore.notes.keys());

	const { noteService } = await import('$lib/stores/services');
	const fullNotesArr = await noteService.getExportData(noteIds);

	const settings = {
		// Include all stored settings
		applicationTheme: localStorage.getItem('applicationTheme'),
		folderAccentColor: localStorage.getItem('folderAccentColor'),
		sidebarWidth: localStorage.getItem('sidebarWidth'),
		noteListWidth: localStorage.getItem('noteListWidth')
	};

	const backup: BackupPayload = {
		schemaVersion: 1,
		exportedAt: new Date().toISOString(),
		appVersion: import.meta.env.VITE_APP_VERSION || '1.0.0',
		folders,
		notes: fullNotesArr,
		settings
	};

	return JSON.stringify(backup, null, 2);
}

export async function importBackup(json: string): Promise<void> {
	try {
		const backup: BackupPayload = JSON.parse(json);

		if (backup.schemaVersion !== 1) {
			throw new Error(`Unsupported backup schema version: ${backup.schemaVersion}`);
		}

		// Clear existing data
		folderStore.folders.clear();
		notesStore.notes.clear();

		// Restore folders
		for (const folder of backup.folders as any[]) {
			folderStore.folders.set(folder.id, folder);
		}

		// Restore notes
		for (const note of backup.notes as any[]) {
			notesStore.notes.set(note.id, note);
		}

		// Restore settings
		if (backup.settings) {
			await settingsRepository.save('applicationTheme', backup.settings.applicationTheme);
			await settingsRepository.save('folderAccentColor', backup.settings.folderAccentColor);
			await settingsRepository.save('sidebarWidth', backup.settings.sidebarWidth);
			await settingsRepository.save('noteListWidth', backup.settings.noteListWidth);
		}
	} catch (err) {
		throw new Error(`Failed to import backup: ${String(err)}`);
	}
}
