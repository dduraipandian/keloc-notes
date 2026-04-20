import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
	resolveAssetUrl,
	revokeAssetUrl,
	selectAcceptedImageFiles,
	processImageFiles,
	clampImageProcessingConcurrency,
	DEFAULT_IMAGE_PROCESSING_CONCURRENCY,
	MAX_IMAGE_FILE_SIZE_BYTES
} from '../../../src/lib/editor/imageHandler';
import * as assetsRepository from '../../../src/lib/infrastructure/repositories';

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
		const cacheKeys = ['asset-1', 'asset-2', 'nonexistent'];
		cacheKeys.forEach((key) => {
			revokeAssetUrl(key);
		});
	});

	describe('selectAcceptedImageFiles', () => {
		it('should reject non-image files, oversize files, and files beyond the event limit', () => {
			const ok1 = new File(['ok1'], 'ok1.png', { type: 'image/png' });
			const ok2 = new File(['ok2'], 'ok2.png', { type: 'image/png' });
			const ok3 = new File(['ok3'], 'ok3.png', { type: 'image/png' });
			const tooMany = new File(['ok4'], 'ok4.png', { type: 'image/png' });
			const notImage = new File(['txt'], 'notes.txt', { type: 'text/plain' });
			const large = new File([new Uint8Array(MAX_IMAGE_FILE_SIZE_BYTES + 1)], 'large.png', {
				type: 'image/png'
			});

			const result = selectAcceptedImageFiles(
				[ok1, notImage, ok2, large, ok3, tooMany],
				{ maxFilesPerEvent: 3 }
			);

			expect(result.accepted.map((file) => file.name)).toEqual(['ok1.png', 'ok2.png', 'ok3.png']);
			expect(result.rejected).toHaveLength(3);
			expect(result.rejected.map((entry) => entry.file.name)).toEqual([
				'notes.txt',
				'large.png',
				'ok4.png'
			]);
		});
	});

	describe('processImageFiles', () => {
		it('should preserve original file order while respecting the concurrency limit', async () => {
			const files = [
				new File(['1'], 'first.png', { type: 'image/png' }),
				new File(['2'], 'second.png', { type: 'image/png' }),
				new File(['3'], 'third.png', { type: 'image/png' })
			];

			let inFlight = 0;
			let maxInFlight = 0;
			const delays = new Map([
				['first.png', 30],
				['second.png', 10],
				['third.png', 5]
			]);

			const results = await processImageFiles('note-1', files, {
				concurrency: 2,
				processor: async (_noteId, file) => {
					inFlight++;
					maxInFlight = Math.max(maxInFlight, inFlight);
					await new Promise((resolve) => setTimeout(resolve, delays.get(file.name) ?? 0));
					inFlight--;
					return `asset:${file.name}`;
				}
			});

			expect(maxInFlight).toBeLessThanOrEqual(2);
			expect(results.map((entry) => entry.file.name)).toEqual([
				'first.png',
				'second.png',
				'third.png'
			]);
			expect(results.map((entry) => entry.src)).toEqual([
				'asset:first.png',
				'asset:second.png',
				'asset:third.png'
			]);
		});

		it('should continue processing after individual file failures', async () => {
			const files = [
				new File(['1'], 'good-a.png', { type: 'image/png' }),
				new File(['2'], 'bad.png', { type: 'image/png' }),
				new File(['3'], 'good-b.png', { type: 'image/png' })
			];

			const results = await processImageFiles('note-1', files, {
				concurrency: 3,
				processor: async (_noteId, file) => {
					if (file.name === 'bad.png') {
						throw new Error('decode failed');
					}
					return `asset:${file.name}`;
				}
			});

			expect(results).toHaveLength(3);
			expect(results[0].src).toBe('asset:good-a.png');
			expect(results[1].error).toEqual(expect.any(Error));
			expect(results[2].src).toBe('asset:good-b.png');
		});
	});

	describe('clampImageProcessingConcurrency', () => {
		it('should default invalid values to the configured default', () => {
			expect(clampImageProcessingConcurrency(null)).toBe(DEFAULT_IMAGE_PROCESSING_CONCURRENCY);
			expect(clampImageProcessingConcurrency(0)).toBe(DEFAULT_IMAGE_PROCESSING_CONCURRENCY);
			expect(clampImageProcessingConcurrency(999)).toBe(DEFAULT_IMAGE_PROCESSING_CONCURRENCY);
		});

		it('should keep valid values', () => {
			expect(clampImageProcessingConcurrency(1)).toBe(1);
			expect(clampImageProcessingConcurrency(3)).toBe(3);
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

			const url1 = await resolveAssetUrl('asset-1');
			vi.mocked(assetsRepository.assetsRepository.get).mockClear();
			const url2 = await resolveAssetUrl('asset-1');

			expect(url1).toBe(url2);
			expect(assetsRepository.assetsRepository.get).not.toHaveBeenCalled();
		});
	});

	describe('revokeAssetUrl', () => {
		it('should remove URL from cache', async () => {
			const blob = new Blob(['image data'], { type: 'image/webp' });
			const asset = { id: 'asset-1', noteId: 'n1', mimeType: 'image/webp', data: blob };

			vi.mocked(assetsRepository.assetsRepository.get).mockResolvedValue(asset);

			const url = await resolveAssetUrl('asset-1');
			expect(url).toBeTruthy();

			revokeAssetUrl('asset-1');

			vi.mocked(assetsRepository.assetsRepository.get).mockClear();
			vi.mocked(assetsRepository.assetsRepository.get).mockResolvedValue(asset);

			await resolveAssetUrl('asset-1');
			expect(assetsRepository.assetsRepository.get).toHaveBeenCalled();
		});
	});
});
