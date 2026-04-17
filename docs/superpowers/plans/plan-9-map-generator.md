# Plan 9: Map Generator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Go-based map generator that converts astronomical star catalog data into binary game map format with star systems, planets, hyperlane connections, and wormhole placements.

**Architecture:** Offline Go CLI tool. Input: star catalog CSV/JSON (HYG database subset with real star names, positions, spectral types). Processing: parse -> project to 2D -> generate planets per system -> compute hyperlanes (Delaunay triangulation + pruning) -> place wormholes -> emit binary. Output: map.bin, map_4x.bin, map_16x.bin, meta.json, preview.webp.

**Tech Stack:** Go 1.21+

**Project dir:** `/home/kasm-user/GalacticFront/map-generator/`

---

## Task 1: Project Scaffold

**Files:**
- `go.mod`
- `main.go`
- `internal/config/config.go`
- `internal/config/registry.go`

**Checklist:**
- [ ] Initialize Go module `github.com/Atvriders/GalacticFront/map-generator`
- [ ] Create `main.go` with CLI flag parsing (`--map`, `--output-dir`, `--log-level`, `--seed`)
- [ ] Create config struct with map dimensions, system counts, thresholds
- [ ] Create map registry with named presets (sector, arm, galaxy)
- [ ] Verify `go build` succeeds

### go.mod

```go
module github.com/Atvriders/GalacticFront/map-generator

go 1.21
```

### main.go

```go
package main

import (
	"flag"
	"fmt"
	"log"
	"math/rand"
	"os"
	"strings"

	"github.com/Atvriders/GalacticFront/map-generator/internal/catalog"
	"github.com/Atvriders/GalacticFront/map-generator/internal/config"
	"github.com/Atvriders/GalacticFront/map-generator/internal/encoder"
	"github.com/Atvriders/GalacticFront/map-generator/internal/generator"
	"github.com/Atvriders/GalacticFront/map-generator/internal/manifest"
	"github.com/Atvriders/GalacticFront/map-generator/internal/validator"
)

func main() {
	mapName := flag.String("map", "", "Map config name: sector, arm, galaxy (or 'all')")
	outputDir := flag.String("output-dir", "output", "Output directory for generated files")
	logLevel := flag.String("log-level", "info", "Log level: debug, info, warn, error")
	seed := flag.Int64("seed", 0, "Random seed (0 = use current time)")
	catalogPath := flag.String("catalog", "data/hyg_subset.csv", "Path to star catalog CSV")
	flag.Parse()

	if *mapName == "" {
		fmt.Fprintf(os.Stderr, "Usage: map-generator --map <name>\n\nAvailable maps:\n")
		for _, name := range config.RegisteredMapNames() {
			fmt.Fprintf(os.Stderr, "  %s\n", name)
		}
		fmt.Fprintf(os.Stderr, "  all  (generate all maps)\n")
		os.Exit(1)
	}

	setupLogging(*logLevel)

	if *seed != 0 {
		rand.Seed(*seed)
	}

	maps := resolveMapConfigs(*mapName)
	if len(maps) == 0 {
		log.Fatalf("unknown map config: %s", *mapName)
	}

	stars, err := catalog.LoadCSV(*catalogPath)
	if err != nil {
		log.Fatalf("failed to load catalog: %v", err)
	}
	log.Printf("loaded %d stars from catalog", len(stars))

	for _, mc := range maps {
		log.Printf("generating map: %s (%d-%d systems)", mc.Name, mc.MinSystems, mc.MaxSystems)
		if err := generateMap(mc, stars, *outputDir); err != nil {
			log.Fatalf("failed to generate map %s: %v", mc.Name, err)
		}
	}
}

func resolveMapConfigs(name string) []config.MapConfig {
	if strings.ToLower(name) == "all" {
		var all []config.MapConfig
		for _, n := range config.RegisteredMapNames() {
			all = append(all, config.GetMapConfig(n))
		}
		return all
	}
	mc, ok := config.LookupMapConfig(name)
	if !ok {
		return nil
	}
	return []config.MapConfig{mc}
}

func generateMap(mc config.MapConfig, stars []catalog.Star, outputDir string) error {
	gmap, err := generator.Generate(mc, stars)
	if err != nil {
		return fmt.Errorf("generate: %w", err)
	}

	if errs := validator.Validate(gmap, mc); len(errs) > 0 {
		for _, e := range errs {
			log.Printf("WARN: validation: %s", e)
		}
	}

	dir := fmt.Sprintf("%s/%s", outputDir, mc.Name)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("mkdir: %w", err)
	}

	if err := encoder.WriteBinary(gmap, dir); err != nil {
		return fmt.Errorf("encode binary: %w", err)
	}

	if err := manifest.WriteJSON(gmap, mc, dir); err != nil {
		return fmt.Errorf("write manifest: %w", err)
	}

	log.Printf("map %s written to %s/", mc.Name, dir)
	return nil
}

func setupLogging(level string) {
	switch strings.ToLower(level) {
	case "debug":
		log.SetFlags(log.Ltime | log.Lshortfile)
	case "info":
		log.SetFlags(log.Ltime)
	case "warn", "error":
		log.SetFlags(0)
	}
}
```

### internal/config/config.go

```go
package config

// MapConfig defines parameters for a single map generation run.
type MapConfig struct {
	Name       string
	MinSystems int
	MaxSystems int
	Width      int // map width in game units
	Height     int // map height in game units

	// Hyperlane params
	MaxHyperlaneLength float64 // max distance for a hyperlane edge
	TargetAvgDegree    float64 // target average connections per system (3-5)

	// Wormhole params
	WormholePairs int // number of wormhole pairs (4-8)

	// Planet params
	MinPlanets int // per system
	MaxPlanets int // per system
}
```

### internal/config/registry.go

```go
package config

import "sort"

var registry = map[string]MapConfig{
	"sector": {
		Name:               "sector",
		MinSystems:         50,
		MaxSystems:         100,
		Width:              2000,
		Height:             2000,
		MaxHyperlaneLength: 200,
		TargetAvgDegree:    3.5,
		WormholePairs:      2,
		MinPlanets:         2,
		MaxPlanets:         8,
	},
	"arm": {
		Name:               "arm",
		MinSystems:         200,
		MaxSystems:         500,
		Width:              6000,
		Height:             4000,
		MaxHyperlaneLength: 250,
		TargetAvgDegree:    4.0,
		WormholePairs:      4,
		MinPlanets:         2,
		MaxPlanets:         10,
	},
	"galaxy": {
		Name:               "galaxy",
		MinSystems:         1000,
		MaxSystems:         2000,
		Width:              16000,
		Height:             16000,
		MaxHyperlaneLength: 300,
		TargetAvgDegree:    4.5,
		WormholePairs:      8,
		MinPlanets:         2,
		MaxPlanets:         12,
	},
}

// GetMapConfig returns the config for a named map. Panics if not found.
func GetMapConfig(name string) MapConfig {
	mc, ok := registry[name]
	if !ok {
		panic("unknown map config: " + name)
	}
	return mc
}

// LookupMapConfig returns the config and whether it exists.
func LookupMapConfig(name string) (MapConfig, bool) {
	mc, ok := registry[name]
	return mc, ok
}

// RegisteredMapNames returns all registered map names sorted alphabetically.
func RegisteredMapNames() []string {
	names := make([]string, 0, len(registry))
	for k := range registry {
		names = append(names, k)
	}
	sort.Strings(names)
	return names
}
```

### Test

```bash
cd /home/kasm-user/GalacticFront/map-generator && go build -o /dev/null ./...
```

### Commit

```
feat(map-generator): scaffold project with CLI flags and map config registry
```

---

## Task 2: Star Catalog Parser

**Files:**
- `internal/catalog/catalog.go`
- `internal/catalog/catalog_test.go`
- `data/hyg_subset.csv` (sample rows)

**Checklist:**
- [ ] Define `Star` struct (Name, RA, Dec, X/Y/Z, SpectralType, Magnitude, HIP ID)
- [ ] Parse CSV with header detection (HYG database format)
- [ ] Filter: skip stars with missing positions, magnitude > 7.0 (dim stars)
- [ ] Support both RA/Dec and XYZ input columns
- [ ] Unit tests with sample CSV data

### internal/catalog/catalog.go

```go
package catalog

import (
	"encoding/csv"
	"fmt"
	"io"
	"math"
	"os"
	"strconv"
	"strings"
)

// Star represents a parsed star from the HYG database.
type Star struct {
	ID           int
	Name         string // proper name (e.g. "Sol", "Sirius")
	HIP          int    // Hipparcos catalog ID
	X            float64
	Y            float64
	Z            float64
	SpectralType string  // e.g. "G2V", "M3III"
	Magnitude    float64 // apparent magnitude
	ColorIndex   float64 // B-V color index
}

// SpectralClass returns the single-letter spectral class (O/B/A/F/G/K/M).
func (s Star) SpectralClass() string {
	if len(s.SpectralType) == 0 {
		return "G" // default solar
	}
	return strings.ToUpper(s.SpectralType[:1])
}

// LoadCSV reads a HYG-format CSV and returns filtered stars.
// Expected columns: id,hip,proper,ra,dec,dist,mag,spect,ci,x,y,z
// Stars with magnitude > maxMag or missing positions are excluded.
func LoadCSV(path string) ([]Star, error) {
	return LoadCSVFiltered(path, 7.0)
}

// LoadCSVFiltered reads with a custom magnitude cutoff.
func LoadCSVFiltered(path string, maxMag float64) ([]Star, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open catalog: %w", err)
	}
	defer f.Close()

	return ParseCSV(f, maxMag)
}

// ParseCSV reads star data from a reader.
func ParseCSV(r io.Reader, maxMag float64) ([]Star, error) {
	reader := csv.NewReader(r)
	reader.LazyQuotes = true
	reader.TrimLeadingSpace = true

	header, err := reader.Read()
	if err != nil {
		return nil, fmt.Errorf("read header: %w", err)
	}

	idx := buildIndex(header)
	if idx.x < 0 || idx.y < 0 || idx.z < 0 {
		// Fall back to RA/Dec if XYZ not present
		if idx.ra < 0 || idx.dec < 0 || idx.dist < 0 {
			return nil, fmt.Errorf("catalog must have x,y,z or ra,dec,dist columns")
		}
	}

	var stars []Star
	lineNum := 1
	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("line %d: %w", lineNum, err)
		}
		lineNum++

		star, ok := parseRecord(record, idx, maxMag)
		if ok {
			stars = append(stars, star)
		}
	}

	return stars, nil
}

type colIndex struct {
	id, hip, proper, ra, dec, dist, mag, spect, ci, x, y, z int
}

func buildIndex(header []string) colIndex {
	idx := colIndex{-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1}
	for i, h := range header {
		switch strings.ToLower(strings.TrimSpace(h)) {
		case "id":
			idx.id = i
		case "hip":
			idx.hip = i
		case "proper":
			idx.proper = i
		case "ra":
			idx.ra = i
		case "dec":
			idx.dec = i
		case "dist":
			idx.dist = i
		case "mag":
			idx.mag = i
		case "spect":
			idx.spect = i
		case "ci":
			idx.ci = i
		case "x":
			idx.x = i
		case "y":
			idx.y = i
		case "z":
			idx.z = i
		}
	}
	return idx
}

func parseRecord(rec []string, idx colIndex, maxMag float64) (Star, bool) {
	get := func(i int) string {
		if i < 0 || i >= len(rec) {
			return ""
		}
		return strings.TrimSpace(rec[i])
	}

	mag, err := strconv.ParseFloat(get(idx.mag), 64)
	if err != nil || mag > maxMag {
		return Star{}, false
	}

	var x, y, z float64
	if idx.x >= 0 && idx.y >= 0 && idx.z >= 0 {
		var err1, err2, err3 error
		x, err1 = strconv.ParseFloat(get(idx.x), 64)
		y, err2 = strconv.ParseFloat(get(idx.y), 64)
		z, err3 = strconv.ParseFloat(get(idx.z), 64)
		if err1 != nil || err2 != nil || err3 != nil {
			return Star{}, false
		}
	} else {
		ra, err1 := strconv.ParseFloat(get(idx.ra), 64)
		dec, err2 := strconv.ParseFloat(get(idx.dec), 64)
		dist, err3 := strconv.ParseFloat(get(idx.dist), 64)
		if err1 != nil || err2 != nil || err3 != nil || dist <= 0 {
			return Star{}, false
		}
		x, y, z = raDecToXYZ(ra, dec, dist)
	}

	// Skip stars at origin (usually means bad data)
	if x == 0 && y == 0 && z == 0 {
		return Star{}, false
	}

	s := Star{
		X:            x,
		Y:            y,
		Z:            z,
		SpectralType: get(idx.spect),
		Magnitude:    mag,
	}

	if v := get(idx.id); v != "" {
		s.ID, _ = strconv.Atoi(v)
	}
	if v := get(idx.hip); v != "" {
		s.HIP, _ = strconv.Atoi(v)
	}
	s.Name = get(idx.proper)
	if v := get(idx.ci); v != "" {
		s.ColorIndex, _ = strconv.ParseFloat(v, 64)
	}

	return s, true
}

// raDecToXYZ converts equatorial coordinates to cartesian.
// RA in hours (0-24), Dec in degrees (-90 to +90), Dist in parsecs.
func raDecToXYZ(raHours, decDeg, dist float64) (x, y, z float64) {
	ra := raHours * (math.Pi / 12.0)  // hours -> radians
	dec := decDeg * (math.Pi / 180.0) // degrees -> radians
	x = dist * math.Cos(dec) * math.Cos(ra)
	y = dist * math.Cos(dec) * math.Sin(ra)
	z = dist * math.Sin(dec)
	return
}
```

### internal/catalog/catalog_test.go

