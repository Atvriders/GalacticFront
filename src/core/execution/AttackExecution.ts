import type { GameImpl } from "../game/GameImpl.js";
import type { Intent } from "../Schemas.js";
import { IntentType } from "../Schemas.js";
import type { Execution } from "./Execution.js";

// ---------------------------------------------------------------------------
// AttackExecution
// ---------------------------------------------------------------------------

export class AttackExecution implements Execution {
  readonly type = IntentType.Attack;

  validate(game: GameImpl, playerID: number, intent: Intent): string | null {
    if (intent.type !== IntentType.Attack) return "Invalid intent type";

    const attacker = game.getPlayer(playerID);
    if (!attacker || !attacker.isAlive) return "Attacker is not alive";

    const defender = game.getPlayer(intent.targetPlayerID);
    if (!defender || !defender.isAlive) return "Defender is not alive";

    if (playerID === intent.targetPlayerID) return "Cannot attack self";

    if (attacker.isAlliedWith(intent.targetPlayerID)) {
      return "Cannot attack an ally";
    }

    return null;
  }

  execute(game: GameImpl, playerID: number, intent: Intent): boolean {
    if (intent.type !== IntentType.Attack) return false;
    const attack = game.startAttack(
      playerID,
      intent.targetPlayerID,
      intent.sourceTile,
      intent.troopRatio,
    );
    return attack !== null;
  }
}

// ---------------------------------------------------------------------------
// CancelAttackExecution
// ---------------------------------------------------------------------------

export class CancelAttackExecution implements Execution {
  readonly type = IntentType.CancelAttack;

  execute(game: GameImpl, playerID: number, intent: Intent): boolean {
    if (intent.type !== IntentType.CancelAttack) return false;
    const attacks = game.getAttacks();
    for (const [id, attack] of attacks.entries()) {
      if (
        attack.attackerID === playerID &&
        attack.defenderID === intent.targetPlayerID
      ) {
        game.endAttack(id);
        return true;
      }
    }
    return false;
  }
}

// ---------------------------------------------------------------------------
// SetTargetTroopRatioExecution
// ---------------------------------------------------------------------------

export class SetTargetTroopRatioExecution implements Execution {
  readonly type = IntentType.SetTargetTroopRatio;

  execute(game: GameImpl, playerID: number, intent: Intent): boolean {
    if (intent.type !== IntentType.SetTargetTroopRatio) return false;
    const attacks = game.getAttacks();
    let updated = false;
    for (const attack of attacks.values()) {
      if (attack.attackerID === playerID) {
        (attack as unknown as { troopRatio: number }).troopRatio = intent.ratio;
        updated = true;
      }
    }
    return updated;
  }
}
