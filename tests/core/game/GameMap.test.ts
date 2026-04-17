import { describe, it, expect, beforeEach } from "vitest";
import {
  GameMap,
  NO_OWNER,
  MAX_OWNER_ID,
  TERRAIN_MASK,
  PLANET_TYPE_MASK,
  PLANET_TYPE_SHIFT,
  OWNER_MASK,
  SCORCHED_BIT,
  SHIELD_BIT,
} from "../../../src/core/game/GameMap";
import { TerrainType, PlanetType } from "../../../src/core/game/Types";

describe("GameMap — construction & dimensions", () => {
  it("stores width and height", () => {
    const map = new GameMap(10, 20);
    expect(map.width).toBe(10);
    expect(map.height).toBe(20);
  });

  it("allocates typed arrays of correct size", () => {
    const map = new GameMap(4, 5);
    expect(map.terrain.length).toBe(20);
    expect(map.state.length).toBe(20);
    expect(map.magnitude.length).toBe(20);
  });

  it("initialises every tile to Space / unowned / magnitude 0", () => {
    const map = new GameMap(3, 3);
    for (let i = 0; i < 9; i++) {
      expect(map.getTerrainType(i)).toBe(TerrainType.Space);
      expect(map.getOwner(i)).toBe(NO_OWNER);
      expect(map.getMagnitude(i)).toBe(0);
    }
  });
});

describe("GameMap — coordinate helpers", () => {
  const map = new GameMap(8, 6);

  it("toIndex / fromIndex round-trip", () => {
    expect(map.toIndex(0, 0)).toBe(0);
    expect(map.toIndex(7, 5)).toBe(47);
    expect(map.fromIndex(0)).toEqual({ x: 0, y: 0 });
    expect(map.fromIndex(47)).toEqual({ x: 7, y: 5 });

    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 8; x++) {
        const idx = map.toIndex(x, y);
        expect(map.fromIndex(idx)).toEqual({ x, y });
      }
    }
  });

  it("isInBounds returns true for valid coords", () => {
    expect(map.isInBounds(0, 0)).toBe(true);
    expect(map.isInBounds(7, 5)).toBe(true);
    expect(map.isInBounds(4, 3)).toBe(true);
  });

  it("isInBounds returns false for out-of-range coords", () => {
    expect(map.isInBounds(-1, 0)).toBe(false);
    expect(map.isInBounds(0, -1)).toBe(false);
    expect(map.isInBounds(8, 0)).toBe(false);
    expect(map.isInBounds(0, 6)).toBe(false);
  });

  it("isValidTile returns true for valid indices", () => {
    expect(map.isValidTile(0)).toBe(true);
    expect(map.isValidTile(47)).toBe(true);
  });

  it("isValidTile returns false for out-of-range indices", () => {
    expect(map.isValidTile(-1)).toBe(false);
    expect(map.isValidTile(48)).toBe(false);
  });
});

describe("GameMap — terrain type", () => {
  let map: GameMap;
  beforeEach(() => { map = new GameMap(5, 5); });

  it("sets and gets all TerrainType values", () => {
    const tile = map.toIndex(2, 2);
    for (const type of [TerrainType.Space, TerrainType.Asteroid, TerrainType.Nebula, TerrainType.Planet]) {
      map.setTerrainType(tile, type);
      expect(map.getTerrainType(tile)).toBe(type);
    }
  });

  it("does not corrupt bits 2-7 when setting terrain type", () => {
    const tile = 0;
    // Set planet type first so upper bits are non-zero
    map.setTerrainType(tile, TerrainType.Planet);
    map.setPlanetType(tile, PlanetType.Volcanic); // 3 => bits 3-4
    map.setTerrainType(tile, TerrainType.Asteroid);
    expect(map.getPlanetType(tile)).toBe(PlanetType.Volcanic);
  });
});

describe("GameMap — planet type packing", () => {
  let map: GameMap;
  beforeEach(() => { map = new GameMap(5, 5); });

  it("sets and gets all PlanetType values (0-7) without corruption", () => {
    const tile = map.toIndex(1, 1);
    map.setTerrainType(tile, TerrainType.Planet);
    const types = [
      PlanetType.Barren,
      PlanetType.Terran,
      PlanetType.Oceanic,
      PlanetType.Volcanic,
      PlanetType.GasGiant,
      PlanetType.Ice,
      PlanetType.Desert,
      PlanetType.Nebula,
    ];
    for (const pt of types) {
      map.setPlanetType(tile, pt);
      expect(map.getPlanetType(tile)).toBe(pt);
      // terrain type should still be Planet (bits 0-1 intact)
      expect(map.getTerrainType(tile)).toBe(TerrainType.Planet);
    }
  });
});

describe("GameMap — magnitude", () => {
  let map: GameMap;
  beforeEach(() => { map = new GameMap(5, 5); });

  it("stores values 0-31", () => {
    const tile = 0;
    for (let m = 0; m <= 31; m++) {
      map.setMagnitude(tile, m);
      expect(map.getMagnitude(tile)).toBe(m);
    }
  });

  it("wraps at 32 (5 bits)", () => {
    const tile = 0;
    map.setMagnitude(tile, 32); // 32 & 0x1f === 0
    expect(map.getMagnitude(tile)).toBe(0);
    map.setMagnitude(tile, 33); // 33 & 0x1f === 1
    expect(map.getMagnitude(tile)).toBe(1);
  });
});

