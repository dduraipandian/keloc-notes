import { resetDatabase } from '$lib/infrastructure/idbr';

const STARTUP_RECOVERY_IMPORT_KEY = 'kelocnotes:startup-recovery:import-backup';

export function buildStartupRecoveryDiagnostics(error: unknown): string {
	const userAgent =
		typeof navigator !== 'undefined' && navigator.userAgent ? navigator.userAgent : 'unknown';
	const normalizedError = error instanceof Error ? error : new Error(String(error));

	const diagnostics = [
		'Keloc Notes startup failure',
		`Occurred at: ${new Date().toISOString()}`,
		`Error: ${normalizedError.message}`,
		`User agent: ${userAgent}`
	];

	if (normalizedError.stack) {
		diagnostics.push('', 'Stack trace:', normalizedError.stack);
	}

	return diagnostics.join('\n');
}

export async function copyStartupRecoveryDiagnostics(
	diagnostics: string,
	deps?: {
		writeText?: (text: string) => Promise<unknown>;
	}
) {
	const writer =
		deps?.writeText ??
		(typeof navigator !== 'undefined' && navigator.clipboard?.writeText
			? (text: string) => navigator.clipboard.writeText(text)
			: null);

	if (!writer) {
		throw new Error('Clipboard access is unavailable.');
	}

	await writer(diagnostics);
}

export function flagPendingStartupRecoveryImport(storage: Storage = sessionStorage) {
	storage.setItem(STARTUP_RECOVERY_IMPORT_KEY, '1');
}

export function consumePendingStartupRecoveryImport(storage: Storage = sessionStorage): boolean {
	const shouldImport = storage.getItem(STARTUP_RECOVERY_IMPORT_KEY) === '1';

	if (shouldImport) {
		storage.removeItem(STARTUP_RECOVERY_IMPORT_KEY);
	}

	return shouldImport;
}

export async function resetLocalDataForRecovery({
	resetDatabase: resetDatabaseImpl = resetDatabase,
	reload = () => window.location.reload(),
	importBackupAfterReset = false,
	storage = sessionStorage
}: {
	resetDatabase?: () => Promise<void>;
	reload?: () => void;
	importBackupAfterReset?: boolean;
	storage?: Storage;
} = {}) {
	if (importBackupAfterReset) {
		flagPendingStartupRecoveryImport(storage);
	} else {
		storage.removeItem(STARTUP_RECOVERY_IMPORT_KEY);
	}

	await resetDatabaseImpl();
	reload();
}
