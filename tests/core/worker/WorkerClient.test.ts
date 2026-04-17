import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WorkerClient } from "@core/worker/WorkerClient";
import type { GameConfig } from "@core/Schemas";

function makeConfig(): GameConfig {
  return {
    gameID: "test-game" as any,
    mapWidth: 10,
    mapHeight: 10,
    maxPlayers: 4,
    seed: "test-seed",
    ticksPerTurn: 2,
    turnIntervalMs: 100,
    gameMapType: "Standard",
    difficulty: "Medium",
  };
}

class MockWorker {
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  private listeners: Map<string, Function[]> = new Map();
  posted: unknown[] = [];
  terminated = false;

  postMessage(data: unknown) {
    this.posted.push(data);
  }

  addEventListener(type: string, handler: Function) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type)!.push(handler);
  }

  removeEventListener(type: string, handler: Function) {
    const handlers = this.listeners.get(type);
    if (handlers) {
      const idx = handlers.indexOf(handler);
      if (idx >= 0) handlers.splice(idx, 1);
    }
  }

  terminate() {
    this.terminated = true;
  }

  // Test helper: emit a message event
  emit(data: unknown) {
    // Fire addEventListener handlers
    const handlers = this.listeners.get("message") || [];
    for (const h of handlers) {
      h({ data });
    }
    // Fire onmessage
    this.onmessage?.({ data });
  }
}

describe("WorkerClient", () => {
  let client: WorkerClient;
  let mockWorker: MockWorker;

  beforeEach(() => {
    vi.useFakeTimers();
    client = new WorkerClient();
    mockWorker = new MockWorker();
  });

  afterEach(() => {
    client.terminate();
    vi.useRealTimers();
  });

  it("should init and resolve on worker_ready", async () => {
    const config = makeConfig();
    const initPromise = client.init(config, {}, () => mockWorker as any);

    expect(mockWorker.posted).toHaveLength(1);
    expect((mockWorker.posted[0] as any).type).toBe("init");

    // Simulate worker_ready
    mockWorker.emit({ type: "worker_ready" });

    await initPromise;
    expect(client.ready).toBe(true);
  });

  it("should reject on init timeout", async () => {
    const config = makeConfig();
    const initPromise = client.init(config, {}, () => mockWorker as any);

    vi.advanceTimersByTime(20_000);

    await expect(initPromise).rejects.toThrow("Worker init timed out");
  });

  it("should reject on worker_error during init", async () => {
    const config = makeConfig();
    const initPromise = client.init(config, {}, () => mockWorker as any);

    mockWorker.emit({ type: "worker_error", error: "bad config" });

    await expect(initPromise).rejects.toThrow("bad config");
  });

  it("should route game_update messages to callback", async () => {
    const onGameUpdate = vi.fn();
    const config = makeConfig();
    const initPromise = client.init(
      config,
      { onGameUpdate },
      () => mockWorker as any,
    );

    mockWorker.emit({ type: "worker_ready" });
    await initPromise;

    const update = {
      type: "game_update",
      turn: 1,
      updates: [],
      tileChanges: [],
    };
    mockWorker.emit(update);

    expect(onGameUpdate).toHaveBeenCalledWith(update);
  });

  it("should send turn via postMessage", async () => {
    const config = makeConfig();
    const initPromise = client.init(config, {}, () => mockWorker as any);
    mockWorker.emit({ type: "worker_ready" });
    await initPromise;

    client.sendTurn(1, []);

    expect(mockWorker.posted).toHaveLength(2); // init + turn
    expect((mockWorker.posted[1] as any).type).toBe("turn");
    expect((mockWorker.posted[1] as any).turn).toBe(1);
  });

  it("should not send turn before ready", () => {
    client.sendTurn(1, []);
    // No worker created, should not throw
    expect(client.ready).toBe(false);
  });

  it("should terminate worker", async () => {
    const config = makeConfig();
    const initPromise = client.init(config, {}, () => mockWorker as any);
    mockWorker.emit({ type: "worker_ready" });
    await initPromise;

    client.terminate();
    expect(mockWorker.terminated).toBe(true);
    expect(client.ready).toBe(false);
  });
});