describe("GameMap — isPlanet / isTraversable", () => {
  let map: GameMap;
  beforeEach(() => { map = new GameMap(3, 3); });

  it("isPlanet is true only when TerrainType is Planet", () => {
    const tile = 0;
    map.setTerrainType(tile, TerrainType.Space);
    expect(map.isPlanet(tile)).toBe(false);
    map.setTerrainType(tile, TerrainType.Planet);
    expect(map.isPlanet(tile)).toBe(true);
  });

  it("isTraversable is false only for Asteroid", () => {
    const tile = 0;
    for (const t of [TerrainType.Space, TerrainType.Nebula, TerrainType.Planet]) {
      map.setTerrainType(tile, t);
      expect(map.isTraversable(tile)).toBe(true);
    }
    map.setTerrainType(tile, TerrainType.Asteroid);
    expect(map.isTraversable(tile)).toBe(false);
  });
});

describe("GameMap — owner", () => {
  let map: GameMap;
  beforeEach(() => { map = new GameMap(5, 5); });

  it("getOwner defaults to NO_OWNER (0)", () => {
    expect(map.getOwner(0)).toBe(NO_OWNER);
  });

  it("setOwner / getOwner round-trip", () => {
    const tile = 3;
    map.setOwner(tile, 1);
    expect(map.getOwner(tile)).toBe(1);
    map.setOwner(tile, 42);
    expect(map.getOwner(tile)).toBe(42);
  });

  it("supports max owner id (4095)", () => {
    const tile = 0;
    map.setOwner(tile, MAX_OWNER_ID);
    expect(map.getOwner(tile)).toBe(MAX_OWNER_ID);
  });

  it("isOwned / isOwnedBy", () => {
    const tile = 0;
    expect(map.isOwned(tile)).toBe(false);
    map.setOwner(tile, 7);
    expect(map.isOwned(tile)).toBe(true);
    expect(map.isOwnedBy(tile, 7)).toBe(true);
    expect(map.isOwnedBy(tile, 8)).toBe(false);
  });
});

describe("GameMap — scorched / shield flags", () => {
  let map: GameMap;
  beforeEach(() => { map = new GameMap(5, 5); });

  it("scorched defaults to false", () => {
    expect(map.isScorched(0)).toBe(false);
  });

  it("setScorched true/false toggles correctly", () => {
    const tile = 0;
    map.setScorched(tile, true);
    expect(map.isScorched(tile)).toBe(true);
    map.setScorched(tile, false);
    expect(map.isScorched(tile)).toBe(false);
  });

  it("shield defaults to false", () => {
    expect(map.isShielded(0)).toBe(false);
  });

  it("setShielded true/false toggles correctly", () => {
    const tile = 0;
    map.setShielded(tile, true);
    expect(map.isShielded(tile)).toBe(true);
    map.setShielded(tile, false);
    expect(map.isShielded(tile)).toBe(false);
  });

  it("scorched and shield bits are independent of owner bits", () => {
    const tile = 0;
    map.setOwner(tile, 500);
    map.setScorched(tile, true);
    map.setShielded(tile, true);
    expect(map.getOwner(tile)).toBe(500);
    expect(map.isScorched(tile)).toBe(true);
    expect(map.isShielded(tile)).toBe(true);
    // clear shield, owner and scorched should not change
    map.setShielded(tile, false);
    expect(map.getOwner(tile)).toBe(500);
    expect(map.isScorched(tile)).toBe(true);
    expect(map.isShielded(tile)).toBe(false);
  });

  it("scorched and shield bits are independent of each other", () => {
    const tile = 0;
    map.setScorched(tile, true);
    expect(map.isShielded(tile)).toBe(false);
    map.setShielded(tile, true);
    expect(map.isScorched(tile)).toBe(true);
    map.setScorched(tile, false);
    expect(map.isShielded(tile)).toBe(true);
  });
});

describe("GameMap — getNeighbors4", () => {
  const map = new GameMap(5, 5);

  it("center tile has 4 neighbors", () => {
    const tile = map.toIndex(2, 2);
    const n = map.getNeighbors4(tile);
    expect(n).toHaveLength(4);
    expect(n).toContain(map.toIndex(2, 1)); // N
    expect(n).toContain(map.toIndex(3, 2)); // E
    expect(n).toContain(map.toIndex(2, 3)); // S
    expect(n).toContain(map.toIndex(1, 2)); // W
  });

  it("corner tile (0,0) has 2 neighbors", () => {
    const tile = map.toIndex(0, 0);
    const n = map.getNeighbors4(tile);
    expect(n).toHaveLength(2);
    expect(n).toContain(map.toIndex(1, 0)); // E
    expect(n).toContain(map.toIndex(0, 1)); // S
  });

  it("corner tile (4,4) has 2 neighbors", () => {
    const tile = map.toIndex(4, 4);
    const n = map.getNeighbors4(tile);
    expect(n).toHaveLength(2);
    expect(n).toContain(map.toIndex(4, 3)); // N
    expect(n).toContain(map.toIndex(3, 4)); // W
  });
});

