// ---------------------------------------------------------------------------
// EmpireExecution — Central AI orchestrator for empire players
// ---------------------------------------------------------------------------

import type { GameImpl } from "../game/GameImpl.js";
import type { PlayerImpl } from "../game/PlayerImpl.js";
import type { PseudoRandom } from "../PseudoRandom.js";
import type { EmpireDefinition, BehaviorWeights } from "./empire/EmpireData.js";
import {
  randomTroopAllocation,
  executeAttack,
  type TroopAllocation,
} from "./empire/AttackBehavior.js";
import { allianceTick } from "./empire/AllianceBehavior.js";
import { cruiserTick } from "./empire/CruiserBehavior.js";
import { superweaponTick } from "./empire/SuperweaponBehavior.js";
import { swarmTick } from "./empire/SwarmBehavior.js";
import { structureTick } from "./empire/StructureBehavior.js";
import { emojiTick } from "./empire/EmojiBehavior.js";
import type { TickAI } from "./TribeExecution.js";

// ---------------------------------------------------------------------------
// Difficulty interval ranges (ticks between actions)
// ---------------------------------------------------------------------------

export interface DifficultyInterval {
  min: number;
  max: number;
}

export const DIFFICULTY_INTERVALS: Record<string, DifficultyInterval> = {
  Easy: { min: 65, max: 80 },
  Medium: { min: 50, max: 65 },
  Hard: { min: 40, max: 50 },
  Impossible: { min: 30, max: 50 },
};

function getDifficultyInterval(difficulty: string): DifficultyInterval {
  return DIFFICULTY_INTERVALS[difficulty] ?? DIFFICULTY_INTERVALS["Medium"]!;
}

// ---------------------------------------------------------------------------
// EmpireExecution
// ---------------------------------------------------------------------------

export class EmpireExecution implements TickAI {
  readonly name: string;
  readonly definition: EmpireDefinition;
  readonly interval: number;
  private readonly rng: PseudoRandom;
  private readonly allocation: TroopAllocation;
  private readonly difficulty: string;

  /** Lazy init — skip first N ticks so spawn phase can finish */
  private initialized: boolean = false;
  private readonly initDelay: number;

  constructor(
    definition: EmpireDefinition,
    difficulty: string,
    rng: PseudoRandom,
    initDelay: number = 100,
  ) {
    this.definition = definition;
    this.difficulty = difficulty;
    this.rng = rng;
    this.name = definition.name;
    this.initDelay = initDelay;
    this.allocation = randomTroopAllocation(rng);

    const range = getDifficultyInterval(difficulty);
    this.interval = rng.nextInt(range.min, range.max);
  }

  tick(game: GameImpl, playerID: number, currentTick: number): void {
    // Lazy init: skip until spawn phase is over
    if (!this.initialized) {
      if (currentTick < this.initDelay) return;
      this.initialized = true;
    }

    if (currentTick % this.interval !== 0) return;

    const player = game.getPlayer(playerID);
    if (!player || !player.isAlive) return;

    const weights = this.definition.weights;

    // Run each behavior module, weighted by definition
    this.runBehaviors(game, player, weights, currentTick);
  }

  private runBehaviors(
    game: GameImpl,
    player: PlayerImpl,
    weights: BehaviorWeights,
    currentTick: number,
  ): void {
    const neighborIDs = this.findBorderNeighborIDs(game, player);

    // Attack behavior
    if (this.rng.chance(weights.attack)) {
      executeAttack(game, player, neighborIDs, this.allocation);
    }

    // Alliance behavior
    if (this.rng.chance(weights.diplomacy)) {
      allianceTick(game, player, neighborIDs, this.rng);
    }

    // Structure/build behavior
    if (this.rng.chance(weights.build)) {
      structureTick(game, player, this.definition, this.rng);
    }

    // Cruiser behavior
    if (this.rng.chance(weights.attack * 0.5)) {
      cruiserTick(game, player, this.rng);
    }

    // Superweapon behavior
    if (this.rng.chance(weights.superweapon)) {
      superweaponTick(game, player, neighborIDs, this.rng);
    }

    // Swarm/bombardment behavior
    if (this.rng.chance(weights.attack * 0.3)) {
      swarmTick(game, player, neighborIDs, this.allocation);
    }

    // Emoji behavior
    if (this.rng.chance(weights.diplomacy * 0.5)) {
      emojiTick(game, player, neighborIDs, this.rng);
    }
  }

  private findBorderNeighborIDs(
    game: GameImpl,
    player: PlayerImpl,
  ): number[] {
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
}
