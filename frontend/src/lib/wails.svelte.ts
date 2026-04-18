/**
 * Check if the Wails runtime is available.
 * This helps guard native calls in browser-only environments (like e2e tests).
 */
export function hasWailsRuntime(): boolean {
	return (
		typeof window !== 'undefined' &&
		typeof (window as any).runtime !== 'undefined'
	);
}
