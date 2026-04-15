package main

import (
	"context"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx context.Context
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
