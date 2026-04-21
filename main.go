package main

import (
	"embed"

	menuPkg "keloc-notes/menu"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/build
var assets embed.FS

func main() {
	// Create an instance of the app structure
	app := NewApp()

	// Build menu and store references for dynamic updates
	macMenu, menuRefs := menuPkg.BuildMacMenu(app)
	app.SetMenuRefs(menuRefs)

	// Create application with options
	err := wails.Run(&options.App{
		Title:  "Keloc Notes",
		Width:  1024,
		Height: 768,
		EnableDefaultContextMenu: false,
		WindowStartState:   options.Maximised,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		SingleInstanceLock: &options.SingleInstanceLock{
			UniqueId:               "6060ee60-82be-4ad4-8ef9-24cc4ff5f5b4",
			OnSecondInstanceLaunch: app.onSecondInstanceLaunch,
		},
		Menu:             macMenu,
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		OnBeforeClose:    app.beforeClose,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
