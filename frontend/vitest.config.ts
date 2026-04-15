import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		conditions: ['browser', 'development']
	},
	test: {
		include: ['tests/**/*.{test,spec}.{js,ts,svelte.js,svelte.ts}'],
		exclude: ['**/e2e/**', 'node_modules/**'],
		environment: 'jsdom',
		globals: true,
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			include: ['src/lib/**/*.{ts,svelte}'],
			exclude: [
				'src/lib/wailsjs/**',
				'src/lib/components/ui/**',
				'src/lib/hooks/**',
				'src/lib/assets/**',
				'**/*.d.ts',
				'**/*.test.ts',
				'**/*.test.svelte.ts'
			],
			thresholds: {
				lines: 80,
				functions: 80,
				branches: 80,
				statements: 80
			}
		}
	}
});
