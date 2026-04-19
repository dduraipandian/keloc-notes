export type ActivePane = 'folders' | 'notes' | 'editor';

export class UIStateStore {
	activePane = $state<ActivePane>('folders');
	sidebarVisible = $state(true);
	noteListVisible = $state(true);

	setActivePane(pane: ActivePane) {
		this.activePane = pane;
	}

	toggleSidebar() {
		this.sidebarVisible = !this.sidebarVisible;
	}

	toggleNoteList() {
		this.noteListVisible = !this.noteListVisible;
	}

	__resetForTest() {
		this.activePane = 'folders';
		this.sidebarVisible = true;
		this.noteListVisible = true;
	}
}


