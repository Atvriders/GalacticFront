import { describe, it, expect } from "vitest";
import {
  ALIEN_EMPIRES,
  HUMAN_EMPIRES,
  ALL_EMPIRES,
  getEmpireById,
  hasPersonality,
} from "@core/execution/empire/EmpireData";

describe("EmpireData", () => {
  it("defines 6 alien species", () => {
    expect(ALIEN_EMPIRES).toHaveLength(6);
  });

  it("defines 5 human factions", () => {
    expect(HUMAN_EMPIRES).toHaveLength(5);
  });

  it("ALL_EMPIRES combines both sets (11 total)", () => {
    expect(ALL_EMPIRES).toHaveLength(11);
  });

  it("each empire has required fields", () => {
    for (const empire of ALL_EMPIRES) {
      expect(empire.id).toBeTruthy();
      expect(empire.name).toBeTruthy();
      expect(empire.region).toBeTruthy();
      expect(empire.personality.length).toBeGreaterThan(0);
      expect(empire.flagColors.primary).toBeTruthy();
      expect(empire.flagColors.secondary).toBeTruthy();
      expect(empire.weights.attack).toBeGreaterThanOrEqual(0);
      expect(empire.weights.defend).toBeGreaterThanOrEqual(0);
      expect(empire.weights.expand).toBeGreaterThanOrEqual(0);
      expect(empire.weights.diplomacy).toBeGreaterThanOrEqual(0);
      expect(empire.weights.build).toBeGreaterThanOrEqual(0);
      expect(empire.weights.superweapon).toBeGreaterThanOrEqual(0);
    }
  });

  it("all empire IDs are unique", () => {
    const ids = ALL_EMPIRES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("getEmpireById returns correct empire", () => {
    const zyr = getEmpireById("zyrkathi_hive");
    expect(zyr).toBeDefined();
    expect(zyr!.name).toBe("Zyr'kathi Hive");
  });

  it("getEmpireById returns undefined for unknown id", () => {
    expect(getEmpireById("nonexistent")).toBeUndefined();
  });

  it("hasPersonality checks correctly", () => {
    const zyr = getEmpireById("zyrkathi_hive")!;
    expect(hasPersonality(zyr, "aggressive")).toBe(true);
    expect(hasPersonality(zyr, "berserker")).toBe(true);
    expect(hasPersonality(zyr, "defensive")).toBe(false);
  });

  it("behavior weights sum to approximately 1.0", () => {
    for (const empire of ALL_EMPIRES) {
      const w = empire.weights;
      const sum =
        w.attack + w.defend + w.expand + w.diplomacy + w.build + w.superweapon;
      expect(sum).toBeCloseTo(1.0, 1);
    }
  });

  it("Zyr'kathi Hive is aggressive + berserker", () => {
    const e = getEmpireById("zyrkathi_hive")!;
    expect(e.personality).toContain("aggressive");
    expect(e.personality).toContain("berserker");
  });

  it("Crystalline Concord is defensive + balanced", () => {
    const e = getEmpireById("crystalline_concord")!;
    expect(e.personality).toContain("defensive");
    expect(e.personality).toContain("balanced");
  });

  it("Solar Federation is balanced + defensive", () => {
    const e = getEmpireById("solar_federation")!;
    expect(e.personality).toContain("balanced");
    expect(e.personality).toContain("defensive");
  });
});
