import { UnitType, UPGRADEABLE_UNITS } from "./Types.js";

export interface UnitData {
  id: string;
  type: UnitType;
  ownerID: number;
  tile: number;
  level?: number;
  maxHealth?: number;
}

export class UnitImpl {
  // Identity
  readonly id: string;
  readonly type: UnitType;
  readonly ownerID: number;
  tile: number;
  level: number;

  // Health
  maxHealth: number;
  health: number;

  // State
  isActive: boolean;
  isConstructing: boolean;
  constructionProgress: number;
  constructionTotalTicks: number;
  private constructionTicksElapsed: number;

  // Targeting
  targetTile: number;
  destinationTile: number;

  // Timing
  createdTick: number;
  lastActivatedTick: number;
  cooldownTicks: number;

  constructor(data: UnitData) {
    this.id = data.id;
    this.type = data.type;
    this.ownerID = data.ownerID;
    this.tile = data.tile;
    this.level = data.level ?? 1;

    this.maxHealth = data.maxHealth ?? UnitImpl.getDefaultHealth(data.type);
    this.health = this.maxHealth;

    this.isActive = true;
    this.isConstructing = true;
    this.constructionProgress = 0;
    this.constructionTotalTicks = UnitImpl.getConstructionTime(data.type);
    this.constructionTicksElapsed = 0;

    this.targetTile = -1;
    this.destinationTile = -1;

    this.createdTick = 0;
    this.lastActivatedTick = 0;
    this.cooldownTicks = 0;
  }

  // Static methods
  static getDefaultHealth(type: UnitType): number {
    switch (type) {
      case UnitType.Colony:
        return 100;
      case UnitType.Starport:
        return 200;
      case UnitType.OrbitalForge:
        return 300;
      case UnitType.PlanetaryShield:
        return 500;
      case UnitType.SuperweaponFacility:
        return 400;
      case UnitType.InterceptorArray:
        return 250;
      case UnitType.WormholeGenerator:
        return 150;
      case UnitType.HyperloopStation:
        return 200;
    }
  }

  static getConstructionTime(type: UnitType): number {
    switch (type) {
      case UnitType.Colony:
        return 20;
      case UnitType.Starport:
        return 40;
      case UnitType.OrbitalForge:
        return 60;
      case UnitType.PlanetaryShield:
        return 80;
      case UnitType.SuperweaponFacility:
        return 120;
      case UnitType.InterceptorArray:
        return 50;
      case UnitType.WormholeGenerator:
        return 100;
      case UnitType.HyperloopStation:
        return 70;
    }
  }

  static getCooldown(type: UnitType): number {
    switch (type) {
      case UnitType.SuperweaponFacility:
        return 300;
      case UnitType.InterceptorArray:
        return 50;
      case UnitType.WormholeGenerator:
        return 200;
      default:
        return 0;
    }
  }

  // Instance methods
  isUpgradeable(): boolean {
    return (UPGRADEABLE_UNITS as readonly UnitType[]).includes(this.type);
  }

  canUpgrade(maxLevel: number): boolean {
    return this.isUpgradeable() && this.level < maxLevel && !this.isConstructing;
  }

  upgrade(): void {
    this.level += 1;
    this.maxHealth = Math.ceil(this.maxHealth * 1.2);
    this.health = this.maxHealth;
  }

  tickConstruction(): boolean {
    if (!this.isConstructing) {
      return true;
    }
    this.constructionTicksElapsed += 1;
    this.constructionProgress = this.constructionTicksElapsed / this.constructionTotalTicks;
    if (this.constructionTicksElapsed >= this.constructionTotalTicks) {
      this.constructionProgress = 1;
      this.isConstructing = false;
      return true;
    }
    return false;
  }

  takeDamage(amount: number): boolean {
    this.health -= amount;
    return this.health <= 0;
  }

  heal(amount: number): void {
    this.health = Math.min(this.health + amount, this.maxHealth);
  }

  isDestroyed(): boolean {
    return this.health <= 0;
  }

  activate(currentTick: number): boolean {
    if (!this.isActive || this.isConstructing || this.cooldownTicks > 0) {
      return false;
    }
    this.lastActivatedTick = currentTick;
    this.cooldownTicks = UnitImpl.getCooldown(this.type);
    return true;
  }

  deactivate(): void {
    this.isActive = false;
  }

  tickCooldown(): void {
    if (this.cooldownTicks > 0) {
      this.cooldownTicks -= 1;
    }
  }

  isReady(): boolean {
    return this.isActive && !this.isConstructing && this.cooldownTicks === 0;
  }

  getHealthPercent(): number {
    return this.health / this.maxHealth;
  }
}
