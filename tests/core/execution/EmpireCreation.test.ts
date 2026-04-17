import { describe, it, expect } from "vitest";
import { PseudoRandom } from "@core/PseudoRandom";
import {
  computeEmpireCount,
  createEmpiresForGame,
  pickAlienEmpires,
  pickHumanEmpires,
  type EmpireCreationConfig,
} from "@core/execution/empire/EmpireCreation";

describe("EmpireCreation", () => {
  const rng = new PseudoRandom("empire-test-seed");

  describe("computeEmpireCount", () => {
    it("returns 0 when disabled", () => {
      const config: EmpireCreationConfig = {
        empireMode: "disabled",
        maxPlayers: 8,
        isCompactMap: false,
      };
      expect(computeEmpireCount(config)).toBe(0);
    });

    it("returns custom count when number", () => {
      const config: EmpireCreationConfig = {
        empireMode: 5,
        maxPlayers: 8,
        isCompactMap: false,
      };
      expect(computeEmpireCount(config)).toBe(5);
    });

    it("caps at pool size", () => {
      const config: EmpireCreationConfig = {
        empireMode: 100,
        maxPlayers: 200,
        isCompactMap: false,
      };
      expect(computeEmpireCount(config)).toBe(11);
    });

    it("default mode uses half of maxPlayers", () => {
      const config: EmpireCreationConfig = {
        empireMode: "default",
        maxPlayers: 8,
        isCompactMap: false,
      };
      expect(computeEmpireCount(config)).toBe(4);
    });

    it("compact maps use 25% of count", () => {
      const config: EmpireCreationConfig = {
        empireMode: 8,
        maxPlayers: 16,
        isCompactMap: true,
      };
      expect(computeEmpireCount(config)).toBe(2);
    });

    it("compact map minimum is 1", () => {
      const config: EmpireCreationConfig = {
        empireMode: 2,
        maxPlayers: 4,
        isCompactMap: true,
      };
      expect(computeEmpireCount(config)).toBeGreaterThanOrEqual(1);
    });
  });

  describe("createEmpiresForGame", () => {
    it("returns empty array when disabled", () => {
      const config: EmpireCreationConfig = {
        empireMode: "disabled",
        maxPlayers: 8,
        isCompactMap: false,
      };
      const result = createEmpiresForGame(config, rng);
      expect(result).toHaveLength(0);
    });

    it("returns correct number of empires", () => {
      const config: EmpireCreationConfig = {
        empireMode: 3,
        maxPlayers: 8,
        isCompactMap: false,
      };
      const result = createEmpiresForGame(config, new PseudoRandom("s1"));
      expect(result).toHaveLength(3);
    });

    it("each instance has a definition and slotIndex", () => {
      const config: EmpireCreationConfig = {
        empireMode: 4,
        maxPlayers: 8,
        isCompactMap: false,
      };
      const result = createEmpiresForGame(config, new PseudoRandom("s2"));
      for (const inst of result) {
        expect(inst.definition).toBeDefined();
        expect(inst.definition.id).toBeTruthy();
        expect(typeof inst.slotIndex).toBe("number");
      }
    });

    it("all definitions are unique", () => {
      const config: EmpireCreationConfig = {
        empireMode: 11,
        maxPlayers: 20,
        isCompactMap: false,
      };
      const result = createEmpiresForGame(config, new PseudoRandom("s3"));
      const ids = result.map((r) => r.definition.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe("pickAlienEmpires", () => {
    it("returns up to requested count", () => {
      const result = pickAlienEmpires(3, new PseudoRandom("a1"));
      expect(result).toHaveLength(3);
    });

    it("caps at available alien count", () => {
      const result = pickAlienEmpires(100, new PseudoRandom("a2"));
      expect(result).toHaveLength(6);
    });
  });

  describe("pickHumanEmpires", () => {
    it("returns up to requested count", () => {
      const result = pickHumanEmpires(2, new PseudoRandom("h1"));
      expect(result).toHaveLength(2);
    });

    it("caps at available human count", () => {
      const result = pickHumanEmpires(100, new PseudoRandom("h2"));
      expect(result).toHaveLength(5);
    });
  });
});
