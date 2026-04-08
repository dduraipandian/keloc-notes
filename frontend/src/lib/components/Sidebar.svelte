<script lang="ts">
	import Folder from '@lucide/svelte/icons/folder';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import FolderPlus from '@lucide/svelte/icons/folder-plus';
	import Trash from '@lucide/svelte/icons/trash';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';

	type FolderItem = {
		title: string;
		url: string;
		badge?: number;
		items?: FolderItem[];
		isOpen?: boolean;
	};

	const folderColor = 'grey';

	// Mock data representing the Apple Notes screenshot hierarchy
	let items: FolderItem[] = $state([
		{
			title: 'All iCloud',
			url: '#',
			badge: 111
		},
		{
			title: 'Notes',
			url: '#',
			badge: 40
		},
		{
			title: 'Algorithms',
			url: '#'
		},
		{
			title: 'Engineering Concepts',
			url: '#',
			badge: 1
		},
		{
			title: 'Personal',
			url: '#',
			badge: 8
		},
		{
			title: 'Work',
			url: '#',
			badge: 11,
			isOpen: true,
			items: [
				{
					title: 'Engineering Dashboard',
					url: '#',
					badge: 1
				},
				{
					title: 'eSentire',
					url: '#',
					badge: 4
				},
				{
					title: 'Learnings',
					url: '#',
					badge: 15,
					isOpen: false,
					items: [
						{
							title: 'Svelte',
							url: '#'
						},
						{
							title: 'Security fixes',
							url: '#',
							badge: 2
						},
						{
							title: 'Golang',
							url: '#',
							badge: 16
						}
					]
				}
			]
		}
	]);
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
			<Sidebar.MenuItem>
				<Collapsible.Trigger class="w-full">
					{#snippet child({ props })}
						<Sidebar.MenuButton class="pr-8" {...props}>
							<div style="width: {depth * 0.5}rem" class="shrink-0"></div>
							<ChevronRight
								size={14}
								class={[
									'shrink-0 transition-transform duration-200',
									item.isOpen ? 'rotate-90' : ''
								]}
							/>
							<Folder color={folderColor} /> <span class="truncate text-left">{item.title}</span>
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
		</Collapsible.Root>
	{:else}
		<Sidebar.MenuItem>
			<Sidebar.MenuButton class="pr-8">
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
	{/if}
{/snippet}
