export enum StatType {
  Troops = "Troops",
  Territory = "Territory",
  Credits = "Credits",
  UnitsBuilt = "UnitsBuilt",
  UnitsLost = "UnitsLost",
  TilesConquered = "TilesConquered",
  TilesLost = "TilesLost",
  AttacksLaunched = "AttacksLaunched",
  AlliancesFormed = "AlliancesFormed",
}

const ALL_STAT_TYPES: StatType[] = [
  StatType.Troops,
  StatType.Territory,
  StatType.Credits,
  StatType.UnitsBuilt,
  StatType.UnitsLost,
  StatType.TilesConquered,
  StatType.TilesLost,
  StatType.AttacksLaunched,
  StatType.AlliancesFormed,
];

export class StatsImpl {
  private data: Map<StatType, Map<number, bigint[]>>;
  private snapshotIndex: number;
  private readonly snapshotInterval: number;

  constructor(snapshotInterval: number = 10) {
    this.snapshotInterval = snapshotInterval;
    this.snapshotIndex = 0;
    this.data = new Map();
    for (const stat of ALL_STAT_TYPES) {
      this.data.set(stat, new Map());
    }
  }

  private getOrCreateSeries(stat: StatType, playerID: number): bigint[] {
    const statMap = this.data.get(stat)!;
    if (!statMap.has(playerID)) {
      statMap.set(playerID, []);
    }
    return statMap.get(playerID)!;
  }

  record(stat: StatType, playerID: number, value: bigint): void {
    const series = this.getOrCreateSeries(stat, playerID);
    series[this.snapshotIndex] = value;
  }

  increment(stat: StatType, playerID: number, delta: bigint = 1n): void {
    const current = this.getCurrent(stat, playerID);
    this.record(stat, playerID, current + delta);
  }

  getCurrent(stat: StatType, playerID: number): bigint {
    const statMap = this.data.get(stat)!;
    const series = statMap.get(playerID);
    if (!series || series.length === 0) return 0n;
    // Walk back from snapshotIndex to find the latest recorded value
    for (let i = this.snapshotIndex; i >= 0; i--) {
      if (series[i] !== undefined) return series[i];
    }
    return 0n;
  }

  getTimeSeries(stat: StatType, playerID: number): readonly bigint[] {
    const statMap = this.data.get(stat)!;
    return statMap.get(playerID) ?? [];
  }

  advanceSnapshot(): void {
    this.snapshotIndex++;
  }

  getSnapshotIndex(): number {
    return this.snapshotIndex;
  }

  getPlayersForStat(stat: StatType): number[] {
    const statMap = this.data.get(stat)!;
    return Array.from(statMap.keys());
  }

  getLeaderboard(stat: StatType): Array<{ playerID: number; value: bigint }> {
    const statMap = this.data.get(stat)!;
    const entries: Array<{ playerID: number; value: bigint }> = [];
    for (const playerID of statMap.keys()) {
      entries.push({ playerID, value: this.getCurrent(stat, playerID) });
    }
    return entries.sort((a, b) => (b.value > a.value ? 1 : b.value < a.value ? -1 : 0));
  }

  clear(): void {
    this.snapshotIndex = 0;
    this.data = new Map();
    for (const stat of ALL_STAT_TYPES) {
      this.data.set(stat, new Map());
    }
  }
}
