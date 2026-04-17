import { expect, test } from '@playwright/test';

function uniqueName(prefix: string) {
	return `${prefix}-${Math.floor(Math.random() * 1000)}`;
}

async function gotoApp(page: import('@playwright/test').Page) {
	const dbName = `mdnotes-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`;
	await page.addInitScript(() => {
		window.localStorage.clear();
		window.sessionStorage.clear();
	}, {});
	await page.addInitScript((name: string) => {
		(window as Window & { __MDNOTES_DB_NAME__?: string }).__MDNOTES_DB_NAME__ = name;
	}, dbName);
	await page.goto('/');
	await expect(page.locator('html')).toHaveAttribute('data-app-ready', 'true');
}

function getSideBarContent(page: import('@playwright/test').Page) {
	return page.locator('div[data-sidebar="content"] ul li[data-sidebar="menu-item"]');
}

function getSideBarFolderByLabel(page: import('@playwright/test').Page, label: string) {
	return getSideBarContent(page)
		.locator('span.notes-folder-label')
		.filter({ has: page.getByText(label, { exact: true }) });
}

function getNotePaneTitle(page: import('@playwright/test').Page, title: string) {
	return page.locator('aside header h2').getByText(title, { exact: true });
}

function getNoteEditorTitle(page: import('@playwright/test').Page) {
	return page.getByRole('textbox', { name: 'Note Title' });
}

function getNoteTitleInPane(page: import('@playwright/test').Page) {
	return page.locator('aside div[data-slot="item-title"]');
}

function getTrashFolder(page: import('@playwright/test').Page) {
	return page.locator('div[data-sidebar="header"] ul li[data-sidebar="menu-item"]');
}

function getHeaderSidebarItem(page: import('@playwright/test').Page, label: string) {
	return page
		.locator('div[data-sidebar="header"] .notes-folder-label')
		.filter({ hasText: label })
		.first();
}

function getAlertDialog(page: import('@playwright/test').Page) {
	return page.locator('div[data-slot="alert-dialog-content"]');
}

async function createFolder(page: import('@playwright/test').Page, title: string) {
	await page.getByRole('button', { name: 'New Folder' }).click();

	const renameInput = page.locator('input:not([placeholder])');
	await expect(renameInput).toBeVisible();
	await expect(renameInput).toHaveValue('New Folder');

	await renameInput.fill(title);
	await renameInput.press('Enter');

	await expect(getSideBarFolderByLabel(page, title)).toBeVisible();
	await expect(getNotePaneTitle(page, title)).toBeVisible();
}

async function createNote(page: import('@playwright/test').Page, title: string, content?: string) {
	await page.getByTitle('New Note').click();

	const titleInput = page.getByPlaceholder('Note Title');
	await expect(titleInput).toBeVisible();
	await titleInput.fill(title);

	if (content) {
		const bodyInput = page.getByPlaceholder('Start writing...');
		await bodyInput.fill(content);
	}

	await expect(getNoteEditorTitle(page)).toHaveValue(title);
}

async function openFolder(page: import('@playwright/test').Page, title: string) {
	await getSideBarContent(page).getByText(title, { exact: true }).click();
	await expect(getNotePaneTitle(page, title)).toBeVisible();
}

async function deleteSelectedNote(page: import('@playwright/test').Page) {
	await page.getByTitle('Trash').click();
	await expect(getAlertDialog(page).getByRole('heading', { name: 'Delete Note' })).toBeVisible();
	await getAlertDialog(page).getByRole('button', { name: 'Delete Note' }).click();
}

async function deleteFolder(page: import('@playwright/test').Page, title: string) {
	const folderEntry = getSideBarFolderByLabel(page, title);
	await folderEntry.click({ button: 'right' });
	await page.getByText('Delete', { exact: true }).click();
	await expect(getAlertDialog(page).getByRole('heading', { name: 'Delete Folder' })).toBeVisible();
	await getAlertDialog(page).getByRole('button', { name: 'Delete Folder' }).click();
	await expect(getAlertDialog(page)).toBeHidden();
}

async function addFolderToFavorites(page: import('@playwright/test').Page, title: string) {
	const folderEntry = getSideBarFolderByLabel(page, title);
	await folderEntry.click({ button: 'right' });
	await page.getByText('Add To Favorites', { exact: true }).click();
}

