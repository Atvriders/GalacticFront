export interface MapEntry {
  name: string;
  mapType: string;
  teamCount: number; // number of teams (1 = FFA, 2+ = teams)
  frequency: number; // relative weight, higher = more frequent
  modifiers?: string[]; // e.g. ["fog", "turbo"]
}

export interface MapPlaylistOptions {
  excludeModifiers?: string[];
  teamCountFilter?: number;
}

export class MapPlaylist {
  private maps: MapEntry[];
  private history: string[] = [];
  private maxHistorySize = 5;

  constructor(maps: MapEntry[]) {
    this.maps = maps;
  }

  /**
   * Pick the next map using frequency-weighted random selection.
   * - Excludes maps with any excluded modifier.
   * - Filters by team count if specified.
   * - Avoids repeating recent maps (within history window).
   */
  next(options: MapPlaylistOptions = {}, rng?: () => number): MapEntry {
    const rand = rng ?? Math.random;
    let eligible = this.maps;

    // Filter by team count
    if (options.teamCountFilter !== undefined) {
      eligible = eligible.filter(
        (m) => m.teamCount === options.teamCountFilter,
      );
    }

    // Exclude maps with banned modifiers
    if (options.excludeModifiers && options.excludeModifiers.length > 0) {
      const banned = new Set(options.excludeModifiers);
      eligible = eligible.filter(
        (m) => !m.modifiers?.some((mod) => banned.has(mod)),
      );
    }

    // Avoid recent history (best-effort: if all are in history, allow all)
    const nonRecent = eligible.filter(
      (m) => !this.history.includes(m.name),
    );
    if (nonRecent.length > 0) {
      eligible = nonRecent;
    }

    if (eligible.length === 0) {
      throw new Error("No eligible maps in playlist");
    }

    // Weighted selection
    const totalWeight = eligible.reduce((sum, m) => sum + m.frequency, 0);
    let roll = rand() * totalWeight;

    for (const map of eligible) {
      roll -= map.frequency;
      if (roll <= 0) {
        this.addToHistory(map.name);
        return map;
      }
    }

    // Fallback (shouldn't happen)
    const last = eligible[eligible.length - 1];
    this.addToHistory(last.name);
    return last;
  }

  /**
   * Get all maps matching the given team count.
   */
  getByTeamCount(teamCount: number): MapEntry[] {
    return this.maps.filter((m) => m.teamCount === teamCount);
  }

  /**
   * Get the distribution of team counts.
   */
  teamCountDistribution(): Map<number, number> {
    const dist = new Map<number, number>();
    for (const map of this.maps) {
      dist.set(map.teamCount, (dist.get(map.teamCount) ?? 0) + 1);
    }
    return dist;
  }

  private addToHistory(name: string): void {
    this.history.push(name);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }
}
