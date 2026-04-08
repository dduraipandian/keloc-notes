<script lang="ts">
	import { Collapsible as CollapsiblePrimitive } from "bits-ui";
	import { slide } from "svelte/transition";

	let { ref = $bindable(null), children, ...restProps }: CollapsiblePrimitive.ContentProps = $props();
</script>

<CollapsiblePrimitive.Content forceMount bind:ref data-slot="collapsible-content" {...restProps}>
	{#snippet child({ props, open })}
		{#if open}
			<div transition:slide={{ duration: 250 }} {...props}>
				{@render children?.()}
			</div>
		{/if}
	{/snippet}
</CollapsiblePrimitive.Content>
