import { describe, it, expect } from "vitest";
import { PseudoRandom } from "@core/PseudoRandom";

describe("PseudoRandom", () => {
  describe("determinism", () => {
    it("produces the same sequence for the same seed", () => {
      const rng1 = new PseudoRandom("abc");
      const rng2 = new PseudoRandom("abc");
      for (let i = 0; i < 20; i++) {
        expect(rng1.next()).toBe(rng2.next());
      }
    });

    it("produces different sequences for different seeds", () => {
      const rng1 = new PseudoRandom("seed-a");
      const rng2 = new PseudoRandom("seed-b");
      const seq1 = Array.from({ length: 10 }, () => rng1.next());
      const seq2 = Array.from({ length: 10 }, () => rng2.next());
      expect(seq1).not.toEqual(seq2);
    });

    it("accepts numeric seeds", () => {
      const rng1 = new PseudoRandom(42);
      const rng2 = new PseudoRandom(42);
      expect(rng1.next()).toBe(rng2.next());
    });
  });

  describe("next()", () => {
    it("returns values in [0, 1)", () => {
      const rng = new PseudoRandom("test-next");
      for (let i = 0; i < 100; i++) {
        const v = rng.next();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    });
  });

  describe("nextInt()", () => {
    it("returns integers in [min, max] inclusive", () => {
      const rng = new PseudoRandom("test-int");
      const min = 3;
      const max = 7;
      const seen = new Set<number>();
      for (let i = 0; i < 200; i++) {
        const v = rng.nextInt(min, max);
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(min);
        expect(v).toBeLessThanOrEqual(max);
        seen.add(v);
      }
      // All values in range should eventually appear
      for (let v = min; v <= max; v++) {
        expect(seen.has(v)).toBe(true);
      }
    });

    it("handles min === max", () => {
      const rng = new PseudoRandom("test-int-eq");
      for (let i = 0; i < 10; i++) {
        expect(rng.nextInt(5, 5)).toBe(5);
      }
    });
  });

  describe("chance()", () => {
    it("returns boolean", () => {
      const rng = new PseudoRandom("test-chance");
      const v = rng.chance(0.5);
      expect(typeof v).toBe("boolean");
    });

    it("chance(0) always false", () => {
      const rng = new PseudoRandom("test-chance-0");
      for (let i = 0; i < 20; i++) {
        expect(rng.chance(0)).toBe(false);
      }
    });

    it("chance(1) always true", () => {
      const rng = new PseudoRandom("test-chance-1");
      for (let i = 0; i < 20; i++) {
        expect(rng.chance(1)).toBe(true);
      }
    });

    it("roughly correct frequency at 0.5", () => {
      const rng = new PseudoRandom("test-chance-freq");
      let trueCount = 0;
      const N = 1000;
      for (let i = 0; i < N; i++) {
        if (rng.chance(0.5)) trueCount++;
      }
      // With a fixed seed this is deterministic; just ensure it's reasonable
      expect(trueCount).toBeGreaterThan(400);
      expect(trueCount).toBeLessThan(600);
    });
  });

  describe("shuffle()", () => {
    it("returns the same array reference", () => {
      const rng = new PseudoRandom("test-shuffle");
      const arr = [1, 2, 3, 4, 5];
      const result = rng.shuffle(arr);
      expect(result).toBe(arr);
    });

    it("preserves all elements", () => {
      const rng = new PseudoRandom("test-shuffle-elems");
      const original = [1, 2, 3, 4, 5, 6, 7, 8];
      const arr = [...original];
      rng.shuffle(arr);
      expect(arr.sort((a, b) => a - b)).toEqual(original);
    });

    it("produces a different order with sufficient elements", () => {
      const rng = new PseudoRandom("test-shuffle-order");
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const original = [...arr];
      rng.shuffle(arr);
      // Very unlikely to be identical after shuffle of 10 elements
      expect(arr).not.toEqual(original);
    });

    it("all positions are covered across many shuffles", () => {
      // Check that each element can end up at each position
      const N = 200;
      const size = 5;
      const positionCoverage: Set<number>[] = Array.from({ length: size }, () => new Set());
      for (let i = 0; i < N; i++) {
        const rng = new PseudoRandom(`shuffle-cov-${i}`);
        const arr = [0, 1, 2, 3, 4];
        rng.shuffle(arr);
        arr.forEach((v, pos) => positionCoverage[pos]!.add(v));
      }
      for (let pos = 0; pos < size; pos++) {
        expect(positionCoverage[pos]!.size).toBe(size);
      }
    });

    it("handles empty array", () => {
      const rng = new PseudoRandom("test-shuffle-empty");
      expect(rng.shuffle([])).toEqual([]);
    });

    it("handles single element array", () => {
      const rng = new PseudoRandom("test-shuffle-one");
      expect(rng.shuffle([42])).toEqual([42]);
    });
  });

  describe("pick()", () => {
    it("returns an element from the array", () => {
      const rng = new PseudoRandom("test-pick");
      const arr = [10, 20, 30, 40];
      for (let i = 0; i < 20; i++) {
        expect(arr).toContain(rng.pick(arr));
      }
    });

    it("throws on empty array", () => {
      const rng = new PseudoRandom("test-pick-empty");
      expect(() => rng.pick([])).toThrow();
    });

    it("returns the only element when array has one element", () => {
      const rng = new PseudoRandom("test-pick-one");
      expect(rng.pick(["only"])).toBe("only");
    });

    it("can pick all elements over many calls", () => {
      const rng = new PseudoRandom("test-pick-coverage");
      const arr = [1, 2, 3, 4, 5];
      const seen = new Set<number>();
      for (let i = 0; i < 200; i++) {
        seen.add(rng.pick(arr));
      }
      expect(seen.size).toBe(arr.length);
    });
  });

  describe("nextFloat()", () => {
    it("returns values in [min, max)", () => {
      const rng = new PseudoRandom("test-float");
      const min = 2.5;
      const max = 7.5;
      for (let i = 0; i < 100; i++) {
        const v = rng.nextFloat(min, max);
        expect(v).toBeGreaterThanOrEqual(min);
        expect(v).toBeLessThan(max);
      }
    });

    it("is deterministic", () => {
      const rng1 = new PseudoRandom("float-det");
      const rng2 = new PseudoRandom("float-det");
      for (let i = 0; i < 10; i++) {
        expect(rng1.nextFloat(0, 100)).toBe(rng2.nextFloat(0, 100));
      }
    });
  });
});
