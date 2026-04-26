//go:build darwin
// +build darwin

package menu

import (
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
)

// BuildMacMenu constructs the macOS menu bar for keloc-notes and returns menu + item references for dynamic updates.
func BuildMacMenu(host MenuHost) (*menu.Menu, *MenuRefs) {
	refs := &MenuRefs{}
	mainMenu := menu.NewMenu()
	mainMenu.Append(buildAppMenu(host))
	mainMenu.Append(buildFileMenu(host, refs))
	mainMenu.Append(buildEditMenu(host))
	mainMenu.Append(buildViewMenu(host, refs))
	mainMenu.Append(buildWindowMenu(host))
	mainMenu.Append(buildHelpMenu(host))
	return mainMenu, refs
}

func buildAppMenu(host MenuHost) *menu.MenuItem {
	appMenuItems := menu.NewMenu()
	appMenuItems.Append(menu.Text("About Keloc Notes", nil, func(cd *menu.CallbackData) {
		host.OnOpenAbout()
	}))
	appMenuItems.Append(menu.Separator())
	appMenuItems.Append(menu.Text("Settings...", keys.CmdOrCtrl(","), func(cd *menu.CallbackData) {
		host.OnOpenPreferences()
	}))
	appMenuItems.Append(menu.Separator())
	appMenuItems.Append(menu.AppMenu())

	return menu.SubMenu("Keloc Notes", appMenuItems)
}

func buildFileMenu(host MenuHost, refs *MenuRefs) *menu.MenuItem {
	fileMenuItems := menu.NewMenu()
	fileMenuItems.Append(menu.Text("New Note", keys.CmdOrCtrl("n"), func(cd *menu.CallbackData) {
		host.OnNewNote()
	}))
	fileMenuItems.Append(menu.Text("New Folder", keys.Combo("n", keys.CmdOrCtrlKey, keys.ShiftKey), func(cd *menu.CallbackData) {
		host.OnNewFolder()
	}))
	fileMenuItems.Append(menu.Separator())

	// Close Window
	fileMenuItems.Append(menu.Text("Close Window", keys.CmdOrCtrl("w"), func(cd *menu.CallbackData) {
		host.OnCloseWindow()
	}))
	fileMenuItems.Append(menu.Separator())

	// Import submenu
	importMenuItems := menu.NewMenu()
	importMenuItems.Append(menu.Text("Markdown Archive (.zip)...", nil, func(cd *menu.CallbackData) {
		host.OnImportMarkdown()
	}))
	importMenuItems.Append(menu.Text("Backup (.json)...", nil, func(cd *menu.CallbackData) {
		host.OnImportBackup()
	}))
	fileMenuItems.Append(menu.SubMenu("Import", importMenuItems))

	// Export submenu
	exportMenuItems := menu.NewMenu()
	exportCurrentNoteItem := menu.Text("Current Note (.md)", nil, func(cd *menu.CallbackData) {
		host.OnExportCurrentNote()
	})
	refs.ExportCurrentNote = exportCurrentNoteItem
	exportMenuItems.Append(exportCurrentNoteItem)
	exportMenuItems.Append(menu.Text("All Notes (.zip)...", nil, func(cd *menu.CallbackData) {
		host.OnExportAllMarkdown()
	}))
	exportMenuItems.Append(menu.Text("Backup (.json)...", nil, func(cd *menu.CallbackData) {
		host.OnExportBackup()
	}))
	fileMenuItems.Append(menu.SubMenu("Export", exportMenuItems))

	fileMenuItems.Append(menu.Separator())
	moveToTrashItem := menu.Text("Move to Trash", nil, func(cd *menu.CallbackData) {
		host.OnDeleteNote()
	})
	refs.MoveToTrash = moveToTrashItem
	fileMenuItems.Append(moveToTrashItem)

	emptyTrashItem := menu.Text("Empty Trash", nil, func(cd *menu.CallbackData) {
		host.OnEmptyTrash()
	})
	refs.EmptyTrash = emptyTrashItem
	fileMenuItems.Append(emptyTrashItem)

	return menu.SubMenu("File", fileMenuItems)
}

func buildEditMenu(host MenuHost) *menu.MenuItem {
	item := menu.EditMenu()
	item.Label = "Edit"
	return item
}

func buildViewMenu(host MenuHost, refs *MenuRefs) *menu.MenuItem {
	viewMenuItems := menu.NewMenu()

	viewMenuItems.Append(menu.Checkbox("Sidebar", true, keys.CmdOrCtrl("1"), func(cd *menu.CallbackData) {
		host.OnToggleSidebar()
	}))
	refs.SidebarVisible = viewMenuItems.Items[len(viewMenuItems.Items)-1]

	viewMenuItems.Append(menu.Checkbox("Note List", true, keys.CmdOrCtrl("2"), func(cd *menu.CallbackData) {
		host.OnToggleNoteList()
	}))
	refs.NoteListVisible = viewMenuItems.Items[len(viewMenuItems.Items)-1]

	viewMenuItems.Append(menu.Checkbox("Focus Editor", false, keys.CmdOrCtrl("3"), func(cd *menu.CallbackData) {
		host.OnToggleFocusEditor()
	}))
	refs.FocusEditor = viewMenuItems.Items[len(viewMenuItems.Items)-1]

	viewMenuItems.Append(menu.Separator())
	viewMenuItems.Append(menu.Text("Find", keys.CmdOrCtrl("f"), func(cd *menu.CallbackData) {
		host.OnFocusSearch()
	}))
	viewMenuItems.Append(menu.Separator())

	// Appearance submenu
	appearanceMenuItems := menu.NewMenu()
	appearanceLightItem := menu.Text("Light", nil, func(cd *menu.CallbackData) {
		host.OnSetTheme("light")
	})
	refs.AppearanceLight = appearanceLightItem
	appearanceMenuItems.Append(appearanceLightItem)

	appearanceDarkItem := menu.Text("Dark", nil, func(cd *menu.CallbackData) {
		host.OnSetTheme("dark")
	})
	refs.AppearanceDark = appearanceDarkItem
	appearanceMenuItems.Append(appearanceDarkItem)

	appearanceSystemItem := menu.Text("Follow System", nil, func(cd *menu.CallbackData) {
		host.OnSetTheme("system")
	})
	refs.AppearanceSystem = appearanceSystemItem
	appearanceMenuItems.Append(appearanceSystemItem)

	viewMenuItems.Append(menu.SubMenu("Appearance", appearanceMenuItems))

	viewMenuItems.Append(menu.Separator())
	viewMenuItems.Append(menu.Text("Enter Full Screen", nil, func(cd *menu.CallbackData) {
		host.OnToggleFullscreen()
	}))

	return menu.SubMenu("View", viewMenuItems)
}

func buildWindowMenu(host MenuHost) *menu.MenuItem {
	item := menu.WindowMenu()
	item.Label = "Window"
	return item
}

func buildHelpMenu(host MenuHost) *menu.MenuItem {
	helpMenuItems := menu.NewMenu()
	helpMenuItems.Append(menu.Text("Keloc Notes Help", nil, func(cd *menu.CallbackData) {
		host.OnHelp("help")
	}))
	helpMenuItems.Append(menu.Separator())
	helpMenuItems.Append(menu.Text("Report a Bug", nil, func(cd *menu.CallbackData) {
		host.OnHelp("report-bug")
	}))

	return menu.SubMenu("Help", helpMenuItems)
}
