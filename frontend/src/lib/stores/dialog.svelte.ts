import { buildStartupRecoveryGuidance, type StartupRecoveryGuidance } from '$lib/startupRecovery';
import type { Component } from 'svelte';
import Trash2 from '@lucide/svelte/icons/trash-2';
import History from '@lucide/svelte/icons/history';
import LogOut from '@lucide/svelte/icons/log-out';
import Check from '@lucide/svelte/icons/check';
import RefreshCw from '@lucide/svelte/icons/refresh-cw';
import Copy from '@lucide/svelte/icons/copy';

export type DialogType = 'destroy' | 'restore';

export interface DialogAction {
	label: string;
	onSelect: () => void;
	variant?: 'default' | 'secondary' | 'destructive';
	closeDialog?: boolean;
	icon?: Component<any>;
}

export interface ConfirmOptions {
	open: boolean;
	type: DialogType;
	title: string;
	description?: string;
	allowHtml?: boolean;
	canCancel?: boolean;
	onConfirm: () => void;
	confirmLabel?: string;
	cancelLabel?: string;
	confirmIcon?: Component<any>;
	cancelIcon?: Component<any>;
	actions?: DialogAction[];
}

export class UIStore {
	// Separate state for individual dialog types
	noteDialog = $state<ConfirmOptions>({
		open: false,
		type: 'destroy',
		title: '',
		description: '',
		confirmLabel: '',
		canCancel: true,
		onConfirm: () => {}
	});

	folderDialog = $state<ConfirmOptions>({
		open: false,
		type: 'destroy',
		title: '',
		description: '',
		confirmLabel: '',
		canCancel: true,
		onConfirm: () => {}
	});

	appDialog = $state<ConfirmOptions>({
		open: false,
		type: 'destroy',
		title: '',
		description: '',
		confirmLabel: '',
		canCancel: false,
		onConfirm: () => {}
	});

	confirmNoteDelete(noteTitle: string, onConfirm: () => void) {
		this.noteDialog = {
			open: true,
			canCancel: true,
			type: 'destroy',
			title: 'Delete Note',
			description: `Are you sure you want to delete "${noteTitle}"?`,
			confirmLabel: 'Delete Note',
			confirmIcon: Trash2,
			onConfirm
		};
	}

	confirmNotePermanentDelete(noteTitle: string, onConfirm: () => void) {
		this.noteDialog = {
			open: true,
			canCancel: true,
			type: 'destroy',
			title: 'Delete Note Permanently',
			description: `Are you sure you want to permanently delete "${noteTitle}"?`,
			confirmLabel: 'Delete Note',
			confirmIcon: Trash2,
			onConfirm
		};
	}

	confirmNoteRestore(noteTitle: string, onConfirm: () => void) {
		this.noteDialog = {
			open: true,
			canCancel: true,
			type: 'restore',
			title: 'Restore Note',
			description: `Are you sure you want to restore '${noteTitle}'?`,
			confirmLabel: 'Restore',
			confirmIcon: History,
			onConfirm
		};
	}

	confirmFolderPermanentDelete(folderTitle: string, onConfirm: () => void) {
		this.folderDialog = {
			open: true,
			canCancel: true,
			type: 'destroy',
			title: 'Delete Folder Permanently',
			description: `Permanently delete '${folderTitle}' and all its notes? This cannot be undone.`,
			confirmLabel: 'Delete Permanently',
			confirmIcon: Trash2,
			onConfirm
		};
	}

	confirmFolderDelete(folderTitle: string, onConfirm: () => void) {
		this.folderDialog = {
			open: true,
			canCancel: true,
			type: 'destroy',
			title: 'Delete Folder',
			description: `Are you sure you want to delete '${folderTitle}' and all its contents?.`,
			confirmLabel: 'Delete Folder',
			confirmIcon: Trash2,
			onConfirm
		};
	}
	confirmAppQuit(title: string, initError: string, onConfirm: () => void) {
		this.appDialog = {
			open: true,
			canCancel: false,
			type: 'destroy',
			title: title,
			description: `Keloc Notes could not load your data. This is usually caused by a corrupted database or
				insufficient storage permissions.
				<br/> <br/>
				<span class="font-mono text-xs text-destructive">${initError}</span>`,
			allowHtml: true,
			confirmLabel: 'Quit Application',
			confirmIcon: LogOut,
			onConfirm
		};
	}

	confirmEmptyTrash(onConfirm: () => void) {
		this.folderDialog = {
			open: true,
			type: 'destroy',
			title: 'Empty Trash',
			description: `Are you sure you want to permanently delete all folders and notes in the trash?`,
			confirmLabel: 'Empty Trash',
			confirmIcon: Trash2,
			canCancel: true,
			onConfirm
		};
	}

	showOperationError(title: string, errorMessage: string) {
		this.appDialog = {
			open: true,
			canCancel: false,
			type: 'destroy',
			title,
			description: errorMessage,
			confirmLabel: 'OK',
			confirmIcon: Check,
			onConfirm: () => {}
		};
	}

	showStartupRecoveryDialog({
		errorMessage,
		onRetry,
		onCopyDiagnostics,
		onResetLocalData,
		onResetAndImportBackup,
		onQuit,
		recoveryGuidance
	}: {
		errorMessage: string;
		onRetry: () => void;
		onCopyDiagnostics: () => void;
		onResetLocalData: () => void;
		onResetAndImportBackup: () => void;
		onQuit: () => void;
		recoveryGuidance?: StartupRecoveryGuidance;
	}) {
		const guidance = recoveryGuidance ?? buildStartupRecoveryGuidance(errorMessage);
		const descriptionParts = [
			`<strong>What happened</strong><br/>${guidance.summary}`,
			`<strong>Data affected</strong><br/>${guidance.dataStatus}`,
			`<strong>What you can do now</strong><br/>${guidance.primaryAction}`,
			guidance.resetWarning
				? `<strong>Before reset</strong><br/>${guidance.resetWarning}`
				: '',
			'<strong>Recovery guide</strong><br/>See <a class="underline" href="docs/recovery.md">docs/recovery.md</a> for storage and restore guidance.',
			`<strong>Diagnostic detail</strong><br/><span class="font-mono text-xs text-destructive">${errorMessage}</span>`
		].filter(Boolean);

		this.appDialog = {
			open: true,
			canCancel: false,
			type: 'destroy',
			title: 'Failed to Start',
			description: descriptionParts.join('<br/>'),
			allowHtml: true,
			confirmLabel: 'Quit Application',
			confirmIcon: LogOut,
			onConfirm: onQuit,
			actions: [
				{
					label: 'Retry Startup',
					onSelect: onRetry,
					closeDialog: false,
					icon: RefreshCw
				},
				{
					label: 'Copy Diagnostics',
					onSelect: onCopyDiagnostics,
					variant: 'secondary',
					closeDialog: false,
					icon: Copy
				}
			]
		};
		if (guidance.appReset) {
			this.appDialog.actions?.push({
				label: 'Reset Local Data',
				onSelect: onResetLocalData,
				variant: 'destructive',
				icon: Trash2
			});
			this.appDialog.actions?.push({
				label: 'Reset And Import Backup',
				onSelect: onResetAndImportBackup,
				variant: 'destructive',
				icon: Trash2
			});
		}
	}

	closeDialogs() {
		this.noteDialog.open = false;
		this.folderDialog.open = false;
		this.appDialog.open = false;
	}

	hasOpenDialog() {
		return this.noteDialog.open || this.folderDialog.open || this.appDialog.open;
	}
}
