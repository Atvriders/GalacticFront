/**
 * Game simulation Web Worker.
 * Manages a GameRunner instance and processes turns via a drain loop.
 */

import { GameRunner, type TurnResult } from "../GameRunner.js";
import type { GameConfig } from "../Schemas.js";
import {
  isInitMessage,
  isTurnMessage,
  type GameUpdateMessage,
  type GameUpdateBatchMessage,
  type WorkerToClientMessage,
  type ClientToWorkerMessage,
} from "./WorkerMessages.js";

let runner: GameRunner | null = null;
let turnQueue: Array<{ turn: number; intents: ClientToWorkerMessage[] }> = [];
let draining = false;

const MAX_TICKS_BEFORE_YIELD = 4;

function postMsg(msg: WorkerToClientMessage): void {
  self.postMessage(msg);
}

function processTurnResult(turnResult: TurnResult): GameUpdateMessage {
  return {
    type: "game_update",
    turn: turnResult.turn,
    updates: turnResult.updates,
    tileChanges: turnResult.tileChanges,
  };
}

function drainLoop(): void {
  if (draining || !runner) return;
  draining = true;

  let processed = 0;
  const batch: GameUpdateMessage[] = [];

  while (turnQueue.length > 0 && processed < MAX_TICKS_BEFORE_YIELD) {
    const entry = turnQueue.shift()!;

    // Queue intents from the turn
    if (isTurnMessage(entry)) {
      runner.queueIntents((entry as any).intents ?? []);
    }

    const result = runner.processTurn();
    batch.push(processTurnResult(result));
    processed++;
  }

  if (batch.length > 0) {
    if (batch.length === 1) {
      postMsg(batch[0]!);
    } else {
      const batchMsg: GameUpdateBatchMessage = {
        type: "game_update_batch",
        batch,
      };
      postMsg(batchMsg);
    }
  }

  draining = false;

  // If there are more turns, yield to the event loop then continue
  if (turnQueue.length > 0) {
    setTimeout(drainLoop, 0);
  }
}

self.onmessage = (ev: MessageEvent) => {
  const msg = ev.data as ClientToWorkerMessage;

  if (isInitMessage(msg)) {
    try {
      const config: GameConfig = msg.config;
      runner = new GameRunner(config);
      turnQueue = [];
      postMsg({ type: "worker_ready" });
    } catch (err) {
      postMsg({
        type: "worker_error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  if (isTurnMessage(msg)) {
    if (!runner) {
      postMsg({ type: "worker_error", error: "Worker not initialized" });
      return;
    }

    // Queue intents into the runner
    runner.queueIntents(msg.intents);
    turnQueue.push({ turn: msg.turn, intents: [] });
    drainLoop();
    return;
  }
};
