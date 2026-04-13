import { FolderService } from './services/folderService';
import { NoteService } from './services/noteService';
import { TrashService } from './services/trashService';
import { FolderTreeHelper } from './domain/folderTree';
import { folderStore } from './folders.svelte';
import { notesStore } from './notes.svelte';

export { FolderService } from './services/folderService';
export { NoteService } from './services/noteService';
export { TrashService } from './services/trashService';
export { FolderTreeHelper } from './domain/folderTree';

export const folderService = new FolderService();
export const noteService = new NoteService();
export const trashService = new TrashService();

// Re-export shared helper for components or other logic
export const folderTreeHelper = new FolderTreeHelper(folderStore, notesStore);
