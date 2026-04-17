import { describe, it, expect, beforeEach } from "vitest";
import {
  formatBigInt,
  clamp,
  dist,
  manhattanDist,
  toIndex,
  fromIndex,
  lerp,
  uniqueId,
  deepFreeze,
} from "@core/Util";

describe("formatBigInt", () => {
  it("formats values below 1K as plain integers", () => {
    expect(formatBigInt(0n)).toBe("0");
    expect(formatBigInt(1n)).toBe("1");
    expect(formatBigInt(999n)).toBe("999");
  });

  it("formats K (thousands)", () => {
    expect(formatBigInt(1000n)).toBe("1K");
    expect(formatBigInt(1500n)).toBe("1.5K");
    expect(formatBigInt(2300n)).toBe("2.3K");
    expect(formatBigInt(999999n)).toBe("999.9K");
  });

  it("formats M (millions)", () => {
    expect(formatBigInt(1_000_000n)).toBe("1M");
    expect(formatBigInt(2_300_000n)).toBe("2.3M");
    expect(formatBigInt(10_000_000n)).toBe("10M");
  });

  it("formats B (billions)", () => {
    expect(formatBigInt(1_000_000_000n)).toBe("1B");
    expect(formatBigInt(1_500_000_000n)).toBe("1.5B");
  });

  it("formats T (trillions)", () => {
    expect(formatBigInt(1_000_000_000_000n)).toBe("1T");
    expect(formatBigInt(1_000_000_000_000n)).toBe("1T");
  });

  it("formats Qa (quadrillions)", () => {
    expect(formatBigInt(1_000_000_000_000_000n)).toBe("1Qa");
    expect(formatBigInt(1_500_000_000_000_000n)).toBe("1.5Qa");
  });

  it("formats Qi (quintillions)", () => {
    expect(formatBigInt(1_000_000_000_000_000_000n)).toBe("1Qi");
    expect(formatBigInt(2_500_000_000_000_000_000n)).toBe("2.5Qi");
  });

  it("formats Sx (sextillions)", () => {
    expect(formatBigInt(1_000_000_000_000_000_000_000n)).toBe("1Sx");
  });

  it("formats Sp (septillions)", () => {
    expect(formatBigInt(1_000_000_000_000_000_000_000_000n)).toBe("1Sp");
  });

  it("formats Oc (octillions)", () => {
    expect(formatBigInt(1_000_000_000_000_000_000_000_000_000n)).toBe("1Oc");
  });

  it("handles negative values", () => {
    expect(formatBigInt(-999n)).toBe("-999");
    expect(formatBigInt(-1500n)).toBe("-1.5K");
    expect(formatBigInt(-2_300_000n)).toBe("-2.3M");
  });

  it("omits decimal when remainder is 0", () => {
    expect(formatBigInt(5_000n)).toBe("5K");
    expect(formatBigInt(10_000_000n)).toBe("10M");
  });
});

describe("clamp", () => {
  it("returns value when within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it("clamps to min when value is below range", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(-1000, -100, 100)).toBe(-100);
  });

  it("clamps to max when value is above range", () => {
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(1000, -100, 100)).toBe(100);
  });

  it("handles min === max", () => {
    expect(clamp(5, 7, 7)).toBe(7);
    expect(clamp(7, 7, 7)).toBe(7);
    expect(clamp(9, 7, 7)).toBe(7);
  });
});

describe("dist", () => {
  it("returns 0 for same point", () => {
    expect(dist(3, 4, 3, 4)).toBe(0);
  });

  it("computes Euclidean distance (3-4-5 triangle)", () => {
    expect(dist(0, 0, 3, 4)).toBe(5);
  });

  it("is symmetric", () => {
    expect(dist(1, 2, 5, 8)).toBeCloseTo(dist(5, 8, 1, 2));
  });

  it("handles negative coordinates", () => {
    expect(dist(-3, -4, 0, 0)).toBe(5);
  });
});

