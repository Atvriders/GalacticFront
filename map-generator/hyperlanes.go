package main

import (
	"math"
	"sort"
)

// Hyperlane connects two systems.
type Hyperlane struct {
	SystemA uint16
	SystemB uint16
}

// System represents a star system with position.
type System struct {
	Name     string
	X, Y     float32
	Spectral SpectralType
}

// ComputeHyperlanes connects each system to its nearest neighbors, then
// ensures full connectivity via BFS.
func ComputeHyperlanes(systems []System, maxNeighbors int, threshold float64) []Hyperlane {
	n := len(systems)
	edgeSet := make(map[[2]uint16]bool)

	addEdge := func(a, b uint16) {
		if a > b {
			a, b = b, a
		}
		edgeSet[[2]uint16{a, b}] = true
	}

	// For each system, connect to nearest neighbors
	for i := 0; i < n; i++ {
		type distIdx struct {
			dist float64
			idx  int
		}
		neighbors := make([]distIdx, 0, n-1)
		for j := 0; j < n; j++ {
			if i == j {
				continue
			}
			d := dist(systems[i], systems[j])
			if d <= threshold {
				neighbors = append(neighbors, distIdx{d, j})
			}
		}
		sort.Slice(neighbors, func(a, b int) bool {
			return neighbors[a].dist < neighbors[b].dist
		})
		limit := maxNeighbors
		if limit > len(neighbors) {
			limit = len(neighbors)
		}
		for k := 0; k < limit; k++ {
			addEdge(uint16(i), uint16(neighbors[k].idx))
		}
	}

	// Ensure connectivity via BFS
	ensureConnectivity(systems, edgeSet)

	// Convert to slice
	lanes := make([]Hyperlane, 0, len(edgeSet))
	for e := range edgeSet {
		lanes = append(lanes, Hyperlane{e[0], e[1]})
	}
	return lanes
}

func dist(a, b System) float64 {
	dx := float64(a.X - b.X)
	dy := float64(a.Y - b.Y)
	return math.Sqrt(dx*dx + dy*dy)
}

// ensureConnectivity finds disconnected components and adds minimum edges to connect them.
func ensureConnectivity(systems []System, edgeSet map[[2]uint16]bool) {
	n := len(systems)
	if n == 0 {
		return
	}

	// Build adjacency list
	adj := make(map[uint16][]uint16)
	for e := range edgeSet {
		adj[e[0]] = append(adj[e[0]], e[1])
		adj[e[1]] = append(adj[e[1]], e[0])
	}

	// BFS to find components
	visited := make([]bool, n)
	var components [][]uint16

	for i := 0; i < n; i++ {
		if visited[i] {
			continue
		}
		var comp []uint16
		queue := []uint16{uint16(i)}
		visited[i] = true
		for len(queue) > 0 {
			node := queue[0]
			queue = queue[1:]
			comp = append(comp, node)
			for _, nb := range adj[node] {
				if !visited[nb] {
					visited[nb] = true
					queue = append(queue, nb)
				}
			}
		}
		components = append(components, comp)
	}

	// Connect components by finding nearest pair between consecutive components
	for i := 1; i < len(components); i++ {
		bestDist := math.MaxFloat64
		var bestA, bestB uint16
		for _, a := range components[0] {
			for _, b := range components[i] {
				d := dist(systems[a], systems[b])
				if d < bestDist {
					bestDist = d
					bestA = a
					bestB = b
				}
			}
		}
		if bestA > bestB {
			bestA, bestB = bestB, bestA
		}
		edgeSet[[2]uint16{bestA, bestB}] = true
		// Merge component i into component 0
		components[0] = append(components[0], components[i]...)
	}
}
