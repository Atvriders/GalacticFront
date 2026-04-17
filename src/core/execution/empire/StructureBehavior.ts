// ---------------------------------------------------------------------------
// StructureBehavior — Build priorities per faction personality
// ---------------------------------------------------------------------------

import type { GameImpl } from "../../game/GameImpl.js";
import type { PlayerImpl } from "../../game/PlayerImpl.js";
import type { PseudoRandom } from "../../PseudoRandom.js";
import { UnitType } from "../../game/Types.js";
import type { EmpireDefinition } from "./EmpireData.js";
import { hasPersonality } from "./EmpireData.js";
import { findBuildTile } from "./CruiserBehavior.js";

/**
 * Build priority list per personality type.
 * Aggressive empires prioritize offensive structures.
 * Defensive empires prioritize shields and interceptors.
 * Naval empires prioritize starports.
 * Balanced empires have even priorities.
 */
export function getBuildPriorities(
  definition: EmpireDefinition,
): UnitType[] {
  if (
    hasPersonality(definition, "berserker") ||
    hasPersonality(definition, "aggressive")
  ) {
    return [
      UnitType.SuperweaponFacility,
      UnitType.OrbitalForge,
      UnitType.Starport,
      UnitType.Colony,
      UnitType.PlanetaryShield,
      UnitType.InterceptorArray,
    ];
  }

  if (hasPersonality(definition, "defensive")) {
    return [
      UnitType.PlanetaryShield,
      UnitType.InterceptorArray,
      UnitType.Starport,
      UnitType.Colony,
      UnitType.OrbitalForge,
      UnitType.SuperweaponFacility,
    ];
  }

  if (hasPersonality(definition, "naval")) {
    return [
      UnitType.Starport,
      UnitType.OrbitalForge,
      UnitType.Colony,
      UnitType.PlanetaryShield,
      UnitType.SuperweaponFacility,
      UnitType.InterceptorArray,
    ];
  }

  if (hasPersonality(definition, "raider")) {
    return [
      UnitType.OrbitalForge,
      UnitType.Starport,
      UnitType.SuperweaponFacility,
      UnitType.Colony,
      UnitType.PlanetaryShield,
      UnitType.InterceptorArray,
    ];
  }

  // Balanced / fallback
  return [
    UnitType.Colony,
    UnitType.Starport,
    UnitType.PlanetaryShield,
    UnitType.OrbitalForge,
    UnitType.InterceptorArray,
    UnitType.SuperweaponFacility,
  ];
}

/**
 * Structure build tick. Attempts to build the highest-priority structure
 * the empire can afford.
 */
export function structureTick(
  game: GameImpl,
  player: PlayerImpl,
  definition: EmpireDefinition,
  rng: PseudoRandom,
): void {
  const priorities = getBuildPriorities(definition);

  for (const unitType of priorities) {
    const tile = findBuildTile(game, player, rng);
    if (tile === -1) break;

    const result = game.buildUnit(player.id, unitType, tile);
    if (result !== null) {
      // Successfully built one structure per tick
      return;
    }
  }
}
