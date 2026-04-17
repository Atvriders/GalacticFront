import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MultiTabDetector, PUNISHMENT_DURATION_MS } from "../../src/client/MultiTabDetector";

// ---------------------------------------------------------------------------
// Minimal localStorage stub
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MultiTabDetector", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is not blocked when started as only tab", () => {
    const storage = createMockStorage();
    const detector = new MultiTabDetector(storage);
    detector.start();
    expect(detector.isBlocked()).toBe(false);
    detector.stop();
  });

  it("is blocked when another tab holds a fresh lock", () => {
    const storage = createMockStorage();

    // Simulate another tab's lock
    storage.setItem(
      "gf_tab_lock",
      JSON.stringify({ tabId: "other", timestamp: Date.now() }),
    );

    const detector = new MultiTabDetector(storage);
    detector.start();
    expect(detector.isBlocked()).toBe(true);
    detector.stop();
  });

  it("is not blocked when existing lock is stale", () => {
    const storage = createMockStorage();

    // Simulate a stale lock (>3s old)
    storage.setItem(
      "gf_tab_lock",
      JSON.stringify({ tabId: "other", timestamp: Date.now() - 4000 }),
    );

    const detector = new MultiTabDetector(storage);
    detector.start();
    expect(detector.isBlocked()).toBe(false);
    detector.stop();
  });

  it("punishment expires after PUNISHMENT_DURATION_MS", () => {
    const storage = createMockStorage();

    storage.setItem(
      "gf_tab_lock",
      JSON.stringify({ tabId: "other", timestamp: Date.now() }),
    );

    const detector = new MultiTabDetector(storage);
    detector.start();
    expect(detector.isBlocked()).toBe(true);

    vi.advanceTimersByTime(PUNISHMENT_DURATION_MS);
    expect(detector.isBlocked()).toBe(false);
    detector.stop();
  });

  it("clears lock on stop if this tab owns it", () => {
    const storage = createMockStorage();
    const detector = new MultiTabDetector(storage);
    detector.start();
    expect(storage.getItem("gf_tab_lock")).not.toBeNull();
    detector.stop();
    expect(storage.getItem("gf_tab_lock")).toBeNull();
  });

  it("does not clear lock on stop if another tab owns it", () => {
    const storage = createMockStorage();
    const detector = new MultiTabDetector(storage);
    detector.start();

    // Overwrite lock with another tab
    storage.setItem(
      "gf_tab_lock",
      JSON.stringify({ tabId: "other_tab", timestamp: Date.now() }),
    );

    detector.stop();
    expect(storage.getItem("gf_tab_lock")).not.toBeNull();
  });

  it("heartbeat detects another tab taking the lock", () => {
    const storage = createMockStorage();
    const detector = new MultiTabDetector(storage);
    detector.start();
    expect(detector.isBlocked()).toBe(false);

    // Another tab takes the lock
    storage.setItem(
      "gf_tab_lock",
      JSON.stringify({ tabId: "intruder", timestamp: Date.now() }),
    );

    vi.advanceTimersByTime(1000); // trigger heartbeat
    expect(detector.isBlocked()).toBe(true);
    detector.stop();
  });
});
