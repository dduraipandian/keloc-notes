import { describe, expect, it, vi } from 'vitest';
import {
	handleGlobalShortcut,
	handleEscapeShortcut,
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

	it('handles Cmd/Ctrl+N as create note', () => {
		const createNote = vi.fn();
		const createFolder = vi.fn();
		const event = new KeyboardEvent('keydown', { key: 'n', metaKey: true, cancelable: true });

		const handled = handleGlobalShortcut(event, { createNote, createFolder });

		expect(handled).toBe(true);
		expect(createNote).toHaveBeenCalledTimes(1);
		expect(createFolder).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(true);
	});

	it('handles Cmd/Ctrl+Shift+N as create folder', () => {
		const createNote = vi.fn();
		const createFolder = vi.fn();
		const event = new KeyboardEvent('keydown', {
			key: 'n',
			ctrlKey: true,
			shiftKey: true,
			cancelable: true
		});

		const handled = handleGlobalShortcut(event, { createNote, createFolder });

		expect(handled).toBe(true);
		expect(createFolder).toHaveBeenCalledTimes(1);
		expect(createNote).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(true);
	});

	it('does not handle shortcuts while typing in editable targets', () => {
		const createNote = vi.fn();
		const createFolder = vi.fn();
		const input = document.createElement('input');
		const event = new KeyboardEvent('keydown', { key: 'n', metaKey: true });
		Object.defineProperty(event, 'target', { value: input });

		const handled = handleGlobalShortcut(event, { createNote, createFolder });

		expect(handled).toBe(false);
		expect(createNote).not.toHaveBeenCalled();
		expect(createFolder).not.toHaveBeenCalled();
	});

	it('ignores unrelated shortcuts', () => {
		const createNote = vi.fn();
		const createFolder = vi.fn();
		const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true });

		const handled = handleGlobalShortcut(event, { createNote, createFolder });

		expect(handled).toBe(false);
		expect(createNote).not.toHaveBeenCalled();
		expect(createFolder).not.toHaveBeenCalled();
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
});
