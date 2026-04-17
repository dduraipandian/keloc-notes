import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import About from '../../../src/lib/components/About.svelte';

describe('About component', () => {
	it('renders app name', () => {
		render(About, { props: { open: true } });
		expect(screen.getByText('mdnotes')).toBeTruthy();
	});

	it('renders version', () => {
		render(About, { props: { open: true } });
		const versionElement = screen.getByText(/Version/);
		expect(versionElement).toBeTruthy();
	});

	it('renders copyright line', () => {
		render(About, { props: { open: true } });
		expect(screen.getByText(/©.*2025/)).toBeTruthy();
	});

	it('calls onClose when close button is clicked', async () => {
		const onClose = vi.fn();
		const user = userEvent.setup();
		render(About, { props: { open: true, onClose } });

		const closeButton = screen.getByRole('button', { name: /close/i });
		await user.click(closeButton);

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('does not show when open is false', () => {
		const { container } = render(About, { props: { open: false } });
		const dialog = container.querySelector('[role="dialog"]');
		expect(dialog).toBeNull();
	});
});
