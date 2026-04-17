import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClientGameRunner } from "@client/ClientGameRunner";
import { ServerMessageType } from "@core/Schemas";
import type { ClientGameConfig } from "@client/ClientGameRunner";

function makeClientConfig(): ClientGameConfig {
  return {
    gameConfig: {
      gameID: "test-game" as any,
      mapWidth: 10,
      mapHeight: 10,
      maxPlayers: 4,
      seed: "test",
      ticksPerTurn: 2,
      turnIntervalMs: 100,
      gameMapType: "Standard",
      difficulty: "Medium",
    },
    clientID: "client-1" as any,
    playerID: 1,
    wsUrl: "ws://localhost:9000/ws",
    useWorker: false, // Skip worker in tests
  };
}

describe("ClientGameRunner", () => {
  let runner: ClientGameRunner;

  beforeEach(() => {
    // Mock WebSocket
    (globalThis as any).WebSocket = class {
      onopen: (() => void) | null = null;
      onclose: (() => void) | null = null;
      onmessage: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readyState = 0;
      send() {}
      close() {}
    };

    runner = new ClientGameRunner();
  });

  it("should start in disconnected phase", () => {
    expect(runner.phase).toBe("disconnected");
  });

  it("should transition to spawning on game_state message", () => {
    const onPhaseChange = vi.fn();

    // Start will change to connecting
    runner.start(makeClientConfig(), { onPhaseChange });

    // Simulate server sending game state
    runner.onMessage({ type: ServerMessageType.GameState, state: {} });
    expect(runner.phase).toBe("spawning");
  });

  it("should transition to playing on turn_result", () => {
    runner.start(makeClientConfig());
    runner.onMessage({ type: ServerMessageType.GameState, state: {} });
    runner.onMessage({
      type: ServerMessageType.TurnResult,
      turn: 1,
      updates: [],
      tileChanges: [],
    });
    expect(runner.phase).toBe("playing");
  });

  it("should transition to gameover on game_over", () => {
    runner.start(makeClientConfig());
    runner.onMessage({ type: ServerMessageType.GameOver, winnerID: 1 });
    expect(runner.phase).toBe("gameover");
  });

  it("should call onError for error messages", () => {
    const onError = vi.fn();
    runner.start(makeClientConfig(), { onError });
    runner.onMessage({
      type: ServerMessageType.Error,
      message: "test error",
    });
    expect(onError).toHaveBeenCalledWith("test error");
  });

  it("should apply game updates to view when no worker", () => {
    runner.start(makeClientConfig());
    runner.onMessage({
      type: ServerMessageType.TurnResult,
      turn: 1,
      updates: [
        {
          type: "PlayerSpawned",
          tick: 1,
          payload: { playerID: 1, name: "Test" },
        },
      ],
      tileChanges: [],
    });

    expect(runner.gameView.players()).toHaveLength(1);
  });

  it("should stop cleanly", () => {
    runner.start(makeClientConfig());
    runner.stop();
    expect(runner.phase).toBe("disconnected");
  });

  it("should ignore invalid messages", () => {
    runner.start(makeClientConfig());
    runner.onMessage(null);
    runner.onMessage("string");
    runner.onMessage({ type: "unknown_type" });
    expect(runner.phase).toBe("connecting");
  });
});
