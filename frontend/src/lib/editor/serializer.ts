import type { JSONContent } from '@tiptap/core';

/**
 * Parse raw stored string into Tiptap-ready content.
 * Handles: empty string → empty doc, valid JSON → use as-is,
 * plain text fallback (legacy) → wrap in paragraph.
 */
export function parseContent(raw: string): JSONContent {
	if (!raw || raw.trim() === '') {
		return { type: 'doc', content: [] };
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
				(node.content ?? [])
					.map((item, i) => `${i + 1}. ` + serializeListItem(item))
					.join('') + '\n'
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