async function addSelectedNoteToFavorites(page: import('@playwright/test').Page, title: string) {
	await getNoteTitleInPane(page).getByText(title, { exact: true }).click({ button: 'right' });
	await page.getByText('Add To Favorites', { exact: true }).click();
}

async function openFavorites(page: import('@playwright/test').Page) {
	await getTrashFolder(page).getByText('Favorites', { exact: true }).click();
	await expect(getNotePaneTitle(page, 'Favorites')).toBeVisible();
}

test('can create and rename a folder from the sidebar', async ({ page }) => {
	await gotoApp(page);

	const folderTitle = uniqueName('Playwright Folder');
	await createFolder(page, folderTitle);
});

test('can create a note in the selected folder', async ({ page }) => {
	await gotoApp(page);

	const folderTitle = uniqueName('Notes Folder');
	const noteTitle = uniqueName('Playwright Note');
	await createFolder(page, folderTitle);
	await createNote(page, noteTitle, 'Created from Playwright.');

	await expect(page.getByPlaceholder('Note Title')).toHaveValue(noteTitle);
	await expect(page.getByText(noteTitle, { exact: true })).toBeVisible();
});

test('selecting a folder shows its first visible note', async ({ page }) => {
	await gotoApp(page);

	const folderTitle = uniqueName('Folder First Note');
	const olderNoteTitle = uniqueName('Older Note');
	const newerNoteTitle = uniqueName('Newer Note');
	const otherFolderTitle = uniqueName('Other Folder');

	await createFolder(page, folderTitle);
	await createNote(page, olderNoteTitle, 'Older content');
	await createNote(page, newerNoteTitle, 'Newer content');

	await createFolder(page, otherFolderTitle);
	await openFolder(page, folderTitle);

	await expect(getNoteEditorTitle(page)).toHaveValue(newerNoteTitle);
	await expect(getNoteTitleInPane(page).first()).toContainText(newerNoteTitle);
});

test('deleting the selected note selects the next visible note and updates the editor', async ({
	page
}) => {
	await gotoApp(page);

	const folderTitle = uniqueName('Delete Note Folder');
	const fallbackNoteTitle = uniqueName('Fallback Note');
	const selectedNoteTitle = uniqueName('Selected Note');
	const fallbackContent = 'This note should be selected after delete.';

	await createFolder(page, folderTitle);
	await createNote(page, fallbackNoteTitle, fallbackContent);
	await createNote(page, selectedNoteTitle, 'Delete me');

	await expect(getNoteEditorTitle(page)).toHaveValue(selectedNoteTitle);
	await deleteSelectedNote(page);

	await expect(getNoteEditorTitle(page)).toHaveValue(fallbackNoteTitle);
	await expect(page.getByPlaceholder('Start writing...')).toHaveValue(fallbackContent);
	await expect(getNotePaneTitle(page, folderTitle)).toBeVisible();
});

test('deleting the selected folder selects the next folder', async ({ page }) => {
	await gotoApp(page);

	const parentFolderTitle = uniqueName('Parent Folder');
	const nextFolderTitle = uniqueName('Next Folder');
	const nextFolderNoteTitle = uniqueName('Next Folder Note');
	const deletedFolderTitle = uniqueName('Deleted Folder');

	await createFolder(page, parentFolderTitle);
	await createFolder(page, nextFolderTitle);
	await createNote(page, nextFolderNoteTitle, 'Next folder content');

	await openFolder(page, parentFolderTitle);
	await createFolder(page, deletedFolderTitle);
	await expect(getNotePaneTitle(page, deletedFolderTitle)).toBeVisible();

	await deleteFolder(page, deletedFolderTitle);

	await expect(getSideBarFolderByLabel(page, deletedFolderTitle)).toBeHidden();
	await expect(getNotePaneTitle(page, nextFolderTitle)).toBeVisible();
	await expect(getNoteEditorTitle(page)).toHaveValue(nextFolderNoteTitle);
});

