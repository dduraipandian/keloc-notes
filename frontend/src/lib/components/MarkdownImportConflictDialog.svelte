<script lang="ts">
	import {
		AlertDialog,
		AlertDialogAction,
		AlertDialogCancel,
		AlertDialogContent,
		AlertDialogDescription,
		AlertDialogFooter,
		AlertDialogHeader,
		AlertDialogTitle
	} from '$lib/components/ui/alert-dialog';
	import type { UIStateStore } from '$lib/stores/uiState.svelte';

	interface Props {
		uiState: UIStateStore;
	}

	let { uiState }: Props = $props();
	const dialog = $derived.by(() => uiState.markdownImportConflictDialog);

	function displayFolderPath(path: string) {
		return path.length > 0 ? path : 'Home';
	}
</script>

{#if dialog}
	<AlertDialog
		open={dialog.open}
		onOpenChange={(isOpen) => {
			if (!isOpen && dialog.open && !dialog.isProcessing) {
				uiState.cancelMarkdownImportConflictDialog();
			}
		}}
	>
		<AlertDialogContent class="markdown-import-conflict-dialog">
			<AlertDialogHeader>
				<AlertDialogTitle>Import Conflicts Found</AlertDialogTitle>
				<AlertDialogDescription>
					{dialog.conflicts.length}
					{dialog.conflicts.length === 1 ? ' note already exists' : ' notes already exist'} in your
					library. Choose how to continue before importing.
				</AlertDialogDescription>
			</AlertDialogHeader>

			<div class="conflict-resolution-options">
				<label class="resolution-option">
					<input
						type="radio"
						aria-label="Keep both"
						name="markdown-import-resolution"
						checked={dialog.resolution === 'keep-both'}
						disabled={dialog.isProcessing}
						onchange={() => uiState.setMarkdownImportResolution('keep-both')}
					/>
					<div>
						<div class="resolution-title">Keep both</div>
						<p>Create renamed imported copies for every conflict.</p>
					</div>
				</label>

				<label class="resolution-option">
					<input
						type="radio"
						aria-label="Overwrite existing"
						name="markdown-import-resolution"
						checked={dialog.resolution === 'overwrite'}
						disabled={dialog.isProcessing}
						onchange={() => uiState.setMarkdownImportResolution('overwrite')}
					/>
					<div>
						<div class="resolution-title">Overwrite existing</div>
						<p>Update the existing notes with imported content.</p>
					</div>
				</label>
			</div>

			<div class="conflict-list">
				<p class="conflict-list-label">Conflicted items</p>
				<ul>
					{#each dialog.conflicts as conflict (conflict.importIndex)}
						<li>
							<label class="conflict-item">
								<input type="checkbox" checked disabled />
								<div>
									<div class="conflict-title">{conflict.title}</div>
									<div class="conflict-path">{displayFolderPath(conflict.folderPath)}</div>
								</div>
							</label>
						</li>
					{/each}
				</ul>
			</div>

			<AlertDialogFooter>
				<AlertDialogCancel
					disabled={dialog.isProcessing}
					onclick={() => uiState.cancelMarkdownImportConflictDialog()}
				>
					Cancel
				</AlertDialogCancel>
				<AlertDialogAction
					disabled={dialog.isProcessing}
					onclick={() => {
						void uiState.confirmMarkdownImportConflictDialog();
					}}
				>
					{dialog.isProcessing ? 'Importing...' : 'Continue Import'}
				</AlertDialogAction>
			</AlertDialogFooter>
		</AlertDialogContent>
	</AlertDialog>
{/if}

<style>
	:global(.markdown-import-conflict-dialog) {
		max-width: 640px;
		width: min(640px, calc(100vw - 2rem));
	}

	.conflict-resolution-options {
		display: grid;
		gap: 0.75rem;
		margin-top: 1rem;
	}

	.resolution-option {
		display: flex;
		gap: 0.75rem;
		align-items: flex-start;
		border: 1px solid var(--border);
		border-radius: 0.875rem;
		padding: 0.875rem 1rem;
		background: color-mix(in srgb, var(--card) 88%, transparent);
	}

	.resolution-option p {
		margin: 0.25rem 0 0;
		font-size: 0.875rem;
		color: var(--muted-foreground);
		line-height: 1.45;
	}

	.resolution-title {
		font-weight: 600;
	}

	.conflict-list {
		margin-top: 1rem;
		border: 1px solid var(--border);
		border-radius: 0.875rem;
		padding: 0.875rem 1rem;
		max-height: 220px;
		overflow: auto;
		background: color-mix(in srgb, var(--muted) 45%, transparent);
	}

	.conflict-list-label {
		margin: 0 0 0.75rem;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--foreground);
	}

	.conflict-list ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.75rem;
	}

	.conflict-item {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
	}

	.conflict-title {
		font-weight: 500;
	}

	.conflict-path {
		font-size: 0.8125rem;
		color: var(--muted-foreground);
		margin-top: 0.15rem;
	}
</style>
