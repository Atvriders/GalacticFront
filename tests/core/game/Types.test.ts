import { describe, it, expect } from "vitest";
import {
  UnitType,
  BUILDABLE_UNITS,
  UPGRADEABLE_UNITS,
  PlanetType,
  PLANET_TYPE_NAMES,
  GameUpdateType,
} from "../../../src/core/game/Types";

describe("UnitType", () => {
  it("has exactly 8 values", () => {
    const values = Object.values(UnitType);
    expect(values).toHaveLength(8);
  });
});

describe("BUILDABLE_UNITS", () => {
  it("has exactly 8 entries", () => {
    expect(BUILDABLE_UNITS).toHaveLength(8);
  });

  it("contains all UnitType values", () => {
    const allUnits = Object.values(UnitType);
    for (const unit of allUnits) {
      expect(BUILDABLE_UNITS).toContain(unit);
    }
  });
});

describe("UPGRADEABLE_UNITS", () => {
  it("is a subset of BUILDABLE_UNITS", () => {
    for (const unit of UPGRADEABLE_UNITS) {
      expect(BUILDABLE_UNITS).toContain(unit);
    }
  });

  it("has 5 entries", () => {
    expect(UPGRADEABLE_UNITS).toHaveLength(5);
  });
});

describe("PlanetType", () => {
  it("has exactly 8 values", () => {
    // numeric enums produce keys + values; filter to numeric values only
    const numericValues = Object.values(PlanetType).filter(
      (v) => typeof v === "number"
    );
    expect(numericValues).toHaveLength(8);
  });

  it("all values fit in 3 bits (0-7)", () => {
    const numericValues = Object.values(PlanetType).filter(
      (v) => typeof v === "number"
    ) as number[];
    for (const v of numericValues) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(7);
    }
  });
});

describe("PLANET_TYPE_NAMES", () => {
  it("has a name mapping for every PlanetType", () => {
    const numericValues = Object.values(PlanetType).filter(
      (v) => typeof v === "number"
    ) as PlanetType[];
    for (const pt of numericValues) {
      expect(PLANET_TYPE_NAMES[pt]).toBeDefined();
      expect(typeof PLANET_TYPE_NAMES[pt]).toBe("string");
      expect(PLANET_TYPE_NAMES[pt].length).toBeGreaterThan(0);
    }
  });
});

describe("GameUpdateType", () => {
  it("has exactly 22 values", () => {
    const values = Object.values(GameUpdateType);
    expect(values).toHaveLength(22);
  });
});
