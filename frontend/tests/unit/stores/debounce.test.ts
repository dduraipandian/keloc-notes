import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KeyedDebouncer } from '../../../src/lib/utils/debounce';

describe('KeyedDebouncer', () => {
	let debouncer: KeyedDebouncer;

	beforeEach(() => {
		vi.useFakeTimers();
		debouncer = new KeyedDebouncer();
	});

	it('should debounce calls per key', () => {
		const fn1 = vi.fn();
		const fn2 = vi.fn();

		debouncer.debounce('k1', fn1, 100);
		debouncer.debounce('k2', fn2, 100);

		vi.advanceTimersByTime(50);
		expect(fn1).not.toHaveBeenCalled();
		expect(fn2).not.toHaveBeenCalled();

		vi.advanceTimersByTime(50);
		expect(fn1).toHaveBeenCalledTimes(1);
		expect(fn2).toHaveBeenCalledTimes(1);
	});

	it('should restart timer if called again for the same key', () => {
		const fn = vi.fn();

		debouncer.debounce('k1', fn, 100);
		vi.advanceTimersByTime(50);
		debouncer.debounce('k1', fn, 100);
		vi.advanceTimersByTime(70);
		
		expect(fn).not.toHaveBeenCalled();

		vi.advanceTimersByTime(30);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('should flush a specific key immediately', () => {
		const fn = vi.fn();

		debouncer.debounce('k1', fn, 100);
		debouncer.flush('k1');

		expect(fn).toHaveBeenCalledTimes(1);
		
		vi.advanceTimersByTime(100);
		expect(fn).toHaveBeenCalledTimes(1); // Should not call again
	});

	it('should flush all keys', () => {
		const fn1 = vi.fn();
		const fn2 = vi.fn();

		debouncer.debounce('k1', fn1, 100);
		debouncer.debounce('k2', fn2, 100);
		debouncer.flushAll();

		expect(fn1).toHaveBeenCalledTimes(1);
		expect(fn2).toHaveBeenCalledTimes(1);
	});

	it('should cancel a pending call', () => {
		const fn = vi.fn();

		debouncer.debounce('k1', fn, 100);
		debouncer.cancel('k1');

		vi.advanceTimersByTime(100);
		expect(fn).not.toHaveBeenCalled();
	});
});
