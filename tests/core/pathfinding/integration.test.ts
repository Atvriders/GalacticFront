import { describe, it, expect } from "vitest";
import { HyperlanePathfinder } from "@core/pathfinding/HyperlanePathfinder";
import { HyperlaneAdapter, StarMap } from "@core/pathfinding/HyperlaneAdapter";
import { aStar } from "@core/pathfinding/AStar";
import { UnionFind } from "@core/pathfinding/UnionFind";
import { ComponentCheckTransformer } from "@core/pathfinding/ComponentCheckTransformer";
import { PathFinderBuilder } from "@core/pathfinding/PathFinderBuilder";
import { PathFinderStepper } from "@core/pathfinding/PathFinderStepper";
import { StationPathfinder } from "@core/pathfinding/StationPathfinder";
import { StationNetwork } from "@core/pathfinding/StationAdapter";
import { parabolaPath, parabolaLength } from "@core/pathfinding/ParabolaPath";
import { intraSystemBFS, intraSystemDistances, SystemLayout } from "@core/pathfinding/IntraSystemBFS";
import { noPath } from "@core/pathfinding/PathResult";

/**
 * 20-system mock galaxy with 2 clusters connected by wormholes.
 *
 * Cluster A (systems 0-9):
 *   0--1--2--3--4
 *   |        |
 *   5--6--7  9
 *        |
 *        8
 *
 * Cluster B (systems 10-19):
 *   10--11--12--13--14
 *    |           |
 *   15--16--17  18
 *         |
 *        19
 *
 * Wormhole: 4 <-> 10 (connects clusters when wormhole generator active)
 */

function buildCSR(
  systemCount: number,
  edges: [number, number][]
): { adjOffset: Uint32Array; adjList: Uint32Array } {
  const degree = new Uint32Array(systemCount);
  for (const [a, b] of edges) {
    degree[a]++;
    degree[b]++;
  }
  const adjOffset = new Uint32Array(systemCount + 1);
  for (let i = 0; i < systemCount; i++) adjOffset[i + 1] = adjOffset[i] + degree[i];
  const adjList = new Uint32Array(adjOffset[systemCount]);
  const cursor = new Uint32Array(systemCount);
  for (let i = 0; i < systemCount; i++) cursor[i] = adjOffset[i];
  for (const [a, b] of edges) {
    adjList[cursor[a]++] = b;
    adjList[cursor[b]++] = a;
  }
  return { adjOffset, adjList };
}

function makeGalaxy(includeWormhole: boolean): {
  map: StarMap;
  hyperlaneEdges: [number, number][];
  wormholeEdges: [number, number][];
} {
  const systemCount = 20;
  const systemX = new Float32Array([
    0, 10, 20, 30, 40,   // cluster A: 0-4
    0, 10, 20, 20, 30,   // cluster A: 5-9
    100, 110, 120, 130, 140,  // cluster B: 10-14
    100, 110, 120, 130, 110,  // cluster B: 15-19
  ]);
  const systemY = new Float32Array([
    0, 0, 0, 0, 0,
    10, 10, 10, 20, 10,
    0, 0, 0, 0, 0,
    10, 10, 10, 10, 20,
  ]);

  const hyperlaneEdges: [number, number][] = [
    // Cluster A
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8], [3, 9],
    // Cluster B
    [10, 11], [11, 12], [12, 13], [13, 14],
    [10, 15], [15, 16], [16, 17], [13, 18], [16, 19],
  ];

  const wormholeEdges: [number, number][] = includeWormhole ? [[4, 10]] : [];

  const allEdges = [...hyperlaneEdges, ...wormholeEdges];
  const { adjOffset, adjList } = buildCSR(systemCount, allEdges);

  return {
    map: { systemCount, systemX, systemY, adjOffset, adjList },
    hyperlaneEdges,
    wormholeEdges,
  };
}

