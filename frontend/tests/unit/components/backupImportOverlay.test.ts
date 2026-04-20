import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import BackupImportOverlay from '$lib/components/BackupImportOverlay.svelte';

describe('BackupImportOverlay', () => {
	it('renders importing status copy when open', () => {
		render(BackupImportOverlay, {
			props: {
				open: true,
				title: 'Importing backup...',
				description: 'Rebuilding your library. The app will reopen when finished.'
			}
		});

		expect(screen.getByRole('status')).toBeTruthy();
		expect(screen.getByText('Importing backup...')).toBeTruthy();
		expect(screen.getByText('Rebuilding your library. The app will reopen when finished.')).toBeTruthy();
	});

	it('does not render when closed', () => {
		render(BackupImportOverlay, {
			props: {
				open: false,
				title: 'Importing backup...',
				description: 'Rebuilding your library. The app will reopen when finished.'
			}
		});

		expect(screen.queryByRole('status')).toBeNull();
	});
});
