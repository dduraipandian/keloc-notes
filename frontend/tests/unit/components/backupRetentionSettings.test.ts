import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import Settings from '$lib/components/Settings.svelte';
import { PreferencesStore } from '$lib/stores/preferences.svelte';
import { ThemeStore } from '$lib/stores/theme.svelte';
import { STORE_KEYS } from '$lib/stores/context';

describe('Settings backup retention control', () => {
	let preferencesStore: PreferencesStore;
	let themeStore: ThemeStore;

	beforeEach(() => {
		preferencesStore = new PreferencesStore();
		themeStore = new ThemeStore();
		vi.spyOn(preferencesStore, 'setBackupRetentionDays').mockImplementation(async () => {});
	});

	it('renders backup retention on the General tab and persists changes', async () => {
		const user = userEvent.setup();
		render(Settings, {
			props: { open: true },
			context: new Map<unknown, unknown>([
				[STORE_KEYS.PREFERENCES, preferencesStore],
				[STORE_KEYS.THEME, themeStore]
			])
		});

		const select = screen.getByLabelText(/deleted backup retention/i);
		expect(select).toBeTruthy();

		await user.selectOptions(select, '7');

		expect(preferencesStore.setBackupRetentionDays).toHaveBeenCalledWith(7);
	});
});
