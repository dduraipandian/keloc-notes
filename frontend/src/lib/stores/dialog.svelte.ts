export type DialogType = 'destroy' | 'restore';

export interface ConfirmOptions {
	open: boolean;
	type: DialogType;
	title: string;
	description?: string;
	canCancel?: boolean;
	onConfirm: () => void;
	confirmLabel?: string;
	cancelLabel?: string;
}

class UIStore {
	// Separate state for individual dialog types
	noteDialog = $state<ConfirmOptions>({
		open: false,
		type: 'destroy',
		title: '',
		description: '',
		confirmLabel: '',
		canCancel: true,
		onConfirm: () => {}
	});

	folderDialog = $state<ConfirmOptions>({
		open: false,
		type: 'destroy',
		title: '',
		description: '',
		confirmLabel: '',
		canCancel: true,
		onConfirm: () => {}
	});

	appDialog = $state<ConfirmOptions>({
		open: false,
		type: 'destroy',
		title: '',
		description: '',
		confirmLabel: '',
		canCancel: false,
		onConfirm: () => {}
	});

	confirmNoteDelete(noteTitle: string, onConfirm: () => void) {
		this.noteDialog = {
			open: true,
			type: 'destroy',
			title: 'Delete Note',
			description: `Are you sure you want to delete "${noteTitle}"?`,
			confirmLabel: 'Delete Note',
			onConfirm
		};
	}

	confirmNotePermanentDelete(noteTitle: string, onConfirm: () => void) {
		this.noteDialog = {
			open: true,
			type: 'destroy',
			title: 'Delete Note Permanently',
			description: `Are you sure you want to permanently delete "${noteTitle}"?`,
			confirmLabel: 'Delete Note',
			onConfirm
		};
	}

	confirmNoteRestore(noteTitle: string, isHierarchical: boolean, onConfirm: () => void) {
		this.noteDialog = {
			open: true,
			type: 'restore',
			title: isHierarchical ? 'Restore Folder?' : 'Restore Note',
			description: isHierarchical
				? `The original folder for '${noteTitle}' is deleted. Restoring this note will also restore its parent folder.`
				: `Are you sure you want to restore '${noteTitle}'?`,
			confirmLabel: 'Restore',
			onConfirm
		};
	}

	confirmFolderPermanentDelete(folderTitle: string, onConfirm: () => void) {
		this.folderDialog = {
			open: true,
			type: 'destroy',
			title: 'Delete Folder Permanently',
			description: `Permanently delete '${folderTitle}' and all its notes? This cannot be undone.`,
			confirmLabel: 'Delete Permanently',
			onConfirm
		};
	}

	confirmFolderDelete(folderTitle: string, onConfirm: () => void) {
		this.folderDialog = {
			open: true,
			type: 'destroy',
			title: 'Delete Folder',
			description: `Are you sure you want to delete '${folderTitle}' and all its contents?.`,
			confirmLabel: 'Delete Folder',
			onConfirm
		};
	}
	confirmAppQuit(title: string, initError: string, onConfirm: () => void) {
		this.folderDialog = {
			open: true,
			type: 'destroy',
			title: title,
			description: `mdnotes could not load your data. This is usually caused by a corrupted database or
				insufficient storage permissions.
				<br/> <br/>
				<span class="font-mono text-xs text-destructive">${initError}</span>`,
			confirmLabel: 'Quit Application',
			onConfirm
		};
	}
}

export const uiStore = new UIStore();
