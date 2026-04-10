export type DialogType = 'delete_note' | 'restore_note' | 'delete_folder';

interface ConfirmOptions {
	title: string;
	description?: string;
	onConfirm: () => void;
	confirmLabel?: string;
	cancelLabel?: string;
}

class UIStore {
	// Separate state for individual dialog types
	noteDialog = $state<{
		open: boolean;
		type: 'delete' | 'restore';
		title: string;
		description: string;
		confirmLabel: string;
		onConfirm: () => void;
	}>({
		open: false,
		type: 'delete',
		title: '',
		description: '',
		confirmLabel: '',
		onConfirm: () => {}
	});

	folderDialog = $state<{
		open: boolean;
		type: 'delete';
		title: string;
		description: string;
		confirmLabel: string;
		onConfirm: () => void;
	}>({
		open: false,
		type: 'delete',
		title: '',
		description: '',
		confirmLabel: '',
		onConfirm: () => {}
	});

	confirmNoteDelete(noteTitle: string, onConfirm: () => void) {
		this.noteDialog = {
			open: true,
			type: 'delete',
			title: 'Delete Note',
			description: `Are you sure you want to delete "${noteTitle}"? This note will be moved to Recently Deleted.`,
			confirmLabel: 'Delete Note',
			onConfirm
		};
	}

	confirmNoteRestore(noteTitle: string, isHierarchical: boolean, onConfirm: () => void) {
		this.noteDialog = {
			open: true,
			type: 'restore',
			title: isHierarchical ? 'Restore Folder Tree?' : 'Restore Note',
			description: isHierarchical
				? `The original folder for "${noteTitle}" is deleted. Restoring this note will also restore its parent folder structure.`
				: `Are you sure you want to restore "${noteTitle}"?`,
			confirmLabel: 'Restore',
			onConfirm
		};
	}

	confirmFolderDelete(folderTitle: string, onConfirm: () => void) {
		this.folderDialog = {
			open: true,
			type: 'delete',
			title: 'Delete Folder',
			description: `Are you sure you want to delete "${folderTitle}" and all its contents? This will move everything to Recently Deleted.`,
			confirmLabel: 'Delete Folder',
			onConfirm
		};
	}
}

export const uiStore = new UIStore();
