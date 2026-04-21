import { expect, test } from '@playwright/test';

function uniqueName(prefix: string) {
	return `${prefix}-${Math.floor(Math.random() * 1000)}`;
}

async function gotoApp(page: import('@playwright/test').Page) {
	const dbName = `keloc-notes-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`;
	await page.addInitScript(() => {
		window.localStorage.clear();
		window.sessionStorage.clear();
	}, {});
	await page.addInitScript((name: string) => {
		(window as Window & { __NOTES_DB_NAME__?: string }).__NOTES_DB_NAME__ = name;
	}, dbName);
	await page.goto('/');
	await expect(page.locator('html')).toHaveAttribute('data-app-ready', 'true');
}

function getNoteTitleInPane(page: import('@playwright/test').Page) {
	return page.locator('aside div[data-slot="item-title"]');
}

function getNotePaneTitle(page: import('@playwright/test').Page, title: string) {
	return page.locator('aside header h2').getByText(title, { exact: true });
}

function getNoteEditorTitle(page: import('@playwright/test').Page) {
	return page.locator('textarea[placeholder="Note Title"]');
}

function getSideBarFolderByLabel(page: import('@playwright/test').Page, label: string) {
	return page
		.locator('div[data-sidebar="content"] ul li[data-sidebar="menu-item"]')
		.locator('span.notes-folder-label')
		.filter({ has: page.getByText(label, { exact: true }) });
}

function getAlertDialog(page: import('@playwright/test').Page) {
	return page.locator('div[data-slot="alert-dialog-content"]');
}

async function createFolder(page: import('@playwright/test').Page, title: string) {
	await page.getByRole('button', { name: 'New Folder' }).click();
	const renameInput = page.locator('input:not([placeholder])');
	await expect(renameInput).toBeVisible();
	await renameInput.fill(title);
	await renameInput.press('Enter');
}

async function createNote(page: import('@playwright/test').Page, title: string, content?: string) {
	// Click New Note button
	await page.getByTitle('New Note').click();
	await page.waitForTimeout(100);

	// Wait for the note to be created and selected by checking if textarea becomes available
	const titleInput = page.locator('textarea[placeholder="Note Title"]').first();
	await titleInput.waitFor({ state: 'visible', timeout: 10000 });

	await titleInput.focus();
	await titleInput.fill(title);
	await page.waitForTimeout(200);

	if (content) {
		const bodyInput = page.locator('.ProseMirror').first();
		await bodyInput.waitFor({ state: 'visible', timeout: 5000 });
		await bodyInput.focus();
		await bodyInput.type(content);
		await page.waitForTimeout(200);
	}
}

async function deleteSelectedNote(page: import('@playwright/test').Page) {
	await page.getByTitle('Trash').click();
	await getAlertDialog(page).getByRole('button', { name: 'Delete Note' }).click();
}

test.describe('Note Recovery (Flat Model)', () => {
	test.beforeEach(async ({ page }) => {
		await gotoApp(page);
	});

	test('should recover a note to Home (Root) if its original folder was deleted', async ({
		page
	}) => {
		const folderName = uniqueName('DeletedParentFolder');
		const noteName = uniqueName('NoteToHome');

		// 1. Setup hierarchy
		await createFolder(page, folderName);
		await createNote(page, noteName, 'I should land in Home if my folder is gone.');

		// 2. Delete the folder (which contains the note)
		const folderEntry = getSideBarFolderByLabel(page, folderName);
		await folderEntry.click({ button: 'right' });
		await page.getByText('Delete', { exact: true }).click();
		await getAlertDialog(page).getByRole('button', { name: 'Delete Folder' }).click();

		// 3. Go to Trash ('Recently Deleted')
		await page.getByText('Recently Deleted', { exact: true }).click();

		// 4. Verify note is in Trash pane
		const noteInTrash = getNoteTitleInPane(page).getByText(noteName, { exact: true });
		await expect(noteInTrash).toBeVisible();

		// 5. Right-click restoration (THE CRASH SITE)
		await noteInTrash.click({ button: 'right' });
		await page.getByText('Restore', { exact: true }).click();

		// 6. Confirm restoration in dialog
		const restoreBtn = getAlertDialog(page).getByRole('button', { name: 'Restore' });
		await expect(restoreBtn).toBeVisible();
		await restoreBtn.click();

		// 7. Verify we STAY in trash and the note is removed from the trash list
		await expect(getNotePaneTitle(page, 'Recently Deleted')).toBeVisible();
		await expect(getNoteTitleInPane(page).getByText(noteName, { exact: true })).toBeHidden();

		// 8. Manually go to Home to verify the note was actually restored
		await page.getByText('Home', { exact: true }).first().click();
		await expect(getNotePaneTitle(page, 'Home')).toBeVisible();
		await expect(getNoteTitleInPane(page).getByText(noteName, { exact: true })).toBeVisible();
		await expect(getNoteEditorTitle(page)).toHaveValue(noteName);
	});

	test('should recover a note to its original folder if the folder is still active', async ({
		page
	}) => {
		const folderName = uniqueName('ActiveFolder');
		const noteName = uniqueName('NoteToFolder');

		// 1. Setup
		await createFolder(page, folderName);
		await createNote(page, noteName, 'I should return to my folder.');

		// 2. Delete only the note
		await deleteSelectedNote(page);

		// 3. Go to Trash
		await page.getByText('Recently Deleted', { exact: true }).click();
		const noteInTrash = getNoteTitleInPane(page).getByText(noteName, { exact: true });
		await expect(noteInTrash).toBeVisible();

		// 4. Restore
		await noteInTrash.click({ button: 'right' });
		await page.getByText('Restore', { exact: true }).click();
		await getAlertDialog(page).getByRole('button', { name: 'Restore' }).click();

		// 5. Verify we STAY in trash and note is removed
		await expect(getNotePaneTitle(page, 'Recently Deleted')).toBeVisible();
		await expect(getNoteTitleInPane(page).getByText(noteName, { exact: true })).toBeHidden();

		// 6. Manually visit folder to verify restoration
		await getSideBarFolderByLabel(page, folderName).click();
		await expect(getNotePaneTitle(page, folderName)).toBeVisible();
		await expect(getNoteEditorTitle(page)).toHaveValue(noteName);
	});
});
