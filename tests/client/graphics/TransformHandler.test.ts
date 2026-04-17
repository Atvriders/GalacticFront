import { describe, it, expect } from "vitest";
import { TransformHandler } from "../../../src/client/graphics/TransformHandler.js";

describe("TransformHandler", () => {
  it("worldToCanvas and canvasToWorld are inverses at default zoom/offset", () => {
    const t = new TransformHandler(800, 600);
    const world = { x: 100, y: 200 };
    const canvas = t.worldToCanvas(world.x, world.y);
    const back = t.canvasToWorld(canvas.x, canvas.y);
    expect(back.x).toBeCloseTo(world.x, 5);
    expect(back.y).toBeCloseTo(world.y, 5);
  });

  it("worldToCanvas and canvasToWorld are inverses after zoom and pan", () => {
    const t = new TransformHandler(800, 600);
    t.zoom = 2.5;
    t.offsetX = -100;
    t.offsetY = -50;
    const world = { x: 300, y: 400 };
    const canvas = t.worldToCanvas(world.x, world.y);
    const back = t.canvasToWorld(canvas.x, canvas.y);
    expect(back.x).toBeCloseTo(world.x, 5);
    expect(back.y).toBeCloseTo(world.y, 5);
  });

  it("zoomToPoint keeps the pointed-at world coordinate stable", () => {
    const t = new TransformHandler(800, 600);
    // World point under canvas center before zoom
    const cx = 400;
    const cy = 300;
    const worldBefore = t.canvasToWorld(cx, cy);

    t.zoomToPoint(0.5, cx, cy);

    const worldAfter = t.canvasToWorld(cx, cy);
    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 3);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 3);
  });

  it("zoom is clamped between min and max", () => {
    const t = new TransformHandler(800, 600);
    t.zoomToPoint(100, 400, 300); // extreme zoom in
    expect(t.zoom).toBeLessThanOrEqual(20);
    t.zoomToPoint(-0.999, 400, 300); // extreme zoom out
    expect(t.zoom).toBeGreaterThanOrEqual(0.2);
  });

  it("pan adjusts offset", () => {
    const t = new TransformHandler(800, 600);
    const ox = t.offsetX;
    const oy = t.offsetY;
    t.pan(10, -20);
    expect(t.offsetX).toBe(ox + 10);
    expect(t.offsetY).toBe(oy - 20);
  });

  it("screenToWorld accounts for canvas rect offset", () => {
    const t = new TransformHandler(800, 600);
    const rect = { left: 50, top: 100 } as DOMRect;
    const result = t.screenToWorld(150, 200, rect);
    // canvas coords = (100, 100), zoom=1, offset=0 => world (100,100)
    expect(result.x).toBeCloseTo(100, 5);
    expect(result.y).toBeCloseTo(100, 5);
  });

  it("goTo + update converges toward target", () => {
    const t = new TransformHandler(800, 600);
    t.goTo(500, 500);
    const initialDist = Math.abs(t.offsetX - (400 - 500)) + Math.abs(t.offsetY - (300 - 500));
    for (let i = 0; i < 500; i++) t.update();
    const finalDist = Math.abs(t.offsetX - (400 - 500)) + Math.abs(t.offsetY - (300 - 500));
    expect(finalDist).toBeLessThan(initialDist);
    expect(finalDist).toBeLessThan(1);
  });
});
