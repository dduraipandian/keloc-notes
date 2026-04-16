<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { folderStore } from '$lib/stores/folders.svelte';
	import { notesStore } from '$lib/stores/notes.svelte';
	import { selectionStore } from '$lib/stores/selection.svelte';
	import { settingsRepository } from '$lib/stores/repositories';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
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
	let paneLayoutRef = $state<HTMLDivElement | null>(null);
	let liveSidebarWidth = DEFAULT_SIDEBAR_WIDTH;
	let liveNoteListWidth = DEFAULT_NOTE_LIST_WIDTH;

	$effect(() => {
		document.documentElement.dataset.appReady = isInitializing ? 'false' : 'true';
	});

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
				window.innerWidth - liveSidebarWidth - MIN_EDITOR_WIDTH - RESIZE_HANDLE_WIDTH * 2
			)
		};
	}

	function resolvePaneWidths(
		nextSidebarWidth = liveSidebarWidth,
		nextNoteListWidth = liveNoteListWidth
	) {
		const maxSidebarWidth = Math.max(
			MIN_SIDEBAR_WIDTH,
			window.innerWidth - MIN_NOTE_LIST_WIDTH - MIN_EDITOR_WIDTH - RESIZE_HANDLE_WIDTH * 2
		);
		const normalizedSidebarWidth = clamp(nextSidebarWidth, MIN_SIDEBAR_WIDTH, maxSidebarWidth);
		const maxNoteListWidth = Math.max(
			MIN_NOTE_LIST_WIDTH,
			window.innerWidth - normalizedSidebarWidth - MIN_EDITOR_WIDTH - RESIZE_HANDLE_WIDTH * 2
		);

		return {
			sidebarWidth: normalizedSidebarWidth,
			noteListWidth: clamp(nextNoteListWidth, MIN_NOTE_LIST_WIDTH, maxNoteListWidth)
		};
	}

	function applyPaneWidths(
		nextSidebarWidth = liveSidebarWidth,
		nextNoteListWidth = liveNoteListWidth,
		commit = false
	) {
		const resolved = resolvePaneWidths(nextSidebarWidth, nextNoteListWidth);
		liveSidebarWidth = resolved.sidebarWidth;
		liveNoteListWidth = resolved.noteListWidth;
		paneLayoutRef?.style.setProperty('--app-sidebar-width', `${resolved.sidebarWidth}px`);
		paneLayoutRef?.style.setProperty('--app-note-list-width', `${resolved.noteListWidth}px`);

		if (commit) {
			sidebarWidth = resolved.sidebarWidth;
			noteListWidth = resolved.noteListWidth;
		}

		return resolved;
	}

	function flushResizeFrame() {
		if (!activeResizeHandle || pendingPointerX == null) return;

		if (activeResizeHandle === 'sidebar') {
			applyPaneWidths(pendingPointerX, liveNoteListWidth);
			return;
		}

		const noteListStartX = liveSidebarWidth + RESIZE_HANDLE_WIDTH;
		const nextNoteListWidth = pendingPointerX - noteListStartX;
		applyPaneWidths(liveSidebarWidth, nextNoteListWidth);
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
			settingsRepository.save('sidebarWidth', liveSidebarWidth),
			settingsRepository.save('noteListWidth', liveNoteListWidth)
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
		sidebarWidth = liveSidebarWidth;
		noteListWidth = liveNoteListWidth;
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
			applyPaneWidths(liveSidebarWidth, liveNoteListWidth, true);
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
				applyPaneWidths(
					settings.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH,
					settings.noteListWidth ?? DEFAULT_NOTE_LIST_WIDTH,
					true
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
				// isInitializing = false;
			}
		})();

		return () => {
			offBeforeClose?.();
			stopResize();
			if (resizeFrame != null) {
				cancelAnimationFrame(resizeFrame);
			}
			delete document.documentElement.dataset.appReady;
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
	<div
		class="h-full w-full"
		style={`--app-sidebar-width: ${sidebarWidth}px; --app-note-list-width: ${noteListWidth}px;`}
		bind:this={paneLayoutRef}
	>
		<Sidebar.Provider class="flex h-full w-full">
			<div
				class={[
					'h-full shrink-0 overflow-hidden',
					activeResizeHandle && 'pointer-events-none select-none'
				]}
				style="width: var(--app-sidebar-width);"
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
				style="width: var(--app-note-list-width);"
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
	</div>
</div>

<Alert dialog={uiStore.appDialog} />

<style>
	.pane-resize-handle {
		width: 10px;
		align-items: center;
		justify-content: center;
		background: hsl(var(--background));
		cursor: col-resize;
		position: relative;
		transition:
			background-color 150ms ease,
			box-shadow 150ms ease;
	}

	.pane-resize-handle::before {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			180deg,
			transparent 0%,
			hsl(var(--accent) / 0.16) 20%,
			hsl(var(--accent) / 0.28) 50%,
			hsl(var(--accent) / 0.16) 80%,
			transparent 100%
		);
		opacity: 0;
		transition: opacity 150ms ease;
	}

	.pane-resize-handle:hover,
	.pane-resize-handle:focus-visible,
	.pane-resize-handle[data-active='true'] {
		background: hsl(var(--accent) / 0.45);
		box-shadow:
			inset 1px 0 0 hsl(var(--accent-foreground) / 0.12),
			inset -1px 0 0 hsl(var(--accent-foreground) / 0.12);
		outline: none;
	}

	.pane-resize-handle:hover::before,
	.pane-resize-handle:focus-visible::before,
	.pane-resize-handle[data-active='true']::before {
		opacity: 1;
	}

	.pane-resize-grip {
		height: 68px;
		width: 2px;
		border-radius: 9999px;
		background: hsl(var(--border));
		box-shadow:
			0 -10px 0 hsl(var(--border)),
			0 10px 0 hsl(var(--border));
		position: relative;
		z-index: 1;
		transition:
			background-color 150ms ease,
			box-shadow 150ms ease,
			transform 150ms ease;
	}

	.pane-resize-handle:hover .pane-resize-grip,
	.pane-resize-handle:focus-visible .pane-resize-grip,
	.pane-resize-handle[data-active='true'] .pane-resize-grip {
		background: hsl(var(--accent-foreground) / 0.75);
		box-shadow:
			0 -10px 0 hsl(var(--accent-foreground) / 0.75),
			0 10px 0 hsl(var(--accent-foreground) / 0.75);
		transform: scaleY(1.08);
	}
</style>
