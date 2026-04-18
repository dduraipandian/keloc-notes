package main

import (
	"context"
	"os"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/runtime"
	exp "mdnotes/exporter"
	"mdnotes/menu"
)

// App struct
type App struct {
	ctx      context.Context
	menuRefs *menu.MenuRefs
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

func (a *App) onSecondInstanceLaunch(secondInstanceData options.SecondInstanceData) {
	secondInstanceArgs := secondInstanceData.Args

	println("user opened second instance", strings.Join(secondInstanceData.Args, ","))
	println("user opened second from", secondInstanceData.WorkingDirectory)
	runtime.WindowUnminimise(a.ctx)
	runtime.Show(a.ctx)
	go runtime.EventsEmit(a.ctx, "launchArgs", secondInstanceArgs)
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func (a *App) beforeClose(ctx context.Context) (prevent bool) {
	done := make(chan struct{}, 1)
	cancel := runtime.EventsOnce(a.ctx, "app:flush-complete", func(optionalData ...interface{}) {
		select {
		case done <- struct{}{}:
		default:
		}
	})
	defer cancel()

	runtime.EventsEmit(a.ctx, "app:before-close")

	select {
	case <-done:
	case <-time.After(3 * time.Second):
	case <-ctx.Done():
	}

	return false
}

// MenuHost implementation — menu event handlers

func (a *App) OnOpenAbout() {
	runtime.EventsEmit(a.ctx, "menu:open-about")
}

func (a *App) OnOpenPreferences() {
	runtime.EventsEmit(a.ctx, "menu:open-preferences")
}

func (a *App) OnNewNote() {
	runtime.EventsEmit(a.ctx, "menu:new-note")
}

func (a *App) OnNewFolder() {
	runtime.EventsEmit(a.ctx, "menu:new-folder")
}

func (a *App) OnDeleteNote() {
	runtime.EventsEmit(a.ctx, "menu:delete-note")
}

func (a *App) OnEmptyTrash() {
	runtime.EventsEmit(a.ctx, "menu:empty-trash")
}

func (a *App) OnToggleSidebar() {
	runtime.EventsEmit(a.ctx, "menu:toggle-sidebar")
}

func (a *App) OnToggleNoteList() {
	runtime.EventsEmit(a.ctx, "menu:toggle-note-list")
}

func (a *App) OnSetTheme(theme string) {
	runtime.EventsEmit(a.ctx, "menu:set-theme", theme)
}

func (a *App) OnFocusSearch() {
	runtime.EventsEmit(a.ctx, "menu:focus-search")
}

func (a *App) OnExportCurrentNote() {
	runtime.EventsEmit(a.ctx, "menu:export-note")
}

func (a *App) OnExportAllMarkdown() {
	runtime.EventsEmit(a.ctx, "menu:export-all-markdown")
}

func (a *App) OnExportBackup() {
	runtime.EventsEmit(a.ctx, "menu:export-backup")
}

func (a *App) OnImportMarkdown() {
	runtime.EventsEmit(a.ctx, "menu:import-markdown")
}

func (a *App) OnImportBackup() {
	runtime.EventsEmit(a.ctx, "menu:import-backup")
}

func (a *App) OnHelp(topic string) {
	runtime.EventsEmit(a.ctx, "menu:help", topic)
}

// UpdateMenuState updates the menu based on the current application state.
func (a *App) UpdateMenuState(state menu.MenuState) {
	if a.menuRefs != nil {
		a.menuRefs.Apply(state, a.ctx)
	}
}

// SetMenuRefs stores a reference to the menu items for dynamic updates.
func (a *App) SetMenuRefs(refs *menu.MenuRefs) {
	a.menuRefs = refs
}

// ExportNoteToFile saves a single note as markdown file
func (a *App) ExportNoteToFile(title, content string) error {
	filepath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		DefaultFilename: title + ".md",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "Markdown Files",
				Pattern:     "*.md",
			},
		},
	})
	if err != nil || filepath == "" {
		return err
	}

	mdContent := "# " + title + "\n" + content
	return os.WriteFile(filepath, []byte(mdContent), 0644)
}

// ExportNotesZip exports multiple notes as a zip archive
func (a *App) ExportNotesZip(notes []exp.NoteDTO) error {
	filepath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		DefaultFilename: "notes_export.zip",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "ZIP Archives",
				Pattern:     "*.zip",
			},
		},
	})
	if err != nil || filepath == "" {
		return err
	}

	file, err := os.Create(filepath)
	if err != nil {
		return err
	}
	defer file.Close()

	return exp.BuildNotesZip(file, notes)
}

// ImportNotesZip opens a file dialog and returns parsed notes from the selected zip
func (a *App) ImportNotesZip() ([]exp.ImportedNoteDTO, error) {
	filepath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Import Notes",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "ZIP Archives",
				Pattern:     "*.zip",
			},
		},
	})
	if err != nil || filepath == "" {
		return nil, err
	}

	file, err := os.Open(filepath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	fi, err := file.Stat()
	if err != nil {
		return nil, err
	}

	return exp.ParseNotesZip(file, fi.Size())
}

// SaveBackupFile saves a JSON backup file
func (a *App) SaveBackupFile(content string) error {
	filepath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		DefaultFilename: "mdnotes_backup.json",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "JSON Files",
				Pattern:     "*.json",
			},
		},
	})
	if err != nil || filepath == "" {
		return err
	}

	return os.WriteFile(filepath, []byte(content), 0644)
}

// ReadBackupFile opens a file dialog and returns the backup JSON contents
func (a *App) ReadBackupFile() (string, error) {
	filepath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Import Backup",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "JSON Files",
				Pattern:     "*.json",
			},
		},
	})
	if err != nil || filepath == "" {
		return "", err
	}

	content, err := os.ReadFile(filepath)
	if err != nil {
		return "", err
	}

	return string(content), nil
}
