import { defineConfig } from '@playwright/test';

export default defineConfig({
	use: {
		baseURL: 'http://127.0.0.1:4173'
	},
	webServer: {
		command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173',
		port: 4173,
		reuseExistingServer: !process.env.CI,
		timeout: 120 * 1000 // Wait for 2 minutes
	},
	testMatch: '**/*.e2e.{ts,js}'
});
