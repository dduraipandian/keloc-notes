import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import Settings from '../../../src/lib/components/Settings.svelte';
import { preferencesStore } from '../../../src/lib/stores/preferences.svelte';
import { themeStore } from '../../../src/lib/stores/theme.svelte';

vi.spyOn(preferencesStore, 'setFolderAccentColor').mockImplementation(async () => {});
vi.spyOn(themeStore, 'setTheme').mockImplementation(async () => {});

describe('Settings component', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders folder accent color setting by default (General tab)', () => {
		render(Settings, { props: { open: true } });
		expect(screen.getByText(/folder accent color/i)).toBeTruthy();
	});

	it('renders color picker on General tab', () => {
		render(Settings, { props: { open: true } });
		const colorInput = document.querySelector('input[type="color"]');
		expect(colorInput).toBeTruthy();
	});

	it('updates accent color on color picker change', async () => {
		const user = userEvent.setup();
		render(Settings, { props: { open: true } });

		const colorInput = document.querySelector('input[id="accent-color"]') as HTMLInputElement;
		if (colorInput) {
			colorInput.value = '#ff3b30';
			// trigger input event as it's bound with oninput
			colorInput.dispatchEvent(new Event('input', { bubbles: true }));

			expect(preferencesStore.setFolderAccentColor).toHaveBeenCalledWith('#ff3b30');
		}
	});

	it('switches to Appearance tab and shows theme options', async () => {
		const user = userEvent.setup();
		render(Settings, { props: { open: true } });

		const appearanceTab = screen.getByRole('button', { name: /appearance/i });
		await user.click(appearanceTab);

		expect(screen.getByText(/appearance mode/i)).toBeTruthy();
		expect(screen.getByText('Light')).toBeTruthy();
		expect(screen.getByText('Dark')).toBeTruthy();
		expect(screen.getByText('System')).toBeTruthy();
	});

	it('calls setTheme when theme option is clicked', async () => {
		const user = userEvent.setup();
		render(Settings, { props: { open: true } });

		const appearanceTab = screen.getByRole('button', { name: /appearance/i });
		await user.click(appearanceTab);

		const darkOption = screen.getByText('Dark').closest('button');
		if (darkOption) {
			await user.click(darkOption);
			expect(themeStore.setTheme).toHaveBeenCalledWith('dark');
		}
	});

	it('calls onClose when close button is clicked', async () => {
		const onClose = vi.fn();
		const user = userEvent.setup();
		render(Settings, { props: { open: true, onClose } });

		const closeButton = screen.getByRole('button', { name: /close/i });
		await user.click(closeButton);

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('does not show when open is false', () => {
		const { container } = render(Settings, { props: { open: false } });
		const dialog = container.querySelector('[role="dialog"]');
		expect(dialog).toBeNull();
	});
});
