package exporter

import (
	"archive/zip"
	"fmt"
	"io"
	"path"
	"path/filepath"
	"regexp"
	"strings"
)

type NoteDTO struct {
	Title      string
	Content    string
	FolderPath string
	UpdatedAt  string
}

type ImportedNoteDTO struct {
	Title      string
	Content    string
	FolderPath string
}

func BuildNotesZip(w io.Writer, notes []NoteDTO) error {
	zw := zip.NewWriter(w)
	defer zw.Close()

	for _, note := range notes {
		filename := buildFilePath(note.FolderPath, note.Title)

		f, err := zw.Create(filename)
		if err != nil {
			return fmt.Errorf("failed to create zip entry: %w", err)
		}

		// Write note content with title as H1
		content := fmt.Sprintf("# %s\n%s", note.Title, note.Content)
		if _, err := io.WriteString(f, content); err != nil {
			return fmt.Errorf("failed to write note content: %w", err)
		}
	}

	return nil
}

func ParseNotesZip(r io.ReaderAt, size int64) ([]ImportedNoteDTO, error) {
	zr, err := zip.NewReader(r, size)
	if err != nil {
		return nil, fmt.Errorf("failed to read zip: %w", err)
	}

	var notes []ImportedNoteDTO

	for _, f := range zr.File {
		// Skip directories
		if strings.HasSuffix(f.Name, "/") {
			continue
		}

		// Only process .md files
		if filepath.Ext(f.Name) != ".md" {
			continue
		}

		rc, err := f.Open()
		if err != nil {
			return nil, fmt.Errorf("failed to open zip entry: %w", err)
		}
		defer rc.Close()

		content, err := io.ReadAll(rc)
		if err != nil {
			return nil, fmt.Errorf("failed to read zip entry: %w", err)
		}

		title, folderPath := parseFileNameAndPath(f.Name)
		noteContent := extractContentFromMarkdown(string(content), title)

		notes = append(notes, ImportedNoteDTO{
			Title:      title,
			Content:    noteContent,
			FolderPath: folderPath,
		})
	}

	return notes, nil
}

func buildFilePath(folderPath, title string) string {
	if folderPath == "" {
		return sanitizeFilename(title) + ".md"
	}
	return folderPath + "/" + sanitizeFilename(title) + ".md"
}

func parseFileNameAndPath(zipPath string) (title string, folderPath string) {
	// Remove .md extension
	basePath := strings.TrimSuffix(zipPath, ".md")

	// Split into directory and filename
	dir := path.Dir(basePath)
	filename := path.Base(basePath)

	if dir == "." {
		dir = ""
	}

	return filename, dir
}

func sanitizeFilename(s string) string {
	// Remove or replace invalid filename characters
	re := regexp.MustCompile(`[/:*?"<>|]`)
	s = re.ReplaceAllString(s, "")
	// Truncate to 128 chars
	if len(s) > 128 {
		s = s[:128]
	}
	return strings.TrimSpace(s)
}

func extractContentFromMarkdown(content, expectedTitle string) string {
	lines := strings.Split(content, "\n")
	if len(lines) == 0 {
		return ""
	}

	// Skip the first line if it's a heading matching the title
	startIdx := 0
	if len(lines) > 0 && strings.HasPrefix(lines[0], "# ") {
		startIdx = 1
	}

	return strings.TrimSpace(strings.Join(lines[startIdx:], "\n"))
}