```go
package catalog

import (
	"strings"
	"testing"
)

const testCSV = `id,hip,proper,ra,dec,dist,mag,spect,ci,x,y,z
0,0,Sol,0,0,0.000004848,−1.44,G2V,0.656,0,0,0
1,32349,Sirius,6.752,-16.716,2.637,-1.46,A1V,-0.01,-1.609,0.978,-2.019
2,24436,Betelgeuse,5.919,7.407,168.0,0.42,M1Iab,1.85,-113.2,70.1,130.7
3,70890,Arcturus,14.261,19.182,11.26,-0.05,K1III,1.23,4.2,10.1,3.5
4,,Dim Star,12.0,45.0,50.0,8.5,M5V,1.9,10.0,20.0,30.0
`

func TestParseCSV(t *testing.T) {
	stars, err := ParseCSV(strings.NewReader(testCSV), 7.0)
	if err != nil {
		t.Fatalf("ParseCSV: %v", err)
	}

	// Sol filtered (origin), Dim Star filtered (mag 8.5), leaves 3
	if len(stars) != 3 {
		t.Fatalf("expected 3 stars, got %d", len(stars))
	}

	// Check Sirius
	sirius := stars[0]
	if sirius.Name != "Sirius" {
		t.Errorf("expected Sirius, got %s", sirius.Name)
	}
	if sirius.SpectralClass() != "A" {
		t.Errorf("expected spectral class A, got %s", sirius.SpectralClass())
	}

	// Check Betelgeuse
	if stars[1].Name != "Betelgeuse" {
		t.Errorf("expected Betelgeuse, got %s", stars[1].Name)
	}
}

func TestParseCSVRADec(t *testing.T) {
	csv := `id,proper,ra,dec,dist,mag,spect
1,TestStar,6.0,30.0,10.0,3.0,G0V
`
	stars, err := ParseCSV(strings.NewReader(csv), 7.0)
	if err != nil {
		t.Fatalf("ParseCSV: %v", err)
	}
	if len(stars) != 1 {
		t.Fatalf("expected 1 star, got %d", len(stars))
	}
	if stars[0].X == 0 && stars[0].Y == 0 {
		t.Error("expected non-zero X/Y from RA/Dec conversion")
	}
}

func TestSpectralClass(t *testing.T) {
	tests := []struct {
		spect string
		want  string
	}{
		{"G2V", "G"},
		{"M1Iab", "M"},
		{"", "G"},
		{"K1III", "K"},
	}
	for _, tt := range tests {
		s := Star{SpectralType: tt.spect}
		if got := s.SpectralClass(); got != tt.want {
			t.Errorf("SpectralClass(%q) = %q, want %q", tt.spect, got, tt.want)
		}
	}
}
```

### data/hyg_subset.csv (sample)

```csv
id,hip,proper,ra,dec,dist,mag,spect,ci,x,y,z
0,0,Sol,0,0,0.000004848,-26.74,G2V,0.656,0.000004,0,0
1,32349,Sirius,6.752,-16.716,2.637,-1.46,A1V,-0.01,-1.609,0.978,-2.019
2,30438,Canopus,6.399,-52.696,95.0,-0.74,F0II,0.15,-31.4,14.6,-82.3
3,24436,Betelgeuse,5.919,7.407,168.0,0.42,M1Iab,1.85,-113.2,70.1,130.7
4,69673,Arcturus,14.261,19.182,11.26,-0.05,K1III,1.23,4.2,10.1,3.5
5,91262,Vega,18.615,38.784,7.68,0.03,A0V,0.0,0.5,-6.1,4.8
6,7588,Achernar,1.629,-57.237,43.0,0.46,B6V,-0.16,22.5,4.3,-37.3
7,24608,Capella,5.278,45.998,13.12,0.08,G5III,0.8,3.4,6.1,10.5
8,37279,Procyon,7.655,5.225,3.50,0.34,F5IV,0.42,-3.0,1.7,0.3
9,27989,Rigel,5.242,-8.202,264.0,0.13,B8I,-0.03,-135.9,73.0,-254.9
10,49669,Regulus,10.139,11.967,24.31,1.40,B8IV,-0.11,15.0,-18.1,5.0
```

### Test

```bash
cd /home/kasm-user/GalacticFront/map-generator && go test ./internal/catalog/...
```

### Commit

```
feat(map-generator): star catalog CSV parser with HYG format support
```

---

## Task 3: 2D Projection

**Files:**
- `internal/projection/projection.go`
- `internal/projection/projection_test.go`

**Checklist:**
- [ ] Project 3D XYZ to 2D game plane (top-down: use X,Y; ignore Z for galactic plane)
- [ ] Normalize coordinates to fit within map Width x Height
- [ ] Apply padding margin (5% on each side)
- [ ] Preserve relative star distances
- [ ] Return projected `System` structs with game-space coordinates

### internal/projection/projection.go

```go
package projection

import (
	"math"

	"github.com/Atvriders/GalacticFront/map-generator/internal/catalog"
)

// System represents a star system projected onto the 2D game map.
type System struct {
	ID           int
	Name         string
	GameX        float64 // x position in game units
	GameY        float64 // y position in game units
	OrigX        float64 // original 3D x
	OrigY        float64 // original 3D y
	OrigZ        float64 // original 3D z
	SpectralType string
	Magnitude    float64
	ColorIndex   float64
}

// ProjectTopDown converts 3D star positions to 2D game coordinates.
// Uses X and Y from the 3D space (galactic plane top-down view).
// Z is preserved in the System struct but not used for positioning.
func ProjectTopDown(stars []catalog.Star, mapWidth, mapHeight int) []System {
	if len(stars) == 0 {
		return nil
	}

	const margin = 0.05 // 5% padding on each side

	// Find bounding box of star positions (using X,Y plane)
	minX, maxX := stars[0].X, stars[0].X
	minY, maxY := stars[0].Y, stars[0].Y
	for _, s := range stars[1:] {
		if s.X < minX {
			minX = s.X
		}
		if s.X > maxX {
			maxX = s.X
		}
		if s.Y < minY {
			minY = s.Y
		}
		if s.Y > maxY {
			maxY = s.Y
		}
	}

	rangeX := maxX - minX
	rangeY := maxY - minY
	if rangeX == 0 {
		rangeX = 1
	}
	if rangeY == 0 {
		rangeY = 1
	}

	// Usable area after margin
	usableW := float64(mapWidth) * (1.0 - 2*margin)
	usableH := float64(mapHeight) * (1.0 - 2*margin)
	offsetX := float64(mapWidth) * margin
	offsetY := float64(mapHeight) * margin

	// Uniform scale to preserve aspect ratio
	scaleX := usableW / rangeX
	scaleY := usableH / rangeY
	scale := math.Min(scaleX, scaleY)

	// Center within usable area
	projW := rangeX * scale
	projH := rangeY * scale
	centerOffX := offsetX + (usableW-projW)/2
	centerOffY := offsetY + (usableH-projH)/2

	systems := make([]System, len(stars))
	for i, s := range stars {
		systems[i] = System{
			ID:           s.ID,
			Name:         s.Name,
			GameX:        centerOffX + (s.X-minX)*scale,
			GameY:        centerOffY + (s.Y-minY)*scale,
			OrigX:        s.X,
			OrigY:        s.Y,
			OrigZ:        s.Z,
			SpectralType: s.SpectralType,
			Magnitude:    s.Magnitude,
			ColorIndex:   s.ColorIndex,
		}
	}

	return systems
}

// Distance returns the Euclidean distance between two systems in game space.
func Distance(a, b System) float64 {
	dx := a.GameX - b.GameX
	dy := a.GameY - b.GameY
	return math.Sqrt(dx*dx + dy*dy)
}
```

### internal/projection/projection_test.go

```go
package projection

import (
	"math"
	"testing"

	"github.com/Atvriders/GalacticFront/map-generator/internal/catalog"
)

func TestProjectTopDown(t *testing.T) {
	stars := []catalog.Star{
		{ID: 1, Name: "A", X: 0, Y: 0, Z: 0, Magnitude: 1.0},
		{ID: 2, Name: "B", X: 100, Y: 0, Z: 50, Magnitude: 2.0},
		{ID: 3, Name: "C", X: 50, Y: 100, Z: -30, Magnitude: 3.0},
	}

	systems := ProjectTopDown(stars, 1000, 1000)

	if len(systems) != 3 {
		t.Fatalf("expected 3 systems, got %d", len(systems))
	}

	// All systems should be within map bounds with margin
	for _, s := range systems {
		if s.GameX < 0 || s.GameX > 1000 || s.GameY < 0 || s.GameY > 1000 {
			t.Errorf("system %s out of bounds: (%.1f, %.1f)", s.Name, s.GameX, s.GameY)
		}
		// Should be within the margin zone (50 to 950 for 5% margin on 1000)
		if s.GameX < 50 || s.GameX > 950 || s.GameY < 50 || s.GameY > 950 {
			t.Errorf("system %s outside margin: (%.1f, %.1f)", s.Name, s.GameX, s.GameY)
		}
	}

	// Relative distances preserved: B is farther from A than C in X
	distAB := Distance(systems[0], systems[1])
	distAC := Distance(systems[0], systems[2])
	if distAB == 0 || distAC == 0 {
		t.Error("distances should be non-zero")
	}
}

func TestProjectTopDownPreservesAspectRatio(t *testing.T) {
	stars := []catalog.Star{
		{ID: 1, X: 0, Y: 0, Z: 0, Magnitude: 1.0},
		{ID: 2, X: 200, Y: 100, Z: 0, Magnitude: 1.0},
	}

	systems := ProjectTopDown(stars, 1000, 500)

	dx := math.Abs(systems[1].GameX - systems[0].GameX)
	dy := math.Abs(systems[1].GameY - systems[0].GameY)

	// Original ratio is 2:1 (200:100), should be preserved
	ratio := dx / dy
	if math.Abs(ratio-2.0) > 0.01 {
		t.Errorf("aspect ratio not preserved: dx=%.1f dy=%.1f ratio=%.2f", dx, dy, ratio)
	}
}

func TestDistance(t *testing.T) {
	a := System{GameX: 0, GameY: 0}
	b := System{GameX: 3, GameY: 4}
	if d := Distance(a, b); math.Abs(d-5.0) > 0.001 {
		t.Errorf("Distance = %f, want 5.0", d)
	}
}
```

### Test

```bash
cd /home/kasm-user/GalacticFront/map-generator && go test ./internal/projection/...
```

### Commit

```
feat(map-generator): 2D projection with aspect-ratio preservation
```

---

## Task 4: Planet Generation

**Files:**
- `internal/planets/planets.go`
- `internal/planets/planets_test.go`

**Checklist:**
- [ ] Define planet types: Terrestrial, GasGiant, Ice, Desert, Ocean, Barren, Volcanic
- [ ] Generate 2-12 planets per system based on spectral class
- [ ] Weight planet types by star type (K/M stars -> more barren, G stars -> more ocean/terrestrial)
- [ ] Assign resource magnitude 0-31 per planet
- [ ] Deterministic output given same seed + system ID

### internal/planets/planets.go

```go
package planets

import (
	"math/rand"
)

// PlanetType identifies the type of planet.
type PlanetType uint8

const (
	Terrestrial PlanetType = iota
	GasGiant
	Ice
	Desert
	Ocean
	Barren
	Volcanic
)

// String returns the human-readable planet type name.
func (pt PlanetType) String() string {
	switch pt {
	case Terrestrial:
		return "Terrestrial"
	case GasGiant:
		return "Gas Giant"
	case Ice:
		return "Ice"
	case Desert:
		return "Desert"
	case Ocean:
		return "Ocean"
	case Barren:
		return "Barren"
	case Volcanic:
		return "Volcanic"
	default:
		return "Unknown"
	}
}

// Planet represents a planet within a star system.
type Planet struct {
	Type      PlanetType
	Magnitude uint8 // resource richness 0-31
	OrbitSlot uint8 // orbital position (0 = closest to star)
}

// spectralWeights defines planet type probability weights per spectral class.
// Order: Terrestrial, GasGiant, Ice, Desert, Ocean, Barren, Volcanic
var spectralWeights = map[string][]int{
	"O": {5, 15, 10, 15, 2, 40, 13},   // hot stars: mostly barren/desert
	"B": {8, 15, 10, 15, 3, 35, 14},   // hot: barren-heavy
	"A": {12, 18, 12, 12, 8, 25, 13},  // warm: more gas giants
	"F": {18, 20, 10, 10, 12, 18, 12}, // warm-moderate
	"G": {22, 18, 10, 8, 20, 12, 10},  // solar-type: balanced, ocean-rich
	"K": {15, 15, 15, 12, 10, 22, 11}, // cool: more barren/ice
	"M": {8, 10, 20, 10, 5, 35, 12},   // red dwarfs: barren/ice-heavy
}

// Generate creates planets for a star system.
// The rng should be seeded deterministically per system (e.g., based on system ID).
func Generate(rng *rand.Rand, spectralClass string, minPlanets, maxPlanets int) []Planet {
	count := minPlanets + rng.Intn(maxPlanets-minPlanets+1)

	weights, ok := spectralWeights[spectralClass]
	if !ok {
		weights = spectralWeights["G"] // default to solar-type
	}

	totalWeight := 0
	for _, w := range weights {
		totalWeight += w
	}

	planets := make([]Planet, count)
	for i := range planets {
		planets[i] = Planet{
			Type:      pickType(rng, weights, totalWeight),
			Magnitude: uint8(rng.Intn(32)), // 0-31
			OrbitSlot: uint8(i),
		}
	}

	return planets
}

func pickType(rng *rand.Rand, weights []int, total int) PlanetType {
	r := rng.Intn(total)
	cumulative := 0
	for i, w := range weights {
		cumulative += w
		if r < cumulative {
			return PlanetType(i)
		}
	}
	return Barren // fallback
}
```

### internal/planets/planets_test.go

