//go:build windows
// +build windows

package menu

import "github.com/wailsapp/wails/v2/pkg/menu"

// BuildMacMenu is a no-op on Windows.
// TODO: Implement native Windows menu bar support in future release.
func BuildMacMenu(host MenuHost) (*menu.Menu, *MenuRefs) {
	return nil, nil
}
