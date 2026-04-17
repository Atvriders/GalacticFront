package main

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// Manifest holds metadata for a generated map.
type Manifest struct {
	MapName        string         `json:"map_name"`
	SystemCount    int            `json:"system_count"`
	PlanetCount    int            `json:"planet_count"`
	HyperlaneCount int            `json:"hyperlane_count"`
	WormholeCount  int            `json:"wormhole_count"`
	MapWidth       float64        `json:"map_width"`
	MapHeight      float64        `json:"map_height"`
	NationSpawns   []NationSpawn  `json:"nation_spawns"`
}

// NationSpawn records a faction's spawn coordinates.
type NationSpawn struct {
	Name     string  `json:"name"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	SystemID int     `json:"system_id"`
}

// WriteManifest writes meta.json for a map.
func WriteManifest(dir string, mapName string, data *MapData, nations []Nation) error {
	// Compute map dimensions
	if len(data.Systems) == 0 {
		return nil
	}
	minX, maxX := float64(data.Systems[0].X), float64(data.Systems[0].X)
	minY, maxY := float64(data.Systems[0].Y), float64(data.Systems[0].Y)
	for _, s := range data.Systems[1:] {
		x, y := float64(s.X), float64(s.Y)
		if x < minX { minX = x }
		if x > maxX { maxX = x }
		if y < minY { minY = y }
		if y > maxY { maxY = y }
	}

	spawns := make([]NationSpawn, len(nations))
	for i, n := range nations {
		spawns[i] = NationSpawn{
			Name:     n.Name,
			X:        float64(n.SpawnX),
			Y:        float64(n.SpawnY),
			SystemID: int(n.SystemID),
		}
	}

	manifest := Manifest{
		MapName:        mapName,
		SystemCount:    len(data.Systems),
		PlanetCount:    len(data.Planets),
		HyperlaneCount: len(data.Hyperlanes),
		WormholeCount:  len(data.Wormholes),
		MapWidth:       maxX - minX,
		MapHeight:      maxY - minY,
		NationSpawns:   spawns,
	}

	out, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(filepath.Join(dir, "meta.json"), out, 0644)
}
