import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExecutionManager } from "../../../src/core/execution/ExecutionManager";
import type { Execution } from "../../../src/core/execution/Execution";
import { GameImpl } from "../../../src/core/game/GameImpl";
import { IntentType } from "../../../src/core/Schemas";
import type { GameConfig, StampedIntent } from "../../../src/core/Schemas";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_GAME_CONFIG: GameConfig = {
  gameID: "test-game",
  mapWidth: 100,
  mapHeight: 100,
  maxPlayers: 8,
  seed: "seed-1",
  ticksPerTurn: 10,
  turnIntervalMs: 1000,
  gameMapType: "Standard",
  difficulty: "Medium",
};

function makeGame(): GameImpl {
  return new GameImpl(TEST_GAME_CONFIG);
}

/** A minimal StampedIntent carrying a Surrender intent (no extra fields). */
function surrenderStamped(playerID = 1): StampedIntent {
  return {
    clientID: "client-1",
    playerID,
    turn: 0,
    intent: { type: IntentType.Surrender },
  };
}

/** A minimal StampedIntent carrying a SetTargetTroopRatio intent. */
function troopRatioStamped(playerID = 1): StampedIntent {
  return {
    clientID: "client-1",
    playerID,
    turn: 0,
    intent: { type: IntentType.SetTargetTroopRatio, ratio: 0.5 },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ExecutionManager", () => {
  let game: GameImpl;
  let manager: ExecutionManager;

  beforeEach(() => {
    game = makeGame();
    manager = new ExecutionManager(game);
  });

  // --- register / hasHandler / handlerCount ---

  describe("register()", () => {
    it("adds a handler so hasHandler returns true", () => {
      const handler: Execution = {
        type: IntentType.Surrender,
        execute: vi.fn().mockReturnValue(true),
      };
      manager.register(handler);
      expect(manager.hasHandler(IntentType.Surrender)).toBe(true);
    });

    it("increments handlerCount", () => {
      expect(manager.handlerCount()).toBe(0);
      manager.register({
        type: IntentType.Surrender,
        execute: vi.fn().mockReturnValue(true),
      });
      expect(manager.handlerCount()).toBe(1);
    });

    it("hasHandler returns false for unregistered type", () => {
      expect(manager.hasHandler(IntentType.Attack)).toBe(false);
    });
  });

  // --- registerAll ---

  describe("registerAll()", () => {
    it("registers every handler in the array", () => {
      const h1: Execution = { type: IntentType.Surrender, execute: vi.fn().mockReturnValue(true) };
      const h2: Execution = { type: IntentType.SetTargetTroopRatio, execute: vi.fn().mockReturnValue(true) };

      manager.registerAll([h1, h2]);

      expect(manager.handlerCount()).toBe(2);
      expect(manager.hasHandler(IntentType.Surrender)).toBe(true);
      expect(manager.hasHandler(IntentType.SetTargetTroopRatio)).toBe(true);
    });
  });

  // --- process ---

  describe("process()", () => {
    it("routes to the correct handler and returns its result", () => {
      const execute = vi.fn().mockReturnValue(true);
      manager.register({ type: IntentType.Surrender, execute });

      const result = manager.process(surrenderStamped(7));

      expect(execute).toHaveBeenCalledTimes(1);
      expect(execute).toHaveBeenCalledWith(game, 7, { type: IntentType.Surrender });
      expect(result).toBe(true);
    });

    it("returns false for an unregistered intent type", () => {
      const result = manager.process(surrenderStamped());
      expect(result).toBe(false);
    });

    it("passes through execute returning false", () => {
      const execute = vi.fn().mockReturnValue(false);
      manager.register({ type: IntentType.Surrender, execute });
      expect(manager.process(surrenderStamped())).toBe(false);
    });
  });

  // --- validation ---

  describe("validate() integration", () => {
    it("calls validate before execute and skips execute when validation fails", () => {
      const validate = vi.fn().mockReturnValue("not allowed");
      const execute = vi.fn().mockReturnValue(true);

      manager.register({ type: IntentType.Surrender, execute, validate });

      const result = manager.process(surrenderStamped());

      expect(validate).toHaveBeenCalledTimes(1);
      expect(execute).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it("calls execute when validate returns null", () => {
      const validate = vi.fn().mockReturnValue(null);
      const execute = vi.fn().mockReturnValue(true);

      manager.register({ type: IntentType.Surrender, execute, validate });

      const result = manager.process(surrenderStamped());

      expect(validate).toHaveBeenCalledTimes(1);
      expect(execute).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
    });

    it("skips validate when it is not defined on the handler", () => {
      const execute = vi.fn().mockReturnValue(true);
      // No validate property
      manager.register({ type: IntentType.Surrender, execute });

      expect(manager.process(surrenderStamped())).toBe(true);
      expect(execute).toHaveBeenCalledTimes(1);
    });
  });

  // --- processAll ---

  describe("processAll()", () => {
    it("processes all intents in order and returns success count", () => {
      const surrenderExecute = vi.fn().mockReturnValue(true);
      const ratioExecute = vi.fn().mockReturnValue(true);

      manager.registerAll([
        { type: IntentType.Surrender, execute: surrenderExecute },
        { type: IntentType.SetTargetTroopRatio, execute: ratioExecute },
      ]);

      const count = manager.processAll([surrenderStamped(), troopRatioStamped(), surrenderStamped()]);

      expect(count).toBe(3);
      expect(surrenderExecute).toHaveBeenCalledTimes(2);
      expect(ratioExecute).toHaveBeenCalledTimes(1);
    });

    it("counts only successful executions", () => {
      manager.register({ type: IntentType.Surrender, execute: vi.fn().mockReturnValue(false) });

      // 1 surrender (fails) + 1 unregistered (troopRatio) = 0 successes
      const count = manager.processAll([surrenderStamped(), troopRatioStamped()]);
      expect(count).toBe(0);
    });

    it("returns 0 for an empty array", () => {
      expect(manager.processAll([])).toBe(0);
    });
  });

  // --- createIntentHandler ---

  describe("createIntentHandler()", () => {
    it("returns a callable function", () => {
      const fn = manager.createIntentHandler();
      expect(typeof fn).toBe("function");
    });

    it("the returned function delegates to process()", () => {
      const execute = vi.fn().mockReturnValue(true);
      manager.register({ type: IntentType.Surrender, execute });

      const handler = manager.createIntentHandler();
      handler(surrenderStamped(3));

      expect(execute).toHaveBeenCalledTimes(1);
      expect(execute).toHaveBeenCalledWith(game, 3, { type: IntentType.Surrender });
    });

    it("the returned function returns void (undefined)", () => {
      manager.register({ type: IntentType.Surrender, execute: vi.fn().mockReturnValue(true) });
      const handler = manager.createIntentHandler();
      const result = handler(surrenderStamped());
      expect(result).toBeUndefined();
    });
  });
});
