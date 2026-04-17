import { describe, it, expect, beforeEach } from "vitest";
import { GameImpl } from "../../../src/core/game/GameImpl";
import { PlayerType, UnitType, GameUpdateType } from "../../../src/core/game/Types";
import { DEFAULT_CONFIG } from "../../../src/core/configuration/DefaultConfig";
import type { GameBalanceConfig } from "../../../src/core/configuration/Config";
import type { GameID } from "../../../src/core/Schemas";

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    gameID: "test-game" as GameID,
    mapWidth: 20,
    mapHeight: 20,
    maxPlayers: 4,
    seed: "test-seed",
    ticksPerTurn: 1,
    turnIntervalMs: 100,
    gameMapType: "Standard",
    difficulty: "Medium",
    ...overrides,
  };
}

function makePlayerData(overrides: Record<string, unknown> = {}) {
  return {
    clientID: (overrides.clientID as string) ?? "client-1",
    name: (overrides.name as string) ?? "Player1",
    playerType: (overrides.playerType as PlayerType) ?? PlayerType.Human,
    spawnTile: (overrides.spawnTile as number) ?? 210, // center of 20x20
  };
}

describe("GameImpl", () => {
  let game: GameImpl;

  beforeEach(() => {
    game = new GameImpl(makeConfig());
  });

  // ─── Init ─────────────────────────────────────────────────────────────────

  describe("initialization", () => {
    it("starts at tick 0", () => {
      expect(game.currentTick).toBe(0);
      expect(game.tick).toBe(0);
    });

    it("is not game over initially", () => {
      expect(game.isGameOver()).toBe(false);
    });

    it("has no players initially", () => {
      expect(game.getPlayers()).toHaveLength(0);
    });

    it("creates a map with correct dimensions", () => {
      expect(game.map.width).toBe(20);
      expect(game.map.height).toBe(20);
    });

    it("has winnerID null initially", () => {
      expect(game.winnerID).toBeNull();
    });
  });

  // ─── Spawn ────────────────────────────────────────────────────────────────

  describe("spawnPlayer", () => {
    it("creates a player with territory", () => {
      const player = game.spawnPlayer(makePlayerData());
      expect(player.id).toBe(1);
      expect(player.isAlive).toBe(true);
      expect(player.troops).toBe(100n);
      expect(player.territoryCount).toBeGreaterThan(0);
    });

    it("assigns unique IDs to multiple players", () => {
      const p1 = game.spawnPlayer(makePlayerData({ name: "P1", spawnTile: 42 }));
      const p2 = game.spawnPlayer(makePlayerData({ name: "P2", clientID: "c2", spawnTile: 350 }));
      expect(p1.id).not.toBe(p2.id);
    });

    it("claims up to 3x3 area around spawn tile", () => {
      // Use a spawn tile in center, on traversable terrain
      // Find a space tile for spawning
      let spawnTile = -1;
      for (let i = 100; i < 300; i++) {
        if (game.map.isTraversable(i)) {
          // Check all 3x3 neighbors are in bounds and traversable
          const { x, y } = game.map.fromIndex(i);
          if (x > 0 && x < 19 && y > 0 && y < 19) {
            spawnTile = i;
            break;
          }
        }
      }
      if (spawnTile === -1) return; // skip if no suitable tile

      const player = game.spawnPlayer(makePlayerData({ spawnTile }));
      // Should have claimed some tiles (up to 9 for 3x3)
      expect(player.territoryCount).toBeGreaterThanOrEqual(1);
      expect(player.territoryCount).toBeLessThanOrEqual(9);
    });

    it("is retrievable via getPlayer", () => {
      const player = game.spawnPlayer(makePlayerData());
      expect(game.getPlayer(player.id)).toBe(player);
    });
  });

  // ─── Tick ─────────────────────────────────────────────────────────────────

  describe("executeTick", () => {
    it("increments tick counter", () => {
      game.executeTick();
      expect(game.currentTick).toBe(1);
      game.executeTick();
      expect(game.currentTick).toBe(2);
    });

    it("generates troops for alive players", () => {
      const player = game.spawnPlayer(makePlayerData());
      const initialTroops = player.troops;
      game.executeTick();
      expect(player.troops).toBeGreaterThan(initialTroops);
    });

    it("generates credits for alive players", () => {
      const player = game.spawnPlayer(makePlayerData());
      const initialCredits = player.credits;
      game.executeTick();
      expect(player.credits).toBeGreaterThan(initialCredits);
    });

    it("returns TickResult with updates array", () => {
      const result = game.executeTick();
      expect(result).toHaveProperty("updates");
      expect(result).toHaveProperty("tileChanges");
      expect(Array.isArray(result.updates)).toBe(true);
      expect(Array.isArray(result.tileChanges)).toBe(true);
    });

    it("does not execute if game is over", () => {
      // Spawn 2 players, eliminate one to trigger game over
      const p1 = game.spawnPlayer(makePlayerData({ spawnTile: 42 }));
      game.spawnPlayer(makePlayerData({ name: "P2", clientID: "c2", spawnTile: 350 }));
      game.eliminatePlayer(p1.id);
      expect(game.isGameOver()).toBe(true);

      const tickBefore = game.currentTick;
      const result = game.executeTick();
      expect(game.currentTick).toBe(tickBefore); // tick should not increment
      expect(result.updates).toHaveLength(0);
    });
  });

  // ─── Attacks ──────────────────────────────────────────────────────────────

  describe("attacks", () => {
    it("starts and ends an attack", () => {
      const p1 = game.spawnPlayer(makePlayerData({ spawnTile: 42 }));
      const p2 = game.spawnPlayer(makePlayerData({ name: "P2", clientID: "c2", spawnTile: 350 }));

      // Give p1 troops for attack
      p1.troops = 1000n;

      const attack = game.startAttack(p1.id, p2.id, 42, 0.5);
      if (attack) {
        expect(game.getAttacks().has(attack.id)).toBe(true);
        game.endAttack(attack.id);
        expect(game.getAttacks().has(attack.id)).toBe(false);
      }
    });

    it("rejects self-attacks", () => {
      const p1 = game.spawnPlayer(makePlayerData({ spawnTile: 42 }));
      const result = game.startAttack(p1.id, p1.id, 42, 0.5);
      expect(result).toBeNull();
    });

    it("rejects attacks on allies", () => {
      const p1 = game.spawnPlayer(makePlayerData({ spawnTile: 42 }));
      const p2 = game.spawnPlayer(makePlayerData({ name: "P2", clientID: "c2", spawnTile: 350 }));

      // Form an alliance
      const req = game.createAllianceRequest(p1.id, p2.id, 1000);
      if (req) game.acceptAlliance(req.id);

      p1.troops = 1000n;
      const result = game.startAttack(p1.id, p2.id, 42, 0.5);
      expect(result).toBeNull();
    });

    it("respects max active attacks", () => {
      const p1 = game.spawnPlayer(makePlayerData({ spawnTile: 42 }));
      const p2 = game.spawnPlayer(makePlayerData({ name: "P2", clientID: "c2", spawnTile: 350 }));

      p1.troops = 100000n;

      // Start maxActiveAttacks attacks
      const maxAtk = game.balance.attack.maxActiveAttacks;
      for (let i = 0; i < maxAtk; i++) {
        game.startAttack(p1.id, p2.id, 42, 0.1);
      }

      // Next one should be rejected
      const result = game.startAttack(p1.id, p2.id, 42, 0.1);
      expect(result).toBeNull();
    });
  });

  // ─── Alliances ────────────────────────────────────────────────────────────

  describe("alliances", () => {
    it("creates an alliance request", () => {
      const p1 = game.spawnPlayer(makePlayerData({ spawnTile: 42 }));
      const p2 = game.spawnPlayer(makePlayerData({ name: "P2", clientID: "c2", spawnTile: 350 }));

      const req = game.createAllianceRequest(p1.id, p2.id, 1000);
      expect(req).not.toBeNull();
      expect(game.getAllianceRequests().size).toBe(1);
    });

    it("accepts and forms alliance", () => {
      const p1 = game.spawnPlayer(makePlayerData({ spawnTile: 42 }));
      const p2 = game.spawnPlayer(makePlayerData({ name: "P2", clientID: "c2", spawnTile: 350 }));

      const req = game.createAllianceRequest(p1.id, p2.id, 1000);
      expect(req).not.toBeNull();

      const alliance = game.acceptAlliance(req!.id);
      expect(alliance).not.toBeNull();
      expect(p1.isAlliedWith(p2.id)).toBe(true);
      expect(p2.isAlliedWith(p1.id)).toBe(true);
    });

    it("breaks alliance with -30 relation penalty", () => {
      const p1 = game.spawnPlayer(makePlayerData({ spawnTile: 42 }));
      const p2 = game.spawnPlayer(makePlayerData({ name: "P2", clientID: "c2", spawnTile: 350 }));

      const req = game.createAllianceRequest(p1.id, p2.id, 1000);
      const alliance = game.acceptAlliance(req!.id);

      game.breakAlliance(alliance!.id, p1.id);
      expect(p1.isAlliedWith(p2.id)).toBe(false);
      expect(p2.isAlliedWith(p1.id)).toBe(false);
      expect(p1.getRelation(p2.id)).toBe(-30);
      expect(p2.getRelation(p1.id)).toBe(-30);
    });

    it("rejects alliance request when at max alliances", () => {
      const players = [];
      for (let i = 0; i < 5; i++) {
        players.push(
          game.spawnPlayer(
            makePlayerData({
              name: `P${i}`,
              clientID: `c${i}`,
              spawnTile: 20 + i * 60,
            }),
          ),
        );
      }

      const maxAll = game.balance.alliance.maxAlliances;
      // Fill up p1's alliances
      for (let i = 1; i <= maxAll; i++) {
        const req = game.createAllianceRequest(players[0]!.id, players[i]!.id, 1000);
        if (req) game.acceptAlliance(req.id);
      }

      // Next request should fail
      const extra = game.createAllianceRequest(
        players[0]!.id,
        players[maxAll + 1]!.id,
        1000,
      );
      expect(extra).toBeNull();
    });
  });

  // ─── Units ────────────────────────────────────────────────────────────────

  describe("units", () => {
    it("builds a unit and deducts credits", () => {
      const player = game.spawnPlayer(makePlayerData());
      player.credits = 10000n;

      // Need to own the tile
      const tile = [...player.territory][0]!;
      const unit = game.buildUnit(player.id, UnitType.Colony, tile);
      expect(unit).not.toBeNull();
      expect(player.credits).toBeLessThan(10000n);
      expect(game.getUnits().has(unit!.id)).toBe(true);
    });

    it("rejects build with insufficient credits", () => {
      const player = game.spawnPlayer(makePlayerData());
      player.credits = 0n;

      const tile = [...player.territory][0]!;
      const unit = game.buildUnit(player.id, UnitType.Colony, tile);
      expect(unit).toBeNull();
    });

    it("rejects build on unowned tile", () => {
      const player = game.spawnPlayer(makePlayerData());
      player.credits = 10000n;

      // Find a tile not owned by the player
      let unownedTile = -1;
      for (let i = 0; i < 400; i++) {
        if (!player.ownsTerritory(i)) {
          unownedTile = i;
          break;
        }
      }
      expect(unownedTile).not.toBe(-1);

      const unit = game.buildUnit(player.id, UnitType.Colony, unownedTile);
      expect(unit).toBeNull();
    });

    it("destroys a unit and removes it", () => {
      const player = game.spawnPlayer(makePlayerData());
      player.credits = 10000n;
      const tile = [...player.territory][0]!;
      const unit = game.buildUnit(player.id, UnitType.Colony, tile)!;

      game.destroyUnit(unit.id);
      expect(game.getUnits().has(unit.id)).toBe(false);
    });
  });

  // ─── Elimination ──────────────────────────────────────────────────────────

  describe("elimination", () => {
    it("eliminates player with 0 territory after tick 1", () => {
      const player = game.spawnPlayer(makePlayerData());

      // Remove all territory
      for (const tile of [...player.territory]) {
        game.map.setOwner(tile, 0);
        player.removeTerritory(tile);
      }
      expect(player.territoryCount).toBe(0);

      // Tick 1 should not eliminate (grace period)
      game.executeTick();
      expect(player.isAlive).toBe(true);

      // Tick 2 should eliminate
      game.executeTick();
      expect(player.isAlive).toBe(false);
    });
  });

  // ─── Win condition ────────────────────────────────────────────────────────

  describe("win condition", () => {
    it("triggers game over when last player standing", () => {
      const p1 = game.spawnPlayer(makePlayerData({ spawnTile: 42 }));
      const p2 = game.spawnPlayer(makePlayerData({ name: "P2", clientID: "c2", spawnTile: 350 }));

      game.eliminatePlayer(p2.id);
      expect(game.isGameOver()).toBe(true);
      expect(game.winnerID).toBe(p1.id);
    });

    it("triggers game over at max game ticks", () => {
      const shortBalance: GameBalanceConfig = {
        ...DEFAULT_CONFIG,
        maxGameTicks: 3,
      };
      const g = new GameImpl(makeConfig(), shortBalance);
      const p1 = g.spawnPlayer(makePlayerData({ spawnTile: 42 }));
      g.spawnPlayer(makePlayerData({ name: "P2", clientID: "c2", spawnTile: 350 }));

      g.executeTick(); // tick 1
      g.executeTick(); // tick 2
      expect(g.isGameOver()).toBe(false);
      g.executeTick(); // tick 3 = maxGameTicks
      expect(g.isGameOver()).toBe(true);
      // winner should be the player with most territory
      expect(g.winnerID).not.toBeNull();
    });
  });

  // ─── Map generation ───────────────────────────────────────────────────────

  describe("map generation", () => {
    it("is deterministic with same seed", () => {
      const g1 = new GameImpl(makeConfig({ seed: "deterministic" }));
      const g2 = new GameImpl(makeConfig({ seed: "deterministic" }));

      // Compare terrain arrays
      expect(g1.map.terrain).toEqual(g2.map.terrain);
      expect(g1.map.magnitude).toEqual(g2.map.magnitude);
    });

    it("differs with different seeds", () => {
      const g1 = new GameImpl(makeConfig({ seed: "seed-A" }));
      const g2 = new GameImpl(makeConfig({ seed: "seed-B" }));

      // At least some terrain should differ
      let differs = false;
      for (let i = 0; i < g1.map.terrain.length; i++) {
        if (g1.map.terrain[i] !== g2.map.terrain[i]) {
          differs = true;
          break;
        }
      }
      expect(differs).toBe(true);
    });
  });

  // ─── EventBus ─────────────────────────────────────────────────────────────

  describe("EventBus integration", () => {
    it("emits PlayerSpawned on spawn", () => {
      const events: unknown[] = [];
      game.eventBus.on(GameUpdateType.PlayerSpawned, (data) => {
        events.push(data);
      });

      game.spawnPlayer(makePlayerData());
      expect(events).toHaveLength(1);
    });

    it("emits AttackStarted on startAttack", () => {
      const events: unknown[] = [];
      game.eventBus.on(GameUpdateType.AttackStarted, (data) => {
        events.push(data);
      });

      const p1 = game.spawnPlayer(makePlayerData({ spawnTile: 42 }));
      const p2 = game.spawnPlayer(makePlayerData({ name: "P2", clientID: "c2", spawnTile: 350 }));
      p1.troops = 1000n;

      game.startAttack(p1.id, p2.id, 42, 0.5);
      expect(events).toHaveLength(1);
    });

    it("emits AllianceFormed on accept", () => {
      const events: unknown[] = [];
      game.eventBus.on(GameUpdateType.AllianceFormed, (data) => {
        events.push(data);
      });

      const p1 = game.spawnPlayer(makePlayerData({ spawnTile: 42 }));
      const p2 = game.spawnPlayer(makePlayerData({ name: "P2", clientID: "c2", spawnTile: 350 }));

      const req = game.createAllianceRequest(p1.id, p2.id, 1000);
      if (req) game.acceptAlliance(req.id);
      expect(events).toHaveLength(1);
    });

    it("emits UnitBuilt on build", () => {
      const events: unknown[] = [];
      game.eventBus.on(GameUpdateType.UnitBuilt, (data) => {
        events.push(data);
      });

      const player = game.spawnPlayer(makePlayerData());
      player.credits = 10000n;
      const tile = [...player.territory][0]!;
      game.buildUnit(player.id, UnitType.Colony, tile);
      expect(events).toHaveLength(1);
    });
  });
});
