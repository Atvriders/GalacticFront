/**
 * Singleplayer simulation server.
 * Manages turn queue, speed control, and runs GameRunner locally.
 */

import { GameRunner, type TurnResult } from "@core/GameRunner";
import type { GameConfig, StampedIntent } from "@core/Schemas";
import type { GameBalanceConfig } from "@core/configuration/Config";
import { DEFAULT_CONFIG } from "@core/configuration/DefaultConfig";

export type SpeedMultiplier = 0.5 | 1 | 2 | "fastest";

export interface LocalServerCallbacks {
  onTurnResult?: (result: TurnResult) => void;
  onGameOver?: (winnerID: number | null) => void;
}

export class LocalServer {
  private runner: GameRunner;
  private turnTimer: ReturnType<typeof setInterval> | null = null;
  private _speed: SpeedMultiplier = 1;
  private _paused = false;
  private _turnIntervalMs: number;
  private callbacks: LocalServerCallbacks;
  private pendingIntents: StampedIntent[] = [];

  constructor(
    config: GameConfig,
    callbacks: LocalServerCallbacks = {},
    balance: GameBalanceConfig = DEFAULT_CONFIG,
  ) {
    this.runner = new GameRunner(config, balance);
    this._turnIntervalMs = config.turnIntervalMs;
    this.callbacks = callbacks;
  }

  get game(): GameRunner {
    return this.runner;
  }

  get speed(): SpeedMultiplier {
    return this._speed;
  }

  get paused(): boolean {
    return this._paused;
  }

  get currentTurn(): number {
    return this.runner.getCurrentTurn();
  }

  /**
   * Start the local game loop.
   */
  start(): void {
    if (this.turnTimer !== null) return;
    this._paused = false;
    this._scheduleTick();
  }

  /**
   * Stop the local game loop.
   */
  stop(): void {
    this._clearTimer();
    this._paused = false;
  }

  /**
   * Pause the game.
   */
  pause(): void {
    this._paused = true;
    this._clearTimer();
  }

  /**
   * Unpause the game.
   */
  unpause(): void {
    if (!this._paused) return;
    this._paused = false;
    this._scheduleTick();
  }

  /**
   * Toggle pause state.
   */
  togglePause(): void {
    if (this._paused) {
      this.unpause();
    } else {
      this.pause();
    }
  }

  /**
   * Set the game speed.
   */
  setSpeed(speed: SpeedMultiplier): void {
    this._speed = speed;
    if (!this._paused && this.turnTimer !== null) {
      this._clearTimer();
      this._scheduleTick();
    }
  }

  /**
   * Queue an intent for the next turn.
   */
  queueIntent(intent: StampedIntent): void {
    this.pendingIntents.push(intent);
  }

  /**
   * Process a single turn immediately (useful for step-through debugging).
   */
  stepTurn(): TurnResult | null {
    if (this.runner.isGameOver()) return null;
    return this._processTurn();
  }

  private _processTurn(): TurnResult {
    // Feed pending intents
    for (const intent of this.pendingIntents) {
      this.runner.queueIntent(intent);
    }
    this.pendingIntents = [];

    const result = this.runner.processTurn();
    this.callbacks.onTurnResult?.(result);

    if (this.runner.isGameOver()) {
      this._clearTimer();
      this.callbacks.onGameOver?.(this.runner.game.winnerID);
    }

    return result;
  }

  private _getInterval(): number {
    if (this._speed === "fastest") return 0;
    return Math.floor(this._turnIntervalMs / this._speed);
  }

  private _scheduleTick(): void {
    if (this.runner.isGameOver()) return;
    const interval = this._getInterval();

    if (this._speed === "fastest") {
      // Use setTimeout(0) for fastest - process as fast as possible
      this.turnTimer = setTimeout(() => {
        this._processTurn();
        if (!this._paused && !this.runner.isGameOver()) {
          this.turnTimer = null;
          this._scheduleTick();
        }
      }, 0) as unknown as ReturnType<typeof setInterval>;
    } else {
      this.turnTimer = setInterval(() => {
        if (!this._paused) {
          this._processTurn();
          if (this.runner.isGameOver()) {
            this._clearTimer();
          }
        }
      }, interval);
    }
  }

  private _clearTimer(): void {
    if (this.turnTimer !== null) {
      clearInterval(this.turnTimer);
      clearTimeout(this.turnTimer as unknown as ReturnType<typeof setTimeout>);
      this.turnTimer = null;
    }
  }
}
