// ---------------------------------------------------------------------------
// AttackBehavior — Shared troop allocation and attack logic for empire AI
// ---------------------------------------------------------------------------

import type { GameImpl } from "../../game/GameImpl.js";
import type { PlayerImpl } from "../../game/PlayerImpl.js";
import type { PseudoRandom } from "../../PseudoRandom.js";

/**
 * Troop allocation thresholds.
 * - trigger: 50-60% of troops must be available before considering an attack
 * - reserve: 30-40% of troops are kept in reserve
 * - expand:  10-20% committed to territory expansion
 */
export interface TroopAllocation {
  triggerRatio: number; // 0.50 - 0.60
  reserveRatio: number; // 0.30 - 0.40
  expandRatio: number; // 0.10 - 0.20
}

export function randomTroopAllocation(rng: PseudoRandom): TroopAllocation {
  return {
    triggerRatio: rng.nextFloat(0.5, 0.6),
    reserveRatio: rng.nextFloat(0.3, 0.4),
    expandRatio: rng.nextFloat(0.1, 0.2),
  };
}

/**
 * Determine whether the empire should consider attacking based on troop levels.
 */
export function maybeAttack(
  player: PlayerImpl,
  allocation: TroopAllocation,
  minTroops: number = 50,
): boolean {
  const troops = Number(player.troops);
  if (troops < minTroops) return false;
  // Only attack if we have enough troops above the reserve threshold
  const available = troops * (1 - allocation.reserveRatio);
  return available >= troops * allocation.triggerRatio * 0.5;
}

/**
 * Score potential targets by weakness (lower troops + smaller territory = weaker).
 */
export function scoreTarget(target: PlayerImpl): number {
  const troopScore = Number(target.troops);
  const territoryScore = target.territoryCount * 10;
  return troopScore + territoryScore;
}

/**
 * Pick the best (weakest) target from a list of candidate player IDs.
 */
export function attackBestTarget(
  game: GameImpl,
  player: PlayerImpl,
  candidateIDs: number[],
): PlayerImpl | null {
  let best: PlayerImpl | null = null;
  let bestScore = Infinity;

  for (const id of candidateIDs) {
    if (player.isAlliedWith(id)) continue;
    if (id === player.id) continue;

    // Skip targets we are already attacking
    let alreadyAttacking = false;
    for (const atk of game.getAttacks().values()) {
      if (atk.attackerID === player.id && atk.defenderID === id) {
        alreadyAttacking = true;
        break;
      }
    }
    if (alreadyAttacking) continue;

    const target = game.getPlayer(id);
    if (!target || !target.isAlive) continue;

    const score = scoreTarget(target);
    if (score < bestScore) {
      bestScore = score;
      best = target;
    }
  }

  return best;
}

/**
 * Find a border tile owned by `player` that is adjacent to `targetID`.
 */
export function findAttackSourceTile(
  game: GameImpl,
  player: PlayerImpl,
  targetID: number,
): number {
  for (const tile of player.territory) {
    for (const n of game.map.getNeighbors4(tile)) {
      if (game.map.getOwner(n) === targetID) {
        return tile;
      }
    }
  }
  return -1;
}

/**
 * Execute an attack against the best target. Returns true if attack started.
 */
export function executeAttack(
  game: GameImpl,
  player: PlayerImpl,
  candidateIDs: number[],
  allocation: TroopAllocation,
): boolean {
  if (!maybeAttack(player, allocation)) return false;

  const target = attackBestTarget(game, player, candidateIDs);
  if (!target) return false;

  const sourceTile = findAttackSourceTile(game, player, target.id);
  if (sourceTile === -1) return false;

  const troopRatio = 1 - allocation.reserveRatio;
  const attack = game.startAttack(player.id, target.id, sourceTile, troopRatio);
  return attack !== null;
}
