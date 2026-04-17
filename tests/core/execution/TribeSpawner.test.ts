import { describe, it, expect } from "vitest";
import { PseudoRandom } from "@core/PseudoRandom";
import {
  generateTribeName,
  generateTribeNames,
  findSpawnTile,
  PREFIXES,
  SUFFIXES,
} from "@core/execution/TribeSpawner";

describe("TribeSpawner", () => {
  describe("generateTribeName", () => {
    it("produces a non-empty name", () => {
      const rng = new PseudoRandom("name-test");
      const name = generateTribeName(rng);
      expect(name.length).toBeGreaterThan(0);
    });

    it("name is prefix+suffix", () => {
      const rng = new PseudoRandom("name-test-2");
      const name = generateTribeName(rng);
      const matchesPrefix = PREFIXES.some((p) => name.startsWith(p));
      const matchesSuffix = SUFFIXES.some((s) => name.endsWith(s));
      expect(matchesPrefix).toBe(true);
      expect(matchesSuffix).toBe(true);
    });
  });

  describe("generateTribeNames", () => {
    it("returns requested count", () => {
      const rng = new PseudoRandom("names-1");
      const names = generateTribeNames(5, rng);
      expect(names).toHaveLength(5);
    });

    it("all names are unique", () => {
      const rng = new PseudoRandom("names-2");
      const names = generateTribeNames(20, rng);
      expect(new Set(names).size).toBe(names.length);
    });

    it("handles large count (> unique combos)", () => {
      const maxUnique = PREFIXES.length * SUFFIXES.length;
      const rng = new PseudoRandom("names-large");
      const names = generateTribeNames(maxUnique + 5, rng);
      expect(names.length).toBeGreaterThanOrEqual(maxUnique);
    });
  });

  describe("findSpawnTile", () => {
    it("finds a valid tile", () => {
      const rng = new PseudoRandom("spawn-1");
      const tile = findSpawnTile(20, 20, (t) => t > 50, rng);
      expect(tile).toBeGreaterThan(50);
    });

    it("returns -1 when no valid tile exists", () => {
      const rng = new PseudoRandom("spawn-2");
      const tile = findSpawnTile(5, 5, () => false, rng);
      expect(tile).toBe(-1);
    });

    it("respects validation function", () => {
      const rng = new PseudoRandom("spawn-3");
      // Only tile 42 is valid
      const tile = findSpawnTile(20, 20, (t) => t === 42, rng);
      expect(tile).toBe(42);
    });
  });

  describe("constants", () => {
    it("has 15 prefixes", () => {
      expect(PREFIXES).toHaveLength(15);
    });

    it("has 15 suffixes", () => {
      expect(SUFFIXES).toHaveLength(15);
    });
  });
});
