<script lang="ts">
	import {
		AlertDialog,
		AlertDialogContent,
		AlertDialogHeader,
		AlertDialogTitle
	} from './ui/alert-dialog';
	import { getPreferencesStore, getThemeStore } from '$lib/stores/context';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import Palette from '@lucide/svelte/icons/palette';
	import Code from '@lucide/svelte/icons/code';
	import { createLowlight, common } from 'lowlight';
	import {
		DEFAULT_IMAGE_PROCESSING_CONCURRENCY,
		MAX_IMAGE_PROCESSING_CONCURRENCY
	} from '$lib/editor/imageHandler';
	import { DEFAULT_LANGUAGES } from '$lib/editor/extensions';

	interface Props {
		open?: boolean;
		onClose?: () => void;
	}

	let { open = $bindable(false), onClose }: Props = $props();

	const preferencesStore = getPreferencesStore();
	const themeStore = getThemeStore();

	let activeTab = $state<'general' | 'appearance' | 'editor'>('general');

	// Get all available languages from lowlight
	const lowlight = createLowlight(common);
	const availableLanguages = lowlight.listLanguages().sort();

	const predefinedColors = [
		{ name: 'Blue', value: '#007aff' },
		{ name: 'Green', value: '#34c759' },
		{ name: 'Orange', value: '#ff9500' },
		{ name: 'Red', value: '#ff3b30' },
		{ name: 'Purple', value: '#af52de' },
		{ name: 'Pink', value: '#ff2d55' },
		{ name: 'Teal', value: '#30b0c0' },
		{ name: 'Yellow', value: '#ffcc00' }
	];

	function handleColorChange(color: string) {
		preferencesStore.setFolderAccentColor(color);
	}

	const isCustomColor = $derived(
		!predefinedColors.some((c) => c.value === preferencesStore.folderAccentColor)
	);
</script>

<AlertDialog
	{open}
	onOpenChange={(isOpen) => {
		open = isOpen;
		if (!isOpen) onClose?.();
	}}
