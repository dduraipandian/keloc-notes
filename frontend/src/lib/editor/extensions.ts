import StarterKit from '@tiptap/starter-kit';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Image } from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { common, createLowlight } from 'lowlight';
import type { Extensions } from '@tiptap/core';

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

const AssetImage = Image.extend({
	addAttributes() {
		return {
			...this.parent?.(),
			assetId: {
				default: null,
				parseHTML: (element) => element.getAttribute('data-asset-id'),
				renderHTML: (attributes) =>
					attributes['assetId'] ? { 'data-asset-id': attributes['assetId'] } : {}
			}
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
			allowBase64: false,
			resize: {
				enabled: !opts.readonly,
				minWidth: 96,
				minHeight: 96,
				alwaysPreserveAspectRatio: true
			}
		}),
		Placeholder.configure({
			placeholder: opts.placeholder ?? 'Start writing…'
		})
	];
}
