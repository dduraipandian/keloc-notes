import StarterKit from '@tiptap/starter-kit';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Image } from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { common, createLowlight } from 'lowlight';
import type { Extensions } from '@tiptap/core';
import { resolveAssetUrl, revokeAssetUrl } from './imageHandler';

// ── Language registry ─────────────────────────────────────────────────────────
// All languages are bundled. `common` is lowlight's built-in curated set.
// PreferencesStore#enabledLanguages controls which appear in the UI picker;
// all remain registered so stored content always highlights correctly.

const lowlight = createLowlight(common);

// Add languages not in `common` that we want available:
import go from 'highlight.js/lib/languages/go';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import sql from 'highlight.js/lib/languages/sql';
lowlight.register({ go, dockerfile, sql });

export const DEFAULT_LANGUAGES = [
	'javascript',
	'typescript',
	'python',
	'go',
	'bash',
	'json',
	'css',
	'html',
	'sql',
	'rust',
	'java',
	'markdown',
	'yaml',
	'dockerfile'
];

// ── Custom Image extension ────────────────────────────────────────────────────
// Resolves `asset:uuid` refs to object URLs asynchronously in a NodeView.

const AssetImage = Image.extend({
	addNodeView() {
		return ({ node }) => {
			const wrapper = document.createElement('span');
			wrapper.contentEditable = 'false';
			wrapper.className = 'editor-image-wrapper';

			const img = document.createElement('img');
			img.className = 'editor-image';
			img.draggable = false;
			wrapper.appendChild(img);

			const src = node.attrs['src'] as string;
			let resolvedAssetId: string | null = null;

			if (src?.startsWith('asset:')) {
				resolvedAssetId = src.slice(6);
				img.alt = 'Loading…';
				resolveAssetUrl(resolvedAssetId).then((url) => {
					if (url) {
						img.src = url;
						img.alt = node.attrs['alt'] ?? '';
					} else {
						img.alt = '[Image not found]';
						wrapper.classList.add('broken-image');
					}
				});
			} else if (src) {
				img.src = src;
				img.alt = node.attrs['alt'] ?? '';
			}

			return {
				dom: wrapper,
				destroy() {
					if (resolvedAssetId) revokeAssetUrl(resolvedAssetId);
				}
			};
		};
	}
});

// ── Extension builder ─────────────────────────────────────────────────────────

export interface ExtensionOptions {
	placeholder?: string;
	readonly?: boolean;
}

export function buildExtensions(opts: ExtensionOptions = {}): Extensions {
	return [
		StarterKit.configure({
			// Disable built-in CodeBlock; CodeBlockLowlight replaces it
			codeBlock: false
		}),
		CodeBlockLowlight.configure({
			lowlight,
			defaultLanguage: 'plaintext',
			HTMLAttributes: { class: 'code-block' }
		}),
		AssetImage.configure({
			inline: false,
			allowBase64: false
		}),
		Placeholder.configure({
			placeholder: opts.placeholder ?? 'Start writing…'
		})
	];
}
