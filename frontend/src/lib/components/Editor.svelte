<script lang="ts">
	import { untrack } from 'svelte';
	import { Editor } from '@tiptap/core';
	import { BubbleMenu } from '@tiptap/extension-bubble-menu';
	import { toast } from 'svelte-sonner';
	import type { NoteItem } from '$lib/stores/notes.svelte';
	import { getNoteService, getPreferencesStore } from '$lib/stores/context';
	import { buildExtensions } from '$lib/editor/extensions';
	import { parseContent } from '$lib/editor/serializer';
	import {
		collectAssetIds,
		clampImageProcessingConcurrency,
		dehydrateAssetSources,
		processImageFiles,
		hydrateAssetSources,
		resolveAssetUrl,
		revokeAssetUrl,
		selectAcceptedImageFiles
	} from '$lib/editor/imageHandler';
	import EditorToolbar from './EditorToolbar.svelte';
	import BubbleToolbar from './BubbleToolbar.svelte';

	interface Props {
		note: NoteItem;
		readonly?: boolean;
	}

	let { note, readonly = false } = $props();

	let editorContainer: HTMLElement | undefined = $state();
	let bubbleMenuEl: HTMLElement | undefined = $state();
	let editor = $state<Editor | null>(null);
	let sessionAssetIds = new Set<string>();

	const noteService = getNoteService();
	const preferencesStore = getPreferencesStore();

	const showFixedToolbar = $derived(
		['fixed', 'both'].includes(preferencesStore.editorToolbar ?? 'fixed')
	);
	const showBubbleMenu = $derived(
		['bubble', 'both'].includes(preferencesStore.editorToolbar ?? 'fixed')
	);

	function formatDate(dateStr: string) {
		if (!dateStr) return '';
		return new Date(dateStr).toLocaleDateString(undefined, {
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	async function handleImageInsert(): Promise<void> {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'image/*';
		input.onchange = async () => {
			const files = [...(input.files ?? [])];
			if (!files.length) return;
			await handleIncomingFiles(files);
		};
		input.click();
	}

	function handleDrop(e: DragEvent): void {
		if (readonly) return;
		const files = [...(e.dataTransfer?.files ?? [])];
		if (!files.length) return;
		e.preventDefault();
		e.stopPropagation();
		void handleIncomingFiles(files);
	}

	function handlePaste(e: ClipboardEvent): void {
		if (readonly) return;
		const files = [...(e.clipboardData?.files ?? [])];
		if (!files.length) return;
		e.preventDefault();
		void handleIncomingFiles(files);
	}

	function notifyImageFailure(file: File, reason: string): void {
		const fileName = file.name || 'image';
		toast.error(`Could not add ${fileName}`, { description: reason });
	}

	function rememberSessionAssetIds(nextAssetIds: Set<string>): void {
		sessionAssetIds = new Set([...sessionAssetIds, ...nextAssetIds]);
	}

	async function handleIncomingFiles(files: File[]): Promise<void> {
		const selection = selectAcceptedImageFiles(files);
		selection.rejected.forEach(({ file, reason }) => notifyImageFailure(file, reason));

		if (!selection.accepted.length) return;

		const concurrency = clampImageProcessingConcurrency(
			preferencesStore.imageProcessingConcurrency
		);
		const results = await processImageFiles(note.id, selection.accepted, { concurrency });

		for (const result of results) {
			if (result.src) {
				const assetId = result.src.slice(6);
				const resolvedUrl = await resolveAssetUrl(assetId);
				if (!resolvedUrl) {
					notifyImageFailure(result.file, 'Stored image could not be loaded.');
					continue;
				}

				editor?.chain().focus().setImage({ src: resolvedUrl, assetId } as never).run();
				rememberSessionAssetIds(new Set([assetId]));
				continue;
			}

			notifyImageFailure(result.file, result.error?.message ?? 'Image processing failed.');
		}
	}

	$effect(() => {
		if (!editorContainer) return;

		const { parsedContent, noteId, isReadonly, bubbleEl } = untrack(() => ({
			parsedContent: parseContent(note.content),
			noteId: note.id,
			isReadonly: readonly,
			bubbleEl: bubbleMenuEl
		}));
		let disposed = false;
		let instance: Editor | null = null;

		const extensions = [
			...buildExtensions({
				placeholder: 'Start writing…',
				readonly: isReadonly
			}),
			BubbleMenu.configure({ element: bubbleEl ?? undefined })
		];

		void (async () => {
			const hydratedContent = await hydrateAssetSources(parsedContent);
			const hydratedAssetIds = collectAssetIds(hydratedContent);

			if (disposed) {
				hydratedAssetIds.forEach((assetId) => revokeAssetUrl(assetId));
				return;
			}

			rememberSessionAssetIds(hydratedAssetIds);

			instance = new Editor({
				element: editorContainer,
				extensions,
				content: hydratedContent,
				editable: !isReadonly,
				onUpdate({ editor: e }) {
					const runtimeDoc = e.getJSON();
					rememberSessionAssetIds(collectAssetIds(runtimeDoc));
					const persistedDoc = dehydrateAssetSources(runtimeDoc);
					noteService.update(noteId, { content: JSON.stringify(persistedDoc) });
				}
			});

			editor = instance;
		})();

		return () => {
			disposed = true;
			instance?.destroy();
			sessionAssetIds.forEach((assetId) => revokeAssetUrl(assetId));
			sessionAssetIds = new Set();
			editor = null;
		};
	});
</script>

<div class="editor-root" role="textbox" tabindex={0} ondrop={handleDrop} ondragover={(e) => e.preventDefault()} onpaste={handlePaste}>
	<!-- Bubble menu anchor (BubbleMenu extension controls its visibility) -->
	<div bind:this={bubbleMenuEl} class="bubble-menu" style="display:none">
		{#if editor && showBubbleMenu}
			<BubbleToolbar {editor} editorEl={editorContainer} />
		{/if}
	</div>

	<!-- Fixed toolbar -->
	{#if showFixedToolbar && editor}
		<div class="editor-toolbar-shell">
			<div class="editor-toolbar-inner">
				<EditorToolbar
					{editor}
					onImageInsert={handleImageInsert}
					enabledLanguages={preferencesStore.enabledLanguages ?? []}
				/>
			</div>
		</div>
	{/if}

	<div class="editor-note-header">
		<div class="editor-note-date">{formatDate(note.updatedAt)}</div>
		<textarea
			value={note.title}
			oninput={(e) =>
				noteService.update(note.id, {
					title: (e.target as HTMLTextAreaElement).value
				})}
			placeholder="Note Title"
			readonly={readonly}
			rows="1"
			class="editor-note-title"
			spellcheck="false"
			onkeydown={(e) => {
				if (e.key === 'Enter') e.preventDefault();
			}}
		></textarea>
	</div>

	<!-- Tiptap mounts into this div -->
	<div
		bind:this={editorContainer}
		class="editor-content prose prose-sm dark:prose-invert max-w-none"
	></div>
</div>

<style>
	.editor-root {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 100%;
		position: relative;
	}

	.bubble-menu {
		position: absolute;
	}

	.editor-toolbar-shell {
		position: sticky;
		top: 0;
		z-index: 10;
		margin: 0 -3rem;
		padding: 0;
		background:
			linear-gradient(to bottom, color-mix(in srgb, var(--card) 96%, transparent), color-mix(in srgb, var(--card) 88%, transparent));
		backdrop-filter: blur(18px);
		border-bottom: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
	}

	.editor-toolbar-inner {
		width: 100%;
		padding: 0;
	}

	.editor-content {
		flex: 1;
		min-height: 0;
		padding: 0 1rem 1rem;
	}

	.editor-note-header {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		padding: 2rem 1rem 1.5rem;
	}

	.editor-note-date {
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--muted-foreground) 42%, transparent);
	}

	.editor-note-title {
		width: 100%;
		resize: none;
		border: none;
		background: transparent;
		color: var(--foreground);
		font-size: clamp(2.3rem, 4vw, 3.4rem);
		font-weight: 800;
		line-height: 0.95;
		letter-spacing: -0.04em;
		outline: none;
		font-family: inherit;
	}

	.editor-note-title::placeholder {
		color: color-mix(in srgb, var(--muted-foreground) 25%, transparent);
	}

	.editor-content :global(.ProseMirror) {
		outline: none;
		min-height: 100%;
	}

	.editor-content :global(p.is-editor-empty:first-child::before) {
		content: attr(data-placeholder);
		color: var(--muted-foreground);
		opacity: 0.3;
		pointer-events: none;
		float: left;
		height: 0;
	}

	.editor-content :global(pre.code-block) {
		background: var(--muted);
		border-radius: 6px;
		padding: 1rem;
		overflow-x: auto;
	}

	.editor-content :global(pre.code-block code) {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.875rem;
	}

	.editor-content :global([data-resize-container]) {
		display: flex;
		justify-content: flex-start;
		margin: 1.25rem 0;
	}

	.editor-content :global([data-resize-wrapper]) {
		display: inline-block;
		max-width: 100%;
	}

	.editor-content :global([data-resize-wrapper] img) {
		display: block;
		max-width: 100%;
		border-radius: 4px;
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--border) 55%, transparent);
	}

	.editor-content :global(.ProseMirror-selectednode[data-resize-container] [data-resize-wrapper] img),
	.editor-content :global([data-resize-container][data-resize-state='true'] [data-resize-wrapper] img) {
		box-shadow:
			0 0 0 2px color-mix(in srgb, var(--ring) 70%, transparent),
			0 10px 28px color-mix(in srgb, black 14%, transparent);
	}

	.editor-content :global([data-resize-handle]) {
		width: 14px;
		height: 14px;
		border-radius: 999px;
		border: 2px solid var(--card);
		background: var(--ring);
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--ring) 65%, transparent);
		opacity: 0;
		transform: scale(0.82);
		transition:
			opacity 140ms ease,
			transform 140ms ease,
			box-shadow 140ms ease;
		pointer-events: none;
		touch-action: none;
	}

	.editor-content :global([data-resize-handle*='top']) {
		margin-top: -7px;
	}

	.editor-content :global([data-resize-handle*='bottom']) {
		margin-bottom: -7px;
	}

	.editor-content :global([data-resize-handle*='left']) {
		margin-left: -7px;
	}

	.editor-content :global([data-resize-handle*='right']) {
		margin-right: -7px;
	}

	.editor-content :global([data-resize-handle='top-left']),
	.editor-content :global([data-resize-handle='bottom-right']) {
		cursor: nwse-resize;
	}

	.editor-content :global([data-resize-handle='top-right']),
	.editor-content :global([data-resize-handle='bottom-left']) {
		cursor: nesw-resize;
	}

	.editor-content :global(.ProseMirror-selectednode[data-resize-container] [data-resize-handle]),
	.editor-content :global([data-resize-container][data-resize-state='true'] [data-resize-handle]) {
		opacity: 1;
		transform: scale(1);
		pointer-events: auto;
	}

	.editor-content :global(.broken-image) {
		opacity: 0.4;
		border: 1px dashed var(--destructive);
	}
</style>
