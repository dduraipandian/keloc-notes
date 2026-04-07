<script lang="ts">
  import Folder from "@lucide/svelte/icons/folder";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import FolderPlus from "@lucide/svelte/icons/folder-plus";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import { Collapsible } from "bits-ui";

  type FolderItem = {
    title: string;
    url: string;
    badge?: number;
    items?: FolderItem[];
  };

  // Mock data representing the Apple Notes screenshot hierarchy
  const items: FolderItem[] = [
    {
      title: "All iCloud",
      url: "#",
      badge: 111,
    },
    {
      title: "Notes",
      url: "#",
      badge: 40,
    },
    {
      title: "Algorithms",
      url: "#",
      badge: 2,
    },
    {
      title: "Engineering Concepts",
      url: "#",
      badge: 1,
    },
    {
      title: "Personal",
      url: "#",
      badge: 8,
    },
    {
      title: "Work",
      url: "#",
      badge: 11,
      items: [
        {
          title: "Engineering Dashboard",
          url: "#",
          badge: 1,
        },
        {
          title: "eSentire",
          url: "#",
          badge: 4,
        },
        {
          title: "Learnings",
          url: "#",
          badge: 15,
          items: [
            {
              title: "Svelte",
              url: "#",
              badge: 1,
            },
            {
              title: "Security fixes",
              url: "#",
              badge: 2,
            },
            {
              title: "Golang",
              url: "#",
              badge: 16,
            },
          ],
        },
      ],
    },
  ];
</script>
 
<Sidebar.Root collapsible="icon" class="border-r-0">
  <Sidebar.Content>
    <Sidebar.Group>
      <Sidebar.GroupLabel class="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">iCloud</Sidebar.GroupLabel>
      <Sidebar.GroupContent>
        <Sidebar.Menu>
          {#each items as item (item.title)}
            {@render MenuItemSnippet(item)}
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

{#snippet MenuItemSnippet(item: FolderItem)}
  {#if item.items && item.items.length > 0}
    <Collapsible.Root class="group/collapsible" open={true}>
      <Sidebar.MenuItem>
        <Collapsible.Trigger>
          {#snippet child({ props }: { props: Record<string, unknown> })}
            <div class="flex w-full items-center gap-2 rounded-md p-2 text-left text-xs transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[state=open]/collapsible:bg-transparent" {...props}>
              <ChevronRight class="size-3.5 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              <Folder class="size-4 shrink-0 text-muted-foreground/70" />
              <span class="flex-1 truncate">{item.title}</span>
              {#if item.badge !== undefined}
                <span class="ml-auto text-[10px] tabular-nums text-muted-foreground/60">{item.badge}</span>
              {/if}
            </div>
          {/snippet}
        </Collapsible.Trigger>
        <Collapsible.Content>
          <Sidebar.MenuSub class="ml-4 border-l-0 pl-2">
            {#each item.items as subItem (subItem.title)}
              {@render MenuItemSnippet(subItem)}
            {/each}
          </Sidebar.MenuSub>
        </Collapsible.Content>
      </Sidebar.MenuItem>
    </Collapsible.Root>
  {:else}
    <Sidebar.MenuItem>
      <Sidebar.MenuButton isActive={item.title === 'Golang'}>
        {#snippet child({ props }: { props: Record<string, unknown> })}
          <a href={item.url} class="flex w-full items-center gap-2" {...props}>
            <div class="size-3.5 shrink-0"><!-- Spacer to align with chevron --></div>
            <Folder class="size-4 shrink-0 text-muted-foreground/70" />
            <span class="flex-1 truncate">{item.title}</span>
            {#if item.badge !== undefined}
              <span class="ml-auto text-[10px] tabular-nums text-muted-foreground/60">{item.badge}</span>
            {/if}
          </a>
        {/snippet}
      </Sidebar.MenuButton>
    </Sidebar.MenuItem>
  {/if}
{/snippet}