test('can soft delete and recover a note from trash', async ({ page }) => {
	await gotoApp(page);

	const noteTitle = uniqueName('Recoverable Note');
	await createNote(page, noteTitle, 'This note will be deleted and restored.');

	await page.getByTitle('Trash').click();
	await expect(page.getByRole('heading', { name: 'Delete Note' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Delete Note' })).toBeVisible();
	await expect(page.locator('div[data-slot="alert-dialog-description"]')).toContainText(noteTitle);

	await page.getByRole('button', { name: 'Delete Note' }).click();

	await page.getByText('Recently Deleted', { exact: true }).click();
	await page.getByText(noteTitle, { exact: true }).click();

	await expect(
		page.getByText('This note is in the Trash. Restore it to edit.', { exact: true })
	).toBeVisible();

	await page.getByRole('button', { name: 'Restore Note' }).click();
	await page
		.locator('div[data-slot="alert-dialog-content"]')
		.getByRole('button', { name: 'Restore' })
		.click();

	await expect(
		page.getByText('This note is in the Trash. Restore it to edit.', { exact: true })
	).toBeHidden();

	// Verify STAY in trash
	await expect(getNotePaneTitle(page, 'Recently Deleted')).toBeVisible();
	await expect(getNoteTitleInPane(page).getByText(noteTitle, { exact: true })).toBeHidden();

	// Verify it's back in Home
	await page.getByText('Home', { exact: true }).first().click();
	await expect(getNotePaneTitle(page, 'Home')).toBeVisible();
	await expect(getNoteEditorTitle(page)).toHaveValue(noteTitle);
});

test('recovering a note re-selects the proper folder and note', async ({ page }) => {
	await gotoApp(page);

	const folderTitle = uniqueName('Recover Note Folder');
	const noteTitle = uniqueName('Recover Selected Note');

	await createFolder(page, folderTitle);
	await createNote(page, noteTitle, 'Return me to the original folder.');
	await deleteSelectedNote(page);

	await page.getByText('Recently Deleted', { exact: true }).click();
	await page.getByText(noteTitle, { exact: true }).click();
	await page.getByRole('button', { name: 'Restore Note' }).click();
	await page
		.locator('div[data-slot="alert-dialog-content"]')
		.getByRole('button', { name: 'Restore' })
		.click();

	// 5. Verify we STAY in trash after restore
	await expect(getNotePaneTitle(page, 'Recently Deleted')).toBeVisible();
	await expect(getNoteTitleInPane(page).getByText(noteTitle, { exact: true })).toBeHidden();

	// 6. Manually verify it's back in the folder
	await getSideBarFolderByLabel(page, folderTitle).click();
	await expect(getNotePaneTitle(page, folderTitle)).toBeVisible();
	await expect(getNoteEditorTitle(page)).toHaveValue(noteTitle);
});

test('can soft delete and recover a folder from trash', async ({ page }) => {
	await gotoApp(page);

	const folderTitle = uniqueName('Recoverable Folder');
	await createFolder(page, folderTitle);

	const folderEntry = getSideBarFolderByLabel(page, folderTitle);

	await folderEntry.click({ button: 'right' });
	await page.getByText('Delete', { exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Delete Folder' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Delete Folder' })).toBeVisible();
	await page.getByRole('button', { name: 'Delete Folder' }).click();

	await page.getByText('Recently Deleted', { exact: true }).click();
	const deletedFolderEntry = getTrashFolder(page).getByText(folderTitle, { exact: true });
	await page.locator('.custom-scrollbar').click();
	await expect(deletedFolderEntry).toBeVisible();

	await deletedFolderEntry.click({
		button: 'right'
	});
	await page.getByText('Recover Folder', { exact: true }).click();

	await expect(getSideBarContent(page).getByText(folderTitle, { exact: true })).toBeVisible();
});

test('complex soft delete and recover a folder from trash', async ({ page }) => {
	await gotoApp(page);

	const parentFolderTitle = uniqueName('Parent Folder');
	const subFolderTitle = uniqueName('Sub Folder');
	const subSubFolderTitle = uniqueName('Sub Sub Folder');
	const subSubFolderNoteTitle = uniqueName('Sub Sub Folder Note');
	const subSubSubFolderTitle = uniqueName('Sub Sub Sub Folder');
	const subSubSubFolderNoteTitle = uniqueName('Sub Sub Sub Folder Note');

	await createFolder(page, parentFolderTitle);
	await createFolder(page, subFolderTitle);
	await createFolder(page, subSubFolderTitle);
	await createNote(page, subSubFolderNoteTitle, 'Sub Sub Folder Note');
	await createFolder(page, subSubSubFolderTitle);
	await createNote(page, subSubSubFolderNoteTitle, 'Sub Sub Sub Folder Note');

	await openFolder(page, subSubFolderTitle);
	await openFolder(page, subSubFolderTitle);
	await deleteSelectedNote(page);

	await openFolder(page, subFolderTitle);
	const folderEntry = getSideBarFolderByLabel(page, subFolderTitle);

	await folderEntry.click({ button: 'right' });
	await page.getByText('Delete', { exact: true }).click();
	await page.getByRole('button', { name: 'Delete Folder' }).click();

	await page.getByText('Recently Deleted', { exact: true }).click();
	await expect(getNoteTitleInPane(page).getByText(subSubFolderNoteTitle)).toBeVisible();

	const deletedFolderEntry = getTrashFolder(page).getByText(subFolderTitle, { exact: true });
	await expect(deletedFolderEntry).toBeVisible();
	await deletedFolderEntry.click({
		button: 'right'
	});
	await page.getByText('Recover Folder', { exact: true }).click();

	await expect(getSideBarContent(page).getByText(subFolderTitle, { exact: true })).toBeVisible();
});

test('can favorite a note and see it in the Favorites virtual view', async ({ page }) => {
	await page.goto('/');

	const folderTitle = uniqueName('Favorites Folder');
	const noteTitle = uniqueName('Favorite Note');

	await createFolder(page, folderTitle);
	await createNote(page, noteTitle, 'Starred note content.');
	await addSelectedNoteToFavorites(page, noteTitle);

	await page.getByText('Favorites', { exact: true }).click();

	await expect(getNotePaneTitle(page, 'Favorites')).toBeVisible();
	await expect(page.getByText(noteTitle, { exact: true })).toBeVisible();
});

test('can favorite a folder and see it nested under the Favorites virtual view', async ({
	page
}) => {
	await page.goto('/');

	const folderTitle = uniqueName('Favorite Folder');

	await createFolder(page, folderTitle);
	await addFolderToFavorites(page, folderTitle);

	await page.getByText('Favorites', { exact: true }).click();

	await expect(getTrashFolder(page).getByText('Favorites', { exact: true })).toBeVisible();
	await expect(
		page.locator('div[data-sidebar="header"]').getByText(folderTitle, { exact: true })
	).toBeVisible();
});

test('deleted favorite notes disappear from Favorites and reappear there after restore', async ({
	page
}) => {
	await page.goto('/');

	const folderTitle = uniqueName('Favorite Delete Folder');
	const noteTitle = uniqueName('Favorite Delete Note');

	await createFolder(page, folderTitle);
	await createNote(page, noteTitle, 'Favorite note lifecycle.');
	await addSelectedNoteToFavorites(page, noteTitle);

	await openFavorites(page);
	await page.getByText(noteTitle, { exact: true }).click();
	await deleteSelectedNote(page);

	await expect(page.getByText(noteTitle, { exact: true })).toBeHidden();

	await page.getByText('Recently Deleted', { exact: true }).click();
	await page.getByText(noteTitle, { exact: true }).click();
	await page.getByRole('button', { name: 'Restore Note' }).click();
	await page
		.locator('div[data-slot="alert-dialog-content"]')
		.getByRole('button', { name: 'Restore' })
		.click();

	await openFavorites(page);
	await expect(page.getByText(noteTitle, { exact: true })).toBeVisible();
});

test('deleted favorite folders disappear from Favorites and reappear there after restore', async ({
	page
}) => {
	await page.goto('/');

	const folderTitle = uniqueName('Favorite Delete Folder');

	await createFolder(page, folderTitle);
	await addFolderToFavorites(page, folderTitle);

	await openFavorites(page);
	await expect(getHeaderSidebarItem(page, folderTitle)).toBeVisible();

	await deleteFolder(page, folderTitle);

	await openFavorites(page);
	await expect(getHeaderSidebarItem(page, folderTitle)).toBeHidden();

	await page.getByText('Recently Deleted', { exact: true }).click();
	await getTrashFolder(page).getByText(folderTitle, { exact: true }).click({ button: 'right' });
	await page.getByText('Recover Folder', { exact: true }).click();

	await openFavorites(page);
	await expect(getHeaderSidebarItem(page, folderTitle)).toBeVisible();
});
