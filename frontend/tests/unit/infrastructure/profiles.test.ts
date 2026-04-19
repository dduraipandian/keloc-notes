import { describe, it, expect } from 'vitest';
import { resolveProfile, PROFILE_REGISTRY } from '../../../src/lib/stores/domain/profiles';

describe('Folder Profiles', () => {
	it('should resolve the correct profile based on deletedAt', () => {
		const regularFolder = { id: 'f1', title: 'Folder', profile: 'regular' } as any;
		const deletedFolder = { id: 'f2', title: 'Deleted', deletedAt: Date.now() } as any;

		expect(resolveProfile(regularFolder)).toBe(PROFILE_REGISTRY.regular);
		expect(resolveProfile(deletedFolder)).toBe(PROFILE_REGISTRY.deleted);
	});

	it('should resolve system profiles by ID alone', () => {
		const homeById = { id: 'home', title: 'Random Title' } as any;
		const favoritesById = { id: 'favorites' } as any;
		const trashById = { id: 'deleted-notes' } as any;

		expect(resolveProfile(homeById)).toBe(PROFILE_REGISTRY.home);
		expect(resolveProfile(favoritesById)).toBe(PROFILE_REGISTRY.favorites);
		expect(resolveProfile(trashById)).toBe(PROFILE_REGISTRY.trash);
	});

	it('should resolve Home profile and its notes', () => {
		const homeFolder = { id: 'home', title: 'Home', profile: 'home' } as any;
		const profile = resolveProfile(homeFolder);

		expect(profile.section).toBe('views');
		expect(profile.capabilities.createNote).toBe(true);

		const allNotes = [
			{ id: '1', folderId: null, deletedAt: null },
			{ id: '2', folderId: 'f1', deletedAt: null },
			{ id: '3', folderId: null, deletedAt: Date.now() }
		] as any[];

		const homeNotes = profile.resolveNotes('home', allNotes);
		expect(homeNotes).toHaveLength(1);
		expect(homeNotes[0].id).toBe('1');
	});

	it('should resolve Trash profile and its notes', () => {
		const trashFolder = { id: 'trash', title: 'Trash', profile: 'trash' } as any;
		const profile = resolveProfile(trashFolder);

		const allNotes = [
			{ id: '1', folderId: null, deletedAt: null },
			{ id: '2', folderId: 'f1', deletedAt: Date.now() }
		] as any[];

		const trashNotes = profile.resolveNotes('trash', allNotes);
		expect(trashNotes).toHaveLength(1);
		expect(trashNotes[0].id).toBe('2');
	});
});
