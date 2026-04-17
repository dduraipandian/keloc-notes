//go:build linux
// +build linux

package menu

import "github.com/wailsapp/wails/v2/pkg/menu"

// BuildMacMenu is a no-op on Linux.
// TODO: Implement native Linux menu bar support in future release.
func BuildMacMenu(host MenuHost) (*menu.Menu, *MenuRefs) {
	return nil, nil
}
