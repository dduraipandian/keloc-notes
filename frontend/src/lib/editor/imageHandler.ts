import { assetsRepository } from '$lib/infrastructure/repositories';

const MAX_WIDTH = 1920;
const WEBP_QUALITY = 0.85;

/** Resize image to max 1920px wide, convert to WebP. */
export async function resizeImage(file: File): Promise<Blob> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		const objectUrl = URL.createObjectURL(file);

		img.onload = () => {
			URL.revokeObjectURL(objectUrl);

			let { width, height } = img;
			if (width > MAX_WIDTH) {
				height = Math.round((height * MAX_WIDTH) / width);
				width = MAX_WIDTH;
			}

			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			const ctx = canvas.getContext('2d');
			if (!ctx) {
				reject(new Error('Canvas unavailable'));
				return;
			}
			ctx.drawImage(img, 0, 0, width, height);
			canvas.toBlob(
				(blob) => (blob ? resolve(blob) : reject(new Error('toBlob returned null'))),
				'image/webp',
				WEBP_QUALITY
			);
		};

		img.onerror = () => {
			URL.revokeObjectURL(objectUrl);
			reject(new Error('Image load failed'));
		};
		img.src = objectUrl;
	});
}

/**
 * Resize, persist to IndexedDB, return `asset:<uuid>` src string.
 * Use this src value directly in editor image nodes.
 */
export async function storeImageAsset(noteId: string, file: File): Promise<string> {
	const blob = await resizeImage(file);
	const id = crypto.randomUUID();
	await assetsRepository.save({ id, noteId, mimeType: 'image/webp', data: blob });
	return `asset:${id}`;
}

// ── Object URL cache ──────────────────────────────────────────────────────────
// One entry per asset ID; revoked when the editor that owns the note is destroyed.

const urlCache = new Map<string, string>();

/** Resolve an `asset:uuid` string to an object URL for rendering. */
export async function resolveAssetUrl(assetId: string): Promise<string | null> {
	if (urlCache.has(assetId)) return urlCache.get(assetId)!;
	const asset = await assetsRepository.get(assetId);
	if (!asset) return null;
	const url = URL.createObjectURL(asset.data);
	urlCache.set(assetId, url);
	return url;
}

/** Revoke a specific object URL and remove from cache. */
export function revokeAssetUrl(assetId: string): void {
	const url = urlCache.get(assetId);
	if (url) {
		URL.revokeObjectURL(url);
		urlCache.delete(assetId);
	}
}
