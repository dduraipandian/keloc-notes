import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'mdnotes-db';
const DB_VERSION = 2;

export interface DBStore {
	folders: {
		key: string;
		value: any;
	};
	notes: {
		key: string;
		value: any;
	};
}

export type FolderState = {
	items: any[];
	selectedId: string | null;
};

export type NotesState = {
	notes: any[];
	selectedNoteId: string | null;
};

let dbPromise: Promise<IDBPDatabase<DBStore>>;

export function initDB() {
	if (dbPromise) return dbPromise;

	dbPromise = openDB<DBStore>(DB_NAME, DB_VERSION, {
		upgrade(db) {
			if (!db.objectStoreNames.contains('folders')) {
				db.createObjectStore('folders');
			}
			if (!db.objectStoreNames.contains('notes')) {
				db.createObjectStore('notes');
			}
		}
	});

	return dbPromise;
}

export async function getDB() {
	return await initDB();
}

export async function saveFolderState(state: FolderState) {
	const db = await getDB();
	await db.put('folders', state, 'state');
}

export async function loadFolderState(): Promise<FolderState | undefined> {
	const db = await getDB();
	return await db.get('folders', 'state');
}

export async function saveNotesState(state: NotesState) {
	const db = await getDB();
	await db.put('notes', state, 'state');
}

export async function loadNotesState(): Promise<NotesState | undefined> {
	const db = await getDB();
	return await db.get('notes', 'state');
}
