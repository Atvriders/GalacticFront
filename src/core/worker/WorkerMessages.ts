/**
 * Discriminated union message types for Worker <-> Client communication.
 */

import type { GameConfig, StampedIntent } from "../Schemas.js";
import type { GameUpdate } from "../game/GameImpl.js";

// ── Client -> Worker Messages ──────────────────────────────────────────────

export interface InitMessage {
  type: "init";
  config: GameConfig;
}

export interface TurnMessage {
  type: "turn";
  turn: number;
  intents: StampedIntent[];
}

export type ClientToWorkerMessage = InitMessage | TurnMessage;

// ── Worker -> Client Messages ──────────────────────────────────────────────

export interface GameUpdateMessage {
  type: "game_update";
  turn: number;
  updates: GameUpdate[];
  tileChanges: Array<{ tile: number; packed: number }>;
}

export interface GameUpdateBatchMessage {
  type: "game_update_batch";
  batch: GameUpdateMessage[];
}

export interface WorkerReadyMessage {
  type: "worker_ready";
}

export interface WorkerErrorMessage {
  type: "worker_error";
  error: string;
}

export type WorkerToClientMessage =
  | GameUpdateMessage
  | GameUpdateBatchMessage
  | WorkerReadyMessage
  | WorkerErrorMessage;

// ── Type Guards ────────────────────────────────────────────────────────────

export function isInitMessage(msg: unknown): msg is InitMessage {
  return (
    typeof msg === "object" &&
    msg !== null &&
    (msg as { type: string }).type === "init"
  );
}

export function isTurnMessage(msg: unknown): msg is TurnMessage {
  return (
    typeof msg === "object" &&
    msg !== null &&
    (msg as { type: string }).type === "turn"
  );
}

export function isGameUpdateMessage(msg: unknown): msg is GameUpdateMessage {
  return (
    typeof msg === "object" &&
    msg !== null &&
    (msg as { type: string }).type === "game_update"
  );
}

export function isGameUpdateBatchMessage(
  msg: unknown,
): msg is GameUpdateBatchMessage {
  return (
    typeof msg === "object" &&
    msg !== null &&
    (msg as { type: string }).type === "game_update_batch"
  );
}

export function isWorkerReadyMessage(msg: unknown): msg is WorkerReadyMessage {
  return (
    typeof msg === "object" &&
    msg !== null &&
    (msg as { type: string }).type === "worker_ready"
  );
}

export function isWorkerErrorMessage(msg: unknown): msg is WorkerErrorMessage {
  return (
    typeof msg === "object" &&
    msg !== null &&
    (msg as { type: string }).type === "worker_error"
  );
}
