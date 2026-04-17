package menu

import (
	"context"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// MenuState represents the current application state needed for dynamic menu updates.
type MenuState struct {
	HasSelectedNote     bool
	SelectedNoteInTrash bool
	TrashHasItems       bool
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

	// Notify Wails to refresh the menu display
	if ctx != nil {
		runtime.MenuUpdateApplicationMenu(ctx)
	}
}
