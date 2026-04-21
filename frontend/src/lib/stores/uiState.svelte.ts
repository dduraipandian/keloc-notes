export type ActivePane = 'folders' | 'notes' | 'editor';
export type BackupImportStatus = {
	active: boolean;
	title: string;
	description: string;
};

export type MarkdownImportResolution = 'overwrite' | 'keep-both';

export type MarkdownImportConflictDialogState = {
	open: boolean;
	conflicts: Array<{
		importIndex: number;
		title: string;
		folderPath: string;
		existingNoteId: string;
	}>;
	resolution: MarkdownImportResolution;
	isProcessing: boolean;
};

export class UIStateStore {
	activePane = $state<ActivePane>('folders');
	sidebarVisible = $state(true);
	noteListVisible = $state(true);
	backupImportStatus = $state<BackupImportStatus | null>(null);
	markdownImportConflictDialog = $state<MarkdownImportConflictDialogState | null>(null);
	#onMarkdownImportConfirm: ((resolution: MarkdownImportResolution) => Promise<void> | void) | null =
		null;
	#onMarkdownImportCancel: (() => void) | null = null;

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

	openMarkdownImportConflictDialog({
		conflicts,
		onConfirm,
		onCancel
	}: {
		conflicts: MarkdownImportConflictDialogState['conflicts'];
		onConfirm: (resolution: MarkdownImportResolution) => Promise<void> | void;
		onCancel?: () => void;
	}) {
		this.#onMarkdownImportConfirm = onConfirm;
		this.#onMarkdownImportCancel = onCancel ?? null;
		this.markdownImportConflictDialog = {
			open: true,
			conflicts,
			resolution: 'keep-both',
			isProcessing: false
		};
	}

	setMarkdownImportResolution(resolution: MarkdownImportResolution) {
		if (!this.markdownImportConflictDialog) return;
		this.markdownImportConflictDialog = {
			...this.markdownImportConflictDialog,
			resolution
		};
	}

	async confirmMarkdownImportConflictDialog() {
		if (!this.markdownImportConflictDialog || !this.#onMarkdownImportConfirm) return;

		this.markdownImportConflictDialog = {
			...this.markdownImportConflictDialog,
			isProcessing: true
		};

		try {
			await this.#onMarkdownImportConfirm(this.markdownImportConflictDialog.resolution);
		} finally {
			if (this.markdownImportConflictDialog) {
				this.markdownImportConflictDialog = {
					...this.markdownImportConflictDialog,
					isProcessing: false
				};
			}
		}
	}

	cancelMarkdownImportConflictDialog() {
		this.#onMarkdownImportCancel?.();
		this.closeMarkdownImportConflictDialog();
	}

	closeMarkdownImportConflictDialog() {
		this.markdownImportConflictDialog = null;
		this.#onMarkdownImportConfirm = null;
		this.#onMarkdownImportCancel = null;
	}

	__resetForTest() {
		this.activePane = 'folders';
		this.sidebarVisible = true;
		this.noteListVisible = true;
		this.backupImportStatus = null;
		this.markdownImportConflictDialog = null;
		this.#onMarkdownImportConfirm = null;
		this.#onMarkdownImportCancel = null;
	}
}
