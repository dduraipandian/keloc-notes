package menu

import (
	"testing"

	wailsmenu "github.com/wailsapp/wails/v2/pkg/menu"
)

// mockMenuHost implements MenuHost for testing.
type mockMenuHost struct {
	onOpenAboutCalled       bool
	onOpenPreferencesCalled bool
	onCloseWindowCalled     bool
	onToggleFullscreenCalled bool
	helpTopics              []string
}

func (m *mockMenuHost) OnOpenAbout() {
	m.onOpenAboutCalled = true
}

func (m *mockMenuHost) OnOpenPreferences() {
	m.onOpenPreferencesCalled = true
}

func (m *mockMenuHost) OnCloseWindow() {
	m.onCloseWindowCalled = true
}

func (m *mockMenuHost) OnNewNote()             {}
func (m *mockMenuHost) OnNewFolder()           {}
func (m *mockMenuHost) OnDeleteNote()          {}
func (m *mockMenuHost) OnEmptyTrash()          {}
func (m *mockMenuHost) OnToggleSidebar()       {}
func (m *mockMenuHost) OnToggleNoteList()      {}
func (m *mockMenuHost) OnToggleFullscreen()    { m.onToggleFullscreenCalled = true }
func (m *mockMenuHost) OnSetTheme(theme string) {}
func (m *mockMenuHost) OnFocusSearch()         {}
func (m *mockMenuHost) OnExportCurrentNote()   {}
func (m *mockMenuHost) OnExportAllMarkdown()   {}
func (m *mockMenuHost) OnExportBackup()        {}
func (m *mockMenuHost) OnImportMarkdown()      {}
func (m *mockMenuHost) OnImportBackup()        {}
func (m *mockMenuHost) OnHelp(topic string)    { m.helpTopics = append(m.helpTopics, topic) }

func TestBuildMacMenuStructure(t *testing.T) {
	host := &mockMenuHost{}
	mainMenu, _ := BuildMacMenu(host)

	if mainMenu == nil {
		t.Fatal("BuildMacMenu returned nil")
	}

	// The menu should have multiple submenus (App, File, Edit, View, Window, Help)
	if len(mainMenu.Items) < 5 {
		t.Fatalf("expected at least 5 menu items, got %d", len(mainMenu.Items))
	}

	// First item should be the App menu titled "mdnotes"
	appMenum := mainMenu.Items[0]
	if appMenum.Label != "mdnotes" {
		t.Errorf("expected first menu 'mdnotes', got '%s'", appMenum.Label)
	}

	if appMenum.SubMenu == nil {
		t.Fatal("app menu has no submenu")
	}

	// Check that key items exist in the app submenu
	var (
		hasAbout        bool
		hasPreferences  bool
	)

	for _, item := range appMenum.SubMenu.Items {
		if item == nil {
			continue
		}
		if item.Label == "About mdnotes" {
			hasAbout = true
		}
		if item.Label == "Settings..." {
			hasPreferences = true
			if item.Accelerator == nil {
				t.Error("Settings... item should have an accelerator")
			}
		}
	}

	if !hasAbout {
		t.Error("App menu missing 'About mdnotes' item")
	}

	if !hasPreferences {
		t.Error("App menu missing 'Settings...' item")
	}

	// Check File menu exists
	fileMenu := mainMenu.Items[1]
	if fileMenu.Label != "File" {
		t.Errorf("expected second menu 'File', got '%s'", fileMenu.Label)
	}

	// Check Edit menu exists and has expected items
	editMenu := mainMenu.Items[2]
	if editMenu.Label != "Edit" {
		t.Errorf("expected third menu 'Edit', got '%s'", editMenu.Label)
	}

	// Check Edit menu has EditMenuRole (Native items handled by OS)
	if editMenu.Role == 0 {
		t.Error("Edit menu should have a native role")
	}

	// Check View menu exists
	viewMenu := mainMenu.Items[3]
	if viewMenu.Label != "View" {
		t.Errorf("expected fourth menu 'View', got '%s'", viewMenu.Label)
	}

	if viewMenu.SubMenu == nil {
		t.Fatal("View menu has no submenu")
	}

	// Check for key View menu items
	var (
		hasToggleSidebar   bool
		hasToggleNoteList  bool
		hasAppearance      bool
		hasFullScreen      bool
		hasFind            bool
	)

	for _, item := range viewMenu.SubMenu.Items {
		if item == nil {
			continue
		}
		switch item.Label {
		case "Toggle Sidebar":
			hasToggleSidebar = true
		case "Toggle Note List":
			hasToggleNoteList = true
		case "Appearance":
			hasAppearance = true
			if item.SubMenu == nil {
				t.Error("Appearance should have a submenu")
			}
		case "Enter Full Screen":
			hasFullScreen = true
		case "Find":
			hasFind = true
			if item.Accelerator == nil {
				t.Error("Find item should have Cmd+F accelerator")
			}
		}
	}

	if !hasFind {
		t.Error("View menu missing 'Find' item")
	}
	if !hasToggleSidebar {
		t.Error("View menu missing 'Toggle Sidebar' item")
	}
	if !hasToggleNoteList {
		t.Error("View menu missing 'Toggle Note List' item")
	}
	if !hasAppearance {
		t.Error("View menu missing 'Appearance' item")
	}
	if !hasFullScreen {
		t.Error("View menu missing 'Enter Full Screen' item")
	}

	// Check Window menu exists
	windowMenu := mainMenu.Items[4]
	if windowMenu.Label != "Window" {
		t.Errorf("expected fifth menu 'Window', got '%s'", windowMenu.Label)
	}

	// In Wails v2, WindowMenu() uses a role that hides children in the Go side.
	if windowMenu.Role == 0 {
		t.Error("Window menu should have a native role")
	}

	// Check File menu
	var hasCloseWindow bool
	for _, item := range fileMenu.SubMenu.Items {
		if item != nil && item.Label == "Close Window" {
			hasCloseWindow = true
		}
	}
	if !hasCloseWindow {
		t.Error("File menu missing 'Close Window' item")
	}

	// Check Help menu exists
	helpMenu := mainMenu.Items[5]
	if helpMenu.Label != "Help" {
		t.Errorf("expected sixth menu 'Help', got '%s'", helpMenu.Label)
	}

	if helpMenu.SubMenu == nil {
		t.Fatal("Help menu has no submenu")
	}

	// Check for Help menu items
	var (
		hasHelpItem   bool
		hasReportBug  bool
	)

	for _, item := range helpMenu.SubMenu.Items {
		if item == nil {
			continue
		}
		switch item.Label {
		case "mdnotes Help":
			hasHelpItem = true
		case "Report a Bug":
			hasReportBug = true
		}
	}

	if !hasHelpItem {
		t.Error("Help menu missing 'mdnotes Help' item")
	}
	if !hasReportBug {
		t.Error("Help menu missing 'Report a Bug' item")
	}
}

