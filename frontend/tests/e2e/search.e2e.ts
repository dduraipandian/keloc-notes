import { expect, test } from '@playwright/test';

async function gotoApp(page: import('@playwright/test').Page) {
	const dbName = `mdnotes-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`;
	await page.addInitScript((name: string) => {
		(window as any).__MDNOTES_DB_NAME__ = name;
	}, dbName);
	await page.goto('/');
	await expect(page.locator('html')).toHaveAttribute('data-app-ready', 'true', { timeout: 30000 });
}

test.describe('Search Functionality', () => {
	test('should find notes by content (Full Text Search)', async ({ page }) => {
		await gotoApp(page);

		// 1. Create a note with unique content
		await page.getByTitle('New Note').click();
		await page.getByPlaceholder('Note Title').fill('Science Note');

		const editor = page.locator('.ProseMirror').first();
		await editor.click();
		await editor.type('The study of thermodynamics is fascinating.');
		
		// Ensure persistence (400ms debounce + buffer)
		await page.waitForTimeout(600);

		// 2. Search for a word in the content
		const searchInput = page.getByPlaceholder('Search notes...');
		await searchInput.fill('thermodynamics');
		
		// Wait for search debounce (150ms + buffer)
		await page.waitForTimeout(400);

		// 3. Verify result is visible in the note list
		const noteList = page.locator('aside');
		await expect(noteList.getByText('Science Note')).toBeVisible();

		// 4. Search for a word that doesn't exist
		await searchInput.fill('astronomy');
		await page.waitForTimeout(400);

		// 5. Verify result is hidden
		await expect(noteList.getByText('Science Note')).not.toBeVisible();

		// 6. Search for part of the title
		await searchInput.fill('Science');
		await page.waitForTimeout(400);
		await expect(noteList.getByText('Science Note')).toBeVisible();
	});

	test('should scope search to the active folder', async ({ page }) => {
		await gotoApp(page);

		// 1. Create Folder A and a note inside
		await page.getByRole('button', { name: 'New Folder' }).click();
		const renameInput = page.locator('input:not([placeholder])');
		await renameInput.fill('Folder A');
		await renameInput.press('Enter');
		await page.waitForTimeout(500);

		await page.getByTitle('New Note').click();
		await page.getByPlaceholder('Note Title').fill('Note in A');
		const editor1 = page.locator('.ProseMirror').first();
		await editor1.click();
		await editor1.type('UniqueKeyA');
		await page.waitForTimeout(800);

		// 2. Create Folder B (at Root/Home)
		await page.locator('div[data-sidebar="header"]').getByText('Home').click();
		await page.waitForTimeout(200);

		await page.getByRole('button', { name: 'New Folder' }).click();
		const renameInputB = page.locator('input:not([placeholder])');
		await renameInputB.fill('Folder B');
		await renameInputB.press('Enter');
		await page.waitForTimeout(500);

		await page.getByTitle('New Note').click();
		await page.getByPlaceholder('Note Title').fill('Note in B');
		const editor2 = page.locator('.ProseMirror').first();
		await editor2.click();
		await editor2.type('UniqueKeyA');
		await page.waitForTimeout(800);

		// 3. Search for the word while in Folder B
		const searchInput = page.getByPlaceholder('Search notes...');
		await searchInput.fill('UniqueKeyA');
		await page.waitForTimeout(500);

		// 4. Verify only Note in B is visible (scoped search)
		const noteList = page.locator('aside');
		await expect(noteList.getByText('Note in B')).toBeVisible();
		await expect(noteList.getByText('Note in A')).not.toBeVisible();

		// 5. Switch to Folder A
		await page.locator('span.notes-folder-label').getByText('Folder A').click();
		await page.waitForTimeout(600); // Wait for indexing trigger and re-filter

		// 6. Verify only Note in A is visible
		await expect(noteList.getByText('Note in A')).toBeVisible();
		await expect(noteList.getByText('Note in B')).not.toBeVisible();
	});
});
