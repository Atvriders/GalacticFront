import type { GameImpl } from "../game/GameImpl.js";
import type { Intent } from "../Schemas.js";

export interface Execution {
  readonly type: string;
  execute(game: GameImpl, playerID: number, intent: Intent): boolean;
  validate?(game: GameImpl, playerID: number, intent: Intent): string | null;
}
