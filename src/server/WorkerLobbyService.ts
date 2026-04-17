import { WebSocket } from "ws";
import type { IpcMessage, LobbyInfo } from "./IpcMessages.js";

export class WorkerLobbyService {
  private workerId: number;
  private lobbyClients = new Set<WebSocket>();
  private currentLobbies: LobbyInfo[] = [];

  constructor(workerId: number) {
    this.workerId = workerId;
  }

  addClient(ws: WebSocket): void {
    this.lobbyClients.add(ws);

    // Send current lobby list immediately
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "lobbies", lobbies: this.currentLobbies }));
    }

    ws.on("close", () => {
      this.lobbyClients.delete(ws);
    });

    ws.on("error", () => {
      this.lobbyClients.delete(ws);
    });

    // Request fresh list from master
    process.send?.({ type: "LobbyListRequest", workerId: this.workerId });
  }

  handleMasterMessage(msg: IpcMessage): void {
    if (msg.type === "LobbiesBroadcast") {
      this.currentLobbies = msg.lobbies;
      this.streamLobbies();
    }
  }

  private streamLobbies(): void {
    const payload = JSON.stringify({
      type: "lobbies",
      lobbies: this.currentLobbies,
    });

    for (const ws of this.lobbyClients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }
}
