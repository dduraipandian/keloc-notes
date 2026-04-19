<script lang="ts">
	import type { Editor } from '@tiptap/core';
	import {
		Bold,
		Italic,
		Strikethrough,
		Heading1,
		Heading2,
		Heading3,
		List,
		ListOrdered,
		Code2,
		Minus,
		ImagePlus
	} from 'lucide-svelte';

	interface Props {
		editor: Editor | null;
		onImageInsert: () => void;
		enabledLanguages: string[];
	}

	let { editor, onImageInsert, enabledLanguages } = $props();

	let selectedLanguage = $state('plaintext');

	function toggleFormat(format: 'bold' | 'italic' | 'strike') {
		if (!editor) return;
		if (format === 'bold') {
			editor.chain().focus().toggleBold().run();
		} else if (format === 'italic') {
			editor.chain().focus().toggleItalic().run();
		} else if (format === 'strike') {
			editor.chain().focus().toggleStrike().run();
		}
	}

	function toggleHeading(level: 1 | 2 | 3) {
		if (!editor) return;
		editor.chain().focus().toggleHeading({ level }).run();
	}

	function toggleList(type: 'bullet' | 'ordered') {
		if (!editor) return;
		if (type === 'bullet') {
			editor.chain().focus().toggleBulletList().run();
		} else {
			editor.chain().focus().toggleOrderedList().run();
		}
	}

	function toggleCodeBlock() {
		if (!editor) return;
		editor.chain().focus().toggleCodeBlock().run();
	}

	function insertHorizontalRule() {
		if (!editor) return;
		editor.chain().focus().setHorizontalRule().run();
	}

	function updateCodeLanguage(e: Event) {
		if (!editor) return;
		const target = e.target as HTMLSelectElement;
		const language = target.value;
		editor.chain().focus().updateAttributes('codeBlock', { language }).run();
	}

	$effect(() => {
		if (editor?.isActive('codeBlock')) {
			const attrs = editor.getAttributes('codeBlock');
			selectedLanguage = attrs.language || 'plaintext';
		}
	});
</script>

<div class="editor-toolbar">
	<!-- Text marks -->
	<button
		class={editor?.isActive('bold') ? 'toolbar-btn is-active' : 'toolbar-btn'}
		onclick={() => toggleFormat('bold')}
		disabled={!editor}
		title="Bold (⌘B)"
		aria-label="Bold"
	>
		<Bold size={18} />
	</button>

	<button
		class={editor?.isActive('italic') ? 'toolbar-btn is-active' : 'toolbar-btn'}
		onclick={() => toggleFormat('italic')}
		disabled={!editor}
		title="Italic (⌘I)"
		aria-label="Italic"
	>
		<Italic size={18} />
	</button>

	<button
		class={editor?.isActive('strike') ? 'toolbar-btn is-active' : 'toolbar-btn'}
		onclick={() => toggleFormat('strike')}
		disabled={!editor}
		title="Strikethrough (⌘⇧X)"
		aria-label="Strikethrough"
	>
		<Strikethrough size={18} />
	</button>

	<div class="toolbar-divider"></div>

	<!-- Headings -->
	<button
		class={editor?.isActive('heading', { level: 1 }) ? 'toolbar-btn is-active' : 'toolbar-btn'}
		onclick={() => toggleHeading(1)}
		disabled={!editor}
		title="Heading 1"
		aria-label="H1"
	>
		<Heading1 size={18} />
	</button>

	<button
		class={editor?.isActive('heading', { level: 2 }) ? 'toolbar-btn is-active' : 'toolbar-btn'}
		onclick={() => toggleHeading(2)}
		disabled={!editor}
		title="Heading 2"
		aria-label="H2"
	>
		<Heading2 size={18} />
	</button>

	<button
		class={editor?.isActive('heading', { level: 3 }) ? 'toolbar-btn is-active' : 'toolbar-btn'}
		onclick={() => toggleHeading(3)}
		disabled={!editor}
		title="Heading 3"
		aria-label="H3"
	>
		<Heading3 size={18} />
	</button>

	<div class="toolbar-divider"></div>

	<!-- Lists -->
	<button
		class={editor?.isActive('bulletList') ? 'toolbar-btn is-active' : 'toolbar-btn'}
		onclick={() => toggleList('bullet')}
		disabled={!editor}
		title="Bullet list"
		aria-label="Bullet list"
	>
		<List size={18} />
	</button>

	<button
		class={editor?.isActive('orderedList') ? 'toolbar-btn is-active' : 'toolbar-btn'}
		onclick={() => toggleList('ordered')}
		disabled={!editor}
		title="Ordered list"
		aria-label="Ordered list"
	>
		<ListOrdered size={18} />
	</button>

	<div class="toolbar-divider"></div>

	<!-- Code block with language select -->
	<button
		class={editor?.isActive('codeBlock') ? 'toolbar-btn is-active' : 'toolbar-btn'}
		onclick={() => toggleCodeBlock()}
		disabled={!editor}
		title="Code block"
		aria-label="Code block"
	>
		<Code2 size={18} />
	</button>

	{#if editor?.isActive('codeBlock')}
		<select
			value={selectedLanguage}
			onchange={updateCodeLanguage}
			disabled={!editor}
			class="toolbar-select"
		>
			{#each enabledLanguages as lang}
				<option value={lang}>{lang}</option>
			{/each}
		</select>
	{/if}

	<div class="toolbar-divider"></div>

	<!-- Horizontal rule -->
	<button
		onclick={() => insertHorizontalRule()}
		disabled={!editor}
		class="toolbar-btn"
		title="Horizontal rule"
		aria-label="Horizontal rule"
	>
		<Minus size={18} />
	</button>

	<div class="toolbar-divider"></div>

	<!-- Image insert -->
	<button
		onclick={() => onImageInsert()}
		disabled={!editor}
		class="toolbar-btn"
		title="Insert image"
		aria-label="Image"
	>
		<ImagePlus size={18} />
	</button>
</div>

<style>
	.editor-toolbar {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 8px;
		background: var(--muted);
		border-bottom: 1px solid var(--border);
		flex-wrap: wrap;
	}

	.toolbar-btn {
		padding: 4px 6px;
		border-radius: 4px;
		background: transparent;
		border: none;
		color: var(--muted-foreground);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 120ms;
	}

	.toolbar-btn:hover:not(:disabled) {
		background: var(--accent);
	}

	.toolbar-btn.is-active {
		background: var(--accent);
		color: var(--foreground);
	}

	.toolbar-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.toolbar-divider {
		width: 1px;
		height: 20px;
		background: var(--border);
		margin: 0 4px;
	}

	.toolbar-select {
		padding: 4px 6px;
		border-radius: 4px;
		border: 1px solid var(--border);
		background: var(--background);
		color: var(--foreground);
		font-size: 0.875rem;
	}

	.toolbar-select:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