describe("Pathfinding Integration", () => {
  it("finds hyperlane path within cluster A", () => {
    const { map } = makeGalaxy(false);
    const pf = new HyperlanePathfinder(map);
    const result = pf.findPath(0, 4);
    expect(result.found).toBe(true);
    expect(result.path[0]).toBe(0);
    expect(result.path[result.path.length - 1]).toBe(4);
    expect(result.path).toEqual([0, 1, 2, 3, 4]);
  });

  it("no path across clusters without wormhole", () => {
    const { map } = makeGalaxy(false);
    const pf = new HyperlanePathfinder(map);
    const result = pf.findPath(0, 14);
    expect(result.found).toBe(false);
  });

  it("ComponentCheck + UnionFind rejects cross-cluster path", () => {
    const { map, hyperlaneEdges } = makeGalaxy(false);
    const uf = new UnionFind(map.systemCount);
    uf.rebuild(hyperlaneEdges);
    const checker = new ComponentCheckTransformer(uf);

    // Same cluster: passes
    expect(checker.preCheck(0, 4)).toBeNull();
    // Cross cluster: blocked
    expect(checker.preCheck(0, 14)?.found).toBe(false);
  });

  it("wormhole connects clusters via UnionFind", () => {
    const { map, hyperlaneEdges, wormholeEdges } = makeGalaxy(true);
    const uf = new UnionFind(map.systemCount);
    uf.rebuild([...hyperlaneEdges, ...wormholeEdges]);

    expect(uf.connected(0, 14)).toBe(true);
    expect(uf.connected(8, 19)).toBe(true);
  });

  it("finds path across clusters with wormhole", () => {
    const { map } = makeGalaxy(true);
    const pf = new HyperlanePathfinder(map);
    const result = pf.findPath(0, 14);
    expect(result.found).toBe(true);
    expect(result.path).toContain(4);  // must go through wormhole entry
    expect(result.path).toContain(10); // must go through wormhole exit
  });

  it("blocked system causes rerouting", () => {
    // Build galaxy with system 2 effectively blocked (no edges to/from it)
    const systemCount = 20;
    const { map: fullMap } = makeGalaxy(false);
    // Rebuild without edges involving system 2
    const edges: [number, number][] = [
      [0, 1], [1, 3], [3, 4], // skip 2, add direct 1-3
      [0, 5], [5, 6], [6, 7], [7, 8], [3, 9],
      [10, 11], [11, 12], [12, 13], [13, 14],
      [10, 15], [15, 16], [16, 17], [13, 18], [16, 19],
    ];
    const { adjOffset, adjList } = buildCSR(systemCount, edges);
    const map: StarMap = {
      systemCount,
      systemX: fullMap.systemX,
      systemY: fullMap.systemY,
      adjOffset,
      adjList,
    };

    const pf = new HyperlanePathfinder(map);
    const result = pf.findPath(0, 4);
    expect(result.found).toBe(true);
    expect(result.path).not.toContain(2); // system 2 bypassed
    expect(result.path).toContain(3); // still goes through 3
  });

  it("PathFinderStepper walks full route", () => {
    const { map } = makeGalaxy(false);
    const pf = new HyperlanePathfinder(map);
    const stepper = new PathFinderStepper((from, to) => pf.findPath(from, to));

    stepper.plan(0, 4);
    const walked: number[] = [stepper.currentNode];
    while (!stepper.arrived) {
      walked.push(stepper.step());
    }
    expect(walked).toEqual([0, 1, 2, 3, 4]);
  });

  it("StationPathfinder routes on sub-network", () => {
    // Build a small station network within cluster A systems
    const net: StationNetwork = {
      stationCount: 5,
      stationX: new Float32Array([0, 10, 20, 30, 40]),
      stationY: new Float32Array([0, 0, 0, 0, 0]),
      stationNeighbors(station: number, out: Uint32Array): number {
        const adj: number[][] = [[1], [0, 2], [1, 3], [2, 4], [3]];
        const nb = adj[station];
        for (let i = 0; i < nb.length; i++) out[i] = nb[i];
        return nb.length;
      },
    };
    const spf = new StationPathfinder(net);
    const result = spf.findPath(0, 4);
    expect(result.found).toBe(true);
    expect(result.path).toEqual([0, 1, 2, 3, 4]);
  });

  it("ParabolaPath generates valid trajectory", () => {
    const points = parabolaPath(
      { x: 0, y: 0 },
      { x: 100, y: 50 },
      { height: 0.4, steps: 30 }
    );
    expect(points.length).toBe(31);
    expect(points[0].x).toBeCloseTo(0);
    expect(points[0].y).toBeCloseTo(0);
    expect(points[30].x).toBeCloseTo(100);
    expect(points[30].y).toBeCloseTo(50);

    const len = parabolaLength(points);
    const chord = Math.sqrt(100 * 100 + 50 * 50);
    expect(len).toBeGreaterThan(chord);
  });

  it("IntraSystemBFS finds path in mock system", () => {
    const layout: SystemLayout = {
      objectCount: 4,
      neighbors(obj: number, out: Uint32Array): number {
        const adj: number[][] = [[1], [0, 2], [1, 3], [2]];
        const nb = adj[obj];
        for (let i = 0; i < nb.length; i++) out[i] = nb[i];
        return nb.length;
      },
    };
    const result = intraSystemBFS(layout, 0, 3);
    expect(result.found).toBe(true);
    expect(result.path).toEqual([0, 1, 2, 3]);
    expect(result.distance).toBe(3);

    const dist = intraSystemDistances(layout, 0);
    expect(dist[0]).toBe(0);
    expect(dist[3]).toBe(3);
  });

  it("wormhole generator destroy disconnects components", () => {
    const { hyperlaneEdges } = makeGalaxy(true);
    const uf = new UnionFind(20);

    // With wormhole 4<->10
    uf.rebuild([...hyperlaneEdges, [4, 10]]);
    expect(uf.connected(0, 14)).toBe(true);

    // Destroy wormhole generator: rebuild without wormhole
    uf.rebuild(hyperlaneEdges);
    expect(uf.connected(0, 14)).toBe(false);
    // Intra-cluster still connected
    expect(uf.connected(0, 8)).toBe(true);
    expect(uf.connected(10, 19)).toBe(true);
  });

  it("PathFinderBuilder with ComponentCheck blocks cross-cluster", () => {
    const { map, hyperlaneEdges } = makeGalaxy(false);
    const pf = new HyperlanePathfinder(map);
    const uf = new UnionFind(map.systemCount);
    uf.rebuild(hyperlaneEdges);

    const builder = new PathFinderBuilder((from, to) => pf.findPath(from, to));
    builder.addTransformer(new ComponentCheckTransformer(uf));
    const fn = builder.build();

    expect(fn(0, 4).found).toBe(true);
    expect(fn(0, 14).found).toBe(false); // blocked by ComponentCheck
  });
});
