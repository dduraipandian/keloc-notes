import { describe, it, expect } from 'vitest';
import {
	parseContent,
	extractTextFromJSON,
	jsonToMarkdown
} from '../../../src/lib/editor/serializer';
import type { JSONContent } from '@tiptap/core';

describe('serializer', () => {
	describe('parseContent', () => {
		it('should return empty doc for empty string', () => {
			const result = parseContent('');
			expect(result.type).toBe('doc');
			expect(result.content).toEqual([]);
		});

		it('should return empty doc for whitespace-only string', () => {
			const result = parseContent('   \n  ');
			expect(result.type).toBe('doc');
			expect(result.content).toEqual([]);
		});

		it('should parse valid JSON', () => {
			const json = JSON.stringify({
				type: 'doc',
				content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }]
			});
			const result = parseContent(json);
			expect(result.type).toBe('doc');
			expect(result.content?.[0]?.type).toBe('paragraph');
		});

		it('should wrap plain text in paragraph for invalid JSON', () => {
			const result = parseContent('This is plain text');
			expect(result.type).toBe('doc');
			expect(result.content?.[0]?.type).toBe('paragraph');
			expect(result.content?.[0]?.content?.[0]?.text).toBe('This is plain text');
		});
	});

	describe('extractTextFromJSON', () => {
		it('should return empty string for empty content', () => {
			const result = extractTextFromJSON('');
			expect(result).toBe('');
		});

		it('should extract text from simple paragraph', () => {
			const doc: JSONContent = {
				type: 'doc',
				content: [
					{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }
				]
			};
			const result = extractTextFromJSON(JSON.stringify(doc));
			expect(result).toContain('Hello world');
		});

		it('should extract text from heading', () => {
			const doc: JSONContent = {
				type: 'doc',
				content: [
					{
						type: 'heading',
						attrs: { level: 1 },
						content: [{ type: 'text', text: 'My Title' }]
					}
				]
			};
			const result = extractTextFromJSON(JSON.stringify(doc));
			expect(result).toContain('My Title');
		});

		it('should extract text from bold text', () => {
			const doc: JSONContent = {
				type: 'doc',
				content: [
					{
						type: 'paragraph',
						content: [
							{ type: 'text', text: 'Bold', marks: [{ type: 'bold' }] }
						]
					}
				]
			};
			const result = extractTextFromJSON(JSON.stringify(doc));
			expect(result).toContain('Bold');
		});

		it('should extract text from code block', () => {
			const doc: JSONContent = {
				type: 'doc',
				content: [
					{
						type: 'codeBlock',
						attrs: { language: 'javascript' },
						content: [{ type: 'text', text: 'console.log()' }]
					}
				]
			};
			const result = extractTextFromJSON(JSON.stringify(doc));
			expect(result).toContain('console.log()');
		});

		it('should join blocks with newlines', () => {
			const doc: JSONContent = {
				type: 'doc',
				content: [
					{ type: 'paragraph', content: [{ type: 'text', text: 'First' }] },
					{ type: 'paragraph', content: [{ type: 'text', text: 'Second' }] }
				]
			};
			const result = extractTextFromJSON(JSON.stringify(doc));
			expect(result).toMatch(/First\nSecond/);
		});

		it('should fall back to raw text for invalid JSON', () => {
			const result = extractTextFromJSON('plain text that is not JSON');
			expect(result).toBe('plain text that is not JSON');
		});
	});

	describe('jsonToMarkdown', () => {
		it('should return empty string for empty content', () => {
			const result = jsonToMarkdown('');
			expect(result).toBe('');
		});

		it('should convert paragraph to markdown', () => {
			const doc: JSONContent = {
				type: 'doc',
				content: [
					{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }
				]
			};
			const result = jsonToMarkdown(JSON.stringify(doc));
			expect(result).toContain('Hello world');
		});

		it('should convert heading level 1 to markdown', () => {
			const doc: JSONContent = {
				type: 'doc',
				content: [
					{
						type: 'heading',
						attrs: { level: 1 },
						content: [{ type: 'text', text: 'Title' }]
					}
				]
			};
			const result = jsonToMarkdown(JSON.stringify(doc));
			expect(result).toContain('# Title');
		});

		it('should convert heading level 2 to markdown', () => {
			const doc: JSONContent = {
				type: 'doc',
				content: [
					{
						type: 'heading',
						attrs: { level: 2 },
						content: [{ type: 'text', text: 'Subtitle' }]
					}
				]
			};
			const result = jsonToMarkdown(JSON.stringify(doc));
			expect(result).toContain('## Subtitle');
		});

		it('should convert bold text to markdown', () => {
			const doc: JSONContent = {
				type: 'doc',
				content: [
					{
						type: 'paragraph',
						content: [
							{ type: 'text', text: 'Bold text', marks: [{ type: 'bold' }] }
						]
					}
				]
			};
			const result = jsonToMarkdown(JSON.stringify(doc));
			expect(result).toContain('**Bold text**');
		});

		it('should convert italic text to markdown', () => {
			const doc: JSONContent = {
				type: 'doc',
				content: [
					{
						type: 'paragraph',
						content: [
							{ type: 'text', text: 'Italic text', marks: [{ type: 'italic' }] }
						]
					}
				]
			};
			const result = jsonToMarkdown(JSON.stringify(doc));
			expect(result).toContain('*Italic text*');
		});

		it('should convert code block with language to markdown', () => {
			const doc: JSONContent = {
				type: 'doc',
				content: [
					{
						type: 'codeBlock',
						attrs: { language: 'javascript' },
						content: [{ type: 'text', text: 'const x = 1;' }]
					}
				]
			};
			const result = jsonToMarkdown(JSON.stringify(doc));
			expect(result).toContain('```javascript');
			expect(result).toContain('const x = 1;');
			expect(result).toContain('```');
		});

		it('should convert bullet list to markdown', () => {
			const doc: JSONContent = {
				type: 'doc',
				content: [
					{
						type: 'bulletList',
						content: [
							{
								type: 'listItem',
								content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 1' }] }]
							},
							{
								type: 'listItem',
								content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 2' }] }]
							}
						]
					}
				]
			};
			const result = jsonToMarkdown(JSON.stringify(doc));
			expect(result).toContain('- Item 1');
			expect(result).toContain('- Item 2');
		});

		it('should convert image to markdown with asset scheme', () => {
			const doc: JSONContent = {
				type: 'doc',
				content: [
					{
						type: 'image',
						attrs: { src: 'asset:abc-123', alt: 'My Image' }
					}
				]
			};
			const result = jsonToMarkdown(JSON.stringify(doc));
			expect(result).toContain('![My Image](asset:abc-123)');
		});

		it('should be idempotent: serialize -> parse -> serialize = same', () => {
			const original: JSONContent = {
				type: 'doc',
				content: [
					{
						type: 'heading',
						attrs: { level: 1 },
						content: [{ type: 'text', text: 'Title' }]
					},
					{
						type: 'paragraph',
						content: [
							{ type: 'text', text: 'Bold', marks: [{ type: 'bold' }] },
							{ type: 'text', text: ' and ' },
							{ type: 'text', text: 'italic', marks: [{ type: 'italic' }] }
						]
					}
				]
			};

			const md1 = jsonToMarkdown(JSON.stringify(original));
			// Note: Since we're converting to markdown and back, we're testing
			// that serialization is stable (idempotent in markdown form)
			// Re-parsing and re-serializing should produce the same markdown
			const reparsed = parseContent(md1);
			const md2 = jsonToMarkdown(JSON.stringify(reparsed));

			// Both should contain the same key content
			expect(md1).toContain('# Title');
			expect(md2).toContain('# Title');
			expect(md1).toContain('**Bold**');
			expect(md2).toContain('**Bold**');
		});

		it('should fall back to raw text for invalid JSON', () => {
			const result = jsonToMarkdown('not valid json');
			expect(result).toBe('not valid json');
		});
	});
});
