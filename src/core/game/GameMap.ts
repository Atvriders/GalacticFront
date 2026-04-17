import { TerrainType, PlanetType } from "./Types.js";

// Constants
export const NO_OWNER = 0;
export const MAX_OWNER_ID = 4095;

// Bit masks for terrain byte
export const TERRAIN_MASK = 0b11;
export const PLANET_TYPE_MASK = 0b00011100;
export const PLANET_TYPE_SHIFT = 2;

// Bit masks for state word
export const OWNER_MASK = 0x0fff;
export const SCORCHED_BIT = 1 << 12;
export const SHIELD_BIT = 1 << 13;

// Magnitude mask (5 bits)
const MAGNITUDE_MASK = 0x1f;

export class GameMap {
  readonly width: number;
  readonly height: number;

  /** terrain byte: bits 0-1 = TerrainType, bits 2-4 = PlanetType */
  readonly terrain: Uint8Array;

  /** state word: bits 0-11 = owner, bit 12 = scorched, bit 13 = shield */
  readonly state: Uint16Array;

  /** planet magnitude 0-31 */
  readonly magnitude: Uint8Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    const size = width * height;
    this.terrain = new Uint8Array(size);
    this.state = new Uint16Array(size);
    this.magnitude = new Uint8Array(size);
  }

  // ─── Coordinate helpers ─────────────────────────────────────────────────────

  toIndex(x: number, y: number): number {
    return y * this.width + x;
  }

  fromIndex(idx: number): { x: number; y: number } {
    return { x: idx % this.width, y: Math.floor(idx / this.width) };
  }

  isInBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  isValidTile(tile: number): boolean {
    return tile >= 0 && tile < this.width * this.height;
  }

  // ─── Terrain ─────────────────────────────────────────────────────────────────

  getTerrainType(tile: number): TerrainType {
    return (this.terrain[tile] & TERRAIN_MASK) as TerrainType;
  }

  setTerrainType(tile: number, type: TerrainType): void {
    this.terrain[tile] = (this.terrain[tile] & ~TERRAIN_MASK) | (type & TERRAIN_MASK);
  }

  getPlanetType(tile: number): PlanetType {
    return ((this.terrain[tile] & PLANET_TYPE_MASK) >> PLANET_TYPE_SHIFT) as PlanetType;
  }

  setPlanetType(tile: number, type: PlanetType): void {
    this.terrain[tile] =
      (this.terrain[tile] & ~PLANET_TYPE_MASK) |
      ((type << PLANET_TYPE_SHIFT) & PLANET_TYPE_MASK);
  }

  getMagnitude(tile: number): number {
    return this.magnitude[tile] & MAGNITUDE_MASK;
  }

  setMagnitude(tile: number, mag: number): void {
    this.magnitude[tile] = mag & MAGNITUDE_MASK;
  }

  isPlanet(tile: number): boolean {
    return this.getTerrainType(tile) === TerrainType.Planet;
  }

  /** Traversable = anything except Asteroid */
  isTraversable(tile: number): boolean {
    return this.getTerrainType(tile) !== TerrainType.Asteroid;
  }

  // ─── State ───────────────────────────────────────────────────────────────────

  getOwner(tile: number): number {
    return this.state[tile] & OWNER_MASK;
  }

  setOwner(tile: number, id: number): void {
    this.state[tile] = (this.state[tile] & ~OWNER_MASK) | (id & OWNER_MASK);
  }

  isOwned(tile: number): boolean {
    return this.getOwner(tile) !== NO_OWNER;
  }

  isOwnedBy(tile: number, id: number): boolean {
    return this.getOwner(tile) === id;
  }

  isScorched(tile: number): boolean {
    return (this.state[tile] & SCORCHED_BIT) !== 0;
  }

  setScorched(tile: number, value: boolean): void {
    if (value) {
      this.state[tile] |= SCORCHED_BIT;
    } else {
      this.state[tile] &= ~SCORCHED_BIT;
    }
  }

  isShielded(tile: number): boolean {
    return (this.state[tile] & SHIELD_BIT) !== 0;
  }

  setShielded(tile: number, value: boolean): void {
    if (value) {
      this.state[tile] |= SHIELD_BIT;
    } else {
      this.state[tile] &= ~SHIELD_BIT;
    }
  }

  // ─── Neighbors ───────────────────────────────────────────────────────────────

  /** 4-directional neighbors (N, E, S, W) */
  getNeighbors4(tile: number): number[] {
    const { x, y } = this.fromIndex(tile);
    const result: number[] = [];
    // N
    if (y > 0) result.push(this.toIndex(x, y - 1));
    // E
    if (x < this.width - 1) result.push(this.toIndex(x + 1, y));
    // S
    if (y < this.height - 1) result.push(this.toIndex(x, y + 1));
    // W
    if (x > 0) result.push(this.toIndex(x - 1, y));
    return result;
  }

  /** 8-directional neighbors */
  getNeighbors8(tile: number): number[] {
    const { x, y } = this.fromIndex(tile);
    const result: number[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (this.isInBounds(nx, ny)) {
          result.push(this.toIndex(nx, ny));
        }
      }
    }
    return result;
  }

  // ─── Bulk operations ─────────────────────────────────────────────────────────

  /** Convenience: set terrain to Planet, assign type and magnitude */
  setPlanet(tile: number, type: PlanetType, mag: number): void {
    this.setTerrainType(tile, TerrainType.Planet);
    this.setPlanetType(tile, type);
    this.setMagnitude(tile, mag);
  }

  /**
   * Pack all tile data into a single 32-bit number:
   * bits 31-24: terrain byte
   * bits 23-8:  state word
   * bits 7-0:   magnitude byte
   */
  packTile(tile: number): number {
    return (
      ((this.terrain[tile] & 0xff) << 24) |
      ((this.state[tile] & 0xffff) << 8) |
      (this.magnitude[tile] & 0xff)
    );
  }

  /** Restore tile from a packed value produced by packTile */
  unpackTile(tile: number, packed: number): void {
    this.terrain[tile] = (packed >>> 24) & 0xff;
    this.state[tile] = (packed >>> 8) & 0xffff;
    this.magnitude[tile] = packed & 0xff;
  }

  /** Count tiles owned by the given player ID */
  countOwnedBy(id: number): number {
    let count = 0;
    for (let i = 0; i < this.state.length; i++) {
      if ((this.state[i] & OWNER_MASK) === id) count++;
    }
    return count;
  }

  /** Get all tile indices owned by the given player ID */
  getTilesOwnedBy(id: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < this.state.length; i++) {
      if ((this.state[i] & OWNER_MASK) === id) result.push(i);
    }
    return result;
  }
}