describe("manhattanDist", () => {
  it("returns 0 for same point", () => {
    expect(manhattanDist(5, 5, 5, 5)).toBe(0);
  });

  it("computes Manhattan distance", () => {
    expect(manhattanDist(0, 0, 3, 4)).toBe(7);
    expect(manhattanDist(1, 1, 4, 5)).toBe(7);
  });

  it("is symmetric", () => {
    expect(manhattanDist(2, 3, 7, 8)).toBe(manhattanDist(7, 8, 2, 3));
  });

  it("handles negative coordinates", () => {
    expect(manhattanDist(-3, -4, 0, 0)).toBe(7);
  });
});

describe("toIndex / fromIndex", () => {
  it("toIndex converts 2D coordinates to 1D index", () => {
    expect(toIndex(0, 0, 10)).toBe(0);
    expect(toIndex(1, 0, 10)).toBe(1);
    expect(toIndex(0, 1, 10)).toBe(10);
    expect(toIndex(3, 2, 10)).toBe(23);
  });

  it("fromIndex converts 1D index to 2D coordinates", () => {
    expect(fromIndex(0, 10)).toEqual({ x: 0, y: 0 });
    expect(fromIndex(1, 10)).toEqual({ x: 1, y: 0 });
    expect(fromIndex(10, 10)).toEqual({ x: 0, y: 1 });
    expect(fromIndex(23, 10)).toEqual({ x: 3, y: 2 });
  });

  it("round-trips toIndex → fromIndex", () => {
    const width = 7;
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < width; x++) {
        const idx = toIndex(x, y, width);
        expect(fromIndex(idx, width)).toEqual({ x, y });
      }
    }
  });

  it("round-trips fromIndex → toIndex", () => {
    const width = 8;
    for (let i = 0; i < 40; i++) {
      const { x, y } = fromIndex(i, width);
      expect(toIndex(x, y, width)).toBe(i);
    }
  });
});

describe("lerp", () => {
  it("returns a when t=0", () => {
    expect(lerp(10, 20, 0)).toBe(10);
  });

  it("returns b when t=1", () => {
    expect(lerp(10, 20, 1)).toBe(20);
  });

  it("returns midpoint when t=0.5", () => {
    expect(lerp(0, 100, 0.5)).toBe(50);
    expect(lerp(10, 20, 0.5)).toBe(15);
  });

  it("works with negative values", () => {
    expect(lerp(-10, 10, 0.5)).toBe(0);
  });
});

describe("uniqueId", () => {
  it("returns a string", () => {
    expect(typeof uniqueId()).toBe("string");
  });

  it("returns unique values on successive calls", () => {
    const a = uniqueId();
    const b = uniqueId();
    expect(a).not.toBe(b);
  });

  it("includes prefix when provided", () => {
    const id = uniqueId("item-");
    expect(id.startsWith("item-")).toBe(true);
  });

  it("uses empty prefix by default", () => {
    // Just check it produces a non-empty string with no prefix by default
    const id = uniqueId();
    expect(id.length).toBeGreaterThan(0);
  });

  it("ids are monotonically increasing", () => {
    const ids = Array.from({ length: 5 }, () => Number(uniqueId()));
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i]).toBeGreaterThan(ids[i - 1]!);
    }
  });
});

describe("deepFreeze", () => {
  it("freezes a plain object", () => {
    const obj = deepFreeze({ a: 1, b: 2 });
    expect(Object.isFrozen(obj)).toBe(true);
  });

  it("throws in strict mode when mutating a frozen object", () => {
    const obj = deepFreeze({ a: 1 });
    expect(() => {
      // @ts-expect-error intentional write to frozen object
      obj.a = 2;
    }).toThrow();
  });

  it("recursively freezes nested objects", () => {
    const obj = deepFreeze({ outer: { inner: { value: 42 } } });
    expect(Object.isFrozen(obj.outer)).toBe(true);
    expect(Object.isFrozen(obj.outer.inner)).toBe(true);
  });

  it("handles arrays", () => {
    const arr = deepFreeze([1, 2, 3]);
    expect(Object.isFrozen(arr)).toBe(true);
  });

  it("handles null gracefully", () => {
    expect(deepFreeze(null)).toBe(null);
  });

  it("handles primitive values", () => {
    expect(deepFreeze(42 as unknown as object)).toBe(42);
    expect(deepFreeze("hello" as unknown as object)).toBe("hello");
  });

  it("returns the same reference", () => {
    const obj = { x: 1 };
    expect(deepFreeze(obj)).toBe(obj);
  });
});
