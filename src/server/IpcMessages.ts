import type { GameConfig, GameID } from "../core/Schemas.js";

// ---------------------------------------------------------------------------
// Lobby & Game metadata interfaces
// ---------------------------------------------------------------------------

export interface LobbyInfo {
  gameId: string;
  name: string;
  mode: "FFA" | "Team" | "Special";
  mapType: string;
  maxPlayers: number;
  currentPlayers: number;
  startTime: number; // epoch ms
  workerId: number;
}

export interface GameConfigMsg {
  gameId: string;
  config: GameConfig;
}

// ---------------------------------------------------------------------------
// IPC message types (Master <-> Worker)
// ---------------------------------------------------------------------------

/** Worker -> Master: worker is ready to accept connections */
export interface WorkerReadyMessage {
  type: "WorkerReady";
  workerId: number;
}

/** Master -> All Workers: broadcast current lobby list */
export interface LobbiesBroadcastMessage {
  type: "LobbiesBroadcast";
  lobbies: LobbyInfo[];
}

/** Worker -> Master: request current lobby list */
export interface LobbyListRequestMessage {
  type: "LobbyListRequest";
  workerId: number;
}

/** Master -> Worker: create a new game instance */
export interface CreateGameMessage {
  type: "CreateGame";
  config: GameConfig;
}

/** Worker -> Master: update lobby info for a game on this worker */
export interface UpdateLobbyMessage {
  type: "UpdateLobby";
  lobby: LobbyInfo;
}

// Discriminated union of all IPC messages
export type IpcMessage =
  | WorkerReadyMessage
  | LobbiesBroadcastMessage
  | LobbyListRequestMessage
  | CreateGameMessage
  | UpdateLobbyMessage;
