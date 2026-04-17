// ---------------------------------------------------------------------------
// AllianceBehavior — Request alliances with border neighbors based on threat
// ---------------------------------------------------------------------------

import type { GameImpl } from "../../game/GameImpl.js";
import type { PlayerImpl } from "../../game/PlayerImpl.js";
import type { PseudoRandom } from "../../PseudoRandom.js";

/**
 * Evaluate threat level of a neighbor: higher troops + more territory = more threat.
 */
export function threatScore(neighbor: PlayerImpl, self: PlayerImpl): number {
  const troopRatio =
    Number(neighbor.troops) / Math.max(1, Number(self.troops));
  const territoryRatio =
    neighbor.territoryCount / Math.max(1, self.territoryCount);
  return troopRatio + territoryRatio;
}

/**
 * Determine if we should request an alliance with a given neighbor.
 * Higher threat neighbors are more desirable as allies.
 */
export function shouldRequestAlliance(
  self: PlayerImpl,
  neighbor: PlayerImpl,
  threatThreshold: number = 1.2,
): boolean {
  if (self.isAlliedWith(neighbor.id)) return false;
  const score = threatScore(neighbor, self);
  return score >= threatThreshold;
}

/**
 * Accept all pending alliance requests directed at this player.
 */
export function acceptPendingAlliances(
  game: GameImpl,
  playerID: number,
): number {
  let accepted = 0;
  const requests = game.getAllianceRequests();
  for (const [id, req] of requests.entries()) {
    if (req.recipientID === playerID) {
      game.acceptAlliance(id);
      accepted++;
    }
  }
  return accepted;
}

/**
 * Run alliance behavior for one tick.
 * 1. Accept all incoming alliance requests
 * 2. Request alliances with threatening border neighbors
 */
export function allianceTick(
  game: GameImpl,
  player: PlayerImpl,
  neighborIDs: number[],
  rng: PseudoRandom,
): void {
  // Accept incoming requests
  acceptPendingAlliances(game, player.id);

  // Consider requesting alliances with threatening neighbors
  for (const nID of neighborIDs) {
    if (player.isAlliedWith(nID)) continue;
    if (player.getAllianceCount() >= game.balance.alliance.maxAlliances) break;

    const neighbor = game.getPlayer(nID);
    if (!neighbor || !neighbor.isAlive) continue;

    if (shouldRequestAlliance(player, neighbor)) {
      // Random duration within allowed range
      const duration = rng.nextInt(
        game.balance.alliance.minDuration,
        game.balance.alliance.maxDuration,
      );
      game.createAllianceRequest(player.id, nID, duration);
    }
  }
}
