import type { GameImpl } from "../game/GameImpl.js";
import type { Intent } from "../Schemas.js";
import { IntentType } from "../Schemas.js";
import type { Execution } from "./Execution.js";

// ---------------------------------------------------------------------------
// SetNameExecution
// ---------------------------------------------------------------------------

export class SetNameExecution implements Execution {
  readonly type = IntentType.SetName;

  execute(game: GameImpl, playerID: number, intent: Intent): boolean {
    if (intent.type !== IntentType.SetName) return false;
    const player = game.getPlayer(playerID);
    if (!player || !player.isAlive) return false;
    // PlayerImpl.name is readonly — cast to allow mutation
    (player as unknown as { name: string }).name = intent.name;
    return true;
  }
}

// ---------------------------------------------------------------------------
// SurrenderExecution
// ---------------------------------------------------------------------------

export class SurrenderExecution implements Execution {
  readonly type = IntentType.Surrender;

  execute(game: GameImpl, playerID: number, intent: Intent): boolean {
    if (intent.type !== IntentType.Surrender) return false;
    const player = game.getPlayer(playerID);
    if (!player || !player.isAlive) return false;
    player.surrender(game.tick);
    return true;
  }
}

// ---------------------------------------------------------------------------
// DonateExecution
// ---------------------------------------------------------------------------

export class DonateExecution implements Execution {
  readonly type = IntentType.Donate;

  validate(game: GameImpl, playerID: number, intent: Intent): string | null {
    if (intent.type !== IntentType.Donate) return "Invalid intent type";

    const sender = game.getPlayer(playerID);
    if (!sender || !sender.isAlive) return "Sender is not alive";

    const recipient = game.getPlayer(intent.targetPlayerID);
    if (!recipient || !recipient.isAlive) return "Recipient is not alive";

    if (sender.hasEmbargo(intent.targetPlayerID)) {
      return "Sender has embargo on recipient";
    }

    return null;
  }

  execute(game: GameImpl, playerID: number, intent: Intent): boolean {
    if (intent.type !== IntentType.Donate) return false;
    const sender = game.getPlayer(playerID);
    if (!sender) return false;
    game.transferTiles([...sender.territory], playerID, intent.targetPlayerID);
    return true;
  }
}

// ---------------------------------------------------------------------------
// SetEmbargoExecution
// ---------------------------------------------------------------------------

export class SetEmbargoExecution implements Execution {
  readonly type = IntentType.SetEmbargo;

  execute(game: GameImpl, playerID: number, intent: Intent): boolean {
    if (intent.type !== IntentType.SetEmbargo) return false;
    const player = game.getPlayer(playerID);
    if (!player || !player.isAlive) return false;
    player.setEmbargo(intent.targetPlayerID);
    return true;
  }
}

// ---------------------------------------------------------------------------
// ClearEmbargoExecution
// ---------------------------------------------------------------------------

export class ClearEmbargoExecution implements Execution {
  readonly type = IntentType.ClearEmbargo;

  execute(game: GameImpl, playerID: number, intent: Intent): boolean {
    if (intent.type !== IntentType.ClearEmbargo) return false;
    const player = game.getPlayer(playerID);
    if (!player || !player.isAlive) return false;
    player.clearEmbargo(intent.targetPlayerID);
    return true;
  }
}
