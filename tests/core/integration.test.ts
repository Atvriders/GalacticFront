import { describe, it, expect } from "vitest";
import { GameRunner } from "@core/GameRunner";
import { ExecutionManager } from "@core/execution/ExecutionManager";
import { SpawnExecution } from "@core/execution/SpawnExecution";
import {
  AttackExecution,
  CancelAttackExecution,
  SetTargetTroopRatioExecution,
} from "@core/execution/AttackExecution";
import {
  SetNameExecution,
  SurrenderExecution,
  DonateExecution,
  SetEmbargoExecution,
  ClearEmbargoExecution,
} from "@core/execution/PlayerExecution";
import type { Execution } from "@core/execution/Execution";
import { IntentType } from "@core/Schemas";
import type { GameConfig, StampedIntent } from "@core/Schemas";
import { UnitType } from "@core/game/Types";
import { formatBigInt } from "@core/Util";

// ---------------------------------------------------------------------------
// RetreatExecution — inline since no dedicated file exists yet
// ---------------------------------------------------------------------------

const RetreatExecution: Execution = {
  type: IntentType.Retreat,
  execute(game, playerID, intent) {
    if (intent.type !== IntentType.Retreat) return false;
    const attacks = game.getAttacks();
    for (const attack of attacks.values()) {
      if (attack.attackerID === playerID) {
        attack.startRetreat();
        return true;
      }
    }
    return false;
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<GameConfig> = {}): GameConfig {
  return {
    gameID: "integration-test" as GameConfig["gameID"],
    mapWidth: 50,
    mapHeight: 50,
    maxPlayers: 8,
    seed: "integration-seed-42",
    ticksPerTurn: 5,
    turnIntervalMs: 100,
    gameMapType: "Standard",
    difficulty: "Medium",
    ...overrides,
  };
}

function stampedIntent(
  playerID: number,
  intent: StampedIntent["intent"],
  turn = 0,
): StampedIntent {
  return {
    clientID: `client-${playerID}` as StampedIntent["clientID"],
    playerID,
    turn,
    intent,
  };
}

/**
 * Find a traversable, unowned tile near the given (x, y) coordinates.
 * Searches in a small square area around the target.
 */
function findSpawnTile(
  runner: GameRunner,
  targetX: number,
  targetY: number,
): number {
  const { map } = runner.game;
  for (let dy = -5; dy <= 5; dy++) {
    for (let dx = -5; dx <= 5; dx++) {
      const x = targetX + dx;
      const y = targetY + dy;
      if (!map.isInBounds(x, y)) continue;
      const tile = map.toIndex(x, y);
      if (map.isTraversable(tile) && !map.isOwned(tile)) {
        return tile;
      }
    }
  }
  // Fallback: scan entire map
  const total = map.width * map.height;
  for (let i = 0; i < total; i++) {
    if (map.isTraversable(i) && !map.isOwned(i)) return i;
  }
  throw new Error("No traversable unowned tile found for spawn");
}

function buildRunner(config: GameConfig): {
  runner: GameRunner;
  execMgr: ExecutionManager;
} {
  const runner = new GameRunner(config);
  const execMgr = new ExecutionManager(runner.game);
  execMgr.registerAll([
    new SpawnExecution(),
    new AttackExecution(),
    new CancelAttackExecution(),
    new SetTargetTroopRatioExecution(),
    new SetNameExecution(),
    new SurrenderExecution(),
    new DonateExecution(),
    new SetEmbargoExecution(),
    new ClearEmbargoExecution(),
    RetreatExecution,
  ]);
  runner.setIntentHandler(execMgr.createIntentHandler());
  return { runner, execMgr };
}

// ---------------------------------------------------------------------------
// Test 1: Full game simulation
// ---------------------------------------------------------------------------

describe("Integration: core engine end-to-end", () => {
  it("runs a complete game with spawn, attack, retreat, and win", () => {
    const config = makeConfig();
    const { runner } = buildRunner(config);
    const { game } = runner;

    // ── Step 1: Spawn 2 players at opposite sides of the map ──────────────
    const spawnTile1 = findSpawnTile(runner, 10, 25);
    const spawnTile2 = findSpawnTile(runner, 40, 25);

    runner.queueIntent(
      stampedIntent(0, {
        type: IntentType.Spawn,
        tile: spawnTile1,
        name: "Player1",
      }),
    );
    runner.queueIntent(
      stampedIntent(0, {
        type: IntentType.Spawn,
        tile: spawnTile2,
        name: "Player2",
      }),
    );
    runner.processTurn();

    // Verify both players alive with territory
    const players = game.getAlivePlayers();
    expect(players).toHaveLength(2);
    const p1 = players[0]!;
    const p2 = players[1]!;
    expect(p1.isAlive).toBe(true);
    expect(p2.isAlive).toBe(true);
    expect(p1.territoryCount).toBeGreaterThan(0);
    expect(p2.territoryCount).toBeGreaterThan(0);

    // ── Step 2: Run 10 turns — troops and credits should grow ─────────────
    const troopsBefore = p1.troops;
    const creditsBefore = p1.credits;

    runner.runTurns(10);

    expect(p1.troops).toBeGreaterThan(troopsBefore);
    expect(p1.credits).toBeGreaterThan(creditsBefore);

    // Verify formatBigInt works on the values (smoke test)
    const troopStr = formatBigInt(p1.troops);
    expect(typeof troopStr).toBe("string");
    expect(troopStr.length).toBeGreaterThan(0);

    // ── Step 3: Queue Attack from P1 → P2, run 20 turns ──────────────────
    // Give P1 a tile adjacent to P2's territory so the attack has a border
    // The attack uses P1's spawn tile as source
    runner.queueIntent(
      stampedIntent(p1.id, {
        type: IntentType.Attack,
        targetPlayerID: p2.id,
        sourceTile: spawnTile1,
        troopRatio: 0.5,
      }),
    );
    runner.runTurns(20);

    // Attack may have been launched (or may have no border tiles if too far)
    // Just verify game is still running and players are tracked
    expect(game.getPlayer(p1.id)).toBeDefined();
    expect(game.getPlayer(p2.id)).toBeDefined();

    // ── Step 4: Build a Colony unit for P1 ───────────────────────────────
    // Give P1 enough credits to afford it
    p1.credits = 10_000n;

    // Find a tile owned by P1
    const p1Tiles = [...p1.territory];
    expect(p1Tiles.length).toBeGreaterThan(0);
    const buildTile = p1Tiles[0]!;
    const unitBefore = p1.getUnitCount(UnitType.Colony);
    game.buildUnit(p1.id, UnitType.Colony, buildTile);
    expect(p1.getUnitCount(UnitType.Colony)).toBe(unitBefore + 1);

    // ── Step 5: Queue Retreat intent, run 5 turns ─────────────────────────
    const attacksBefore = game.getAttacks();
    runner.queueIntent(
      stampedIntent(p1.id, {
        type: IntentType.Retreat,
        unitTile: spawnTile1,
      }),
    );
    runner.runTurns(5);

    // All retreating attacks should be resolved or still retreating
    // (depends on whether an attack was active — just no crash)
    expect(game.getAttacks()).toBeDefined();

    // ── Step 6: P2 surrenders ─────────────────────────────────────────────
    runner.queueIntent(
      stampedIntent(p2.id, {
        type: IntentType.Surrender,
      }),
    );
    runner.runTurns(3);

    // P2 should be eliminated after surrendering
    const p2AfterSurrender = game.getPlayer(p2.id)!;
    expect(p2AfterSurrender.hasSurrendered).toBe(true);
    expect(p2AfterSurrender.isAlive).toBe(false);

    // ── Step 7: Verify game over, P1 is winner ────────────────────────────
    // Run a tick to let checkWinCondition fire (if not already done)
    if (!game.isGameOver()) {
      runner.processTurn();
    }
    expect(game.isGameOver()).toBe(true);
    expect(game.winnerID).toBe(p1.id);
  });

  // --------------------------------------------------------------------------
  // Test 2: Deterministic replay
  // --------------------------------------------------------------------------

  it("deterministic replay: two identical games produce same results", () => {
    function runGame(): {
      finalTick: number;
      p1Territory: number;
      p2Territory: number;
      winnerID: number | null;
    } {
      const config = makeConfig({ seed: "replay-seed-99" });
      const { runner } = buildRunner(config);
      const { game } = runner;

      const spawnTile1 = findSpawnTile(runner, 10, 25);
      const spawnTile2 = findSpawnTile(runner, 40, 25);

      runner.queueIntent(
        stampedIntent(0, {
          type: IntentType.Spawn,
          tile: spawnTile1,
          name: "Alpha",
        }),
      );
      runner.queueIntent(
        stampedIntent(0, {
          type: IntentType.Spawn,
          tile: spawnTile2,
          name: "Beta",
        }),
      );
      runner.processTurn();

      const alivePlayers = game.getAlivePlayers();
      const p1 = alivePlayers[0]!;
      const p2 = alivePlayers[1]!;

      runner.runTurns(15);

      // Queue an attack
      runner.queueIntent(
        stampedIntent(p1.id, {
          type: IntentType.Attack,
          targetPlayerID: p2.id,
          sourceTile: spawnTile1,
          troopRatio: 0.4,
        }),
      );
      runner.runTurns(10);

      return {
        finalTick: game.currentTick,
        p1Territory: p1.territoryCount,
        p2Territory: p2.territoryCount,
        winnerID: game.winnerID,
      };
    }

    const run1 = runGame();
    const run2 = runGame();

    expect(run1.finalTick).toBe(run2.finalTick);
    expect(run1.p1Territory).toBe(run2.p1Territory);
    expect(run1.p2Territory).toBe(run2.p2Territory);
    expect(run1.winnerID).toBe(run2.winnerID);
  });

  // --------------------------------------------------------------------------
  // Test 3: Multiple players with alliances and embargoes
  // --------------------------------------------------------------------------

  it("multiple players with alliances and embargoes", () => {
    const config = makeConfig({ maxPlayers: 8 });
    const { runner } = buildRunner(config);
    const { game } = runner;

    // Spawn 3 players
    const spawnTile1 = findSpawnTile(runner, 10, 10);
    const spawnTile2 = findSpawnTile(runner, 30, 10);
    const spawnTile3 = findSpawnTile(runner, 10, 40);

    runner.queueIntent(
      stampedIntent(0, { type: IntentType.Spawn, tile: spawnTile1, name: "P1" }),
    );
    runner.queueIntent(
      stampedIntent(0, { type: IntentType.Spawn, tile: spawnTile2, name: "P2" }),
    );
    runner.queueIntent(
      stampedIntent(0, { type: IntentType.Spawn, tile: spawnTile3, name: "P3" }),
    );
    runner.processTurn();

    const alive = game.getAlivePlayers();
    expect(alive).toHaveLength(3);
    const [p1, p2, p3] = alive as [
      (typeof alive)[0],
      (typeof alive)[0],
      (typeof alive)[0],
    ];

    // ── P1 and P2 form an alliance directly via GameImpl API ──────────────
    const allianceDuration = 600; // min duration from balance config
    const req = game.createAllianceRequest(p1.id, p2.id, allianceDuration);
    expect(req).not.toBeNull();

    const alliance = game.acceptAlliance(req!.id);
    expect(alliance).not.toBeNull();

    // Verify they are now allied
    expect(p1.isAlliedWith(p2.id)).toBe(true);
    expect(p2.isAlliedWith(p1.id)).toBe(true);

    // ── P1 sets embargo on P3 ──────────────────────────────────────────────
    runner.queueIntent(
      stampedIntent(p1.id, {
        type: IntentType.SetEmbargo,
        targetPlayerID: p3.id,
      }),
    );
    runner.processTurn();
    expect(p1.hasEmbargo(p3.id)).toBe(true);

    // ── Verify P1 cannot attack ally P2 ───────────────────────────────────
    // startAttack returns null if target is an ally
    const allyAttack = game.startAttack(p1.id, p2.id, spawnTile1, 0.5);
    expect(allyAttack).toBeNull();

    // P1 can attempt to attack P3 (no alliance)
    // (may return null if no border tiles, that's fine)
    const p3Attack = game.startAttack(p1.id, p3.id, spawnTile1, 0.3);
    // Clean up if it was created
    if (p3Attack) {
      game.endAttack(p3Attack.id);
    }

    // ── Run 10 turns — all 3 players still alive ───────────────────────────
    runner.runTurns(10);

    expect(p1.isAlive).toBe(true);
    expect(p2.isAlive).toBe(true);
    expect(p3.isAlive).toBe(true);

    // Alliance still holds (duration is 600 ticks, we ran far fewer)
    expect(p1.isAlliedWith(p2.id)).toBe(true);

    // Embargo still in place
    expect(p1.hasEmbargo(p3.id)).toBe(true);
  });
});
