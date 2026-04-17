import type { GameImpl } from "../game/GameImpl.js";
import type { Intent } from "../Schemas.js";
import { IntentType } from "../Schemas.js";
import type { Execution } from "./Execution.js";

export class RetreatExecution implements Execution {
  readonly type = IntentType.Retreat;

  validate(game: GameImpl, playerID: number, intent: Intent): string | null {
    if (intent.type !== IntentType.Retreat) return "Invalid intent type";

    const attacks = game.getAttacks();
    for (const attack of attacks.values()) {
      if (attack.attackerID === playerID) {
        if (attack.isRetreating) {
          return "Already retreating";
        }
        return null;
      }
    }

    return "No active attack found";
  }

  execute(game: GameImpl, playerID: number, intent: Intent): boolean {
    if (intent.type !== IntentType.Retreat) return false;
    const attacks = game.getAttacks();
    for (const attack of attacks.values()) {
      if (attack.attackerID === playerID && !attack.isRetreating) {
        attack.startRetreat();
        return true;
      }
    }
    return false;
  }
}
