import { describe, expect, it, vi, afterEach } from 'vitest';
import { tick } from 'svelte';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import WelcomeDialog from '$lib/components/WelcomeDialog.svelte';

describe('WelcomeDialog', () => {
	afterEach(async () => {
		cleanup();
		await new Promise<void>((r) => setTimeout(() => r(), 0));
		await new Promise<void>((r) => requestAnimationFrame(() => r()));
		await tick();
	});

	it('renders the title and tagline when open', () => {
		const onclose = vi.fn();
		render(WelcomeDialog, { open: true, onclose });

		expect(screen.getByText('Welcome to keloc-notes')).toBeDefined();
		expect(screen.getByText(/local-first/i)).toBeDefined();
	});

	it('renders all three keyboard shortcut hints', () => {
		const onclose = vi.fn();
		render(WelcomeDialog, { open: true, onclose });

		expect(screen.getByText('⌘N')).toBeDefined();
		expect(screen.getByText('⌘⇧N')).toBeDefined();
		expect(screen.getByText('/')).toBeDefined();
	});

	it('"Get Started" button calls onclose', async () => {
		const onclose = vi.fn();
		render(WelcomeDialog, { open: true, onclose });

		await fireEvent.click(screen.getByText('Get Started'));

		expect(onclose).toHaveBeenCalledOnce();
	});

	it('"Skip for now" button calls onclose', async () => {
		const onclose = vi.fn();
		render(WelcomeDialog, { open: true, onclose });

		await fireEvent.click(screen.getByText('Skip for now'));

		expect(onclose).toHaveBeenCalledOnce();
	});
});
