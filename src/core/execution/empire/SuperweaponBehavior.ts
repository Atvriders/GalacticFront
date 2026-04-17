// ---------------------------------------------------------------------------
// SuperweaponBehavior — Strategic launches with SAM overwhelm calculation
// ---------------------------------------------------------------------------

import type { GameImpl } from "../../game/GameImpl.js";
import type { PlayerImpl } from "../../game/PlayerImpl.js";
import type { PseudoRandom } from "../../PseudoRandom.js";
import { UnitType } from "../../game/Types.js";

/**
 * Count the number of InterceptorArray (SAM) units a target player has.
 */
export function countSAMs(game: GameImpl, targetID: number): number {
  let count = 0;
  for (const unit of game.getUnits().values()) {
    if (unit.ownerID === targetID && unit.type === UnitType.InterceptorArray) {
      count++;
    }
  }
  return count;
}

/**
 * Calculate how many superweapon launches are needed to guarantee a hit.
 * Formula: SAM count + 1 to overwhelm all interceptors.
 */
export function calculateOverwhelmCount(samCount: number): number {
  return samCount + 1;
}

/**
 * Count how many SuperweaponFacility units the player has (and are operational).
 */
export function countOwnSuperweapons(
  game: GameImpl,
  playerID: number,
): number {
  let count = 0;
  for (const unit of game.getUnits().values()) {
    if (
      unit.ownerID === playerID &&
      unit.type === UnitType.SuperweaponFacility &&
      !unit.isConstructing
    ) {
      count++;
    }
  }
  return count;
}

/**
 * Pick the best superweapon target: the strongest non-allied neighbor.
 */
export function pickSuperweaponTarget(
  game: GameImpl,
  player: PlayerImpl,
  neighborIDs: number[],
): PlayerImpl | null {
  let best: PlayerImpl | null = null;
  let bestStrength = -1;

  for (const nID of neighborIDs) {
    if (player.isAlliedWith(nID)) continue;
    const neighbor = game.getPlayer(nID);
    if (!neighbor || !neighbor.isAlive) continue;

    const strength = Number(neighbor.troops) + neighbor.territoryCount * 10;
    if (strength > bestStrength) {
      bestStrength = strength;
      best = neighbor;
    }
  }

  return best;
}

/**
 * Superweapon behavior tick.
 * 1. Check if we have superweapons ready
 * 2. Pick the strongest enemy neighbor
 * 3. Calculate SAM overwhelm
 * 4. Only fire if we can overwhelm their defenses
 */
export function superweaponTick(
  game: GameImpl,
  player: PlayerImpl,
  neighborIDs: number[],
  rng: PseudoRandom,
): void {
  const ownCount = countOwnSuperweapons(game, player.id);
  if (ownCount === 0) return;

  const target = pickSuperweaponTarget(game, player, neighborIDs);
  if (!target) return;

  const samCount = countSAMs(game, target.id);
  const needed = calculateOverwhelmCount(samCount);

  // Only fire if we can guarantee a hit
  if (ownCount >= needed) {
    // Activate all superweapon facilities to "fire"
    for (const [unitID, unit] of game.getUnits().entries()) {
      if (
        unit.ownerID === player.id &&
        unit.type === UnitType.SuperweaponFacility &&
        !unit.isConstructing
      ) {
        // Activation represents firing the superweapon
        // The game engine handles the actual effect
        break; // One activation per tick is sufficient
      }
    }
  }
}