func TestMacMenuCallbacksInvokeHostActions(t *testing.T) {
	host := &mockMenuHost{}
	mainMenu, _ := BuildMacMenu(host)

	fileMenu := mainMenu.Items[1]
	viewMenu := mainMenu.Items[3]
	helpMenu := mainMenu.Items[5]

	var closeWindowItem *wailsmenu.MenuItem
	for _, item := range fileMenu.SubMenu.Items {
		if item != nil && item.Label == "Close Window" {
			closeWindowItem = item
			break
		}
	}
	if closeWindowItem == nil {
		t.Fatal("Close Window item not found")
	}
	closeWindowItem.Click(&wailsmenu.CallbackData{MenuItem: closeWindowItem})
	if !host.onCloseWindowCalled {
		t.Error("Close Window should invoke host.OnCloseWindow")
	}

	var fullscreenItem *wailsmenu.MenuItem
	for _, item := range viewMenu.SubMenu.Items {
		if item != nil && item.Label == "Enter Full Screen" {
			fullscreenItem = item
			break
		}
	}
	if fullscreenItem == nil {
		t.Fatal("Enter Full Screen item not found")
	}
	fullscreenItem.Click(&wailsmenu.CallbackData{MenuItem: fullscreenItem})
	if !host.onToggleFullscreenCalled {
		t.Error("Enter Full Screen should invoke host.OnToggleFullscreen")
	}

	var helpItem *wailsmenu.MenuItem
	var reportBugItem *wailsmenu.MenuItem
	for _, item := range helpMenu.SubMenu.Items {
		if item == nil {
			continue
		}
		switch item.Label {
		case "mdnotes Help":
			helpItem = item
		case "Report a Bug":
			reportBugItem = item
		}
	}
	if helpItem == nil || reportBugItem == nil {
		t.Fatal("help menu items not found")
	}

	helpItem.Click(&wailsmenu.CallbackData{MenuItem: helpItem})
	reportBugItem.Click(&wailsmenu.CallbackData{MenuItem: reportBugItem})

	if len(host.helpTopics) != 2 {
		t.Fatalf("expected 2 help callbacks, got %d", len(host.helpTopics))
	}
	if host.helpTopics[0] != "help" {
		t.Errorf("expected first help topic 'help', got %q", host.helpTopics[0])
	}
	if host.helpTopics[1] != "report-bug" {
		t.Errorf("expected second help topic 'report-bug', got %q", host.helpTopics[1])
	}
}

