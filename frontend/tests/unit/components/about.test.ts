import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tick } from 'svelte';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import About from '../../../src/lib/components/About.svelte';
import { ThemeStore } from '../../../src/lib/stores/theme.svelte';
import { UIStateStore } from '../../../src/lib/stores/uiState.svelte';
import { STORE_KEYS } from '../../../src/lib/stores/context';

describe('About component', () => {
    let mockThemeStore: ThemeStore;
    let mockUIStateStore: UIStateStore;

    beforeEach(() => {
        mockThemeStore = new ThemeStore();
        mockUIStateStore = new UIStateStore();
    });

    // Flush bits-ui PresenceManager's rAF-based animation callbacks before
    // @testing-library cleanup destroys the component (describe-scope runs first).
    afterEach(async () => {
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        await tick();
    });

    function renderAbout(props: { open?: boolean; onClose?: () => void } = { open: true }) {
        return render(About, {
            props,
            context: new Map<any, any>([
                [STORE_KEYS.THEME, mockThemeStore],
                [STORE_KEYS.UI_STATE, mockUIStateStore]
            ])
        });
    }
	it('renders app name', () => {
		renderAbout();
		expect(screen.getByText('mdnotes')).toBeTruthy();
	});

	it('renders version', () => {
		renderAbout();
		const versionElement = screen.getByText(/Version/);
		expect(versionElement).toBeTruthy();
	});

	it('renders copyright line', () => {
		renderAbout();
		expect(screen.getByText(/©.*2025/)).toBeTruthy();
	});

	it('calls onClose when close button is clicked', async () => {
		const onClose = vi.fn();
		const user = userEvent.setup();
		renderAbout({ open: true, onClose });

		const closeButton = screen.getByRole('button', { name: /close/i });
		await user.click(closeButton);

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('does not show when open is false', () => {
		const { container } = renderAbout({ open: false });
		const dialog = container.querySelector('[role="dialog"]');
		expect(dialog).toBeNull();
	});
});
