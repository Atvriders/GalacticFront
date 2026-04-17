import { describe, it, expect, vi, beforeEach } from "vitest";
import { GameRunner } from "@core/GameRunner";
import type { GameConfig, StampedIntent } from "@core/Schemas";
import { IntentType } from "@core/Schemas";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<GameConfig> = {}): GameConfig {
  return {
    gameID: "test-game" as GameConfig["gameID"],
    mapWidth: 10,
    mapHeight: 10,
    maxPlayers: 4,
    seed: "seed-42",
    ticksPerTurn: 3,
    turnIntervalMs: 1000,
    gameMapType: "Standard",
    difficulty: "Medium",
    ...overrides,
  };
}

function makeIntent(
  playerID: number,
  overrides: Partial<StampedIntent> = {},
): StampedIntent {
  return {
    clientID: `client-${playerID}` as StampedIntent["clientID"],
    playerID,
    turn: 1,
    intent: { type: IntentType.Ping, tile: 0 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GameRunner", () => {
  let runner: GameRunner;

  beforeEach(() => {
    runner = new GameRunner(makeConfig());
  });

  // --- Initialization ---

  describe("initialization", () => {
    it("starts at turn 0", () => {
      expect(runner.getCurrentTurn()).toBe(0);
    });

    it("is not game-over at start", () => {
      expect(runner.isGameOver()).toBe(false);
    });

    it("exposes the GameImpl instance", () => {
      expect(runner.game).toBeDefined();
    });

    it("game tick starts at 0", () => {
      expect(runner.game.currentTick).toBe(0);
    });
  });

  // --- processTurn ---

  describe("processTurn()", () => {
    it("increments turn counter by 1 each call", () => {
      runner.processTurn();
      expect(runner.getCurrentTurn()).toBe(1);
      runner.processTurn();
      expect(runner.getCurrentTurn()).toBe(2);
    });

    it("advances tick count by ticksPerTurn per turn", () => {
      const ticksPerTurn = runner.game.config.ticksPerTurn;
      runner.processTurn();
      expect(runner.game.currentTick).toBe(ticksPerTurn * 1);
      runner.processTurn();
      expect(runner.game.currentTick).toBe(ticksPerTurn * 2);
    });

    it("returns TurnResult with the correct turn number", () => {
      const result = runner.processTurn();
      expect(result.turn).toBe(1);
    });

    it("returns TurnResult with updates and tileChanges arrays", () => {
      const result = runner.processTurn();
      expect(Array.isArray(result.updates)).toBe(true);
      expect(Array.isArray(result.tileChanges)).toBe(true);
    });
  });

  // --- runTurns ---

  describe("runTurns()", () => {
    it("processes N turns and returns N results", () => {
      const results = runner.runTurns(3);
      expect(results).toHaveLength(3);
      expect(runner.getCurrentTurn()).toBe(3);
    });

    it("results have sequential turn numbers", () => {
      const results = runner.runTurns(4);
      expect(results.map((r) => r.turn)).toEqual([1, 2, 3, 4]);
    });

    it("returns an empty array when count is 0", () => {
      const results = runner.runTurns(0);
      expect(results).toHaveLength(0);
    });
  });

  // --- Intent handler ---

  describe("intent handling", () => {
    it("calls intent handler for each queued intent during processTurn", () => {
      const handler = vi.fn();
      runner.setIntentHandler(handler);

      const intents = [makeIntent(1), makeIntent(2), makeIntent(3)];
      runner.queueIntents(intents);

      runner.processTurn();

      expect(handler).toHaveBeenCalledTimes(3);
      expect(handler).toHaveBeenNthCalledWith(1, intents[0]);
      expect(handler).toHaveBeenNthCalledWith(2, intents[1]);
      expect(handler).toHaveBeenNthCalledWith(3, intents[2]);
    });

    it("clears the queue after processing", () => {
      const handler = vi.fn();
      runner.setIntentHandler(handler);
      runner.queueIntent(makeIntent(1));
      runner.processTurn();

      // Second turn: no new intents queued
      runner.processTurn();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("queueIntent adds a single intent", () => {
      const handler = vi.fn();
      runner.setIntentHandler(handler);
      runner.queueIntent(makeIntent(5));
      runner.processTurn();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("does not throw if no intent handler is set and intents are queued", () => {
      runner.queueIntent(makeIntent(1));
      expect(() => runner.processTurn()).not.toThrow();
    });
  });

  // --- EventBus / turn_complete ---

  describe("turn_complete event", () => {
    it("emits turn_complete after each processTurn", () => {
      const listener = vi.fn();
      runner.on("turn_complete", listener);

      runner.processTurn();

      expect(listener).toHaveBeenCalledTimes(1);
      const payload = listener.mock.calls[0][0];
      expect(payload).toMatchObject({ turn: 1 });
    });

    it("emits turn_complete once per turn for multiple turns", () => {
      const listener = vi.fn();
      runner.on("turn_complete", listener);

      runner.runTurns(3);

      expect(listener).toHaveBeenCalledTimes(3);
    });

    it("turn_complete payload contains the TurnResult fields", () => {
      const listener = vi.fn();
      runner.on("turn_complete", listener);
      runner.processTurn();

      const result = listener.mock.calls[0][0];
      expect(result).toHaveProperty("turn");
      expect(result).toHaveProperty("updates");
      expect(result).toHaveProperty("tileChanges");
    });
  });

  // --- Game-over / early stop ---

  describe("game-over / early stop", () => {
    it("stops running turns early when game is over", () => {
      // Spawn two players then eliminate one to trigger game-over
      const p1 = runner.game.spawnPlayer("Alice", 0);
      const p2 = runner.game.spawnPlayer("Bob", 1);

      // Eliminate p2 so only one player remains → game over
      runner.game.eliminatePlayer(p2);

      expect(runner.isGameOver()).toBe(true);

      // With game already over, runTurns should stop immediately
      const results = runner.runTurns(5);
      expect(results).toHaveLength(0);
      expect(runner.getCurrentTurn()).toBe(0);
    });

    it("stops mid-run when game-over occurs", () => {
      // Use a config with very few max ticks so game ends quickly
      // maxGameTicks is on the balance config; easiest is to eliminate a player
      // manually via eliminatePlayer inside an intent handler.
      const p1 = runner.game.spawnPlayer("Alice", 0);
      const p2 = runner.game.spawnPlayer("Bob", 1);

      let callCount = 0;
      runner.setIntentHandler(() => {
        callCount++;
        // Eliminate p2 on first intent processed, triggering game over
        if (callCount === 1) {
          runner.game.eliminatePlayer(p2);
        }
      });

      // Queue an intent so the handler fires during turn 1
      runner.queueIntent(makeIntent(p1));

      // runTurns(3) should process turn 1 (game ends inside it) then stop
      const results = runner.runTurns(3);

      // Turn 1 is processed (game ends during its tick execution), so we get 1 result.
      // After turn 1, game is over → loop exits.
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(runner.isGameOver()).toBe(true);
    });
  });
});
