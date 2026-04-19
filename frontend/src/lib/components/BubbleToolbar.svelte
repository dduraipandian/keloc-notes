<script lang="ts">
	import type { Editor } from '@tiptap/core';
	import { Bold, Italic, Strikethrough, Code, Heading1, Heading2 } from 'lucide-svelte';

	interface Props {
		editor: Editor | null;
		editorEl: HTMLElement | null;
	}

	let { editor, editorEl } = $props();

	function toggleFormat(format: 'bold' | 'italic' | 'strike' | 'code') {
		if (!editor) return;
		if (format === 'bold') {
			editor.chain().focus().toggleBold().run();
		} else if (format === 'italic') {
			editor.chain().focus().toggleItalic().run();
		} else if (format === 'strike') {
			editor.chain().focus().toggleStrike().run();
		} else if (format === 'code') {
			editor.chain().focus().toggleCode().run();
		}
	}

	function toggleHeading(level: 1 | 2) {
		if (!editor) return;
		editor.chain().focus().toggleHeading({ level }).run();
	}
</script>

<div class="bubble-toolbar">
	<button
		class={editor?.isActive('bold') ? 'bubble-btn is-active' : 'bubble-btn'}
		onclick={() => toggleFormat('bold')}
		disabled={!editor}
		title="Bold (⌘B)"
		aria-label="Bold"
	>
		<Bold size={16} />
	</button>

	<button
		class={editor?.isActive('italic') ? 'bubble-btn is-active' : 'bubble-btn'}
		onclick={() => toggleFormat('italic')}
		disabled={!editor}
		title="Italic (⌘I)"
		aria-label="Italic"
	>
		<Italic size={16} />
	</button>

	<button
		class={editor?.isActive('strike') ? 'bubble-btn is-active' : 'bubble-btn'}
		onclick={() => toggleFormat('strike')}
		disabled={!editor}
		title="Strikethrough (⌘⇧X)"
		aria-label="Strikethrough"
	>
		<Strikethrough size={16} />
	</button>

	<button
		class={editor?.isActive('code') ? 'bubble-btn is-active' : 'bubble-btn'}
		onclick={() => toggleFormat('code')}
		disabled={!editor}
		title="Code (⌘E)"
		aria-label="Code"
	>
		<Code size={16} />
	</button>

	<div class="bubble-divider"></div>

	<button
		class={editor?.isActive('heading', { level: 1 }) ? 'bubble-btn is-active' : 'bubble-btn'}
		onclick={() => toggleHeading(1)}
		disabled={!editor}
		title="Heading 1"
		aria-label="H1"
	>
		<Heading1 size={16} />
	</button>

	<button
		class={editor?.isActive('heading', { level: 2 }) ? 'bubble-btn is-active' : 'bubble-btn'}
		onclick={() => toggleHeading(2)}
		disabled={!editor}
		title="Heading 2"
		aria-label="H2"
	>
		<Heading2 size={16} />
	</button>
</div>

<style>
	.bubble-toolbar {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 6px;
		background: var(--background);
		border: 1px solid var(--border);
		border-radius: 6px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}

	.bubble-btn {
		padding: 4px 6px;
		border-radius: 3px;
		background: transparent;
		border: none;
		color: var(--muted-foreground);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 100ms;
	}

	.bubble-btn:hover:not(:disabled) {
		background: var(--accent);
		color: var(--foreground);
	}

	.bubble-btn.is-active {
		background: var(--accent);
		color: var(--foreground);
	}

	.bubble-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.bubble-divider {
		width: 1px;
		height: 16px;
		background: var(--border);
		margin: 0 2px;
	}
</style>
