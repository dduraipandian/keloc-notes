import { expect, test } from '@playwright/test';

test('can create and rename a folder from the sidebar', async ({ page }) => {
	await page.goto('/');

	await page.getByRole('link', { name: 'New Folder' }).click();

	const renameInput = page.locator('input:not([placeholder])');
	await expect(renameInput).toBeVisible();
	await expect(renameInput).toHaveValue('New Folder');
	await expect(renameInput).toBeFocused();

	await renameInput.fill('Playwright Folder');
	await renameInput.press('Enter');

	const newFolder = await page.locator('li[data-sidebar="menu-item"]');
	const newFolderTitle = await page.locator('aside header h2');

	await expect(newFolder.getByText('Playwright Folder', { exact: true })).toBeVisible();
	await expect(newFolderTitle.getByText('Playwright Folder', { exact: true })).toBeVisible();
});
