import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import BubbleToolbar from '$lib/components/BubbleToolbar.svelte';
import type { Editor } from '@tiptap/core';

describe('BubbleToolbar.svelte', () => {
	function mockEditor(overrides: Partial<Editor> = {}): Editor {
		return {
			isActive: vi.fn(() => false),
			chain: vi.fn(() => ({
				focus: vi.fn(() => ({
					toggleBold: vi.fn(() => ({ run: vi.fn() })),
					toggleItalic: vi.fn(() => ({ run: vi.fn() })),
					toggleStrike: vi.fn(() => ({ run: vi.fn() })),
					toggleCode: vi.fn(() => ({ run: vi.fn() })),
					toggleHeading: vi.fn(() => ({ run: vi.fn() }))
				}))
			})),
			...overrides
		} as any as Editor;
	}

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should render toolbar', () => {
		render(BubbleToolbar, {
			props: {
				editor: null,
				editorEl: null
			}
		});

		const toolbar = document.querySelector('.bubble-toolbar');
		expect(toolbar).toBeTruthy();
	});

	it('should render buttons when editor is provided', () => {
		render(BubbleToolbar, {
			props: {
				editor: mockEditor(),
				editorEl: document.createElement('div')
			}
		});

		const buttons = document.querySelectorAll('.bubble-toolbar button');
		expect(buttons.length).toBeGreaterThan(0);
	});

	it('should render bold button', () => {
		render(BubbleToolbar, {
			props: {
				editor: mockEditor(),
				editorEl: document.createElement('div')
			}
		});

		expect(screen.getByRole('button', { name: 'Bold' })).toBeTruthy();
	});

	it('should render italic button', () => {
		render(BubbleToolbar, {
			props: {
				editor: mockEditor(),
				editorEl: document.createElement('div')
			}
		});

		expect(screen.getByRole('button', { name: 'Italic' })).toBeTruthy();
	});

	it('should render strikethrough button', () => {
		render(BubbleToolbar, {
			props: {
				editor: mockEditor(),
				editorEl: document.createElement('div')
			}
		});

		expect(screen.getByRole('button', { name: 'Strikethrough' })).toBeTruthy();
	});

	it('should render code button', () => {
		render(BubbleToolbar, {
			props: {
				editor: mockEditor(),
				editorEl: document.createElement('div')
			}
		});

		expect(screen.getByRole('button', { name: 'Code' })).toBeTruthy();
	});

	it('should render heading buttons h1 and h2', () => {
		render(BubbleToolbar, {
			props: {
				editor: mockEditor(),
				editorEl: document.createElement('div')
			}
		});

		expect(screen.getByRole('button', { name: 'H1' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'H2' })).toBeTruthy();
	});

	it('should toggle bold when button is clicked', async () => {
		const editor = mockEditor();
		const user = userEvent.setup();
		render(BubbleToolbar, {
			props: {
				editor,
				editorEl: document.createElement('div')
			}
		});

		const boldBtn = screen.getByRole('button', { name: 'Bold' });
		await user.click(boldBtn);
		expect(editor.chain).toHaveBeenCalled();
	});

	it('should show active state when button matches editor state', () => {
		const editor = mockEditor();
		(editor.isActive as any).mockImplementation((mark: string) => mark === 'bold');

		render(BubbleToolbar, {
			props: {
				editor,
				editorEl: document.createElement('div')
			}
		});

		const boldBtn = screen.getByRole('button', { name: 'Bold' });
		expect(boldBtn.classList.contains('is-active')).toBe(true);
	});
});
