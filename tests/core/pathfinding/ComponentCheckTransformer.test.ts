import { describe, it, expect } from "vitest";
import { ComponentCheckTransformer } from "@core/pathfinding/ComponentCheckTransformer";
import { UnionFind } from "@core/pathfinding/UnionFind";

describe("ComponentCheckTransformer", () => {
  it("returns null (proceed) when nodes are in the same component", () => {
    const uf = new UnionFind(10);
    uf.union(0, 1);
    uf.union(1, 2);
    const checker = new ComponentCheckTransformer(uf);
    expect(checker.preCheck(0, 2)).toBeNull();
  });

  it("returns noPath when nodes are in different components", () => {
    const uf = new UnionFind(10);
    uf.union(0, 1);
    uf.union(3, 4);
    const checker = new ComponentCheckTransformer(uf);
    const result = checker.preCheck(0, 4);
    expect(result).not.toBeNull();
    expect(result!.found).toBe(false);
    expect(result!.path).toEqual([]);
  });

  it("has name ComponentCheck", () => {
    const uf = new UnionFind(5);
    const checker = new ComponentCheckTransformer(uf);
    expect(checker.name).toBe("ComponentCheck");
  });

  it("reflects UnionFind changes dynamically", () => {
    const uf = new UnionFind(5);
    const checker = new ComponentCheckTransformer(uf);

    expect(checker.preCheck(0, 1)).not.toBeNull(); // different components
    uf.union(0, 1);
    expect(checker.preCheck(0, 1)).toBeNull(); // now same component
  });

  it("same node always passes", () => {
    const uf = new UnionFind(5);
    const checker = new ComponentCheckTransformer(uf);
    expect(checker.preCheck(3, 3)).toBeNull();
  });
});