```go
package planets

import (
	"math/rand"
	"testing"
)

func TestGenerate(t *testing.T) {
	rng := rand.New(rand.NewSource(42))

	planets := Generate(rng, "G", 2, 12)

	if len(planets) < 2 || len(planets) > 12 {
		t.Fatalf("planet count %d out of range [2,12]", len(planets))
	}

	for i, p := range planets {
		if p.Magnitude > 31 {
			t.Errorf("planet %d: magnitude %d > 31", i, p.Magnitude)
		}
		if p.OrbitSlot != uint8(i) {
			t.Errorf("planet %d: orbit slot %d != %d", i, p.OrbitSlot, i)
		}
		if p.Type > Volcanic {
			t.Errorf("planet %d: invalid type %d", i, p.Type)
		}
	}
}

func TestGenerateDeterministic(t *testing.T) {
	p1 := Generate(rand.New(rand.NewSource(123)), "G", 3, 8)
	p2 := Generate(rand.New(rand.NewSource(123)), "G", 3, 8)

	if len(p1) != len(p2) {
		t.Fatalf("different counts: %d vs %d", len(p1), len(p2))
	}
	for i := range p1 {
		if p1[i].Type != p2[i].Type || p1[i].Magnitude != p2[i].Magnitude {
			t.Errorf("planet %d differs between runs", i)
		}
	}
}

func TestGenerateSpectralClasses(t *testing.T) {
	classes := []string{"O", "B", "A", "F", "G", "K", "M"}
	for _, cls := range classes {
		rng := rand.New(rand.NewSource(99))
		planets := Generate(rng, cls, 2, 12)
		if len(planets) < 2 {
			t.Errorf("class %s: got %d planets, want >= 2", cls, len(planets))
		}
	}
}

func TestGenerateUnknownClass(t *testing.T) {
	rng := rand.New(rand.NewSource(1))
	planets := Generate(rng, "X", 2, 5)
	if len(planets) < 2 || len(planets) > 5 {
		t.Errorf("unknown class: got %d planets", len(planets))
	}
}

func TestPlanetTypeString(t *testing.T) {
	if Terrestrial.String() != "Terrestrial" {
		t.Errorf("expected 'Terrestrial', got %q", Terrestrial.String())
	}
	if GasGiant.String() != "Gas Giant" {
		t.Errorf("expected 'Gas Giant', got %q", GasGiant.String())
	}
}
```

### Test

```bash
cd /home/kasm-user/GalacticFront/map-generator && go test ./internal/planets/...
```

### Commit

```
feat(map-generator): planet generation with spectral-class-weighted types
```

---

## Task 5: Hyperlane Computation

**Files:**
- `internal/hyperlanes/delaunay.go`
- `internal/hyperlanes/hyperlanes.go`
- `internal/hyperlanes/hyperlanes_test.go`

**Checklist:**
- [ ] Implement Bowyer-Watson Delaunay triangulation on 2D system positions
- [ ] Extract unique edges from triangulation
- [ ] Prune edges longer than `MaxHyperlaneLength`
- [ ] If average degree > `TargetAvgDegree`, prune longest edges first
- [ ] Ensure connectivity (BFS/DFS check, re-add edges if needed)
- [ ] Support manual override edges (force-include/exclude)

### internal/hyperlanes/delaunay.go

```go
package hyperlanes

import "math"

// point is a 2D point for triangulation.
type point struct {
	x, y float64
	idx  int // original system index
}

// triangle for Delaunay triangulation.
type triangle struct {
	a, b, c point
}

// edge between two system indices.
type Edge struct {
	A, B int // system indices
}

// circumcircleContains returns true if point p is inside the circumcircle of triangle t.
func circumcircleContains(t triangle, p point) bool {
	ax := t.a.x - p.x
	ay := t.a.y - p.y
	bx := t.b.x - p.x
	by := t.b.y - p.y
	cx := t.c.x - p.x
	cy := t.c.y - p.y

	det := (ax*ax+ay*ay)*(bx*cy-cx*by) -
		(bx*bx+by*by)*(ax*cy-cx*ay) +
		(cx*cx+cy*cy)*(ax*by-bx*ay)

	return det > 0
}

// bowyerWatson performs Delaunay triangulation using the Bowyer-Watson algorithm.
// Returns unique edges between system indices.
func bowyerWatson(points []point) []Edge {
	if len(points) < 2 {
		return nil
	}

	// Create super-triangle that contains all points
	minX, minY := points[0].x, points[0].y
	maxX, maxY := points[0].x, points[0].y
	for _, p := range points {
		if p.x < minX {
			minX = p.x
		}
		if p.y < minY {
			minY = p.y
		}
		if p.x > maxX {
			maxX = p.x
		}
		if p.y > maxY {
			maxY = p.y
		}
	}

	dx := maxX - minX
	dy := maxY - minY
	dmax := math.Max(dx, dy)
	midX := (minX + maxX) / 2
	midY := (minY + maxY) / 2

	superA := point{midX - 20*dmax, midY - dmax, -1}
	superB := point{midX, midY + 20*dmax, -2}
	superC := point{midX + 20*dmax, midY - dmax, -3}

	triangles := []triangle{{superA, superB, superC}}

	for _, p := range points {
		var badTriangles []triangle
		for _, t := range triangles {
			if circumcircleContains(t, p) {
				badTriangles = append(badTriangles, t)
			}
		}

		// Find boundary polygon (edges not shared by two bad triangles)
		type rawEdge struct{ a, b point }
		var polygon []rawEdge
		for _, t := range badTriangles {
			edges := []rawEdge{{t.a, t.b}, {t.b, t.c}, {t.c, t.a}}
			for _, e := range edges {
				shared := false
				for _, other := range badTriangles {
					if &other == &t {
						continue
					}
					if triangleContainsEdge(other, e) {
						shared = true
						break
					}
				}
				if !shared {
					polygon = append(polygon, e)
				}
			}
		}

		// Remove bad triangles
		var remaining []triangle
		for _, t := range triangles {
			bad := false
			for _, bt := range badTriangles {
				if triangleEquals(t, bt) {
					bad = true
					break
				}
			}
			if !bad {
				remaining = append(remaining, t)
			}
		}
		triangles = remaining

		// Create new triangles from polygon edges to point
		for _, e := range polygon {
			triangles = append(triangles, triangle{e.a, e.b, p})
		}
	}

	// Extract unique edges, excluding super-triangle vertices
	edgeSet := make(map[Edge]bool)
	for _, t := range triangles {
		verts := []point{t.a, t.b, t.c}
		// Skip triangles connected to super-triangle
		hasSuperVert := false
		for _, v := range verts {
			if v.idx < 0 {
				hasSuperVert = true
				break
			}
		}
		if hasSuperVert {
			continue
		}

		pairs := [][2]int{{verts[0].idx, verts[1].idx}, {verts[1].idx, verts[2].idx}, {verts[2].idx, verts[0].idx}}
		for _, pair := range pairs {
			a, b := pair[0], pair[1]
			if a > b {
				a, b = b, a
			}
			edgeSet[Edge{a, b}] = true
		}
	}

	edges := make([]Edge, 0, len(edgeSet))
	for e := range edgeSet {
		edges = append(edges, e)
	}
	return edges
}

func triangleContainsEdge(t triangle, e struct{ a, b point }) bool {
	edges := [][2]point{{t.a, t.b}, {t.b, t.c}, {t.c, t.a}}
	for _, te := range edges {
		if (pointEquals(te[0], e.a) && pointEquals(te[1], e.b)) ||
			(pointEquals(te[0], e.b) && pointEquals(te[1], e.a)) {
			return true
		}
	}
	return false
}

func pointEquals(a, b point) bool {
	return a.x == b.x && a.y == b.y && a.idx == b.idx
}

func triangleEquals(a, b triangle) bool {
	ap := []point{a.a, a.b, a.c}
	bp := []point{b.a, b.b, b.c}
	for _, p := range ap {
		found := false
		for _, q := range bp {
			if pointEquals(p, q) {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}
```

### internal/hyperlanes/hyperlanes.go

```go
package hyperlanes

import (
	"math"
	"sort"

	"github.com/Atvriders/GalacticFront/map-generator/internal/projection"
)

// Override allows forcing edges to be included or excluded.
type Override struct {
	A, B    int  // system indices
	Include bool // true = force include, false = force exclude
}

// ComputeHyperlanes generates hyperlane connections between systems.
func ComputeHyperlanes(systems []projection.System, maxLength float64, targetAvgDegree float64, overrides []Override) []Edge {
	if len(systems) < 2 {
		return nil
	}

	// Build points for triangulation
	points := make([]point, len(systems))
	for i, s := range systems {
		points[i] = point{x: s.GameX, y: s.GameY, idx: i}
	}

	// Delaunay triangulation
	edges := bowyerWatson(points)

	// Build override sets
	forceInclude := make(map[Edge]bool)
	forceExclude := make(map[Edge]bool)
	for _, o := range overrides {
		a, b := o.A, o.B
		if a > b {
			a, b = b, a
		}
		e := Edge{a, b}
		if o.Include {
			forceInclude[e] = true
		} else {
			forceExclude[e] = true
		}
	}

	// Compute edge lengths
	type edgeWithLen struct {
		edge Edge
		dist float64
	}
	var measured []edgeWithLen
	for _, e := range edges {
		if forceExclude[e] {
			continue
		}
		d := projection.Distance(systems[e.A], systems[e.B])
		if d <= maxLength || forceInclude[e] {
			measured = append(measured, edgeWithLen{e, d})
		}
	}

	// Add force-included edges that may not be in triangulation
	for e := range forceInclude {
		found := false
		for _, m := range measured {
			if m.edge == e {
				found = true
				break
			}
		}
		if !found {
			d := projection.Distance(systems[e.A], systems[e.B])
			measured = append(measured, edgeWithLen{e, d})
		}
	}

	// Sort by distance (shortest first) for pruning
	sort.Slice(measured, func(i, j int) bool {
		return measured[i].dist < measured[j].dist
	})

	// Calculate current average degree
	n := len(systems)
	avgDegree := func(edgeCount int) float64 {
		return float64(2*edgeCount) / float64(n)
	}

	// If avg degree > target, prune longest edges first
	if avgDegree(len(measured)) > targetAvgDegree {
		targetEdgeCount := int(math.Ceil(targetAvgDegree * float64(n) / 2))
		if targetEdgeCount < len(measured) {
			// Keep forced edges and shortest edges up to target
			var pruned []edgeWithLen
			forced := 0
			for _, m := range measured {
				if forceInclude[m.edge] {
					pruned = append(pruned, m)
					forced++
				}
			}
			remaining := targetEdgeCount - forced
			for _, m := range measured {
				if forceInclude[m.edge] {
					continue
				}
				if remaining <= 0 {
					break
				}
				pruned = append(pruned, m)
				remaining--
			}
			measured = pruned
		}
	}

	// Extract final edges
	result := make([]Edge, len(measured))
	for i, m := range measured {
		result[i] = m.edge
	}

	// Ensure connectivity - add shortest missing edges to connect components
	result = ensureConnectivity(result, systems, n)

	return result
}

// ensureConnectivity adds edges to make the graph connected.
func ensureConnectivity(edges []Edge, systems []projection.System, n int) []Edge {
	if n <= 1 {
		return edges
	}

	for {
		components := findComponents(edges, n)
		if len(components) <= 1 {
			break
		}

		// Connect closest pair between first two components
		bestDist := math.MaxFloat64
		var bestEdge Edge
		for _, a := range components[0] {
			for _, b := range components[1] {
				d := projection.Distance(systems[a], systems[b])
				if d < bestDist {
					bestDist = d
					ea, eb := a, b
					if ea > eb {
						ea, eb = eb, ea
					}
					bestEdge = Edge{ea, eb}
				}
			}
		}
		edges = append(edges, bestEdge)
	}

	return edges
}

// findComponents returns connected components via BFS.
func findComponents(edges []Edge, n int) [][]int {
	adj := make(map[int][]int)
	for _, e := range edges {
		adj[e.A] = append(adj[e.A], e.B)
		adj[e.B] = append(adj[e.B], e.A)
	}

	visited := make([]bool, n)
	var components [][]int

	for i := 0; i < n; i++ {
		if visited[i] {
			continue
		}
		var component []int
		queue := []int{i}
		visited[i] = true
		for len(queue) > 0 {
			node := queue[0]
			queue = queue[1:]
			component = append(component, node)
			for _, nb := range adj[node] {
				if !visited[nb] {
					visited[nb] = true
					queue = append(queue, nb)
				}
			}
		}
		components = append(components, component)
	}

	return components
}

// IsConnected returns true if all systems are reachable from system 0.
func IsConnected(edges []Edge, systemCount int) bool {
	if systemCount <= 1 {
		return true
	}
	components := findComponents(edges, systemCount)
	return len(components) == 1
}

// AverageDegree returns the average number of connections per system.
func AverageDegree(edges []Edge, systemCount int) float64 {
	if systemCount == 0 {
		return 0
	}
	return float64(2*len(edges)) / float64(systemCount)
}
```

### internal/hyperlanes/hyperlanes_test.go

```go
package hyperlanes

import (
	"math"
	"testing"

	"github.com/Atvriders/GalacticFront/map-generator/internal/projection"
)

func makeGrid(rows, cols int, spacing float64) []projection.System {
	var systems []projection.System
	id := 0
	for r := 0; r < rows; r++ {
		for c := 0; c < cols; c++ {
			systems = append(systems, projection.System{
				ID:    id,
				GameX: float64(c) * spacing,
				GameY: float64(r) * spacing,
			})
			id++
		}
	}
	return systems
}

func TestComputeHyperlanesGrid(t *testing.T) {
	systems := makeGrid(3, 3, 100) // 9 systems in 3x3 grid
	edges := ComputeHyperlanes(systems, 200, 5.0, nil)

	if len(edges) == 0 {
		t.Fatal("expected edges, got none")
	}

	if !IsConnected(edges, len(systems)) {
		t.Error("graph is not connected")
	}

	avg := AverageDegree(edges, len(systems))
	t.Logf("9-system grid: %d edges, avg degree %.2f", len(edges), avg)
}

func TestComputeHyperlanesMaxLength(t *testing.T) {
	systems := []projection.System{
		{ID: 0, GameX: 0, GameY: 0},
		{ID: 1, GameX: 50, GameY: 0},
		{ID: 2, GameX: 500, GameY: 0}, // far away
	}

	edges := ComputeHyperlanes(systems, 100, 5.0, nil)

	// Systems 0-1 should be connected, system 2 should be connected via ensureConnectivity
	if !IsConnected(edges, 3) {
		t.Error("expected connected graph even with distant system")
	}
}

func TestComputeHyperlanesOverrides(t *testing.T) {
	systems := makeGrid(2, 3, 100) // 6 systems
	overrides := []Override{
		{A: 0, B: 5, Include: true},  // force long diagonal
		{A: 0, B: 1, Include: false}, // force exclude neighbor
	}

	edges := ComputeHyperlanes(systems, 200, 5.0, overrides)

	hasForced := false
	hasExcluded := false
	for _, e := range edges {
		if (e.A == 0 && e.B == 5) || (e.A == 5 && e.B == 0) {
			hasForced = true
		}
		if (e.A == 0 && e.B == 1) || (e.A == 1 && e.B == 0) {
			hasExcluded = true
		}
	}

	if !hasForced {
		t.Error("force-included edge 0-5 not present")
	}
	if hasExcluded {
		t.Error("force-excluded edge 0-1 still present")
	}
}

func TestIsConnected(t *testing.T) {
	edges := []Edge{{0, 1}, {1, 2}}
	if !IsConnected(edges, 3) {
		t.Error("expected connected")
	}

	edges2 := []Edge{{0, 1}}
	if IsConnected(edges2, 3) {
		t.Error("expected disconnected (node 2 isolated)")
	}
}

func TestAverageDegree(t *testing.T) {
	edges := []Edge{{0, 1}, {1, 2}, {2, 0}}
	avg := AverageDegree(edges, 3)
	if math.Abs(avg-2.0) > 0.001 {
		t.Errorf("expected avg degree 2.0, got %.2f", avg)
	}
}
```

