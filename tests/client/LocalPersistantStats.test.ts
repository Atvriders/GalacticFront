import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LocalPersistantStats } from "../../src/client/LocalPersistantStats";

function createMockStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => store.clear(),
    get length() { return store.size; },
    key: (_index: number) => null,
  };
}

describe("LocalPersistantStats", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("returns empty records when nothing stored", () => {
    const stats = new LocalPersistantStats(createMockStorage());
    expect(stats.getRecords()).toEqual([]);
  });

  it("records a game from start to end", () => {
    const stats = new LocalPersistantStats(createMockStorage());
    stats.startGame({ map: "alpha", playerCount: 4 });

    vi.advanceTimersByTime(5000);
    const record = stats.endGame("win");

    expect(record).not.toBeNull();
    expect(record!.result).toBe("win");
    expect(record!.durationMs).toBe(5000);
    expect(record!.config.map).toBe("alpha");
  });

  it("persists records across instances", () => {
    const storage = createMockStorage();

    const stats1 = new LocalPersistantStats(storage);
    stats1.startGame({ map: "beta", playerCount: 2 });
    stats1.endGame("loss");

    const stats2 = new LocalPersistantStats(storage);
    expect(stats2.getRecords()).toHaveLength(1);
    expect(stats2.getRecords()[0].result).toBe("loss");
  });

  it("accumulates multiple records", () => {
    const storage = createMockStorage();
    const stats = new LocalPersistantStats(storage);

    stats.startGame({ map: "a", playerCount: 2 });
    stats.endGame("win");

    stats.startGame({ map: "b", playerCount: 4 });
    stats.endGame("draw");

    expect(stats.getRecords()).toHaveLength(2);
  });

  it("endGame returns null if no game started", () => {
    const stats = new LocalPersistantStats(createMockStorage());
    expect(stats.endGame("win")).toBeNull();
  });

  it("handles corrupted storage gracefully", () => {
    const storage = createMockStorage();
    storage.setItem("game-records", "not json{{{");
    const stats = new LocalPersistantStats(storage);
    expect(stats.getRecords()).toEqual([]);
  });
});
