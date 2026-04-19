import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import EditorToolbar from '$lib/components/EditorToolbar.svelte';
import type { Editor } from '@tiptap/core';

describe('EditorToolbar.svelte', () => {
	function mockEditor(overrides: Partial<Editor> = {}): Editor {
		return {
			isActive: vi.fn(() => false),
			chain: vi.fn(() => ({
				focus: vi.fn(() => ({
					toggleBold: vi.fn(() => ({ run: vi.fn() })),
					toggleItalic: vi.fn(() => ({ run: vi.fn() })),
					toggleStrike: vi.fn(() => ({ run: vi.fn() })),
					toggleHeading: vi.fn(() => ({ run: vi.fn() })),
					toggleBulletList: vi.fn(() => ({ run: vi.fn() })),
					toggleOrderedList: vi.fn(() => ({ run: vi.fn() })),
					toggleCodeBlock: vi.fn(() => ({ run: vi.fn() })),
					updateAttributes: vi.fn(() => ({ run: vi.fn() })),
					setHorizontalRule: vi.fn(() => ({ run: vi.fn() }))
				}))
			})),
			getAttributes: vi.fn(() => ({ language: 'plaintext' })),
			...overrides
		} as any as Editor;
	}

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should render toolbar', () => {
		render(EditorToolbar, {
			props: {
				editor: null,
				onImageInsert: vi.fn(),
				enabledLanguages: ['javascript', 'python']
			}
		});

		const toolbar = document.querySelector('.editor-toolbar');
		expect(toolbar).toBeTruthy();
	});

	it('should disable all buttons when editor is null', () => {
		render(EditorToolbar, {
			props: {
				editor: null,
				onImageInsert: vi.fn(),
				enabledLanguages: ['javascript', 'python']
			}
		});

		const buttons = document.querySelectorAll('.editor-toolbar button');
		buttons.forEach((btn) => {
			expect((btn as HTMLButtonElement).disabled).toBe(true);
		});
	});

	it('should enable buttons when editor is provided', () => {
		render(EditorToolbar, {
			props: {
				editor: mockEditor(),
				onImageInsert: vi.fn(),
				enabledLanguages: ['javascript', 'python']
			}
		});

		const buttons = document.querySelectorAll('.editor-toolbar button');
		buttons.forEach((btn) => {
			expect((btn as HTMLButtonElement).disabled).toBe(false);
		});
	});

	it('should call onImageInsert when image button is clicked', async () => {
		const onImageInsert = vi.fn();
		const user = userEvent.setup();
		render(EditorToolbar, {
			props: {
				editor: mockEditor(),
				onImageInsert,
				enabledLanguages: ['javascript', 'python']
			}
		});

		const imageBtn = screen.getByRole('button', { name: 'Image' });
		await user.click(imageBtn);
		expect(onImageInsert).toHaveBeenCalled();
	});

	it('should show active state for bold when editor.isActive returns true', () => {
		const editor = mockEditor();
		(editor.isActive as any).mockImplementation((mark: string) => mark === 'bold');

		render(EditorToolbar, {
			props: {
				editor,
				onImageInsert: vi.fn(),
				enabledLanguages: ['javascript', 'python']
			}
		});

		const boldBtn = screen.getByRole('button', { name: 'Bold' });
		expect(boldBtn.classList.contains('is-active')).toBe(true);
	});

	it('should toggle bold when bold button is clicked', async () => {
		const editor = mockEditor();
		const user = userEvent.setup();
		render(EditorToolbar, {
			props: {
				editor,
				onImageInsert: vi.fn(),
				enabledLanguages: ['javascript', 'python']
			}
		});

		const boldBtn = screen.getByRole('button', { name: 'Bold' });
		await user.click(boldBtn);
		expect(editor.chain).toHaveBeenCalled();
	});

	it('should show language select for code block when inside code block', () => {
		const editor = mockEditor();
		(editor.isActive as any).mockImplementation((node: string) => node === 'codeBlock');

		const { container } = render(EditorToolbar, {
			props: {
				editor,
				onImageInsert: vi.fn(),
				enabledLanguages: ['javascript', 'python', 'go']
			}
		});

		const select = container.querySelector('.toolbar-select');
		expect(select).toBeTruthy();
	});

	it('should render headings h1, h2, h3 buttons', () => {
		render(EditorToolbar, {
			props: {
				editor: mockEditor(),
				onImageInsert: vi.fn(),
				enabledLanguages: ['javascript', 'python']
			}
		});

		expect(screen.getByRole('button', { name: 'H1' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'H2' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'H3' })).toBeTruthy();
	});

	it('should render bullet list and ordered list buttons', () => {
		render(EditorToolbar, {
			props: {
				editor: mockEditor(),
				onImageInsert: vi.fn(),
				enabledLanguages: ['javascript', 'python']
			}
		});

		expect(screen.getByRole('button', { name: 'Bullet list' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Ordered list' })).toBeTruthy();
	});

	it('should render horizontal rule button', () => {
		render(EditorToolbar, {
			props: {
				editor: mockEditor(),
				onImageInsert: vi.fn(),
				enabledLanguages: ['javascript', 'python']
			}
		});

		expect(screen.getByRole('button', { name: 'Horizontal rule' })).toBeTruthy();
	});
});
