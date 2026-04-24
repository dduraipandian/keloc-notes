import { describe, expect, it, vi } from 'vitest';
import { UIStateStore } from '$lib/stores/uiState.svelte';
import { runShutdownFlush } from '$lib/shutdownFlush';

describe('runShutdownFlush', () => {
	it('yields to the event loop so the shutdown overlay can paint before flushing', async () => {
		const uiState = new UIStateStore();
		const flushPendingWrites = vi.fn().mockResolvedValue(undefined);
		const emitFlushComplete = vi.fn();
		let timeoutCallback: (() => void) | null = null;

		vi.stubGlobal('setTimeout', vi.fn((cb: () => void) => {
			timeoutCallback = cb;
			return 1 as any;
		}));

		const runPromise = runShutdownFlush({
			uiState,
			flushPendingWrites,
			emitFlushComplete
		});

		await Promise.resolve();
		expect(uiState.shutdownFlushStatus?.active).toBe(true);
		expect(flushPendingWrites).not.toHaveBeenCalled();

		timeoutCallback?.();
		await runPromise;

		expect(flushPendingWrites).toHaveBeenCalledTimes(1);
		expect(emitFlushComplete).toHaveBeenCalledTimes(1);
	});

	it('shows shutdown save status until pending writes finish', async () => {
		const uiState = new UIStateStore();
		let resolveFlush!: () => void;
		let timeoutCallback: (() => void) | null = null;
		const flushPendingWrites = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					resolveFlush = resolve;
				})
		);
		const emitFlushComplete = vi.fn();
		vi.stubGlobal('setTimeout', vi.fn((cb: () => void) => {
			timeoutCallback = cb;
			return 1 as any;
		}));

		const runPromise = runShutdownFlush({
			uiState,
			flushPendingWrites,
			emitFlushComplete
		});

		expect(uiState.shutdownFlushStatus).toEqual({
			active: true,
			title: 'Saving your changes...',
			description: 'Please wait while Keloc Notes writes pending note updates to local storage.'
		});
		expect(emitFlushComplete).not.toHaveBeenCalled();
		await Promise.resolve();
		timeoutCallback?.();
		await Promise.resolve();
		await Promise.resolve();

		resolveFlush();
		await runPromise;

		expect(uiState.shutdownFlushStatus).toBeNull();
		expect(emitFlushComplete).toHaveBeenCalledTimes(1);
	});

	it('clears shutdown save status and emits completion even if flush rejects', async () => {
		const uiState = new UIStateStore();
		const emitFlushComplete = vi.fn();
		vi.stubGlobal('setTimeout', vi.fn((cb: () => void) => {
			cb();
			return 1 as any;
		}));

		await expect(
			runShutdownFlush({
				uiState,
				flushPendingWrites: vi.fn().mockRejectedValue(new Error('save failed')),
				emitFlushComplete
			})
		).resolves.toBeUndefined();

		expect(uiState.shutdownFlushStatus).toBeNull();
		expect(emitFlushComplete).toHaveBeenCalledTimes(1);
	});
});
