import { describe, it, expect } from "vitest";
import { parabolaPath, parabolaLength, Point2D } from "@core/pathfinding/ParabolaPath";

describe("parabolaPath", () => {
  it("starts and ends at the given points", () => {
    const start: Point2D = { x: 0, y: 0 };
    const end: Point2D = { x: 100, y: 0 };
    const points = parabolaPath(start, end);

    expect(points[0].x).toBeCloseTo(0);
    expect(points[0].y).toBeCloseTo(0);
    expect(points[points.length - 1].x).toBeCloseTo(100);
    expect(points[points.length - 1].y).toBeCloseTo(0);
  });

  it("produces an arc that bulges away from the line", () => {
    const start: Point2D = { x: 0, y: 0 };
    const end: Point2D = { x: 100, y: 0 };
    const points = parabolaPath(start, end, { height: 0.5, direction: 1 });

    // midpoint should be above (negative y since perpendicular goes up for horizontal line going right)
    const mid = points[Math.floor(points.length / 2)];
    expect(mid.x).toBeCloseTo(50, 0);
    // The arc should deviate from the straight line
    expect(Math.abs(mid.y)).toBeGreaterThan(10);
  });

  it("direction -1 bulges the opposite way", () => {
    const start: Point2D = { x: 0, y: 0 };
    const end: Point2D = { x: 100, y: 0 };
    const pointsUp = parabolaPath(start, end, { direction: 1 });
    const pointsDown = parabolaPath(start, end, { direction: -1 });

    const midUp = pointsUp[Math.floor(pointsUp.length / 2)];
    const midDown = pointsDown[Math.floor(pointsDown.length / 2)];

    // They should be on opposite sides
    expect(midUp.y * midDown.y).toBeLessThan(0);
  });

  it("height factor affects arc magnitude", () => {
    const start: Point2D = { x: 0, y: 0 };
    const end: Point2D = { x: 100, y: 0 };
    const small = parabolaPath(start, end, { height: 0.1 });
    const large = parabolaPath(start, end, { height: 1.0 });

    const midSmall = small[Math.floor(small.length / 2)];
    const midLarge = large[Math.floor(large.length / 2)];

    expect(Math.abs(midLarge.y)).toBeGreaterThan(Math.abs(midSmall.y));
  });

  it("is deterministic", () => {
    const start: Point2D = { x: 10, y: 20 };
    const end: Point2D = { x: 80, y: 60 };
    const a = parabolaPath(start, end, { height: 0.3, steps: 10 });
    const b = parabolaPath(start, end, { height: 0.3, steps: 10 });

    expect(a).toEqual(b);
  });

  it("respects steps parameter", () => {
    const start: Point2D = { x: 0, y: 0 };
    const end: Point2D = { x: 100, y: 0 };
    const points = parabolaPath(start, end, { steps: 5 });
    expect(points.length).toBe(6); // steps + 1
  });
});

describe("parabolaLength", () => {
  it("returns 0 for a single point", () => {
    expect(parabolaLength([{ x: 0, y: 0 }])).toBe(0);
  });

  it("returns correct length for straight line", () => {
    const points = [{ x: 0, y: 0 }, { x: 3, y: 4 }];
    expect(parabolaLength(points)).toBeCloseTo(5);
  });

  it("arc length is longer than chord length", () => {
    const start: Point2D = { x: 0, y: 0 };
    const end: Point2D = { x: 100, y: 0 };
    const points = parabolaPath(start, end, { height: 0.5 });
    const arcLen = parabolaLength(points);
    const chordLen = 100;
    expect(arcLen).toBeGreaterThan(chordLen);
  });
});
