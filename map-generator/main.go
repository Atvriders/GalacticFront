package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"strings"
)

// MapConfig defines parameters for a map preset.
type MapConfig struct {
	Name           string
	SystemCount    int
	HyperlaneMax   int     // max neighbors per system
	HyperlaneThresh float64 // max distance for hyperlane
	WormholeCount  int
}

// Map presets registry.
var MapPresets = map[string]MapConfig{
	"sector": {
		Name:            "sector",
		SystemCount:     80,
		HyperlaneMax:    4,
		HyperlaneThresh: 150.0,
		WormholeCount:   4,
	},
	"arm": {
		Name:            "arm",
		SystemCount:     300,
		HyperlaneMax:    5,
		HyperlaneThresh: 120.0,
		WormholeCount:   6,
	},
	"galaxy": {
		Name:            "galaxy",
		SystemCount:     1500,
		HyperlaneMax:    5,
		HyperlaneThresh: 80.0,
		WormholeCount:   8,
	},
}

func main() {
	maps := flag.String("maps", "sector", "Comma-separated map presets to generate: sector,arm,galaxy")
	logLevel := flag.String("log-level", "info", "Log level: debug, info, warn, error")
	outputDir := flag.String("output-dir", "output", "Output directory for generated maps")
	flag.Parse()

	_ = logLevel // used by generator

	presetNames := strings.Split(*maps, ",")
	for _, name := range presetNames {
		name = strings.TrimSpace(name)
		preset, ok := MapPresets[name]
		if !ok {
			fmt.Fprintf(os.Stderr, "Unknown map preset: %s\n", name)
			os.Exit(1)
		}

		log.Printf("[%s] Generating map with %d systems...", preset.Name, preset.SystemCount)
		err := Generate(preset, *outputDir, *logLevel)
		if err != nil {
			log.Fatalf("Failed to generate map %s: %v", preset.Name, err)
		}
		log.Printf("[%s] Done.", preset.Name)
	}
}
