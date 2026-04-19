import { describe, it, expect, beforeEach, vi } from 'vitest';
import { assetsRepository } from '../../../src/lib/infrastructure/repositories';
import * as idbr from '../../../src/lib/infrastructure/idbr';

vi.mock('../../../src/lib/infrastructure/idbr', () => ({
	putNoteAsset: vi.fn(),
	getNoteAsset: vi.fn(),
	deleteNoteAsset: vi.fn(),
	deleteNoteAssetsByNoteId: vi.fn()
}));

describe('assetsRepository', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('save()', () => {
		it('should call putNoteAsset with the asset', async () => {
			const blob = new Blob(['test'], { type: 'image/webp' });
			const asset = {
				id: 'asset-1',
				noteId: 'n1',
				mimeType: 'image/webp',
				data: blob
			};

			await assetsRepository.save(asset);

			expect(idbr.putNoteAsset).toHaveBeenCalledWith(asset);
		});

		it('should return the result from putNoteAsset', async () => {
			const blob = new Blob(['test'], { type: 'image/webp' });
			const asset = {
				id: 'asset-1',
				noteId: 'n1',
				mimeType: 'image/webp',
				data: blob
			};

			vi.mocked(idbr.putNoteAsset).mockResolvedValue(undefined);

			const result = await assetsRepository.save(asset);

			expect(result).toBeUndefined();
		});
	});

	describe('get()', () => {
		it('should call getNoteAsset with the asset id', async () => {
			await assetsRepository.get('asset-1');

			expect(idbr.getNoteAsset).toHaveBeenCalledWith('asset-1');
		});

		it('should return the asset from getNoteAsset', async () => {
			const blob = new Blob(['test'], { type: 'image/webp' });
			const expectedAsset = {
				id: 'asset-1',
				noteId: 'n1',
				mimeType: 'image/webp',
				data: blob
			};

			vi.mocked(idbr.getNoteAsset).mockResolvedValue(expectedAsset);

			const result = await assetsRepository.get('asset-1');

			expect(result).toEqual(expectedAsset);
		});

		it('should return undefined if asset not found', async () => {
			vi.mocked(idbr.getNoteAsset).mockResolvedValue(undefined);

			const result = await assetsRepository.get('nonexistent');

			expect(result).toBeUndefined();
		});
	});

	describe('delete()', () => {
		it('should call deleteNoteAsset with the asset id', async () => {
			await assetsRepository.delete('asset-1');

			expect(idbr.deleteNoteAsset).toHaveBeenCalledWith('asset-1');
		});
	});

	describe('deleteByNoteId()', () => {
		it('should call deleteNoteAssetsByNoteId with the note id', async () => {
			await assetsRepository.deleteByNoteId('n1');

			expect(idbr.deleteNoteAssetsByNoteId).toHaveBeenCalledWith('n1');
		});
	});
});
