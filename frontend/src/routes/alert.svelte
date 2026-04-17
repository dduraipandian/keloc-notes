<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';

	let { dialog = $bindable() } = $props();

	function handleKeyDown(e: KeyboardEvent) {
		if (!dialog.open) return;
		if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
			const dialogNode = document.querySelector('[data-slot="alert-dialog-content"]');
			if (!dialogNode) return;
			const buttons = Array.from(dialogNode.querySelectorAll('button')) as HTMLElement[];
			if (buttons.length === 0) return;

			const activeIndex = buttons.indexOf(document.activeElement as HTMLElement);
			if (activeIndex === -1) {
				// If focus is lost or elsewhere on the dialog, focus the first button
				buttons[0].focus();
				e.preventDefault();
				return;
			}

			let nextIndex = activeIndex;
			if (e.key === 'ArrowRight') {
				nextIndex = (activeIndex + 1) % buttons.length;
			} else {
				nextIndex = (activeIndex - 1 + buttons.length) % buttons.length;
			}
			buttons[nextIndex].focus();
			e.preventDefault();
		}
	}

	$effect(() => {
		if (dialog.open) {
			// Force focus on the primary action button slightly after mount
			const timer = setTimeout(() => {
				const dialogNode = document.querySelector('[data-slot="alert-dialog-content"]');
				if (dialogNode) {
					const buttons = Array.from(dialogNode.querySelectorAll('button'));
					if (buttons.length > 0) {
						(buttons[buttons.length - 1] as HTMLElement).focus();
					}
				}
			}, 20);
			return () => clearTimeout(timer);
		}
	});
</script>

<svelte:window onkeydown={handleKeyDown} />

<AlertDialog.Root bind:open={dialog.open}>
	<AlertDialog.Content>
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
				<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			{/if}
			<AlertDialog.Action
				autofocus
				class={dialog.type === 'destroy' ? 'bg-destructive hover:bg-destructive/90' : ''}
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
