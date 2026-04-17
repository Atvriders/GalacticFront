import type { GameConfig, StampedIntent } from "./Schemas.js";
import type { GameBalanceConfig } from "./configuration/Config.js";
import { DEFAULT_CONFIG } from "./configuration/DefaultConfig.js";
import { GameImpl } from "./game/GameImpl.js";
import type { GameUpdate } from "./game/GameImpl.js";
import { EventBus } from "./EventBus.js";

export interface TurnResult {
  turn: number;
  updates: GameUpdate[];
  tileChanges: Array<{ tile: number; packed: number }>;
}

export class GameRunner {
  public readonly game: GameImpl;

  private readonly eventBus: EventBus;
  private currentTurn: number = 0;
  private intentQueue: StampedIntent[] = [];
  private intentHandler: ((intent: StampedIntent) => void) | null = null;

  constructor(config: GameConfig, balance: GameBalanceConfig = DEFAULT_CONFIG) {
    this.game = new GameImpl(config, balance);
    this.eventBus = new EventBus();
  }

  /** Register a callback invoked for each queued intent during processTurn. */
  setIntentHandler(handler: (intent: StampedIntent) => void): void {
    this.intentHandler = handler;
  }

  /** Add a single intent to the queue. */
  queueIntent(intent: StampedIntent): void {
    this.intentQueue.push(intent);
  }

  /** Add multiple intents to the queue. */
  queueIntents(intents: StampedIntent[]): void {
    for (const intent of intents) {
      this.intentQueue.push(intent);
    }
  }

  /**
   * Process one turn:
   * 1. Increment turn counter.
   * 2. Dispatch all queued intents through the intent handler (if set).
   * 3. Clear the queue.
   * 4. Execute ticksPerTurn game ticks.
   * 5. Collect updates and tile changes.
   * 6. Emit "turn_complete" on the event bus.
   */
  processTurn(): TurnResult {
    this.currentTurn++;

    // Process queued intents
    const intentsToProcess = this.intentQueue.slice();
    this.intentQueue = [];

    if (this.intentHandler !== null) {
      for (const intent of intentsToProcess) {
        this.intentHandler(intent);
      }
    }

    // Execute ticks
    const allUpdates: GameUpdate[] = [];
    const allTileChanges: Array<{ tile: number; packed: number }> = [];

    const ticksPerTurn = this.game.config.ticksPerTurn;
    for (let i = 0; i < ticksPerTurn; i++) {
      const { updates, tileChanges } = this.game.executeTick();
      allUpdates.push(...updates);
      allTileChanges.push(...tileChanges);
    }

    const result: TurnResult = {
      turn: this.currentTurn,
      updates: allUpdates,
      tileChanges: allTileChanges,
    };

    this.eventBus.emit("turn_complete", result);

    return result;
  }

  /**
   * Process N turns in sequence. Stops early if the game ends.
   */
  runTurns(count: number): TurnResult[] {
    const results: TurnResult[] = [];
    for (let i = 0; i < count; i++) {
      if (this.game.isGameOver()) break;
      results.push(this.processTurn());
    }
    return results;
  }

  /** Returns the current turn number. */
  getCurrentTurn(): number {
    return this.currentTurn;
  }

  /** Returns true when the underlying game is over. */
  isGameOver(): boolean {
    return this.game.isGameOver();
  }

  /** Subscribe to events emitted by this runner (e.g. "turn_complete"). */
  on<T>(event: string, handler: (data: T) => void): () => void {
    return this.eventBus.on<T>(event, handler);
  }
}
