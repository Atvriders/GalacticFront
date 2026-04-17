import { describe, it, expect, beforeEach } from "vitest";
import { PlayerImpl } from "../../../src/core/game/PlayerImpl";
import {
  PlayerType,
  UnitType,
  Relation,
  BUILDABLE_UNITS,
} from "../../../src/core/game/Types";

function makePlayer(overrides: Partial<{ id: number; clientID: string; name: string }> = {}) {
  return new PlayerImpl({
    id: overrides.id ?? 1,
    clientID: overrides.clientID ?? "client-1",
    name: overrides.name ?? "TestPlayer",
    playerType: PlayerType.Human,
    spawnTile: 42,
  });
}

describe("PlayerImpl", () => {
  let player: PlayerImpl;

  beforeEach(() => {
    player = makePlayer();
  });

  // --- Init defaults ---

  describe("initialization", () => {
    it("sets identity fields from PlayerData", () => {
      expect(player.id).toBe(1);
      expect(player.clientID).toBe("client-1");
      expect(player.name).toBe("TestPlayer");
      expect(player.playerType).toBe(PlayerType.Human);
      expect(player.spawnTile).toBe(42);
      expect(player.capitalTile).toBe(42);
    });

    it("starts alive", () => {
      expect(player.isAlive).toBe(true);
    });

    it("starts with 0 troops and 0 credits", () => {
      expect(player.troops).toBe(0n);
      expect(player.credits).toBe(0n);
    });

    it("starts with empty territory", () => {
      expect(player.territoryCount).toBe(0);
    });

    it("has hasSurrendered=false and eliminatedTick=-1", () => {
      expect(player.hasSurrendered).toBe(false);
      expect(player.eliminatedTick).toBe(-1);
    });
  });

  // --- Territory ---

  describe("territory", () => {
    it("addTerritory increases count", () => {
      player.addTerritory(10);
      player.addTerritory(20);
      expect(player.territoryCount).toBe(2);
    });

    it("ownsTerritory returns true for added tile", () => {
      player.addTerritory(10);
      expect(player.ownsTerritory(10)).toBe(true);
    });

    it("ownsTerritory returns false for non-owned tile", () => {
      expect(player.ownsTerritory(99)).toBe(false);
    });

    it("removeTerritory decreases count", () => {
      player.addTerritory(10);
      player.addTerritory(20);
      player.removeTerritory(10);
      expect(player.territoryCount).toBe(1);
      expect(player.ownsTerritory(10)).toBe(false);
    });

    it("adding same tile twice does not duplicate", () => {
      player.addTerritory(10);
      player.addTerritory(10);
      expect(player.territoryCount).toBe(1);
    });
  });

  // --- Relations ---

  describe("relations", () => {
    it("returns 0 for unknown player", () => {
      expect(player.getRelation(999)).toBe(0);
    });

    it("setRelation stores value", () => {
      player.setRelation(2, 75);
      expect(player.getRelation(2)).toBe(75);
    });

    it("clamps relation to 100 max", () => {
      player.setRelation(2, 150);
      expect(player.getRelation(2)).toBe(100);
    });

    it("clamps relation to -100 min", () => {
      player.setRelation(2, -200);
      expect(player.getRelation(2)).toBe(-100);
    });

    it("adjustRelation adds delta", () => {
      player.setRelation(2, 30);
      player.adjustRelation(2, 20);
      expect(player.getRelation(2)).toBe(50);
    });

    it("adjustRelation clamps result", () => {
      player.setRelation(2, 90);
      player.adjustRelation(2, 50);
      expect(player.getRelation(2)).toBe(100);
    });

    it("getRelationCategory returns Hostile when value <= -50", () => {
      player.setRelation(2, -50);
      expect(player.getRelationCategory(2)).toBe(Relation.Hostile);
    });

    it("getRelationCategory returns Neutral for values in (-50, 50)", () => {
      player.setRelation(2, 0);
      expect(player.getRelationCategory(2)).toBe(Relation.Neutral);
      player.setRelation(2, 49);
      expect(player.getRelationCategory(2)).toBe(Relation.Neutral);
      player.setRelation(2, -49);
      expect(player.getRelationCategory(2)).toBe(Relation.Neutral);
    });

    it("getRelationCategory returns Friendly when value >= 50", () => {
      player.setRelation(2, 50);
      expect(player.getRelationCategory(2)).toBe(Relation.Friendly);
    });

    it("getRelationCategory returns Allied when alliance exists, overriding relation value", () => {
      player.setRelation(2, -100);
      player.addAlliance(2, 9999);
      expect(player.getRelationCategory(2)).toBe(Relation.Allied);
    });

    it("decayRelations moves positive value toward 0", () => {
      player.setRelation(2, 60);
      player.decayRelations(10);
      expect(player.getRelation(2)).toBe(50);
    });

    it("decayRelations moves negative value toward 0", () => {
      player.setRelation(2, -60);
      player.decayRelations(10);
      expect(player.getRelation(2)).toBe(-50);
    });

    it("decayRelations does not go past 0 for positive value", () => {
      player.setRelation(2, 5);
      player.decayRelations(10);
      expect(player.getRelation(2)).toBe(0);
    });

    it("decayRelations does not go past 0 for negative value", () => {
      player.setRelation(2, -5);
      player.decayRelations(10);
      expect(player.getRelation(2)).toBe(0);
    });
  });

  // --- Alliances ---

  describe("alliances", () => {
    it("isAlliedWith returns false by default", () => {
      expect(player.isAlliedWith(2)).toBe(false);
    });

    it("addAlliance makes isAlliedWith return true", () => {
      player.addAlliance(2, 100);
      expect(player.isAlliedWith(2)).toBe(true);
    });

    it("removeAlliance removes the alliance", () => {
      player.addAlliance(2, 100);
      player.removeAlliance(2);
      expect(player.isAlliedWith(2)).toBe(false);
    });

    it("getAllianceCount returns correct count", () => {
      player.addAlliance(2, 100);
      player.addAlliance(3, 200);
      expect(player.getAllianceCount()).toBe(2);
    });

    it("getAlliances returns all alliances", () => {
      player.addAlliance(2, 100);
      player.addAlliance(3, 200);
      const alliances = player.getAlliances();
      expect(alliances.size).toBe(2);
      expect(alliances.get(2)).toBe(100);
      expect(alliances.get(3)).toBe(200);
    });

    it("expireAlliances removes expired and returns their IDs", () => {
      player.addAlliance(2, 50);
      player.addAlliance(3, 100);
      player.addAlliance(4, 200);
      const expired = player.expireAlliances(100);
      expect(expired).toContain(2);
      expect(expired).toContain(3);
      expect(expired).not.toContain(4);
      expect(player.isAlliedWith(2)).toBe(false);
      expect(player.isAlliedWith(3)).toBe(false);
      expect(player.isAlliedWith(4)).toBe(true);
    });

    it("expireAlliances returns empty array when nothing expires", () => {
      player.addAlliance(2, 1000);
      const expired = player.expireAlliances(10);
      expect(expired).toHaveLength(0);
    });
  });

  // --- Embargoes ---

  describe("embargoes", () => {
    it("hasEmbargo returns false by default", () => {
      expect(player.hasEmbargo(2)).toBe(false);
    });

    it("setEmbargo makes hasEmbargo return true", () => {
      player.setEmbargo(2);
      expect(player.hasEmbargo(2)).toBe(true);
    });

    it("clearEmbargo removes embargo", () => {
      player.setEmbargo(2);
      player.clearEmbargo(2);
      expect(player.hasEmbargo(2)).toBe(false);
    });
  });

  // --- Units ---

  describe("units", () => {
    it("addUnit stores unit, getUnit retrieves it", () => {
      player.addUnit("u1", UnitType.Colony, 10);
      const unit = player.getUnit("u1");
      expect(unit).toBeDefined();
      expect(unit!.type).toBe(UnitType.Colony);
      expect(unit!.tile).toBe(10);
      expect(unit!.level).toBe(1);
    });

    it("addUnit uses provided level", () => {
      player.addUnit("u1", UnitType.Starport, 10, 3);
      expect(player.getUnit("u1")!.level).toBe(3);
    });

    it("removeUnit removes the unit", () => {
      player.addUnit("u1", UnitType.Colony, 10);
      player.removeUnit("u1");
      expect(player.getUnit("u1")).toBeUndefined();
    });

    it("getUnitCount returns correct count by type", () => {
      player.addUnit("u1", UnitType.Colony, 10);
      player.addUnit("u2", UnitType.Colony, 20);
      player.addUnit("u3", UnitType.Starport, 30);
      expect(player.getUnitCount(UnitType.Colony)).toBe(2);
      expect(player.getUnitCount(UnitType.Starport)).toBe(1);
      expect(player.getUnitCount(UnitType.OrbitalForge)).toBe(0);
    });

    it("getAllUnits returns all units", () => {
      player.addUnit("u1", UnitType.Colony, 10);
      player.addUnit("u2", UnitType.Starport, 20);
      expect(player.getAllUnits().size).toBe(2);
    });

    it("getBuildableUnits returns all 8 BUILDABLE_UNITS", () => {
      const buildable = player.getBuildableUnits();
      expect(buildable).toHaveLength(8);
      expect(buildable).toEqual(BUILDABLE_UNITS);
    });
  });

  // --- Lifecycle ---

  describe("lifecycle", () => {
    it("eliminate sets isAlive=false and records tick", () => {
      player.addTerritory(10);
      player.addTerritory(20);
      player.eliminate(50);
      expect(player.isAlive).toBe(false);
      expect(player.eliminatedTick).toBe(50);
    });

    it("eliminate clears territory", () => {
      player.addTerritory(10);
      player.addTerritory(20);
      player.eliminate(50);
      expect(player.territoryCount).toBe(0);
    });

    it("surrender sets hasSurrendered=true and calls eliminate", () => {
      player.addTerritory(10);
      player.surrender(75);
      expect(player.hasSurrendered).toBe(true);
      expect(player.isAlive).toBe(false);
      expect(player.eliminatedTick).toBe(75);
      expect(player.territoryCount).toBe(0);
    });

    it("eliminate does not set hasSurrendered", () => {
      player.eliminate(50);
      expect(player.hasSurrendered).toBe(false);
    });
  });
});
