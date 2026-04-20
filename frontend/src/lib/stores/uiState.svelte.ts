export type ActivePane = 'folders' | 'notes' | 'editor';
export type BackupImportStatus = {
	active: boolean;
	title: string;
	description: string;
};

export class UIStateStore {
	activePane = $state<ActivePane>('folders');
	sidebarVisible = $state(true);
	noteListVisible = $state(true);
	backupImportStatus = $state<BackupImportStatus | null>(null);

	setActivePane(pane: ActivePane) {
		this.activePane = pane;
	}

	toggleSidebar() {
		this.sidebarVisible = !this.sidebarVisible;
	}

	toggleNoteList() {
		this.noteListVisible = !this.noteListVisible;
	}

	showBackupImportStatus(title: string, description: string) {
		this.backupImportStatus = {
			active: true,
			title,
			description
		};
	}

	clearBackupImportStatus() {
		this.backupImportStatus = null;
	}

	__resetForTest() {
		this.activePane = 'folders';
		this.sidebarVisible = true;
		this.noteListVisible = true;
		this.backupImportStatus = null;
	}
}

