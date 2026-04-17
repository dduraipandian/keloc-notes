package backup

import (
	"encoding/json"
	"fmt"
	"time"
)

type BackupPayload struct {
	SchemaVersion int                   `json:"schemaVersion"`
	ExportedAt    string                `json:"exportedAt"`
	AppVersion    string                `json:"appVersion"`
	Folders       []interface{}         `json:"folders"`
	Notes         []interface{}         `json:"notes"`
	Settings      map[string]interface{} `json:"settings"`
}

func CreateBackupPayload(
	folders []interface{},
	notes []interface{},
	settings map[string]interface{},
	appVersion string,
) (string, error) {
	payload := BackupPayload{
		SchemaVersion: 1,
		ExportedAt:    time.Now().UTC().Format(time.RFC3339),
		AppVersion:    appVersion,
		Folders:       folders,
		Notes:         notes,
		Settings:      settings,
	}

	data, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal backup payload: %w", err)
	}

	return string(data), nil
}

func ParseBackupPayload(jsonStr string) (*BackupPayload, error) {
	var payload BackupPayload

	if err := json.Unmarshal([]byte(jsonStr), &payload); err != nil {
		return nil, fmt.Errorf("failed to unmarshal backup payload: %w", err)
	}

	// Validate schema version
	if payload.SchemaVersion != 1 {
		return nil, fmt.Errorf("unsupported backup schema version: %d", payload.SchemaVersion)
	}

	return &payload, nil
}
