import { expect, test } from '@playwright/test';

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

async function createAndSelectNote(page: import('@playwright/test').Page) {
	// Click New Note button
	await page.getByTitle('New Note').click();
	await page.waitForTimeout(100);

	// Wait for the note to be created and selected by checking if textarea becomes available
	const titleInput = page.locator('textarea[placeholder="Note Title"]').first();
	await titleInput.waitFor({ state: 'visible', timeout: 10000 });

	await titleInput.focus();
	await titleInput.fill('Test Note');
	await page.waitForTimeout(200);

	const bodyInput = page.locator('.ProseMirror').first();
	await bodyInput.waitFor({ state: 'visible', timeout: 5000 });
	await bodyInput.focus();
	await bodyInput.type('Test content');
	await bodyInput.blur();
	await page.waitForTimeout(200);
}

async function triggerDeleteDialog(page: import('@playwright/test').Page) {
	// Click the trash icon to delete the note
	await page.getByTitle('Trash').click();
	const dialog = page.locator('div[data-slot="alert-dialog-content"]');
	await expect(dialog).toBeVisible({ timeout: 5000 });
	return dialog;
}

test.describe('Dialog Focus Management', () => {
	test('delete confirmation dialog focuses on action button on open', async ({ page }) => {
		await gotoApp(page);
		await createAndSelectNote(page);
		await triggerDeleteDialog(page);

		// Action button should be focused
		const actionBtn = page
			.locator('div[data-slot="alert-dialog-content"]')
			.locator('button:last-of-type');
		const isFocused = await actionBtn.evaluate((el) => document.activeElement === el);
		expect(isFocused).toBe(true);

		// Focus ring should be visible (check for outline or ring styles)
		const hasVisibleFocus = await actionBtn.evaluate((el) => {
			const styles = window.getComputedStyle(el);
			return styles.outlineWidth !== 'none' || (styles.boxShadow && styles.boxShadow !== 'none');
		});
		expect(hasVisibleFocus).toBe(true);
	});

	test('arrow keys navigate between dialog buttons', async ({ page }) => {
		await gotoApp(page);
		await createAndSelectNote(page);
		const dialog = await triggerDeleteDialog(page);

		const actionBtn = dialog.locator('button:last-of-type');
		const cancelBtn = dialog.locator('button:first-of-type');

		// Should start on action button
		let focused = await actionBtn.evaluate((el) => document.activeElement === el);
		expect(focused).toBe(true);

		// Press left arrow -> should move to cancel
		await page.keyboard.press('ArrowLeft');
		focused = await cancelBtn.evaluate((el) => document.activeElement === el);
		expect(focused).toBe(true);

		// Press right arrow -> should move back to action
		await page.keyboard.press('ArrowRight');
		focused = await actionBtn.evaluate((el) => document.activeElement === el);
		expect(focused).toBe(true);
	});

	test('enter key activates focused dialog button', async ({ page }) => {
		await gotoApp(page);
		await createAndSelectNote(page);
		await triggerDeleteDialog(page);

		// Press Enter -> should delete (dialog closes)
		await page.keyboard.press('Enter');

		const dialog = page.locator('div[data-slot="alert-dialog-content"]');
		await expect(dialog).not.toBeVisible();

		// Note should be in trash
		const trashSection = page.locator('text=Recently Deleted');
		await expect(trashSection).toBeVisible();
	});

	test('cancel button closes dialog without deleting note', async ({ page }) => {
		await gotoApp(page);
		await createAndSelectNote(page);

		// Get the note before deletion attempt
		const noteContent = page.locator('.ProseMirror').first();
		const contentBefore = await noteContent.textContent();

		// Open delete dialog
		const dialog = await triggerDeleteDialog(page);

		// Click Cancel button to close without deleting
		const cancelBtn = dialog.locator('button:first-of-type');
		await cancelBtn.click();

		// Dialog should be closed
		await expect(dialog).not.toBeVisible();

		// Note should still exist with the same content
		const noteContentAfter = page.locator('.ProseMirror').first();
		await expect(noteContentAfter).toBeVisible();
		const contentAfter = await noteContentAfter.textContent();
		expect(contentAfter).toBe(contentBefore);
	});
});
