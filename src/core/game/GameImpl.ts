import type { GameConfig } from "../Schemas.js";
import type { GameBalanceConfig } from "../configuration/Config.js";
import { DEFAULT_CONFIG } from "../configuration/DefaultConfig.js";
import { GameUpdateType } from "./Types.js";

export interface GameUpdate {
  type: GameUpdateType;
  [key: string]: unknown;
}

export interface TickResult {
  updates: GameUpdate[];
  tileChanges: Array<{ tile: number; packed: number }>;
}

/**
 * Core game simulation. Tracks ticks, players, and game-over state.
 * Execution handlers receive this to read/mutate game state.
 */
export class GameImpl {
  readonly config: GameConfig;
  readonly balance: GameBalanceConfig;

  private _currentTick: number = 0;
  private _isGameOver: boolean = false;
  private _alivePlayers: Set<number> = new Set();
  private _nextPlayerID: number = 1;

  constructor(config: GameConfig, balance: GameBalanceConfig = DEFAULT_CONFIG) {
    this.config = config;
    this.balance = balance;
  }

  get currentTick(): number {
    return this._currentTick;
  }

  isGameOver(): boolean {
    return this._isGameOver;
  }

  /** Spawn a player and return the assigned player ID. */
  spawnPlayer(_name: string, _tile: number): number {
    const id = this._nextPlayerID++;
    this._alivePlayers.add(id);
    return id;
  }

  /** Eliminate a player; sets game-over when ≤ 1 player remains alive. */
  eliminatePlayer(playerID: number): void {
    this._alivePlayers.delete(playerID);
    if (this._alivePlayers.size <= 1) {
      this._isGameOver = true;
    }
  }

  /** Execute one game tick. Returns updates and tile changes produced. */
  executeTick(): TickResult {
    if (this._isGameOver) {
      return { updates: [], tileChanges: [] };
    }

    this._currentTick++;

    const updates: GameUpdate[] = [];
    const tileChanges: Array<{ tile: number; packed: number }> = [];

    // Win condition: exceeded max game ticks
    if (this._currentTick >= this.balance.maxGameTicks) {
      this._isGameOver = true;
      updates.push({ type: GameUpdateType.GameWon });
    }

    return { updates, tileChanges };
  }
}
