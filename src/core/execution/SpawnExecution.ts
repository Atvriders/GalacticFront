import type { GameImpl } from "../game/GameImpl.js";
import type { Intent } from "../Schemas.js";
import { IntentType } from "../Schemas.js";
import type { Execution } from "./Execution.js";

export class SpawnExecution implements Execution {
  readonly type = IntentType.Spawn;

  validate(game: GameImpl, playerID: number, intent: Intent): string | null {
    if (intent.type !== IntentType.Spawn) {
      return "Invalid intent type";
    }

    const existingPlayer = game.getPlayer(playerID);
    if (existingPlayer && existingPlayer.isAlive) {
      return "Player is already alive";
    }

    const { tile } = intent;

    if (!game.map.isValidTile(tile)) {
      return "Tile is not valid";
    }

    if (!game.map.isTraversable(tile)) {
      return "Tile is not traversable";
    }

    if (game.map.isOwned(tile)) {
      return "Tile is already owned";
    }

    if (game.getAlivePlayers().length >= game.config.maxPlayers) {
      return "Game is full";
    }

    return null;
  }

  execute(game: GameImpl, _playerID: number, intent: Intent): boolean {
    if (intent.type !== IntentType.Spawn) return false;
    game.spawnPlayer(intent.name, intent.tile);
    return true;
  }
}
