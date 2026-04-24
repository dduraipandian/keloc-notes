<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import type { DialogAction } from '$lib/stores/dialog.svelte';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

	let { dialog = $bindable() } = $props();
	let isOpen = $state(dialog.open);

	$effect(() => {
		isOpen = dialog.open;
	});

	$effect(() => {
		if (isOpen !== dialog.open && dialog) {
			dialog.open = isOpen;
		}
	});

	let cancelBtnRef = $state<HTMLButtonElement | null>(null);
	let previousFocusElement: Element | null = null;

	function getDialogButtons() {
		return Array.from(
			document.querySelectorAll<HTMLButtonElement>('[data-alert-dialog-button="true"]')
		);
	}

	function getActions(): DialogAction[] {
		return dialog.actions ?? [];
	}

	function hasExtendedActions() {
		return getActions().length > 0;
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (!isOpen) return;
		if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
			const buttons = getDialogButtons();
			if (buttons.length === 0) return;

			const activeElement =
				document.activeElement instanceof HTMLButtonElement ? document.activeElement : null;
			const activeIndex = activeElement ? buttons.indexOf(activeElement) : -1;
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

		// Focus the first actionable button when dialog opens.
		let attempts = 0;
		function tryFocus() {
			if (!isOpen || attempts++ >= 10) return;
			const primaryAction = document.querySelector<HTMLButtonElement>(
				'[data-alert-dialog-primary="true"]'
			);
			if (primaryAction) {
				primaryAction.focus();
				if (document.activeElement !== primaryAction) {
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

<AlertDialog.Root bind:open={isOpen}>
	<AlertDialog.Content
		class={hasExtendedActions()
			? 'data-[size=default]:max-w-lg sm:w-max sm:max-w-[calc(100vw-2rem)] data-[size=default]:sm:max-w-none'
			: undefined}
		onOpenAutoFocus={handleOpenAutoFocus}
		onCloseAutoFocus={handleCloseAutoFocus}
	>
		{#if hasExtendedActions()}
			<div class="flex flex-col gap-6 text-left">
				<AlertDialog.Header class="flex flex-row items-start gap-4 text-left">
					<TriangleAlert size={32} strokeWidth={2.25} class="text-destructive" />
					<div class="flex min-w-0 flex-col gap-2 text-left">
						<AlertDialog.Title class="text-2xl font-semibold tracking-[-0.02em]">
							{dialog.title}
						</AlertDialog.Title>
					</div>
				</AlertDialog.Header>
				<AlertDialog.Description class="space-y-4 text-left leading-7">
					{#if dialog.allowHtml}
						{@html dialog.description}
					{:else}
						{dialog.description}
					{/if}
				</AlertDialog.Description>
			</div>
		{:else}
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
		{/if}
		<AlertDialog.Footer
			class={hasExtendedActions() ? 'sm:flex-nowrap sm:justify-start sm:gap-3' : undefined}
		>
			{#each getActions() as action, index (action.label)}
				<AlertDialog.Action
					data-alert-dialog-button="true"
					data-alert-dialog-primary={index === 0 ? 'true' : undefined}
					class={[
						hasExtendedActions() && 'w-full sm:w-auto',
						'focus:ring-[3px] focus:ring-ring/50 focus:outline-none',
						action.variant === 'destructive' && 'bg-destructive hover:bg-destructive/90'
					]}
					onclick={() => {
						action.onSelect();
						if (action.closeDialog ?? true) {
							dialog.open = false;
						}
					}}
				>
					{action.label}
				</AlertDialog.Action>
			{/each}
			{#if dialog.canCancel}
				<AlertDialog.Cancel
					bind:ref={cancelBtnRef}
					data-alert-dialog-button="true"
					class={[
						hasExtendedActions() && 'w-full sm:w-auto',
						'focus:ring-[3px] focus:ring-ring/50 focus:outline-none'
					]}
				>
					{dialog.cancelLabel ?? 'Cancel'}
				</AlertDialog.Cancel>
			{/if}
			<AlertDialog.Action
				data-alert-dialog-button="true"
				data-alert-dialog-primary={getActions().length === 0 ? 'true' : undefined}
				class={[
					hasExtendedActions() && 'w-full sm:w-auto',
					'focus:ring-[3px] focus:ring-ring/50 focus:outline-none',
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
