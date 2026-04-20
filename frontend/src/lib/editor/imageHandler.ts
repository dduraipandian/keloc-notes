import { assetsRepository } from '$lib/infrastructure/repositories';

const MAX_WIDTH = 1920;
const WEBP_QUALITY = 0.85;
const MAX_IMAGE_PIXELS = 16_000_000;
export const MAX_IMAGE_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGES_PER_EVENT = 5;
export const DEFAULT_IMAGE_PROCESSING_CONCURRENCY = 3;
export const MAX_IMAGE_PROCESSING_CONCURRENCY = 6;

export function clampImageProcessingConcurrency(value: number | null | undefined): number {
	if (
		typeof value === 'number' &&
		Number.isInteger(value) &&
		value >= 1 &&
		value <= MAX_IMAGE_PROCESSING_CONCURRENCY
	) {
		return value;
	}

	return DEFAULT_IMAGE_PROCESSING_CONCURRENCY;
}

export function selectAcceptedImageFiles(
	files: File[],
	{ maxFilesPerEvent = MAX_IMAGES_PER_EVENT }: { maxFilesPerEvent?: number } = {}
): {
	accepted: File[];
	rejected: Array<{ file: File; reason: string }>;
} {
	const accepted: File[] = [];
	const rejected: Array<{ file: File; reason: string }> = [];

	for (const file of files) {
		if (!file.type.startsWith('image/')) {
			rejected.push({ file, reason: 'Only image files can be inserted.' });
			continue;
		}

		if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
			rejected.push({
				file,
				reason: `File exceeds the ${Math.round(MAX_IMAGE_FILE_SIZE_BYTES / 1024 / 1024)} MB limit.`
			});
			continue;
		}

		if (accepted.length >= maxFilesPerEvent) {
			rejected.push({
				file,
				reason: `You can insert up to ${maxFilesPerEvent} images at a time.`
			});
			continue;
		}

		accepted.push(file);
	}

	return { accepted, rejected };
}

/** Resize image to max 1920px wide, convert to WebP. */
export async function resizeImage(file: File): Promise<Blob> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		const objectUrl = URL.createObjectURL(file);

		img.onload = () => {
			URL.revokeObjectURL(objectUrl);

			let { width, height } = img;
			if (width * height > MAX_IMAGE_PIXELS) {
				reject(new Error('Image dimensions are too large to process.'));
				return;
			}
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

export async function processImageFiles(
	noteId: string,
	files: File[],
	{
		concurrency = DEFAULT_IMAGE_PROCESSING_CONCURRENCY,
		processor = storeImageAsset
	}: {
		concurrency?: number;
		processor?: (noteId: string, file: File) => Promise<string>;
	} = {}
): Promise<Array<{ file: File; src?: string; error?: Error }>> {
	const normalizedConcurrency = Math.min(
		clampImageProcessingConcurrency(concurrency),
		Math.max(files.length, 1)
	);
	const results: Array<{ file: File; src?: string; error?: Error }> = new Array(files.length);
	let nextIndex = 0;

	async function worker() {
		while (nextIndex < files.length) {
			const currentIndex = nextIndex++;
			const file = files[currentIndex];
			try {
				const src = await processor(noteId, file);
				results[currentIndex] = { file, src };
			} catch (error) {
				results[currentIndex] = {
					file,
					error: error instanceof Error ? error : new Error(String(error))
				};
			}
		}
	}

	await Promise.all(Array.from({ length: normalizedConcurrency }, () => worker()));

	return results;
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
