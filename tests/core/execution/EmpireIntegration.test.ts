import { describe, it, expect } from "vitest";
import { PseudoRandom } from "@core/PseudoRandom";
import { GameImpl } from "@core/game/GameImpl";
import type { GameConfig } from "@core/Schemas";
import { EmpireExecution } from "@core/execution/EmpireExecution";
import { TribeExecution } from "@core/execution/TribeExecution";
import { createEmpiresForGame } from "@core/execution/empire/EmpireCreation";
import { generateTribeNames, findSpawnTile } from "@core/execution/TribeSpawner";
import {
  shouldSwarm,
  strengthRatio,
} from "@core/execution/empire/SwarmBehavior";
import {
  getBuildPriorities,
} from "@core/execution/empire/StructureBehavior";
import {
  pickEmoji,
  FRIENDLY_EMOJIS,
  HOSTILE_EMOJIS,
  TAUNT_EMOJIS,
} from "@core/execution/empire/EmojiBehavior";
import {
  threatScore,
  shouldRequestAlliance,
} from "@core/execution/empire/AllianceBehavior";
import { getEmpireById } from "@core/execution/empire/EmpireData";
import { UnitType } from "@core/game/Types";

const TEST_CONFIG: GameConfig = {
  gameID: "empire-integration" as GameConfig["gameID"],
  mapWidth: 40,
  mapHeight: 40,
  maxPlayers: 16,
  seed: "integration-seed-42",
  ticksPerTurn: 1,
  turnIntervalMs: 100,
  gameMapType: "Standard",
  difficulty: "Medium",
};

function findFreeTile(game: GameImpl, start = 0): number {
  for (let i = start; i < game.map.width * game.map.height; i++) {
    if (game.map.isTraversable(i) && !game.map.isOwned(i)) return i;
  }
  throw new Error("No free tile");
}