describe("GameMap — getNeighbors8", () => {
  const map = new GameMap(5, 5);

  it("center tile has 8 neighbors", () => {
    const tile = map.toIndex(2, 2);
    expect(map.getNeighbors8(tile)).toHaveLength(8);
  });

  it("corner tile (0,0) has 3 neighbors", () => {
    const tile = map.toIndex(0, 0);
    const n = map.getNeighbors8(tile);
    expect(n).toHaveLength(3);
    expect(n).toContain(map.toIndex(1, 0));
    expect(n).toContain(map.toIndex(0, 1));
    expect(n).toContain(map.toIndex(1, 1));
  });

  it("corner tile (4,4) has 3 neighbors", () => {
    const tile = map.toIndex(4, 4);
    const n = map.getNeighbors8(tile);
    expect(n).toHaveLength(3);
  });
});

describe("GameMap — setPlanet bulk helper", () => {
  it("sets terrain to Planet, type, and magnitude atomically", () => {
    const map = new GameMap(3, 3);
    const tile = map.toIndex(1, 1);
    map.setPlanet(tile, PlanetType.Oceanic, 15);
    expect(map.isPlanet(tile)).toBe(true);
    expect(map.getPlanetType(tile)).toBe(PlanetType.Oceanic);
    expect(map.getMagnitude(tile)).toBe(15);
  });
});

describe("GameMap — packTile / unpackTile round-trip", () => {
  it("preserves terrain, state, and magnitude through pack/unpack", () => {
    const src = new GameMap(5, 5);
    const dst = new GameMap(5, 5);
    const tile = map_toIndex(src, 2, 3);

    src.setTerrainType(tile, TerrainType.Planet);
    src.setPlanetType(tile, PlanetType.GasGiant);
    src.setMagnitude(tile, 20);
    src.setOwner(tile, 3000);
    src.setScorched(tile, true);
    src.setShielded(tile, true);

    const packed = src.packTile(tile);
    dst.unpackTile(tile, packed);

    expect(dst.getTerrainType(tile)).toBe(TerrainType.Planet);
    expect(dst.getPlanetType(tile)).toBe(PlanetType.GasGiant);
    expect(dst.getMagnitude(tile)).toBe(20);
    expect(dst.getOwner(tile)).toBe(3000);
    expect(dst.isScorched(tile)).toBe(true);
    expect(dst.isShielded(tile)).toBe(true);
  });

  function map_toIndex(m: GameMap, x: number, y: number): number {
    return m.toIndex(x, y);
  }
});

describe("GameMap — countOwnedBy / getTilesOwnedBy", () => {
  it("counts tiles owned by a specific player", () => {
    const map = new GameMap(4, 4);
    map.setOwner(map.toIndex(0, 0), 1);
    map.setOwner(map.toIndex(1, 0), 1);
    map.setOwner(map.toIndex(2, 0), 2);
    expect(map.countOwnedBy(1)).toBe(2);
    expect(map.countOwnedBy(2)).toBe(1);
    expect(map.countOwnedBy(3)).toBe(0);
  });

  it("NO_OWNER count matches unowned tiles", () => {
    const map = new GameMap(2, 2); // 4 tiles
    map.setOwner(0, 5);
    expect(map.countOwnedBy(NO_OWNER)).toBe(3);
  });

  it("getTilesOwnedBy returns correct tile indices", () => {
    const map = new GameMap(4, 4);
    const t0 = map.toIndex(0, 0);
    const t1 = map.toIndex(3, 3);
    map.setOwner(t0, 99);
    map.setOwner(t1, 99);
    const tiles = map.getTilesOwnedBy(99);
    expect(tiles).toHaveLength(2);
    expect(tiles).toContain(t0);
    expect(tiles).toContain(t1);
  });

  it("getTilesOwnedBy returns empty array for player with no tiles", () => {
    const map = new GameMap(3, 3);
    expect(map.getTilesOwnedBy(7)).toEqual([]);
  });
});

describe("GameMap — exported constants", () => {
  it("NO_OWNER is 0", () => expect(NO_OWNER).toBe(0));
  it("MAX_OWNER_ID is 4095", () => expect(MAX_OWNER_ID).toBe(4095));
  it("TERRAIN_MASK is 0b11", () => expect(TERRAIN_MASK).toBe(0b11));
  it("PLANET_TYPE_MASK is 0b00011100", () => expect(PLANET_TYPE_MASK).toBe(0b00011100));
  it("PLANET_TYPE_SHIFT is 2", () => expect(PLANET_TYPE_SHIFT).toBe(2));
  it("OWNER_MASK is 0x0fff", () => expect(OWNER_MASK).toBe(0x0fff));
  it("SCORCHED_BIT is 1<<12", () => expect(SCORCHED_BIT).toBe(1 << 12));
  it("SHIELD_BIT is 1<<13", () => expect(SHIELD_BIT).toBe(1 << 13));
});
