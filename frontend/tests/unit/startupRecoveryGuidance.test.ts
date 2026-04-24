import { describe, expect, it } from 'vitest';
import {
	buildDatabaseBlockedMessage,
	buildStartupRecoveryGuidance
} from '../../src/lib/startupRecovery';

describe('startup recovery guidance', () => {
	it('classifies blocked upgrades as temporary and preserves the reset warning', () => {
		const guidance = buildStartupRecoveryGuidance(
			new Error('Database upgrade is blocked by another Keloc Notes window.')
		);

		expect(guidance.kind).toBe('blocked-upgrade');
		expect(guidance.summary).toContain('another Keloc Notes window');
		expect(guidance.dataStatus).toContain('likely still intact');
		expect(guidance.primaryAction).toContain('Close every other Keloc Notes window');
		expect(guidance.resetWarning).toContain('');
		expect(guidance.appReset).toBe(false);
	});

	it('classifies IndexedDB corruption as local storage failure with backup recovery guidance', () => {
		const guidance = buildStartupRecoveryGuidance(
			new Error('IndexedDB UnknownError: database file may be corrupted')
		);

		expect(guidance.kind).toBe('storage-corruption');
		expect(guidance.summary).toContain('local notes database');
		expect(guidance.dataStatus).toContain('cannot confirm');
		expect(guidance.primaryAction).toContain('Retry Startup');
		expect(guidance.resetWarning).toContain('backup');
		expect(guidance.appReset).toBe(true);
	});

	it('builds a blocked database message with version details and a non-destructive next step', () => {
		const message = buildDatabaseBlockedMessage(4, 5);

		expect(message).toContain('current: 4');
		expect(message).toContain('target: 5');
		expect(message).toContain('Your notes are likely still intact');
		expect(message).toContain('Close every other Keloc Notes window');
		expect(message).toContain('Do not reset local data');
	});
});
