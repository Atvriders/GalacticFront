// ---------------------------------------------------------------------------
// CruiserBehavior — Spawn Battle Cruisers, hunt Freighters, counter enemies
// ---------------------------------------------------------------------------

import type { GameImpl } from "../../game/GameImpl.js";
import type { PlayerImpl } from "../../game/PlayerImpl.js";
import type { PseudoRandom } from "../../PseudoRandom.js";
import { UnitType } from "../../game/Types.js";

/** Counter-cruiser thresholds */
export const COUNTER_THRESHOLD_FFA = 10;
export const COUNTER_THRESHOLD_TEAM = 15;

/**
 * Count how many cruiser-type units an enemy has across all players.
 */
export function countEnemyCruisers(
  game: GameImpl,
  playerID: number,
): number {
  let count = 0;
  for (const unit of game.getUnits().values()) {
    if (unit.ownerID !== playerID && unit.type === UnitType.OrbitalForge) {
      count++;
    }
  }
  return count;
}

/**
 * Determine if counter-cruiser production should trigger.
 */
export function shouldCounterCruisers(
  enemyCruiserCount: number,
  isTeamGame: boolean,
): boolean {
  const threshold = isTeamGame ? COUNTER_THRESHOLD_TEAM : COUNTER_THRESHOLD_FFA;
  return enemyCruiserCount > threshold;
}

/**
 * Find a tile suitable for building a cruiser/unit (owned, traversable).
 */
export function findBuildTile(
  game: GameImpl,
  player: PlayerImpl,
  rng: PseudoRandom,
): number {
  const territory = [...player.territory];
  if (territory.length === 0) return -1;

  // Try random tiles first
  for (let i = 0; i < Math.min(20, territory.length); i++) {
    const tile = rng.pick(territory);
    if (game.map.isTraversable(tile)) return tile;
  }

  // Fallback: first valid
  for (const tile of territory) {
    if (game.map.isTraversable(tile)) return tile;
  }
  return -1;
}

/**
 * Cruiser behavior tick.
 * Spawns OrbitalForge (battle cruiser proxy) when the player has enough credits.
 * Triggers counter-production when enemy cruiser count exceeds threshold.
 */
export function cruiserTick(
  game: GameImpl,
  player: PlayerImpl,
  rng: PseudoRandom,
): void {
  // Count our existing cruisers
  const ourCruisers = player.getUnitCount(UnitType.OrbitalForge);

  // Check if enemies have a lot of cruisers
  const enemyCruisers = countEnemyCruisers(game, player.id);
  const isTeamGame = player.getAllianceCount() > 0;

  const needCounter = shouldCounterCruisers(enemyCruisers, isTeamGame);

  // Build cruiser if we need to counter or if we have few
  if (needCounter || ourCruisers < 3) {
    const tile = findBuildTile(game, player, rng);
    if (tile !== -1) {
      game.buildUnit(player.id, UnitType.OrbitalForge, tile);
    }
  }
}
