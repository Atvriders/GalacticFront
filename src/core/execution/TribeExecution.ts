// ---------------------------------------------------------------------------
// TribeExecution — Simple AI that accepts alliances and attacks neighbors
// ---------------------------------------------------------------------------

import type { GameImpl } from "../game/GameImpl.js";
import type { PlayerImpl } from "../game/PlayerImpl.js";
import type { PseudoRandom } from "../PseudoRandom.js";

/**
 * Tick-based AI interface for autonomous behavior.
 * Unlike Execution (which handles intents), TickAI runs every N ticks
 * and issues actions directly through the game API.
 */
export interface TickAI {
  readonly name: string;
  tick(game: GameImpl, playerID: number, currentTick: number): void;
}

/**
 * TribeExecution is a simple AI that:
 * 1. Accepts all incoming alliance requests
 * 2. Attacks the weakest non-allied neighbor
 *
 * It runs every `interval` ticks.
 */
export class TribeExecution implements TickAI {
  readonly name = "Tribe";
  readonly interval: number;
  private readonly rng: PseudoRandom;

  constructor(rng: PseudoRandom, interval: number = 60) {
    this.rng = rng;
    this.interval = interval;
  }

  tick(game: GameImpl, playerID: number, currentTick: number): void {
    if (currentTick % this.interval !== 0) return;

    const player = game.getPlayer(playerID);
    if (!player || !player.isAlive) return;

    this.acceptAllAlliances(game, playerID);
    this.attackWeakestNeighbor(game, player);
  }

  private acceptAllAlliances(game: GameImpl, playerID: number): void {
    const requests = game.getAllianceRequests();
    for (const [id, req] of requests.entries()) {
      if (req.recipientID === playerID) {
        game.acceptAlliance(id);
      }
    }
  }

  private attackWeakestNeighbor(game: GameImpl, player: PlayerImpl): void {
    // Already attacking max targets — skip
    const attacks = game.getAttacks();
    let activeCount = 0;
    for (const atk of attacks.values()) {
      if (atk.attackerID === player.id) activeCount++;
    }
    if (activeCount >= game.balance.attack.maxActiveAttacks) return;

    // Find border neighbors
    const neighborIDs = this.findBorderNeighborIDs(game, player);
    if (neighborIDs.length === 0) return;

    // Pick the weakest non-allied neighbor
    let weakest: PlayerImpl | null = null;
    let weakestTroops = Infinity;

    for (const nID of neighborIDs) {
      if (player.isAlliedWith(nID)) continue;

      // Already attacking this player
      let alreadyAttacking = false;
      for (const atk of attacks.values()) {
        if (atk.attackerID === player.id && atk.defenderID === nID) {
          alreadyAttacking = true;
          break;
        }
      }
      if (alreadyAttacking) continue;

      const neighbor = game.getPlayer(nID);
      if (!neighbor || !neighbor.isAlive) continue;

      const troopCount = Number(neighbor.troops);
      if (troopCount < weakestTroops) {
        weakestTroops = troopCount;
        weakest = neighbor;
      }
    }

    if (!weakest) return;

    // Find a border tile adjacent to the target
    const sourceTile = this.findBorderTile(game, player, weakest.id);
    if (sourceTile === -1) return;

    game.startAttack(player.id, weakest.id, sourceTile, 0.5);
  }

  /**
   * Find IDs of players who own tiles adjacent to our territory.
   */
  findBorderNeighborIDs(game: GameImpl, player: PlayerImpl): number[] {
    const neighbors = new Set<number>();
    for (const tile of player.territory) {
      for (const n of game.map.getNeighbors4(tile)) {
        const owner = game.map.getOwner(n);
        if (owner !== 0 && owner !== player.id) {
          neighbors.add(owner);
        }
      }
    }
    return [...neighbors];
  }

  /**
   * Find a tile we own that borders the given target player.
   */
  private findBorderTile(
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
}
