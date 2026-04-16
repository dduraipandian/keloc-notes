<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { folderStore } from '$lib/stores/folders.svelte';
	import { notesStore } from '$lib/stores/notes.svelte';
	import { selectionStore } from '$lib/stores/selection.svelte';
	import { settingsRepository } from '$lib/stores/repositories';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import Alert from './alert.svelte';
	import Folders from '$lib/components/Folders.svelte';
	import NoteItems from '$lib/components/NoteItems.svelte';
	import { EventsEmit, EventsOn, Quit, WindowSetTitle } from '$lib/wailsjs/runtime/runtime';
	import { uiStore } from '$lib/stores/dialog.svelte';

	let { children } = $props();

	const DEFAULT_SIDEBAR_WIDTH = 256;
	const DEFAULT_NOTE_LIST_WIDTH = 350;
	const MIN_SIDEBAR_WIDTH = 220;
	const MAX_SIDEBAR_WIDTH = 360;
	const MIN_NOTE_LIST_WIDTH = 280;
	const MAX_NOTE_LIST_WIDTH = 460;
	const MIN_EDITOR_WIDTH = 420;
	const RESIZE_HANDLE_WIDTH = 10;

	let isInitializing = $state(true);
	let initError = $state<string | null>(null);
	let sidebarWidth = $state(DEFAULT_SIDEBAR_WIDTH);
	let noteListWidth = $state(DEFAULT_NOTE_LIST_WIDTH);
	let activeResizeHandle = $state<'sidebar' | 'note-list' | null>(null);
	let pendingPointerX = $state<number | null>(null);
	let resizeFrame = $state<number | null>(null);

	function clamp(value: number, min: number, max: number) {
		return Math.min(Math.max(value, min), max);
	}

	function getLayoutMetrics() {
		return {
			windowWidth: window.innerWidth,
			maxSidebarWidth: Math.min(
				MAX_SIDEBAR_WIDTH,
				window.innerWidth - MIN_NOTE_LIST_WIDTH - MIN_EDITOR_WIDTH - RESIZE_HANDLE_WIDTH * 2
			),
			maxNoteListWidth: Math.min(
				MAX_NOTE_LIST_WIDTH,
				window.innerWidth - sidebarWidth - MIN_EDITOR_WIDTH - RESIZE_HANDLE_WIDTH * 2
			)
		};
	}

	function normalizePaneWidths(nextSidebarWidth = sidebarWidth, nextNoteListWidth = noteListWidth) {
		const maxSidebarWidth = Math.max(
			MIN_SIDEBAR_WIDTH,
			window.innerWidth - MIN_NOTE_LIST_WIDTH - MIN_EDITOR_WIDTH - RESIZE_HANDLE_WIDTH * 2
		);
		const normalizedSidebarWidth = clamp(nextSidebarWidth, MIN_SIDEBAR_WIDTH, maxSidebarWidth);
		const maxNoteListWidth = Math.max(
			MIN_NOTE_LIST_WIDTH,
			window.innerWidth - normalizedSidebarWidth - MIN_EDITOR_WIDTH - RESIZE_HANDLE_WIDTH * 2
		);

		sidebarWidth = normalizedSidebarWidth;
		noteListWidth = clamp(nextNoteListWidth, MIN_NOTE_LIST_WIDTH, maxNoteListWidth);
	}

	function flushResizeFrame() {
		if (!activeResizeHandle || pendingPointerX == null) return;

		if (activeResizeHandle === 'sidebar') {
			normalizePaneWidths(pendingPointerX, noteListWidth);
			return;
		}

		const noteListStartX = sidebarWidth + RESIZE_HANDLE_WIDTH;
		const nextNoteListWidth = pendingPointerX - noteListStartX;
		normalizePaneWidths(sidebarWidth, nextNoteListWidth);
	}

	function scheduleResizeFrame() {
		if (resizeFrame != null) return;
		resizeFrame = requestAnimationFrame(() => {
			resizeFrame = null;
			flushResizeFrame();
		});
	}

	function handlePointerMove(event: PointerEvent) {
		if (!activeResizeHandle) return;
		pendingPointerX = event.clientX;
		scheduleResizeFrame();
	}

	function persistPaneWidths() {
		void Promise.allSettled([
			settingsRepository.save('sidebarWidth', sidebarWidth),
			settingsRepository.save('noteListWidth', noteListWidth)
		]);
	}

	function stopResize() {
		if (!activeResizeHandle) return;
		if (resizeFrame != null) {
			cancelAnimationFrame(resizeFrame);
			resizeFrame = null;
		}
		flushResizeFrame();
		pendingPointerX = null;
		activeResizeHandle = null;
		document.body.style.cursor = '';
		document.body.style.userSelect = '';
		persistPaneWidths();
	}

	function startResize(event: PointerEvent, handle: 'sidebar' | 'note-list') {
		event.preventDefault();
		activeResizeHandle = handle;
		pendingPointerX = event.clientX;
		document.body.style.cursor = 'col-resize';
		document.body.style.userSelect = 'none';
		scheduleResizeFrame();
	}

	$effect(() => {
		const selectedNote = notesStore.selectedNote;
		const selectedNoteTitle = selectedNote?.title.trim();
		const selectedFolderId = selectionStore.selectedFolderID;
		const selectedFolderTitle = selectedFolderId ? selectionStore.getSelectedFolder()?.title : null;

		if (isInitializing) {
			WindowSetTitle('mdnotes');
			return;
		}

		if (selectedNoteTitle) {
			WindowSetTitle(`${selectedNoteTitle}`);
			return;
		}

		if (selectedFolderTitle) {
			WindowSetTitle(`${selectedFolderTitle}`);
			return;
		}

		WindowSetTitle('mdnotes');
	});

	onMount(() => {
		const handleWindowResize = () => {
			normalizePaneWidths();
		};
		const handleWindowPointerMove = (event: PointerEvent) => {
			handlePointerMove(event);
		};
		const handleWindowPointerUp = () => {
			stopResize();
		};

		window.addEventListener('resize', handleWindowResize);
		window.addEventListener('pointermove', handleWindowPointerMove);
		window.addEventListener('pointerup', handleWindowPointerUp);

		const offBeforeClose = EventsOn('app:before-close', async () => {
			try {
				await notesStore.flushAllPendingWrites();
			} finally {
				EventsEmit('app:flush-complete');
			}
		});

		void (async () => {
			try {
				const settings = await settingsRepository.getAll();
				normalizePaneWidths(
					settings.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH,
					settings.noteListWidth ?? DEFAULT_NOTE_LIST_WIDTH
				);
				await folderStore.init();
				await selectionStore.init();
				await notesStore.init();
				folderStore.onPersistError = (err) => {
					uiStore.confirmAppQuit('Save failed', String(err), () => {});
				};
				selectionStore.onPersistError = (err) => {
					uiStore.confirmAppQuit('Save failed', String(err), () => {});
				};
				notesStore.onPersistError = (err) => {
					uiStore.confirmAppQuit('Save failed', String(err), () => {});
				};
			} catch (err) {
				initError = err instanceof Error ? err.message : 'An unexpected error occurred.';
				uiStore.confirmAppQuit('Failed to Start', initError, Quit);
			} finally {
				isInitializing = false;
			}
		})();

		return () => {
			offBeforeClose?.();
			stopResize();
			if (resizeFrame != null) {
				cancelAnimationFrame(resizeFrame);
			}
			window.removeEventListener('resize', handleWindowResize);
			window.removeEventListener('pointermove', handleWindowPointerMove);
			window.removeEventListener('pointerup', handleWindowPointerUp);
			folderStore.onPersistError = null;
			selectionStore.onPersistError = null;
			notesStore.onPersistError = null;
		};
	});
