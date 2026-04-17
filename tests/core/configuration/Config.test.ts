import { describe, it, expect } from "vitest";
import { UnitType, PlanetType } from "@core/game/Types";
import { DEFAULT_CONFIG, getUnitCost, getUpgradeCost } from "@core/configuration/DefaultConfig";

describe("DEFAULT_CONFIG", () => {
  it("has all 8 unit types", () => {
    const unitTypes = Object.values(UnitType);
    expect(unitTypes).toHaveLength(8);
    for (const unitType of unitTypes) {
      expect(DEFAULT_CONFIG.unitCosts[unitType]).toBeDefined();
    }
  });

  it("has all 8 planet types", () => {
    const planetTypes = [
      PlanetType.Barren,
      PlanetType.Terran,
      PlanetType.Oceanic,
      PlanetType.Volcanic,
      PlanetType.GasGiant,
      PlanetType.Ice,
      PlanetType.Desert,
      PlanetType.Nebula,
    ];
    expect(planetTypes).toHaveLength(8);
    for (const planetType of planetTypes) {
      expect(DEFAULT_CONFIG.planetTypes[planetType]).toBeDefined();
    }
  });
});

describe("getUnitCost", () => {
  it("returns base cost for first unit (count = 0)", () => {
    const cost = getUnitCost(UnitType.Colony, 0);
    expect(cost).toBe(DEFAULT_CONFIG.unitCosts[UnitType.Colony].baseCost);
  });

  it("scales exponentially with existing count", () => {
    const cost0 = getUnitCost(UnitType.Starport, 0);
    const cost1 = getUnitCost(UnitType.Starport, 1);
    const cost2 = getUnitCost(UnitType.Starport, 2);

    expect(cost1 > cost0).toBe(true);
    expect(cost2 > cost1).toBe(true);

    // Verify exponential: cost1 / cost0 ≈ scalingFactor
    const scalingFactor = DEFAULT_CONFIG.unitCosts[UnitType.Starport].scalingFactor;
    const ratio10 = Number(cost1) / Number(cost0);
    const ratio21 = Number(cost2) / Number(cost1);
    expect(ratio10).toBeCloseTo(scalingFactor, 1);
    expect(ratio21).toBeCloseTo(scalingFactor, 1);
  });

  it("throws for unknown unit type", () => {
    expect(() =>
      getUnitCost("unknown_unit" as UnitType, 0),
    ).toThrow("Unknown unit type");
  });
});

describe("getUpgradeCost", () => {
  it("returns base cost for level 0 (first upgrade)", () => {
    const cost = getUpgradeCost(UnitType.Starport, 0);
    expect(cost).toBe(DEFAULT_CONFIG.unitCosts[UnitType.Starport].baseCost);
  });

  it("scales per upgrade level", () => {
    const cost0 = getUpgradeCost(UnitType.Starport, 0);
    const cost1 = getUpgradeCost(UnitType.Starport, 1);
    const cost2 = getUpgradeCost(UnitType.Starport, 2);

    expect(cost1 > cost0).toBe(true);
    expect(cost2 > cost1).toBe(true);

    const upgradeMult = DEFAULT_CONFIG.unitCosts[UnitType.Starport].upgradeCostMultiplier;
    const ratio = Number(cost1) / Number(cost0);
    expect(ratio).toBeCloseTo(upgradeMult, 1);
  });

  it("throws when at max level", () => {
    const maxLevel = DEFAULT_CONFIG.unitCosts[UnitType.Starport].maxLevel;
    expect(() =>
      getUpgradeCost(UnitType.Starport, maxLevel),
    ).toThrow("already at max level");
  });
});
