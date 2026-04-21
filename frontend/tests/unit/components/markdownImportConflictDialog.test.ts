import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import MarkdownImportConflictDialog from '$lib/components/MarkdownImportConflictDialog.svelte';
import { UIStateStore } from '$lib/stores/uiState.svelte';

describe('MarkdownImportConflictDialog', () => {
	let uiState: UIStateStore;

	beforeEach(() => {
		uiState = new UIStateStore();
		uiState.openMarkdownImportConflictDialog({
			conflicts: [
				{
					importIndex: 0,
					title: 'Roadmap',
					folderPath: 'Projects',
					existingNoteId: 'note-1'
				},
				{
					importIndex: 1,
					title: 'Ideas',
					folderPath: '',
					existingNoteId: 'note-2'
				}
			],
			onConfirm: vi.fn()
		});
	});

	it('renders the conflict checklist and resolution options', () => {
		render(MarkdownImportConflictDialog, {
			props: { uiState }
		});

		expect(screen.getByText('Import Conflicts Found')).toBeTruthy();
		expect(screen.getByText('Roadmap')).toBeTruthy();
		expect(screen.getByText('Projects')).toBeTruthy();
		expect(screen.getByText('Ideas')).toBeTruthy();
		expect(screen.getByText('Home')).toBeTruthy();
		expect(screen.getByLabelText('Keep both')).toBeTruthy();
		expect(screen.getByLabelText('Overwrite existing')).toBeTruthy();
	});

	it('updates the selected resolution and confirms through the store', async () => {
		const confirmSpy = vi.spyOn(uiState, 'confirmMarkdownImportConflictDialog');

		render(MarkdownImportConflictDialog, {
			props: { uiState }
		});

		await fireEvent.click(screen.getByLabelText('Overwrite existing'));
		await fireEvent.click(screen.getByText('Continue Import'));

		expect(uiState.markdownImportConflictDialog?.resolution).toBe('overwrite');
		expect(confirmSpy).toHaveBeenCalled();
	});
});
