import { UnitType, PlanetType } from "@core/game/Types";

export interface TroopGenConfig {
  basePerTile: number;
  planetMultiplier: number;
  maxDensity: number;
}

export interface CreditConfig {
  baseIncome: number;
  perTileIncome: number;
  starportMultiplier: number;
}

export interface UnitCostConfig {
  baseCost: bigint;
  scalingFactor: number;
  maxLevel: number;
  upgradeCostMultiplier: number;
}

export interface PlanetTypeCostConfig {
  captureCost: number;
  defenseMultiplier: number;
  troopGenMultiplier: number;
  magnitudeRange: [number, number];
}

export interface DefenseConfig {
  baseTerritoryDefense: number;
  shieldBonus: number;
  planetaryShieldPerLevel: number;
  retreatDefensePenalty: number;
}

export interface AttackConfig {
  maxActiveAttacks: number;
  idleTimeoutTicks: number;
  troopCostPerTile: number;
  expansionRate: number;
}

export interface AllianceConfig {
  minDuration: number;
  maxDuration: number;
  breakCooldown: number;
  maxAlliances: number;
  requestExpiry: number;
}

export interface GameBalanceConfig {
  troopGen: TroopGenConfig;
  credits: CreditConfig;
  unitCosts: Record<UnitType, UnitCostConfig>;
  planetTypes: Record<PlanetType, PlanetTypeCostConfig>;
  defense: DefenseConfig;
  attack: AttackConfig;
  alliance: AllianceConfig;
  ticksPerSecond: number;
  winConditionTerritory: number;
  maxGameTicks: number;
  relationDecayRate: number;
  relationMin: number;
  relationMax: number;
}