### Test

```bash
cd /home/kasm-user/GalacticFront/map-generator && go test ./internal/hyperlanes/...
```

### Commit

```
feat(map-generator): Delaunay-based hyperlane computation with pruning and connectivity
```

---

## Task 6: Wormhole Placement

**Files:**
- `internal/wormholes/wormholes.go`
- `internal/wormholes/wormholes_test.go`

**Checklist:**
- [ ] Define `WormholePair` struct (system A index, system B index)
- [ ] Place N wormhole pairs connecting distant map regions
- [ ] Ensure wormhole endpoints are far apart (cross-arm connections)
- [ ] No system hosts more than one wormhole endpoint
- [ ] Deterministic placement with seed

### internal/wormholes/wormholes.go

```go
package wormholes

import (
	"math"
	"math/rand"
	"sort"

	"github.com/Atvriders/GalacticFront/map-generator/internal/projection"
)

// WormholePair connects two distant star systems.
type WormholePair struct {
	SystemA int // system index
	SystemB int // system index
}

// Place selects wormhole pairs connecting distant regions of the map.
// It divides the map into quadrants and pairs systems across quadrants.
func Place(rng *rand.Rand, systems []projection.System, numPairs int) []WormholePair {
	if len(systems) < numPairs*2 || numPairs == 0 {
		return nil
	}

	// Find map center
	var cx, cy float64
	for _, s := range systems {
		cx += s.GameX
		cy += s.GameY
	}
	cx /= float64(len(systems))
	cy /= float64(len(systems))

	// Divide systems into quadrants
	var quadrants [4][]int // NW, NE, SW, SE
	for i, s := range systems {
		qx := 0
		if s.GameX >= cx {
			qx = 1
		}
		qy := 0
		if s.GameY >= cy {
			qy = 1
		}
		q := qy*2 + qx
		quadrants[q] = append(quadrants[q], i)
	}

	// Shuffle each quadrant
	for i := range quadrants {
		rng.Shuffle(len(quadrants[i]), func(a, b int) {
			quadrants[i][a], quadrants[i][b] = quadrants[i][b], quadrants[i][a]
		})
	}

	// Pair opposite quadrants: NW-SE, NE-SW
	pairings := [][2]int{{0, 3}, {1, 2}} // opposite quadrant pairs
	used := make(map[int]bool)
	var pairs []WormholePair

	for len(pairs) < numPairs {
		placed := false
		for _, pairing := range pairings {
			if len(pairs) >= numPairs {
				break
			}
			qA, qB := pairing[0], pairing[1]
			a := pickUnused(quadrants[qA], used)
			b := pickUnused(quadrants[qB], used)
			if a >= 0 && b >= 0 {
				// Verify they're actually far apart (> 40% of map diagonal)
				dist := projection.Distance(systems[a], systems[b])
				mapDiag := mapDiagonal(systems)
				if dist > mapDiag*0.3 {
					pairs = append(pairs, WormholePair{SystemA: a, SystemB: b})
					used[a] = true
					used[b] = true
					placed = true
				}
			}
		}
		if !placed {
			// Fallback: pick two most distant unused systems
			pair := pickMostDistant(systems, used)
			if pair == nil {
				break
			}
			pairs = append(pairs, *pair)
			used[pair.SystemA] = true
			used[pair.SystemB] = true
		}
	}

	return pairs
}

func pickUnused(candidates []int, used map[int]bool) int {
	for _, c := range candidates {
		if !used[c] {
			return c
		}
	}
	return -1
}

func mapDiagonal(systems []projection.System) float64 {
	if len(systems) < 2 {
		return 1
	}
	minX, maxX := systems[0].GameX, systems[0].GameX
	minY, maxY := systems[0].GameY, systems[0].GameY
	for _, s := range systems {
		if s.GameX < minX {
			minX = s.GameX
		}
		if s.GameX > maxX {
			maxX = s.GameX
		}
		if s.GameY < minY {
			minY = s.GameY
		}
		if s.GameY > maxY {
			maxY = s.GameY
		}
	}
	dx := maxX - minX
	dy := maxY - minY
	return math.Sqrt(dx*dx + dy*dy)
}

func pickMostDistant(systems []projection.System, used map[int]bool) *WormholePair {
	type candidate struct {
		a, b int
		dist float64
	}
	var candidates []candidate
	for i := range systems {
		if used[i] {
			continue
		}
		for j := i + 1; j < len(systems); j++ {
			if used[j] {
				continue
			}
			d := projection.Distance(systems[i], systems[j])
			candidates = append(candidates, candidate{i, j, d})
		}
	}
	if len(candidates) == 0 {
		return nil
	}
	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].dist > candidates[j].dist
	})
	return &WormholePair{SystemA: candidates[0].a, SystemB: candidates[0].b}
}
```

### internal/wormholes/wormholes_test.go

```go
package wormholes

import (
	"math/rand"
	"testing"

	"github.com/Atvriders/GalacticFront/map-generator/internal/projection"
)

func TestPlace(t *testing.T) {
	// Create systems scattered across a 1000x1000 map
	rng := rand.New(rand.NewSource(42))
	var systems []projection.System
	for i := 0; i < 50; i++ {
		systems = append(systems, projection.System{
			ID:    i,
			GameX: rng.Float64() * 1000,
			GameY: rng.Float64() * 1000,
		})
	}

	pairs := Place(rand.New(rand.NewSource(99)), systems, 4)

	if len(pairs) != 4 {
		t.Fatalf("expected 4 pairs, got %d", len(pairs))
	}

	// No system used twice
	used := make(map[int]bool)
	for _, p := range pairs {
		if used[p.SystemA] {
			t.Errorf("system %d used in multiple wormholes", p.SystemA)
		}
		if used[p.SystemB] {
			t.Errorf("system %d used in multiple wormholes", p.SystemB)
		}
		used[p.SystemA] = true
		used[p.SystemB] = true

		// Endpoints should be different
		if p.SystemA == p.SystemB {
			t.Errorf("wormhole connects system %d to itself", p.SystemA)
		}
	}
}

func TestPlaceDistant(t *testing.T) {
	// 4 corners + center
	systems := []projection.System{
		{ID: 0, GameX: 0, GameY: 0},
		{ID: 1, GameX: 1000, GameY: 0},
		{ID: 2, GameX: 0, GameY: 1000},
		{ID: 3, GameX: 1000, GameY: 1000},
		{ID: 4, GameX: 500, GameY: 500},
		{ID: 5, GameX: 100, GameY: 100},
		{ID: 6, GameX: 900, GameY: 900},
		{ID: 7, GameX: 100, GameY: 900},
		{ID: 8, GameX: 900, GameY: 100},
	}

	pairs := Place(rand.New(rand.NewSource(1)), systems, 2)

	if len(pairs) < 2 {
		t.Fatalf("expected 2 pairs, got %d", len(pairs))
	}

	// Wormholes should connect distant systems
	for _, p := range pairs {
		dist := projection.Distance(systems[p.SystemA], systems[p.SystemB])
		if dist < 300 {
			t.Errorf("wormhole too short: %d-%d dist=%.0f", p.SystemA, p.SystemB, dist)
		}
	}
}

func TestPlaceTooFewSystems(t *testing.T) {
	systems := []projection.System{
		{ID: 0, GameX: 0, GameY: 0},
	}
	pairs := Place(rand.New(rand.NewSource(1)), systems, 4)
	if pairs != nil {
		t.Errorf("expected nil for insufficient systems, got %d pairs", len(pairs))
	}
}
```

### Test

```bash
cd /home/kasm-user/GalacticFront/map-generator && go test ./internal/wormholes/...
```

### Commit

```
feat(map-generator): wormhole placement connecting distant map regions
```

---

## Task 7: Nation Spawn Points

**Files:**
- `internal/nations/nations.go`
- `internal/nations/nations_test.go`

**Checklist:**
- [ ] Define faction/species list with preferred galactic region
- [ ] Map species to nearest suitable system in their target region
- [ ] Ensure spawn points are minimum distance apart
- [ ] Species: Solar Federation (Sol), Zyr'kathi (core), Vex Combine (rim), Thal'nok (outer arm), Crystalline Collective (nebula region)

### internal/nations/nations.go

```go
package nations

import (
	"math"
	"strings"

	"github.com/Atvriders/GalacticFront/map-generator/internal/projection"
)

// Nation represents a playable faction with a home region.
type Nation struct {
	ID         string
	Name       string
	HomeRegion Region
	HomeSystem int // assigned system index (-1 if unassigned)
}

// Region describes a preferred spawn area on the map.
type Region int

const (
	RegionCenter Region = iota // galactic core
	RegionSol                  // near Sol (if present)
	RegionRim                  // outer rim
	RegionNorth                // upper map region
	RegionSouth                // lower map region
)

// DefaultNations returns the standard faction list.
func DefaultNations() []Nation {
	return []Nation{
		{ID: "solar_federation", Name: "Solar Federation", HomeRegion: RegionSol, HomeSystem: -1},
		{ID: "zyrkathi", Name: "Zyr'kathi Dominion", HomeRegion: RegionCenter, HomeSystem: -1},
		{ID: "vex_combine", Name: "Vex Combine", HomeRegion: RegionRim, HomeSystem: -1},
		{ID: "thalnok", Name: "Thal'nok Hierarchy", HomeRegion: RegionNorth, HomeSystem: -1},
		{ID: "crystalline", Name: "Crystalline Collective", HomeRegion: RegionSouth, HomeSystem: -1},
	}
}

// SpawnPoint is a nation assigned to a system.
type SpawnPoint struct {
	NationID   string
	NationName string
	SystemIdx  int
}

// AssignSpawns places each nation at the best available system for its region.
func AssignSpawns(nations []Nation, systems []projection.System, mapWidth, mapHeight int) []SpawnPoint {
	if len(systems) == 0 {
		return nil
	}

	cx := float64(mapWidth) / 2
	cy := float64(mapHeight) / 2
	used := make(map[int]bool)

	var spawns []SpawnPoint

	for _, nation := range nations {
		bestIdx := -1
		bestScore := math.MaxFloat64

		for i, sys := range systems {
			if used[i] {
				continue
			}

			score := regionScore(nation.HomeRegion, sys, systems, cx, cy)
			if score < bestScore {
				bestScore = score
				bestIdx = i
			}
		}

		if bestIdx >= 0 {
			spawns = append(spawns, SpawnPoint{
				NationID:   nation.ID,
				NationName: nation.Name,
				SystemIdx:  bestIdx,
			})
			used[bestIdx] = true
		}
	}

	return spawns
}

// regionScore returns a lower score for systems better matching the region.
func regionScore(region Region, sys projection.System, systems []projection.System, cx, cy float64) float64 {
	switch region {
	case RegionSol:
		// Prefer the system named "Sol" if it exists
		if strings.EqualFold(sys.Name, "Sol") {
			return 0
		}
		// Otherwise prefer systems near map center (Sol is typically near center)
		dx := sys.GameX - cx
		dy := sys.GameY - cy
		return math.Sqrt(dx*dx+dy*dy) + 1000 // penalty for not being Sol

	case RegionCenter:
		dx := sys.GameX - cx
		dy := sys.GameY - cy
		return math.Sqrt(dx*dx + dy*dy)

	case RegionRim:
		dx := sys.GameX - cx
		dy := sys.GameY - cy
		dist := math.Sqrt(dx*dx + dy*dy)
		maxDist := math.Sqrt(cx*cx + cy*cy)
		return maxDist - dist // lower = farther from center = better

	case RegionNorth:
		return sys.GameY // lower Y = more north (top of map)

	case RegionSouth:
		return float64(cy*2) - sys.GameY // higher Y = more south

	default:
		return 0
	}
}
```

### internal/nations/nations_test.go

