import type { JSONContent } from '@tiptap/core';
import { assetsRepository } from '$lib/infrastructure/repositories';
import type { exporter } from '$lib/wailsjs/go/models';

/**
 * Parse raw stored string into Tiptap-ready content.
 * Handles: empty string → empty doc, valid JSON → use as-is,
 * plain text fallback (legacy) → wrap in paragraph.
 */
export function parseContent(raw: string): JSONContent {
	if (!raw || raw.trim() === '') {
		return { type: 'doc', content: [{ type: 'paragraph' }] };
	}
	try {
		return JSON.parse(raw) as JSONContent;
	} catch {
		return {
			type: 'doc',
			content: [{ type: 'paragraph', content: [{ type: 'text', text: raw }] }]
		};
	}
}

/**
 * Extract plain text from Tiptap JSON for MiniSearch indexing and summarize().
 * Joins block-level content with newlines; inlines join directly.
 */
export function extractTextFromJSON(raw: string): string {
	if (!raw || raw.trim() === '') return '';
	let doc: JSONContent;
	try {
		doc = JSON.parse(raw) as JSONContent;
	} catch {
		return raw; // plain text fallback
	}
	return nodeToText(doc).trim();
}

function nodeToText(node: JSONContent): string {
	if (node.type === 'text') return node.text ?? '';
	if (!node.content?.length) return '';

	const isBlock = ['paragraph', 'heading', 'codeBlock', 'listItem', 'blockquote'].includes(
		node.type ?? ''
	);
	const inner = node.content.map(nodeToText).join('');
	return isBlock ? inner + '\n' : inner;
}

/**
 * Serialize Tiptap JSON to Markdown for export.
 * Handles all nodes produced by the editor's extension set.
 */
export function jsonToMarkdown(raw: string): string {
	if (!raw || raw.trim() === '') return '';
	let doc: JSONContent;
	try {
		doc = JSON.parse(raw) as JSONContent;
	} catch {
		return raw;
	}
	return (doc.content ?? []).map(serializeBlock).join('');
}

export async function importedMarkdownToEditorContent(
	noteId: string,
	markdown: string,
	importedAssets: exporter.AssetDTO[] = []
): Promise<string> {
	if (!importedAssets.length) {
		return markdown;
	}

	const assetIdByPath = new Map<string, string>();

	for (const asset of importedAssets) {
		const assetId = crypto.randomUUID();
		const mimeType = inferMimeTypeFromPath(asset.Path);
		await assetsRepository.save({
			id: assetId,
			noteId,
			mimeType,
			data: decodeBase64ToBlob(asset.DataBase64, mimeType)
		});
		assetIdByPath.set(asset.Path, assetId);
	}

	const content: JSONContent[] = [];
	let paragraphLines: string[] = [];

	const flushParagraph = () => {
		if (paragraphLines.length === 0) {
			return;
		}

		content.push({
			type: 'paragraph',
			content: [{ type: 'text', text: paragraphLines.join('\n') }]
		});
		paragraphLines = [];
	};

	for (const rawLine of markdown.split('\n')) {
		const line = rawLine.trim();

		if (!line) {
			flushParagraph();
			if (content.length > 0 && content[content.length - 1]?.type !== 'paragraph') {
				content.push({ type: 'paragraph' });
			}
			continue;
		}

		const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
		if (headingMatch) {
			flushParagraph();
			content.push({
				type: 'heading',
				attrs: { level: headingMatch[1].length },
				content: [{ type: 'text', text: headingMatch[2] }]
			});
			continue;
		}

		const imageMatch = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(line);
		if (imageMatch) {
			flushParagraph();
			const assetId = assetIdByPath.get(imageMatch[2]);
			if (assetId) {
				content.push({
					type: 'image',
					attrs: {
						src: `asset:${assetId}`,
						alt: imageMatch[1],
						assetId
					}
				});
				continue;
			}
		}

		paragraphLines.push(line);
	}

	flushParagraph();

	return JSON.stringify({
		type: 'doc',
		content
	});
}

function serializeBlock(node: JSONContent): string {
	switch (node.type) {
		case 'paragraph':
			return serializeInline(node.content) + '\n\n';
		case 'heading': {
			const level = node.attrs?.['level'] ?? 1;
			return '#'.repeat(level) + ' ' + serializeInline(node.content) + '\n\n';
		}
		case 'codeBlock': {
			const lang = node.attrs?.['language'] ?? '';
			const code = (node.content ?? []).map((n) => n.text ?? '').join('');
			return '```' + lang + '\n' + code + '\n```\n\n';
		}
		case 'bulletList':
			return (node.content ?? []).map((item) => '- ' + serializeListItem(item)).join('') + '\n';
		case 'orderedList':
			return (
				(node.content ?? []).map((item, i) => `${i + 1}. ` + serializeListItem(item)).join('') +
				'\n'
			);
		case 'blockquote':
			return (
				(node.content ?? [])
					.map(serializeBlock)
					.join('')
					.split('\n')
					.map((l) => '> ' + l)
					.join('\n') + '\n'
			);
		case 'horizontalRule':
			return '---\n\n';
		case 'image': {
			const src = node.attrs?.['src'] ?? '';
			const alt = node.attrs?.['alt'] ?? '';
			return `![${alt}](${src})\n\n`;
		}
		default:
			return serializeInline(node.content);
	}
}

function inferMimeTypeFromPath(path: string): string {
	const extension = path.split('.').pop()?.toLowerCase() ?? '';

	switch (extension) {
		case 'png':
			return 'image/png';
		case 'jpg':
		case 'jpeg':
			return 'image/jpeg';
		case 'gif':
			return 'image/gif';
		case 'svg':
			return 'image/svg+xml';
		case 'webp':
			return 'image/webp';
		default:
			return 'application/octet-stream';
	}
}

function decodeBase64ToBlob(dataBase64: string, mimeType: string): Blob {
	const binary = atob(dataBase64);
	const bytes = new Uint8Array(binary.length);

	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i);
	}

	return new Blob([bytes], { type: mimeType });
}

function serializeListItem(node: JSONContent): string {
	return (node.content ?? []).map(serializeBlock).join('').trimEnd() + '\n';
}

function serializeInline(nodes: JSONContent['content']): string {
	return (nodes ?? []).map(serializeInlineNode).join('');
}

function serializeInlineNode(node: JSONContent): string {
	if (node.type === 'hardBreak') return '  \n';
	if (node.type === 'image') {
		const src = node.attrs?.['src'] ?? '';
		const alt = node.attrs?.['alt'] ?? '';
		return `![${alt}](${src})`;
	}
	let text = node.text ?? '';
	if (!text) return '';
	const marks = node.marks ?? [];
	// Order matters: code > bold > italic
	if (marks.some((m) => m.type === 'code')) return '`' + text + '`';
	if (marks.some((m) => m.type === 'bold')) text = '**' + text + '**';
	if (marks.some((m) => m.type === 'italic')) text = '*' + text + '*';
	if (marks.some((m) => m.type === 'strike')) text = '~~' + text + '~~';
	return text;
}
