import { beforeEach, describe, expect, it } from 'vitest';
import { UIStateStore } from '../../../src/lib/stores/uiState.svelte';

describe('UIStateStore', () => {
	let uiStateStore: UIStateStore;

	beforeEach(() => {
		uiStateStore = new UIStateStore();
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
