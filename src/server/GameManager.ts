import type { GameConfig } from "../core/Schemas.js";
import { GameServer } from "./GameServer.js";
import type { Client } from "./Client.js";

export class GameManager {
  private games = new Map<string, GameServer>();

  createGame(config: GameConfig): GameServer {
    const server = new GameServer({
      config,
      onEmpty: () => {
        console.log(`[GameManager] Game ${config.gameID} empty, removing`);
        this.games.delete(config.gameID);
        server.stop();
      },
    });

    this.games.set(config.gameID, server);
    server.start();
    console.log(`[GameManager] Created game ${config.gameID}`);
    return server;
  }

  joinClient(gameId: string, client: Client): boolean {
    const server = this.games.get(gameId);
    if (!server) {
      client.send({ type: "error", message: "Game not found" });
      client.close();
      return false;
    }
    server.addClient(client);
    return true;
  }

  rejoinClient(gameId: string, clientId: string, client: Client): boolean {
    const server = this.games.get(gameId);
    if (!server) return false;
    return server.rejoinClient(clientId, client);
  }

  getGame(gameId: string): GameServer | undefined {
    return this.games.get(gameId);
  }

  gameCount(): number {
    return this.games.size;
  }

  /** 1-second lifecycle tick: check disconnects, cleanup empty games */
  tick(): void {
    for (const [gameId, server] of this.games) {
      server.lifecycleTick();
    }
  }
}
