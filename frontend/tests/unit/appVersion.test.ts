import { describe, expect, it } from 'vitest';
import packageJson from '../../package.json';
import { APP_VERSION } from '$lib/appVersion';

describe('APP_VERSION', () => {
	it('matches the frontend package version', () => {
		expect(APP_VERSION).toBe(packageJson.version);
	});
});
