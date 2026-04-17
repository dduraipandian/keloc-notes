package exporter

import (
	"archive/zip"
	"bytes"
	"io"
	"strings"
	"testing"
)

func TestBuildNotesZip(t *testing.T) {
	tests := []struct {
		name     string
		notes    []NoteDTO
		wantPaths []string
	}{
		{
			name: "single note at root",
			notes: []NoteDTO{
				{Title: "Test Note", Content: "Hello", FolderPath: "", UpdatedAt: "2025-01-01"},
			},
			wantPaths: []string{"Test Note.md"},
		},
		{
			name: "note in folder",
			notes: []NoteDTO{
				{Title: "Nested Note", Content: "Content", FolderPath: "My Folder", UpdatedAt: "2025-01-01"},
			},
			wantPaths: []string{"My Folder/Nested Note.md"},
		},
		{
			name: "nested folder structure",
			notes: []NoteDTO{
				{Title: "Deep Note", Content: "Deep", FolderPath: "A/B/C", UpdatedAt: "2025-01-01"},
			},
			wantPaths: []string{"A/B/C/Deep Note.md"},
		},
		{
			name: "multiple notes",
			notes: []NoteDTO{
				{Title: "Note1", Content: "Content1", FolderPath: "", UpdatedAt: "2025-01-01"},
				{Title: "Note2", Content: "Content2", FolderPath: "Folder1", UpdatedAt: "2025-01-01"},
				{Title: "Note3", Content: "Content3", FolderPath: "Folder1", UpdatedAt: "2025-01-01"},
			},
			wantPaths: []string{"Note1.md", "Folder1/Note2.md", "Folder1/Note3.md"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			buf := new(bytes.Buffer)
			err := BuildNotesZip(buf, tt.notes)
			if err != nil {
				t.Fatalf("BuildNotesZip failed: %v", err)
			}

			zr, err := zip.NewReader(bytes.NewReader(buf.Bytes()), int64(buf.Len()))
			if err != nil {
				t.Fatalf("Failed to read zip: %v", err)
			}

			if len(zr.File) != len(tt.wantPaths) {
				t.Errorf("Expected %d files, got %d", len(tt.wantPaths), len(zr.File))
			}

			for i, f := range zr.File {
				if i < len(tt.wantPaths) && f.Name != tt.wantPaths[i] {
					t.Errorf("File %d: expected %q, got %q", i, tt.wantPaths[i], f.Name)
				}
			}
		})
	}
}

func TestParseNotesZip(t *testing.T) {
	// Create a test zip with some notes
	buf := new(bytes.Buffer)
	zw := zip.NewWriter(buf)

	// Write test files
	files := map[string]string{
		"Note1.md":       "# Note1\nContent1",
		"Folder/Note2.md": "# Note2\nContent2",
	}

	for name, content := range files {
		w, err := zw.Create(name)
		if err != nil {
			t.Fatalf("Failed to create file in zip: %v", err)
		}
		if _, err := io.WriteString(w, content); err != nil {
			t.Fatalf("Failed to write file in zip: %v", err)
		}
	}

	zw.Close()

	// Parse the zip
	notes, err := ParseNotesZip(bytes.NewReader(buf.Bytes()), int64(buf.Len()))
	if err != nil {
		t.Fatalf("ParseNotesZip failed: %v", err)
	}

	if len(notes) != 2 {
		t.Errorf("Expected 2 notes, got %d", len(notes))
	}

	expectedTitles := []string{"Note1", "Note2"}
	for i, note := range notes {
		if i < len(expectedTitles) && !strings.Contains(note.Title, expectedTitles[i]) {
			t.Errorf("Note %d title: expected to contain %q, got %q", i, expectedTitles[i], note.Title)
		}
	}
}

func TestParseNotesZipPreservesPath(t *testing.T) {
	buf := new(bytes.Buffer)
	zw := zip.NewWriter(buf)

	// Write a file in a nested folder
	w, _ := zw.Create("Folder1/Folder2/Note.md")
	io.WriteString(w, "# Note\nContent")
	zw.Close()

	notes, _ := ParseNotesZip(bytes.NewReader(buf.Bytes()), int64(buf.Len()))

	if len(notes) != 1 {
		t.Fatalf("Expected 1 note, got %d", len(notes))
	}

	if notes[0].FolderPath != "Folder1/Folder2" {
		t.Errorf("Expected FolderPath to be 'Folder1/Folder2', got %q", notes[0].FolderPath)
	}
}