>
	<AlertDialogContent class="settings-dialog">
		<div class="settings-container">
			<div class="macos-titlebar">
				<button
					class="traffic-light close"
					onclick={() => {
						open = false;
						onClose?.();
					}}
					aria-label="Close"
				></button>
				<div class="title-text">Settings</div>
			</div>

			<div class="settings-toolbar">
				<button
					class={['toolbar-item', activeTab === 'general' && 'active']}
					onclick={() => (activeTab = 'general')}
				>
					<SettingsIcon size={20} />
					<span>General</span>
				</button>
				<button
					class={['toolbar-item', activeTab === 'appearance' && 'active']}
					onclick={() => (activeTab = 'appearance')}
				>
					<Palette size={20} />
					<span>Appearance</span>
				</button>
				<button
					class={['toolbar-item', activeTab === 'editor' && 'active']}
					onclick={() => (activeTab = 'editor')}
				>
					<Code size={20} />
					<span>Editor</span>
				</button>
			</div>

			<div class="settings-content custom-scrollbar">
				{#if activeTab === 'general'}
					<div class="setting-group">
						<label for="accent-color">Folder Accent Color</label>
						<p class="description">Choose a color for folder icons throughout the app.</p>
						<div class="color-picker-grid">
							{#each predefinedColors as { name, value }}
								<button
									class={[
										'color-swatch',
										preferencesStore.folderAccentColor === value && 'selected'
									]}
									style="background-color: {value};"
									title={name}
									onclick={() => handleColorChange(value)}
									aria-label="{name} accent color"
								></button>
							{/each}
							<div
								class={['custom-color-ring', isCustomColor && 'selected']}
								title="Custom color picker"
							>
								<div
									class="custom-color-circle"
									style={isCustomColor ? `background: ${preferencesStore.folderAccentColor}` : ''}
								>
									<input
										type="color"
										id="accent-color"
										class="custom-color-input"
										value={preferencesStore.folderAccentColor}
										oninput={(e) => handleColorChange(e.currentTarget.value)}
									/>
								</div>
							</div>
						</div>
					</div>
				{:else if activeTab === 'appearance'}
					<div class="setting-group">
						<h3 class="setting-title">Appearance Mode</h3>
						<p class="description">Select how Keloc Notes should look on your system.</p>
						<div class="appearance-options">
							<button
								class={['appearance-card', themeStore.theme === 'light' && 'selected']}
								onclick={() => themeStore.setTheme('light')}
							>
								<div class="theme-preview light"></div>
								<span>Light</span>
							</button>
							<button
								class={['appearance-card', themeStore.theme === 'dark' && 'selected']}
								onclick={() => themeStore.setTheme('dark')}
							>
								<div class="theme-preview dark"></div>
								<span>Dark</span>
							</button>
							<button
								class={['appearance-card', themeStore.theme === 'system' && 'selected']}
								onclick={() => themeStore.setTheme('system')}
							>
								<div class="theme-preview system"></div>
								<span>System</span>
							</button>
						</div>
					</div>
				{:else if activeTab === 'editor'}
					<div class="setting-group">
						<h3 class="setting-title">Toolbar Style</h3>
						<p class="description">Choose how the editor toolbar is displayed.</p>
						<div class="editor-options">
							<label class="radio-option">
								<input
									type="radio"
									name="toolbar"
									checked={preferencesStore.editorToolbar === 'fixed'}
									onchange={() => preferencesStore.setEditorToolbar('fixed')}
								/>
								<span>Fixed (always visible)</span>
							</label>
							<label class="radio-option">
								<input
									type="radio"
									name="toolbar"
									checked={preferencesStore.editorToolbar === 'bubble'}
									onchange={() => preferencesStore.setEditorToolbar('bubble')}
								/>
								<span>Bubble (appears on selection)</span>
							</label>
							<label class="radio-option">
								<input
									type="radio"
									name="toolbar"
									checked={preferencesStore.editorToolbar === 'both'}
									onchange={() => preferencesStore.setEditorToolbar('both')}
								/>
								<span>Both</span>
							</label>
						</div>
					</div>
					<div class="setting-group">
						<h3 class="setting-title">Code Block Languages</h3>
						<p class="description">
							Select which languages appear in the code block language picker.
						</p>
						<div class="languages-grid">
							{#each availableLanguages as lang}
								<label class="language-checkbox">
									<input
										type="checkbox"
										checked={(preferencesStore.enabledLanguages ?? DEFAULT_LANGUAGES).includes(
											lang
										)}
										onchange={(e) => {
											const current = preferencesStore.enabledLanguages ?? DEFAULT_LANGUAGES;
											const updated = e.currentTarget.checked
												? [...current, lang]
												: current.filter((l) => l !== lang);
											preferencesStore.setEnabledLanguages(updated);
										}}
									/>
									<span>{lang}</span>
								</label>
							{/each}
						</div>
					</div>
					<div class="setting-group">
						<h3 class="setting-title">Image Processing Concurrency</h3>
						<p class="description">
							Control how many images Keloc Notes processes at the same time.
						</p>
						<select
							class="toolbar-select"
							value={String(
								preferencesStore.imageProcessingConcurrency ?? DEFAULT_IMAGE_PROCESSING_CONCURRENCY
							)}
							onchange={(e) =>
								preferencesStore.setImageProcessingConcurrency(
									Number.parseInt(e.currentTarget.value, 10)
								)}
						>
							{#each Array.from({ length: MAX_IMAGE_PROCESSING_CONCURRENCY }, (_, i) => i + 1) as value}
								<option {value}>{value}</option>
							{/each}
						</select>
					</div>
				{/if}
			</div>
		</div>
	</AlertDialogContent>
</AlertDialog>

<style>
	:global(.settings-dialog) {
		border: none;
		border-radius: 12px;
		box-shadow: 0 30px 90px rgba(0, 0, 0, 0.4);
		padding: 0;
		max-width: 520px;
		width: 520px;
		overflow: hidden;
		background: var(--background);
		color: var(--foreground);
	}

	.settings-container {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.macos-titlebar {
		height: 38px;
		display: flex;
		align-items: center;
		padding: 0 16px;
		position: relative;
		border-bottom: 1px solid var(--border);
	}

	.title-text {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		font-size: 13px;
		font-weight: 600;
		color: var(--muted-foreground);
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

	.settings-toolbar {
		display: flex;
		justify-content: center;
		padding: 12px;
		gap: 8px;
		background: var(--muted);
		border-bottom: 1px solid var(--border);
	}

	.toolbar-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 72px;
		height: 64px;
		border-radius: 8px;
		border: none;
		background: transparent;
		cursor: pointer;
		color: var(--muted-foreground);
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		gap: 4px;
	}

	.toolbar-item:hover {
		background: var(--accent);
		color: var(--accent-foreground);
	}

	.toolbar-item.active {
		background: var(--accent);
		color: var(--accent-foreground);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.toolbar-item span {
		font-size: 11px;
		font-weight: 500;
	}

	.settings-content {
		padding: 24px 32px;
		min-height: 280px;
		max-height: 420px;
		overflow-y: auto;
	}

	.setting-group {
		margin-bottom: 24px;
	}

	.setting-group label,
	.setting-title {
		display: block;
		font-size: 14px;
		font-weight: 600;
		margin-bottom: 4px;
	}

	.description {
		font-size: 12px;
		color: var(--muted-foreground);
		margin-bottom: 16px;
	}

	.color-picker-grid {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		align-items: center;
	}

	.color-swatch {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: 2px solid transparent;
		cursor: pointer;
		transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
	}

	.color-swatch:hover {
		transform: scale(1.15);
	}

	.color-swatch.selected {
		border-color: var(--foreground);
		box-shadow:
			0 0 0 2px var(--background),
			0 0 0 4px var(--foreground);
	}

	.custom-color-ring {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		border: 2px solid transparent;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
	}

	.custom-color-ring.selected {
		border-color: var(--foreground);
		box-shadow:
			0 0 0 2px var(--background),
			0 0 0 4px var(--foreground);
	}

	.custom-color-ring:hover {
		transform: scale(1.15);
	}

	.custom-color-circle {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		overflow: hidden;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		background: conic-gradient(
			hsl(0, 100%, 50%),
			hsl(30, 100%, 50%),
			hsl(60, 100%, 50%),
			hsl(90, 100%, 50%),
			hsl(120, 100%, 50%),
			hsl(150, 100%, 50%),
			hsl(180, 100%, 50%),
			hsl(210, 100%, 50%),
			hsl(240, 100%, 50%),
			hsl(270, 100%, 50%),
			hsl(300, 100%, 50%),
			hsl(330, 100%, 50%),
			hsl(360, 100%, 50%)
		);
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
	}

	.custom-color-input {
		padding: 0;
		border: none;
		width: 150%;
		height: 150%;
		position: absolute;
		top: -25%;
		left: -25%;
		cursor: pointer;
		opacity: 0;
	}

	.appearance-options {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 16px;
	}

	.appearance-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		padding: 12px;
		border-radius: 10px;
		border: 2px solid var(--border);
		background: var(--card);
		cursor: pointer;
		transition: all 0.2s;
	}

	.appearance-card:hover {
		border-color: var(--muted-foreground);
	}

	.appearance-card.selected {
		border-color: #007aff;
		background: var(--accent);
	}

	.theme-preview {
		width: 100%;
		aspect-ratio: 16/10;
		border-radius: 6px;
		border: 1px solid var(--border);
	}

	.theme-preview.light {
		background: #f5f5f7;
	}
	.theme-preview.dark {
		background: #1e1e1e;
	}
	.theme-preview.system {
		background: linear-gradient(135deg, #f5f5f7 50%, #1e1e1e 50%);
	}

	.appearance-card span {
		font-size: 12px;
		font-weight: 500;
	}

	.editor-options {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.radio-option {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		font-size: 14px;
		padding: 8px 12px;
		border-radius: 6px;
		transition: background 150ms;
	}

	.radio-option:hover {
		background: var(--muted);
	}

	.radio-option input[type='radio'] {
		cursor: pointer;
	}

	.languages-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 8px;
	}

	.language-checkbox {
		display: flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		font-size: 13px;
		padding: 8px;
		border-radius: 4px;
		transition: background 150ms;
	}

	.language-checkbox:hover {
		background: var(--muted);
	}

	.language-checkbox input[type='checkbox'] {
		cursor: pointer;
	}
</style>
