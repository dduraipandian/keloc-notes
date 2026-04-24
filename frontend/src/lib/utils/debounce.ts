/**
 * A utility to manage multiple debounced function calls identified by keys.
 * Useful for per-item persistence logic (e.g., debouncing updates for multiple notes).
 */
export class KeyedDebouncer {
	private timers: Map<string, { timer: ReturnType<typeof setTimeout>; fn: () => void }> = new Map();

	/**
	 * Debounces a function call for a specific key.
	 * If a call for the same key is already pending, it's restarted.
	 */
	debounce(key: string, fn: () => void, delay: number) {
		this.cancel(key);
		const timer = setTimeout(() => {
			this.execute(key);
		}, delay);
		this.timers.set(key, { timer, fn });
	}

	/**
	 * Immediately executes a pending debounced call for a key and cancels its timer.
	 */
	flush(key: string) {
		const pending = this.timers.get(key);
		if (pending) {
			this.execute(key);
		}
	}

	/**
	 * Flushes all pending debounced calls.
	 */
	flushAll() {
		const keys = Array.from(this.timers.keys());
		keys.forEach((key) => this.flush(key));
	}

	/**
	 * Cancels a pending debounced call for a key without executing it.
	 */
	cancel(key: string) {
		const pending = this.timers.get(key);
		if (pending) {
			clearTimeout(pending.timer);
			this.timers.delete(key);
		}
	}

	clearAll() {
		const keys = Array.from(this.timers.keys());
		keys.forEach((key) => this.cancel(key));
	}

	private execute(key: string) {
		const pending = this.timers.get(key);
		if (pending) {
			clearTimeout(pending.timer);
			this.timers.delete(key);
			pending.fn();
		}
	}
}
