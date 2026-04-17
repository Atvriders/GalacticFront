package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestGenerateSectorMap(t *testing.T) {
	tmpDir := t.TempDir()
	config := MapPresets["sector"]

	err := Generate(config, tmpDir, "debug")
	if err != nil {
		t.Fatalf("Generate failed: %v", err)
	}

	// Verify binary output exists and parses correctly
	mapDir := filepath.Join(tmpDir, "sector")
	binPath := filepath.Join(mapDir, "sector.gfmap")

	binData, err := os.ReadFile(binPath)
	if err != nil {
		t.Fatalf("Read binary: %v", err)
	}

	decoded, err := DecodeBinary(binData)
	if err != nil {
		t.Fatalf("Decode binary: %v", err)
	}

	// Verify system count
	if len(decoded.Systems) != config.SystemCount {
		t.Errorf("System count: got %d, want %d", len(decoded.Systems), config.SystemCount)
	}

	// Verify planet count > 0
	if len(decoded.Planets) == 0 {
		t.Error("No planets generated")
	}

	// Verify hyperlane count > 0
	if len(decoded.Hyperlanes) == 0 {
		t.Error("No hyperlanes generated")
	}

	// Verify connectivity
	err = ValidateMap(decoded)
	if err != nil {
		t.Errorf("Validation failed: %v", err)
	}

	// Verify manifest
	metaPath := filepath.Join(mapDir, "meta.json")
	metaData, err := os.ReadFile(metaPath)
	if err != nil {
		t.Fatalf("Read manifest: %v", err)
	}

	var manifest Manifest
	if err := json.Unmarshal(metaData, &manifest); err != nil {
		t.Fatalf("Parse manifest: %v", err)
	}

	if manifest.SystemCount != config.SystemCount {
		t.Errorf("Manifest system count: got %d, want %d", manifest.SystemCount, config.SystemCount)
	}

	if manifest.PlanetCount != len(decoded.Planets) {
		t.Errorf("Manifest planet count mismatch: got %d, decoded has %d", manifest.PlanetCount, len(decoded.Planets))
	}

	if manifest.HyperlaneCount != len(decoded.Hyperlanes) {
		t.Errorf("Manifest hyperlane count mismatch: got %d, decoded has %d", manifest.HyperlaneCount, len(decoded.Hyperlanes))
	}

	if len(manifest.NationSpawns) != len(Factions) {
		t.Errorf("Nation spawns: got %d, want %d", len(manifest.NationSpawns), len(Factions))
	}

	// Verify scaled versions exist
	for _, suffix := range []string{"4x", "16x"} {
		scaledPath := filepath.Join(mapDir, "sector_"+suffix+".gfmap")
		if _, err := os.Stat(scaledPath); os.IsNotExist(err) {
			t.Errorf("Scaled version %s not found", suffix)
		}

		// Verify scaled version parses
		scaledData, err := os.ReadFile(scaledPath)
		if err != nil {
			t.Errorf("Read scaled %s: %v", suffix, err)
			continue
		}
		scaledDecoded, err := DecodeBinary(scaledData)
		if err != nil {
			t.Errorf("Decode scaled %s: %v", suffix, err)
			continue
		}
		if len(scaledDecoded.Systems) != config.SystemCount {
			t.Errorf("Scaled %s system count: got %d, want %d", suffix, len(scaledDecoded.Systems), config.SystemCount)
		}
	}
}

func TestBinaryRoundTrip(t *testing.T) {
	data := &MapData{
		Systems: []System{
			{Name: "A", X: 1.0, Y: 2.0},
			{Name: "B", X: 3.0, Y: 4.0},
		},
		Planets: []Planet{
			{SystemID: 0, Type: PlanetTerran, Magnitude: 15},
			{SystemID: 1, Type: PlanetGasGiant, Magnitude: 28},
		},
		Hyperlanes: []Hyperlane{
			{SystemA: 0, SystemB: 1},
		},
		Wormholes: []Wormhole{
			{SystemA: 0, SystemB: 1},
		},
	}

	encoded, err := EncodeBinary(data)
	if err != nil {
		t.Fatalf("Encode: %v", err)
	}

	decoded, err := DecodeBinary(encoded)
	if err != nil {
		t.Fatalf("Decode: %v", err)
	}

	if len(decoded.Systems) != 2 {
		t.Errorf("Systems: got %d, want 2", len(decoded.Systems))
	}
	if decoded.Systems[0].X != 1.0 || decoded.Systems[0].Y != 2.0 {
		t.Errorf("System 0 position: got (%f, %f), want (1.0, 2.0)", decoded.Systems[0].X, decoded.Systems[0].Y)
	}
	if len(decoded.Planets) != 2 {
		t.Errorf("Planets: got %d, want 2", len(decoded.Planets))
	}
	if decoded.Planets[0].Type != PlanetTerran {
		t.Errorf("Planet 0 type: got %d, want %d", decoded.Planets[0].Type, PlanetTerran)
	}
	if decoded.Planets[1].Magnitude != 28 {
		t.Errorf("Planet 1 magnitude: got %d, want 28", decoded.Planets[1].Magnitude)
	}
}

func TestValidateConnectivity(t *testing.T) {
	// Test with disconnected systems
	data := &MapData{
		Systems: []System{
			{X: 0, Y: 0},
			{X: 1, Y: 0},
			{X: 100, Y: 100}, // disconnected
		},
		Planets: []Planet{
			{SystemID: 0, Type: 0, Magnitude: 5},
			{SystemID: 0, Type: 1, Magnitude: 10},
			{SystemID: 1, Type: 2, Magnitude: 15},
			{SystemID: 1, Type: 3, Magnitude: 20},
			{SystemID: 2, Type: 4, Magnitude: 25},
			{SystemID: 2, Type: 5, Magnitude: 30},
		},
		Hyperlanes: []Hyperlane{
			{SystemA: 0, SystemB: 1}, // only connects 0-1, not 2
		},
	}

	err := ValidateMap(data)
	if err == nil {
		t.Error("Expected validation error for disconnected systems")
	}
}
