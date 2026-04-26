<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import * as Kbd from '$lib/components/ui/kbd/index.js';

	interface Props {
		open: boolean;
		onclose: () => void;
	}

	let { open = $bindable(), onclose }: Props = $props();

	function dismiss() {
		open = false;
		onclose();
	}
</script>

<AlertDialog.Root bind:open>
	<AlertDialog.Content class="max-w-sm">
		<AlertDialog.Header>
			<AlertDialog.Title class="text-xl font-semibold tracking-tight">
				Welcome to keloc-notes
			</AlertDialog.Title>
			<AlertDialog.Description class="text-sm text-muted-foreground">
				A local-first, private notes app built for speed. Your data stays on your machine.
			</AlertDialog.Description>
		</AlertDialog.Header>

		<div class="my-2 flex flex-col gap-1.5">
			{#each [['⌘N', 'New note'], ['⌘⇧N', 'New folder'], ['/', 'Focus search']] as [key, label]}
				<div class="flex items-center gap-3 rounded-md px-1 py-1">
					<Kbd.Group>
						<Kbd.Root>{key}</Kbd.Root>
					</Kbd.Group>
					<span class="text-sm text-muted-foreground">{label}</span>
				</div>
			{/each}
		</div>

		<AlertDialog.Footer class="mt-2 flex-row gap-2 sm:flex-row">
			<AlertDialog.Cancel onclick={dismiss} class="flex-1">Skip for now</AlertDialog.Cancel>
			<AlertDialog.Action onclick={dismiss} class="flex-1">Get Started</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
