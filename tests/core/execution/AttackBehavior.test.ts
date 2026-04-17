import { describe, it, expect } from "vitest";
import { PseudoRandom } from "@core/PseudoRandom";
import {
  randomTroopAllocation,
  maybeAttack,
  scoreTarget,
  attackBestTarget,
  findAttackSourceTile,
} from "@core/execution/empire/AttackBehavior";
import { GameImpl } from "@core/game/GameImpl";
import type { GameConfig } from "@core/Schemas";

const TEST_CONFIG: GameConfig = {
  gameID: "atk-test" as GameConfig["gameID"],
  mapWidth: 20,
  mapHeight: 20,
  maxPlayers: 8,
  seed: "atk-seed",
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

describe("AttackBehavior", () => {
  describe("randomTroopAllocation", () => {
    it("generates values within expected ranges", () => {
      const rng = new PseudoRandom("alloc-1");
      const alloc = randomTroopAllocation(rng);
      expect(alloc.triggerRatio).toBeGreaterThanOrEqual(0.5);
      expect(alloc.triggerRatio).toBeLessThanOrEqual(0.6);
      expect(alloc.reserveRatio).toBeGreaterThanOrEqual(0.3);
      expect(alloc.reserveRatio).toBeLessThanOrEqual(0.4);
      expect(alloc.expandRatio).toBeGreaterThanOrEqual(0.1);
      expect(alloc.expandRatio).toBeLessThanOrEqual(0.2);
    });
  });

  describe("maybeAttack", () => {
    it("returns false when troops are below minimum", () => {
      const game = new GameImpl(TEST_CONFIG);
      const t = findFreeTile(game);
      const pid = game.spawnPlayer("Test", t);
      const player = game.getPlayer(pid)!;
      player.troops = 10n;

      const alloc = { triggerRatio: 0.5, reserveRatio: 0.3, expandRatio: 0.2 };
      expect(maybeAttack(player, alloc)).toBe(false);
    });

    it("returns true when troops are sufficient", () => {
      const game = new GameImpl(TEST_CONFIG);
      const t = findFreeTile(game);
      const pid = game.spawnPlayer("Test", t);
      const player = game.getPlayer(pid)!;
      player.troops = 1000n;

      const alloc = { triggerRatio: 0.5, reserveRatio: 0.3, expandRatio: 0.2 };
      expect(maybeAttack(player, alloc)).toBe(true);
    });
  });

  describe("scoreTarget", () => {
    it("lower troops and territory gives lower score", () => {
      const game = new GameImpl(TEST_CONFIG);
      const t1 = findFreeTile(game);
      const pid1 = game.spawnPlayer("Weak", t1);
      const weak = game.getPlayer(pid1)!;
      weak.troops = 50n;

      const t2 = findFreeTile(game, t1 + 10);
      const pid2 = game.spawnPlayer("Strong", t2);
      const strong = game.getPlayer(pid2)!;
      strong.troops = 5000n;

      expect(scoreTarget(weak)).toBeLessThan(scoreTarget(strong));
    });
  });

  describe("attackBestTarget", () => {
    it("selects weakest non-allied target", () => {
      const game = new GameImpl(TEST_CONFIG);
      const t1 = findFreeTile(game);
      const pid1 = game.spawnPlayer("Me", t1);
      const me = game.getPlayer(pid1)!;

      const t2 = findFreeTile(game, t1 + 10);
      const pid2 = game.spawnPlayer("Weak", t2);
      const weak = game.getPlayer(pid2)!;
      weak.troops = 50n;

      const t3 = findFreeTile(game, t2 + 10);
      const pid3 = game.spawnPlayer("Strong", t3);
      const strong = game.getPlayer(pid3)!;
      strong.troops = 5000n;

      const best = attackBestTarget(game, me, [pid2, pid3]);
      expect(best).not.toBeNull();
      expect(best!.id).toBe(pid2);
    });

    it("skips allied targets", () => {
      const game = new GameImpl(TEST_CONFIG);
      const t1 = findFreeTile(game);
      const pid1 = game.spawnPlayer("Me", t1);
      const me = game.getPlayer(pid1)!;

      const t2 = findFreeTile(game, t1 + 10);
      const pid2 = game.spawnPlayer("Ally", t2);
      me.addAlliance(pid2, 9999);

      const best = attackBestTarget(game, me, [pid2]);
      expect(best).toBeNull();
    });
  });
});
