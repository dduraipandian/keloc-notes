import { beforeEach, describe, expect, it, vi } from 'vitest';
import { importedMarkdownToEditorContent } from '$lib/editor/serializer';
import * as repositories from '$lib/infrastructure/repositories';

vi.mock('$lib/infrastructure/repositories', () => ({
	assetsRepository: {
		save: vi.fn()
	}
}));

describe('importedMarkdownToEditorContent', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('asset-1');
	});

	it('converts markdown image references into editor image nodes and persists imported assets', async () => {
		const content = await importedMarkdownToEditorContent(
			'note-1',
			'## Heading\n\n![Hero](Roadmap.assets/hero.webp)',
			[
				{
					Path: 'Roadmap.assets/hero.webp',
					DataBase64: 'aGVyby1pbWFnZQ=='
				}
			]
		);

		expect(repositories.assetsRepository.save).toHaveBeenCalledWith({
			id: 'asset-1',
			noteId: 'note-1',
			mimeType: 'image/webp',
			data: expect.any(Blob)
		});

		expect(JSON.parse(content)).toEqual({
			type: 'doc',
			content: [
				{
					type: 'heading',
					attrs: { level: 2 },
					content: [{ type: 'text', text: 'Heading' }]
				},
				{
					type: 'paragraph'
				},
				{
					type: 'image',
					attrs: {
						src: 'asset:asset-1',
						alt: 'Hero',
						assetId: 'asset-1'
					}
				}
			]
		});
	});
});
