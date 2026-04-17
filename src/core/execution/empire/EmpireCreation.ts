// ---------------------------------------------------------------------------
// EmpireCreation — generates empire list for a game
// ---------------------------------------------------------------------------

import type { PseudoRandom } from "../../PseudoRandom.js";
import {
  ALL_EMPIRES,
  ALIEN_EMPIRES,
  HUMAN_EMPIRES,
  type EmpireDefinition,
} from "./EmpireData.js";

/**
 * Configuration for empire generation within a game.
 */
export interface EmpireCreationConfig {
  /** "disabled" = no AI empires, "default" = auto-pick count, number = exact count */
  empireMode: "disabled" | "default" | number;
  /** Maximum player slots on the map */
  maxPlayers: number;
  /** True for smaller / compact map types (25% empire count) */
  isCompactMap: boolean;
}

/**
 * A runtime empire instance derived from a template.
 */
export interface EmpireInstance {
  definition: EmpireDefinition;
  /** Assigned player-slot index (not the same as PlayerImpl.id) */
  slotIndex: number;
}

/**
 * Determine how many empires to create for a given config.
 */
export function computeEmpireCount(config: EmpireCreationConfig): number {
  if (config.empireMode === "disabled") return 0;

  let count: number;
  if (typeof config.empireMode === "number") {
    count = config.empireMode;
  } else {
    // "default" — scale to roughly half available slots
    count = Math.max(1, Math.floor(config.maxPlayers / 2));
  }

  if (config.isCompactMap) {
    count = Math.max(1, Math.floor(count * 0.25));
  }

  // Never exceed the template pool
  return Math.min(count, ALL_EMPIRES.length);
}

/**
 * Create empires for a game. Returns an ordered list of empire instances
 * with unique definitions randomly drawn from the pool.
 */
export function createEmpiresForGame(
  config: EmpireCreationConfig,
  rng: PseudoRandom,
): EmpireInstance[] {
  const count = computeEmpireCount(config);
  if (count === 0) return [];

  // Build a shuffled pool mixing aliens and humans
  const pool: EmpireDefinition[] = [...ALL_EMPIRES];
  rng.shuffle(pool);

  const selected = pool.slice(0, count);

  return selected.map((def, idx) => ({
    definition: def,
    slotIndex: idx,
  }));
}

/**
 * Get only alien empire definitions (shuffled).
 */
export function pickAlienEmpires(
  count: number,
  rng: PseudoRandom,
): EmpireDefinition[] {
  const pool = [...ALIEN_EMPIRES];
  rng.shuffle(pool);
  return pool.slice(0, Math.min(count, pool.length));
}

/**
 * Get only human empire definitions (shuffled).
 */
export function pickHumanEmpires(
  count: number,
  rng: PseudoRandom,
): EmpireDefinition[] {
  const pool = [...HUMAN_EMPIRES];
  rng.shuffle(pool);
  return pool.slice(0, Math.min(count, pool.length));
}
