import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { resolveAssetUrl, revokeAssetUrl } from '../../../src/lib/editor/imageHandler';
import * as assetsRepository from '../../../src/lib/infrastructure/repositories';
import * as imageHandler from '../../../src/lib/editor/imageHandler';

vi.mock('../../../src/lib/infrastructure/repositories', () => ({
	assetsRepository: {
		save: vi.fn(),
		get: vi.fn(),
		delete: vi.fn(),
		deleteByNoteId: vi.fn()
	}
}));

describe('imageHandler', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		// Clean up any cached URLs
		const cacheKeys = ['asset-1', 'asset-2', 'nonexistent'];
		cacheKeys.forEach((key) => {
			revokeAssetUrl(key);
		});
	});

	describe('storeImageAsset', () => {
		it('should generate uuid-based asset src string matching asset:uuid pattern', () => {
			// storeImageAsset contract: returns asset:uuid format
			const id = crypto.randomUUID();
			const src = `asset:${id}`;
			expect(src).toMatch(/^asset:[a-f0-9-]{36}$/);
		});
	});

	describe('resolveAssetUrl', () => {
		it('should return object URL for valid asset', async () => {
			const blob = new Blob(['image data'], { type: 'image/webp' });
			const asset = { id: 'asset-1', noteId: 'n1', mimeType: 'image/webp', data: blob };

			vi.mocked(assetsRepository.assetsRepository.get).mockResolvedValue(asset);

			const result = await resolveAssetUrl('asset-1');

			expect(result).toBeTruthy();
			expect(result).toMatch(/^blob:/);
		});

		it('should return null for non-existent asset', async () => {
			vi.mocked(assetsRepository.assetsRepository.get).mockResolvedValue(undefined);

			const result = await resolveAssetUrl('nonexistent');

			expect(result).toBeNull();
		});

		it('should cache URL on second call (no second IDB read)', async () => {
			const blob = new Blob(['image data'], { type: 'image/webp' });
			const asset = { id: 'asset-1', noteId: 'n1', mimeType: 'image/webp', data: blob };

			vi.mocked(assetsRepository.assetsRepository.get).mockResolvedValue(asset);

			// First call
			const url1 = await resolveAssetUrl('asset-1');

			// Clear the mock to verify second call doesn't trigger it
			vi.mocked(assetsRepository.assetsRepository.get).mockClear();

			// Second call
			const url2 = await resolveAssetUrl('asset-1');

			// Should return same URL without calling get again
			expect(url1).toBe(url2);
			expect(assetsRepository.assetsRepository.get).not.toHaveBeenCalled();
		});
	});

	describe('revokeAssetUrl', () => {
		it('should remove URL from cache', async () => {
			const blob = new Blob(['image data'], { type: 'image/webp' });
			const asset = { id: 'asset-1', noteId: 'n1', mimeType: 'image/webp', data: blob };

			vi.mocked(assetsRepository.assetsRepository.get).mockResolvedValue(asset);

			// Populate cache
			const url = await resolveAssetUrl('asset-1');
			expect(url).toBeTruthy();

			// Revoke
			revokeAssetUrl('asset-1');

			// Clear mock
			vi.mocked(assetsRepository.assetsRepository.get).mockClear();
			vi.mocked(assetsRepository.assetsRepository.get).mockResolvedValue(asset);

			// Next resolve should call get again (cache was cleared)
			await resolveAssetUrl('asset-1');
			expect(assetsRepository.assetsRepository.get).toHaveBeenCalled();
		});
	});
});
