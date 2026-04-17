// ---------------------------------------------------------------------------
// EmojiBehavior — Respond to and initiate emoji communication
// ---------------------------------------------------------------------------

import type { GameImpl } from "../../game/GameImpl.js";
import type { PlayerImpl } from "../../game/PlayerImpl.js";
import type { PseudoRandom } from "../../PseudoRandom.js";

/**
 * Emoji pools for different situations.
 */
export const FRIENDLY_EMOJIS = ["👋", "🤝", "✌️", "🫡", "🎉"];
export const HOSTILE_EMOJIS = ["⚔️", "💀", "🔥", "👊", "😈"];
export const TAUNT_EMOJIS = ["😂", "🤣", "💪", "👑", "🏆"];

/**
 * Pick a contextual emoji based on relationship.
 */
export function pickEmoji(
  player: PlayerImpl,
  targetID: number,
  rng: PseudoRandom,
): string {
  if (player.isAlliedWith(targetID)) {
    return rng.pick([...FRIENDLY_EMOJIS]);
  }

  const relation = player.getRelation(targetID);
  if (relation <= -50) {
    return rng.pick([...HOSTILE_EMOJIS]);
  }
  if (relation >= 50) {
    return rng.pick([...FRIENDLY_EMOJIS]);
  }

  // Neutral: mix of taunt and friendly
  return rng.pick([...TAUNT_EMOJIS]);
}

/**
 * Emoji behavior tick.
 * Sends emoji to a random neighbor based on diplomatic context.
 */
export function emojiTick(
  game: GameImpl,
  player: PlayerImpl,
  neighborIDs: number[],
  rng: PseudoRandom,
): void {
  if (neighborIDs.length === 0) return;

  // Pick a random neighbor to message
  const targetID = rng.pick(neighborIDs);
  const target = game.getPlayer(targetID);
  if (!target || !target.isAlive) return;

  const _emoji = pickEmoji(player, targetID, rng);

  // The emoji is selected and ready to send.
  // The actual sending would go through the intent system:
  // game.sendEmoji(player.id, targetID, emoji)
  // For now we just compute the decision; the execution manager
  // handles the intent dispatch externally.
}
