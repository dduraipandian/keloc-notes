import { beforeEach, describe, expect, it } from 'vitest';
import { uiStateStore } from '../../../src/lib/stores/uiState.svelte';

describe('UIStateStore', () => {
	beforeEach(() => {
		uiStateStore.__resetForTest();
	});

	it('defaults activePane to folders', () => {
		expect(uiStateStore.activePane).toBe('folders');
	});

	it('updates activePane', () => {
		uiStateStore.setActivePane('notes');
		expect(uiStateStore.activePane).toBe('notes');

		uiStateStore.setActivePane('editor');
		expect(uiStateStore.activePane).toBe('editor');
	});

	it('resets activePane for tests', () => {
		uiStateStore.setActivePane('editor');
		expect(uiStateStore.activePane).toBe('editor');

		uiStateStore.__resetForTest();
		expect(uiStateStore.activePane).toBe('folders');
	});
});
