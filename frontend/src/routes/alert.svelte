<script>
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';

	let { dialog = $bindable() } = $props();
</script>

<AlertDialog.Root bind:open={dialog.open}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{dialog.title}</AlertDialog.Title>
			<AlertDialog.Description>{@html dialog.description}</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			{#if dialog.canCancel}
				<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			{/if}
			<AlertDialog.Action
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
