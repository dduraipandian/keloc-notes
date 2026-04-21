package exporter

import (
	"archive/zip"
	"bytes"
	"encoding/base64"
	"io"
	"strings"
	"testing"
)

func TestBuildNotesZipWithAssets(t *testing.T) {
	buf := new(bytes.Buffer)
	err := BuildNotesZip(buf, []NoteDTO{
		{
			Title:      "Roadmap",
			Content:    "# Roadmap\n\n![Hero](Roadmap.assets/hero.webp)",
			FolderPath: "2025",
			UpdatedAt:  "2025-01-01T00:00:00.000Z",
			Assets: []AssetDTO{
				{
					Path:       "Roadmap.assets/hero.webp",
					DataBase64: base64.StdEncoding.EncodeToString([]byte("hero-image")),
				},
			},
		},
	})
	if err != nil {
		t.Fatalf("BuildNotesZip failed: %v", err)
	}

	zr, err := zip.NewReader(bytes.NewReader(buf.Bytes()), int64(buf.Len()))
	if err != nil {
		t.Fatalf("zip reader failed: %v", err)
	}

	if len(zr.File) != 2 {
		t.Fatalf("expected 2 zip entries, got %d", len(zr.File))
	}

	var noteFound, assetFound bool
	for _, f := range zr.File {
		switch f.Name {
		case "2025/Roadmap.md":
			noteFound = true
		case "2025/Roadmap.assets/hero.webp":
			assetFound = true
			rc, err := f.Open()
			if err != nil {
				t.Fatalf("failed to open asset: %v", err)
			}
			defer rc.Close()
			data, err := io.ReadAll(rc)
			if err != nil {
				t.Fatalf("failed to read asset: %v", err)
			}
			if string(data) != "hero-image" {
				t.Fatalf("expected asset bytes to round-trip, got %q", string(data))
			}
		}
	}

	if !noteFound {
		t.Fatal("expected markdown note entry to exist")
	}
	if !assetFound {
		t.Fatal("expected asset entry to exist")
	}
}

func TestParseNotesZipWithReferencedAssets(t *testing.T) {
	buf := new(bytes.Buffer)
	zw := zip.NewWriter(buf)

	md, err := zw.Create("2025/Roadmap.md")
	if err != nil {
		t.Fatalf("failed to create markdown entry: %v", err)
	}
	if _, err := io.WriteString(md, "# Roadmap\n\n![Hero](Roadmap.assets/hero.webp)"); err != nil {
		t.Fatalf("failed to write markdown: %v", err)
	}

	asset, err := zw.Create("2025/Roadmap.assets/hero.webp")
	if err != nil {
		t.Fatalf("failed to create asset entry: %v", err)
	}
	if _, err := io.WriteString(asset, "hero-image"); err != nil {
		t.Fatalf("failed to write asset: %v", err)
	}

	if err := zw.Close(); err != nil {
		t.Fatalf("failed to close zip writer: %v", err)
	}

	notes, err := ParseNotesZip(bytes.NewReader(buf.Bytes()), int64(buf.Len()))
	if err != nil {
		t.Fatalf("ParseNotesZip failed: %v", err)
	}

	if len(notes) != 1 {
		t.Fatalf("expected 1 note, got %d", len(notes))
	}

	if notes[0].FolderPath != "2025" {
		t.Fatalf("expected folder path 2025, got %q", notes[0].FolderPath)
	}

	if !strings.Contains(notes[0].Content, "![Hero](Roadmap.assets/hero.webp)") {
		t.Fatalf("expected markdown content to preserve relative asset link, got %q", notes[0].Content)
	}

	if len(notes[0].Assets) != 1 {
		t.Fatalf("expected 1 imported asset, got %d", len(notes[0].Assets))
	}

	if notes[0].Assets[0].Path != "Roadmap.assets/hero.webp" {
		t.Fatalf("expected asset path to be relative to markdown file, got %q", notes[0].Assets[0].Path)
	}

	decoded, err := base64.StdEncoding.DecodeString(notes[0].Assets[0].DataBase64)
	if err != nil {
		t.Fatalf("failed to decode asset data: %v", err)
	}

	if string(decoded) != "hero-image" {
		t.Fatalf("expected decoded asset bytes to match, got %q", string(decoded))
	}
}
