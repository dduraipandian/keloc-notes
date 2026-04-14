import { test, expect } from '@playwright/test';

test.describe('Note Count Reactivity Regressions', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		// Wait for initialization
		await expect(page.locator('text=Home')).toBeVisible();
	});

	test('Home badge reflects root notes count', async ({ page }) => {
		// Home should initially have 0
		const homeBadge = page.locator('[data-testid="folder-item-home"] .badge');
		await expect(homeBadge).toHaveText('0');

		// Create a note in Home (root)
		await page.click('[data-testid="new-note-button"]');
		
		// Wait for note list to show the new note
		await expect(page.locator('[data-testid="note-list-item"]')).toHaveCount(1);
		
		// Assert Home badge is 1
		await expect(homeBadge).toHaveText('1');
	});

	test('Trashed folder badge reflects its deleted notes count', async ({ page }) => {
		// 1. Create Folder F2
		await page.click('[data-testid="new-folder-button"]');
		await page.fill('[data-testid="folder-rename-input"]', 'F2');
		await page.keyboard.press('Enter');
		await expect(page.locator('text=F2')).toBeVisible();

		// 2. Select F2 and create a note
		await page.click('text=F2');
		await page.click('[data-testid="new-note-button"]');
		await page.fill('[data-testid="note-editor-title"]', 'Note in F2');
		
		// Verify F2 badge is 1
		const f2Badge = page.locator('[data-testid^="folder-item-"][data-testid$="-F2"] .badge');
		await expect(f2Badge).toHaveText('1');

		// 3. Delete F2
		await page.click('text=F2', { button: 'right' });
		await page.click('text=Delete Folder');
		await expect(page.locator('text=F2')).not.toBeVisible({ timeout: 5000 });

		// 4. Open Recently Deleted and check nested F2 badge
		await page.click('text=Recently Deleted');
		// The folder should be visible inside trash
		const trashedF2 = page.locator('[data-testid="folder-item-deleted-notes"] >> text=F2');
		await expect(trashedF2).toBeVisible();
		
		const trashedF2Badge = page.locator('[data-testid^="folder-item-"][data-testid*="F2"] .badge').last();
		// REPRO: This is expected to fail (show 0) based on user report
		await expect(trashedF2Badge).toHaveText('1');
	});
});
