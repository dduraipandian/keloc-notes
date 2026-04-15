import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Alert from '../../../src/routes/alert.svelte';
import type { ConfirmOptions } from '../../../src/lib/stores/dialog.svelte';

describe('Alert route', () => {
	beforeEach(() => {
		delete (window as Window & { __xss?: boolean }).__xss;
	});

	function createDialog(overrides: Partial<ConfirmOptions> = {}): ConfirmOptions {
		return {
			open: true,
			type: 'destroy',
			title: 'Confirm',
			description: 'Are you sure?',
			canCancel: true,
			confirmLabel: 'Confirm',
			cancelLabel: 'Cancel',
			onConfirm: vi.fn(),
			...overrides
		};
	}

	it('renders untrusted descriptions as text instead of HTML', () => {
		const description = 'Are you sure you want to delete "<img src=x onerror=window.__xss=true>"?';
		render(Alert, { dialog: createDialog({ description }) });

		expect((window as Window & { __xss?: boolean }).__xss).toBeUndefined();
		expect(
			screen.getByText((_, node) => node?.textContent === description)
		).toBeDefined();
		expect(document.querySelector('img')).toBeNull();
	});

	it('renders HTML descriptions only when explicitly allowed', () => {
		render(Alert, {
			dialog: createDialog({
				description: 'oh <br/> no',
				allowHtml: true
			})
		});

		const description = screen.getByText((_, node) => node?.textContent === 'oh  no');
		expect(description.querySelector('br')).not.toBeNull();
	});

	it('renders plain descriptions normally when HTML is not allowed', () => {
		render(Alert, { dialog: createDialog({ description: 'Are you sure?' }) });

		expect(screen.getByText('Are you sure?')).toBeDefined();
	});
});
