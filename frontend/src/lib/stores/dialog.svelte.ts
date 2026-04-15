export type DialogType = 'destroy' | 'restore';

export interface ConfirmOptions {
	open: boolean;
	type: DialogType;
	title: string;
	description?: string;
	allowHtml?: boolean;
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
			canCancel: true,
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
			canCancel: true,
			type: 'destroy',
			title: 'Delete Note Permanently',
			description: `Are you sure you want to permanently delete "${noteTitle}"?`,
			confirmLabel: 'Delete Note',
			onConfirm
		};
	}

	confirmNoteRestore(noteTitle: string, onConfirm: () => void) {
		this.noteDialog = {
			open: true,
			canCancel: true,
			type: 'restore',
			title: 'Restore Note',
			description: `Are you sure you want to restore '${noteTitle}'?`,
			confirmLabel: 'Restore',
			onConfirm
		};
	}

	confirmFolderPermanentDelete(folderTitle: string, onConfirm: () => void) {
		this.folderDialog = {
			open: true,
			canCancel: true,
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
			canCancel: true,
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
			canCancel: false,
			type: 'destroy',
			title: title,
			description: `mdnotes could not load your data. This is usually caused by a corrupted database or
				insufficient storage permissions.
				<br/> <br/>
				<span class="font-mono text-xs text-destructive">${initError}</span>`,
			allowHtml: true,
			confirmLabel: 'Quit Application',
			onConfirm
		};
	}

	confirmEmptyTrash(onConfirm: () => void) {
		this.folderDialog = {
			open: true,
			type: 'destroy',
			title: 'Empty Trash',
			description: `Are you sure you want to permanently delete all folders and notes in the trash?`,
			confirmLabel: 'Empty Trash',
			canCancel: true,
			onConfirm
		};
	}
}

export const uiStore = new UIStore();
