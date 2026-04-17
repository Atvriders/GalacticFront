import express from "express";
import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { GameManager } from "./GameManager.js";
import { WorkerLobbyService } from "./WorkerLobbyService.js";
import { Client } from "./Client.js";
import type { IpcMessage } from "./IpcMessages.js";

const WORKER_ID = parseInt(process.env.WORKER_ID ?? "0", 10);
const WORKER_PORT = parseInt(process.env.WORKER_PORT ?? "4000", 10);
const PATH_PREFIX = `/w${WORKER_ID}`;

export function startWorker(): void {
  const app = express();
  const server = http.createServer(app);

  const gameManager = new GameManager();
  const lobbyService = new WorkerLobbyService(WORKER_ID);

  // Health endpoint
  app.get(`${PATH_PREFIX}/health`, (_req, res) => {
    res.json({ worker: WORKER_ID, games: gameManager.gameCount() });
  });

  // WebSocket server
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = req.url ?? "";

    // Lobby WebSocket
    if (url === `${PATH_PREFIX}/lobbies`) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        lobbyService.addClient(ws);
      });
      return;
    }

    // Game WebSocket: /w{id}/game/{gameId}
    const gameMatch = url.match(
      new RegExp(`^${PATH_PREFIX}/game/([\\w-]+)$`),
    );
    if (gameMatch) {
      const gameId = gameMatch[1];
      wss.handleUpgrade(req, socket, head, (ws) => {
        const client = new Client(ws);
        gameManager.joinClient(gameId, client);
      });
      return;
    }

    socket.destroy();
  });

  // IPC from master
  process.on("message", (msg: IpcMessage) => {
    if (msg.type === "CreateGame") {
      gameManager.createGame(msg.config);
    }
    lobbyService.handleMasterMessage(msg);
  });

  // Lifecycle tick
  setInterval(() => {
    gameManager.tick();
  }, 1000);

  server.listen(WORKER_PORT, () => {
    console.log(`[Worker ${WORKER_ID}] Listening on :${WORKER_PORT}`);
    process.send?.({ type: "WorkerReady", workerId: WORKER_ID });
  });
}
