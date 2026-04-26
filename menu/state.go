package menu

import (
	"context"

	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// MenuHost defines the interface for Go methods that the menu calls.
type MenuHost interface {
	OnOpenAbout()
	OnOpenPreferences()
	OnCloseWindow()
	OnNewNote()
	OnNewFolder()
	OnDeleteNote()
	OnEmptyTrash()
	OnToggleSidebar()
	OnToggleNoteList()
	OnToggleFocusEditor()
	OnToggleFullscreen()
	OnSetTheme(theme string)
	OnFocusSearch()
	OnExportCurrentNote()
	OnExportAllMarkdown()
	OnExportBackup()
	OnImportMarkdown()
	OnImportBackup()
	OnHelp(topic string)
}

// MenuRefs holds pointers to menu items that need dynamic state updates.
type MenuRefs struct {
	MoveToTrash       *menu.MenuItem
	EmptyTrash        *menu.MenuItem
	ExportCurrentNote *menu.MenuItem
	SidebarVisible    *menu.MenuItem
	NoteListVisible   *menu.MenuItem
	FocusEditor       *menu.MenuItem
	AppearanceLight   *menu.MenuItem
	AppearanceDark    *menu.MenuItem
	AppearanceSystem  *menu.MenuItem
}

// MenuState represents the current application state needed for dynamic menu updates.
type MenuState struct {
	HasSelectedNote     bool
	SelectedNoteInTrash bool
	TrashHasItems       bool
	SidebarVisible      bool
	NoteListVisible     bool
	FocusEditor         bool
	Theme               string // "light" | "dark" | "system"
}

// UpdateMenuState applies a MenuState to the menu by updating item disabled/checked states.
// Items that don't need updating are left nil in refs.
func (refs *MenuRefs) Apply(state MenuState, ctx context.Context) {
	if refs == nil {
		return
	}

	// Move to Trash: enabled only if note is selected and not already in trash
	if refs.MoveToTrash != nil {
		refs.MoveToTrash.Disabled = !(state.HasSelectedNote && !state.SelectedNoteInTrash)
	}

	// Empty Trash: enabled only if trash has items
	if refs.EmptyTrash != nil {
		refs.EmptyTrash.Disabled = !state.TrashHasItems
	}

	// Export Current Note: enabled only if note is selected
	if refs.ExportCurrentNote != nil {
		refs.ExportCurrentNote.Disabled = !state.HasSelectedNote
	}

	// Appearance items: set checked state based on current theme
	if refs.AppearanceLight != nil {
		refs.AppearanceLight.Checked = state.Theme == "light"
	}
	if refs.AppearanceDark != nil {
		refs.AppearanceDark.Checked = state.Theme == "dark"
	}
	if refs.AppearanceSystem != nil {
		refs.AppearanceSystem.Checked = state.Theme == "system"
	}

	// View toggle items: set checked state based on current visibility
	if refs.SidebarVisible != nil {
		refs.SidebarVisible.Checked = state.SidebarVisible
	}
	if refs.NoteListVisible != nil {
		refs.NoteListVisible.Checked = state.NoteListVisible
	}
	if refs.FocusEditor != nil {
		refs.FocusEditor.Checked = state.FocusEditor
	}

	// Notify Wails to refresh the menu display
	if ctx != nil {
		runtime.MenuUpdateApplicationMenu(ctx)
	}
}
