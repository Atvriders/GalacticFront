import { describe, it, expect } from "vitest";
import { UnitImpl } from "../../../src/core/game/UnitImpl";
import { UnitType } from "../../../src/core/game/Types";

function makeUnit(type: UnitType = UnitType.Colony, overrides: Partial<{ id: string; ownerID: number; tile: number; level: number }> = {}) {
  return new UnitImpl({
    id: overrides.id ?? "unit-1",
    type,
    ownerID: overrides.ownerID ?? 1,
    tile: overrides.tile ?? 0,
    level: overrides.level,
  });
}

describe("UnitImpl initialization", () => {
  it("sets defaults correctly", () => {
    const unit = makeUnit(UnitType.Colony);
    expect(unit.id).toBe("unit-1");
    expect(unit.type).toBe(UnitType.Colony);
    expect(unit.ownerID).toBe(1);
    expect(unit.tile).toBe(0);
    expect(unit.level).toBe(1);
    expect(unit.isActive).toBe(true);
    expect(unit.isConstructing).toBe(true);
    expect(unit.constructionProgress).toBe(0);
    expect(unit.targetTile).toBe(-1);
    expect(unit.destinationTile).toBe(-1);
    expect(unit.createdTick).toBe(0);
    expect(unit.lastActivatedTick).toBe(0);
    expect(unit.cooldownTicks).toBe(0);
  });

  it("initializes health to maxHealth", () => {
    const unit = makeUnit(UnitType.Colony);
    expect(unit.health).toBe(unit.maxHealth);
    expect(unit.maxHealth).toBe(UnitImpl.getDefaultHealth(UnitType.Colony));
  });

  it("initializes constructionTotalTicks from static", () => {
    const unit = makeUnit(UnitType.Starport);
    expect(unit.constructionTotalTicks).toBe(UnitImpl.getConstructionTime(UnitType.Starport));
  });

  it("accepts custom level", () => {
    const unit = makeUnit(UnitType.Starport, { level: 3 });
    expect(unit.level).toBe(3);
  });
});

describe("Construction", () => {
  it("is constructing initially and not ready", () => {
    const unit = makeUnit(UnitType.Colony);
    expect(unit.isConstructing).toBe(true);
    expect(unit.isReady()).toBe(false);
  });

  it("completes after constructionTotalTicks ticks", () => {
    const unit = makeUnit(UnitType.Colony);
    const totalTicks = unit.constructionTotalTicks;
    let completed = false;
    for (let i = 0; i < totalTicks; i++) {
      completed = unit.tickConstruction();
    }
    expect(completed).toBe(true);
    expect(unit.isConstructing).toBe(false);
    expect(unit.constructionProgress).toBe(1);
  });

  it("returns true immediately after already completed", () => {
    const unit = makeUnit(UnitType.Colony);
    const totalTicks = unit.constructionTotalTicks;
    for (let i = 0; i < totalTicks; i++) {
      unit.tickConstruction();
    }
    // Calling again after completion returns true
    expect(unit.tickConstruction()).toBe(true);
    expect(unit.isConstructing).toBe(false);
  });

  it("returns false before completion", () => {
    const unit = makeUnit(UnitType.Colony);
    const result = unit.tickConstruction();
    expect(result).toBe(false);
    expect(unit.isConstructing).toBe(true);
  });

  it("is ready after construction completes", () => {
    const unit = makeUnit(UnitType.Colony);
    for (let i = 0; i < unit.constructionTotalTicks; i++) {
      unit.tickConstruction();
    }
    expect(unit.isReady()).toBe(true);
  });
});

describe("Health", () => {
  function completeConstruction(unit: UnitImpl) {
    for (let i = 0; i < unit.constructionTotalTicks; i++) {
      unit.tickConstruction();
    }
  }

  it("takeDamage reduces health", () => {
    const unit = makeUnit(UnitType.Colony);
    unit.takeDamage(30);
    expect(unit.health).toBe(unit.maxHealth - 30);
  });

  it("takeDamage returns true when health reaches 0", () => {
    const unit = makeUnit(UnitType.Colony);
    const destroyed = unit.takeDamage(unit.maxHealth);
    expect(destroyed).toBe(true);
    expect(unit.isDestroyed()).toBe(true);
  });

  it("takeDamage returns false when not destroyed", () => {
    const unit = makeUnit(UnitType.Colony);
    const destroyed = unit.takeDamage(10);
    expect(destroyed).toBe(false);
    expect(unit.isDestroyed()).toBe(false);
  });

  it("heal restores health", () => {
    const unit = makeUnit(UnitType.Colony);
    unit.takeDamage(50);
    unit.heal(20);
    expect(unit.health).toBe(unit.maxHealth - 30);
  });

  it("heal caps at maxHealth", () => {
    const unit = makeUnit(UnitType.Colony);
    unit.takeDamage(10);
    unit.heal(999);
    expect(unit.health).toBe(unit.maxHealth);
  });

  it("getHealthPercent returns 1 at full health", () => {
    const unit = makeUnit(UnitType.Colony);
    expect(unit.getHealthPercent()).toBe(1);
  });

  it("getHealthPercent returns correct fraction", () => {
    const unit = makeUnit(UnitType.Colony);
    unit.takeDamage(unit.maxHealth / 2);
    expect(unit.getHealthPercent()).toBeCloseTo(0.5);
  });
});

