<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { folderStore } from '$lib/stores/folders.svelte';
	import { notesStore } from '$lib/stores/notes.svelte';
	import { selectionStore } from '$lib/stores/selection.svelte';
	import { settingsRepository } from '$lib/stores/repositories';
	import { themeStore } from '$lib/stores/theme.svelte';
	import {
		handleEscapeShortcut,
		handleFoldersPaneShortcut,
		handleGlobalShortcut,
		handleNotesPaneShortcut
	} from '$lib/keyboard/shortcuts';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import Alert from './alert.svelte';
	import Folders from '$lib/components/Folders.svelte';
	import NoteItems from '$lib/components/NoteItems.svelte';
	import { EventsEmit, EventsOn, Quit, WindowSetTitle } from '$lib/wailsjs/runtime/runtime';
	import { uiStore } from '$lib/stores/dialog.svelte';
	import { folderService, noteService } from '$lib/stores/services';
	import { folderSidebarView } from '$lib/views/folderSidebarView.svelte';
	import { noteListView } from '$lib/views/noteListView.svelte';
	import { uiStateStore } from '$lib/stores/uiState.svelte';

	let { children } = $props();

	const DEFAULT_SIDEBAR_WIDTH = 256;
	const DEFAULT_NOTE_LIST_WIDTH = 350;
	const MIN_SIDEBAR_WIDTH = 220;
	const MAX_SIDEBAR_WIDTH = 512;
	const MIN_NOTE_LIST_WIDTH = 280;
	const MAX_NOTE_LIST_WIDTH = 512;
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
	let resizeStartPointerX: number | null = null;
	let resizeStartSidebarWidth = DEFAULT_SIDEBAR_WIDTH;
	let resizeStartNoteListWidth = DEFAULT_NOTE_LIST_WIDTH;

	function hasWailsRuntime() {
		return (
			typeof window !== 'undefined' &&
			typeof (window as typeof window & { runtime?: unknown }).runtime !== 'undefined'
		);
	}

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
		const maxSidebarWidth = clamp(
			window.innerWidth - MIN_NOTE_LIST_WIDTH - MIN_EDITOR_WIDTH - RESIZE_HANDLE_WIDTH * 2,
			MIN_SIDEBAR_WIDTH,
			MAX_SIDEBAR_WIDTH
		);
		const normalizedSidebarWidth = clamp(nextSidebarWidth, MIN_SIDEBAR_WIDTH, maxSidebarWidth);
		const maxNoteListWidth = clamp(
			window.innerWidth - normalizedSidebarWidth - MIN_EDITOR_WIDTH - RESIZE_HANDLE_WIDTH * 2,
			MIN_NOTE_LIST_WIDTH,
			MAX_NOTE_LIST_WIDTH
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
		if (!activeResizeHandle || pendingPointerX == null || resizeStartPointerX == null) return;

		const pointerDelta = pendingPointerX - resizeStartPointerX;

		if (activeResizeHandle === 'sidebar') {
			applyPaneWidths(resizeStartSidebarWidth + pointerDelta, resizeStartNoteListWidth);
			return;
		}

		applyPaneWidths(resizeStartSidebarWidth, resizeStartNoteListWidth + pointerDelta);
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
		resizeStartPointerX = null;
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
		resizeStartPointerX = event.clientX;
		resizeStartSidebarWidth = liveSidebarWidth;
		resizeStartNoteListWidth = liveNoteListWidth;
		pendingPointerX = event.clientX;
		document.body.style.cursor = 'col-resize';
		document.body.style.userSelect = 'none';
	}

	function handleWindowKeyDown(event: KeyboardEvent) {
		if (
			handleEscapeShortcut(
				event,
				{
					closeDialogs: () => uiStore.closeDialogs(),
					cancelRename: () => folderService.cancelRename()
				},
				{
					hasDialogOpen: uiStore.hasOpenDialog(),
					isRenameActive: folderStore.editingId != null
				}
			)
		) {
			return;
		}

		if (
			handleFoldersPaneShortcut(
				event,
				{
					activePane: uiStateStore.activePane,
					isRenameActive: folderStore.editingId != null,
					navigableIds: folderSidebarView.getNavigableIds(),
					selectedFolderId: selectionStore.selectedFolderID,
					selectedFolderTreeItem:
						selectionStore.selectedFolderID != null
							? folderSidebarView.getNavigationItem(selectionStore.selectedFolderID)
							: null
				},
				{
					selectFolder: (id) => folderService.select(id),
					toggleFolder: (id) => folderService.toggle(id)
				}
			)
		) {
			return;
		}

		if (
			handleNotesPaneShortcut(
				event,
				{
					activePane: uiStateStore.activePane,
					visibleNoteIds: noteListView.getVisibleNoteIds(),
					selectedNoteId: notesStore.selectedNoteID,
					selectedNoteDeleteContext: noteListView.getSelectedNoteDeleteContext()
				},
				{
					selectNote: (id) => noteService.select(id),
					activateEditor: () => uiStateStore.setActivePane('editor'),
					requestDeleteNote: (id, title) =>
						uiStore.confirmNoteDelete(title, () => noteService.delete(id))
				}
			)
		) {
			return;
		}

		handleGlobalShortcut(event, {
			createNote: () => noteService.create(selectionStore.selectedFolderID ?? null),
			createFolder: () => folderService.create()
		});
	}

	$effect(() => {
		const selectedNote = notesStore.selectedNote;
		const selectedNoteTitle = selectedNote?.title.trim();
		const selectedFolderId = selectionStore.selectedFolderID;
		const selectedFolderTitle = selectedFolderId ? selectionStore.getSelectedFolder()?.title : null;
		const nextTitle = selectedNoteTitle || selectedFolderTitle || 'mdnotes';

		if (hasWailsRuntime()) {
			WindowSetTitle(isInitializing ? 'mdnotes' : nextTitle);
		} else {
			document.title = isInitializing ? 'mdnotes' : nextTitle;
		}
	});

	$effect(() => {
		const resolved = themeStore.resolvedTheme;
		if (resolved === 'dark') {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
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
		window.addEventListener('keydown', handleWindowKeyDown);

		const offBeforeClose = hasWailsRuntime()
			? EventsOn('app:before-close', async () => {
					try {
						await notesStore.flushAllPendingWrites();
					} finally {
						EventsEmit('app:flush-complete');
					}
				})
			: () => {};

		void (async () => {
			try {
				const settings = await settingsRepository.getAll();
				themeStore.init(settings.applicationTheme);
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
				uiStore.confirmAppQuit('Failed to Start', initError, hasWailsRuntime() ? Quit : () => {});
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
			delete document.documentElement.dataset.appReady;
			window.removeEventListener('resize', handleWindowResize);
			window.removeEventListener('pointermove', handleWindowPointerMove);
			window.removeEventListener('pointerup', handleWindowPointerUp);
			window.removeEventListener('keydown', handleWindowKeyDown);
			folderStore.onPersistError = null;
			selectionStore.onPersistError = null;
			notesStore.onPersistError = null;
		};
	});
</script>

<div class="h-screen overflow-hidden bg-background text-foreground">
	<div
		class="h-full w-full"
		style={`--app-sidebar-width: ${sidebarWidth}px; --app-note-list-width: ${noteListWidth}px;`}
		bind:this={paneLayoutRef}
	>
		<Sidebar.Provider class="flex h-full w-full">
			<div
				class={[
					'h-full shrink-0 overflow-hidden border-r border-sidebar-border/10',
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
				data-handle="sidebar"
				onpointerdown={(event) => startResize(event, 'sidebar')}
			>
				<span class="pane-resize-grip" aria-hidden="true"></span>
			</div>
			<div
				class={[
					'h-full shrink-0 overflow-hidden',
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
				data-handle="note-list"
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
		width: 0;
		overflow: visible;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: col-resize;
		position: relative;
		z-index: 10;
		transition: background-color 150ms ease;
	}

	.pane-resize-handle::before {
		content: '';
		position: absolute;
		inset: 0 -5px;
		background: transparent;
		z-index: -1;
		transition: background-color 150ms ease;
	}

	.pane-resize-handle:hover::before,
	.pane-resize-handle[data-active='true']::before {
		background: var(--accent);
		opacity: 0.15;
	}

	.pane-resize-handle[data-handle='sidebar']::before {
		transform: translateX(-2px);
	}

	.pane-resize-grip {
		height: 36px;
		width: 4px;
		border-radius: 9999px;
		background: oklch(1 0 0 / 0.12);
		box-shadow: 0 0 0 1px oklch(0 0 0 / 0.05);
		position: absolute;
		left: 0;
		margin-left: -4px;
		top: 50%;
		transform: translateY(-50%);
		z-index: 1;
		transition:
			background-color 150ms ease,
			transform 150ms ease;
	}

	.pane-resize-handle[data-handle='sidebar'] .pane-resize-grip {
		transform: translate(2px, -50%);
	}

	.pane-resize-handle[data-handle='note-list'] .pane-resize-grip {
		transform: translate(2px, -50%);
	}

	:global(.dark) .pane-resize-grip {
		background: oklch(1 0 0 / 0.12);
	}

	:root:not(.dark) .pane-resize-grip {
		background: oklch(0 0 0 / 0.08);
	}

	.pane-resize-handle:hover .pane-resize-grip,
	.pane-resize-handle[data-active='true'] .pane-resize-grip {
		background: oklch(1 0 0 / 0.25);
		transform: translateY(-50%) scaleX(1.5);
	}

	.pane-resize-handle[data-handle='note-list']:hover .pane-resize-grip,
	.pane-resize-handle[data-handle='note-list'][data-active='true'] .pane-resize-grip {
		transform: translate(2px, -50%) scaleX(1.5);
	}
</style>
