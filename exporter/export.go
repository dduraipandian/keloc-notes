package exporter

import (
	"archive/zip"
	"encoding/base64"
	"fmt"
	"io"
	"path"
	"path/filepath"
	"regexp"
	"strings"
)

type AssetDTO struct {
	Path       string
	DataBase64 string
}

type NoteDTO struct {
	Title      string
	Content    string
	FolderPath string
	UpdatedAt  string
	Assets     []AssetDTO
}

type ImportedNoteDTO struct {
	Title      string
	Content    string
	FolderPath string
	Assets     []AssetDTO
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

		for _, asset := range note.Assets {
			assetPath := strings.TrimPrefix(path.Clean(asset.Path), "/")
			if assetPath == "." || assetPath == "" {
				continue
			}

			assetData, err := base64.StdEncoding.DecodeString(asset.DataBase64)
			if err != nil {
				return fmt.Errorf("failed to decode asset %q: %w", asset.Path, err)
			}

			assetEntry, err := zw.Create(buildAssetPath(note.FolderPath, assetPath))
			if err != nil {
				return fmt.Errorf("failed to create asset zip entry: %w", err)
			}

			if _, err := assetEntry.Write(assetData); err != nil {
				return fmt.Errorf("failed to write asset %q: %w", asset.Path, err)
			}
		}
	}

	return nil
}

func ParseNotesZip(r io.ReaderAt, size int64) ([]ImportedNoteDTO, error) {
	zr, err := zip.NewReader(r, size)
	if err != nil {
		return nil, fmt.Errorf("failed to read zip: %w", err)
	}

	fileContents := make(map[string][]byte, len(zr.File))

	for _, f := range zr.File {
		if strings.HasSuffix(f.Name, "/") {
			continue
		}

		rc, err := f.Open()
		if err != nil {
			return nil, fmt.Errorf("failed to open zip entry: %w", err)
		}

		content, err := io.ReadAll(rc)
		rc.Close()
		if err != nil {
			return nil, fmt.Errorf("failed to read zip entry: %w", err)
		}

		fileContents[f.Name] = content
	}

	var notes []ImportedNoteDTO

	for _, f := range zr.File {
		if strings.HasSuffix(f.Name, "/") {
			continue
		}

		if filepath.Ext(f.Name) != ".md" {
			continue
		}

		title, folderPath := parseFileNameAndPath(f.Name)
		noteContent := extractContentFromMarkdown(string(fileContents[f.Name]), title)

		notes = append(notes, ImportedNoteDTO{
			Title:      title,
			Content:    noteContent,
			FolderPath: folderPath,
			Assets:     extractReferencedAssets(f.Name, noteContent, fileContents),
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

func buildAssetPath(folderPath, assetPath string) string {
	if folderPath == "" {
		return assetPath
	}
	return folderPath + "/" + assetPath
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

var markdownImageRef = regexp.MustCompile(`!\[[^\]]*]\(([^)]+)\)`)

func extractReferencedAssets(noteZipPath, noteContent string, files map[string][]byte) []AssetDTO {
	matches := markdownImageRef.FindAllStringSubmatch(noteContent, -1)
	if len(matches) == 0 {
		return nil
	}

	noteDir := path.Dir(noteZipPath)
	if noteDir == "." {
		noteDir = ""
	}

	assets := make([]AssetDTO, 0, len(matches))
	seen := make(map[string]struct{})

	for _, match := range matches {
		if len(match) < 2 {
			continue
		}

		linkTarget := strings.TrimSpace(match[1])
		if linkTarget == "" || strings.HasPrefix(linkTarget, "http://") || strings.HasPrefix(linkTarget, "https://") || strings.HasPrefix(linkTarget, "asset:") {
			continue
		}

		zipAssetPath := path.Clean(path.Join(noteDir, linkTarget))
		data, ok := files[zipAssetPath]
		if !ok {
			continue
		}
		if _, exists := seen[linkTarget]; exists {
			continue
		}
		seen[linkTarget] = struct{}{}

		assets = append(assets, AssetDTO{
			Path:       linkTarget,
			DataBase64: base64.StdEncoding.EncodeToString(data),
		})
	}

	return assets
}
