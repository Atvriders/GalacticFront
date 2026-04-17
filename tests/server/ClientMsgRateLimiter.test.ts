import { describe, it, expect, beforeEach } from "vitest";
import { ClientMsgRateLimiter } from "../../src/server/ClientMsgRateLimiter.js";

describe("ClientMsgRateLimiter", () => {
  let limiter: ClientMsgRateLimiter;

  beforeEach(() => {
    limiter = new ClientMsgRateLimiter();
  });

  it("allows messages under all limits", () => {
    expect(limiter.allow("hello")).toBe(true);
  });

  it("rejects messages over 500 bytes", () => {
    const big = "x".repeat(501);
    expect(limiter.allow(big)).toBe(false);
  });

  it("allows messages exactly 500 bytes", () => {
    const exact = "x".repeat(500);
    expect(limiter.allow(exact)).toBe(true);
  });

  it("enforces 10/s rate limit", () => {
    const now = Date.now();
    for (let i = 0; i < 10; i++) {
      expect(limiter.allow("msg", now)).toBe(true);
    }
    expect(limiter.allow("msg", now)).toBe(false);
  });

  it("allows again after 1 second window passes", () => {
    const now = 1000000;
    for (let i = 0; i < 10; i++) {
      limiter.allow("msg", now);
    }
    expect(limiter.allow("msg", now)).toBe(false);
    expect(limiter.allow("msg", now + 1001)).toBe(true);
  });

  it("enforces 150/min rate limit", () => {
    const baseTime = 1000000;
    // Send 150 messages spread over the minute (15 per second-window)
    for (let i = 0; i < 150; i++) {
      // Space them 400ms apart to avoid per-second limit
      const t = baseTime + i * 400;
      expect(limiter.allow("m", t)).toBe(true);
    }
    // Next message within same minute should be rejected
    const lastTime = baseTime + 149 * 400;
    expect(limiter.allow("m", lastTime + 1)).toBe(false);
  });

  it("enforces 2MB total bytes cap", () => {
    const msg = "x".repeat(500);
    const count = Math.floor((2 * 1024 * 1024) / 500);
    for (let i = 0; i < count; i++) {
      // Space out to avoid per-second/minute limits
      limiter.allow(msg, i * 1000);
    }
    expect(limiter.allow(msg, count * 1000)).toBe(false);
  });

  it("tracks total bytes", () => {
    limiter.allow("hello");
    expect(limiter.getTotalBytes()).toBe(5);
    limiter.allow("world");
    expect(limiter.getTotalBytes()).toBe(10);
  });

  it("reset clears all state", () => {
    const now = Date.now();
    for (let i = 0; i < 10; i++) {
      limiter.allow("msg", now);
    }
    expect(limiter.allow("msg", now)).toBe(false);
    limiter.reset();
    expect(limiter.allow("msg", now)).toBe(true);
    expect(limiter.getTotalBytes()).toBe(3); // just the one "msg" after reset
  });

  it("handles multi-byte UTF-8 correctly", () => {
    // Emoji is 4 bytes in UTF-8; 126 emojis = 504 bytes > 500
    const emoji126 = "😀".repeat(126);
    expect(limiter.allow(emoji126)).toBe(false);
    // 125 emojis = 500 bytes exactly
    const emoji125 = "😀".repeat(125);
    expect(limiter.allow(emoji125)).toBe(true);
  });
});