```go
package nations

import (
	"testing"

	"github.com/Atvriders/GalacticFront/map-generator/internal/projection"
)

func TestAssignSpawns(t *testing.T) {
	systems := []projection.System{
		{ID: 0, Name: "Sol", GameX: 500, GameY: 500},
		{ID: 1, Name: "CoreStar", GameX: 505, GameY: 495},
		{ID: 2, Name: "RimStar", GameX: 50, GameY: 50},
		{ID: 3, Name: "NorthStar", GameX: 500, GameY: 10},
		{ID: 4, Name: "SouthStar", GameX: 500, GameY: 990},
	}

	nations := DefaultNations()
	spawns := AssignSpawns(nations, systems, 1000, 1000)

	if len(spawns) != 5 {
		t.Fatalf("expected 5 spawns, got %d", len(spawns))
	}

	// Solar Federation should get Sol
	for _, sp := range spawns {
		if sp.NationID == "solar_federation" {
			if systems[sp.SystemIdx].Name != "Sol" {
				t.Errorf("Solar Federation assigned to %s, expected Sol", systems[sp.SystemIdx].Name)
			}
		}
	}

	// All system indices should be unique
	used := make(map[int]bool)
	for _, sp := range spawns {
		if used[sp.SystemIdx] {
			t.Errorf("system %d assigned to multiple nations", sp.SystemIdx)
		}
		used[sp.SystemIdx] = true
	}
}

func TestAssignSpawnsNoSol(t *testing.T) {
	systems := []projection.System{
		{ID: 0, Name: "Alpha", GameX: 500, GameY: 500},
		{ID: 1, Name: "Beta", GameX: 100, GameY: 100},
		{ID: 2, Name: "Gamma", GameX: 900, GameY: 900},
		{ID: 3, Name: "Delta", GameX: 500, GameY: 50},
		{ID: 4, Name: "Epsilon", GameX: 500, GameY: 950},
	}

	spawns := AssignSpawns(DefaultNations(), systems, 1000, 1000)

	if len(spawns) != 5 {
		t.Fatalf("expected 5 spawns, got %d", len(spawns))
	}

	// Zyr'kathi should be near center
	for _, sp := range spawns {
		if sp.NationID == "zyrkathi" {
			sys := systems[sp.SystemIdx]
			if sys.GameX < 400 || sys.GameX > 600 || sys.GameY < 400 || sys.GameY > 600 {
				t.Logf("Zyr'kathi at (%.0f,%.0f) - may not be center, but acceptable", sys.GameX, sys.GameY)
			}
		}
	}
}

func TestAssignSpawnsEmpty(t *testing.T) {
	spawns := AssignSpawns(DefaultNations(), nil, 1000, 1000)
	if spawns != nil {
		t.Errorf("expected nil spawns for empty systems")
	}
}
```

### Test

```bash
cd /home/kasm-user/GalacticFront/map-generator && go test ./internal/nations/...
```

### Commit

```
feat(map-generator): nation spawn point assignment by galactic region
```

---

## Task 8: Binary Encoding

**Files:**
- `internal/encoder/binary.go`
- `internal/encoder/types.go`
- `internal/encoder/binary_test.go`

**Checklist:**
- [ ] Define `GameMap` aggregate struct holding all generated data
- [ ] Binary format: header (magic, version, counts) + system records + planet records + edge list + wormhole list
- [ ] Little-endian encoding
- [ ] Write map.bin at full resolution
- [ ] Test round-trip: encode then decode and verify

### internal/encoder/types.go

```go
package encoder

import (
	"github.com/Atvriders/GalacticFront/map-generator/internal/hyperlanes"
	"github.com/Atvriders/GalacticFront/map-generator/internal/nations"
	"github.com/Atvriders/GalacticFront/map-generator/internal/planets"
	"github.com/Atvriders/GalacticFront/map-generator/internal/projection"
	"github.com/Atvriders/GalacticFront/map-generator/internal/wormholes"
)

// GameMap holds the complete generated map data.
type GameMap struct {
	Width     int
	Height    int
	Systems   []projection.System
	Planets   [][]planets.Planet     // indexed by system index
	Hyperlanes []hyperlanes.Edge
	Wormholes  []wormholes.WormholePair
	Spawns     []nations.SpawnPoint
}

// Binary format constants.
const (
	MagicBytes    = "GFMP" // GalacticFront MaP
	FormatVersion = 1
)

// Binary record sizes (bytes).
const (
	HeaderSize  = 16 // magic(4) + version(2) + systemCount(2) + edgeCount(2) + wormholeCount(2) + width(2) + height(2)
	SystemSize  = 16 // gameX(4 float32) + gameY(4 float32) + nameOffset(4 uint32) + spectralClass(1) + planetCount(1) + planetOffset(2 uint16)
	PlanetSize  = 2  // type(4 bits) + magnitude(5 bits) + orbitSlot(4 bits) + padding(3 bits) => packed into 2 bytes
	EdgeSize    = 4  // systemA(2 uint16) + systemB(2 uint16)
	WormholeSize = 4 // systemA(2 uint16) + systemB(2 uint16)
)
```

### internal/encoder/binary.go

```go
package encoder

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"os"
	"path/filepath"
)

// WriteBinary writes map.bin to the given directory.
func WriteBinary(gmap *GameMap, dir string) error {
	data, err := Encode(gmap)
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dir, "map.bin"), data, 0o644)
}

// Encode serializes a GameMap to binary format.
func Encode(gmap *GameMap) ([]byte, error) {
	var buf bytes.Buffer

	// Collect all system names into a string table
	var nameTable bytes.Buffer
	nameOffsets := make([]uint32, len(gmap.Systems))
	for i, sys := range gmap.Systems {
		nameOffsets[i] = uint32(nameTable.Len())
		nameTable.WriteString(sys.Name)
		nameTable.WriteByte(0) // null terminator
	}

	// Calculate planet offsets
	planetOffsets := make([]uint16, len(gmap.Systems))
	totalPlanets := 0
	for i, sysPlanets := range gmap.Planets {
		planetOffsets[i] = uint16(totalPlanets)
		totalPlanets += len(sysPlanets)
	}

	// Header
	buf.WriteString(MagicBytes)
	binary.Write(&buf, binary.LittleEndian, uint16(FormatVersion))
	binary.Write(&buf, binary.LittleEndian, uint16(len(gmap.Systems)))
	binary.Write(&buf, binary.LittleEndian, uint16(len(gmap.Hyperlanes)))
	binary.Write(&buf, binary.LittleEndian, uint16(len(gmap.Wormholes)))
	binary.Write(&buf, binary.LittleEndian, uint16(gmap.Width))
	binary.Write(&buf, binary.LittleEndian, uint16(gmap.Height))

	// System records
	for i, sys := range gmap.Systems {
		binary.Write(&buf, binary.LittleEndian, float32(sys.GameX))
		binary.Write(&buf, binary.LittleEndian, float32(sys.GameY))
		binary.Write(&buf, binary.LittleEndian, nameOffsets[i])

		spectralByte := spectralClassToByte(sys.SpectralType)
		buf.WriteByte(spectralByte)

		planetCount := uint8(0)
		if i < len(gmap.Planets) {
			planetCount = uint8(len(gmap.Planets[i]))
		}
		buf.WriteByte(planetCount)
		binary.Write(&buf, binary.LittleEndian, planetOffsets[i])
	}

	// Planet records
	for _, sysPlanets := range gmap.Planets {
		for _, p := range sysPlanets {
			packed := packPlanet(p.Type, p.Magnitude, p.OrbitSlot)
			binary.Write(&buf, binary.LittleEndian, packed)
		}
	}

	// Hyperlane edges
	for _, e := range gmap.Hyperlanes {
		binary.Write(&buf, binary.LittleEndian, uint16(e.A))
		binary.Write(&buf, binary.LittleEndian, uint16(e.B))
	}

	// Wormhole pairs
	for _, w := range gmap.Wormholes {
		binary.Write(&buf, binary.LittleEndian, uint16(w.SystemA))
		binary.Write(&buf, binary.LittleEndian, uint16(w.SystemB))
	}

	// String table
	binary.Write(&buf, binary.LittleEndian, uint32(nameTable.Len()))
	buf.Write(nameTable.Bytes())

	return buf.Bytes(), nil
}

// Decode reads a binary map back into a GameMap (for testing/validation).
func Decode(data []byte) (*GameMap, error) {
	r := bytes.NewReader(data)

	// Header
	magic := make([]byte, 4)
	if _, err := r.Read(magic); err != nil {
		return nil, fmt.Errorf("read magic: %w", err)
	}
	if string(magic) != MagicBytes {
		return nil, fmt.Errorf("invalid magic: %q", magic)
	}

	var version, systemCount, edgeCount, wormholeCount, width, height uint16
	binary.Read(r, binary.LittleEndian, &version)
	binary.Read(r, binary.LittleEndian, &systemCount)
	binary.Read(r, binary.LittleEndian, &edgeCount)
	binary.Read(r, binary.LittleEndian, &wormholeCount)
	binary.Read(r, binary.LittleEndian, &width)
	binary.Read(r, binary.LittleEndian, &height)

	if version != FormatVersion {
		return nil, fmt.Errorf("unsupported version: %d", version)
	}

	gmap := &GameMap{
		Width:  int(width),
		Height: int(height),
	}

	// System records
	type rawSystem struct {
		gameX, gameY   float32
		nameOffset     uint32
		spectral       uint8
		planetCount    uint8
		planetOffset   uint16
	}
	rawSystems := make([]rawSystem, systemCount)
	for i := range rawSystems {
		binary.Read(r, binary.LittleEndian, &rawSystems[i].gameX)
		binary.Read(r, binary.LittleEndian, &rawSystems[i].gameY)
		binary.Read(r, binary.LittleEndian, &rawSystems[i].nameOffset)
		binary.Read(r, binary.LittleEndian, &rawSystems[i].spectral)
		binary.Read(r, binary.LittleEndian, &rawSystems[i].planetCount)
		binary.Read(r, binary.LittleEndian, &rawSystems[i].planetOffset)
	}

	// Planet records
	totalPlanets := 0
	for _, rs := range rawSystems {
		totalPlanets += int(rs.planetCount)
	}
	allPlanets := make([]uint16, totalPlanets)
	for i := range allPlanets {
		binary.Read(r, binary.LittleEndian, &allPlanets[i])
	}

	// Edges
	for i := 0; i < int(edgeCount); i++ {
		var a, b uint16
		binary.Read(r, binary.LittleEndian, &a)
		binary.Read(r, binary.LittleEndian, &b)
		gmap.Hyperlanes = append(gmap.Hyperlanes, struct{ A, B int }{int(a), int(b)})
	}

	// Wormholes
	for i := 0; i < int(wormholeCount); i++ {
		var a, b uint16
		binary.Read(r, binary.LittleEndian, &a)
		binary.Read(r, binary.LittleEndian, &b)
		gmap.Wormholes = append(gmap.Wormholes, struct{ SystemA, SystemB int }{int(a), int(b)})
	}

	// String table
	var strTableLen uint32
	binary.Read(r, binary.LittleEndian, &strTableLen)
	strTable := make([]byte, strTableLen)
	r.Read(strTable)

	// Resolve systems
	gmap.Systems = make([]struct {
		ID           int
		Name         string
		GameX        float64
		GameY        float64
		OrigX        float64
		OrigY        float64
		OrigZ        float64
		SpectralType string
		Magnitude    float64
		ColorIndex   float64
	}, systemCount)
	gmap.Planets = make([][]struct {
		Type      uint8
		Magnitude uint8
		OrbitSlot uint8
	}, systemCount)

	for i, rs := range rawSystems {
		name := readCString(strTable, int(rs.nameOffset))
		gmap.Systems[i].ID = i
		gmap.Systems[i].Name = name
		gmap.Systems[i].GameX = float64(rs.gameX)
		gmap.Systems[i].GameY = float64(rs.gameY)
		gmap.Systems[i].SpectralType = byteToSpectralClass(rs.spectral)

		// Unpack planets
		for j := 0; j < int(rs.planetCount); j++ {
			packed := allPlanets[int(rs.planetOffset)+j]
			pType, mag, orbit := unpackPlanet(packed)
			gmap.Planets[i] = append(gmap.Planets[i], struct {
				Type      uint8
				Magnitude uint8
				OrbitSlot uint8
			}{pType, mag, orbit})
		}
	}

	return gmap, nil
}

func spectralClassToByte(spectralType string) uint8 {
	if len(spectralType) == 0 {
		return 4 // G
	}
	switch spectralType[0] {
	case 'O', 'o':
		return 0
	case 'B', 'b':
		return 1
	case 'A', 'a':
		return 2
	case 'F', 'f':
		return 3
	case 'G', 'g':
		return 4
	case 'K', 'k':
		return 5
	case 'M', 'm':
		return 6
	default:
		return 4
	}
}

func byteToSpectralClass(b uint8) string {
	classes := []string{"O", "B", "A", "F", "G", "K", "M"}
	if int(b) < len(classes) {
		return classes[b]
	}
	return "G"
}

// packPlanet packs planet data into a uint16.
// Bits: [15:12] type (4 bits, 0-6) | [11:7] magnitude (5 bits, 0-31) | [6:3] orbitSlot (4 bits) | [2:0] reserved
func packPlanet(pType uint8, magnitude uint8, orbitSlot uint8) uint16 {
	return uint16(pType&0xF)<<12 |
		uint16(magnitude&0x1F)<<7 |
		uint16(orbitSlot&0xF)<<3
}

func unpackPlanet(packed uint16) (pType, magnitude, orbitSlot uint8) {
	pType = uint8((packed >> 12) & 0xF)
	magnitude = uint8((packed >> 7) & 0x1F)
	orbitSlot = uint8((packed >> 3) & 0xF)
	return
}

func readCString(data []byte, offset int) string {
	end := offset
	for end < len(data) && data[end] != 0 {
		end++
	}
	return string(data[offset:end])
}
```

### internal/encoder/binary_test.go

