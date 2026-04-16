export type ActivePane = 'folders' | 'notes' | 'editor';

class UIStateStore {
	activePane = $state<ActivePane>('folders');

	setActivePane(pane: ActivePane) {
		this.activePane = pane;
	}

	__resetForTest() {
		this.activePane = 'folders';
	}
}

export const uiStateStore = new UIStateStore();
