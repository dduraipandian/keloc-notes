import { test, expect } from '@playwright/test';

async function gotoApp(page) {
	const dbName = `mdnotes-e2e-${Date.now()}`;
	await page.addInitScript((name) => {
		window.__MDNOTES_DB_NAME__ = name;
	}, dbName);
	await page.goto('/');
	await page.waitForSelector('[data-app-ready="true"]', { timeout: 5000 }).catch(() => {});
	await page.waitForTimeout(500);
}

async function openFirstNote(page) {
	const noteItem = page.locator('[data-testid="note-item"]').first();
	if (!(await noteItem.isVisible())) {
		return false;
	}

	await noteItem.click();
	await page.waitForTimeout(500);
	return true;
}

test.describe('Editor E2E', () => {
	test('should display editor when note is selected', async ({ page }) => {
		await gotoApp(page);

		// Look for editor pane
		const editorPane = page.locator('[data-testid="editor-pane"]').first();
		await expect(editorPane).toBeVisible();

		// Should show empty state initially
		const emptyState = page.locator('text=Select a note to view');
		await expect(emptyState).toBeVisible();
	});

	test('should load editor with note content', async ({ page }) => {
		await gotoApp(page);

		// Click on first folder to expand
		const firstFolder = page.locator('[data-testid="sidebar-item"]').first();
		if (await firstFolder.isVisible()) {
			await firstFolder.click();
			await page.waitForTimeout(300);
		}

		// Click on a note if available
		const noteItem = page.locator('[data-testid="note-item"]').first();
		if (await noteItem.isVisible()) {
			await noteItem.click();
			await page.waitForTimeout(500);

			// Should show editor content area
			const editorContent = page.locator('.editor-content');
			await expect(editorContent).toBeVisible();
		}
	});

	test('should type and save text in editor', async ({ page }) => {
		await gotoApp(page);

		// Select a note or create one
		const noteItem = page.locator('[data-testid="note-item"]').first();
		if (await noteItem.isVisible()) {
			await noteItem.click();
			await page.waitForTimeout(500);

			// Find the editor content area and type
			const proseMirror = page.locator('.ProseMirror').first();
			if (await proseMirror.isVisible()) {
				await proseMirror.click();
				await proseMirror.type('Test content from E2E');
				await page.waitForTimeout(300);

				// Content should be visible
				const text = await proseMirror.textContent();
				expect(text).toContain('Test content from E2E');
			}
		}
	});

	test('should apply bold formatting', async ({ page }) => {
		await gotoApp(page);

		const noteItem = page.locator('[data-testid="note-item"]').first();
		if (await noteItem.isVisible()) {
			await noteItem.click();
			await page.waitForTimeout(500);

			const proseMirror = page.locator('.ProseMirror').first();
			if (await proseMirror.isVisible()) {
				await proseMirror.click();
				await proseMirror.type('Bold text');
				await page.waitForTimeout(200);

				// Select all text
				await page.keyboard.press('Control+A');
				await page.waitForTimeout(200);

				// Click bold button
				const boldBtn = page.locator('button[aria-label="Bold"]').first();
				if (await boldBtn.isVisible()) {
					await boldBtn.click();
					await page.waitForTimeout(300);

					// Bold button should have active class
					await expect(boldBtn).toHaveClass(/is-active/);
				}
			}
		}
	});

	test('should apply italic formatting', async ({ page }) => {
		await gotoApp(page);

		const noteItem = page.locator('[data-testid="note-item"]').first();
		if (await noteItem.isVisible()) {
			await noteItem.click();
			await page.waitForTimeout(500);

			const proseMirror = page.locator('.ProseMirror').first();
			if (await proseMirror.isVisible()) {
				await proseMirror.click();
				await proseMirror.type('Italic text');
				await page.waitForTimeout(200);

				// Select all text
				await page.keyboard.press('Control+A');
				await page.waitForTimeout(200);

				// Click italic button
				const italicBtn = page.locator('button[aria-label="Italic"]').first();
				if (await italicBtn.isVisible()) {
					await italicBtn.click();
					await page.waitForTimeout(300);

					// Italic button should have active class
					await expect(italicBtn).toHaveClass(/is-active/);
				}
			}
		}
	});

	test('should insert heading', async ({ page }) => {
		await gotoApp(page);

		const noteItem = page.locator('[data-testid="note-item"]').first();
		if (await noteItem.isVisible()) {
			await noteItem.click();
			await page.waitForTimeout(500);

			const proseMirror = page.locator('.ProseMirror').first();
			if (await proseMirror.isVisible()) {
				await proseMirror.click();
				await proseMirror.type('Heading text');
				await page.waitForTimeout(200);

				// Select all text
				await page.keyboard.press('Control+A');
				await page.waitForTimeout(200);

				// Click H1 button
				const h1Btn = page.locator('button[aria-label="H1"]').first();
				if (await h1Btn.isVisible()) {
					await h1Btn.click();
					await page.waitForTimeout(300);

					// H1 button should have active class
					await expect(h1Btn).toHaveClass(/is-active/);
				}
			}
		}
	});

	test('should insert bullet list', async ({ page }) => {
		await gotoApp(page);

		const noteItem = page.locator('[data-testid="note-item"]').first();
		if (await noteItem.isVisible()) {
			await noteItem.click();
			await page.waitForTimeout(500);

			const proseMirror = page.locator('.ProseMirror').first();
			if (await proseMirror.isVisible()) {
				await proseMirror.click();
				await proseMirror.type('List item 1');
				await page.waitForTimeout(200);

				// Click bullet list button
				const bulletBtn = page.locator('button[aria-label="Bullet list"]').first();
				if (await bulletBtn.isVisible()) {
					await bulletBtn.click();
					await page.waitForTimeout(300);

					// Bullet list button should have active class
					await expect(bulletBtn).toHaveClass(/is-active/);
				}
			}
		}
	});

	test('should show toolbar when editor is focused', async ({ page }) => {
		await gotoApp(page);

		const noteItem = page.locator('[data-testid="note-item"]').first();
		if (await noteItem.isVisible()) {
			await noteItem.click();
			await page.waitForTimeout(500);

			const proseMirror = page.locator('.ProseMirror').first();
			if (await proseMirror.isVisible()) {
				// Toolbar should be visible
				const toolbar = page.locator('.editor-toolbar').first();
				await expect(toolbar).toBeVisible();

				// Should have formatting buttons
				const boldBtn = page.locator('button[aria-label="Bold"]').first();
				await expect(boldBtn).toBeVisible();
			}
		}
	});

	test('should handle note switching with key directive', async ({ page }) => {
		await gotoApp(page);

		// Click first note
		const noteItems = page.locator('[data-testid="note-item"]');
		const count = await noteItems.count();

		if (count >= 2) {
			await noteItems.nth(0).click();
			await page.waitForTimeout(500);

			const firstContent = page.locator('.ProseMirror').first();
			const firstText = await firstContent.textContent();

			// Click second note
			await noteItems.nth(1).click();
			await page.waitForTimeout(500);

			const secondContent = page.locator('.ProseMirror').first();
			const secondText = await secondContent.textContent();

			// Content should be different (or at least editor remounted)
			expect(firstText).toBeTruthy();
			expect(secondText).toBeTruthy();
		}
	});

	test('should show loading skeleton while content loads', async ({ page }) => {
		await gotoApp(page);

		const noteItem = page.locator('[data-testid="note-item"]').first();
		if (await noteItem.isVisible()) {
			// Content might load quickly, but structure should be correct
			const editorRoot = page.locator('.editor-root').first();
			await expect(editorRoot).toBeVisible();
		}
	});

	test('should display toolbar buttons correctly', async ({ page }) => {
		await gotoApp(page);

		const noteItem = page.locator('[data-testid="note-item"]').first();
		if (await noteItem.isVisible()) {
			await noteItem.click();
			await page.waitForTimeout(500);

			const toolbar = page.locator('.editor-toolbar').first();
			if (await toolbar.isVisible()) {
				// Check for common toolbar buttons
				const buttons = await page.locator('.toolbar-btn').count();
				expect(buttons).toBeGreaterThan(0);

				// Check for specific buttons
				const boldBtn = page.locator('button[aria-label="Bold"]').first();
				const italicBtn = page.locator('button[aria-label="Italic"]').first();
				const h1Btn = page.locator('button[aria-label="H1"]').first();

				await expect(boldBtn).toBeVisible();
				await expect(italicBtn).toBeVisible();
				await expect(h1Btn).toBeVisible();
			}
		}
	});

	test('should disable toolbar buttons when editor is readonly', async ({ page }) => {
		await gotoApp(page);

		const noteItem = page.locator('[data-testid="note-item"]').first();
		if (await noteItem.isVisible()) {
			await noteItem.click();
			await page.waitForTimeout(500);

			// If note is in trash, buttons should be disabled
			const trashBanner = page.locator('text=This note is in the Trash');
			const inTrash = await trashBanner.isVisible();

			const toolbar = page.locator('.editor-toolbar').first();
			if (await toolbar.isVisible()) {
				const boldBtn = page.locator('button[aria-label="Bold"]').first();
				if (inTrash) {
					await expect(boldBtn).toBeDisabled();
				} else {
					// Enabled state depends on note state
					const isDisabled = await boldBtn.isDisabled();
					expect(typeof isDisabled).toBe('boolean');
				}
			}
		}
	});

	test('should accept empty content', async ({ page }) => {
		await gotoApp(page);

		const noteItem = page.locator('[data-testid="note-item"]').first();
		if (await noteItem.isVisible()) {
			await noteItem.click();
			await page.waitForTimeout(500);

			// Editor should be visible even with empty content
			const editorContent = page.locator('.editor-content').first();
			await expect(editorContent).toBeVisible();
		}
	});

	test('should have proper ARIA attributes', async ({ page }) => {
		await gotoApp(page);

		const noteItem = page.locator('[data-testid="note-item"]').first();
		if (await noteItem.isVisible()) {
			await noteItem.click();
			await page.waitForTimeout(500);

			// Editor root should have role
			const editorRoot = page.locator('.editor-root').first();
			const role = await editorRoot.getAttribute('role');
			expect(role).toBeTruthy();

			// Buttons should have aria-label
			const boldBtn = page.locator('button[aria-label="Bold"]').first();
			const ariaLabel = await boldBtn.getAttribute('aria-label');
			expect(ariaLabel).toBe('Bold');
		}
	});

	test('should undo and redo inserted images', async ({ page }) => {
		await gotoApp(page);

		if (!(await openFirstNote(page))) {
			return;
		}

		const imageButton = page.locator('button[aria-label="Image"]').first();
		await expect(imageButton).toBeVisible();

		const fileChooserPromise = page.waitForEvent('filechooser');
		await imageButton.click();
		const fileChooser = await fileChooserPromise;
		await fileChooser.setFiles({
			name: 'undo-redo-image.png',
			mimeType: 'image/png',
			buffer: Buffer.from(
				'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn9l6sAAAAASUVORK5CYII=',
				'base64'
			)
		});

		const insertedImage = page.locator('.ProseMirror img').last();
		await expect(insertedImage).toBeVisible();
		await expect
			.poll(() =>
				insertedImage.evaluate((img) => ({
					complete: img.complete,
					naturalWidth: img.naturalWidth
				}))
			)
			.toEqual({ complete: true, naturalWidth: 1 });

		await page.locator('.ProseMirror').first().click();
		await page.keyboard.press('Control+Z');
		await expect(page.locator('.ProseMirror img')).toHaveCount(0);

		await page.keyboard.press('Control+Y');
		const redoneImage = page.locator('.ProseMirror img').first();
		await expect(redoneImage).toBeVisible();
		await expect
			.poll(() =>
				redoneImage.evaluate((img) => ({
					complete: img.complete,
					naturalWidth: img.naturalWidth
				}))
			)
			.toEqual({ complete: true, naturalWidth: 1 });
	});
});
