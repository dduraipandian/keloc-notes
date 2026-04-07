<script lang="ts">
 import CalendarIcon from "@lucide/svelte/icons/calendar";
 import HouseIcon from "@lucide/svelte/icons/house";
 import InboxIcon from "@lucide/svelte/icons/inbox";
 import SearchIcon from "@lucide/svelte/icons/search";
 import SettingsIcon from "@lucide/svelte/icons/settings";
 import FolderPlus from "@lucide/svelte/icons/folder-plus";
 import * as Sidebar from "$lib/components/ui/sidebar/index.js";

 
 // Menu items.
 const items = [
  {
   title: "Home",
   url: "#",
   icon: HouseIcon,
  },
  {
   title: "Inbox",
   url: "#",
   icon: InboxIcon,
  },
  {
   title: "Calendar",
   url: "#",
   icon: CalendarIcon,
  },
  {
   title: "Search",
   url: "#",
   icon: SearchIcon,
  },
  {
   title: "Settings",
   url: "#",
   icon: SettingsIcon,
  },
 ];
</script>
 
<Sidebar.Root collapsible="icon">
 <Sidebar.Content>
  <Sidebar.Group class="group-data-[collapsible=icon]:hidden">
   <Sidebar.GroupLabel>Folders</Sidebar.GroupLabel>
   <Sidebar.GroupContent>
    <Sidebar.Menu>
     {#each items as item (item.title)}
      <Sidebar.MenuItem>
       <Sidebar.MenuButton>
        {#snippet child({ props })}
         {@const Icon = item.icon}
         <a href={item.url} {...props}>
          <Icon />
          <span>{item.title}</span>
         </a>
        {/snippet}
       </Sidebar.MenuButton>
       <Sidebar.MenuBadge>24</Sidebar.MenuBadge>
      </Sidebar.MenuItem>
      <!-- <Sidebar.Separator /> -->
     {/each}
    </Sidebar.Menu>
   </Sidebar.GroupContent>
  </Sidebar.Group>
 </Sidebar.Content>
 <Sidebar.Footer>
      <Sidebar.Group>
        <Sidebar.GroupLabel>New Folder</Sidebar.GroupLabel>
            <Sidebar.GroupAction title="Add Project">
                <FolderPlus /> <span class="sr-only">Add Project</span>
            </Sidebar.GroupAction>
        <Sidebar.GroupContent />
    </Sidebar.Group>
</Sidebar.Footer>
</Sidebar.Root>