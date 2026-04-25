export const DEFAULT_BACKUP_RETENTION_DAYS = 30;
export const BACKUP_RETENTION_OPTIONS_DAYS = [7, 30, 90, 180] as const;

export type BackupRetentionDays = (typeof BACKUP_RETENTION_OPTIONS_DAYS)[number];

export function normalizeBackupRetentionDays(value: unknown): BackupRetentionDays {
	return BACKUP_RETENTION_OPTIONS_DAYS.includes(value as BackupRetentionDays)
		? (value as BackupRetentionDays)
		: DEFAULT_BACKUP_RETENTION_DAYS;
}
