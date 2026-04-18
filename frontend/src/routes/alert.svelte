<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';

	let { dialog = $bindable() } = $props();
	let actionBtnRef = $state<HTMLButtonElement | null>(null);
	let cancelBtnRef = $state<HTMLButtonElement | null>(null);
	let previousFocusElement: Element | null = null;

	function handleKeyDown(e: KeyboardEvent) {
		if (!dialog.open) return;
		if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
			const buttons = [cancelBtnRef, actionBtnRef].filter(Boolean) as HTMLElement[];
			if (buttons.length === 0) return;

			const activeIndex = buttons.indexOf(document.activeElement as HTMLElement);
			let nextIndex = activeIndex;
			if (activeIndex === -1) {
				nextIndex = buttons.length - 1;
			} else if (e.key === 'ArrowRight') {
				nextIndex = (activeIndex + 1) % buttons.length;
			} else {
				nextIndex = (activeIndex - 1 + buttons.length) % buttons.length;
			}
			buttons[nextIndex].focus();
			e.preventDefault();
		}
	}

	function handleOpenAutoFocus(e: Event) {
		e.preventDefault();
		// Save the currently focused element before opening the dialog
		previousFocusElement = document.activeElement;

		// Focus the primary action button when dialog opens.
		// Retry with rAF in case the button isn't mounted yet or window just regained focus.
		let attempts = 0;
		function tryFocus() {
			if (attempts++ >= 10) return;
			if (actionBtnRef) {
				actionBtnRef.focus();
				if (document.activeElement !== actionBtnRef) {
					requestAnimationFrame(tryFocus);
				}
			} else {
				requestAnimationFrame(tryFocus);
			}
		}
		tryFocus();
	}

	function handleCloseAutoFocus(e: Event) {
		e.preventDefault();
		// Restore focus to the element that had focus before the dialog opened
		if (previousFocusElement instanceof HTMLElement) {
			previousFocusElement.focus();
		}
	}
</script>

<svelte:window onkeydown={handleKeyDown} />

<AlertDialog.Root bind:open={dialog.open}>
	<AlertDialog.Content onOpenAutoFocus={handleOpenAutoFocus} onCloseAutoFocus={handleCloseAutoFocus}>
		<AlertDialog.Header>
			<AlertDialog.Title>{dialog.title}</AlertDialog.Title>
			<AlertDialog.Description>
				{#if dialog.allowHtml}
					{@html dialog.description}
				{:else}
					{dialog.description}
				{/if}
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			{#if dialog.canCancel}
				<AlertDialog.Cancel
					bind:ref={cancelBtnRef}
					class="focus:ring-ring/50 focus:ring-[3px] focus:outline-none"
				>
					Cancel
				</AlertDialog.Cancel>
			{/if}
			<AlertDialog.Action
				bind:ref={actionBtnRef}
				class={[
					'focus:ring-ring/50 focus:ring-[3px] focus:outline-none',
					dialog.type === 'destroy' && 'bg-destructive hover:bg-destructive/90'
				]}
				onclick={() => {
					dialog.onConfirm();
					dialog.open = false;
				}}
			>
				{dialog.confirmLabel}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
