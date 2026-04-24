<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { FolderStore } from '$lib/stores/folders.svelte';
	import { NotesStore } from '$lib/stores/notes.svelte';
	import { SelectionStore } from '$lib/stores/selection.svelte';
	import { settingsRepository } from '$lib/infrastructure/repositories';
	import { ThemeStore } from '$lib/stores/theme.svelte';
	import { UIStateStore } from '$lib/stores/uiState.svelte';
	import {
		setThemeStore,
		setUIStateStore,
		setPreferencesStore,
		setUIStore,
		setSelectionStore,
		setFolderStore,
		setNotesStore,
		setFolderService,
		setNoteService,
		setTrashService,
		setSearchService,
		setFolderSidebarView,
		setNoteListView
	} from '$lib/stores/context';
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
	import { UIStore } from '$lib/stores/dialog.svelte';
	import { FolderService, NoteService, TrashService, SearchService } from '$lib/stores/services';
	import { FolderSidebarView } from '$lib/views/folderSidebarView.svelte';
	import { NoteListView } from '$lib/views/noteListView.svelte';
	import { initMenuBridge, initMenuStateEffect } from '$lib/menu/menuBridge.svelte';
	import About from '$lib/components/About.svelte';
	import Settings from '$lib/components/Settings.svelte';
	import { Toaster, toast } from '$lib/components/ui/sonner';
	import { PreferencesStore } from '$lib/stores/preferences.svelte';
	import { hasWailsRuntime } from '$lib/wails.svelte';
	import { OnImportBackup, SaveBackupFile, UpdateMenuState } from '$lib/wailsjs/go/main/App';
	import { exportBackup } from '$lib/backup/backup';
	import { menu } from '$lib/wailsjs/go/models';
	import { setDatabaseBlockedHandler } from '$lib/infrastructure/idbr';
	import BackupImportOverlay from '$lib/components/BackupImportOverlay.svelte';
	import MarkdownImportConflictDialog from '$lib/components/MarkdownImportConflictDialog.svelte';
	import { runShutdownFlush } from '$lib/shutdownFlush';
	import {
		buildDatabaseBlockedMessage,
		buildStartupRecoveryGuidance,
		buildStartupRecoveryDiagnostics,
		consumePendingStartupRecoveryImport,
		copyStartupRecoveryDiagnostics,
		exportBackupAndResetLocalDataForRecovery
	} from '$lib/startupRecovery';
	import { ClipboardSetText } from '$lib/wailsjs/runtime/runtime';

	const folderStore = new FolderStore();
	const themeStore = new ThemeStore();
	const uiStateStore = new UIStateStore();
	const preferencesStore = new PreferencesStore();
	const uiStore = new UIStore();
	const selectionStore = new SelectionStore(folderStore);
	const notesStore = new NotesStore();

	setFolderStore(folderStore);
	setNotesStore(notesStore);
	setThemeStore(themeStore);
	setUIStateStore(uiStateStore);
	setPreferencesStore(preferencesStore);
	setUIStore(uiStore);
	setSelectionStore(selectionStore);

	const folderService = new FolderService(folderStore, notesStore, selectionStore);
	const noteService = new NoteService(folderStore, notesStore, selectionStore);
	const trashService = new TrashService(folderStore, notesStore, selectionStore);
	const searchService = new SearchService(folderStore, notesStore, noteService);

	setFolderService(folderService);
	setNoteService(noteService);
	setTrashService(trashService);
	setSearchService(searchService);

	// Break circular dependency
	notesStore.setSearchService(searchService);

	setDatabaseBlockedHandler((current, blocked) => {
		uiStore.confirmAppQuit(
			'Database blocked',
			buildDatabaseBlockedMessage(current, blocked),
			() => {}
		);
	});

	const folderSidebarView = new FolderSidebarView(
		{ selection: selectionStore, ui: uiStore },
		folderStore,
		folderService,
		noteService,
		trashService
	);
	const noteListView = new NoteListView(
		{ selection: selectionStore },
		folderStore,
		notesStore,
		folderService,
		noteService,
		searchService
	);

	setFolderSidebarView(folderSidebarView);
	setNoteListView(noteListView);

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
	let showAbout = $state(false);
	let showSettings = $state(false);
	let liveSidebarWidth = DEFAULT_SIDEBAR_WIDTH;
	let liveNoteListWidth = DEFAULT_NOTE_LIST_WIDTH;
	let resizeStartPointerX: number | null = null;
	let resizeStartSidebarWidth = DEFAULT_SIDEBAR_WIDTH;
	let resizeStartNoteListWidth = DEFAULT_NOTE_LIST_WIDTH;

	$effect(() => {
		document.documentElement.dataset.appReady = isInitializing ? 'false' : 'true';
	});

	$effect(() => {
		document.documentElement.style.setProperty(
			'--folder-accent',
			preferencesStore.folderAccentColor
		);
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

		if (uiStore.hasOpenDialog()) {
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
					activateEditor: () => {
						uiStateStore.setActivePane('editor');
						setTimeout(() => {
							const titleInput = document.querySelector(
								'[data-testid="editor-pane"] textarea:first-of-type'
							) as HTMLTextAreaElement;
							if (titleInput) titleInput.focus();
						}, 10);
					},
					requestDeleteNote: (id, title) =>
						uiStore.confirmNoteDelete(title, () => noteService.delete(id))
				}
			)
		) {
			return;
		}

		handleGlobalShortcut(event, {
			focusSearch: () => {
				uiStateStore.setActivePane('notes');
				const input = document.querySelector(
					'[data-testid="notes-pane"] input'
				) as HTMLInputElement;
				if (input) input.focus();
			}
		});
	}

	$effect(() => {
		const selectedNote = notesStore.selectedNote;
		const selectedNoteTitle = selectedNote?.title.trim();
		const selectedFolderId = selectionStore.selectedFolderID;
		const selectedFolderTitle = selectedFolderId ? selectionStore.getSelectedFolder()?.title : null;
		const nextTitle = selectedNoteTitle || selectedFolderTitle || 'Keloc Notes';

		if (hasWailsRuntime()) {
			WindowSetTitle(isInitializing ? 'Keloc Notes' : nextTitle);
		} else {
			document.title = isInitializing ? 'Keloc Notes' : nextTitle;
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

	function resetStartupStateForRetry() {
		folderStore.resetForStartupRetry();
		selectionStore.resetForStartupRetry();
		notesStore.resetForStartupRetry();
	}

	async function initializeApplication() {
		isInitializing = true;
		initError = null;
		resetStartupStateForRetry();

		try {
			// manual testing
			// throw new Error('Manual startup recovery test');
			// throw new Error('IndexedDB UnknownError: database file may be corrupted');
			// throw new Error('Database upgrade is blocked by another Keloc Notes window.');
			console.log('[DEBUG] Init starting');
			const settings = await settingsRepository.getAll();
			console.log('[DEBUG] Settings loaded');
			themeStore.init(settings.applicationTheme);
			await preferencesStore.init(settings);
			console.log('[DEBUG] Preferences initialized');
			applyPaneWidths(
				settings.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH,
				settings.noteListWidth ?? DEFAULT_NOTE_LIST_WIDTH,
				true
			);
			await folderStore.init();
			console.log('[DEBUG] Folders initialized');
			await selectionStore.init();
			console.log('[DEBUG] Selection initialized');
			await notesStore.init();
			console.log('[DEBUG] Notes initialized');
			folderStore.onPersistError = (err) => {
				uiStore.confirmAppQuit('Save failed', String(err), () => {});
			};
			selectionStore.onPersistError = (err) => {
				uiStore.confirmAppQuit('Save failed', String(err), () => {});
			};
			notesStore.onPersistError = (err) => {
				uiStore.confirmAppQuit('Save failed', String(err), () => {});
			};

			uiStore.closeDialogs();

			if (consumePendingStartupRecoveryImport() && hasWailsRuntime()) {
				setTimeout(() => {
					void OnImportBackup();
				}, 50);
			}
		} catch (err) {
			const startupError = err instanceof Error ? err : new Error('An unexpected error occurred.');
			initError = startupError.message;
			const recoveryGuidance = buildStartupRecoveryGuidance(startupError);
			const diagnostics = buildStartupRecoveryDiagnostics(startupError);

			uiStore.showStartupRecoveryDialog({
				errorMessage: initError,
				recoveryGuidance,
				onRetry: () => {
					void initializeApplication();
				},
				onCopyDiagnostics: () => {
					void copyStartupRecoveryDiagnostics(diagnostics, {
						writeText: hasWailsRuntime() ? (text) => ClipboardSetText(text) : undefined
					})
						.then(() => {
							toast.success('Startup diagnostics copied to the clipboard.');
						})
						.catch((copyError) => {
							toast.error(
								copyError instanceof Error
									? copyError.message
									: 'Failed to copy startup diagnostics.'
							);
						});
				},
				onResetLocalData: () => {
					void exportBackupAndResetLocalDataForRecovery({
						exportBackupJson: () => exportBackup(noteService, folderStore, notesStore),
						saveBackupFile: (content) => SaveBackupFile(content)
					}).catch((resetError) => {
						toast.error(
							resetError instanceof Error
								? resetError.message
								: 'Failed to back up and reset local data.'
						);
					});
				},
				onResetAndImportBackup: () => {
					void exportBackupAndResetLocalDataForRecovery({
						exportBackupJson: () => exportBackup(noteService, folderStore, notesStore),
						saveBackupFile: (content) => SaveBackupFile(content),
						importBackupAfterReset: true
					}).catch((resetError) => {
						toast.error(
							resetError instanceof Error
								? resetError.message
								: 'Failed to back up and reset local data.'
						);
					});
				},
				onQuit: hasWailsRuntime() ? () => void Quit() : () => {}
			});
		} finally {
			isInitializing = false;
		}
	}

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
					await runShutdownFlush({
						uiState: uiStateStore,
						flushPendingWrites: () => notesStore.flushAllPendingWrites(),
						emitFlushComplete: () => {
							EventsEmit('app:flush-complete');
						}
					});
				})
			: () => {};

		const offMenuBridge = hasWailsRuntime()
			? initMenuBridge(
					{
						uiState: uiStateStore,
						theme: themeStore,
						ui: uiStore,
						selection: selectionStore,
						folders: folderStore,
						notes: notesStore,
						folderService,
						noteService,
						trashService
					},
					{
						onOpenAbout: () => {
							showAbout = true;
						},
						onOpenPreferences: () => {
							showSettings = true;
						}
					}
				)
			: () => {};

		const offMenuState = hasWailsRuntime()
			? initMenuStateEffect({ theme: themeStore, notes: notesStore })
			: () => {};

		void initializeApplication();

		return () => {
			offBeforeClose?.();
			offMenuBridge();
			offMenuState();
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
					activeResizeHandle && 'pointer-events-none select-none',
					!uiStateStore.sidebarVisible && 'hidden'
				]}
				style={uiStateStore.sidebarVisible
					? 'width: var(--app-sidebar-width);'
					: 'width: 0; display: none;'}
			>
				<Folders />
			</div>
			<div
				class={[
					'pane-resize-handle hidden shrink-0 md:flex',
					!uiStateStore.sidebarVisible && 'hidden'
				]}
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
					activeResizeHandle && 'pointer-events-none select-none',
					!uiStateStore.noteListVisible && 'hidden'
				]}
				style={uiStateStore.noteListVisible
					? 'width: var(--app-note-list-width);'
					: 'width: 0; display: none;'}
			>
				<NoteItems />
			</div>
			<div
				class={[
					'pane-resize-handle hidden shrink-0 md:flex',
					!uiStateStore.noteListVisible && 'hidden'
				]}
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
<About
	bind:open={showAbout}
	onClose={() => {
		showAbout = false;
	}}
/>
<Settings
	bind:open={showSettings}
	onClose={() => {
		showSettings = false;
	}}
/>
<BackupImportOverlay
	open={uiStateStore.backupImportStatus?.active ?? false}
	eyebrow="Backup Import"
	title={uiStateStore.backupImportStatus?.title ?? ''}
	description={uiStateStore.backupImportStatus?.description ?? ''}
/>
<BackupImportOverlay
	open={uiStateStore.shutdownFlushStatus?.active ?? false}
	eyebrow="Saving Changes"
	title={uiStateStore.shutdownFlushStatus?.title ?? ''}
	description={uiStateStore.shutdownFlushStatus?.description ?? ''}
/>
<MarkdownImportConflictDialog uiState={uiStateStore} />
<Toaster />

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
