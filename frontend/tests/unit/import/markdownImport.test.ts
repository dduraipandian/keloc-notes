import { describe, expect, it } from 'vitest';
import {
	analyzeMarkdownImportConflicts,
	buildMarkdownImportExecutionPlan
} from '$lib/import/markdownImport';

describe('markdownImport conflict analysis', () => {
	it('detects conflicts by normalized folder path and title while ignoring deleted notes', () => {
		const analysis = analyzeMarkdownImportConflicts(
			[
				{ Title: ' Roadmap ', Content: 'New content', FolderPath: 'Projects/2025' },
				{ Title: 'Ideas', Content: 'Fresh note', FolderPath: '' }
			],
			[
				{
					id: 'folder-1',
					title: 'Projects',
					parentId: null,
					items: ['folder-2'],
					deletedAt: null
				},
				{
					id: 'folder-2',
					title: '2025',
					parentId: 'folder-1',
					items: [],
					deletedAt: null
				}
			],
			[
				{
					id: 'note-1',
					folderId: 'folder-2',
					title: 'Roadmap',
					summary: '',
					updatedAt: '2025-01-01T00:00:00.000Z',
					deletedAt: null
				},
				{
					id: 'note-2',
					folderId: null,
					title: 'Ideas',
					summary: '',
					updatedAt: '2025-01-01T00:00:00.000Z',
					deletedAt: 123
				}
			]
		);

		expect(analysis.conflicts).toEqual([
			{
				importIndex: 0,
				title: 'Roadmap',
				folderPath: 'Projects/2025',
				existingNoteId: 'note-1'
			}
		]);
		expect(analysis.createCandidates).toHaveLength(1);
		expect(analysis.createCandidates[0].title).toBe('Ideas');
	});

	it('builds overwrite actions for conflicts and create actions for new notes', () => {
		const analysis = analyzeMarkdownImportConflicts(
			[
				{ Title: 'Roadmap', Content: 'Updated body', FolderPath: 'Projects/2025' },
				{ Title: 'Ideas', Content: 'Fresh note', FolderPath: '' }
			],
			[
				{
					id: 'folder-1',
					title: 'Projects',
					parentId: null,
					items: ['folder-2'],
					deletedAt: null
				},
				{
					id: 'folder-2',
					title: '2025',
					parentId: 'folder-1',
					items: [],
					deletedAt: null
				}
			],
			[
				{
					id: 'note-1',
					folderId: 'folder-2',
					title: 'Roadmap',
					summary: '',
					updatedAt: '2025-01-01T00:00:00.000Z',
					deletedAt: null
				}
			]
		);

		const plan = buildMarkdownImportExecutionPlan(analysis, 'overwrite');

		expect(plan.actions).toEqual([
			{
				type: 'overwrite',
				noteId: 'note-1',
				title: 'Roadmap',
				content: 'Updated body'
			},
			{
				type: 'create',
				folderPath: '',
				title: 'Ideas',
				content: 'Fresh note'
			}
		]);
	});

	it('builds keep-both actions with deterministic imported suffixes', () => {
		const analysis = analyzeMarkdownImportConflicts(
			[
				{ Title: 'Roadmap', Content: 'Imported copy', FolderPath: 'Projects' },
				{ Title: 'Roadmap', Content: 'Second imported copy', FolderPath: 'Projects' }
			],
			[
				{
					id: 'folder-1',
					title: 'Projects',
					parentId: null,
					items: [],
					deletedAt: null
				}
			],
			[
				{
					id: 'note-1',
					folderId: 'folder-1',
					title: 'Roadmap',
					summary: '',
					updatedAt: '2025-01-01T00:00:00.000Z',
					deletedAt: null
				},
				{
					id: 'note-2',
					folderId: 'folder-1',
					title: 'Roadmap (Imported)',
					summary: '',
					updatedAt: '2025-01-02T00:00:00.000Z',
					deletedAt: null
				}
			]
		);

		const plan = buildMarkdownImportExecutionPlan(analysis, 'keep-both');

		expect(plan.actions).toEqual([
			{
				type: 'create',
				folderPath: 'Projects',
				title: 'Roadmap (Imported 2)',
				content: 'Imported copy'
			},
			{
				type: 'create',
				folderPath: 'Projects',
				title: 'Roadmap (Imported 3)',
				content: 'Second imported copy'
			}
		]);
	});
});
