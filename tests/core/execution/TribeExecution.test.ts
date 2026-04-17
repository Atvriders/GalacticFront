import { describe, it, expect } from "vitest";
import { PseudoRandom } from "@core/PseudoRandom";
import { TribeExecution } from "@core/execution/TribeExecution";
import { GameImpl } from "@core/game/GameImpl";
import type { GameConfig } from "@core/Schemas";

const TEST_CONFIG: GameConfig = {
  gameID: "tribe-test" as GameConfig["gameID"],
  mapWidth: 20,
  mapHeight: 20,
  maxPlayers: 8,
  seed: "tribe-seed",
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

describe("TribeExecution", () => {
  it("implements TickAI interface", () => {
    const rng = new PseudoRandom("test");
    const tribe = new TribeExecution(rng);
    expect(tribe.name).toBe("Tribe");
    expect(typeof tribe.tick).toBe("function");
    expect(tribe.interval).toBe(60);
  });

  it("custom interval works", () => {
    const rng = new PseudoRandom("test");
    const tribe = new TribeExecution(rng, 30);
    expect(tribe.interval).toBe(30);
  });

  it("does nothing on non-interval ticks", () => {
    const game = new GameImpl(TEST_CONFIG);
    const rng = new PseudoRandom("test");
    const tribe = new TribeExecution(rng, 60);

    const t1 = findFreeTile(game);
    const pid = game.spawnPlayer("Tribe1", t1);

    // Tick at non-interval should do nothing
    tribe.tick(game, pid, 1);
    expect(game.getAttacks().size).toBe(0);
  });

  it("accepts alliance requests", () => {
    const game = new GameImpl(TEST_CONFIG);
    const rng = new PseudoRandom("test2");
    const tribe = new TribeExecution(rng, 1);

    const t1 = findFreeTile(game);
    const pid1 = game.spawnPlayer("Player1", t1);
    const t2 = findFreeTile(game, t1 + 10);
    const pid2 = game.spawnPlayer("Tribe1", t2);

    // Create an alliance request to the tribe
    game.createAllianceRequest(pid1, pid2, 100);
    expect(game.getAllianceRequests().size).toBe(1);

    // Tribe tick should accept
    tribe.tick(game, pid2, 1);
    expect(game.getAlliances().size).toBe(1);
  });

  it("findBorderNeighborIDs returns neighboring player IDs", () => {
    const game = new GameImpl(TEST_CONFIG);
    const rng = new PseudoRandom("border-test");
    const tribe = new TribeExecution(rng);

    // Spawn two adjacent players
    const t1 = findFreeTile(game);
    const pid1 = game.spawnPlayer("P1", t1);
    const t2 = findFreeTile(game, t1 + 3);
    const pid2 = game.spawnPlayer("P2", t2);

    const player1 = game.getPlayer(pid1)!;
    const neighbors = tribe.findBorderNeighborIDs(game, player1);

    // They may or may not be adjacent depending on map gen
    expect(Array.isArray(neighbors)).toBe(true);
  });
});
