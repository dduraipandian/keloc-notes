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
};

type EscapeShortcutActions = {
	closeDialogs: () => void;
	cancelRename: () => void;
};

type EscapeShortcutState = {
	hasDialogOpen: boolean;
	isRenameActive: boolean;
};

export function handleGlobalShortcut(
	event: KeyboardEvent,
	actions: GlobalShortcutActions
) {
	if (isEditableTarget(event.target)) return false;

	const hasPrimaryModifier = event.metaKey || event.ctrlKey;
	if (!hasPrimaryModifier) return false;

	const key = event.key.toLowerCase();

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
