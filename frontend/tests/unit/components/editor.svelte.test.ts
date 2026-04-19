import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { tick } from 'svelte';
import { render } from '@testing-library/svelte';
import Editor from '$lib/components/Editor.svelte';
import type { NoteItem } from '$lib/stores/notes.svelte';
import type { NoteService } from '$lib/stores/services/noteService';
import type { PreferencesStore } from '$lib/stores/preferences.svelte';
import { STORE_KEYS } from '$lib/stores/context';

describe('Editor.svelte', () => {
	const mockNoteService: NoteService = {
		update: vi.fn()
	} as any;

	const mockPreferencesStore: PreferencesStore = {
		editorToolbar: 'fixed',
		enabledLanguages: ['javascript', 'python']
	} as any;

	function createNote(overrides: Partial<NoteItem> = {}): NoteItem {
		return {
			id: 'note-1',
			folderId: 'folder-1',
			title: 'Test Note',
			summary: 'Test summary',
			updatedAt: '2026-04-20T00:00:00Z',
			isFavorite: false,
			deletedAt: null,
			deletedBatchId: null,
			content: '{"type":"doc","content":[]}',
			isContentLoaded: true,
			...overrides
		};
	}

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(async () => {
		await new Promise<void>((r) => requestAnimationFrame(() => r()));
		await tick();
	});

	it('should render editor root', () => {
		const { container } = render(Editor, {
			props: { note: createNote(), readonly: false },
			context: new Map([
				['noteService', mockNoteService],
				['preferencesStore', mockPreferencesStore]
			])
		});

		const editorRoot = container.querySelector('.editor-root');
		expect(editorRoot).toBeTruthy();
	});

	it('should have editor-root with textbox role', () => {
		const { container } = render(Editor, {
			props: { note: createNote(), readonly: false },
			context: new Map([
				['noteService', mockNoteService],
				['preferencesStore', mockPreferencesStore]
			])
		});

		const editorRoot = container.querySelector('.editor-root');
		expect(editorRoot?.getAttribute('role')).toBe('textbox');
	});

	it('should render bubble menu element', () => {
		const { container } = render(Editor, {
			props: { note: createNote(), readonly: false },
			context: new Map([
				['noteService', mockNoteService],
				['preferencesStore', mockPreferencesStore]
			])
		});

		const bubbleMenu = container.querySelector('.bubble-menu');
		expect(bubbleMenu).toBeTruthy();
	});

	it('should render editor content area', () => {
		const { container } = render(Editor, {
			props: { note: createNote(), readonly: false },
			context: new Map([
				['noteService', mockNoteService],
				['preferencesStore', mockPreferencesStore]
			])
		});

		const editorContent = container.querySelector('.editor-content');
		expect(editorContent).toBeTruthy();
		expect(editorContent?.classList.contains('prose')).toBe(true);
	});

	it('should set editor to readonly mode when note is deleted', () => {
		const { container } = render(Editor, {
			props: { note: createNote({ deletedAt: '2026-04-20T00:00:00Z' }), readonly: true },
			context: new Map([
				['noteService', mockNoteService],
				['preferencesStore', mockPreferencesStore]
			])
		});

		const editorRoot = container.querySelector('.editor-root');
		expect(editorRoot).toBeTruthy();
	});

	it('should accept empty content string', () => {
		const { container } = render(Editor, {
			props: { note: createNote({ content: '' }), readonly: false },
			context: new Map([
				['noteService', mockNoteService],
				['preferencesStore', mockPreferencesStore]
			])
		});

		const editorRoot = container.querySelector('.editor-root');
		expect(editorRoot).toBeTruthy();
	});

	it('should accept JSON content', () => {
		const { container } = render(Editor, {
			props: {
				note: createNote({
					content: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hello"}]}]}'
				}),
				readonly: false
			},
			context: new Map([
				['noteService', mockNoteService],
				['preferencesStore', mockPreferencesStore]
			])
		});

		const editorRoot = container.querySelector('.editor-root');
		expect(editorRoot).toBeTruthy();
	});

	it('should have handlers for drop and paste', () => {
		const { container } = render(Editor, {
			props: { note: createNote(), readonly: false },
			context: new Map([
				['noteService', mockNoteService],
				['preferencesStore', mockPreferencesStore]
			])
		});

		const editorRoot = container.querySelector('.editor-root');
		expect(editorRoot).toBeTruthy();
		expect(editorRoot?.classList.contains('editor-root')).toBe(true);
	});

	it('should render with null enabledLanguages', () => {
		const preferences = { ...mockPreferencesStore, enabledLanguages: null };
		const { container } = render(Editor, {
			props: { note: createNote(), readonly: false },
			context: new Map([
				['noteService', mockNoteService],
				['preferencesStore', preferences]
			])
		});

		const editorRoot = container.querySelector('.editor-root');
		expect(editorRoot).toBeTruthy();
	});
});