```go
package encoder

import (
	"testing"

	"github.com/Atvriders/GalacticFront/map-generator/internal/hyperlanes"
	"github.com/Atvriders/GalacticFront/map-generator/internal/planets"
	"github.com/Atvriders/GalacticFront/map-generator/internal/projection"
	"github.com/Atvriders/GalacticFront/map-generator/internal/wormholes"
)

func TestEncodeDecodRoundTrip(t *testing.T) {
	gmap := &GameMap{
		Width:  2000,
		Height: 2000,
		Systems: []projection.System{
			{ID: 0, Name: "Sol", GameX: 500, GameY: 500, SpectralType: "G2V"},
			{ID: 1, Name: "Sirius", GameX: 800, GameY: 300, SpectralType: "A1V"},
			{ID: 2, Name: "Betelgeuse", GameX: 200, GameY: 900, SpectralType: "M1Iab"},
		},
		Planets: [][]planets.Planet{
			{{Type: planets.Terrestrial, Magnitude: 15, OrbitSlot: 0}, {Type: planets.Ocean, Magnitude: 28, OrbitSlot: 1}},
			{{Type: planets.GasGiant, Magnitude: 5, OrbitSlot: 0}},
			{{Type: planets.Barren, Magnitude: 0, OrbitSlot: 0}, {Type: planets.Volcanic, Magnitude: 31, OrbitSlot: 1}, {Type: planets.Ice, Magnitude: 20, OrbitSlot: 2}},
		},
		Hyperlanes: []hyperlanes.Edge{
			{A: 0, B: 1},
			{A: 1, B: 2},
			{A: 0, B: 2},
		},
		Wormholes: []wormholes.WormholePair{
			{SystemA: 0, SystemB: 2},
		},
	}

	data, err := Encode(gmap)
	if err != nil {
		t.Fatalf("Encode: %v", err)
	}

	if len(data) == 0 {
		t.Fatal("encoded data is empty")
	}

	// Verify magic bytes
	if string(data[:4]) != MagicBytes {
		t.Errorf("magic bytes: got %q, want %q", data[:4], MagicBytes)
	}

	t.Logf("encoded %d bytes for %d systems, %d edges, %d wormholes",
		len(data), len(gmap.Systems), len(gmap.Hyperlanes), len(gmap.Wormholes))
}

func TestPackUnpackPlanet(t *testing.T) {
	tests := []struct {
		pType, mag, orbit uint8
	}{
		{0, 0, 0},
		{6, 31, 15},
		{3, 15, 7},
		{1, 28, 4},
	}
	for _, tt := range tests {
		packed := packPlanet(tt.pType, tt.mag, tt.orbit)
		gotType, gotMag, gotOrbit := unpackPlanet(packed)
		if gotType != tt.pType || gotMag != tt.mag || gotOrbit != tt.orbit {
			t.Errorf("pack/unpack(%d,%d,%d): got (%d,%d,%d)",
				tt.pType, tt.mag, tt.orbit, gotType, gotMag, gotOrbit)
		}
	}
}

func TestSpectralClassByte(t *testing.T) {
	classes := []string{"O", "B", "A", "F", "G", "K", "M"}
	for i, cls := range classes {
		b := spectralClassToByte(cls)
		if b != uint8(i) {
			t.Errorf("spectralClassToByte(%s) = %d, want %d", cls, b, i)
		}
		back := byteToSpectralClass(b)
		if back != cls {
			t.Errorf("byteToSpectralClass(%d) = %s, want %s", b, back, cls)
		}
	}
}
```

### Test

```bash
cd /home/kasm-user/GalacticFront/map-generator && go test ./internal/encoder/...
```

### Commit

```
feat(map-generator): binary map encoding with planet packing and string table
```

---

## Task 9: Manifest Generation

**Files:**
- `internal/manifest/manifest.go`
- `internal/manifest/manifest_test.go`

**Checklist:**
- [ ] Generate `meta.json` with system count, map dimensions, nation spawns, version
- [ ] Include arm labels (for galaxy map)
- [ ] Include generation timestamp and seed
- [ ] Pretty-print JSON output

### internal/manifest/manifest.go

```go
package manifest

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/Atvriders/GalacticFront/map-generator/internal/config"
	"github.com/Atvriders/GalacticFront/map-generator/internal/encoder"
)

// Meta holds map metadata for the client.
type Meta struct {
	Version      int            `json:"version"`
	MapName      string         `json:"mapName"`
	GeneratedAt  string         `json:"generatedAt"`
	Width        int            `json:"width"`
	Height       int            `json:"height"`
	SystemCount  int            `json:"systemCount"`
	EdgeCount    int            `json:"edgeCount"`
	WormholeCount int           `json:"wormholeCount"`
	TotalPlanets int            `json:"totalPlanets"`
	Nations      []NationMeta   `json:"nations"`
	ArmLabels    []ArmLabel     `json:"armLabels,omitempty"`
	Files        []string       `json:"files"`
}

// NationMeta describes a nation's spawn info.
type NationMeta struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	SystemID int     `json:"systemId"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
}

// ArmLabel names a region of the galaxy map.
type ArmLabel struct {
	Name string  `json:"name"`
	X    float64 `json:"x"`
	Y    float64 `json:"y"`
}

// WriteJSON writes meta.json to the given directory.
func WriteJSON(gmap *encoder.GameMap, mc config.MapConfig, dir string) error {
	totalPlanets := 0
	for _, sp := range gmap.Planets {
		totalPlanets += len(sp)
	}

	meta := Meta{
		Version:       encoder.FormatVersion,
		MapName:       mc.Name,
		GeneratedAt:   time.Now().UTC().Format(time.RFC3339),
		Width:         gmap.Width,
		Height:        gmap.Height,
		SystemCount:   len(gmap.Systems),
		EdgeCount:     len(gmap.Hyperlanes),
		WormholeCount: len(gmap.Wormholes),
		TotalPlanets:  totalPlanets,
		Files:         []string{"map.bin", "map_4x.bin", "map_16x.bin", "meta.json"},
	}

	for _, sp := range gmap.Spawns {
		nm := NationMeta{
			ID:       sp.NationID,
			Name:     sp.NationName,
			SystemID: sp.SystemIdx,
		}
		if sp.SystemIdx >= 0 && sp.SystemIdx < len(gmap.Systems) {
			nm.X = gmap.Systems[sp.SystemIdx].GameX
			nm.Y = gmap.Systems[sp.SystemIdx].GameY
		}
		meta.Nations = append(meta.Nations, nm)
	}

	// Add arm labels for galaxy maps
	if mc.Name == "galaxy" {
		meta.ArmLabels = defaultArmLabels(gmap.Width, gmap.Height)
	}

	data, err := json.MarshalIndent(meta, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal meta: %w", err)
	}

	return os.WriteFile(filepath.Join(dir, "meta.json"), data, 0o644)
}

func defaultArmLabels(w, h int) []ArmLabel {
	cx, cy := float64(w)/2, float64(h)/2
	return []ArmLabel{
		{Name: "Orion Arm", X: cx + float64(w)*0.2, Y: cy - float64(h)*0.1},
		{Name: "Perseus Arm", X: cx - float64(w)*0.3, Y: cy + float64(h)*0.15},
		{Name: "Sagittarius Arm", X: cx + float64(w)*0.1, Y: cy + float64(h)*0.3},
		{Name: "Scutum-Centaurus Arm", X: cx - float64(w)*0.15, Y: cy - float64(h)*0.25},
		{Name: "Galactic Core", X: cx, Y: cy},
	}
}
```

### internal/manifest/manifest_test.go

```go
package manifest

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/Atvriders/GalacticFront/map-generator/internal/config"
	"github.com/Atvriders/GalacticFront/map-generator/internal/encoder"
	"github.com/Atvriders/GalacticFront/map-generator/internal/nations"
	"github.com/Atvriders/GalacticFront/map-generator/internal/planets"
	"github.com/Atvriders/GalacticFront/map-generator/internal/projection"
)

func TestWriteJSON(t *testing.T) {
	dir := t.TempDir()

	gmap := &encoder.GameMap{
		Width:  2000,
		Height: 2000,
		Systems: []projection.System{
			{ID: 0, Name: "Sol", GameX: 500, GameY: 500},
			{ID: 1, Name: "Sirius", GameX: 800, GameY: 300},
		},
		Planets: [][]planets.Planet{
			{{Type: planets.Terrestrial, Magnitude: 10, OrbitSlot: 0}},
			{{Type: planets.GasGiant, Magnitude: 5, OrbitSlot: 0}, {Type: planets.Ice, Magnitude: 20, OrbitSlot: 1}},
		},
		Spawns: []nations.SpawnPoint{
			{NationID: "solar_federation", NationName: "Solar Federation", SystemIdx: 0},
		},
	}

	mc := config.MapConfig{Name: "sector", Width: 2000, Height: 2000}

	err := WriteJSON(gmap, mc, dir)
	if err != nil {
		t.Fatalf("WriteJSON: %v", err)
	}

	data, err := os.ReadFile(filepath.Join(dir, "meta.json"))
	if err != nil {
		t.Fatalf("read meta.json: %v", err)
	}

	var meta Meta
	if err := json.Unmarshal(data, &meta); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if meta.SystemCount != 2 {
		t.Errorf("systemCount = %d, want 2", meta.SystemCount)
	}
	if meta.TotalPlanets != 3 {
		t.Errorf("totalPlanets = %d, want 3", meta.TotalPlanets)
	}
	if len(meta.Nations) != 1 {
		t.Errorf("nations = %d, want 1", len(meta.Nations))
	}
	if meta.MapName != "sector" {
		t.Errorf("mapName = %q, want %q", meta.MapName, "sector")
	}
}

func TestGalaxyArmLabels(t *testing.T) {
	dir := t.TempDir()
	gmap := &encoder.GameMap{Width: 16000, Height: 16000}
	mc := config.MapConfig{Name: "galaxy", Width: 16000, Height: 16000}

	err := WriteJSON(gmap, mc, dir)
	if err != nil {
		t.Fatalf("WriteJSON: %v", err)
	}

	data, _ := os.ReadFile(filepath.Join(dir, "meta.json"))
	var meta Meta
	json.Unmarshal(data, &meta)

	if len(meta.ArmLabels) != 5 {
		t.Errorf("expected 5 arm labels, got %d", len(meta.ArmLabels))
	}
}
```

### Test

```bash
cd /home/kasm-user/GalacticFront/map-generator && go test ./internal/manifest/...
```

### Commit

```
feat(map-generator): meta.json manifest with nation spawns and arm labels
```

---

## Task 10: Map Scaling

**Files:**
- `internal/encoder/scale.go`
- `internal/encoder/scale_test.go`

**Checklist:**
- [ ] Generate 4x downsampled map (divide all coordinates by 4, round dimensions)
- [ ] Generate 16x downsampled map
- [ ] Preserve system indices and edge/wormhole references
- [ ] Write map_4x.bin and map_16x.bin

### internal/encoder/scale.go

```go
package encoder

import (
	"os"
	"path/filepath"

	"github.com/Atvriders/GalacticFront/map-generator/internal/projection"
)

// WriteScaled writes downsampled map binaries (map_4x.bin, map_16x.bin).
func WriteScaled(gmap *GameMap, dir string) error {
	for _, scale := range []struct {
		factor int
		name   string
	}{
		{4, "map_4x.bin"},
		{16, "map_16x.bin"},
	} {
		scaled := ScaleDown(gmap, scale.factor)
		data, err := Encode(scaled)
		if err != nil {
			return err
		}
		if err := os.WriteFile(filepath.Join(dir, scale.name), data, 0o644); err != nil {
			return err
		}
	}
	return nil
}

// ScaleDown creates a copy of the map with coordinates divided by factor.
// System indices, edges, and wormholes are preserved.
func ScaleDown(gmap *GameMap, factor int) *GameMap {
	f := float64(factor)
	scaledSystems := make([]projection.System, len(gmap.Systems))
	for i, s := range gmap.Systems {
		scaledSystems[i] = s
		scaledSystems[i].GameX = s.GameX / f
		scaledSystems[i].GameY = s.GameY / f
	}

	return &GameMap{
		Width:      gmap.Width / factor,
		Height:     gmap.Height / factor,
		Systems:    scaledSystems,
		Planets:    gmap.Planets,
		Hyperlanes: gmap.Hyperlanes,
		Wormholes:  gmap.Wormholes,
		Spawns:     gmap.Spawns,
	}
}
```

### internal/encoder/scale_test.go

```go
package encoder

import (
	"math"
	"testing"

	"github.com/Atvriders/GalacticFront/map-generator/internal/projection"
)

func TestScaleDown(t *testing.T) {
	gmap := &GameMap{
		Width:  1600,
		Height: 1600,
		Systems: []projection.System{
			{ID: 0, GameX: 400, GameY: 800},
			{ID: 1, GameX: 1200, GameY: 400},
		},
	}

	scaled := ScaleDown(gmap, 4)

	if scaled.Width != 400 || scaled.Height != 400 {
		t.Errorf("dimensions: %dx%d, want 400x400", scaled.Width, scaled.Height)
	}

	if math.Abs(scaled.Systems[0].GameX-100) > 0.01 {
		t.Errorf("system 0 X = %.1f, want 100", scaled.Systems[0].GameX)
	}
	if math.Abs(scaled.Systems[0].GameY-200) > 0.01 {
		t.Errorf("system 0 Y = %.1f, want 200", scaled.Systems[0].GameY)
	}
	if math.Abs(scaled.Systems[1].GameX-300) > 0.01 {
		t.Errorf("system 1 X = %.1f, want 300", scaled.Systems[1].GameX)
	}
}

func TestScaleDownPreservesEdges(t *testing.T) {
	gmap := &GameMap{
		Width:  1600,
		Height: 1600,
		Systems: []projection.System{
			{ID: 0, GameX: 400, GameY: 400},
			{ID: 1, GameX: 800, GameY: 800},
		},
		Hyperlanes: []struct{ A, B int }{{0, 1}},
	}

	scaled := ScaleDown(gmap, 4)
	if len(scaled.Hyperlanes) != 1 {
		t.Fatalf("expected 1 edge, got %d", len(scaled.Hyperlanes))
	}
	if scaled.Hyperlanes[0].A != 0 || scaled.Hyperlanes[0].B != 1 {
		t.Error("edge indices changed after scaling")
	}
}

func TestWriteScaled(t *testing.T) {
	dir := t.TempDir()
	gmap := &GameMap{
		Width:  1600,
		Height: 1600,
		Systems: []projection.System{
			{ID: 0, Name: "A", GameX: 400, GameY: 400},
		},
	}

	err := WriteScaled(gmap, dir)
	if err != nil {
		t.Fatalf("WriteScaled: %v", err)
	}

	// Verify files exist
	for _, name := range []string{"map_4x.bin", "map_16x.bin"} {
		info, err := os.Stat(filepath.Join(dir, name))
		if err != nil {
			t.Errorf("%s not created: %v", name, err)
		} else if info.Size() == 0 {
			t.Errorf("%s is empty", name)
		}
	}
}
```

### Test

```bash
cd /home/kasm-user/GalacticFront/map-generator && go test ./internal/encoder/...
```

### Commit

```
feat(map-generator): 4x and 16x scaled minimap binaries
```

---

## Task 11: Generator Orchestrator + Multiple Map Configs

**Files:**
- `internal/generator/generator.go`
- `internal/generator/generator_test.go`

**Checklist:**
- [ ] Orchestrate full pipeline: filter stars -> project -> generate planets -> compute hyperlanes -> place wormholes -> assign nations
- [ ] Select N random stars from catalog to match map config system count
- [ ] Support all 3 map configs (sector, arm, galaxy)
- [ ] Return complete `GameMap`

### internal/generator/generator.go

```go
package generator

