<script lang="ts">
	import Folder from '@lucide/svelte/icons/folder';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import FolderPlus from '@lucide/svelte/icons/folder-plus';
	import Trash from '@lucide/svelte/icons/trash';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as ContextMenu from '$lib/components/ui/context-menu/index.js';

	type FolderItem = {
		id: string;
		title: string;
		url: string;
		badge?: number;
		items?: FolderItem[];
		isOpen?: boolean;
	};

	const folderColor = 'grey';

	let selectedItem = $state<FolderItem | null>(null);

	// Mock data representing the Apple Notes screenshot hierarchy
	let items: FolderItem[] = $state([
		{
			id: 'all-icloud',
			title: 'All iCloud',
			url: '#',
			badge: 111
		},
		{
			id: 'notes',
			title: 'Notes',
			url: '#',
			badge: 40
		},
		{
			id: 'algorithms',
			title: 'Algorithms',
			url: '#'
		},
		{
			id: 'engineering-concepts',
			title: 'Engineering Concepts',
			url: '#',
			badge: 1
		},
		{
			id: 'personal',
			title: 'Personal',
			url: '#',
			badge: 8
		},
		{
			id: 'work',
			title: 'Work',
			url: '#',
			badge: 11,
			isOpen: true,
			items: [
				{
					id: 'engineering-dashboard',
					title: 'Engineering Dashboard',
					url: '#',
					badge: 1
				},
				{
					id: 'esentire',
					title: 'eSentire',
					url: '#',
					badge: 4
				},
				{
					id: 'learnings',
					title: 'Learnings',
					url: '#',
					badge: 15,
					isOpen: false,
					items: [
						{
							id: 'svelte',
							title: 'Svelte',
							url: '#'
						},
						{
							id: 'security-fixes',
							title: 'Security fixes',
							url: '#',
							badge: 2
						},
						{
							id: 'golang',
							title: 'Golang',
							url: '#',
							badge: 16
						}
					]
				}
			]
		}
	]);

	function createNewFolder() {
		if (!selectedItem) {
			console.log('Creating new folder at root');
			items.unshift({
				id: crypto.randomUUID(),
				title: 'New Folder',
				url: '#'
			});
			return;
		}
		let item: FolderItem = selectedItem;
		console.log(item.title);
		item.items?.unshift({
			id: crypto.randomUUID(),
			title: 'New Folder',
			url: '#'
		});
	}
</script>

<Sidebar.Root collapsible="icon" class="border-r-0">
	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.GroupLabel
				class="text-xs font-semibold tracking-wider text-muted-foreground/70 uppercase"
				>Folders</Sidebar.GroupLabel
			>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#each items as item (item.title)}
						{@render MenuItemSnippet(item, 0)}
					{/each}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
		<Sidebar.Group>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					<Sidebar.MenuItem>
						<Sidebar.MenuButton class="pr-8">
							{#snippet child({ props })}
								<!-- svelte-ignore a11y_invalid_attribute -->
								<a href="#" {...props}>
									<Trash color="#dc5a5a" /> <span class="truncate text-left">Recently Deleted</span>
								</a>
							{/snippet}
						</Sidebar.MenuButton>
						<Sidebar.MenuBadge class="ml-auto text-[10px] text-muted-foreground/60 tabular-nums"
							>0</Sidebar.MenuBadge
						>
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>

	<Sidebar.Footer class="border-t-0 p-4">
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton>
					{#snippet child({ props })}
						<!-- svelte-ignore a11y_invalid_attribute -->
						<a
							href="#"
							class="flex items-center gap-2 text-sm text-foreground/80 hover:text-foreground"
							onclick={() => createNewFolder()}
						>
							<span>New Folder</span>
							<FolderPlus class="ml-auto size-5" color="#3e9392" />
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Footer>
</Sidebar.Root>

{#snippet MenuItemSnippet(item: FolderItem, depth: number)}
	{#if item.items && item.items.length > 0}
		<Collapsible.Root
			class="group/collapsible"
			bind:open={() => item.isOpen ?? false, (v) => (item.isOpen = v)}
		>
			<ContextMenu.Root>
				<ContextMenu.Trigger>
					<Sidebar.MenuItem>
						<Collapsible.Trigger class="w-full">
							{#snippet child({ props })}
								<Sidebar.MenuButton
									class="pr-8"
									{...props}
									isActive={item.id === selectedItem?.id}
									onclick={(e) => {
										(props as any).onclick?.(e);
										selectedItem = item;
									}}
								>
									<div style="width: {depth * 0.5}rem" class="shrink-0"></div>
									<ChevronRight
										size={14}
										class={[
											'shrink-0 transition-transform duration-200',
											item.isOpen ? 'rotate-90' : ''
										]}
									/>
									<Folder color={folderColor} />
									<span class="truncate text-left">{item.title}</span>
								</Sidebar.MenuButton>
								<Sidebar.MenuBadge class="ml-auto text-[10px] text-muted-foreground/60 tabular-nums"
									>{item.badge ? item.badge : 0}</Sidebar.MenuBadge
								>
							{/snippet}
						</Collapsible.Trigger>
						<Collapsible.Content>
							<Sidebar.MenuSub class="m-0 border-l-0 p-0">
								{#each item.items as subItem (subItem.title)}
									{@render MenuItemSnippet(subItem, depth + 1)}
								{/each}
							</Sidebar.MenuSub>
						</Collapsible.Content>
					</Sidebar.MenuItem>
				</ContextMenu.Trigger>
				{@render ContextMenuContentSnippet(item)}
			</ContextMenu.Root>
		</Collapsible.Root>
	{:else}
		<ContextMenu.Root>
			<ContextMenu.Trigger>
				<Sidebar.MenuItem>
					<Sidebar.MenuButton
						class="pr-8"
						isActive={item.id === selectedItem?.id}
						onclick={() => {
							selectedItem = item;
						}}
					>
						{#snippet child({ props })}
							<a href={item.url} {...props}>
								<div style="width: {depth * 0.5}rem" class="shrink-0"></div>
								<div class="size-3.5 shrink-0"><!-- Spacer to align with chevron --></div>
								<Folder color={folderColor} /> <span class="truncate text-left">{item.title}</span>
							</a>
						{/snippet}
					</Sidebar.MenuButton>
					<Sidebar.MenuBadge class="ml-auto text-[10px] text-muted-foreground/60 tabular-nums"
						>{item.badge ? item.badge : 0}</Sidebar.MenuBadge
					>
				</Sidebar.MenuItem>
			</ContextMenu.Trigger>
			{@render ContextMenuContentSnippet(item)}
		</ContextMenu.Root>
	{/if}
{/snippet}

{#snippet ContextMenuContentSnippet(item: FolderItem)}
	<ContextMenu.Content
		class="dark rounded-sm bg-card text-xs tracking-wider text-muted-foreground/70"
	>
		<ContextMenu.Item>Rename</ContextMenu.Item>
		<ContextMenu.Item>Delete</ContextMenu.Item>
	</ContextMenu.Content>
{/snippet}
