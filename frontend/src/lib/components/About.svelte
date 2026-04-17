<script lang="ts">
	import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
	import appIcon from '$lib/assets/app-icon.svg';

	interface Props {
		open?: boolean;
		onClose?: () => void;
	}

	let { open = $bindable(false), onClose }: Props = $props();

	const appVersion = import.meta.env.VITE_APP_VERSION || '1.0.0';
</script>

<AlertDialog {open} onOpenChange={(isOpen) => { open = isOpen; if (!isOpen) onClose?.(); }}>
	<AlertDialogContent class="about-dialog">
		<div class="about-container">
			<div class="macos-titlebar">
				<button
					class="traffic-light close"
					onclick={() => {
						open = false;
						onClose?.();
					}}
					aria-label="Close"
				></button>
			</div>

			<div class="about-content">
				<div class="app-icon-wrapper">
					<img src={appIcon} alt="mdnotes icon" class="app-icon" />
				</div>
				<div class="app-info">
					<AlertDialogTitle><span class="app-name">mdnotes</span></AlertDialogTitle>
					<p class="version">Version {appVersion}</p>
				</div>

				<div class="about-footer">
					<p class="copyright">
						© 2025 mdnotes. All rights reserved.
					</p>

					<div class="acknowledgements">
						<p class="ack-text">
							Built with Wails, Svelte, and Go. Thanks to the open source community.
						</p>
					</div>
				</div>
			</div>
		</div>
	</AlertDialogContent>
</AlertDialog>

<style>
	:global(.about-dialog) {
		border: none;
		border-radius: 12px;
		box-shadow: 0 30px 90px rgba(0, 0, 0, 0.4);
		padding: 0;
		max-width: 320px;
		width: 320px;
		background: var(--background);
		color: var(--foreground);
		overflow: hidden;
	}

	.about-container {
		display: flex;
		flex-direction: column;
	}

	.macos-titlebar {
		height: 32px;
		display: flex;
		align-items: center;
		padding: 0 12px;
	}

	.traffic-light {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		border: none;
		cursor: pointer;
		position: relative;
	}

	.traffic-light.close {
		background-color: #ff5f57;
		border: 0.5px solid #e33e32;
	}

	.traffic-light.close:hover::after {
		content: '×';
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		font-size: 9px;
		color: #4c0000;
	}

	.about-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 12px 24px 32px;
		text-align: center;
	}

	.app-icon-wrapper {
		margin-bottom: 20px;
		filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.15));
	}

	.app-icon {
		width: 80px;
		height: 80px;
		object-fit: contain;
	}

	.app-name {
		font-size: 20px;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.version {
		font-size: 11px;
		color: var(--muted-foreground);
		margin: 4px 0 0;
		font-weight: 500;
	}

	.about-footer {
		margin-top: 32px;
		width: 100%;
	}

	.copyright {
		font-size: 10px;
		color: var(--muted-foreground);
		margin: 0;
	}

	.acknowledgements {
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid var(--border);
	}

	.ack-text {
		font-size: 10px;
		color: var(--muted-foreground);
		margin: 0;
		line-height: 1.4;
		opacity: 0.8;
	}
</style>
