import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'mdnotes-db';
const DB_VERSION = 1;

export interface DBStore {
	folders: {
		key: string;
		value: any;
	};
}

export type FolderState = {
	items: any[];
	selectedId: string | null;
};

let dbPromise: Promise<IDBPDatabase<DBStore>>;

export function initDB() {
	if (dbPromise) return dbPromise;

	dbPromise = openDB<DBStore>(DB_NAME, DB_VERSION, {
		upgrade(db) {
			if (!db.objectStoreNames.contains('folders')) {
				db.createObjectStore('folders');
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
