import { uiStateStore, type ActivePane } from '$lib/stores/uiState.svelte';

export function activatePaneOnClick(node: HTMLElement, pane: ActivePane) {
	const activate = () => {
		uiStateStore.setActivePane(pane);
	};

	node.addEventListener('click', activate);

	return {
		destroy() {
			node.removeEventListener('click', activate);
		}
	};
}
