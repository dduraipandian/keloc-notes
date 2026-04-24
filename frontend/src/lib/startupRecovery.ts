import { resetDatabase } from '$lib/infrastructure/idbr';

const STARTUP_RECOVERY_IMPORT_KEY = 'kelocnotes:startup-recovery:import-backup';

export type StartupRecoveryKind =
	| 'blocked-upgrade'
	| 'storage-corruption'
	| 'storage-unavailable'
	| 'unknown';

export type StartupRecoveryGuidance = {
	kind: StartupRecoveryKind;
	summary: string;
	dataStatus: string;
	primaryAction: string;
	resetWarning: string;
	appReset: boolean;
};

export type StartupRecoveryResetResult = 'cancelled' | 'reset';

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export function buildStartupRecoveryGuidance(error: unknown): StartupRecoveryGuidance {
	const message = getErrorMessage(error);
	const normalized = message.toLowerCase();

	if (
		normalized.includes('blocked') ||
		(normalized.includes('another') && normalized.includes('window'))
	) {
		return {
			kind: 'blocked-upgrade',
			summary:
				'Keloc Notes is temporarily blocked from opening because another Keloc Notes window is holding a database upgrade.',
			dataStatus:
				'Your notes are likely still intact. This is not a local data corruption warning; the database is busy in another app window.',
			primaryAction:
				'Close every other Keloc Notes window, then choose Retry Startup or restart the app.',
			resetWarning: '',
			appReset: false
		};
	}

	if (
		normalized.includes('corrupt') ||
		normalized.includes('unknownerror') ||
		normalized.includes('dataerror') ||
		normalized.includes('invalidstateerror')
	) {
		return {
			kind: 'storage-corruption',
			summary: 'Keloc Notes could not read the local notes database.',
			dataStatus:
				'Keloc Notes cannot confirm whether the local database is recoverable from this startup attempt.',
			primaryAction:
				'Try Retry Startup first. If it fails again, copy diagnostics and restore from a known-good backup after reset.',
			resetWarning:
				'Before reset, Keloc Notes will ask you to export a backup copy to a file. Reset Local Data removes the local database on this device if you proceed.',
			appReset: true
		};
	}

	if (
		normalized.includes('quota') ||
		normalized.includes('indexeddb') ||
		normalized.includes('database')
	) {
		return {
			kind: 'storage-unavailable',
			summary: 'Keloc Notes could not access browser storage for the local notes database.',
			dataStatus:
				'Your existing notes may still be present, but Keloc Notes cannot safely open them right now.',
			primaryAction:
				'Try Retry Startup. If the problem continues, copy diagnostics before choosing a reset option.',
			resetWarning:
				'Before reset, Keloc Notes will ask you to export a backup copy to a file. Reset Local Data removes the local database on this device if you proceed.',
			appReset: true
		};
	}

	return {
		kind: 'unknown',
		summary: 'Keloc Notes could not open your library.',
		dataStatus: 'Your existing local data has not been modified by this failed startup attempt.',
		primaryAction:
			'Try Retry Startup. If the problem continues, copy diagnostics before choosing a reset option.',
		resetWarning:
			'Before reset, Keloc Notes will ask you to export a backup copy to a file. Reset Local Data removes the local database on this device if you proceed.',
		appReset: true
	};
}

export function buildDatabaseBlockedMessage(
	currentVersion: number | undefined,
	blockedVersion: number | null
): string {
	const current = currentVersion ?? 'unknown';
	const target = blockedVersion ?? 'unknown';

	return `Another Keloc Notes window is blocking a database upgrade (current: ${current}, target: ${target}). Your notes are likely still intact. Close every other Keloc Notes window, then restart Keloc Notes or retry startup. Do not reset local data unless retry still fails after the other window is closed.`;
}

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

export async function exportBackupAndResetLocalDataForRecovery({
	exportBackupJson,
	saveBackupFile,
	resetDatabase: resetDatabaseImpl = resetDatabase,
	reload = () => window.location.reload(),
	importBackupAfterReset = false,
	storage = sessionStorage
}: {
	exportBackupJson: () => Promise<string>;
	saveBackupFile: (content: string) => Promise<boolean>;
	resetDatabase?: () => Promise<void>;
	reload?: () => void;
	importBackupAfterReset?: boolean;
	storage?: Storage;
}): Promise<StartupRecoveryResetResult> {
	const backupJson = await exportBackupJson();
	const backupSaved = await saveBackupFile(backupJson);

	if (!backupSaved) {
		return 'cancelled';
	}

	await resetLocalDataForRecovery({
		resetDatabase: resetDatabaseImpl,
		reload,
		importBackupAfterReset,
		storage
	});

	return 'reset';
}
