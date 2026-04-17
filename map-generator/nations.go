package main

import "math"

// Nation represents a faction with a spawn location.
type Nation struct {
	Name     string
	SpawnX   float32
	SpawnY   float32
	SystemID uint16 // nearest system to spawn point
}

// FactionDef defines a faction and its desired spawn region.
type FactionDef struct {
	Name    string
	RegionX float64 // normalized -1..1 (relative to map center)
	RegionY float64
}

var Factions = []FactionDef{
	{"Solar Federation", 0.0, 0.0},       // Near Sol/center
	{"Zyr'kathi Dominion", 0.0, 0.0},     // Near center (contested)
	{"Crystalline Collective", -0.7, 0.7}, // Upper-left quadrant
	{"Void Reavers", 0.8, -0.6},          // Lower-right
	{"Aetherian Concord", -0.5, -0.7},    // Lower-left
	{"Iron Pact", 0.6, 0.5},              // Upper-right
	{"Nebula Cartel", -0.3, 0.9},         // Top
	{"Scythe Collective", 0.9, 0.0},      // Far right
	{"Luminari Order", -0.9, 0.0},        // Far left
	{"Duskborn Tribes", 0.0, -0.9},       // Bottom
	{"Starweavers Guild", 0.4, -0.3},     // Slight lower-right
}

// PlaceNations assigns each faction to the nearest system to its desired region.
func PlaceNations(systems []System) []Nation {
	if len(systems) == 0 {
		return nil
	}

	// Compute map bounds
	minX, maxX := float64(systems[0].X), float64(systems[0].X)
	minY, maxY := float64(systems[0].Y), float64(systems[0].Y)
	for _, s := range systems[1:] {
		x, y := float64(s.X), float64(s.Y)
		if x < minX { minX = x }
		if x > maxX { maxX = x }
		if y < minY { minY = y }
		if y > maxY { maxY = y }
	}
	cx := (minX + maxX) / 2
	cy := (minY + maxY) / 2
	halfW := (maxX - minX) / 2
	halfH := (maxY - minY) / 2
	if halfW == 0 { halfW = 1 }
	if halfH == 0 { halfH = 1 }

	// Special: Solar Federation should prefer the system named "Sol"
	solIdx := -1
	for i, s := range systems {
		if s.Name == "Sol" {
			solIdx = i
			break
		}
	}

	usedSystems := make(map[uint16]bool)
	nations := make([]Nation, 0, len(Factions))

	for _, f := range Factions {
		targetX := cx + f.RegionX*halfW
		targetY := cy + f.RegionY*halfH

		// Solar Federation gets Sol if available
		if f.Name == "Solar Federation" && solIdx >= 0 && !usedSystems[uint16(solIdx)] {
			usedSystems[uint16(solIdx)] = true
			nations = append(nations, Nation{
				Name:     f.Name,
				SpawnX:   systems[solIdx].X,
				SpawnY:   systems[solIdx].Y,
				SystemID: uint16(solIdx),
			})
			continue
		}

		// Find nearest unused system
		bestDist := math.MaxFloat64
		bestIdx := 0
		for i, s := range systems {
			if usedSystems[uint16(i)] {
				continue
			}
			dx := float64(s.X) - targetX
			dy := float64(s.Y) - targetY
			d := math.Sqrt(dx*dx + dy*dy)
			if d < bestDist {
				bestDist = d
				bestIdx = i
			}
		}

		usedSystems[uint16(bestIdx)] = true
		nations = append(nations, Nation{
			Name:     f.Name,
			SpawnX:   systems[bestIdx].X,
			SpawnY:   systems[bestIdx].Y,
			SystemID: uint16(bestIdx),
		})
	}

	return nations
}
