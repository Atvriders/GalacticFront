// ---------------------------------------------------------------------------
// LocalPersistantStats – persist game records in localStorage
// ---------------------------------------------------------------------------

const STORAGE_KEY = "game-records";

export interface GameConfig {
  map: string;
  playerCount: number;
  difficulty?: string;
}

export interface GameRecord {
  id: string;
  config: GameConfig;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  result: "win" | "loss" | "draw";
}

interface PendingGame {
  id: string;
  config: GameConfig;
  startedAt: number;
}

export class LocalPersistantStats {
  private pending: PendingGame | null = null;
  private storage: Storage;

  constructor(storage: Storage) {
    this.storage = storage;
  }

  startGame(config: GameConfig): void {
    this.pending = {
      id: Math.random().toString(36).slice(2),
      config,
      startedAt: Date.now(),
    };
  }

  endGame(result: "win" | "loss" | "draw"): GameRecord | null {
    if (!this.pending) return null;

    const now = Date.now();
    const record: GameRecord = {
      id: this.pending.id,
      config: this.pending.config,
      startedAt: this.pending.startedAt,
      endedAt: now,
      durationMs: now - this.pending.startedAt,
      result,
    };

    const records = this.getRecords();
    records.push(record);
    this.storage.setItem(STORAGE_KEY, JSON.stringify(records));

    this.pending = null;
    return record;
  }

  getRecords(): GameRecord[] {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
}