describe("Upgrades", () => {
  function completeConstruction(unit: UnitImpl) {
    for (let i = 0; i < unit.constructionTotalTicks; i++) {
      unit.tickConstruction();
    }
  }

  it("Colony is not upgradeable", () => {
    const unit = makeUnit(UnitType.Colony);
    expect(unit.isUpgradeable()).toBe(false);
  });

  it("Starport is upgradeable", () => {
    const unit = makeUnit(UnitType.Starport);
    expect(unit.isUpgradeable()).toBe(true);
  });

  it("canUpgrade returns false while constructing", () => {
    const unit = makeUnit(UnitType.Starport);
    expect(unit.canUpgrade(5)).toBe(false);
  });

  it("canUpgrade returns true when eligible", () => {
    const unit = makeUnit(UnitType.Starport);
    completeConstruction(unit);
    expect(unit.canUpgrade(5)).toBe(true);
  });

  it("canUpgrade returns false when at max level", () => {
    const unit = makeUnit(UnitType.Starport);
    completeConstruction(unit);
    expect(unit.canUpgrade(1)).toBe(false);
  });

  it("upgrade increments level", () => {
    const unit = makeUnit(UnitType.Starport);
    completeConstruction(unit);
    unit.upgrade();
    expect(unit.level).toBe(2);
  });

  it("upgrade increases maxHealth by 1.2x (ceil) and sets health to maxHealth", () => {
    const unit = makeUnit(UnitType.Starport);
    completeConstruction(unit);
    const prevMax = unit.maxHealth;
    unit.upgrade();
    expect(unit.maxHealth).toBe(Math.ceil(prevMax * 1.2));
    expect(unit.health).toBe(unit.maxHealth);
  });
});

describe("Cooldown and activation", () => {
  function completeConstruction(unit: UnitImpl) {
    for (let i = 0; i < unit.constructionTotalTicks; i++) {
      unit.tickConstruction();
    }
  }

  it("SuperweaponFacility has a cooldown after activation", () => {
    const unit = makeUnit(UnitType.SuperweaponFacility);
    completeConstruction(unit);
    const activated = unit.activate(10);
    expect(activated).toBe(true);
    expect(unit.cooldownTicks).toBe(UnitImpl.getCooldown(UnitType.SuperweaponFacility));
    expect(unit.isReady()).toBe(false);
  });

  it("cooldown ticks down via tickCooldown", () => {
    const unit = makeUnit(UnitType.SuperweaponFacility);
    completeConstruction(unit);
    unit.activate(0);
    const initialCooldown = unit.cooldownTicks;
    unit.tickCooldown();
    expect(unit.cooldownTicks).toBe(initialCooldown - 1);
  });

  it("isReady after cooldown expires", () => {
    const unit = makeUnit(UnitType.InterceptorArray);
    completeConstruction(unit);
    unit.activate(0);
    const cooldown = unit.cooldownTicks;
    for (let i = 0; i < cooldown; i++) {
      unit.tickCooldown();
    }
    expect(unit.isReady()).toBe(true);
  });

  it("activate returns false while constructing", () => {
    const unit = makeUnit(UnitType.SuperweaponFacility);
    expect(unit.activate(0)).toBe(false);
  });

  it("activate returns false while in cooldown", () => {
    const unit = makeUnit(UnitType.SuperweaponFacility);
    completeConstruction(unit);
    unit.activate(0);
    expect(unit.activate(1)).toBe(false);
  });

  it("deactivate sets isActive to false and isReady returns false", () => {
    const unit = makeUnit(UnitType.Colony);
    completeConstruction(unit);
    unit.deactivate();
    expect(unit.isActive).toBe(false);
    expect(unit.isReady()).toBe(false);
  });

  it("Colony activates with no cooldown", () => {
    const unit = makeUnit(UnitType.Colony);
    completeConstruction(unit);
    unit.activate(5);
    expect(unit.cooldownTicks).toBe(0);
    expect(unit.isReady()).toBe(true);
  });
});

describe("Static methods", () => {
  const allTypes = Object.values(UnitType);

  it("all types have positive default health", () => {
    for (const type of allTypes) {
      expect(UnitImpl.getDefaultHealth(type)).toBeGreaterThan(0);
    }
  });

  it("all types have positive construction time", () => {
    for (const type of allTypes) {
      expect(UnitImpl.getConstructionTime(type)).toBeGreaterThan(0);
    }
  });

  it("getCooldown returns 0 for non-cooldown units", () => {
    expect(UnitImpl.getCooldown(UnitType.Colony)).toBe(0);
    expect(UnitImpl.getCooldown(UnitType.Starport)).toBe(0);
    expect(UnitImpl.getCooldown(UnitType.OrbitalForge)).toBe(0);
    expect(UnitImpl.getCooldown(UnitType.PlanetaryShield)).toBe(0);
    expect(UnitImpl.getCooldown(UnitType.HyperloopStation)).toBe(0);
  });

  it("getCooldown returns positive for cooldown units", () => {
    expect(UnitImpl.getCooldown(UnitType.SuperweaponFacility)).toBeGreaterThan(0);
    expect(UnitImpl.getCooldown(UnitType.InterceptorArray)).toBeGreaterThan(0);
    expect(UnitImpl.getCooldown(UnitType.WormholeGenerator)).toBeGreaterThan(0);
  });
});
