import { describe, it, expect } from "vitest";
import { PathFinderBuilder } from "@core/pathfinding/PathFinderBuilder";
import type { PathTransformer } from "@core/pathfinding/PathTransformer";
import type { PathResult } from "@core/pathfinding/PathResult";
import { noPath } from "@core/pathfinding/PathResult";

function makeBaseFn() {
  return (from: number, to: number): PathResult => ({
    path: [from, to],
    cost: 1,
    found: true,
    iterations: 1,
  });
}

function makeBlocker(name: string, blockFrom: number): PathTransformer {
  return {
    name,
    preCheck(from: number, _to: number): PathResult | null {
      if (from === blockFrom) return noPath(0);
      return null;
    },
  };
}

function makePassThrough(name: string): PathTransformer {
  return {
    name,
    preCheck(): PathResult | null {
      return null; // always allow
    },
  };
}

describe("PathFinderBuilder", () => {
  it("builds a path function without transformers", () => {
    const builder = new PathFinderBuilder(makeBaseFn());
    const fn = builder.build();
    const result = fn(0, 5);
    expect(result.found).toBe(true);
    expect(result.path).toEqual([0, 5]);
  });

  it("transformer can block pathfinding", () => {
    const builder = new PathFinderBuilder(makeBaseFn());
    builder.addTransformer(makeBlocker("blocker", 3));
    const fn = builder.build();

    expect(fn(3, 5).found).toBe(false); // blocked
    expect(fn(0, 5).found).toBe(true);  // not blocked
  });

  it("first blocker wins", () => {
    let calledSecond = false;
    const second: PathTransformer = {
      name: "second",
      preCheck(): PathResult | null {
        calledSecond = true;
        return noPath(0);
      },
    };

    const builder = new PathFinderBuilder(makeBaseFn());
    builder.addTransformer(makeBlocker("first", 0));
    builder.addTransformer(second);
    const fn = builder.build();

    const result = fn(0, 5);
    expect(result.found).toBe(false);
    expect(calledSecond).toBe(false); // second not called because first blocked
  });

  it("remove transformer by name", () => {
    const builder = new PathFinderBuilder(makeBaseFn());
    builder.addTransformer(makeBlocker("blocker", 0));
    expect(builder.transformerNames).toContain("blocker");

    builder.removeTransformer("blocker");
    expect(builder.transformerNames).not.toContain("blocker");

    const fn = builder.build();
    expect(fn(0, 5).found).toBe(true); // no longer blocked
  });

  it("compose multiple transformers", () => {
    const builder = new PathFinderBuilder(makeBaseFn());
    builder
      .addTransformer(makePassThrough("check1"))
      .addTransformer(makePassThrough("check2"))
      .addTransformer(makeBlocker("embargo", 7));

    const fn = builder.build();
    expect(fn(0, 5).found).toBe(true);
    expect(fn(7, 5).found).toBe(false);
  });

  it("fluent API returns builder for chaining", () => {
    const builder = new PathFinderBuilder(makeBaseFn());
    const result = builder
      .addTransformer(makePassThrough("a"))
      .addTransformer(makePassThrough("b"))
      .removeTransformer("a");
    expect(result).toBe(builder);
    expect(builder.transformerNames).toEqual(["b"]);
  });

  it("built function uses snapshot of transformers", () => {
    const builder = new PathFinderBuilder(makeBaseFn());
    builder.addTransformer(makeBlocker("blocker", 0));
    const fn = builder.build();

    // Add more transformers after build - should not affect fn
    builder.removeTransformer("blocker");

    expect(fn(0, 5).found).toBe(false); // still blocked in the built fn
  });
});
