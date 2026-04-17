// ---------------------------------------------------------------------------
// SwarmBehavior — Bombardment based on strength advantage
// ---------------------------------------------------------------------------

import type { GameImpl } from "../../game/GameImpl.js";
import type { PlayerImpl } from "../../game/PlayerImpl.js";
import {
  type TroopAllocation,
  findAttackSourceTile,
} from "./AttackBehavior.js";

/**
 * Calculate strength ratio between attacker and defender.
 * Ratio > 1 means the attacker is stronger.
 */
export function strengthRatio(
  attacker: PlayerImpl,
  defender: PlayerImpl,
): number {
  const atkStrength = Number(attacker.troops) + attacker.territoryCount * 5;
  const defStrength = Number(defender.troops) + defender.territoryCount * 5;
  return defStrength > 0 ? atkStrength / defStrength : Infinity;
}

/**
 * Determine if a swarm bombardment should happen.
 * Requires at least a 1.5x strength advantage.
 */
export function shouldSwarm(
  attacker: PlayerImpl,
  defender: PlayerImpl,
  threshold: number = 1.5,
): boolean {
  return strengthRatio(attacker, defender) >= threshold;
}

/**
 * Swarm behavior tick — launch mass attacks against weaker neighbors.
 * Only activates when the empire has a significant strength advantage.
 */
export function swarmTick(
  game: GameImpl,
  player: PlayerImpl,
  neighborIDs: number[],
  allocation: TroopAllocation,
): void {
  // Check active attack count
  let activeCount = 0;
  for (const atk of game.getAttacks().values()) {
    if (atk.attackerID === player.id) activeCount++;
  }
  if (activeCount >= game.balance.attack.maxActiveAttacks) return;

  for (const nID of neighborIDs) {
    if (player.isAlliedWith(nID)) continue;
    if (activeCount >= game.balance.attack.maxActiveAttacks) break;

    // Already attacking?
    let alreadyAttacking = false;
    for (const atk of game.getAttacks().values()) {
      if (atk.attackerID === player.id && atk.defenderID === nID) {
        alreadyAttacking = true;
        break;
      }
    }
    if (alreadyAttacking) continue;

    const neighbor = game.getPlayer(nID);
    if (!neighbor || !neighbor.isAlive) continue;

    if (shouldSwarm(player, neighbor)) {
      const sourceTile = findAttackSourceTile(game, player, nID);
      if (sourceTile === -1) continue;

      const troopRatio = 1 - allocation.reserveRatio;
      const attack = game.startAttack(
        player.id,
        nID,
        sourceTile,
        troopRatio,
      );
      if (attack) activeCount++;
    }
  }
}
