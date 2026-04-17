import type { WorkerInfo } from "./Master.js";
import type { LobbyInfo, IpcMessage } from "./IpcMessages.js";
import type { GameConfig, GameID } from "../core/Schemas.js";
import { v4 as uuidv4 } from "uuid";

const BROADCAST_INTERVAL_MS = 500;
const MIN_FFA_LOBBIES = 2;
const MIN_TEAM_LOBBIES = 1;
const MIN_SPECIAL_LOBBIES = 1;

export class MasterLobbyService {
  private lobbies = new Map<string, LobbyInfo>();
  private workers: Map<number, WorkerInfo>;
  private broadcastTimer: ReturnType<typeof setInterval> | null = null;

  constructor(workers: Map<number, WorkerInfo>) {
    this.workers = workers;
  }

  start(): void {
    this.broadcastTimer = setInterval(() => {
      this.ensureMinimumLobbies();
      this.broadcastLobbies();
    }, BROADCAST_INTERVAL_MS);
  }

  stop(): void {
    if (this.broadcastTimer) {
      clearInterval(this.broadcastTimer);
      this.broadcastTimer = null;
    }
  }

  handleWorkerMessage(
    workerId: number,
    msg: { type: string; [key: string]: unknown },
  ): void {
    if (msg.type === "UpdateLobby") {
      const lobby = (msg as IpcMessage & { type: "UpdateLobby" }).lobby;
      this.lobbies.set(lobby.gameId, lobby);
    }
    if (msg.type === "LobbyListRequest") {
      const worker = this.workers.get(workerId);
      if (worker) {
        worker.worker.send({
          type: "LobbiesBroadcast",
          lobbies: [...this.lobbies.values()],
        });
      }
    }
  }

  private ensureMinimumLobbies(): void {
    const readyWorkers = [...this.workers.values()].filter((w) => w.ready);
    if (readyWorkers.length === 0) return;

    const ffaCount = this.countByMode("FFA");
    const teamCount = this.countByMode("Team");
    const specialCount = this.countByMode("Special");

    for (let i = ffaCount; i < MIN_FFA_LOBBIES; i++) {
      this.createLobby("FFA", readyWorkers);
    }
    for (let i = teamCount; i < MIN_TEAM_LOBBIES; i++) {
      this.createLobby("Team", readyWorkers);
    }
    for (let i = specialCount; i < MIN_SPECIAL_LOBBIES; i++) {
      this.createLobby("Special", readyWorkers);
    }
  }

  private countByMode(mode: LobbyInfo["mode"]): number {
    let count = 0;
    for (const lobby of this.lobbies.values()) {
      if (lobby.mode === mode) count++;
    }
    return count;
  }

  private createLobby(
    mode: LobbyInfo["mode"],
    readyWorkers: WorkerInfo[],
  ): void {
    // Find least-loaded worker
    const worker = readyWorkers.reduce((a, b) =>
      a.gameCount <= b.gameCount ? a : b,
    );

    const gameId = uuidv4();
    const maxPlayers = mode === "FFA" ? 8 : mode === "Team" ? 4 : 6;

    const config: GameConfig = {
      gameID: gameId as GameID,
      mapWidth: 100,
      mapHeight: 100,
      maxPlayers,
      seed: gameId,
      ticksPerTurn: 1,
      turnIntervalMs: 100,
      gameMapType: "Standard",
      difficulty: "Medium",
    };

    const lobby: LobbyInfo = {
      gameId,
      name: `${mode} Game`,
      mode,
      mapType: "Standard",
      maxPlayers,
      currentPlayers: 0,
      startTime: Date.now() + 60_000, // 60s from now
      workerId: worker.id,
    };

    this.lobbies.set(gameId, lobby);
    worker.gameCount++;

    // Tell worker to create the game
    worker.worker.send({ type: "CreateGame", config });
  }

  private broadcastLobbies(): void {
    const lobbies = [...this.lobbies.values()];
    for (const worker of this.workers.values()) {
      if (worker.ready) {
        worker.worker.send({ type: "LobbiesBroadcast", lobbies });
      }
    }
  }
}
