import { describe, expect, it } from 'vitest';
import {
	buildFileOperationFailureMessage,
	type FileOperationKind
} from '$lib/fileOperationFailures';

describe('file operation failure guidance', () => {
	const cases: Array<{
		kind: FileOperationKind;
		expectedLocalNotes: string;
		expectedFile: string;
	}> = [
		{
			kind: 'markdown-note-export',
			expectedLocalNotes: 'Local notes were not changed.',
			expectedFile: 'The Markdown file may not have been written.'
		},
		{
			kind: 'markdown-zip-export',
			expectedLocalNotes: 'Local notes were not changed.',
			expectedFile: 'The Markdown ZIP file may not have been written.'
		},
		{
			kind: 'backup-export',
			expectedLocalNotes: 'Local notes were not changed.',
			expectedFile: 'The backup file may not have been written.'
		},
		{
			kind: 'markdown-import',
			expectedLocalNotes:
				'Some notes may have changed if the failure happened after import actions started.',
			expectedFile: 'No app-created file is expected from this import.'
		},
		{
			kind: 'backup-import',
			expectedLocalNotes:
				'Local notes remain unchanged if the backup was invalid or restore failed.',
			expectedFile: 'No app-created file is expected from this import.'
		}
	];

	it.each(cases)(
		'answers local-data, file, and retry questions for $kind failures',
		({ kind, expectedLocalNotes, expectedFile }) => {
			const message = buildFileOperationFailureMessage(kind, new Error('permission denied'));

			expect(message).toContain('permission denied');
			expect(message).toContain(expectedLocalNotes);
			expect(message).toContain(expectedFile);
			expect(message).toContain('You can retry');
		}
	);
});
