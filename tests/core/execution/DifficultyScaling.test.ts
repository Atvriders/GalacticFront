import { describe, it, expect } from "vitest";
import { PseudoRandom } from "@core/PseudoRandom";
import {
  DIFFICULTY_INTERVALS,
  EmpireExecution,
} from "@core/execution/EmpireExecution";
import { getEmpireById } from "@core/execution/empire/EmpireData";
import {
  calculateOverwhelmCount,
  countSAMs,
} from "@core/execution/empire/SuperweaponBehavior";
import {
  shouldCounterCruisers,
  COUNTER_THRESHOLD_FFA,
  COUNTER_THRESHOLD_TEAM,
} from "@core/execution/empire/CruiserBehavior";

describe("Difficulty Scaling", () => {
  describe("action intervals per difficulty", () => {
    it("Easy interval is 65-80", () => {
      const interval = DIFFICULTY_INTERVALS["Easy"]!;
      expect(interval.min).toBe(65);
      expect(interval.max).toBe(80);
    });

    it("Medium interval is 50-65", () => {
      const interval = DIFFICULTY_INTERVALS["Medium"]!;
      expect(interval.min).toBe(50);
      expect(interval.max).toBe(65);
    });

    it("Hard interval is 40-50", () => {
      const interval = DIFFICULTY_INTERVALS["Hard"]!;
      expect(interval.min).toBe(40);
      expect(interval.max).toBe(50);
    });

    it("Impossible interval is 30-50", () => {
      const interval = DIFFICULTY_INTERVALS["Impossible"]!;
      expect(interval.min).toBe(30);
      expect(interval.max).toBe(50);
    });

    it("harder difficulties have lower minimum intervals", () => {
      const easy = DIFFICULTY_INTERVALS["Easy"]!;
      const medium = DIFFICULTY_INTERVALS["Medium"]!;
      const hard = DIFFICULTY_INTERVALS["Hard"]!;
      const impossible = DIFFICULTY_INTERVALS["Impossible"]!;

      expect(medium.min).toBeLessThan(easy.min);
      expect(hard.min).toBeLessThan(medium.min);
      expect(impossible.min).toBeLessThan(hard.min);
    });
  });

  describe("EmpireExecution interval assignment", () => {
    it("Easy empire gets interval in 65-80 range", () => {
      const def = getEmpireById("zyrkathi_hive")!;
      const rng = new PseudoRandom("easy-1");
      const emp = new EmpireExecution(def, "Easy", rng);
      expect(emp.interval).toBeGreaterThanOrEqual(65);
      expect(emp.interval).toBeLessThanOrEqual(80);
    });

    it("Impossible empire gets interval in 30-50 range", () => {
      const def = getEmpireById("zyrkathi_hive")!;
      const rng = new PseudoRandom("imp-1");
      const emp = new EmpireExecution(def, "Impossible", rng);
      expect(emp.interval).toBeGreaterThanOrEqual(30);
      expect(emp.interval).toBeLessThanOrEqual(50);
    });

    it("unknown difficulty falls back to Medium", () => {
      const def = getEmpireById("synth_collective")!;
      const rng = new PseudoRandom("unk-1");
      const emp = new EmpireExecution(def, "Unknown", rng);
      expect(emp.interval).toBeGreaterThanOrEqual(50);
      expect(emp.interval).toBeLessThanOrEqual(65);
    });
  });

  describe("SAM overwhelm math", () => {
    it("0 SAMs requires 1 launch", () => {
      expect(calculateOverwhelmCount(0)).toBe(1);
    });

    it("1 SAM requires 2 launches", () => {
      expect(calculateOverwhelmCount(1)).toBe(2);
    });

    it("5 SAMs require 6 launches", () => {
      expect(calculateOverwhelmCount(5)).toBe(6);
    });

    it("formula is always SAM_count + 1", () => {
      for (let i = 0; i <= 20; i++) {
        expect(calculateOverwhelmCount(i)).toBe(i + 1);
      }
    });
  });

  describe("counter-cruiser thresholds", () => {
    it("FFA threshold is 10", () => {
      expect(COUNTER_THRESHOLD_FFA).toBe(10);
    });

    it("team threshold is 15", () => {
      expect(COUNTER_THRESHOLD_TEAM).toBe(15);
    });

    it("does not trigger below FFA threshold", () => {
      expect(shouldCounterCruisers(10, false)).toBe(false);
    });

    it("triggers above FFA threshold", () => {
      expect(shouldCounterCruisers(11, false)).toBe(true);
    });

    it("does not trigger below team threshold", () => {
      expect(shouldCounterCruisers(15, true)).toBe(false);
    });

    it("triggers above team threshold", () => {
      expect(shouldCounterCruisers(16, true)).toBe(true);
    });
  });
});
