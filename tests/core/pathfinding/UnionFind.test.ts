import { describe, it, expect } from "vitest";
import { UnionFind } from "@core/pathfinding/UnionFind";

describe("UnionFind", () => {
  it("initially all nodes are disconnected", () => {
    const uf = new UnionFind(5);
    expect(uf.connected(0, 1)).toBe(false);
    expect(uf.connected(2, 4)).toBe(false);
  });

  it("union connects nodes", () => {
    const uf = new UnionFind(5);
    uf.union(0, 1);
    expect(uf.connected(0, 1)).toBe(true);
    expect(uf.connected(0, 2)).toBe(false);
  });

  it("supports transitive connectivity", () => {
    const uf = new UnionFind(5);
    uf.union(0, 1);
    uf.union(1, 2);
    expect(uf.connected(0, 2)).toBe(true);
    // chain: 0-1-2 all connected
    uf.union(3, 4);
    expect(uf.connected(0, 3)).toBe(false);
    uf.union(2, 3);
    expect(uf.connected(0, 4)).toBe(true);
  });

  it("componentId returns same root for connected nodes", () => {
    const uf = new UnionFind(6);
    uf.union(0, 1);
    uf.union(1, 2);
    const comp = uf.componentId(0);
    expect(uf.componentId(1)).toBe(comp);
    expect(uf.componentId(2)).toBe(comp);
    expect(uf.componentId(3)).not.toBe(comp);
  });

  it("rebuild resets and reconstructs from pairs", () => {
    const uf = new UnionFind(6);
    uf.union(0, 1);
    uf.union(2, 3);
    expect(uf.connected(0, 1)).toBe(true);

    // Simulate generator destroy: rebuild without 0-1 link
    uf.rebuild([[2, 3], [4, 5]]);
    expect(uf.connected(0, 1)).toBe(false);
    expect(uf.connected(2, 3)).toBe(true);
    expect(uf.connected(4, 5)).toBe(true);
    expect(uf.connected(2, 4)).toBe(false);
  });

  it("rebuild then add simulates generator build", () => {
    const uf = new UnionFind(6);
    uf.rebuild([[0, 1]]);
    expect(uf.connected(0, 1)).toBe(true);
    // Build new wormhole generator linking 1-2
    uf.union(1, 2);
    expect(uf.connected(0, 2)).toBe(true);
  });

  it("self-union is a no-op", () => {
    const uf = new UnionFind(3);
    uf.union(1, 1);
    expect(uf.connected(1, 1)).toBe(true);
    // Other nodes still disconnected
    expect(uf.connected(0, 1)).toBe(false);
  });

  it("handles large component", () => {
    const uf = new UnionFind(1000);
    for (let i = 0; i < 999; i++) {
      uf.union(i, i + 1);
    }
    expect(uf.connected(0, 999)).toBe(true);
  });
});
