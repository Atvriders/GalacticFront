import { describe, it, expect, afterEach } from "vitest";
import { GameServer } from "../../src/server/GameServer.js";
import { Client } from "../../src/server/Client.js";
import { WebSocketServer, WebSocket } from "ws";
import type { GameConfig, GameID } from "../../src/core/Schemas.js";
import http from "node:http";

function makeConfig(gameId: string = "test-game-1"): GameConfig {
  return {
    gameID: gameId as GameID,
    mapWidth: 20,
    mapHeight: 20,
    maxPlayers: 4,
    seed: "integration-test",
    ticksPerTurn: 1,
    turnIntervalMs: 100,
    gameMapType: "Standard",
    difficulty: "Easy",
  };
}

function waitForMessage(
  ws: WebSocket,
  predicate: (data: unknown) => boolean,
  timeoutMs = 5000,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Timed out waiting for message"));
    }, timeoutMs);

    ws.on("message", function handler(raw: Buffer | string) {
      const data = JSON.parse(raw.toString());
      if (predicate(data)) {
        clearTimeout(timer);
        ws.removeListener("message", handler);
        resolve(data);
      }
    });
  });
}

describe("GameServer integration", () => {
  let httpServer: http.Server;
  let wss: WebSocketServer;
  let gameServer: GameServer;
  let port: number;
  const cleanups: (() => void)[] = [];

  afterEach(() => {
    gameServer?.stop();
    for (const fn of cleanups) fn();
    cleanups.length = 0;
    return new Promise<void>((resolve) => {
      if (wss) wss.close(() => {
        if (httpServer) httpServer.close(() => resolve());
        else resolve();
      });
      else resolve();
    });
  });

  it("two clients connect and exchange turns", async () => {
    // Set up a WebSocket server
    httpServer = http.createServer();
    wss = new WebSocketServer({ server: httpServer });

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr = httpServer.address();
        port = typeof addr === "object" && addr ? addr.port : 0;
        resolve();
      });
    });

    gameServer = new GameServer({ config: makeConfig() });

    // Handle WebSocket connections
    const clientPromises: Promise<unknown>[] = [];

    wss.on("connection", (ws) => {
      const client = new Client(ws);
      gameServer.addClient(client);
    });

    // Connect two clients
    const ws1 = new WebSocket(`ws://127.0.0.1:${port}`);
    const ws2 = new WebSocket(`ws://127.0.0.1:${port}`);

    cleanups.push(() => {
      if (ws1.readyState <= WebSocket.OPEN) ws1.close();
      if (ws2.readyState <= WebSocket.OPEN) ws2.close();
    });

    // Wait for both to get game_state
    const state1Promise = waitForMessage(
      ws1,
      (d: any) => d.type === "game_state",
    );
    const state2Promise = waitForMessage(
      ws2,
      (d: any) => d.type === "game_state",
    );

    await new Promise<void>((resolve) => {
      let ready = 0;
      const check = () => { if (++ready === 2) resolve(); };
      ws1.on("open", check);
      ws2.on("open", check);
    });

    const state1 = (await state1Promise) as any;
    const state2 = (await state2Promise) as any;

    expect(state1.type).toBe("game_state");
    expect(state2.type).toBe("game_state");
    expect(state1.playerId).toBe(0);
    expect(state2.playerId).toBe(1);

    // Start the game server ticking
    gameServer.start();

    // Client 1 submits an intent
    ws1.send(
      JSON.stringify({
        type: "submit_intent",
        intent: {
          type: "set_name",
          name: "Player1",
        },
      }),
    );

    // Client 2 submits an intent
    ws2.send(
      JSON.stringify({
        type: "submit_intent",
        intent: {
          type: "set_name",
          name: "Player2",
        },
      }),
    );

    // Wait for turn results to arrive at both clients
    const turn1 = await waitForMessage(
      ws1,
      (d: any) => d.type === "turn_result",
    );
    const turn2 = await waitForMessage(
      ws2,
      (d: any) => d.type === "turn_result",
    );

    expect((turn1 as any).type).toBe("turn_result");
    expect((turn2 as any).type).toBe("turn_result");
    expect((turn1 as any).turn).toBeGreaterThanOrEqual(1);
    expect((turn2 as any).turn).toBeGreaterThanOrEqual(1);

    // Both should get same turn number
    expect((turn1 as any).turn).toBe((turn2 as any).turn);

    gameServer.stop();
  }, 10000);

  it("client count tracks connections", async () => {
    httpServer = http.createServer();
    wss = new WebSocketServer({ server: httpServer });

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr = httpServer.address();
        port = typeof addr === "object" && addr ? addr.port : 0;
        resolve();
      });
    });

    gameServer = new GameServer({ config: makeConfig("count-test") });

    wss.on("connection", (ws) => {
      const client = new Client(ws);
      gameServer.addClient(client);
    });

    const ws1 = new WebSocket(`ws://127.0.0.1:${port}`);
    cleanups.push(() => {
      if (ws1.readyState <= WebSocket.OPEN) ws1.close();
    });

    await waitForMessage(ws1, (d: any) => d.type === "game_state");
    expect(gameServer.clientCount).toBe(1);
  }, 5000);
});
