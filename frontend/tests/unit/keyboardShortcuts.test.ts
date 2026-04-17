import { describe, expect, it, vi } from 'vitest';
import {
	handleFoldersPaneShortcut,
	handleGlobalShortcut,
	handleEscapeShortcut,
	handleNotesPaneShortcut,
	isEditableTarget
} from '../../src/lib/keyboard/shortcuts';

describe('keyboard shortcuts helper', () => {
	it('treats input elements as editable targets', () => {
		const input = document.createElement('input');
		expect(isEditableTarget(input)).toBe(true);
	});

	it('treats textarea elements as editable targets', () => {
		const textarea = document.createElement('textarea');
		expect(isEditableTarget(textarea)).toBe(true);
	});

	it('treats contenteditable elements as editable targets', () => {
		const div = document.createElement('div');
		div.setAttribute('contenteditable', 'true');
		expect(isEditableTarget(div)).toBe(true);
	});

	it('does not treat non-editable elements as editable targets', () => {
		const div = document.createElement('div');
		expect(isEditableTarget(div)).toBe(false);
	});

	it('does not handle Cmd/Ctrl+N (menu owns it)', () => {
		const focusSearch = vi.fn();
		const event = new KeyboardEvent('keydown', { key: 'n', metaKey: true, cancelable: true });

		const handled = handleGlobalShortcut(event, { focusSearch });

		expect(handled).toBe(false);
		expect(focusSearch).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(false);
	});

	it('does not handle Cmd/Ctrl+Shift+N (menu owns it)', () => {
		const focusSearch = vi.fn();
		const event = new KeyboardEvent('keydown', {
			key: 'n',
			ctrlKey: true,
			shiftKey: true,
			cancelable: true
		});

		const handled = handleGlobalShortcut(event, { focusSearch });

		expect(handled).toBe(false);
		expect(focusSearch).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(false);
	});

	it('handles / as focus search', () => {
		const focusSearch = vi.fn();
		const event = new KeyboardEvent('keydown', { key: '/', cancelable: true });

		const handled = handleGlobalShortcut(event, { focusSearch });

		expect(handled).toBe(true);
		expect(focusSearch).toHaveBeenCalledTimes(1);
		expect(event.defaultPrevented).toBe(true);
	});

	it('does not handle shortcuts while typing in editable targets', () => {
		const focusSearch = vi.fn();
		const input = document.createElement('input');
		const event = new KeyboardEvent('keydown', { key: '/', ctrlKey: false });
		Object.defineProperty(event, 'target', { value: input });

		const handled = handleGlobalShortcut(event, { focusSearch });

		expect(handled).toBe(false);
		expect(focusSearch).not.toHaveBeenCalled();
	});

	it('ignores unrelated shortcuts', () => {
		const focusSearch = vi.fn();
		const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true });

		const handled = handleGlobalShortcut(event, { focusSearch });

		expect(handled).toBe(false);
		expect(focusSearch).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(false);
	});

	it('handles Escape by closing dialogs first', () => {
		const closeDialogs = vi.fn();
		const cancelRename = vi.fn();
		const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });

		const handled = handleEscapeShortcut(
			event,
			{ closeDialogs, cancelRename },
			{ hasDialogOpen: true, isRenameActive: true }
		);

		expect(handled).toBe(true);
		expect(closeDialogs).toHaveBeenCalledTimes(1);
		expect(cancelRename).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(true);
	});

	it('handles Escape by canceling rename when no dialogs are open', () => {
		const closeDialogs = vi.fn();
		const cancelRename = vi.fn();
		const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });

		const handled = handleEscapeShortcut(
			event,
			{ closeDialogs, cancelRename },
			{ hasDialogOpen: false, isRenameActive: true }
		);

		expect(handled).toBe(true);
		expect(cancelRename).toHaveBeenCalledTimes(1);
		expect(closeDialogs).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(true);
	});

	it('does not handle Escape when there is no transient ui state', () => {
		const closeDialogs = vi.fn();
		const cancelRename = vi.fn();
		const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });

		const handled = handleEscapeShortcut(
			event,
			{ closeDialogs, cancelRename },
			{ hasDialogOpen: false, isRenameActive: false }
		);

		expect(handled).toBe(false);
		expect(closeDialogs).not.toHaveBeenCalled();
		expect(cancelRename).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(false);
	});

	it('handles ArrowDown in the folders pane by selecting the next visible folder', () => {
		const selectFolder = vi.fn();
		const toggleFolder = vi.fn();
		const event = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true });

		const handled = handleFoldersPaneShortcut(
			event,
			{
				activePane: 'folders',
				isRenameActive: false,
				navigableIds: ['home', 'favorites', 'deleted-notes', 'work'],
				selectedFolderId: 'favorites',
				selectedFolderTreeItem: null
			},
			{ selectFolder, toggleFolder }
		);

		expect(handled).toBe(true);
		expect(selectFolder).toHaveBeenCalledWith('deleted-notes');
		expect(event.defaultPrevented).toBe(true);
	});

	it('handles ArrowUp in the folders pane by selecting the previous visible folder', () => {
		const selectFolder = vi.fn();
		const toggleFolder = vi.fn();
		const event = new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true });

		const handled = handleFoldersPaneShortcut(
			event,
			{
				activePane: 'folders',
				isRenameActive: false,
				navigableIds: ['home', 'favorites', 'deleted-notes', 'work'],
				selectedFolderId: 'deleted-notes',
				selectedFolderTreeItem: null
			},
			{ selectFolder, toggleFolder }
		);

		expect(handled).toBe(true);
		expect(selectFolder).toHaveBeenCalledWith('favorites');
		expect(event.defaultPrevented).toBe(true);
	});

	it('does not handle folder navigation outside the folders pane', () => {
		const selectFolder = vi.fn();
		const toggleFolder = vi.fn();
		const event = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true });

		const handled = handleFoldersPaneShortcut(
			event,
			{
				activePane: 'notes',
				isRenameActive: false,
				navigableIds: ['home', 'favorites'],
				selectedFolderId: 'home',
				selectedFolderTreeItem: null
			},
			{ selectFolder, toggleFolder }
		);

		expect(handled).toBe(false);
		expect(selectFolder).not.toHaveBeenCalled();
	});

	it('does not handle folder navigation while rename is active', () => {
		const selectFolder = vi.fn();
		const toggleFolder = vi.fn();
		const event = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true });

		const handled = handleFoldersPaneShortcut(
			event,
			{
				activePane: 'folders',
				isRenameActive: true,
				navigableIds: ['home', 'favorites'],
				selectedFolderId: 'home',
				selectedFolderTreeItem: null
			},
			{ selectFolder, toggleFolder }
		);

		expect(handled).toBe(false);
		expect(selectFolder).not.toHaveBeenCalled();
	});

	it('handles ArrowRight by expanding the selected folder when it has collapsed children', () => {
		const selectFolder = vi.fn();
		const toggleFolder = vi.fn();
		const event = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });

		const handled = handleFoldersPaneShortcut(
			event,
			{
				activePane: 'folders',
				isRenameActive: false,
				navigableIds: ['home', 'work'],
				selectedFolderId: 'work',
				selectedFolderTreeItem: {
					parentId: 'home',
					firstChildId: 'project-a',
					hasChildren: true,
					isOpen: false
				}
			},
			{ selectFolder, toggleFolder }
		);

		expect(handled).toBe(true);
		expect(toggleFolder).toHaveBeenCalledWith('work');
		expect(selectFolder).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(true);
	});

	it('handles ArrowRight by selecting the first child when the folder is already expanded', () => {
		const selectFolder = vi.fn();
		const toggleFolder = vi.fn();
		const event = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });

		const handled = handleFoldersPaneShortcut(
			event,
			{
				activePane: 'folders',
				isRenameActive: false,
				navigableIds: ['home', 'work', 'project-a'],
				selectedFolderId: 'work',
				selectedFolderTreeItem: {
					parentId: 'home',
					firstChildId: 'project-a',
					hasChildren: true,
					isOpen: true
				}
			},
			{ selectFolder, toggleFolder }
		);

		expect(handled).toBe(true);
		expect(selectFolder).toHaveBeenCalledWith('project-a');
		expect(toggleFolder).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(true);
	});

	it('handles ArrowLeft by collapsing the selected folder when it is open', () => {
		const selectFolder = vi.fn();
		const toggleFolder = vi.fn();
		const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true });

		const handled = handleFoldersPaneShortcut(
			event,
			{
				activePane: 'folders',
				isRenameActive: false,
				navigableIds: ['home', 'work', 'project-a'],
				selectedFolderId: 'work',
				selectedFolderTreeItem: {
					parentId: 'home',
					firstChildId: 'project-a',
					hasChildren: true,
					isOpen: true
				}
			},
			{ selectFolder, toggleFolder }
		);

		expect(handled).toBe(true);
		expect(toggleFolder).toHaveBeenCalledWith('work');
		expect(selectFolder).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(true);
	});

	it('handles ArrowLeft by selecting the parent when the folder is already collapsed', () => {
		const selectFolder = vi.fn();
		const toggleFolder = vi.fn();
		const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true });

		const handled = handleFoldersPaneShortcut(
			event,
			{
				activePane: 'folders',
				isRenameActive: false,
				navigableIds: ['home', 'work', 'project-a'],
				selectedFolderId: 'project-a',
				selectedFolderTreeItem: {
					parentId: 'work',
					firstChildId: null,
					hasChildren: false,
					isOpen: false
				}
			},
			{ selectFolder, toggleFolder }
		);

		expect(handled).toBe(true);
		expect(selectFolder).toHaveBeenCalledWith('work');
		expect(toggleFolder).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(true);
	});

	it('does not handle ArrowLeft or ArrowRight when the selected item has no applicable tree move', () => {
		const selectFolder = vi.fn();
		const toggleFolder = vi.fn();
		const event = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });

		const handled = handleFoldersPaneShortcut(
			event,
			{
				activePane: 'folders',
				isRenameActive: false,
				navigableIds: ['home'],
				selectedFolderId: 'home',
				selectedFolderTreeItem: {
					parentId: null,
					firstChildId: null,
					hasChildren: false,
					isOpen: false
				}
			},
			{ selectFolder, toggleFolder }
		);

		expect(handled).toBe(false);
		expect(selectFolder).not.toHaveBeenCalled();
		expect(toggleFolder).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(false);
	});

	it('handles ArrowDown in the notes pane by selecting the next visible note', () => {
		const selectNote = vi.fn();
		const activateEditor = vi.fn();
		const requestDeleteNote = vi.fn();
		const event = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true });

		const handled = handleNotesPaneShortcut(
			event,
			{
				activePane: 'notes',
				visibleNoteIds: ['n1', 'n2', 'n3'],
				selectedNoteId: 'n1',
				selectedNoteDeleteContext: null
			},
			{ selectNote, activateEditor, requestDeleteNote }
		);

		expect(handled).toBe(true);
		expect(selectNote).toHaveBeenCalledWith('n2');
		expect(activateEditor).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(true);
	});

	it('handles ArrowUp in the notes pane by selecting the previous visible note', () => {
		const selectNote = vi.fn();
		const activateEditor = vi.fn();
		const requestDeleteNote = vi.fn();
		const event = new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true });

		const handled = handleNotesPaneShortcut(
			event,
			{
				activePane: 'notes',
				visibleNoteIds: ['n1', 'n2', 'n3'],
				selectedNoteId: 'n3',
				selectedNoteDeleteContext: null
			},
			{ selectNote, activateEditor, requestDeleteNote }
		);

		expect(handled).toBe(true);
		expect(selectNote).toHaveBeenCalledWith('n2');
		expect(activateEditor).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(true);
	});

	it('handles Enter in the notes pane by activating the editor for the selected note', () => {
		const selectNote = vi.fn();
		const activateEditor = vi.fn();
		const requestDeleteNote = vi.fn();
		const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });

		const handled = handleNotesPaneShortcut(
			event,
			{
				activePane: 'notes',
				visibleNoteIds: ['n1', 'n2'],
				selectedNoteId: 'n2',
				selectedNoteDeleteContext: null
			},
			{ selectNote, activateEditor, requestDeleteNote }
		);

		expect(handled).toBe(true);
		expect(activateEditor).toHaveBeenCalledTimes(1);
		expect(selectNote).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(true);
	});

	it('does not handle notes pane shortcuts outside the notes pane', () => {
		const selectNote = vi.fn();
		const activateEditor = vi.fn();
		const requestDeleteNote = vi.fn();
		const event = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true });

		const handled = handleNotesPaneShortcut(
			event,
			{
				activePane: 'folders',
				visibleNoteIds: ['n1', 'n2'],
				selectedNoteId: 'n1',
				selectedNoteDeleteContext: null
			},
			{ selectNote, activateEditor, requestDeleteNote }
		);

		expect(handled).toBe(false);
		expect(selectNote).not.toHaveBeenCalled();
		expect(activateEditor).not.toHaveBeenCalled();
	});

	it('does not handle notes pane shortcuts while focus is inside an editable target', () => {
		const selectNote = vi.fn();
		const activateEditor = vi.fn();
		const requestDeleteNote = vi.fn();
		const input = document.createElement('input');
		const event = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true });
		Object.defineProperty(event, 'target', { value: input });

		const handled = handleNotesPaneShortcut(
			event,
			{
				activePane: 'notes',
				visibleNoteIds: ['n1', 'n2'],
				selectedNoteId: 'n1',
				selectedNoteDeleteContext: null
			},
			{ selectNote, activateEditor, requestDeleteNote }
		);

		expect(handled).toBe(false);
		expect(selectNote).not.toHaveBeenCalled();
		expect(activateEditor).not.toHaveBeenCalled();
	});

	it('handles Delete in the notes pane by requesting note deletion', () => {
		const selectNote = vi.fn();
		const activateEditor = vi.fn();
		const requestDeleteNote = vi.fn();
		const event = new KeyboardEvent('keydown', { key: 'Delete', cancelable: true });

		const handled = handleNotesPaneShortcut(
			event,
			{
				activePane: 'notes',
				visibleNoteIds: ['n1', 'n2'],
				selectedNoteId: 'n1',
				selectedNoteDeleteContext: { id: 'n1', title: 'First Note' }
			},
			{ selectNote, activateEditor, requestDeleteNote }
		);

		expect(handled).toBe(true);
		expect(requestDeleteNote).toHaveBeenCalledWith('n1', 'First Note');
		expect(selectNote).not.toHaveBeenCalled();
		expect(activateEditor).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(true);
	});

	it('handles Backspace in the notes pane by requesting note deletion', () => {
		const selectNote = vi.fn();
		const activateEditor = vi.fn();
		const requestDeleteNote = vi.fn();
		const event = new KeyboardEvent('keydown', { key: 'Backspace', cancelable: true });

		const handled = handleNotesPaneShortcut(
			event,
			{
				activePane: 'notes',
				visibleNoteIds: ['n1', 'n2'],
				selectedNoteId: 'n2',
				selectedNoteDeleteContext: { id: 'n2', title: 'Second Note' }
			},
			{ selectNote, activateEditor, requestDeleteNote }
		);

		expect(handled).toBe(true);
		expect(requestDeleteNote).toHaveBeenCalledWith('n2', 'Second Note');
		expect(event.defaultPrevented).toBe(true);
	});

	it('does not handle note delete when there is no deletable selected note', () => {
		const selectNote = vi.fn();
		const activateEditor = vi.fn();
		const requestDeleteNote = vi.fn();
		const event = new KeyboardEvent('keydown', { key: 'Delete', cancelable: true });

		const handled = handleNotesPaneShortcut(
			event,
			{
				activePane: 'notes',
				visibleNoteIds: ['n1', 'n2'],
				selectedNoteId: 'n1',
				selectedNoteDeleteContext: null
			},
			{ selectNote, activateEditor, requestDeleteNote }
		);

		expect(handled).toBe(false);
		expect(requestDeleteNote).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(false);
	});
});
