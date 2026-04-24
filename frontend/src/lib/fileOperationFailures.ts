export type FileOperationKind =
	| 'markdown-note-export'
	| 'markdown-zip-export'
	| 'backup-export'
	| 'markdown-import'
	| 'backup-import';

type FileOperationFailureGuidance = {
	localNotes: string;
	fileStatus: string;
	retry: string;
};

const GUIDANCE: Record<FileOperationKind, FileOperationFailureGuidance> = {
	'markdown-note-export': {
		localNotes: 'Local notes were not changed.',
		fileStatus: 'The Markdown file may not have been written.',
		retry: 'You can retry the export after choosing a writable location.'
	},
	'markdown-zip-export': {
		localNotes: 'Local notes were not changed.',
		fileStatus: 'The Markdown ZIP file may not have been written.',
		retry: 'You can retry the export after choosing a writable location.'
	},
	'backup-export': {
		localNotes: 'Local notes were not changed.',
		fileStatus: 'The backup file may not have been written.',
		retry: 'You can retry the backup export after choosing a writable location.'
	},
	'markdown-import': {
		localNotes: 'Some notes may have changed if the failure happened after import actions started.',
		fileStatus: 'No app-created file is expected from this import.',
		retry:
			'You can retry the import, but review the notes list first if any notes were already created or overwritten.'
	},
	'backup-import': {
		localNotes: 'Local notes remain unchanged if the backup was invalid or restore failed.',
		fileStatus: 'No app-created file is expected from this import.',
		retry: 'You can retry with a valid JSON backup file.'
	}
};

function formatError(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

export function buildFileOperationFailureMessage(kind: FileOperationKind, error: unknown): string {
	const guidance = GUIDANCE[kind];

	return [
		`Error: ${formatError(error)}`,
		guidance.localNotes,
		guidance.fileStatus,
		guidance.retry,
		'Recovery guide: see the Security And Storage section in README.'
	].join('\n\n');
}
