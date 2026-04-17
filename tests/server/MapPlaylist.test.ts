import { describe, it, expect } from "vitest";
import { MapPlaylist, type MapEntry } from "../../src/server/MapPlaylist.js";

const TEST_MAPS: MapEntry[] = [
  { name: "Alpha", mapType: "Standard", teamCount: 1, frequency: 10 },
  { name: "Beta", mapType: "Archipelago", teamCount: 2, frequency: 5 },
  { name: "Gamma", mapType: "Nebula", teamCount: 1, frequency: 3 },
  {
    name: "Delta",
    mapType: "Spiral",
    teamCount: 4,
    frequency: 2,
    modifiers: ["fog"],
  },
  {
    name: "Epsilon",
    mapType: "Pangaea",
    teamCount: 2,
    frequency: 8,
    modifiers: ["turbo"],
  },
  {
    name: "Zeta",
    mapType: "Standard",
    teamCount: 1,
    frequency: 1,
    modifiers: ["fog", "turbo"],
  },
];

describe("MapPlaylist", () => {
  it("returns a map from the playlist", () => {
    const pl = new MapPlaylist(TEST_MAPS);
    const map = pl.next();
    expect(TEST_MAPS.some((m) => m.name === map.name)).toBe(true);
  });

  it("respects frequency weighting", () => {
    const pl = new MapPlaylist(TEST_MAPS);
    const counts: Record<string, number> = {};
    // Use deterministic rng
    let idx = 0;
    const rng = () => {
      idx = (idx + 1) % 100;
      return idx / 100;
    };

    for (let i = 0; i < 1000; i++) {
      const map = pl.next({}, rng);
      counts[map.name] = (counts[map.name] ?? 0) + 1;
    }

    // Alpha (freq 10) should appear more than Zeta (freq 1)
    expect(counts["Alpha"] ?? 0).toBeGreaterThan(counts["Zeta"] ?? 0);
  });

  it("filters by team count", () => {
    const pl = new MapPlaylist(TEST_MAPS);
    for (let i = 0; i < 50; i++) {
      const map = pl.next({ teamCountFilter: 2 });
      expect(map.teamCount).toBe(2);
    }
  });

  it("excludes maps with banned modifiers", () => {
    const pl = new MapPlaylist(TEST_MAPS);
    for (let i = 0; i < 50; i++) {
      const map = pl.next({ excludeModifiers: ["fog"] });
      expect(map.modifiers?.includes("fog") ?? false).toBe(false);
    }
  });

  it("combines team count filter and modifier exclusion", () => {
    const pl = new MapPlaylist(TEST_MAPS);
    for (let i = 0; i < 50; i++) {
      const map = pl.next({
        teamCountFilter: 1,
        excludeModifiers: ["fog"],
      });
      expect(map.teamCount).toBe(1);
      expect(map.name).not.toBe("Zeta"); // Zeta has fog
    }
  });

  it("throws when no maps are eligible", () => {
    const pl = new MapPlaylist(TEST_MAPS);
    expect(() =>
      pl.next({ teamCountFilter: 99 }),
    ).toThrow("No eligible maps");
  });

  it("returns team count distribution", () => {
    const pl = new MapPlaylist(TEST_MAPS);
    const dist = pl.teamCountDistribution();
    expect(dist.get(1)).toBe(3); // Alpha, Gamma, Zeta
    expect(dist.get(2)).toBe(2); // Beta, Epsilon
    expect(dist.get(4)).toBe(1); // Delta
  });

  it("getByTeamCount returns correct subset", () => {
    const pl = new MapPlaylist(TEST_MAPS);
    const ffa = pl.getByTeamCount(1);
    expect(ffa).toHaveLength(3);
    expect(ffa.every((m) => m.teamCount === 1)).toBe(true);
  });

  it("avoids repeating recent maps", () => {
    // Small playlist to force history effect
    const smallMaps: MapEntry[] = [
      { name: "A", mapType: "Standard", teamCount: 1, frequency: 1 },
      { name: "B", mapType: "Standard", teamCount: 1, frequency: 1 },
      { name: "C", mapType: "Standard", teamCount: 1, frequency: 1 },
      { name: "D", mapType: "Standard", teamCount: 1, frequency: 1 },
      { name: "E", mapType: "Standard", teamCount: 1, frequency: 1 },
      { name: "F", mapType: "Standard", teamCount: 1, frequency: 1 },
    ];
    const pl = new MapPlaylist(smallMaps);
    const results: string[] = [];
    // Use rng that always picks the first eligible
    const rng = () => 0;
    for (let i = 0; i < 6; i++) {
      results.push(pl.next({}, rng).name);
    }
    // With history of 5, we should not see immediate repeats
    // First 6 picks with rng=0 should cycle through since history prevents repeats
    const uniqueInFirst5 = new Set(results.slice(0, 5));
    expect(uniqueInFirst5.size).toBe(5);
  });
});
