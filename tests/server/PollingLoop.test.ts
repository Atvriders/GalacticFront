import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PollingLoop } from "../../src/server/PollingLoop.js";

describe("PollingLoop", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls the function on each interval", async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const loop = new PollingLoop(fn, 100);

    loop.start();

    await vi.advanceTimersByTimeAsync(100);
    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(100);
    expect(fn).toHaveBeenCalledTimes(2);

    loop.stop();
  });

  it("does not call before interval elapses", async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const loop = new PollingLoop(fn, 200);

    loop.start();

    await vi.advanceTimersByTimeAsync(50);
    expect(fn).toHaveBeenCalledTimes(0);

    loop.stop();
  });

  it("stop prevents further calls", async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const loop = new PollingLoop(fn, 100);

    loop.start();
    await vi.advanceTimersByTimeAsync(100);
    expect(fn).toHaveBeenCalledTimes(1);

    loop.stop();

    await vi.advanceTimersByTimeAsync(300);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("start is idempotent", async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const loop = new PollingLoop(fn, 100);

    loop.start();
    loop.start(); // should be no-op

    await vi.advanceTimersByTimeAsync(100);
    expect(fn).toHaveBeenCalledTimes(1);

    loop.stop();
  });

  it("survives errors in the callback", async () => {
    let callCount = 0;
    const fn = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) throw new Error("boom");
    });

    const loop = new PollingLoop(fn, 100);
    loop.start();

    await vi.advanceTimersByTimeAsync(100);
    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(100);
    expect(fn).toHaveBeenCalledTimes(2);

    loop.stop();
  });

  it("guarantees sequential execution", async () => {
    const order: number[] = [];
    let callNum = 0;

    const fn = vi.fn().mockImplementation(async () => {
      const num = ++callNum;
      order.push(num);
      // Simulate async work that takes longer than interval
      await new Promise((r) => setTimeout(r, 50));
      order.push(-num); // negative marks completion
    });

    const loop = new PollingLoop(fn, 10);
    loop.start();

    // Advance enough for multiple potential calls
    await vi.advanceTimersByTimeAsync(200);

    loop.stop();

    // Verify sequential: each start must be followed by its completion before next start
    for (let i = 0; i < order.length - 1; i += 2) {
      expect(order[i]).toBeGreaterThan(0); // start
      expect(order[i + 1]).toBe(-order[i]); // matching completion
    }
  });
});