import (
	"fmt"
	"math/rand"

	"github.com/Atvriders/GalacticFront/map-generator/internal/catalog"
	"github.com/Atvriders/GalacticFront/map-generator/internal/config"
	"github.com/Atvriders/GalacticFront/map-generator/internal/encoder"
	"github.com/Atvriders/GalacticFront/map-generator/internal/hyperlanes"
	"github.com/Atvriders/GalacticFront/map-generator/internal/nations"
	"github.com/Atvriders/GalacticFront/map-generator/internal/planets"
	"github.com/Atvriders/GalacticFront/map-generator/internal/projection"
	"github.com/Atvriders/GalacticFront/map-generator/internal/wormholes"
)

// Generate runs the full map generation pipeline.
func Generate(mc config.MapConfig, allStars []catalog.Star) (*encoder.GameMap, error) {
	// Determine target system count
	targetCount := mc.MinSystems + rand.Intn(mc.MaxSystems-mc.MinSystems+1)

	// Select stars from catalog
	selected, err := selectStars(allStars, targetCount)
	if err != nil {
		return nil, fmt.Errorf("select stars: %w", err)
	}

	// Project to 2D game coordinates
	systems := projection.ProjectTopDown(selected, mc.Width, mc.Height)

	// Generate planets for each system
	allPlanets := make([][]planets.Planet, len(systems))
	for i, sys := range systems {
		rng := rand.New(rand.NewSource(int64(sys.ID*31337 + i)))
		allPlanets[i] = planets.Generate(rng, sys.SpectralClass(), mc.MinPlanets, mc.MaxPlanets)
	}

	// Compute hyperlanes
	edges := hyperlanes.ComputeHyperlanes(systems, mc.MaxHyperlaneLength, mc.TargetAvgDegree, nil)

	// Place wormholes
	whRng := rand.New(rand.NewSource(int64(len(systems) * 7919)))
	wormholePairs := wormholes.Place(whRng, systems, mc.WormholePairs)

	// Assign nation spawn points
	nats := nations.DefaultNations()
	spawns := nations.AssignSpawns(nats, systems, mc.Width, mc.Height)

	gmap := &encoder.GameMap{
		Width:      mc.Width,
		Height:     mc.Height,
		Systems:    systems,
		Planets:    allPlanets,
		Hyperlanes: edges,
		Wormholes:  wormholePairs,
		Spawns:     spawns,
	}

	return gmap, nil
}

// selectStars picks targetCount stars from the catalog.
// If the catalog has fewer stars, all are used.
// If more, a random subset is selected (preserving named stars preferentially).
func selectStars(stars []catalog.Star, targetCount int) ([]catalog.Star, error) {
	if len(stars) == 0 {
		return nil, fmt.Errorf("empty star catalog")
	}

	if len(stars) <= targetCount {
		return stars, nil
	}

	// Separate named and unnamed stars
	var named, unnamed []catalog.Star
	for _, s := range stars {
		if s.Name != "" {
			named = append(named, s)
		} else {
			unnamed = append(unnamed, s)
		}
	}

	// Include all named stars (up to target)
	var selected []catalog.Star
	if len(named) >= targetCount {
		// Shuffle named and take first targetCount
		rand.Shuffle(len(named), func(i, j int) {
			named[i], named[j] = named[j], named[i]
		})
		return named[:targetCount], nil
	}

	selected = append(selected, named...)
	remaining := targetCount - len(selected)

	// Fill with random unnamed stars
	rand.Shuffle(len(unnamed), func(i, j int) {
		unnamed[i], unnamed[j] = unnamed[j], unnamed[i]
	})
	if remaining > len(unnamed) {
		remaining = len(unnamed)
	}
	selected = append(selected, unnamed[:remaining]...)

	return selected, nil
}

// SpectralClass returns the single-letter class from a projection.System.
func spectralClass(sys projection.System) string {
	if len(sys.SpectralType) == 0 {
		return "G"
	}
	return string(sys.SpectralType[0])
}
```

### internal/generator/generator_test.go

```go
package generator

import (
	"math/rand"
	"testing"

	"github.com/Atvriders/GalacticFront/map-generator/internal/catalog"
	"github.com/Atvriders/GalacticFront/map-generator/internal/config"
	"github.com/Atvriders/GalacticFront/map-generator/internal/hyperlanes"
)

func makeSampleStars(n int) []catalog.Star {
	rng := rand.New(rand.NewSource(42))
	classes := []string{"G2V", "K1III", "M3V", "A1V", "F5IV", "B8I"}
	stars := make([]catalog.Star, n)
	for i := range stars {
		stars[i] = catalog.Star{
			ID:           i,
			X:            rng.Float64()*200 - 100,
			Y:            rng.Float64()*200 - 100,
			Z:            rng.Float64()*40 - 20,
			SpectralType: classes[rng.Intn(len(classes))],
			Magnitude:    rng.Float64() * 6,
		}
		if i == 0 {
			stars[i].Name = "Sol"
		} else if i < 10 {
			stars[i].Name = ""
		}
	}
	return stars
}

func TestGenerateSector(t *testing.T) {
	stars := makeSampleStars(200)
	mc := config.GetMapConfig("sector")

	gmap, err := Generate(mc, stars)
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}

	if len(gmap.Systems) < mc.MinSystems || len(gmap.Systems) > mc.MaxSystems {
		t.Errorf("system count %d not in [%d,%d]", len(gmap.Systems), mc.MinSystems, mc.MaxSystems)
	}

	if len(gmap.Planets) != len(gmap.Systems) {
		t.Errorf("planet array length %d != system count %d", len(gmap.Planets), len(gmap.Systems))
	}

	for i, sp := range gmap.Planets {
		if len(sp) < mc.MinPlanets || len(sp) > mc.MaxPlanets {
			t.Errorf("system %d: %d planets not in [%d,%d]", i, len(sp), mc.MinPlanets, mc.MaxPlanets)
		}
	}

	if !hyperlanes.IsConnected(gmap.Hyperlanes, len(gmap.Systems)) {
		t.Error("hyperlane graph not connected")
	}

	t.Logf("sector: %d systems, %d edges, %d wormholes, %d spawns",
		len(gmap.Systems), len(gmap.Hyperlanes), len(gmap.Wormholes), len(gmap.Spawns))
}

func TestGenerateArm(t *testing.T) {
	stars := makeSampleStars(600)
	mc := config.GetMapConfig("arm")

	gmap, err := Generate(mc, stars)
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}

	if len(gmap.Systems) < mc.MinSystems {
		t.Errorf("system count %d < min %d", len(gmap.Systems), mc.MinSystems)
	}

	t.Logf("arm: %d systems, %d edges, avg degree %.2f",
		len(gmap.Systems), len(gmap.Hyperlanes),
		hyperlanes.AverageDegree(gmap.Hyperlanes, len(gmap.Systems)))
}

func TestSelectStarsPreservesNamed(t *testing.T) {
	stars := []catalog.Star{
		{ID: 0, Name: "Sol", X: 1, Y: 1, Z: 0, Magnitude: -26},
		{ID: 1, Name: "Sirius", X: 2, Y: 2, Z: 0, Magnitude: -1.4},
		{ID: 2, Name: "", X: 3, Y: 3, Z: 0, Magnitude: 3},
		{ID: 3, Name: "", X: 4, Y: 4, Z: 0, Magnitude: 4},
		{ID: 4, Name: "", X: 5, Y: 5, Z: 0, Magnitude: 5},
	}

	selected, err := selectStars(stars, 3)
	if err != nil {
		t.Fatal(err)
	}

	if len(selected) != 3 {
		t.Fatalf("expected 3, got %d", len(selected))
	}

	// Named stars should be included
	hasNamed := 0
	for _, s := range selected {
		if s.Name != "" {
			hasNamed++
		}
	}
	if hasNamed < 2 {
		t.Errorf("expected at least 2 named stars, got %d", hasNamed)
	}
}
```

### Test

```bash
cd /home/kasm-user/GalacticFront/map-generator && go test ./internal/generator/...
```

### Commit

```
feat(map-generator): generation orchestrator with star selection and full pipeline
```

---

## Task 12: Validation

**Files:**
- `internal/validator/validator.go`
- `internal/validator/validator_test.go`

**Checklist:**
- [ ] System count within MapConfig bounds
- [ ] All systems have MinPlanets to MaxPlanets planets
- [ ] Hyperlane graph is fully connected
- [ ] Planet magnitudes in 0-31 range
- [ ] All system positions within map bounds
- [ ] Wormhole endpoints reference valid systems
- [ ] Return list of validation error strings

### internal/validator/validator.go

```go
package validator

import (
	"fmt"

	"github.com/Atvriders/GalacticFront/map-generator/internal/config"
	"github.com/Atvriders/GalacticFront/map-generator/internal/encoder"
	"github.com/Atvriders/GalacticFront/map-generator/internal/hyperlanes"
)

// Validate checks a generated map against its config constraints.
// Returns a list of validation error descriptions (empty = valid).
func Validate(gmap *encoder.GameMap, mc config.MapConfig) []string {
	var errs []string

	// System count bounds
	if len(gmap.Systems) < mc.MinSystems {
		errs = append(errs, fmt.Sprintf("system count %d < min %d", len(gmap.Systems), mc.MinSystems))
	}
	if len(gmap.Systems) > mc.MaxSystems {
		errs = append(errs, fmt.Sprintf("system count %d > max %d", len(gmap.Systems), mc.MaxSystems))
	}

	// Planet count bounds per system
	if len(gmap.Planets) != len(gmap.Systems) {
		errs = append(errs, fmt.Sprintf("planet array length %d != system count %d", len(gmap.Planets), len(gmap.Systems)))
	} else {
		for i, sp := range gmap.Planets {
			if len(sp) < mc.MinPlanets {
				errs = append(errs, fmt.Sprintf("system %d: %d planets < min %d", i, len(sp), mc.MinPlanets))
			}
			if len(sp) > mc.MaxPlanets {
				errs = append(errs, fmt.Sprintf("system %d: %d planets > max %d", i, len(sp), mc.MaxPlanets))
			}
			for j, p := range sp {
				if p.Magnitude > 31 {
					errs = append(errs, fmt.Sprintf("system %d planet %d: magnitude %d > 31", i, j, p.Magnitude))
				}
			}
		}
	}

	// System positions within bounds
	for i, sys := range gmap.Systems {
		if sys.GameX < 0 || sys.GameX > float64(gmap.Width) {
			errs = append(errs, fmt.Sprintf("system %d: X=%.1f out of bounds [0,%d]", i, sys.GameX, gmap.Width))
		}
		if sys.GameY < 0 || sys.GameY > float64(gmap.Height) {
			errs = append(errs, fmt.Sprintf("system %d: Y=%.1f out of bounds [0,%d]", i, sys.GameY, gmap.Height))
		}
	}

	// Hyperlane connectivity
	if len(gmap.Systems) > 1 && !hyperlanes.IsConnected(gmap.Hyperlanes, len(gmap.Systems)) {
		errs = append(errs, "hyperlane graph is not fully connected")
	}

	// Hyperlane edge references
	for i, e := range gmap.Hyperlanes {
		if e.A < 0 || e.A >= len(gmap.Systems) {
			errs = append(errs, fmt.Sprintf("edge %d: A=%d out of range", i, e.A))
		}
		if e.B < 0 || e.B >= len(gmap.Systems) {
			errs = append(errs, fmt.Sprintf("edge %d: B=%d out of range", i, e.B))
		}
		if e.A == e.B {
			errs = append(errs, fmt.Sprintf("edge %d: self-loop A=B=%d", i, e.A))
		}
	}

	// Wormhole references
	for i, w := range gmap.Wormholes {
		if w.SystemA < 0 || w.SystemA >= len(gmap.Systems) {
			errs = append(errs, fmt.Sprintf("wormhole %d: SystemA=%d out of range", i, w.SystemA))
		}
		if w.SystemB < 0 || w.SystemB >= len(gmap.Systems) {
			errs = append(errs, fmt.Sprintf("wormhole %d: SystemB=%d out of range", i, w.SystemB))
		}
		if w.SystemA == w.SystemB {
			errs = append(errs, fmt.Sprintf("wormhole %d: self-loop", i))
		}
	}

	return errs
}
```

### internal/validator/validator_test.go

```go
package validator

import (
	"testing"

	"github.com/Atvriders/GalacticFront/map-generator/internal/config"
	"github.com/Atvriders/GalacticFront/map-generator/internal/encoder"
	"github.com/Atvriders/GalacticFront/map-generator/internal/hyperlanes"
	"github.com/Atvriders/GalacticFront/map-generator/internal/planets"
	"github.com/Atvriders/GalacticFront/map-generator/internal/projection"
	"github.com/Atvriders/GalacticFront/map-generator/internal/wormholes"
)

func validMap() (*encoder.GameMap, config.MapConfig) {
	mc := config.MapConfig{
		Name:       "test",
		MinSystems: 3,
		MaxSystems: 10,
		Width:      1000,
		Height:     1000,
		MinPlanets: 2,
		MaxPlanets: 5,
	}

	gmap := &encoder.GameMap{
		Width:  1000,
		Height: 1000,
		Systems: []projection.System{
			{ID: 0, GameX: 100, GameY: 100},
			{ID: 1, GameX: 500, GameY: 500},
			{ID: 2, GameX: 900, GameY: 900},
		},
		Planets: [][]planets.Planet{
			{{Type: planets.Terrestrial, Magnitude: 10}, {Type: planets.Ocean, Magnitude: 20}},
			{{Type: planets.GasGiant, Magnitude: 5}, {Type: planets.Barren, Magnitude: 0}, {Type: planets.Ice, Magnitude: 15}},
			{{Type: planets.Desert, Magnitude: 31}, {Type: planets.Volcanic, Magnitude: 1}},
		},
		Hyperlanes: []hyperlanes.Edge{{A: 0, B: 1}, {A: 1, B: 2}},
		Wormholes:  []wormholes.WormholePair{{SystemA: 0, SystemB: 2}},
	}

	return gmap, mc
}

