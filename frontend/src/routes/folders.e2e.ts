import { expect, test } from '@playwright/test';

function uniqueName(prefix: string) {
	return `${prefix}-${Math.floor(Math.random() * 1000)}`;
}

async function createFolder(page: import('@playwright/test').Page, title: string) {
	await page.getByRole('link', { name: 'New Folder' }).click();

	const renameInput = page.locator('input:not([placeholder])');
	await expect(renameInput).toBeVisible();
	await expect(renameInput).toHaveValue('New Folder');

	await renameInput.fill(title);
	await renameInput.press('Enter');

	await expect(
		page.locator('li[data-sidebar="menu-item"]').getByText(title, { exact: true })
	).toBeVisible();
	await expect(page.locator('aside header h2').getByText(title, { exact: true })).toBeVisible();
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

	await expect(page.getByRole('textbox', { name: 'Note Title' })).toHaveValue(title);
}

test('can create and rename a folder from the sidebar', async ({ page }) => {
	await page.goto('/');

	const folderTitle = uniqueName('Playwright Folder');
	await createFolder(page, folderTitle);
});

test('can create a note in the selected folder', async ({ page }) => {
	await page.goto('/');

	const folderTitle = uniqueName('Notes Folder');
	const noteTitle = uniqueName('Playwright Note');
	await createFolder(page, folderTitle);
	await createNote(page, noteTitle, 'Created from Playwright.');

	await expect(page.getByPlaceholder('Note Title')).toHaveValue(noteTitle);
	await expect(page.getByText(noteTitle, { exact: true })).toBeVisible();
});

test('can soft delete and recover a note from trash', async ({ page }) => {
	await page.goto('/');

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
	await expect(page.getByPlaceholder('Note Title')).toHaveValue(noteTitle);

	const folderEntry = page.locator('li[data-sidebar="menu-item"]').filter({
		has: page.getByText('Notes', { exact: true })
	});

	await folderEntry.click();

	await expect(page.locator('aside div[data-slot="item-title"]')).toContainText(noteTitle);
});

test('can soft delete and recover a folder from trash', async ({ page }) => {
	await page.goto('/');

	const folderTitle = uniqueName('Recoverable Folder');
	await createFolder(page, folderTitle);

	const folderEntry = page.locator('li[data-sidebar="menu-item"]').filter({
		has: page.getByText(folderTitle, { exact: true })
	});

	await folderEntry.click({ button: 'right' });
	await page.getByText('Delete', { exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Delete Folder' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Delete Folder' })).toBeVisible();
	await page.getByRole('button', { name: 'Delete Folder' }).click();

	await page.getByText('Recently Deleted', { exact: true }).click();
	const deletedFolderEntry = page
		.locator('div[data-sidebar="header"] ul li[data-sidebar="menu-item"]')
		.getByText(folderTitle, { exact: true });
	await page.locator('.custom-scrollbar').click();
	await expect(deletedFolderEntry).toBeVisible();

	await deletedFolderEntry.click({
		button: 'right'
	});
	await page.getByText('Recover Folder', { exact: true }).click();

	await expect(
		page
			.locator('div[data-sidebar="content"] ul li[data-sidebar="menu-item"]')
			.getByText(folderTitle, { exact: true })
	).toBeVisible();
});
