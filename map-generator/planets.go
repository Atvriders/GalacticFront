package main

import "math/rand"

// PlanetType represents the type of planet (0-7).
type PlanetType uint8

const (
	PlanetBarren    PlanetType = 0
	PlanetRocky     PlanetType = 1
	PlanetOceanic   PlanetType = 2
	PlanetTerran    PlanetType = 3
	PlanetDesert    PlanetType = 4
	PlanetIceWorld  PlanetType = 5
	PlanetGasGiant  PlanetType = 6
	PlanetMolten    PlanetType = 7
)

// Planet holds generated planet data.
type Planet struct {
	SystemID  uint16
	Type      PlanetType
	Magnitude uint8 // 0-31
}

// GeneratePlanets creates planets for a system based on star spectral type.
func GeneratePlanets(rng *rand.Rand, systemID uint16, spectral SpectralType) []Planet {
	minP, maxP := planetCountRange(spectral)
	count := minP + rng.Intn(maxP-minP+1)

	planets := make([]Planet, count)
	for i := 0; i < count; i++ {
		planets[i] = Planet{
			SystemID:  systemID,
			Type:      pickPlanetType(rng, spectral),
			Magnitude: uint8(rng.Intn(32)),
		}
	}
	return planets
}

func planetCountRange(s SpectralType) (int, int) {
	switch s {
	case SpectralO, SpectralB:
		return 6, 12
	case SpectralA, SpectralF:
		return 4, 10
	case SpectralG, SpectralK:
		return 4, 8
	case SpectralM:
		return 2, 5
	default:
		return 3, 6
	}
}

func pickPlanetType(rng *rand.Rand, s SpectralType) PlanetType {
	switch s {
	case SpectralO, SpectralB:
		// More gas giants and barren worlds around hot stars
		weights := []int{15, 10, 5, 2, 10, 8, 35, 15} // barren,rocky,ocean,terran,desert,ice,gas,molten
		return weightedPick(rng, weights)
	case SpectralA, SpectralF:
		weights := []int{10, 15, 10, 8, 12, 10, 25, 10}
		return weightedPick(rng, weights)
	case SpectralG, SpectralK:
		// Balanced, higher chance of habitable
		weights := []int{8, 15, 18, 20, 12, 10, 12, 5}
		return weightedPick(rng, weights)
	case SpectralM:
		// Smaller worlds, fewer gas giants
		weights := []int{15, 25, 10, 10, 15, 15, 5, 5}
		return weightedPick(rng, weights)
	default:
		weights := []int{12, 15, 12, 12, 12, 12, 15, 10}
		return weightedPick(rng, weights)
	}
}

func weightedPick(rng *rand.Rand, weights []int) PlanetType {
	total := 0
	for _, w := range weights {
		total += w
	}
	r := rng.Intn(total)
	cum := 0
	for i, w := range weights {
		cum += w
		if r < cum {
			return PlanetType(i)
		}
	}
	return PlanetBarren
}
