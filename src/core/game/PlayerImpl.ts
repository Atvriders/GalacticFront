import { PlayerType, UnitType, Relation, BUILDABLE_UNITS } from "./Types.js";

export interface PlayerData {
  id: number;
  clientID: string;
  name: string;
  playerType: PlayerType;
  spawnTile: number;
}

export class PlayerImpl {
  // Identity
  readonly id: number;
  readonly clientID: string;
  readonly name: string;
  readonly playerType: PlayerType;
  readonly spawnTile: number;
  capitalTile: number;

  // State
  isAlive: boolean = true;
  hasSurrendered: boolean = false;
  eliminatedTick: number = -1;

  // Resources
  troops: bigint = 0n;
  credits: bigint = 0n;

  // Territory
  private _territory: Set<number> = new Set();

  // Relations: playerID -> relation value [-100, 100]
  private _relations: Map<number, number> = new Map();

  // Alliances: allyID -> expirationTick
  private _alliances: Map<number, number> = new Map();

  // Embargoes
  private _embargoes: Set<number> = new Set();

  // Units: unitID -> { type, tile, level }
  private _units: Map<string, { type: UnitType; tile: number; level: number }> =
    new Map();

  constructor(data: PlayerData) {
    this.id = data.id;
    this.clientID = data.clientID;
    this.name = data.name;
    this.playerType = data.playerType;
    this.spawnTile = data.spawnTile;
    this.capitalTile = data.spawnTile;
  }

  // --- Territory ---

  addTerritory(tile: number): void {
    this._territory.add(tile);
  }

  removeTerritory(tile: number): void {
    this._territory.delete(tile);
  }

  ownsTerritory(tile: number): boolean {
    return this._territory.has(tile);
  }

  get territoryCount(): number {
    return this._territory.size;
  }

  get territory(): Set<number> {
    return this._territory;
  }

  // --- Relations ---

  getRelation(id: number): number {
    return this._relations.get(id) ?? 0;
  }

  setRelation(id: number, value: number): void {
    const clamped = Math.max(-100, Math.min(100, value));
    this._relations.set(id, clamped);
  }

  adjustRelation(id: number, delta: number): void {
    this.setRelation(id, this.getRelation(id) + delta);
  }

  getRelationCategory(id: number): Relation {
    if (this.isAlliedWith(id)) return Relation.Allied;
    const value = this.getRelation(id);
    if (value >= 50) return Relation.Friendly;
    if (value <= -50) return Relation.Hostile;
    return Relation.Neutral;
  }

  decayRelations(rate: number): void {
    for (const [id, value] of this._relations.entries()) {
      if (value === 0) continue;
      const next = value > 0 ? Math.max(0, value - rate) : Math.min(0, value + rate);
      this._relations.set(id, next);
    }
  }

  // --- Alliances ---

  addAlliance(id: number, expTick: number): void {
    this._alliances.set(id, expTick);
  }

  removeAlliance(id: number): void {
    this._alliances.delete(id);
  }

  isAlliedWith(id: number): boolean {
    return this._alliances.has(id);
  }

  getAlliances(): ReadonlyMap<number, number> {
    return this._alliances;
  }

  getAllianceCount(): number {
    return this._alliances.size;
  }

  expireAlliances(currentTick: number): number[] {
    const expired: number[] = [];
    for (const [id, expTick] of this._alliances.entries()) {
      if (currentTick >= expTick) {
        expired.push(id);
      }
    }
    for (const id of expired) {
      this._alliances.delete(id);
    }
    return expired;
  }

  // --- Embargoes ---

  setEmbargo(id: number): void {
    this._embargoes.add(id);
  }

  clearEmbargo(id: number): void {
    this._embargoes.delete(id);
  }

  hasEmbargo(id: number): boolean {
    return this._embargoes.has(id);
  }

  // --- Units ---

  addUnit(id: string, type: UnitType, tile: number, level: number = 1): void {
    this._units.set(id, { type, tile, level });
  }

  removeUnit(id: string): void {
    this._units.delete(id);
  }

  getUnit(id: string): { type: UnitType; tile: number; level: number } | undefined {
    return this._units.get(id);
  }

  getUnitCount(type: UnitType): number {
    let count = 0;
    for (const unit of this._units.values()) {
      if (unit.type === type) count++;
    }
    return count;
  }

  getAllUnits(): ReadonlyMap<string, { type: UnitType; tile: number; level: number }> {
    return this._units;
  }

  getBuildableUnits(): readonly UnitType[] {
    return BUILDABLE_UNITS;
  }

  // --- Lifecycle ---

  eliminate(tick: number): void {
    this.isAlive = false;
    this.eliminatedTick = tick;
    this._territory.clear();
  }

  surrender(tick: number): void {
    this.hasSurrendered = true;
    this.eliminate(tick);
  }
}
