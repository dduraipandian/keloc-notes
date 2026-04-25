import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import {
	initDB,
	permanentDeleteFolderTransactionally,
	permanentDeleteNoteTransactionally,
	putNoteContent,
	putNoteMeta,
	putSetting,
	withTransaction
} from '$lib/infrastructure/idbr';

const DAY = 24 * 60 * 60 * 1000;

describe('deleted note backup retention', () => {
	beforeEach(async () => {
		await withTransaction(
			['folders', 'notes_meta', 'notes_contents', 'settings', 'backups', 'note_assets'],
			'readwrite',
			async (tx) => {
				await tx.objectStore('folders').clear!();
				await tx.objectStore('notes_meta').clear!();
				await tx.objectStore('notes_contents').clear!();
				await tx.objectStore('settings').clear!();
				await tx.objectStore('backups').clear!();
				await tx.objectStore('note_assets').clear!();
			}
		);
	});

	async function seedBackup(id: string, archivedAt: number) {
		const db = await initDB();
		await db.put('backups', {
			id,
			type: 'note',
			data: { id },
			path: 'Archive',
			archivedAt
		});
	}

	it('prunes note backups older than the configured retention window during permanent note delete', async () => {
		const now = Date.UTC(2026, 3, 25);
		await putSetting('backupRetentionDays', 7);
		await seedBackup('old-backup', now - 8 * DAY);
		await seedBackup('recent-backup', now - 6 * DAY);
		await putNoteMeta({ id: 'deleted-note', title: 'Deleted' });
		await putNoteContent('deleted-note', 'Deleted content');

		await permanentDeleteNoteTransactionally(
			{ id: 'deleted-note', title: 'Deleted' },
			'Projects / Deleted',
			now
		);

		const db = await initDB();
		expect(await db.get('backups', 'old-backup')).toBeUndefined();
		expect(await db.get('backups', 'recent-backup')).toBeDefined();
		expect(await db.get('backups', 'note_deleted-note')).toBeDefined();
	});

	it('uses the default 30-day retention when no setting is saved', async () => {
		const now = Date.UTC(2026, 3, 25);
		await seedBackup('old-backup', now - 31 * DAY);
		await seedBackup('recent-backup', now - 29 * DAY);
		await putNoteMeta({ id: 'deleted-note', title: 'Deleted' });
		await putNoteContent('deleted-note', 'Deleted content');

		await permanentDeleteNoteTransactionally(
			{ id: 'deleted-note', title: 'Deleted' },
			'Projects / Deleted',
			now
		);

		const db = await initDB();
		expect(await db.get('backups', 'old-backup')).toBeUndefined();
		expect(await db.get('backups', 'recent-backup')).toBeDefined();
	});

	it('prunes old backups during permanent folder delete', async () => {
		const now = Date.UTC(2026, 3, 25);
		await putSetting('backupRetentionDays', 7);
		await seedBackup('old-backup', now - 8 * DAY);
		await putNoteMeta({ id: 'deleted-note', title: 'Deleted' });
		await putNoteContent('deleted-note', 'Deleted content');

		await permanentDeleteFolderTransactionally(
			[{ note: { id: 'deleted-note', title: 'Deleted' }, path: 'Projects / Deleted' }],
			[{ id: 'folder-1', title: 'Folder', items: [] } as any],
			now
		);

		const db = await initDB();
		expect(await db.get('backups', 'old-backup')).toBeUndefined();
		expect(await db.get('backups', 'note_deleted-note')).toBeDefined();
	});
});