</script>

<div class="dark h-screen overflow-hidden bg-background text-foreground">
	{#if isInitializing}
		<div
			class="grid h-full grid-cols-[16rem_22rem_minmax(0,1fr)]"
			aria-live="polite"
			aria-busy="true"
			data-testid="startup-loading"
		>
			<section class="flex h-full flex-col bg-sidebar/40 px-4 pt-6 pb-6">
				<div class="mb-6 space-y-2">
					<Skeleton class="h-4 w-20 rounded-sm bg-muted/40" />
					<Skeleton class="h-8 w-full rounded-sm bg-muted/35" />
					<Skeleton class="h-8 w-[85%] rounded-sm bg-muted/30" />
					<Skeleton class="h-8 w-[90%] rounded-sm bg-muted/30" />
				</div>
				<div class="space-y-2">
					<Skeleton class="h-4 w-24 rounded-sm bg-muted/35" />
					<Skeleton class="h-8 w-full rounded-sm bg-muted/30" />
					<Skeleton class="h-8 w-[88%] rounded-sm bg-muted/30" />
					<Skeleton class="h-8 w-[76%] rounded-sm bg-muted/30" />
				</div>
				<div class="mt-auto">
					<Skeleton class="h-8 w-32 rounded-sm bg-muted/35" />
				</div>
			</section>

			<section class="flex h-full flex-col border-l border-sidebar-border/10 px-4 pt-4 pb-8">
				<div class="mb-4 flex items-center justify-between px-2">
					<Skeleton class="h-3 w-24 rounded-sm bg-muted/35" />
					<div class="flex gap-2">
						<Skeleton class="size-8 rounded-sm bg-muted/35" />
						<Skeleton class="size-8 rounded-sm bg-muted/30" />
					</div>
				</div>
				<Skeleton class="mx-2 mb-4 h-[34px] rounded-sm bg-muted/30" />
				<div class="space-y-5 px-2">
					<div class="space-y-2">
						<Skeleton class="h-3 w-16 rounded-sm bg-muted/25" />
						<Skeleton class="h-16 w-full rounded-xl bg-muted/35" />
						<Skeleton class="h-16 w-full rounded-xl bg-muted/30" />
					</div>
					<div class="space-y-2">
						<Skeleton class="h-3 w-20 rounded-sm bg-muted/25" />
						<Skeleton class="h-16 w-full rounded-xl bg-muted/30" />
						<Skeleton class="h-16 w-[92%] rounded-xl bg-muted/25" />
					</div>
				</div>
			</section>

			<section
				class="flex h-full flex-col border-l border-sidebar-border/10 bg-card px-12 pt-10 pb-8"
			>
				<div class="mb-8 space-y-4">
					<p class="text-[10px] font-bold tracking-[0.3em] text-muted-foreground/50 uppercase">
						Loading your notes...
					</p>
					<Skeleton class="h-12 w-[48%] rounded-sm bg-muted/30" />
					<Skeleton class="h-5 w-[30%] rounded-sm bg-muted/20" />
				</div>
				<div class="space-y-4">
					<Skeleton class="h-5 w-full rounded-sm bg-muted/20" />
					<Skeleton class="h-5 w-[96%] rounded-sm bg-muted/20" />
					<Skeleton class="h-5 w-[88%] rounded-sm bg-muted/20" />
					<Skeleton class="h-5 w-[92%] rounded-sm bg-muted/20" />
					<Skeleton class="h-5 w-[84%] rounded-sm bg-muted/20" />
				</div>
			</section>
		</div>
	{:else}
		<Sidebar.Provider class="flex h-full">
			<div
				class={[
					'h-full shrink-0 overflow-hidden',
					activeResizeHandle && 'pointer-events-none select-none'
				]}
				style={`width: ${sidebarWidth}px;`}
			>
				<Folders />
			</div>
			<div
				class="pane-resize-handle hidden shrink-0 md:flex"
				role="separator"
				aria-label="Resize folders pane"
				aria-orientation="vertical"
				aria-valuemin={MIN_SIDEBAR_WIDTH}
				aria-valuemax={Math.max(MIN_SIDEBAR_WIDTH, getLayoutMetrics().maxSidebarWidth)}
				aria-valuenow={Math.round(sidebarWidth)}
				data-active={activeResizeHandle === 'sidebar' ? 'true' : undefined}
				onpointerdown={(event) => startResize(event, 'sidebar')}
			>
				<span class="pane-resize-grip" aria-hidden="true"></span>
			</div>
			<div
				class={[
					'h-full shrink-0 overflow-hidden border-l border-sidebar-border/10',
					activeResizeHandle && 'pointer-events-none select-none'
				]}
				style={`width: ${noteListWidth}px;`}
			>
				<NoteItems />
			</div>
			<div
				class="pane-resize-handle hidden shrink-0 md:flex"
				role="separator"
				aria-label="Resize note list pane"
				aria-orientation="vertical"
				aria-valuemin={MIN_NOTE_LIST_WIDTH}
				aria-valuemax={Math.max(MIN_NOTE_LIST_WIDTH, getLayoutMetrics().maxNoteListWidth)}
				aria-valuenow={Math.round(noteListWidth)}
				data-active={activeResizeHandle === 'note-list' ? 'true' : undefined}
				onpointerdown={(event) => startResize(event, 'note-list')}
			>
				<span class="pane-resize-grip" aria-hidden="true"></span>
			</div>
			<main
				class={[
					'min-w-0 flex-1 border-l border-sidebar-border/10 bg-card',
					activeResizeHandle && 'pointer-events-none select-none'
				]}
			>
				{@render children?.()}
			</main>
		</Sidebar.Provider>
	{/if}
</div>

<Alert dialog={uiStore.appDialog} />

<style>
	.pane-resize-handle {
		width: 10px;
		align-items: center;
		justify-content: center;
		background: hsl(var(--background));
		cursor: col-resize;
		transition: background-color 150ms ease;
	}

	.pane-resize-handle:hover,
	.pane-resize-handle:focus-visible,
	.pane-resize-handle[data-active='true'] {
		background: hsl(var(--accent) / 0.45);
		outline: none;
	}

	.pane-resize-grip {
		height: 68px;
		width: 2px;
		border-radius: 9999px;
		background: hsl(var(--border));
		box-shadow: 0 -10px 0 hsl(var(--border)), 0 10px 0 hsl(var(--border));
	}
</style>