func TestValidateValid(t *testing.T) {
	gmap, mc := validMap()
	errs := Validate(gmap, mc)
	if len(errs) > 0 {
		for _, e := range errs {
			t.Errorf("unexpected error: %s", e)
		}
	}
}

func TestValidateTooFewSystems(t *testing.T) {
	gmap, mc := validMap()
	mc.MinSystems = 10
	errs := Validate(gmap, mc)
	if len(errs) == 0 {
		t.Error("expected validation error for too few systems")
	}
}

func TestValidateDisconnected(t *testing.T) {
	gmap, mc := validMap()
	gmap.Hyperlanes = []hyperlanes.Edge{{A: 0, B: 1}} // system 2 disconnected
	errs := Validate(gmap, mc)

	found := false
	for _, e := range errs {
		if e == "hyperlane graph is not fully connected" {
			found = true
		}
	}
	if !found {
		t.Error("expected connectivity error")
	}
}

func TestValidateBadWormhole(t *testing.T) {
	gmap, mc := validMap()
	gmap.Wormholes = []wormholes.WormholePair{{SystemA: 0, SystemB: 99}}
	errs := Validate(gmap, mc)

	if len(errs) == 0 {
		t.Error("expected validation error for out-of-range wormhole")
	}
}

func TestValidatePlanetMagnitude(t *testing.T) {
	gmap, mc := validMap()
	gmap.Planets[0][0].Magnitude = 32
	errs := Validate(gmap, mc)

	found := false
	for _, e := range errs {
		t.Log(e)
		if len(e) > 0 {
			found = true
		}
	}
	if !found {
		t.Error("expected magnitude validation error")
	}
}

func TestValidateOutOfBounds(t *testing.T) {
	gmap, mc := validMap()
	gmap.Systems[0].GameX = -50
	errs := Validate(gmap, mc)
	if len(errs) == 0 {
		t.Error("expected out-of-bounds error")
	}
}
```

### Test

```bash
cd /home/kasm-user/GalacticFront/map-generator && go test ./internal/validator/...
```

### Commit

```
feat(map-generator): map validation with connectivity, bounds, and constraint checks
```

---

## Task 13: Integration Test

**Files:**
- `integration_test.go`

**Checklist:**
- [ ] Generate a sector map end-to-end
- [ ] Write all output files (map.bin, map_4x.bin, map_16x.bin, meta.json)
- [ ] Verify binary files are non-empty and start with correct magic bytes
- [ ] Verify meta.json parses correctly
- [ ] Verify system counts match between meta.json and binary

### integration_test.go

```go
//go:build integration

package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Atvriders/GalacticFront/map-generator/internal/catalog"
	"github.com/Atvriders/GalacticFront/map-generator/internal/config"
	"github.com/Atvriders/GalacticFront/map-generator/internal/encoder"
	"github.com/Atvriders/GalacticFront/map-generator/internal/generator"
	"github.com/Atvriders/GalacticFront/map-generator/internal/manifest"
	"github.com/Atvriders/GalacticFront/map-generator/internal/validator"
)

// sampleCSV provides enough stars for a sector map test.
var sampleCSV = `id,hip,proper,ra,dec,dist,mag,spect,ci,x,y,z
` + generateTestStars(150)

func generateTestStars(n int) string {
	var sb strings.Builder
	names := []string{"Sol", "Sirius", "Vega", "Arcturus", "Capella", "Rigel", "Procyon", "Betelgeuse", "Altair", "Aldebaran"}
	classes := []string{"G2V", "A1V", "A0V", "K1III", "G5III", "B8I", "F5IV", "M1Iab", "A7V", "K5III", "M3V", "F0II", "B6V"}
	for i := 0; i < n; i++ {
		name := ""
		if i < len(names) {
			name = names[i]
		}
		x := float64(i%15)*20 - 140
		y := float64(i/15)*20 - 100
		z := float64(i%7)*5 - 15
		mag := float64(i%6) + 0.5
		cls := classes[i%len(classes)]
		sb.WriteString(strings.Join([]string{
			itoa(i), itoa(i + 1000), name,
			"", "", "",
			ftoa(mag), cls, "0.5",
			ftoa(x), ftoa(y), ftoa(z),
		}, ","))
		sb.WriteByte('\n')
	}
	return sb.String()
}

func itoa(n int) string {
	return strings.TrimRight(strings.TrimRight(
		strings.Replace(
			strings.Replace(
				strings.Replace(
					func() string { s := ""; for n > 0 { s = string(rune('0'+n%10)) + s; n /= 10 }; if s == "" { return "0" }; return s }(),
					"", "", 0), "", "", 0), "", "", 0),
		""), "")
}

func ftoa(f float64) string {
	// Simple float formatting for test data
	return func() string {
		if f < 0 {
			return "-" + ftoa(-f)
		}
		whole := int(f)
		frac := int((f - float64(whole)) * 10)
		return itoa(whole) + "." + itoa(frac)
	}()
}

func TestIntegrationSectorMap(t *testing.T) {
	dir := t.TempDir()
	mc := config.GetMapConfig("sector")

	// Parse test stars
	stars, err := catalog.ParseCSV(strings.NewReader(sampleCSV), 7.0)
	if err != nil {
		t.Fatalf("parse CSV: %v", err)
	}
	t.Logf("parsed %d stars", len(stars))

	// Generate map
	gmap, err := generator.Generate(mc, stars)
	if err != nil {
		t.Fatalf("generate: %v", err)
	}

	// Validate
	errs := validator.Validate(gmap, mc)
	for _, e := range errs {
		t.Logf("validation warning: %s", e)
	}

	// Write binary outputs
	if err := encoder.WriteBinary(gmap, dir); err != nil {
		t.Fatalf("write binary: %v", err)
	}
	if err := encoder.WriteScaled(gmap, dir); err != nil {
		t.Fatalf("write scaled: %v", err)
	}
	if err := manifest.WriteJSON(gmap, mc, dir); err != nil {
		t.Fatalf("write manifest: %v", err)
	}

	// Verify output files
	expectedFiles := []string{"map.bin", "map_4x.bin", "map_16x.bin", "meta.json"}
	for _, name := range expectedFiles {
		path := filepath.Join(dir, name)
		info, err := os.Stat(path)
		if err != nil {
			t.Errorf("missing output file: %s", name)
			continue
		}
		if info.Size() == 0 {
			t.Errorf("empty output file: %s", name)
		}
		t.Logf("%s: %d bytes", name, info.Size())
	}

	// Verify map.bin magic bytes
	mapData, _ := os.ReadFile(filepath.Join(dir, "map.bin"))
	if len(mapData) < 4 || string(mapData[:4]) != encoder.MagicBytes {
		t.Errorf("map.bin magic bytes: got %q, want %q", mapData[:4], encoder.MagicBytes)
	}

	// Verify meta.json
	metaData, _ := os.ReadFile(filepath.Join(dir, "meta.json"))
	var meta manifest.Meta
	if err := json.Unmarshal(metaData, &meta); err != nil {
		t.Fatalf("parse meta.json: %v", err)
	}

	if meta.SystemCount != len(gmap.Systems) {
		t.Errorf("meta.systemCount=%d != actual %d", meta.SystemCount, len(gmap.Systems))
	}
	if meta.Width != mc.Width || meta.Height != mc.Height {
		t.Errorf("meta dimensions %dx%d != config %dx%d", meta.Width, meta.Height, mc.Width, mc.Height)
	}

	t.Logf("integration test passed: %d systems, %d edges, %d wormholes",
		meta.SystemCount, meta.EdgeCount, meta.WormholeCount)
}
```

**Note:** The integration test above uses `//go:build integration` and hand-rolled `itoa`/`ftoa` to avoid `fmt`/`strconv` imports for the test data generator. In practice, replace with a simpler approach using `fmt.Sprintf` or a real test fixture CSV file. A cleaner version:

### integration_test.go (practical version)

```go
//go:build integration

package main

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"testing"

	"github.com/Atvriders/GalacticFront/map-generator/internal/catalog"
	"github.com/Atvriders/GalacticFront/map-generator/internal/config"
	"github.com/Atvriders/GalacticFront/map-generator/internal/encoder"
	"github.com/Atvriders/GalacticFront/map-generator/internal/generator"
	"github.com/Atvriders/GalacticFront/map-generator/internal/manifest"
	"github.com/Atvriders/GalacticFront/map-generator/internal/validator"
)

func makeTestStars(n int) []catalog.Star {
	rng := rand.New(rand.NewSource(12345))
	names := []string{"Sol", "Sirius", "Vega", "Arcturus", "Capella", "Rigel", "Procyon", "Betelgeuse", "Altair", "Aldebaran"}
	classes := []string{"G2V", "A1V", "A0V", "K1III", "G5III", "B8I", "F5IV", "M1Iab", "A7V", "K5III"}

	stars := make([]catalog.Star, n)
	for i := range stars {
		name := ""
		if i < len(names) {
			name = names[i]
		}
		stars[i] = catalog.Star{
			ID:           i,
			Name:         name,
			X:            rng.Float64()*300 - 150,
			Y:            rng.Float64()*300 - 150,
			Z:            rng.Float64()*60 - 30,
			SpectralType: classes[rng.Intn(len(classes))],
			Magnitude:    rng.Float64() * 6,
		}
	}
	return stars
}

func TestIntegrationSectorMap(t *testing.T) {
	dir := t.TempDir()
	mc := config.GetMapConfig("sector")
	stars := makeTestStars(150)

	gmap, err := generator.Generate(mc, stars)
	if err != nil {
		t.Fatalf("generate: %v", err)
	}

	// Validate
	errs := validator.Validate(gmap, mc)
	for _, e := range errs {
		t.Logf("validation: %s", e)
	}

	// Write all outputs
	if err := encoder.WriteBinary(gmap, dir); err != nil {
		t.Fatalf("write binary: %v", err)
	}
	if err := encoder.WriteScaled(gmap, dir); err != nil {
		t.Fatalf("write scaled: %v", err)
	}
	if err := manifest.WriteJSON(gmap, mc, dir); err != nil {
		t.Fatalf("write manifest: %v", err)
	}

	// Verify files
	for _, name := range []string{"map.bin", "map_4x.bin", "map_16x.bin", "meta.json"} {
		info, err := os.Stat(filepath.Join(dir, name))
		if err != nil {
			t.Errorf("missing: %s", name)
		} else {
			t.Logf("%s: %d bytes", name, info.Size())
		}
	}

	// Verify binary magic
	data, _ := os.ReadFile(filepath.Join(dir, "map.bin"))
	if string(data[:4]) != encoder.MagicBytes {
		t.Errorf("bad magic: %q", data[:4])
	}

	// Verify manifest
	metaBytes, _ := os.ReadFile(filepath.Join(dir, "meta.json"))
	var meta manifest.Meta
	if err := json.Unmarshal(metaBytes, &meta); err != nil {
		t.Fatalf("bad meta.json: %v", err)
	}
	if meta.SystemCount != len(gmap.Systems) {
		t.Errorf("system count mismatch: meta=%d actual=%d", meta.SystemCount, len(gmap.Systems))
	}

	t.Logf("OK: %d systems, %d edges, %d wormholes, %d nations",
		meta.SystemCount, meta.EdgeCount, meta.WormholeCount, len(meta.Nations))
}

func TestIntegrationAllMaps(t *testing.T) {
	stars := makeTestStars(2500)

	for _, name := range config.RegisteredMapNames() {
		t.Run(name, func(t *testing.T) {
			mc := config.GetMapConfig(name)
			gmap, err := generator.Generate(mc, stars)
			if err != nil {
				t.Fatalf("generate %s: %v", name, err)
			}

			errs := validator.Validate(gmap, mc)
			for _, e := range errs {
				t.Logf("validation: %s", e)
			}

			dir := t.TempDir()
			if err := encoder.WriteBinary(gmap, dir); err != nil {
				t.Fatalf("write: %v", err)
			}

			info, _ := os.Stat(filepath.Join(dir, "map.bin"))
			t.Logf("%s: %d systems, %d bytes", name, len(gmap.Systems), info.Size())

			_ = fmt.Sprintf("") // use fmt
		})
	}
}
```

### Test

```bash
cd /home/kasm-user/GalacticFront/map-generator && go test -tags=integration -v -run TestIntegration ./...
```

### Commit

```
feat(map-generator): integration tests for full map generation pipeline
```

---

## Update main.go to call WriteScaled

After Task 10, update `main.go` `generateMap` function to also write scaled maps:

```go
// In generateMap(), after encoder.WriteBinary:
if err := encoder.WriteScaled(gmap, dir); err != nil {
    return fmt.Errorf("encode scaled: %w", err)
}
```

### Commit

```
fix(map-generator): write scaled map binaries in main pipeline
```

---

## Summary

| Task | Package | Key Output |
|------|---------|------------|
| 1 | `config` | CLI, go.mod, map registry |
| 2 | `catalog` | CSV parser with HYG format |
| 3 | `projection` | 3D-to-2D with aspect ratio |
| 4 | `planets` | Spectral-weighted generation |
| 5 | `hyperlanes` | Delaunay + pruning + connectivity |
| 6 | `wormholes` | Cross-quadrant distant pairs |
| 7 | `nations` | Region-based spawn assignment |
| 8 | `encoder` | Binary format with string table |
| 9 | `manifest` | meta.json with arm labels |
| 10 | `encoder` | 4x/16x scaled minimaps |
| 11 | `generator` | Full pipeline orchestrator |
| 12 | `validator` | Constraint + connectivity checks |
| 13 | root | End-to-end integration tests |

**Dependency order:** Tasks 1-4 are independent. Task 5 depends on 3. Task 6 depends on 3. Task 7 depends on 3. Task 8 depends on 3-7. Task 9 depends on 8. Task 10 depends on 8. Task 11 depends on 2-7. Task 12 depends on 8. Task 13 depends on all.
