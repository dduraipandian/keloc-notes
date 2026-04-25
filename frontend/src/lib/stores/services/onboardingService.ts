import { hasLibraryBeenUsed, markLibraryAsUsed, isE2ETest } from '../../infrastructure/idbr';
import type { FolderService } from './folderService';
import type { NoteService } from './noteService';
import type { FolderStore } from '../folders.svelte';
import type { SelectionStore } from '../selection.svelte';
import type { NotesStore } from '../notes.svelte';

export class OnboardingService {
	constructor(
		private folderService: FolderService,
		private noteService: NoteService,
		private folderStore: FolderStore,
		private selectionStore: SelectionStore,
		private notesStore: NotesStore
	) {}

	async runFirstRunOnboarding(): Promise<void> {
		if (isE2ETest()) return;

		const isUsed = await hasLibraryBeenUsed();
		if (isUsed) return;

		// 1. Create a Welcome folder
		const welcomeFolderId = this.folderService.create(null) as string;
		this.folderStore.renameFolder(welcomeFolderId, 'Welcome');

		// 2. Create an onboarding note inside the Welcome folder
		const welcomeNote = this.noteService.create(welcomeFolderId, { silent: true }) as any;
		const welcomeNoteId = welcomeNote.id;

		// 3. Populate the onboarding note
		const onboardingContent = {
			type: "doc",
			content: [
				{
					type: "heading",
					attrs: { level: 1 },
					content: [{ type: "text", text: "Welcome to keloc-notes 🎉" }]
				},
				{
					type: "paragraph",
					content: [{ type: "text", text: "This is a local-first, privacy-focused markdown notes application designed for speed and simplicity." }]
				},
				{
					type: "heading",
					attrs: { level: 2 },
					content: [{ type: "text", text: "The Three-Pane Workflow" }]
				},
				{
					type: "bulletList",
					content: [
						{
							type: "listItem",
							content: [
								{
									type: "paragraph",
									content: [
										{ type: "text", marks: [{ type: "bold" }], text: "Navigation (Left)" },
										{ type: "text", text: ": Organize your notes into folders. You also have virtual views for your Favorites and Trash." }
									]
								}
							]
						},
						{
							type: "listItem",
							content: [
								{
									type: "paragraph",
									content: [
										{ type: "text", marks: [{ type: "bold" }], text: "List (Middle)" },
										{ type: "text", text: ": Quickly find notes using the search bar or browse chronologically." }
									]
								}
							]
						},
						{
							type: "listItem",
							content: [
								{
									type: "paragraph",
									content: [
										{ type: "text", marks: [{ type: "bold" }], text: "Editor (Right)" },
										{ type: "text", text: ": Write your notes in rich text or markdown." }
									]
								}
							]
						}
					]
				},
				{
					type: "heading",
					attrs: { level: 2 },
					content: [{ type: "text", text: "Useful Shortcuts" }]
				},
				{
					type: "bulletList",
					content: [
						{
							type: "listItem",
							content: [
								{ type: "paragraph", content: [{ type: "text", marks: [{ type: "code" }], text: "Cmd+N / Ctrl+N" }, { type: "text", text: " to create a new note." }] }
							]
						},
						{
							type: "listItem",
							content: [
								{ type: "paragraph", content: [{ type: "text", marks: [{ type: "code" }], text: "Cmd+Shift+N / Ctrl+Shift+N" }, { type: "text", text: " to create a new folder." }] }
							]
						},
						{
							type: "listItem",
							content: [
								{ type: "paragraph", content: [{ type: "text", marks: [{ type: "code" }], text: "/" }, { type: "text", text: " to focus the search bar." }] }
							]
						}
					]
				}
			]
		};

		this.noteService.update(welcomeNoteId, {
			title: 'Welcome to Keloc Notes',
			content: JSON.stringify(onboardingContent)
		}, { updatedTimestamp: true });

		// 4. Set selection
		this.folderService.select(welcomeFolderId);
		this.noteService.select(welcomeNoteId);

		// 5. Mark library as used
		await markLibraryAsUsed();
	}
}
