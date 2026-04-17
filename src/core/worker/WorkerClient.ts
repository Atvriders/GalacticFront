/**
 * Client-side wrapper for the game simulation Web Worker.
 * Handles postMessage routing, init timeout, and turn submission.
 */

import type { GameConfig, StampedIntent } from "../Schemas.js";
import type {
  ClientToWorkerMessage,
  WorkerToClientMessage,
  GameUpdateMessage,
  GameUpdateBatchMessage,
} from "./WorkerMessages.js";
import {
  isGameUpdateMessage,
  isGameUpdateBatchMessage,
  isWorkerReadyMessage,
  isWorkerErrorMessage,
} from "./WorkerMessages.js";

export interface WorkerClientCallbacks {
  onGameUpdate?: (update: GameUpdateMessage) => void;
  onGameUpdateBatch?: (batch: GameUpdateBatchMessage) => void;
  onError?: (error: string) => void;
}

const INIT_TIMEOUT_MS = 20_000;

export class WorkerClient {
  private worker: Worker | null = null;
  private callbacks: WorkerClientCallbacks = {};
  private _ready = false;

  get ready(): boolean {
    return this._ready;
  }

  /**
   * Create and initialize the worker with a game config.
   * Resolves when the worker sends a "worker_ready" message.
   * Rejects after 20s timeout.
   */
  async init(
    config: GameConfig,
    callbacks: WorkerClientCallbacks = {},
    workerFactory?: () => Worker,
  ): Promise<void> {
    this.callbacks = callbacks;

    if (workerFactory) {
      this.worker = workerFactory();
    } else {
      this.worker = new Worker(
        new URL("./Worker.worker.ts", import.meta.url),
        { type: "module" },
      );
    }

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Worker init timed out after 20s"));
      }, INIT_TIMEOUT_MS);

      const onReady = (ev: MessageEvent) => {
        const msg = ev.data as WorkerToClientMessage;
        if (isWorkerReadyMessage(msg)) {
          clearTimeout(timeout);
          this._ready = true;
          this.worker!.removeEventListener("message", onReady);
          this._setupMessageHandler();
          resolve();
        } else if (isWorkerErrorMessage(msg)) {
          clearTimeout(timeout);
          reject(new Error(msg.error));
        }
      };

      this.worker!.addEventListener("message", onReady);

      const initMsg: ClientToWorkerMessage = { type: "init", config };
      this.worker!.postMessage(initMsg);
    });
  }

  private _setupMessageHandler(): void {
    if (!this.worker) return;

    this.worker.onmessage = (ev: MessageEvent) => {
      const msg = ev.data as WorkerToClientMessage;

      if (isGameUpdateMessage(msg)) {
        this.callbacks.onGameUpdate?.(msg);
      } else if (isGameUpdateBatchMessage(msg)) {
        this.callbacks.onGameUpdateBatch?.(msg);
      } else if (isWorkerErrorMessage(msg)) {
        this.callbacks.onError?.(msg.error);
      }
    };
  }

  /**
   * Send a turn with intents to the worker for processing.
   */
  sendTurn(turn: number, intents: StampedIntent[]): void {
    if (!this.worker || !this._ready) return;

    const msg: ClientToWorkerMessage = { type: "turn", turn, intents };
    this.worker.postMessage(msg);
  }

  /**
   * Terminate the worker.
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this._ready = false;
    }
  }
}
