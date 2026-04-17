package main

import "fmt"

// ValidationError collects all validation failures.
type ValidationError struct {
	Errors []string
}

func (v *ValidationError) Error() string {
	return fmt.Sprintf("%d validation errors", len(v.Errors))
}

func (v *ValidationError) Add(msg string) {
	v.Errors = append(v.Errors, msg)
}

// ValidateMap checks map data for correctness.
func ValidateMap(data *MapData) error {
	ve := &ValidationError{}

	// Check planet counts per system are in range (2-12)
	systemPlanetCount := make(map[uint16]int)
	for _, p := range data.Planets {
		systemPlanetCount[p.SystemID]++
		// Check magnitude in 0-31
		if p.Magnitude > 31 {
			ve.Add(fmt.Sprintf("planet in system %d has magnitude %d (>31)", p.SystemID, p.Magnitude))
		}
		// Check planet type in 0-7
		if p.Type > 7 {
			ve.Add(fmt.Sprintf("planet in system %d has invalid type %d", p.SystemID, p.Type))
		}
		// Check system ID is valid
		if int(p.SystemID) >= len(data.Systems) {
			ve.Add(fmt.Sprintf("planet references invalid system %d", p.SystemID))
		}
	}

	for sysID, count := range systemPlanetCount {
		if count < 2 || count > 12 {
			ve.Add(fmt.Sprintf("system %d has %d planets (expected 2-12)", sysID, count))
		}
	}

	// Check all systems have planets
	for i := range data.Systems {
		if systemPlanetCount[uint16(i)] == 0 {
			ve.Add(fmt.Sprintf("system %d has no planets", i))
		}
	}

	// Check hyperlane references
	for _, h := range data.Hyperlanes {
		if int(h.SystemA) >= len(data.Systems) || int(h.SystemB) >= len(data.Systems) {
			ve.Add(fmt.Sprintf("hyperlane references invalid system: %d-%d", h.SystemA, h.SystemB))
		}
	}

	// Check wormhole references — no duplicate endpoints
	wormholeEndpoints := make(map[uint16]bool)
	for _, w := range data.Wormholes {
		if int(w.SystemA) >= len(data.Systems) || int(w.SystemB) >= len(data.Systems) {
			ve.Add(fmt.Sprintf("wormhole references invalid system: %d-%d", w.SystemA, w.SystemB))
		}
		if wormholeEndpoints[w.SystemA] {
			ve.Add(fmt.Sprintf("duplicate wormhole endpoint: system %d", w.SystemA))
		}
		if wormholeEndpoints[w.SystemB] {
			ve.Add(fmt.Sprintf("duplicate wormhole endpoint: system %d", w.SystemB))
		}
		wormholeEndpoints[w.SystemA] = true
		wormholeEndpoints[w.SystemB] = true
	}

	// Check connectivity via BFS (all systems reachable via hyperlanes)
	if len(data.Systems) > 0 {
		adj := make(map[uint16][]uint16)
		for _, h := range data.Hyperlanes {
			adj[h.SystemA] = append(adj[h.SystemA], h.SystemB)
			adj[h.SystemB] = append(adj[h.SystemB], h.SystemA)
		}

		visited := make([]bool, len(data.Systems))
		queue := []uint16{0}
		visited[0] = true
		count := 1

		for len(queue) > 0 {
			node := queue[0]
			queue = queue[1:]
			for _, nb := range adj[node] {
				if !visited[nb] {
					visited[nb] = true
					count++
					queue = append(queue, nb)
				}
			}
		}

		if count != len(data.Systems) {
			ve.Add(fmt.Sprintf("only %d/%d systems reachable via hyperlanes", count, len(data.Systems)))
		}
	}

	if len(ve.Errors) > 0 {
		return ve
	}
	return nil
}
