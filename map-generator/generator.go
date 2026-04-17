package main

import (
	"fmt"
	"log"
	"math/rand"
	"os"
	"path/filepath"
)

// Generate orchestrates the full map generation pipeline.
func Generate(config MapConfig, outputDir string, logLevel string) error {
	debug := logLevel == "debug"
	rng := rand.New(rand.NewSource(42)) // deterministic for reproducibility

	// Step 1: Select stars from catalog
	systems := selectStars(rng, config.SystemCount)
	if debug {
		log.Printf("  Selected %d systems", len(systems))
	}

	// Step 2: Generate planets
	var allPlanets []Planet
	for i, s := range systems {
		planets := GeneratePlanets(rng, uint16(i), s.Spectral)
		allPlanets = append(allPlanets, planets...)
	}
	if debug {
		log.Printf("  Generated %d planets", len(allPlanets))
	}

	// Step 3: Compute hyperlanes
	hyperlanes := ComputeHyperlanes(systems, config.HyperlaneMax, config.HyperlaneThresh)
	if debug {
		log.Printf("  Computed %d hyperlanes", len(hyperlanes))
	}

	// Step 4: Place wormholes
	wormholes := PlaceWormholes(rng, systems, config.WormholeCount)
	if debug {
		log.Printf("  Placed %d wormholes", len(wormholes))
	}

	// Step 5: Place nations
	nations := PlaceNations(systems)
	if debug {
		log.Printf("  Placed %d nations", len(nations))
	}

	// Assemble map data
	data := &MapData{
		Systems:    systems,
		Planets:    allPlanets,
		Hyperlanes: hyperlanes,
		Wormholes:  wormholes,
	}

	// Step 6: Validate
	if err := ValidateMap(data); err != nil {
		if ve, ok := err.(*ValidationError); ok {
			for _, e := range ve.Errors {
				log.Printf("  WARN: %s", e)
			}
		}
		return fmt.Errorf("validation failed: %w", err)
	}

	// Step 7: Create output directory
	mapDir := filepath.Join(outputDir, config.Name)
	if err := os.MkdirAll(mapDir, 0755); err != nil {
		return fmt.Errorf("create output dir: %w", err)
	}

	// Step 8: Write binary
	binData, err := EncodeBinary(data)
	if err != nil {
		return fmt.Errorf("encode binary: %w", err)
	}
	filename := fmt.Sprintf("%s.gfmap", config.Name)
	if err := os.WriteFile(filepath.Join(mapDir, filename), binData, 0644); err != nil {
		return fmt.Errorf("write binary: %w", err)
	}

	// Step 9: Write manifest
	if err := WriteManifest(mapDir, config.Name, data, nations); err != nil {
		return fmt.Errorf("write manifest: %w", err)
	}

	// Step 10: Write scaled versions
	if err := WriteScaledVersions(mapDir, config.Name, data); err != nil {
		return fmt.Errorf("write scaled: %w", err)
	}

	log.Printf("  Output: %s (%d bytes, %d systems, %d planets, %d hyperlanes, %d wormholes)",
		mapDir, len(binData), len(systems), len(allPlanets), len(hyperlanes), len(wormholes))

	return nil
}

// selectStars picks systems from the catalog, supplementing with procedural stars if needed.
func selectStars(rng *rand.Rand, count int) []System {
	systems := make([]System, 0, count)

	// Use catalog stars first
	catalogCount := count
	if catalogCount > len(StarCatalog) {
		catalogCount = len(StarCatalog)
	}

	// Shuffle catalog to get variety (but always include Sol first)
	indices := make([]int, len(StarCatalog))
	for i := range indices {
		indices[i] = i
	}
	// Keep Sol (index 0) at position 0
	rng.Shuffle(len(indices)-1, func(i, j int) {
		indices[i+1], indices[j+1] = indices[j+1], indices[i+1]
	})

	for i := 0; i < catalogCount; i++ {
		cs := StarCatalog[indices[i]]
		systems = append(systems, System{
			Name:     cs.Name,
			X:        float32(cs.X),
			Y:        float32(cs.Y),
			Spectral: cs.Spectral,
		})
	}

	// Generate procedural stars if we need more
	spectralTypes := []SpectralType{SpectralF, SpectralG, SpectralK, SpectralM, SpectralM, SpectralK, SpectralG}
	for i := catalogCount; i < count; i++ {
		// Spread procedurally around existing stars
		angle := rng.Float64() * 6.283185
		radius := 50.0 + rng.Float64()*500.0
		x := radius * rng.Float64() * cosApprox(angle)
		y := radius * rng.Float64() * sinApprox(angle)
		systems = append(systems, System{
			Name:     fmt.Sprintf("GF-%04d", i),
			X:        float32(x),
			Y:        float32(y),
			Spectral: spectralTypes[rng.Intn(len(spectralTypes))],
		})
	}

	return systems
}

func cosApprox(a float64) float64 {
	// Use standard math but avoid import cycle — already imported in hyperlanes
	// Just use a simple Taylor approx for variety
	// Actually just compute directly
	s, c := sinCos(a)
	_ = s
	return c
}

func sinApprox(a float64) float64 {
	s, _ := sinCos(a)
	return s
}

func sinCos(a float64) (float64, float64) {
	// Normalize to 0..2pi
	for a < 0 {
		a += 6.283185
	}
	for a > 6.283185 {
		a -= 6.283185
	}
	// Use polynomial approximation
	// sin(x) ≈ x - x^3/6 + x^5/120
	// Shift to -pi..pi
	a -= 3.141592
	a2 := a * a
	sin := a * (1 - a2/6*(1-a2/20*(1-a2/42)))
	cos := 1 - a2/2*(1-a2/12*(1-a2/30*(1-a2/56)))
	return sin, cos
}
