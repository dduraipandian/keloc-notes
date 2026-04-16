import { settingsRepository } from './repositories';

export type Theme = 'light' | 'dark' | 'system';

export class ThemeStore {
	#theme = $state<Theme>('system');
	#systemDark = $state(false);

	constructor() {
		if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
			const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
			this.#systemDark = mediaQuery.matches;
			if (typeof mediaQuery.addEventListener === 'function') {
				mediaQuery.addEventListener('change', (e) => {
					this.#systemDark = e.matches;
				});
			} else if (typeof (mediaQuery as any).addListener === 'function') {
				// Fallback for older browsers
				(mediaQuery as any).addListener((e: any) => {
					this.#systemDark = e.matches;
				});
			}
		}
	}

	get theme() {
		return this.#theme;
	}

	get resolvedTheme(): 'light' | 'dark' {
		if (this.#theme === 'system') {
			return this.#systemDark ? 'dark' : 'light';
		}
		return this.#theme as 'light' | 'dark';
	}

	init(savedTheme: Theme | null) {
		this.#theme = savedTheme ?? 'system';
	}

	async setTheme(theme: Theme) {
		this.#theme = theme;
		try {
			await settingsRepository.save('applicationTheme', theme);
		} catch (err) {
			console.error('Failed to save theme setting:', err);
		}
	}
}

export const themeStore = new ThemeStore();
