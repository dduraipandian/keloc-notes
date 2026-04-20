<script lang="ts">
	let {
		open = false,
		title,
		description
	}: {
		open?: boolean;
		title: string;
		description: string;
	} = $props();
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
		<div
			role="status"
			aria-live="polite"
			class="w-full max-w-md rounded-2xl border border-border/60 bg-card/95 p-6 shadow-2xl"
		>
			<div class="flex items-center gap-3">
				<div class="h-3 w-3 animate-pulse rounded-full bg-[var(--folder-accent)]"></div>
				<p class="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
					Backup Import
				</p>
			</div>
			<h2 class="mt-4 text-xl font-semibold text-foreground">{title}</h2>
			<p class="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
		</div>
	</div>
{/if}
