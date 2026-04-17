package main

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"io"
	"math"
)

// Binary format:
// Header: magic(4) + version(uint16) + systemCount(uint16) + planetCount(uint32)
//         + hyperlaneCount(uint32) + wormholeCount(uint16)
// Systems: [systemCount] x (x float32, y float32)
// Planets: [planetCount] x (systemID uint16, type uint8, magnitude uint8)
// Hyperlanes: [hyperlaneCount] x (systemA uint16, systemB uint16)
// Wormholes: [wormholeCount] x (systemA uint16, systemB uint16)

const (
	MagicBytes    = "GFMP"
	FormatVersion = 1
)

// MapData holds all data for binary encoding.
type MapData struct {
	Systems    []System
	Planets    []Planet
	Hyperlanes []Hyperlane
	Wormholes  []Wormhole
}

// EncodeBinary writes the map data in binary format.
func EncodeBinary(data *MapData) ([]byte, error) {
	buf := new(bytes.Buffer)

	// Header
	buf.WriteString(MagicBytes)
	binary.Write(buf, binary.LittleEndian, uint16(FormatVersion))
	binary.Write(buf, binary.LittleEndian, uint16(len(data.Systems)))
	binary.Write(buf, binary.LittleEndian, uint32(len(data.Planets)))
	binary.Write(buf, binary.LittleEndian, uint32(len(data.Hyperlanes)))
	binary.Write(buf, binary.LittleEndian, uint16(len(data.Wormholes)))

	// Systems
	for _, s := range data.Systems {
		binary.Write(buf, binary.LittleEndian, s.X)
		binary.Write(buf, binary.LittleEndian, s.Y)
	}

	// Planets
	for _, p := range data.Planets {
		binary.Write(buf, binary.LittleEndian, p.SystemID)
		binary.Write(buf, binary.LittleEndian, p.Type)
		binary.Write(buf, binary.LittleEndian, p.Magnitude)
	}

	// Hyperlanes
	for _, h := range data.Hyperlanes {
		binary.Write(buf, binary.LittleEndian, h.SystemA)
		binary.Write(buf, binary.LittleEndian, h.SystemB)
	}

	// Wormholes
	for _, w := range data.Wormholes {
		binary.Write(buf, binary.LittleEndian, w.SystemA)
		binary.Write(buf, binary.LittleEndian, w.SystemB)
	}

	return buf.Bytes(), nil
}

// DecodeBinary reads binary map data back into a MapData struct.
func DecodeBinary(data []byte) (*MapData, error) {
	r := bytes.NewReader(data)

	// Header
	magic := make([]byte, 4)
	if _, err := io.ReadFull(r, magic); err != nil {
		return nil, fmt.Errorf("read magic: %w", err)
	}
	if string(magic) != MagicBytes {
		return nil, fmt.Errorf("invalid magic: %s", magic)
	}

	var version uint16
	binary.Read(r, binary.LittleEndian, &version)

	var systemCount uint16
	binary.Read(r, binary.LittleEndian, &systemCount)

	var planetCount uint32
	binary.Read(r, binary.LittleEndian, &planetCount)

	var hyperlaneCount uint32
	binary.Read(r, binary.LittleEndian, &hyperlaneCount)

	var wormholeCount uint16
	binary.Read(r, binary.LittleEndian, &wormholeCount)

	result := &MapData{}

	// Systems
	result.Systems = make([]System, systemCount)
	for i := uint16(0); i < systemCount; i++ {
		var x, y float32
		binary.Read(r, binary.LittleEndian, &x)
		binary.Read(r, binary.LittleEndian, &y)
		result.Systems[i] = System{X: x, Y: y}
	}

	// Planets
	result.Planets = make([]Planet, planetCount)
	for i := uint32(0); i < planetCount; i++ {
		var sysID uint16
		var ptype, mag uint8
		binary.Read(r, binary.LittleEndian, &sysID)
		binary.Read(r, binary.LittleEndian, &ptype)
		binary.Read(r, binary.LittleEndian, &mag)
		result.Planets[i] = Planet{SystemID: sysID, Type: PlanetType(ptype), Magnitude: mag}
	}

	// Hyperlanes
	result.Hyperlanes = make([]Hyperlane, hyperlaneCount)
	for i := uint32(0); i < hyperlaneCount; i++ {
		var a, b uint16
		binary.Read(r, binary.LittleEndian, &a)
		binary.Read(r, binary.LittleEndian, &b)
		result.Hyperlanes[i] = Hyperlane{a, b}
	}

	// Wormholes
	result.Wormholes = make([]Wormhole, wormholeCount)
	for i := uint16(0); i < wormholeCount; i++ {
		var a, b uint16
		binary.Read(r, binary.LittleEndian, &a)
		binary.Read(r, binary.LittleEndian, &b)
		result.Wormholes[i] = Wormhole{a, b}
	}

	return result, nil
}

// ScaleMapData creates a copy of MapData with coordinates divided by factor.
func ScaleMapData(original *MapData, factor float32) *MapData {
	scaled := &MapData{
		Systems:    make([]System, len(original.Systems)),
		Planets:    make([]Planet, len(original.Planets)),
		Hyperlanes: make([]Hyperlane, len(original.Hyperlanes)),
		Wormholes:  make([]Wormhole, len(original.Wormholes)),
	}

	for i, s := range original.Systems {
		scaled.Systems[i] = System{
			Name:     s.Name,
			X:        float32(math.Round(float64(s.X/factor)*100) / 100),
			Y:        float32(math.Round(float64(s.Y/factor)*100) / 100),
			Spectral: s.Spectral,
		}
	}
	copy(scaled.Planets, original.Planets)
	copy(scaled.Hyperlanes, original.Hyperlanes)
	copy(scaled.Wormholes, original.Wormholes)

	return scaled
}