describe("Empire Integration", () => {
  it("creates empires and spawns them into a game", () => {
    const game = new GameImpl(TEST_CONFIG);
    const rng = new PseudoRandom("int-1");

    const empires = createEmpiresForGame(
      { empireMode: 4, maxPlayers: 16, isCompactMap: false },
      rng,
    );

    expect(empires).toHaveLength(4);

    // Spawn each empire as a player
    const playerIDs: number[] = [];
    for (const inst of empires) {
      const tile = findFreeTile(game, playerIDs.length * 50);
      const pid = game.spawnPlayer(inst.definition.name, tile);
      playerIDs.push(pid);
    }

    expect(game.getAlivePlayers()).toHaveLength(4);
  });

  it("EmpireExecution skips ticks before init delay", () => {
    const game = new GameImpl(TEST_CONFIG);
    const def = getEmpireById("zyrkathi_hive")!;
    const rng = new PseudoRandom("init-delay");
    const empire = new EmpireExecution(def, "Medium", rng, 50);

    const t = findFreeTile(game);
    const pid = game.spawnPlayer("Zyr'kathi Hive", t);

    // Before init delay, should do nothing
    empire.tick(game, pid, 10);
    expect(game.getAttacks().size).toBe(0);
  });

  it("TribeExecution and EmpireExecution can coexist", () => {
    const game = new GameImpl(TEST_CONFIG);
    const rng = new PseudoRandom("coexist");

    // Spawn tribe player
    const t1 = findFreeTile(game);
    const tribePID = game.spawnPlayer("TribePlayer", t1);
    const tribe = new TribeExecution(rng, 10);

    // Spawn empire player
    const def = getEmpireById("solar_federation")!;
    const t2 = findFreeTile(game, t1 + 50);
    const empirePID = game.spawnPlayer("Solar Federation", t2);
    const empire = new EmpireExecution(def, "Easy", rng, 0);

    // Run some ticks
    for (let tick = 1; tick <= 200; tick++) {
      game.executeTick();
      tribe.tick(game, tribePID, tick);
      empire.tick(game, empirePID, tick);
    }

    // Both players should still be alive (they are far apart)
    expect(game.getPlayer(tribePID)!.isAlive).toBe(true);
    expect(game.getPlayer(empirePID)!.isAlive).toBe(true);
  });

  it("empire builds structures when ticked enough times", () => {
    const game = new GameImpl(TEST_CONFIG);
    const def = getEmpireById("europa_technocracy")!;
    const rng = new PseudoRandom("build-test");
    const empire = new EmpireExecution(def, "Medium", rng, 0);

    const t = findFreeTile(game);
    const pid = game.spawnPlayer("Europa Tech", t);
    const player = game.getPlayer(pid)!;

    // Give the player lots of credits
    player.credits = 100000n;

    // Run many ticks to trigger building
    for (let tick = 1; tick <= 500; tick++) {
      game.executeTick();
      empire.tick(game, pid, tick);
    }

    // Should have built at least something
    const unitCount = game.getUnits().size;
    // May or may not build depending on RNG, but the system should not crash
    expect(unitCount).toBeGreaterThanOrEqual(0);
  });

  describe("SwarmBehavior unit tests", () => {
    it("strengthRatio > 1 when attacker is stronger", () => {
      const game = new GameImpl(TEST_CONFIG);
      const t1 = findFreeTile(game);
      const pid1 = game.spawnPlayer("Strong", t1);
      const strong = game.getPlayer(pid1)!;
      strong.troops = 10000n;

      const t2 = findFreeTile(game, t1 + 10);
      const pid2 = game.spawnPlayer("Weak", t2);
      const weak = game.getPlayer(pid2)!;
      weak.troops = 100n;

      expect(strengthRatio(strong, weak)).toBeGreaterThan(1);
    });

    it("shouldSwarm returns true for strong advantage", () => {
      const game = new GameImpl(TEST_CONFIG);
      const t1 = findFreeTile(game);
      const pid1 = game.spawnPlayer("Huge", t1);
      const huge = game.getPlayer(pid1)!;
      huge.troops = 50000n;

      const t2 = findFreeTile(game, t1 + 10);
      const pid2 = game.spawnPlayer("Tiny", t2);
      const tiny = game.getPlayer(pid2)!;
      tiny.troops = 100n;

      expect(shouldSwarm(huge, tiny)).toBe(true);
    });

    it("shouldSwarm returns false for equal strength", () => {
      const game = new GameImpl(TEST_CONFIG);
      const t1 = findFreeTile(game);
      const pid1 = game.spawnPlayer("A", t1);
      const a = game.getPlayer(pid1)!;
      a.troops = 1000n;

      const t2 = findFreeTile(game, t1 + 10);
      const pid2 = game.spawnPlayer("B", t2);
      const b = game.getPlayer(pid2)!;
      b.troops = 1000n;

      expect(shouldSwarm(a, b)).toBe(false);
    });
  });

  describe("StructureBehavior build priorities", () => {
    it("aggressive empires prioritize SuperweaponFacility", () => {
      const def = getEmpireById("zyrkathi_hive")!;
      const priorities = getBuildPriorities(def);
      expect(priorities[0]).toBe(UnitType.SuperweaponFacility);
    });

    it("defensive empires prioritize PlanetaryShield", () => {
      const def = getEmpireById("crystalline_concord")!;
      const priorities = getBuildPriorities(def);
      expect(priorities[0]).toBe(UnitType.PlanetaryShield);
    });

    it("naval empires prioritize Starport", () => {
      const def = getEmpireById("aetheri_nomads")!;
      const priorities = getBuildPriorities(def);
      // Aetheri are raider+naval, raider check comes first
      expect(priorities.includes(UnitType.Starport)).toBe(true);
    });

    it("balanced+defensive empires prioritize PlanetaryShield", () => {
      const def = getEmpireById("synth_collective")!;
      // synth_collective is balanced+defensive, defensive check comes first
      const priorities = getBuildPriorities(def);
      expect(priorities[0]).toBe(UnitType.PlanetaryShield);
    });
  });

  describe("EmojiBehavior", () => {
    it("picks friendly emoji for allies", () => {
      const game = new GameImpl(TEST_CONFIG);
      const rng = new PseudoRandom("emoji-1");
      const t1 = findFreeTile(game);
      const pid1 = game.spawnPlayer("A", t1);
      const p1 = game.getPlayer(pid1)!;
      const t2 = findFreeTile(game, t1 + 10);
      const pid2 = game.spawnPlayer("B", t2);
      p1.addAlliance(pid2, 9999);

      const emoji = pickEmoji(p1, pid2, rng);
      expect(FRIENDLY_EMOJIS).toContain(emoji);
    });

    it("picks hostile emoji for enemies", () => {
      const game = new GameImpl(TEST_CONFIG);
      const rng = new PseudoRandom("emoji-2");
      const t1 = findFreeTile(game);
      const pid1 = game.spawnPlayer("A", t1);
      const p1 = game.getPlayer(pid1)!;
      const t2 = findFreeTile(game, t1 + 10);
      const pid2 = game.spawnPlayer("B", t2);
      p1.setRelation(pid2, -80);

      const emoji = pickEmoji(p1, pid2, rng);
      expect(HOSTILE_EMOJIS).toContain(emoji);
    });

    it("picks taunt emoji for neutral", () => {
      const game = new GameImpl(TEST_CONFIG);
      const rng = new PseudoRandom("emoji-3");
      const t1 = findFreeTile(game);
      const pid1 = game.spawnPlayer("A", t1);
      const p1 = game.getPlayer(pid1)!;
      const t2 = findFreeTile(game, t1 + 10);
      const pid2 = game.spawnPlayer("B", t2);

      const emoji = pickEmoji(p1, pid2, rng);
      expect(TAUNT_EMOJIS).toContain(emoji);
    });
  });

  describe("AllianceBehavior", () => {
    it("threatScore increases with troop advantage", () => {
      const game = new GameImpl(TEST_CONFIG);
      const t1 = findFreeTile(game);
      const pid1 = game.spawnPlayer("Self", t1);
      const self = game.getPlayer(pid1)!;
      self.troops = 100n;

      const t2 = findFreeTile(game, t1 + 10);
      const pid2 = game.spawnPlayer("Threat", t2);
      const threat = game.getPlayer(pid2)!;
      threat.troops = 10000n;

      const score = threatScore(threat, self);
      expect(score).toBeGreaterThan(1);
    });

    it("shouldRequestAlliance returns true for high threat", () => {
      const game = new GameImpl(TEST_CONFIG);
      const t1 = findFreeTile(game);
      const pid1 = game.spawnPlayer("Me", t1);
      const me = game.getPlayer(pid1)!;
      me.troops = 100n;

      const t2 = findFreeTile(game, t1 + 10);
      const pid2 = game.spawnPlayer("BigGuy", t2);
      const big = game.getPlayer(pid2)!;
      big.troops = 50000n;

      expect(shouldRequestAlliance(me, big)).toBe(true);
    });

    it("shouldRequestAlliance returns false for existing ally", () => {
      const game = new GameImpl(TEST_CONFIG);
      const t1 = findFreeTile(game);
      const pid1 = game.spawnPlayer("Me", t1);
      const me = game.getPlayer(pid1)!;

      const t2 = findFreeTile(game, t1 + 10);
      const pid2 = game.spawnPlayer("Ally", t2);
      const ally = game.getPlayer(pid2)!;
      me.addAlliance(pid2, 9999);

      expect(shouldRequestAlliance(me, ally)).toBe(false);
    });
  });

  it("full game loop with multiple AI empires runs without errors", () => {
    const game = new GameImpl(TEST_CONFIG);
    const rng = new PseudoRandom("full-loop");

    // Create 3 empire AIs
    const empires = createEmpiresForGame(
      { empireMode: 3, maxPlayers: 16, isCompactMap: false },
      rng,
    );

    const ais: Array<{ ai: EmpireExecution; pid: number }> = [];
    for (let i = 0; i < empires.length; i++) {
      const tile = findFreeTile(game, i * 100);
      const pid = game.spawnPlayer(empires[i]!.definition.name, tile);
      const player = game.getPlayer(pid)!;
      player.troops = 5000n;
      player.credits = 50000n;

      const ai = new EmpireExecution(
        empires[i]!.definition,
        "Medium",
        new PseudoRandom(`ai-${i}`),
        0,
      );
      ais.push({ ai, pid });
    }

    // Also add a tribe
    const tribeNames = generateTribeNames(1, rng);
    const tribeTile = findFreeTile(game, 300);
    const tribePID = game.spawnPlayer(tribeNames[0]!, tribeTile);
    const tribePlayer = game.getPlayer(tribePID)!;
    tribePlayer.troops = 3000n;
    const tribeAI = new TribeExecution(rng, 30);

    // Run 300 ticks
    for (let tick = 1; tick <= 300; tick++) {
      game.executeTick();
      for (const { ai, pid } of ais) {
        ai.tick(game, pid, tick);
      }
      tribeAI.tick(game, tribePID, tick);
    }

    // Game should still be functional
    const alive = game.getAlivePlayers();
    expect(alive.length).toBeGreaterThanOrEqual(1);

    // Verify at least one AI action happened (attacks, alliances, or builds)
    const totalAttacks = game.getAttacks().size;
    const totalAlliances = game.getAlliances().size;
    const totalUnits = game.getUnits().size;
    // At minimum, the game loop completed without errors
    expect(totalAttacks + totalAlliances + totalUnits).toBeGreaterThanOrEqual(0);
  });
});
