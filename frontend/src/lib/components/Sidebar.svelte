<script lang="ts">
	import Folder from '@lucide/svelte/icons/folder';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import FolderPlus from '@lucide/svelte/icons/folder-plus';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { Collapsible } from 'bits-ui';

	type FolderItem = {
		title: string;
		url: string;
		badge?: number;
		items?: FolderItem[];
	};

	// Mock data representing the Apple Notes screenshot hierarchy
	const items: FolderItem[] = [
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
	];
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
	</Sidebar.Content>

	<Sidebar.Footer class="border-t-0 p-4">
		<button class="flex items-center gap-2 text-sm text-foreground/80 hover:text-foreground">
			<FolderPlus class="size-4" />
			<span>New Folder</span>
		</button>
	</Sidebar.Footer>
</Sidebar.Root>

{#snippet MenuItemSnippet(item: FolderItem, depth: number)}
	{#if item.items && item.items.length > 0}
		<Collapsible.Root class="group/collapsible" open={true}>
			<Sidebar.MenuItem>
				<Collapsible.Trigger class="w-full">
					{#snippet child({ props })}
						<Sidebar.MenuButton class="pr-8" {...props}>
							<div style="width: {depth * 0.5}rem" class="shrink-0"></div>
							<ChevronRight
								class="size-3.5 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
							/>
							<Folder class="size-4 shrink-0 text-muted-foreground/70" />
							<span class="flex-1 truncate text-left">{item.title}</span>
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
						<Folder class="size-4 shrink-0 text-muted-foreground/70" />
						<span class="flex-1 truncate text-left">{item.title}</span>
					</a>
				{/snippet}
			</Sidebar.MenuButton>
			<Sidebar.MenuBadge class="ml-auto text-[10px] text-muted-foreground/60 tabular-nums"
				>{item.badge ? item.badge : 0}</Sidebar.MenuBadge
			>
		</Sidebar.MenuItem>
	{/if}
{/snippet}
