import type { GameImpl } from "../game/GameImpl.js";
import type { StampedIntent } from "../Schemas.js";
import type { Execution } from "./Execution.js";

export class ExecutionManager {
  private readonly game: GameImpl;
  private readonly handlers: Map<string, Execution>;

  constructor(game: GameImpl) {
    this.game = game;
    this.handlers = new Map();
  }

  register(execution: Execution): void {
    this.handlers.set(execution.type, execution);
  }

  registerAll(executions: Execution[]): void {
    for (const execution of executions) {
      this.register(execution);
    }
  }

  process(stampedIntent: StampedIntent): boolean {
    const { playerID, intent } = stampedIntent;
    const handler = this.handlers.get(intent.type);

    if (!handler) {
      return false;
    }

    if (handler.validate) {
      const error = handler.validate(this.game, playerID, intent);
      if (error !== null) {
        return false;
      }
    }

    return handler.execute(this.game, playerID, intent);
  }

  processAll(intents: StampedIntent[]): number {
    let successCount = 0;
    for (const stampedIntent of intents) {
      if (this.process(stampedIntent)) {
        successCount++;
      }
    }
    return successCount;
  }

  hasHandler(intentType: string): boolean {
    return this.handlers.has(intentType);
  }

  handlerCount(): number {
    return this.handlers.size;
  }

  createIntentHandler(): (intent: StampedIntent) => void {
    return (intent: StampedIntent) => {
      this.process(intent);
    };
  }
}
