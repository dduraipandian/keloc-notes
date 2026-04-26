import { hasLibraryBeenUsed, markLibraryAsUsed, isE2ETest } from '../../infrastructure/idbr';
import type { FolderService } from './folderService';
import type { NoteService } from './noteService';
import type { FolderStore } from '../folders.svelte';
import type { SelectionStore } from '../selection.svelte';
import type { NotesStore } from '../notes.svelte';

export interface OnboardingResult {
	isFirstRun: boolean;
}

export class OnboardingService {
	constructor(
		private folderService: FolderService,
		private noteService: NoteService,
		private folderStore: FolderStore,
		private selectionStore: SelectionStore,
		private notesStore: NotesStore
	) {}

	async runFirstRunOnboarding(): Promise<OnboardingResult> {
		if (isE2ETest()) return { isFirstRun: false };

		const isUsed = await hasLibraryBeenUsed();
		if (isUsed) return { isFirstRun: false };

		// 1. Create a Welcome folder
		const welcomeFolderId = this.folderService.create(null) as string;
		this.folderStore.renameFolder(welcomeFolderId, 'Welcome');

		// 2. Create an onboarding note inside the Welcome folder
		const welcomeNote = this.noteService.create(welcomeFolderId, { silent: true }) as any;
		const welcomeNoteId = welcomeNote.id;

		// 3. Populate the onboarding note
		const onboardingContent = {
			type: 'doc',
			content: [
				{
					type: 'heading',
					attrs: { level: 1 },
					content: [{ type: 'text', text: 'Welcome to keloc-notes' }]
				},
				{
					type: 'paragraph',
					content: [
						{
							type: 'text',
							text: 'A local-first, privacy-focused notes app built for speed. Everything lives on your machine — no cloud, no sync, no tracking.'
						}
					]
				},
				{
					type: 'heading',
					attrs: { level: 2 },
					content: [{ type: 'text', text: 'Quick Start' }]
				},
				{
					type: 'orderedList',
					content: [
						{
							type: 'listItem',
							content: [
								{
									type: 'paragraph',
									content: [
										{ type: 'text', marks: [{ type: 'bold' }], text: 'Create a folder' },
										{ type: 'text', text: ' — use the ' },
										{ type: 'text', marks: [{ type: 'code' }], text: '⌘⇧N' },
										{ type: 'text', text: ' shortcut or the + button in the sidebar.' }
									]
								}
							]
						},
						{
							type: 'listItem',
							content: [
								{
									type: 'paragraph',
									content: [
										{ type: 'text', marks: [{ type: 'bold' }], text: 'Create a note' },
										{ type: 'text', text: ' — press ' },
										{ type: 'text', marks: [{ type: 'code' }], text: '⌘N' },
										{ type: 'text', text: ' or click the pen icon at the top of the note list.' }
									]
								}
							]
						},
						{
							type: 'listItem',
							content: [
								{
									type: 'paragraph',
									content: [
										{ type: 'text', marks: [{ type: 'bold' }], text: 'Start writing' },
										{ type: 'text', text: ' — content saves automatically as you type. No save button needed.' }
									]
								}
							]
						}
					]
				},
				{
					type: 'heading',
					attrs: { level: 2 },
					content: [{ type: 'text', text: 'Keyboard Shortcuts' }]
				},
				{
					type: 'bulletList',
					content: [
						{
							type: 'listItem',
							content: [
								{
									type: 'paragraph',
									content: [
										{ type: 'text', marks: [{ type: 'code' }], text: '⌘N' },
										{ type: 'text', text: '  New note' }
									]
								}
							]
						},
						{
							type: 'listItem',
							content: [
								{
									type: 'paragraph',
									content: [
										{ type: 'text', marks: [{ type: 'code' }], text: '⌘⇧N' },
										{ type: 'text', text: '  New folder' }
									]
								}
							]
						},
						{
							type: 'listItem',
							content: [
								{
									type: 'paragraph',
									content: [
										{ type: 'text', marks: [{ type: 'code' }], text: '/' },
										{ type: 'text', text: '  Focus search' }
									]
								}
							]
						},
						{
							type: 'listItem',
							content: [
								{
									type: 'paragraph',
									content: [
										{ type: 'text', marks: [{ type: 'code' }], text: 'Delete' },
										{ type: 'text', text: '  Trash selected note' }
									]
								}
							]
						},
						{
							type: 'listItem',
							content: [
								{
									type: 'paragraph',
									content: [
										{ type: 'text', marks: [{ type: 'code' }], text: 'Escape' },
										{ type: 'text', text: '  Cancel rename' }
									]
								}
							]
						}
					]
				},
				{
					type: 'heading',
					attrs: { level: 2 },
					content: [{ type: 'text', text: 'The Three-Pane Layout' }]
				},
				{
					type: 'bulletList',
					content: [
						{
							type: 'listItem',
							content: [
								{
									type: 'paragraph',
									content: [
										{ type: 'text', marks: [{ type: 'bold' }], text: 'Sidebar (left)' },
										{ type: 'text', text: ' — folders, Favorites, and Trash.' }
									]
								}
							]
						},
						{
							type: 'listItem',
							content: [
								{
									type: 'paragraph',
									content: [
										{ type: 'text', marks: [{ type: 'bold' }], text: 'Note list (middle)' },
										{ type: 'text', text: ' — browse chronologically or search with ' },
										{ type: 'text', marks: [{ type: 'code' }], text: '/' },
										{ type: 'text', text: '.' }
									]
								}
							]
						},
						{
							type: 'listItem',
							content: [
								{
									type: 'paragraph',
									content: [
										{ type: 'text', marks: [{ type: 'bold' }], text: 'Editor (right)' },
										{ type: 'text', text: ' — rich text with formatting, code blocks, and images.' }
									]
								}
							]
						}
					]
				},
				{
					type: 'paragraph',
					content: [
						{ type: 'text', text: 'Feel free to delete this note anytime. Happy writing!' }
					]
				}
			]
		};

		this.noteService.update(
			welcomeNoteId,
			{ title: 'Welcome to Keloc Notes', content: JSON.stringify(onboardingContent) },
			{ updatedTimestamp: true }
		);

		// 4. Set selection
		this.folderService.select(welcomeFolderId);
		this.noteService.select(welcomeNoteId);

		// 5. Mark library as used
		await markLibraryAsUsed();

		return { isFirstRun: true };
	}
}
