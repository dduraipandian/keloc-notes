import type { UIStateStore } from '$lib/stores/uiState.svelte';

async function yieldForOverlayPaint() {
	await Promise.resolve();
	await new Promise<void>((resolve) => {
		setTimeout(() => resolve(), 32);
	});
}

export async function runShutdownFlush({
	uiState,
	flushPendingWrites,
	emitFlushComplete
}: {
	uiState: UIStateStore;
	flushPendingWrites: () => Promise<void>;
	emitFlushComplete: () => void;
}) {
	uiState.showShutdownFlushStatus(
		'Saving your changes...',
		'Please wait while Keloc Notes writes pending note updates to local storage.'
	);

	try {
		await yieldForOverlayPaint();
		await flushPendingWrites();
	} catch {
		// Persistence errors are surfaced by the store's onPersistError handlers.
		// The shutdown path still needs to settle and signal completion.
	} finally {
		uiState.clearShutdownFlushStatus();
		emitFlushComplete();
	}
}
