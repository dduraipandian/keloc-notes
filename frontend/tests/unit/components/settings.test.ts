import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tick } from 'svelte';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import Settings from '../../../src/lib/components/Settings.svelte';
import { PreferencesStore } from '../../../src/lib/stores/preferences.svelte';
import { ThemeStore } from '../../../src/lib/stores/theme.svelte';
import { STORE_KEYS } from '../../../src/lib/stores/context';

describe('Settings component', () => {
	let mockPreferencesStore: PreferencesStore;
	let mockThemeStore: ThemeStore;

	beforeEach(() => {
		mockPreferencesStore = new PreferencesStore();
		mockThemeStore = new ThemeStore();
		vi.spyOn(mockPreferencesStore, 'setFolderAccentColor').mockImplementation(async () => {});
		vi.spyOn(mockPreferencesStore, 'setImageProcessingConcurrency').mockImplementation(async () => {});
		vi.spyOn(mockThemeStore, 'setTheme').mockImplementation(async () => {});
		vi.clearAllMocks();
	});

	// Flush bits-ui PresenceManager's rAF-based animation callbacks before
	// @testing-library cleanup destroys the component (describe-scope runs first).
	afterEach(async () => {
		await new Promise<void>((r) => requestAnimationFrame(() => r()));
		await tick();
	});

	function renderSettings(props: { open?: boolean; onClose?: () => void } = { open: true }) {
		return render(Settings, { 
			props,
			context: new Map<any, any>([
				[STORE_KEYS.PREFERENCES, mockPreferencesStore],
				[STORE_KEYS.THEME, mockThemeStore]
			])
		});
	}

	it('renders folder accent color setting by default (General tab)', () => {
		renderSettings();
		expect(screen.getByText(/folder accent color/i)).toBeTruthy();
	});

	it('renders color picker on General tab', () => {
		renderSettings();
		const colorInput = document.querySelector('input[type="color"]');
		expect(colorInput).toBeTruthy();
	});

	it('updates accent color on color picker change', async () => {
		const user = userEvent.setup();
		renderSettings();

		const colorInput = document.querySelector('input[id="accent-color"]') as HTMLInputElement;
		if (colorInput) {
			colorInput.value = '#ff3b30';
			// trigger input event as it's bound with oninput
			colorInput.dispatchEvent(new Event('input', { bubbles: true }));

			expect(mockPreferencesStore.setFolderAccentColor).toHaveBeenCalledWith('#ff3b30');
		}
	});

	it('switches to Appearance tab and shows theme options', async () => {
		const user = userEvent.setup();
		renderSettings();

		const appearanceTab = screen.getByRole('button', { name: /appearance/i });
		await user.click(appearanceTab);

		expect(screen.getByText(/appearance mode/i)).toBeTruthy();
		expect(screen.getByText('Light')).toBeTruthy();
		expect(screen.getByText('Dark')).toBeTruthy();
		expect(screen.getByText('System')).toBeTruthy();
	});

	it('calls setTheme when theme option is clicked', async () => {
		const user = userEvent.setup();
		renderSettings();

		const appearanceTab = screen.getByRole('button', { name: /appearance/i });
		await user.click(appearanceTab);

		const darkOption = screen.getByText('Dark').closest('button');
		if (darkOption) {
			await user.click(darkOption);
			expect(mockThemeStore.setTheme).toHaveBeenCalledWith('dark');
		}
	});

	it('shows editor concurrency control on the Editor tab', async () => {
		const user = userEvent.setup();
		renderSettings();

		const editorTab = screen.getByRole('button', { name: /editor/i });
		await user.click(editorTab);

		expect(screen.getByText(/image processing concurrency/i)).toBeTruthy();
	});

	it('calls onClose when close button is clicked', async () => {
		const onClose = vi.fn();
		const user = userEvent.setup();
		renderSettings({ open: true, onClose });

		const closeButton = screen.getByRole('button', { name: /close/i });
		await user.click(closeButton);

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('does not show when open is false', () => {
		const { container } = renderSettings({ open: false });
		const dialog = container.querySelector('[role="dialog"]');
		expect(dialog).toBeNull();
	});
});
