export class AttackImpl {
  readonly id: string;
  readonly attackerID: number;
  readonly defenderID: number;
  readonly sourceTile: number;
  readonly troopRatio: number;
  readonly startTick: number;

  troops: bigint = 0n;
  isRetreating = false;
  lastExpansionTick: number;

  borderTiles: Set<number> = new Set();
  conqueredTiles: Set<number> = new Set();
  clusterPositions: Array<{ x: number; y: number; troops: number }> = [];

  constructor(
    id: string,
    attackerID: number,
    defenderID: number,
    sourceTile: number,
    troopRatio: number,
    startTick: number,
  ) {
    this.id = id;
    this.attackerID = attackerID;
    this.defenderID = defenderID;
    this.sourceTile = sourceTile;
    this.troopRatio = troopRatio;
    this.startTick = startTick;
    this.lastExpansionTick = startTick;
  }

  addBorderTile(tile: number): void {
    this.borderTiles.add(tile);
  }

  removeBorderTile(tile: number): void {
    this.borderTiles.delete(tile);
  }

  conquerTile(tile: number): void {
    this.borderTiles.delete(tile);
    this.conqueredTiles.add(tile);
  }

  loseTile(tile: number): void {
    this.conqueredTiles.delete(tile);
  }

  startRetreat(): void {
    this.isRetreating = true;
  }

  isExhausted(): boolean {
    return this.borderTiles.size === 0 && this.conqueredTiles.size === 0;
  }

  isTimedOut(currentTick: number, timeoutTicks: number): boolean {
    return currentTick - this.lastExpansionTick >= timeoutTicks;
  }

  recordExpansion(tick: number): void {
    this.lastExpansionTick = tick;
  }

  get conqueredCount(): number {
    return this.conqueredTiles.size;
  }

  get borderCount(): number {
    return this.borderTiles.size;
  }
}
