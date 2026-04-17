export function isEditableTarget(target: EventTarget | null) {
	if (!(target instanceof HTMLElement)) return false;

	if (target instanceof HTMLInputElement) return true;
	if (target instanceof HTMLTextAreaElement) return true;
	if (target.isContentEditable) return true;
	if (target.getAttribute('contenteditable') === 'true') return true;

	return false;
}

type GlobalShortcutActions = {
	createNote: () => void;
	createFolder: () => void;
	focusSearch: () => void;
};

type EscapeShortcutActions = {
	closeDialogs: () => void;
	cancelRename: () => void;
};

type EscapeShortcutState = {
	hasDialogOpen: boolean;
	isRenameActive: boolean;
};

type FolderPaneShortcutState = {
	activePane: 'folders' | 'notes' | 'editor';
	isRenameActive: boolean;
	navigableIds: string[];
	selectedFolderId: string | null;
	selectedFolderTreeItem: {
		parentId: string | null;
		firstChildId: string | null;
		hasChildren: boolean;
		isOpen: boolean;
	} | null;
};

type FolderPaneShortcutActions = {
	selectFolder: (id: string) => void;
	toggleFolder: (id: string) => void;
};

type NotesPaneShortcutState = {
	activePane: 'folders' | 'notes' | 'editor';
	visibleNoteIds: string[];
	selectedNoteId: string | null;
	selectedNoteDeleteContext: {
		id: string;
		title: string;
	} | null;
};

type NotesPaneShortcutActions = {
	selectNote: (id: string) => void;
	activateEditor: () => void;
	requestDeleteNote: (id: string, title: string) => void;
};

export function handleGlobalShortcut(
	event: KeyboardEvent,
	actions: GlobalShortcutActions
) {
	if (isEditableTarget(event.target)) return false;

	const hasPrimaryModifier = event.metaKey || event.ctrlKey;
	const key = event.key.toLowerCase();

	if (key === '/' && !hasPrimaryModifier) {
		event.preventDefault();
		actions.focusSearch();
		return true;
	}

	if (!hasPrimaryModifier) return false;

	if (key === 'n' && event.shiftKey) {
		event.preventDefault();
		actions.createFolder();
		return true;
	}

	if (key === 'n') {
		event.preventDefault();
		actions.createNote();
		return true;
	}

	return false;
}

export function handleEscapeShortcut(
	event: KeyboardEvent,
	actions: EscapeShortcutActions,
	state: EscapeShortcutState
) {
	if (event.key !== 'Escape') return false;

	if (state.hasDialogOpen) {
		event.preventDefault();
		actions.closeDialogs();
		return true;
	}

	if (state.isRenameActive) {
		event.preventDefault();
		actions.cancelRename();
		return true;
	}

	return false;
}

export function handleFoldersPaneShortcut(
	event: KeyboardEvent,
	state: FolderPaneShortcutState,
	actions: FolderPaneShortcutActions
) {
	if (state.activePane !== 'folders') return false;
	if (state.isRenameActive) return false;
	if (
		event.key !== 'ArrowUp' &&
		event.key !== 'ArrowDown' &&
		event.key !== 'ArrowLeft' &&
		event.key !== 'ArrowRight'
	) {
		return false;
	}

	if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
		if (state.selectedFolderId == null || state.selectedFolderTreeItem == null) return false;

		const { hasChildren, isOpen, firstChildId, parentId } = state.selectedFolderTreeItem;

		if (event.key === 'ArrowRight') {
			if (hasChildren && !isOpen) {
				event.preventDefault();
				actions.toggleFolder(state.selectedFolderId);
				return true;
			}

			if (hasChildren && isOpen && firstChildId != null) {
				event.preventDefault();
				actions.selectFolder(firstChildId);
				return true;
			}

			return false;
		}

		if (hasChildren && isOpen) {
			event.preventDefault();
			actions.toggleFolder(state.selectedFolderId);
			return true;
		}

		if (parentId != null) {
			event.preventDefault();
			actions.selectFolder(parentId);
			return true;
		}

		return false;
	}

	if (state.navigableIds.length === 0) return false;

	const currentIndex =
		state.selectedFolderId != null ? state.navigableIds.indexOf(state.selectedFolderId) : -1;

	let nextIndex = currentIndex;
	if (event.key === 'ArrowDown') {
		nextIndex = currentIndex < 0 ? 0 : Math.min(currentIndex + 1, state.navigableIds.length - 1);
	} else if (event.key === 'ArrowUp') {
		nextIndex = currentIndex < 0 ? 0 : Math.max(currentIndex - 1, 0);
	}

	const nextId = state.navigableIds[nextIndex];
	if (!nextId || nextId === state.selectedFolderId) return false;

	event.preventDefault();
	actions.selectFolder(nextId);
	return true;
}

export function handleNotesPaneShortcut(
	event: KeyboardEvent,
	state: NotesPaneShortcutState,
	actions: NotesPaneShortcutActions
) {
	if (state.activePane !== 'notes') return false;
	if (isEditableTarget(event.target)) return false;

	if (event.key === 'Delete' || event.key === 'Backspace') {
		if (state.selectedNoteDeleteContext == null) return false;
		event.preventDefault();
		actions.requestDeleteNote(
			state.selectedNoteDeleteContext.id,
			state.selectedNoteDeleteContext.title
		);
		return true;
	}

	if (event.key === 'Enter') {
		if (state.selectedNoteId == null) return false;
		event.preventDefault();
		actions.activateEditor();
		return true;
	}

	if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return false;
	if (state.visibleNoteIds.length === 0) return false;

	const currentIndex =
		state.selectedNoteId != null ? state.visibleNoteIds.indexOf(state.selectedNoteId) : -1;

	let nextIndex = currentIndex;
	if (event.key === 'ArrowDown') {
		nextIndex = currentIndex < 0 ? 0 : Math.min(currentIndex + 1, state.visibleNoteIds.length - 1);
	} else if (event.key === 'ArrowUp') {
		nextIndex = currentIndex < 0 ? 0 : Math.max(currentIndex - 1, 0);
	}

	const nextId = state.visibleNoteIds[nextIndex];
	if (!nextId || nextId === state.selectedNoteId) return false;

	event.preventDefault();
	actions.selectNote(nextId);
	return true;
}
