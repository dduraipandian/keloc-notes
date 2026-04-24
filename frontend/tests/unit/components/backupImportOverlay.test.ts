import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import BackupImportOverlay from '$lib/components/BackupImportOverlay.svelte';

describe('BackupImportOverlay', () => {
	it('renders importing status copy when open', () => {
		render(BackupImportOverlay, {
			props: {
				open: true,
				eyebrow: 'Backup Import',
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
				eyebrow: 'Backup Import',
				title: 'Importing backup...',
				description: 'Rebuilding your library. The app will reopen when finished.'
			}
		});

		expect(screen.queryByRole('status')).toBeNull();
	});

	it('renders a custom eyebrow label', () => {
		render(BackupImportOverlay, {
			props: {
				open: true,
				eyebrow: 'Saving Changes',
				title: 'Saving your changes...',
				description: 'Please wait while Keloc Notes writes pending note updates to local storage.'
			}
		});

		expect(screen.getByText('Saving Changes')).toBeTruthy();
		expect(screen.getByText('Saving your changes...')).toBeTruthy();
	});
});