func TestMenuStateApply(t *testing.T) {
	host := &mockMenuHost{}
	_, refs := BuildMacMenu(host)

	// Test MoveToTrash disabled when no note selected
	state := MenuState{HasSelectedNote: false, SelectedNoteInTrash: false, TrashHasItems: false, Theme: "light"}
	refs.Apply(state, nil)
	if !refs.MoveToTrash.Disabled {
		t.Error("MoveToTrash should be disabled when no note selected")
	}

	// Test MoveToTrash disabled when note in trash
	state = MenuState{HasSelectedNote: true, SelectedNoteInTrash: true, TrashHasItems: true, Theme: "light"}
	refs.Apply(state, nil)
	if !refs.MoveToTrash.Disabled {
		t.Error("MoveToTrash should be disabled when note is in trash")
	}

	// Test MoveToTrash enabled when note selected and not in trash
	state = MenuState{HasSelectedNote: true, SelectedNoteInTrash: false, TrashHasItems: false, Theme: "light"}
	refs.Apply(state, nil)
	if refs.MoveToTrash.Disabled {
		t.Error("MoveToTrash should be enabled when note selected and not in trash")
	}

	// Test EmptyTrash disabled when trash empty
	state = MenuState{HasSelectedNote: false, SelectedNoteInTrash: false, TrashHasItems: false, Theme: "light"}
	refs.Apply(state, nil)
	if !refs.EmptyTrash.Disabled {
		t.Error("EmptyTrash should be disabled when trash is empty")
	}

	// Test EmptyTrash enabled when trash has items
	state = MenuState{HasSelectedNote: false, SelectedNoteInTrash: false, TrashHasItems: true, Theme: "light"}
	refs.Apply(state, nil)
	if refs.EmptyTrash.Disabled {
		t.Error("EmptyTrash should be enabled when trash has items")
	}

	// Test ExportCurrentNote disabled when no note selected
	state = MenuState{HasSelectedNote: false, SelectedNoteInTrash: false, TrashHasItems: false, Theme: "light"}
	refs.Apply(state, nil)
	if !refs.ExportCurrentNote.Disabled {
		t.Error("ExportCurrentNote should be disabled when no note selected")
	}

	// Test ExportCurrentNote enabled when note selected
	state = MenuState{HasSelectedNote: true, SelectedNoteInTrash: true, TrashHasItems: false, Theme: "light"}
	refs.Apply(state, nil)
	if refs.ExportCurrentNote.Disabled {
		t.Error("ExportCurrentNote should be enabled when note selected")
	}

	// Test Appearance checkmarks
	state = MenuState{HasSelectedNote: false, SelectedNoteInTrash: false, TrashHasItems: false, Theme: "light"}
	refs.Apply(state, nil)
	if !refs.AppearanceLight.Checked {
		t.Error("AppearanceLight should be checked when theme is 'light'")
	}
	if refs.AppearanceDark.Checked {
		t.Error("AppearanceDark should not be checked when theme is 'light'")
	}
	if refs.AppearanceSystem.Checked {
		t.Error("AppearanceSystem should not be checked when theme is 'light'")
	}

	// Test dark theme
	state = MenuState{HasSelectedNote: false, SelectedNoteInTrash: false, TrashHasItems: false, Theme: "dark"}
	refs.Apply(state, nil)
	if refs.AppearanceLight.Checked {
		t.Error("AppearanceLight should not be checked when theme is 'dark'")
	}
	if !refs.AppearanceDark.Checked {
		t.Error("AppearanceDark should be checked when theme is 'dark'")
	}
	if refs.AppearanceSystem.Checked {
		t.Error("AppearanceSystem should not be checked when theme is 'dark'")
	}

	// Test system theme
	state = MenuState{HasSelectedNote: false, SelectedNoteInTrash: false, TrashHasItems: false, Theme: "system"}
	refs.Apply(state, nil)
	if refs.AppearanceLight.Checked {
		t.Error("AppearanceLight should not be checked when theme is 'system'")
	}
	if refs.AppearanceDark.Checked {
		t.Error("AppearanceDark should not be checked when theme is 'system'")
	}
	if !refs.AppearanceSystem.Checked {
		t.Error("AppearanceSystem should be checked when theme is 'system'")
	}
}
