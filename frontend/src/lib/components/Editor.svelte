<script lang="ts">
	import { untrack } from 'svelte';
	import { Editor } from '@tiptap/core';
	import { BubbleMenu } from '@tiptap/extension-bubble-menu';
	import type { NoteItem } from '$lib/stores/notes.svelte';
	import { getNoteService, getPreferencesStore } from '$lib/stores/context';
	import { buildExtensions } from '$lib/editor/extensions';
	import { parseContent } from '$lib/editor/serializer';
	import { storeImageAsset } from '$lib/editor/imageHandler';
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

	const noteService = getNoteService();
	const preferencesStore = getPreferencesStore();

	const showFixedToolbar = $derived(
		['fixed', 'both'].includes(preferencesStore.editorToolbar ?? 'fixed')
	);
	const showBubbleMenu = $derived(
		['bubble', 'both'].includes(preferencesStore.editorToolbar ?? 'fixed')
	);

	async function handleImageInsert(): Promise<void> {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'image/*';
		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) return;
			try {
				const src = await storeImageAsset(note.id, file);
				editor?.chain().focus().setImage({ src }).run();
			} catch (err) {
				console.error('Image insert failed:', err);
			}
		};
		input.click();
	}

	function handleDrop(e: DragEvent): void {
		if (readonly) return;
		const files = [...(e.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith('image/'));
		if (!files.length) return;
		e.preventDefault();
		e.stopPropagation();
		files.forEach((f) => processImageFile(f));
	}

	function handlePaste(e: ClipboardEvent): void {
		if (readonly) return;
		const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'));
		if (!files.length) return;
		e.preventDefault();
		files.forEach((f) => processImageFile(f));
	}

	async function processImageFile(file: File): Promise<void> {
		try {
			const src = await storeImageAsset(note.id, file);
			editor?.chain().focus().setImage({ src }).run();
		} catch (err) {
			console.error('Image insert failed:', err);
		}
	}

	$effect(() => {
		if (!editorContainer) return;

		const { initialContent, noteId, isReadonly, bubbleEl } = untrack(() => ({
			initialContent: parseContent(note.content),
			noteId: note.id,
			isReadonly: readonly,
			bubbleEl: bubbleMenuEl
		}));

		const extensions = [
			...buildExtensions({
				placeholder: 'Start writing…',
				readonly: isReadonly
			}),
			BubbleMenu.configure({ element: bubbleEl ?? undefined })
		];

		const instance = new Editor({
			element: editorContainer,
			extensions,
			content: initialContent,
			editable: !isReadonly,
			onUpdate({ editor: e }) {
				const json = JSON.stringify(e.getJSON());
				noteService.update(noteId, { content: json });
			}
		});

		editor = instance;

		return () => {
			instance.destroy();
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
		<EditorToolbar
			{editor}
			onImageInsert={handleImageInsert}
			enabledLanguages={preferencesStore.enabledLanguages ?? []}
		/>
	{/if}

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
	}

	.bubble-menu {
		position: absolute;
	}

	.editor-content {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
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

	.editor-content :global(.editor-image-wrapper) {
		display: block;
		margin: 1rem 0;
	}

	.editor-content :global(.editor-image) {
		max-width: 100%;
		border-radius: 4px;
	}

	.editor-content :global(.broken-image) {
		opacity: 0.4;
		border: 1px dashed var(--destructive);
	}
</style>
