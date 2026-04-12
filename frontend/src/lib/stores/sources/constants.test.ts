import { describe, it, expect } from 'vitest';
import { PROTECTED_NOTES_FOLDER_ID, TRASH_VIEW_ID } from './constants';

describe('source constants', () => {
	it('defines the protected notes folder id', () => {
		expect(PROTECTED_NOTES_FOLDER_ID).toBe('notes');
	});

	it('defines the trash view id', () => {
		expect(TRASH_VIEW_ID).toBe('trash');
	});

	it('protected folder id and trash view id are distinct', () => {
		expect(PROTECTED_NOTES_FOLDER_ID).not.toBe(TRASH_VIEW_ID);
	});
});
