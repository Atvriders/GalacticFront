package main

import (
	"fmt"
	"os"
	"path/filepath"
)

// WriteScaledVersions writes 4x and 16x downsampled binary map files.
func WriteScaledVersions(dir string, mapName string, data *MapData) error {
	scales := []struct {
		factor float32
		suffix string
	}{
		{4.0, "4x"},
		{16.0, "16x"},
	}

	for _, s := range scales {
		scaled := ScaleMapData(data, s.factor)
		binData, err := EncodeBinary(scaled)
		if err != nil {
			return fmt.Errorf("encode %s: %w", s.suffix, err)
		}

		filename := fmt.Sprintf("%s_%s.gfmap", mapName, s.suffix)
		err = os.WriteFile(filepath.Join(dir, filename), binData, 0644)
		if err != nil {
			return fmt.Errorf("write %s: %w", s.suffix, err)
		}
	}

	return nil
}
