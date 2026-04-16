<script lang="ts">
	import './layout.css';
	import { onMount } from 'svelte';
	import { folderStore } from '$lib/stores/folders.svelte';
	import { notesStore } from '$lib/stores/notes.svelte';
	import { selectionStore } from '$lib/stores/selection.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import Alert from './alert.svelte';
	import Folders from '$lib/components/Folders.svelte';
	import NoteItems from '$lib/components/NoteItems.svelte';
	import { EventsEmit, EventsOn, Quit, WindowSetTitle } from '$lib/wailsjs/runtime/runtime';
	import { uiStore } from '$lib/stores/dialog.svelte';

	let { children } = $props();

	let isInitializing = $state(true);
	let initError = $state<string | null>(null);

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
		const offBeforeClose = EventsOn('app:before-close', async () => {
			try {
				await notesStore.flushAllPendingWrites();
			} finally {
				EventsEmit('app:flush-complete');
			}
		});

		void (async () => {
			try {
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
		<Sidebar.Provider class="h-full">
			<Folders />
			<NoteItems />
			<main class="flex-1 border-l border-sidebar-border/10 bg-card">
				{@render children?.()}
			</main>
		</Sidebar.Provider>
	{/if}
</div>

<Alert dialog={uiStore.appDialog} />
