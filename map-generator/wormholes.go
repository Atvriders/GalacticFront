package main

import (
	"math"
	"math/rand"
)

// Wormhole connects two distant systems.
type Wormhole struct {
	SystemA uint16
	SystemB uint16
}

// PlaceWormholes creates wormhole pairs between distant systems.
// Systems must be >50% of map diameter apart. No duplicate endpoints.
func PlaceWormholes(rng *rand.Rand, systems []System, count int) []Wormhole {
	if len(systems) < 4 || count == 0 {
		return nil
	}

	// Compute map diameter
	diameter := mapDiameter(systems)
	minDist := diameter * 0.5

	// Find all valid pairs (distant enough)
	type pair struct{ a, b uint16 }
	var candidates []pair
	for i := 0; i < len(systems); i++ {
		for j := i + 1; j < len(systems); j++ {
			d := dist(systems[i], systems[j])
			if d >= minDist {
				candidates = append(candidates, pair{uint16(i), uint16(j)})
			}
		}
	}

	// Shuffle and pick, ensuring no endpoint reuse
	rng.Shuffle(len(candidates), func(i, j int) {
		candidates[i], candidates[j] = candidates[j], candidates[i]
	})

	used := make(map[uint16]bool)
	var wormholes []Wormhole

	for _, c := range candidates {
		if len(wormholes) >= count {
			break
		}
		if used[c.a] || used[c.b] {
			continue
		}
		used[c.a] = true
		used[c.b] = true
		wormholes = append(wormholes, Wormhole{c.a, c.b})
	}

	return wormholes
}

func mapDiameter(systems []System) float64 {
	if len(systems) == 0 {
		return 0
	}
	minX, maxX := float64(systems[0].X), float64(systems[0].X)
	minY, maxY := float64(systems[0].Y), float64(systems[0].Y)
	for _, s := range systems[1:] {
		x, y := float64(s.X), float64(s.Y)
		if x < minX {
			minX = x
		}
		if x > maxX {
			maxX = x
		}
		if y < minY {
			minY = y
		}
		if y > maxY {
			maxY = y
		}
	}
	dx := maxX - minX
	dy := maxY - minY
	return math.Sqrt(dx*dx + dy*dy)
}
