import { UnitType, PlanetType } from "@core/game/Types";
import { GameBalanceConfig, UnitCostConfig } from "./Config.js";

export const DEFAULT_CONFIG: GameBalanceConfig = {
  ticksPerSecond: 10,
  winConditionTerritory: 0.6,
  maxGameTicks: 108000, // 3 hours at 10 tps
  relationDecayRate: 0.01,
  relationMin: -100,
  relationMax: 100,

  troopGen: {
    basePerTile: 1.0,
    planetMultiplier: 5.0,
    maxDensity: 1000,
  },

  credits: {
    baseIncome: 10,
    perTileIncome: 0.5,
    starportMultiplier: 2.0,
  },

  unitCosts: {
    [UnitType.Colony]: {
      baseCost: 100n,
      scalingFactor: 1.5,
      maxLevel: 1,
      upgradeCostMultiplier: 1.0,
    },
    [UnitType.Starport]: {
      baseCost: 200n,
      scalingFactor: 1.8,
      maxLevel: 5,
      upgradeCostMultiplier: 2.0,
    },
    [UnitType.OrbitalForge]: {
      baseCost: 350n,
      scalingFactor: 2.0,
      maxLevel: 5,
      upgradeCostMultiplier: 2.5,
    },
    [UnitType.PlanetaryShield]: {
      baseCost: 300n,
      scalingFactor: 1.9,
      maxLevel: 5,
      upgradeCostMultiplier: 2.2,
    },
    [UnitType.SuperweaponFacility]: {
      baseCost: 1000n,
      scalingFactor: 3.0,
      maxLevel: 3,
      upgradeCostMultiplier: 4.0,
    },
    [UnitType.InterceptorArray]: {
      baseCost: 400n,
      scalingFactor: 2.2,
      maxLevel: 5,
      upgradeCostMultiplier: 2.8,
    },
    [UnitType.WormholeGenerator]: {
      baseCost: 750n,
      scalingFactor: 2.5,
      maxLevel: 3,
      upgradeCostMultiplier: 3.5,
    },
    [UnitType.HyperloopStation]: {
      baseCost: 500n,
      scalingFactor: 2.0,
      maxLevel: 4,
      upgradeCostMultiplier: 3.0,
    },
  },

  planetTypes: {
    [PlanetType.Barren]: {
      captureCost: 50,
      defenseMultiplier: 1.0,
      troopGenMultiplier: 0.5,
      magnitudeRange: [1, 3],
    },
    [PlanetType.Terran]: {
      captureCost: 100,
      defenseMultiplier: 1.2,
      troopGenMultiplier: 1.5,
      magnitudeRange: [2, 5],
    },
    [PlanetType.Oceanic]: {
      captureCost: 120,
      defenseMultiplier: 1.3,
      troopGenMultiplier: 1.4,
      magnitudeRange: [2, 5],
    },
    [PlanetType.Volcanic]: {
      captureCost: 80,
      defenseMultiplier: 1.5,
      troopGenMultiplier: 0.8,
      magnitudeRange: [1, 4],
    },
    [PlanetType.GasGiant]: {
      captureCost: 200,
      defenseMultiplier: 0.8,
      troopGenMultiplier: 2.0,
      magnitudeRange: [3, 7],
    },
    [PlanetType.Ice]: {
      captureCost: 70,
      defenseMultiplier: 1.1,
      troopGenMultiplier: 0.7,
      magnitudeRange: [1, 3],
    },
    [PlanetType.Desert]: {
      captureCost: 60,
      defenseMultiplier: 1.0,
      troopGenMultiplier: 0.9,
      magnitudeRange: [1, 4],
    },
    [PlanetType.Nebula]: {
      captureCost: 150,
      defenseMultiplier: 0.7,
      troopGenMultiplier: 2.5,
      magnitudeRange: [3, 8],
    },
  },

  defense: {
    baseTerritoryDefense: 1.0,
    shieldBonus: 0.5,
    planetaryShieldPerLevel: 0.2,
    retreatDefensePenalty: 0.3,
  },

  attack: {
    maxActiveAttacks: 5,
    idleTimeoutTicks: 300,
    troopCostPerTile: 0.1,
    expansionRate: 1.0,
  },

  alliance: {
    minDuration: 600,
    maxDuration: 36000,
    breakCooldown: 1800,
    maxAlliances: 3,
    requestExpiry: 300,
  },
};

/**
 * Returns the cost to build the next unit of a given type, accounting for
 * exponential scaling based on how many are already owned.
 *
 * cost = baseCost * scalingFactor^existingCount
 */
export function getUnitCost(
  unitType: UnitType,
  existingCount: number,
  config: GameBalanceConfig = DEFAULT_CONFIG,
): bigint {
  const unitConfig: UnitCostConfig | undefined = config.unitCosts[unitType];
  if (!unitConfig) {
    throw new Error(`Unknown unit type: ${unitType}`);
  }
  const multiplier = Math.pow(unitConfig.scalingFactor, existingCount);
  return BigInt(Math.round(Number(unitConfig.baseCost) * multiplier));
}

/**
 * Returns the cost to upgrade a unit from currentLevel to currentLevel+1.
 *
 * cost = baseCost * upgradeCostMultiplier^currentLevel
 *
 * Throws if currentLevel >= maxLevel.
 */
export function getUpgradeCost(
  unitType: UnitType,
  currentLevel: number,
  config: GameBalanceConfig = DEFAULT_CONFIG,
): bigint {
  const unitConfig: UnitCostConfig | undefined = config.unitCosts[unitType];
  if (!unitConfig) {
    throw new Error(`Unknown unit type: ${unitType}`);
  }
  if (currentLevel >= unitConfig.maxLevel) {
    throw new Error(
      `Unit ${unitType} is already at max level (${unitConfig.maxLevel})`,
    );
  }
  const multiplier = Math.pow(unitConfig.upgradeCostMultiplier, currentLevel);
  return BigInt(Math.round(Number(unitConfig.baseCost) * multiplier));
}
