import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ThemeStore } from '../../../src/lib/stores/theme.svelte';
import { settingsRepository } from '../../../src/lib/infrastructure/repositories';

vi.mock('../../../src/lib/infrastructure/repositories', () => ({
	settingsRepository: {
		save: vi.fn().mockResolvedValue(undefined)
	}
}));

describe('ThemeStore', () => {
	let mockMediaQueryList: {
		matches: boolean;
		addEventListener: any;
		removeEventListener: any;
		addListener: any;
		removeListener: any;
	};

	let listener: any;

	beforeEach(() => {
		vi.clearAllMocks();
		
		mockMediaQueryList = {
			matches: false,
			addEventListener: vi.fn((_type, cb) => {
				listener = cb;
			}),
			removeEventListener: vi.fn(),
			addListener: vi.fn(), // Fallback for older browsers
			removeListener: vi.fn()
		};

		vi.stubGlobal('window', {
			matchMedia: vi.fn().mockReturnValue(mockMediaQueryList)
		});
	});

	it('should initialize with system theme by default', () => {
		const store = new ThemeStore();
		expect(store.theme).toBe('system');
	});

	it('should hydrate with saved theme on init', () => {
		const store = new ThemeStore();
		store.init('dark');
		expect(store.theme).toBe('dark');
		expect(store.resolvedTheme).toBe('dark');
	});

	it('should calculate resolvedTheme correctly in system mode (light)', () => {
		mockMediaQueryList.matches = false;
		const store = new ThemeStore();
		store.init('system');
		expect(store.resolvedTheme).toBe('light');
	});

	it('should calculate resolvedTheme correctly in system mode (dark)', () => {
		mockMediaQueryList.matches = true;
		const store = new ThemeStore();
		store.init('system');
		expect(store.resolvedTheme).toBe('dark');
	});

	it('should update theme and persist to repository', async () => {
		const store = new ThemeStore();
		await store.setTheme('dark');
		
		expect(store.theme).toBe('dark');
		expect(settingsRepository.save).toHaveBeenCalledWith('applicationTheme', 'dark');
	});

	it('should react to system theme changes in system mode', () => {
		mockMediaQueryList.matches = false;
		const store = new ThemeStore();
		store.init('system');
		expect(store.resolvedTheme).toBe('light');

		// Simulate system change to dark
		listener({ matches: true });
		expect(store.resolvedTheme).toBe('dark');
	});

	it('should NOT react to system theme changes in explicit mode (light)', () => {
		mockMediaQueryList.matches = false;
		const store = new ThemeStore();
		store.init('light');
		expect(store.resolvedTheme).toBe('light');

		// Simulate system change to dark
		listener({ matches: true });
		expect(store.resolvedTheme).toBe('light'); // Stays light
	});

	it('should NOT react to system theme changes in explicit mode (dark)', () => {
		mockMediaQueryList.matches = true;
		const store = new ThemeStore();
		store.init('dark');
		expect(store.resolvedTheme).toBe('dark');

		// Simulate system change to light
		listener({ matches: false });
		expect(store.resolvedTheme).toBe('dark'); // Stays dark
	});
});
