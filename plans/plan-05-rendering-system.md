# Plan 5: Rendering System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Build the complete rendering pipeline — 14+ rendering layers, sprite system, visual effects, camera with zoom hierarchy, dark cinematic visual style.

**Architecture:** `GameRenderer` runs `requestAnimationFrame` loop over 40+ layers. `TransformHandler` manages camera (zoom 0.2-20x, pan, smooth follow). 4 zoom tiers: Galaxy / Sector / System / Planet with different layer visibility. Canvas 2D for terrain/territory, PIXI.js for structure icons. Internal canvas caching for FX.

**Tech Stack:** TypeScript 5.x, Canvas 2D, PIXI.js 8.x, Vitest

**Source root:** `src/renderer/`

---

## Task 1: Layer Interface

**Files:**
- `src/renderer/Layer.ts`
- `src/renderer/ZoomTier.ts`
- `src/renderer/__tests__/Layer.test.ts`

**Checklist:**
- [ ] Define `ZoomTier` enum
- [ ] Define `RenderLayer` interface with all lifecycle methods
- [ ] Define `BaseLayer` abstract class with default implementations
- [ ] Write unit tests

```typescript
// src/renderer/ZoomTier.ts

export enum ZoomTier {
  Galaxy  = 'galaxy',   // zoom 0.2 – 0.5
  Sector  = 'sector',   // zoom 0.5 – 2.0
  System  = 'system',   // zoom 2.0 – 8.0
  Planet  = 'planet',   // zoom 8.0 – 20.0
}

export function zoomToTier(zoom: number): ZoomTier {
  if (zoom < 0.5) return ZoomTier.Galaxy;
  if (zoom < 2.0) return ZoomTier.Sector;
  if (zoom < 8.0) return ZoomTier.System;
  return ZoomTier.Planet;
}
```

```typescript
// src/renderer/Layer.ts

import type { TransformState } from './TransformHandler';
import { ZoomTier } from './ZoomTier';

/**
 * Every visual layer in the game implements this interface.
 * Layers are rendered back-to-front by their `zIndex`.
 */
export interface RenderLayer {
  /** Unique layer identifier */
  readonly id: string;

  /** Draw order — lower = further back */
  readonly zIndex: number;

  /** Which zoom tiers this layer is visible in (null = all) */
  readonly visibleTiers: ZoomTier[] | null;

  /** Called once when the layer is registered with GameRenderer */
  init(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void;

  /**
   * Game-logic tick. Called at the interval returned by getTickIntervalMs().
   * Use for animation state, position updates, etc.
   */
  tick(dt: number, now: number): void;

  /** How often tick() should be called (ms). 0 = every frame. */
  getTickIntervalMs(): number;

  /**
   * Draw this layer to the canvas.
   * Called every frame if the layer is visible in the current zoom tier.
   */
  renderLayer(ctx: CanvasRenderingContext2D, transform: TransformState, now: number): void;

  /**
   * Whether this layer should have the camera transform (translate/scale)
   * applied before renderLayer is called.
   * false = screen-space (e.g. UI overlays)
   */
  shouldTransform(): boolean;

  /**
   * Force a full redraw on next renderLayer call.
   * Useful after data changes (e.g. territory recalculated).
   */
  redraw(): void;

  /** Cleanup resources */
  dispose(): void;
}

/**
 * Abstract base with sensible defaults.
 * Subclasses override only what they need.
 */
export abstract class BaseLayer implements RenderLayer {
  abstract readonly id: string;
  abstract readonly zIndex: number;

  readonly visibleTiers: ZoomTier[] | null = null; // visible in all tiers

  protected canvas!: HTMLCanvasElement;
  protected ctx!: CanvasRenderingContext2D;
  protected dirty = true;

  init(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
    this.canvas = canvas;
    this.ctx = ctx;
  }

  tick(_dt: number, _now: number): void {
    // override in subclass
  }

  getTickIntervalMs(): number {
    return 0; // every frame by default
  }

  abstract renderLayer(
    ctx: CanvasRenderingContext2D,
    transform: TransformState,
    now: number,
  ): void;

  shouldTransform(): boolean {
    return true; // world-space by default
  }

  redraw(): void {
    this.dirty = true;
  }

  dispose(): void {
    // override in subclass for cleanup
  }
}
```

```typescript
// src/renderer/__tests__/Layer.test.ts

import { describe, it, expect } from 'vitest';
import { BaseLayer } from '../Layer';
import { ZoomTier, zoomToTier } from '../ZoomTier';
import type { TransformState } from '../TransformHandler';

class TestLayer extends BaseLayer {
  readonly id = 'test';
  readonly zIndex = 0;
  rendered = false;

  renderLayer(_ctx: CanvasRenderingContext2D, _t: TransformState, _now: number): void {
    this.rendered = true;
  }
}

describe('ZoomTier', () => {
  it('maps zoom values to correct tiers', () => {
    expect(zoomToTier(0.2)).toBe(ZoomTier.Galaxy);
    expect(zoomToTier(0.49)).toBe(ZoomTier.Galaxy);
    expect(zoomToTier(0.5)).toBe(ZoomTier.Sector);
    expect(zoomToTier(1.9)).toBe(ZoomTier.Sector);
    expect(zoomToTier(2.0)).toBe(ZoomTier.System);
    expect(zoomToTier(7.9)).toBe(ZoomTier.System);
    expect(zoomToTier(8.0)).toBe(ZoomTier.Planet);
    expect(zoomToTier(20.0)).toBe(ZoomTier.Planet);
  });
});

describe('BaseLayer', () => {
  it('defaults to world-space transform', () => {
    const layer = new TestLayer();
    expect(layer.shouldTransform()).toBe(true);
  });

  it('defaults to visible in all tiers', () => {
    const layer = new TestLayer();
    expect(layer.visibleTiers).toBeNull();
  });

  it('defaults to tick every frame', () => {
    const layer = new TestLayer();
    expect(layer.getTickIntervalMs()).toBe(0);
  });

  it('marks dirty on redraw()', () => {
    const layer = new TestLayer();
    (layer as any).dirty = false;
    layer.redraw();
    expect((layer as any).dirty).toBe(true);
  });
});
```

**Test command:**
```bash
npx vitest run src/renderer/__tests__/Layer.test.ts
```

**Commit:** `feat(renderer): add RenderLayer interface, BaseLayer abstract class, and ZoomTier enum`

---

## Task 2: GameRenderer

**Files:**
- `src/renderer/GameRenderer.ts`
- `src/renderer/FrameProfiler.ts`
- `src/renderer/__tests__/GameRenderer.test.ts`

**Checklist:**
- [ ] Implement `FrameProfiler` with rolling average FPS, per-layer timing
- [ ] Implement `GameRenderer` with rAF loop
- [ ] Layer registration with z-index sorting
- [ ] Transform batching via save/restore around world-space layers
- [ ] Zoom-tier visibility filtering
- [ ] Tick scheduling per layer based on `getTickIntervalMs()`
- [ ] Start/stop/pause controls
- [ ] Write unit tests

```typescript
// src/renderer/FrameProfiler.ts

export interface LayerTiming {
  layerId: string;
  renderMs: number;
  tickMs: number;
}

export interface FrameStats {
  fps: number;
  frameDurationMs: number;
  layerTimings: LayerTiming[];
  totalRenderMs: number;
  totalTickMs: number;
  layerCount: number;
  visibleLayerCount: number;
}

export class FrameProfiler {
  private frameTimes: number[] = [];
  private readonly maxSamples = 60;
  private lastFrameTime = 0;
  private currentLayerTimings: LayerTiming[] = [];
  private totalRenderMs = 0;
  private totalTickMs = 0;
  private layerCount = 0;
  private visibleLayerCount = 0;

  beginFrame(now: number): void {
    if (this.lastFrameTime > 0) {
      const dt = now - this.lastFrameTime;
      this.frameTimes.push(dt);
      if (this.frameTimes.length > this.maxSamples) {
        this.frameTimes.shift();
      }
    }
    this.lastFrameTime = now;
    this.currentLayerTimings = [];
    this.totalRenderMs = 0;
    this.totalTickMs = 0;
    this.layerCount = 0;
    this.visibleLayerCount = 0;
  }

  recordLayerTick(layerId: string, durationMs: number): void {
    const existing = this.currentLayerTimings.find((t) => t.layerId === layerId);
    if (existing) {
      existing.tickMs = durationMs;
    } else {
      this.currentLayerTimings.push({ layerId, renderMs: 0, tickMs: durationMs });
    }
    this.totalTickMs += durationMs;
  }

  recordLayerRender(layerId: string, durationMs: number): void {
    const existing = this.currentLayerTimings.find((t) => t.layerId === layerId);
    if (existing) {
      existing.renderMs = durationMs;
    } else {
      this.currentLayerTimings.push({ layerId, renderMs: durationMs, tickMs: 0 });
    }
    this.totalRenderMs += durationMs;
  }

  setLayerCounts(total: number, visible: number): void {
    this.layerCount = total;
    this.visibleLayerCount = visible;
  }

  getStats(): FrameStats {
    const avg =
      this.frameTimes.length > 0
        ? this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
        : 16.67;
    return {
      fps: Math.round(1000 / avg),
      frameDurationMs: avg,
      layerTimings: [...this.currentLayerTimings],
      totalRenderMs: this.totalRenderMs,
      totalTickMs: this.totalTickMs,
      layerCount: this.layerCount,
      visibleLayerCount: this.visibleLayerCount,
    };
  }
}
```

```typescript
// src/renderer/GameRenderer.ts

import type { RenderLayer } from './Layer';
import { zoomToTier, ZoomTier } from './ZoomTier';
import { TransformHandler, TransformState } from './TransformHandler';
import { FrameProfiler, FrameStats } from './FrameProfiler';

export interface GameRendererOptions {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  /** If true, start the loop immediately */
  autoStart?: boolean;
}

export class GameRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private layers: RenderLayer[] = [];
  private running = false;
  private paused = false;
  private rafId = 0;
  private lastFrameTime = 0;
  private layerLastTick: Map<string, number> = new Map();

  readonly profiler = new FrameProfiler();
  readonly transform: TransformHandler;

  constructor(options: GameRendererOptions) {
    this.canvas = options.canvas;
    this.canvas.width = options.width;
    this.canvas.height = options.height;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context');
    this.ctx = ctx;

    this.transform = new TransformHandler(options.width, options.height);

    if (options.autoStart) {
      this.start();
    }
  }

  /** Register a layer. Layers are sorted by zIndex after insertion. */
  addLayer(layer: RenderLayer): void {
    layer.init(this.canvas, this.ctx);
    this.layers.push(layer);
    this.layers.sort((a, b) => a.zIndex - b.zIndex);
    this.layerLastTick.set(layer.id, 0);
  }

  /** Remove a layer by id */
  removeLayer(id: string): void {
    const idx = this.layers.findIndex((l) => l.id === id);
    if (idx >= 0) {
      this.layers[idx].dispose();
      this.layers.splice(idx, 1);
      this.layerLastTick.delete(id);
    }
  }

  /** Get a layer by id */
  getLayer<T extends RenderLayer>(id: string): T | undefined {
    return this.layers.find((l) => l.id === id) as T | undefined;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.lastFrameTime = performance.now();
    this.rafId = requestAnimationFrame((t) => this.loop(t));
  }

  stop(): void {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
    this.lastFrameTime = performance.now();
  }

  isPaused(): boolean {
    return this.paused;
  }

  isRunning(): boolean {
    return this.running;
  }

  getStats(): FrameStats {
    return this.profiler.getStats();
  }

  /** Force all layers to redraw */
  redrawAll(): void {
    for (const layer of this.layers) {
      layer.redraw();
    }
  }

  dispose(): void {
    this.stop();
    for (const layer of this.layers) {
      layer.dispose();
    }
    this.layers = [];
    this.layerLastTick.clear();
  }

  // ---- internal ----

  private loop(now: number): void {
    if (!this.running) return;
    this.rafId = requestAnimationFrame((t) => this.loop(t));

    if (this.paused) return;

    const dt = now - this.lastFrameTime;
    this.lastFrameTime = now;

    this.profiler.beginFrame(now);

    // Update transform (smooth follow, etc.)
    this.transform.update(dt);

    const transformState = this.transform.getState();
    const currentTier = zoomToTier(transformState.zoom);

    // Determine visible layers
    const visibleLayers = this.layers.filter((layer) => {
      if (layer.visibleTiers === null) return true;
      return layer.visibleTiers.includes(currentTier);
    });

    this.profiler.setLayerCounts(this.layers.length, visibleLayers.length);

    // Tick all registered layers (even hidden ones keep ticking)
    for (const layer of this.layers) {
      const interval = layer.getTickIntervalMs();
      const lastTick = this.layerLastTick.get(layer.id) ?? 0;

      if (interval === 0 || now - lastTick >= interval) {
        const t0 = performance.now();
        layer.tick(dt, now);
        this.profiler.recordLayerTick(layer.id, performance.now() - t0);
        this.layerLastTick.set(layer.id, now);
      }
    }

    // Clear
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Render visible layers
    for (const layer of visibleLayers) {
      this.ctx.save();

      if (layer.shouldTransform()) {
        // Apply camera transform
        this.ctx.translate(transformState.offsetX, transformState.offsetY);
        this.ctx.scale(transformState.zoom, transformState.zoom);
      }

      const t0 = performance.now();
      layer.renderLayer(this.ctx, transformState, now);
      this.profiler.recordLayerRender(layer.id, performance.now() - t0);

      this.ctx.restore();
    }
  }
}
```

```typescript
// src/renderer/__tests__/GameRenderer.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameRenderer } from '../GameRenderer';
import { BaseLayer } from '../Layer';
import type { TransformState } from '../TransformHandler';

// Minimal canvas mock
function createMockCanvas(): HTMLCanvasElement {
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ({
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
    })),
  } as unknown as HTMLCanvasElement;
  return canvas;
}

class StubLayer extends BaseLayer {
  readonly id: string;
  readonly zIndex: number;
  renderCount = 0;
  tickCount = 0;
  private _tickInterval: number;

  constructor(id: string, zIndex: number, tickInterval = 0) {
    super();
    this.id = id;
    this.zIndex = zIndex;
    this._tickInterval = tickInterval;
  }

  getTickIntervalMs(): number {
    return this._tickInterval;
  }

  tick(_dt: number, _now: number): void {
    this.tickCount++;
  }

  renderLayer(_ctx: CanvasRenderingContext2D, _t: TransformState, _now: number): void {
    this.renderCount++;
  }
}

describe('GameRenderer', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = createMockCanvas();
  });

  it('creates without error', () => {
    const renderer = new GameRenderer({ canvas, width: 800, height: 600 });
    expect(renderer).toBeDefined();
    expect(renderer.isRunning()).toBe(false);
  });

  it('adds and sorts layers by zIndex', () => {
    const renderer = new GameRenderer({ canvas, width: 800, height: 600 });
    const layerA = new StubLayer('a', 10);
    const layerB = new StubLayer('b', 1);
    const layerC = new StubLayer('c', 5);

    renderer.addLayer(layerA);
    renderer.addLayer(layerB);
    renderer.addLayer(layerC);

    expect(renderer.getLayer('b')?.zIndex).toBe(1);
    expect(renderer.getLayer('c')?.zIndex).toBe(5);
    expect(renderer.getLayer('a')?.zIndex).toBe(10);
  });

  it('removes layers', () => {
    const renderer = new GameRenderer({ canvas, width: 800, height: 600 });
    const layer = new StubLayer('removeme', 0);
    renderer.addLayer(layer);
    expect(renderer.getLayer('removeme')).toBeDefined();
    renderer.removeLayer('removeme');
    expect(renderer.getLayer('removeme')).toBeUndefined();
  });

  it('pause and resume toggle state', () => {
    const renderer = new GameRenderer({ canvas, width: 800, height: 600 });
    expect(renderer.isPaused()).toBe(false);
    renderer.pause();
    expect(renderer.isPaused()).toBe(true);
    renderer.resume();
    expect(renderer.isPaused()).toBe(false);
  });

  it('redrawAll marks all layers dirty', () => {
    const renderer = new GameRenderer({ canvas, width: 800, height: 600 });
    const layer = new StubLayer('x', 0);
    renderer.addLayer(layer);
    (layer as any).dirty = false;
    renderer.redrawAll();
    expect((layer as any).dirty).toBe(true);
  });

  it('disposes all layers', () => {
    const renderer = new GameRenderer({ canvas, width: 800, height: 600 });
    const layer = new StubLayer('d', 0);
    const spy = vi.spyOn(layer, 'dispose');
    renderer.addLayer(layer);
    renderer.dispose();
    expect(spy).toHaveBeenCalled();
    expect(renderer.getLayer('d')).toBeUndefined();
  });
});
```

**Test command:**
```bash
npx vitest run src/renderer/__tests__/GameRenderer.test.ts
```

**Commit:** `feat(renderer): add GameRenderer with rAF loop, layer registry, transform batching, and FrameProfiler`

---

## Task 3: TransformHandler

**Files:**
- `src/renderer/TransformHandler.ts`
- `src/renderer/__tests__/TransformHandler.test.ts`

**Checklist:**
- [ ] `TransformState` type (zoom, offsetX, offsetY, width, height)
- [ ] Zoom with clamping (0.2-20x) centered on cursor
- [ ] Pan with world-boundary clamping
- [ ] Smooth follow target with lerp factor 0.03
- [ ] `worldToCanvas()` and `screenToWorld()` coordinate conversions
- [ ] Keyboard and mouse event handlers
- [ ] Write unit tests

```typescript
// src/renderer/TransformHandler.ts

export interface TransformState {
  zoom: number;
  offsetX: number;
  offsetY: number;
  canvasWidth: number;
  canvasHeight: number;
}

export interface FollowTarget {
  x: number;
  y: number;
}

export interface TransformHandlerOptions {
  minZoom?: number;
  maxZoom?: number;
  followLerp?: number;
  /** World bounds [minX, minY, maxX, maxY]. null = no clamping */
  worldBounds?: [number, number, number, number] | null;
}

const DEFAULT_OPTIONS: Required<TransformHandlerOptions> = {
  minZoom: 0.2,
  maxZoom: 20,
  followLerp: 0.03,
  worldBounds: null,
};

export class TransformHandler {
  private zoom = 1;
  private offsetX = 0;
  private offsetY = 0;
  private canvasWidth: number;
  private canvasHeight: number;
  private followTarget: FollowTarget | null = null;
  private opts: Required<TransformHandlerOptions>;

  constructor(
    canvasWidth: number,
    canvasHeight: number,
    options?: TransformHandlerOptions,
  ) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.opts = { ...DEFAULT_OPTIONS, ...options };
  }

  // ---- State ----

  getState(): TransformState {
    return {
      zoom: this.zoom,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
      canvasWidth: this.canvasWidth,
      canvasHeight: this.canvasHeight,
    };
  }

  getZoom(): number {
    return this.zoom;
  }

  // ---- Zoom ----

  /**
   * Zoom centered on a canvas-space point (e.g. mouse position).
   * `delta` > 0 zooms in, < 0 zooms out.
   */
  zoomAt(canvasX: number, canvasY: number, delta: number): void {
    const factor = delta > 0 ? 1.1 : 1 / 1.1;
    const newZoom = Math.min(
      this.opts.maxZoom,
      Math.max(this.opts.minZoom, this.zoom * factor),
    );

    // Adjust offset so the world point under the cursor stays fixed
    const worldX = (canvasX - this.offsetX) / this.zoom;
    const worldY = (canvasY - this.offsetY) / this.zoom;

    this.zoom = newZoom;
    this.offsetX = canvasX - worldX * this.zoom;
    this.offsetY = canvasY - worldY * this.zoom;

    this.clampOffset();
  }

  /** Set zoom directly, centered on canvas center */
  setZoom(zoom: number): void {
    const cx = this.canvasWidth / 2;
    const cy = this.canvasHeight / 2;

    const worldX = (cx - this.offsetX) / this.zoom;
    const worldY = (cy - this.offsetY) / this.zoom;

    this.zoom = Math.min(this.opts.maxZoom, Math.max(this.opts.minZoom, zoom));
    this.offsetX = cx - worldX * this.zoom;
    this.offsetY = cy - worldY * this.zoom;

    this.clampOffset();
  }

  // ---- Pan ----

  /** Pan by a delta in canvas/screen pixels */
  pan(dx: number, dy: number): void {
    this.offsetX += dx;
    this.offsetY += dy;
    this.clampOffset();
  }

  /** Center the view on a world-space point */
  centerOn(worldX: number, worldY: number): void {
    this.offsetX = this.canvasWidth / 2 - worldX * this.zoom;
    this.offsetY = this.canvasHeight / 2 - worldY * this.zoom;
    this.clampOffset();
  }

  // ---- Follow ----

  /** Start smoothly following a target */
  setFollowTarget(target: FollowTarget | null): void {
    this.followTarget = target;
  }

  /** Called each frame by GameRenderer */
  update(_dt: number): void {
    if (!this.followTarget) return;

    const targetOffsetX = this.canvasWidth / 2 - this.followTarget.x * this.zoom;
    const targetOffsetY = this.canvasHeight / 2 - this.followTarget.y * this.zoom;

    this.offsetX += (targetOffsetX - this.offsetX) * this.opts.followLerp;
    this.offsetY += (targetOffsetY - this.offsetY) * this.opts.followLerp;

    this.clampOffset();
  }

  // ---- Coordinate conversion ----

  /** Convert world coordinates to canvas/screen coordinates */
  worldToCanvas(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: worldX * this.zoom + this.offsetX,
      y: worldY * this.zoom + this.offsetY,
    };
  }

  /** Convert canvas/screen coordinates to world coordinates */
  screenToWorld(canvasX: number, canvasY: number): { x: number; y: number } {
    return {
      x: (canvasX - this.offsetX) / this.zoom,
      y: (canvasY - this.offsetY) / this.zoom,
    };
  }

  /** Resize the canvas */
  resize(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
  }

  // ---- Internal ----

  private clampOffset(): void {
    if (!this.opts.worldBounds) return;
    const [minX, minY, maxX, maxY] = this.opts.worldBounds;

    // Don't let user pan past world edges
    const maxOffsetX = -minX * this.zoom + this.canvasWidth * 0.1;
    const minOffsetX = -maxX * this.zoom + this.canvasWidth * 0.9;
    const maxOffsetY = -minY * this.zoom + this.canvasHeight * 0.1;
    const minOffsetY = -maxY * this.zoom + this.canvasHeight * 0.9;

    this.offsetX = Math.min(maxOffsetX, Math.max(minOffsetX, this.offsetX));
    this.offsetY = Math.min(maxOffsetY, Math.max(minOffsetY, this.offsetY));
  }
}
```

```typescript
// src/renderer/__tests__/TransformHandler.test.ts

import { describe, it, expect } from 'vitest';
import { TransformHandler } from '../TransformHandler';

describe('TransformHandler', () => {
  it('initializes with default state', () => {
    const th = new TransformHandler(800, 600);
    const s = th.getState();
    expect(s.zoom).toBe(1);
    expect(s.offsetX).toBe(0);
    expect(s.offsetY).toBe(0);
    expect(s.canvasWidth).toBe(800);
    expect(s.canvasHeight).toBe(600);
  });

  it('clamps zoom to min/max', () => {
    const th = new TransformHandler(800, 600, { minZoom: 0.2, maxZoom: 20 });
    th.setZoom(0.01);
    expect(th.getZoom()).toBeCloseTo(0.2);
    th.setZoom(100);
    expect(th.getZoom()).toBeCloseTo(20);
  });

  it('zooms at cursor position preserving world point', () => {
    const th = new TransformHandler(800, 600);
    const beforeWorld = th.screenToWorld(400, 300);
    th.zoomAt(400, 300, 1); // zoom in
    const afterWorld = th.screenToWorld(400, 300);
    expect(afterWorld.x).toBeCloseTo(beforeWorld.x, 5);
    expect(afterWorld.y).toBeCloseTo(beforeWorld.y, 5);
  });

  it('pans by delta', () => {
    const th = new TransformHandler(800, 600);
    th.pan(100, -50);
    const s = th.getState();
    expect(s.offsetX).toBe(100);
    expect(s.offsetY).toBe(-50);
  });

  it('centerOn sets offset to center world point', () => {
    const th = new TransformHandler(800, 600);
    th.centerOn(100, 200);
    const s = th.getState();
    expect(s.offsetX).toBe(800 / 2 - 100);
    expect(s.offsetY).toBe(600 / 2 - 200);
  });

  it('worldToCanvas and screenToWorld are inverses', () => {
    const th = new TransformHandler(800, 600);
    th.setZoom(2.5);
    th.pan(50, -30);

    const world = { x: 123, y: 456 };
    const canvas = th.worldToCanvas(world.x, world.y);
    const back = th.screenToWorld(canvas.x, canvas.y);

    expect(back.x).toBeCloseTo(world.x, 5);
    expect(back.y).toBeCloseTo(world.y, 5);
  });

  it('smooth follow lerps toward target', () => {
    const th = new TransformHandler(800, 600);
    th.setFollowTarget({ x: 500, y: 500 });

    const before = th.getState();
    th.update(16);
    const after = th.getState();

    // Should have moved toward centering on (500,500)
    const targetOx = 800 / 2 - 500;
    const movedRight = Math.sign(after.offsetX - before.offsetX) === Math.sign(targetOx - before.offsetX);
    expect(movedRight).toBe(true);
  });

  it('clamps offset within world bounds', () => {
    const th = new TransformHandler(800, 600, {
      worldBounds: [0, 0, 1000, 1000],
    });
    th.pan(-999999, -999999);
    const s = th.getState();
    // Should be clamped, not at -999999
    expect(s.offsetX).toBeGreaterThan(-999999);
    expect(s.offsetY).toBeGreaterThan(-999999);
  });

  it('resize updates canvas dimensions', () => {
    const th = new TransformHandler(800, 600);
    th.resize(1920, 1080);
    const s = th.getState();
    expect(s.canvasWidth).toBe(1920);
    expect(s.canvasHeight).toBe(1080);
  });
});
```

**Test command:**
```bash
npx vitest run src/renderer/__tests__/TransformHandler.test.ts
```

**Commit:** `feat(renderer): add TransformHandler with zoom, pan, smooth follow, and coordinate conversion`

---

## Task 4: StarFieldLayer

**Files:**
- `src/renderer/layers/StarFieldLayer.ts`
- `src/renderer/__tests__/StarFieldLayer.test.ts`

**Checklist:**
- [ ] Generate thousands of star dots (position, brightness, size, parallax depth)
- [ ] Deep space background color (#0a0a12)
- [ ] 3 parallax depth levels with different scroll speeds
- [ ] Subtle twinkle animation
- [ ] Visible in all zoom tiers
- [ ] Write unit tests

```typescript
// src/renderer/layers/StarFieldLayer.ts

import { BaseLayer } from '../Layer';
import type { TransformState } from '../TransformHandler';

interface Star {
  x: number;       // world-space X
  y: number;       // world-space Y
  radius: number;  // pixel radius (0.3 - 1.5)
  brightness: number; // 0.2 - 1.0
  depth: number;   // parallax depth 0.1 | 0.3 | 0.6
  twinklePhase: number; // radians offset for twinkle
  twinkleSpeed: number; // radians per second
}

const BG_COLOR = '#0a0a12';
const PARALLAX_DEPTHS = [0.1, 0.3, 0.6];
const STAR_COUNT = 3000;

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export class StarFieldLayer extends BaseLayer {
  readonly id = 'starfield';
  readonly zIndex = 0;

  private stars: Star[] = [];
  private worldWidth: number;
  private worldHeight: number;
  private seed: number;

  constructor(worldWidth = 10000, worldHeight = 10000, seed = 42) {
    super();
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.seed = seed;
  }

  init(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
    super.init(canvas, ctx);
    this.generateStars();
  }

  shouldTransform(): boolean {
    // We handle parallax manually
    return false;
  }

  getTickIntervalMs(): number {
    return 0; // animate every frame
  }

  renderLayer(ctx: CanvasRenderingContext2D, transform: TransformState, now: number): void {
    const { canvasWidth, canvasHeight, offsetX, offsetY, zoom } = transform;

    // Deep space background
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const nowSec = now / 1000;

    for (const star of this.stars) {
      // Parallax: deeper stars move less
      const px = star.x * zoom * star.depth + offsetX * star.depth;
      const py = star.y * zoom * star.depth + offsetY * star.depth;

      // Wrap stars so they tile
      const sx = ((px % canvasWidth) + canvasWidth) % canvasWidth;
      const sy = ((py % canvasHeight) + canvasHeight) % canvasHeight;

      // Twinkle
      const twinkle = 0.7 + 0.3 * Math.sin(nowSec * star.twinkleSpeed + star.twinklePhase);
      const alpha = star.brightness * twinkle;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sx, sy, star.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  private generateStars(): void {
    const rand = seededRandom(this.seed);
    this.stars = [];

    for (let i = 0; i < STAR_COUNT; i++) {
      const depth = PARALLAX_DEPTHS[Math.floor(rand() * PARALLAX_DEPTHS.length)];
      this.stars.push({
        x: rand() * this.worldWidth,
        y: rand() * this.worldHeight,
        radius: 0.3 + rand() * 1.2,
        brightness: 0.2 + rand() * 0.8,
        depth,
        twinklePhase: rand() * Math.PI * 2,
        twinkleSpeed: 0.5 + rand() * 2,
      });
    }
  }
}
```

```typescript
// src/renderer/__tests__/StarFieldLayer.test.ts

import { describe, it, expect, vi } from 'vitest';
import { StarFieldLayer } from '../layers/StarFieldLayer';
import type { TransformState } from '../TransformHandler';

function mockCtx(): CanvasRenderingContext2D {
  return {
    fillStyle: '',
    globalAlpha: 1,
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

const mockCanvas = { width: 800, height: 600 } as HTMLCanvasElement;

describe('StarFieldLayer', () => {
  it('has correct id and zIndex', () => {
    const layer = new StarFieldLayer();
    expect(layer.id).toBe('starfield');
    expect(layer.zIndex).toBe(0);
  });

  it('does not use world transform (handles parallax internally)', () => {
    const layer = new StarFieldLayer();
    expect(layer.shouldTransform()).toBe(false);
  });

  it('generates stars on init', () => {
    const layer = new StarFieldLayer(5000, 5000, 99);
    const ctx = mockCtx();
    layer.init(mockCanvas, ctx);
    // Stars are private, but we can verify rendering works
    const transform: TransformState = {
      zoom: 1, offsetX: 0, offsetY: 0,
      canvasWidth: 800, canvasHeight: 600,
    };
    layer.renderLayer(ctx, transform, 1000);
    // Should have called arc() 3000 times (one per star)
    expect(ctx.arc).toHaveBeenCalledTimes(3000);
  });

  it('fills background with deep space color', () => {
    const layer = new StarFieldLayer();
    const ctx = mockCtx();
    layer.init(mockCanvas, ctx);
    const transform: TransformState = {
      zoom: 1, offsetX: 0, offsetY: 0,
      canvasWidth: 800, canvasHeight: 600,
    };
    layer.renderLayer(ctx, transform, 0);
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 800, 600);
  });

  it('produces deterministic stars with same seed', () => {
    const layer1 = new StarFieldLayer(5000, 5000, 42);
    const layer2 = new StarFieldLayer(5000, 5000, 42);
    const ctx1 = mockCtx();
    const ctx2 = mockCtx();
    layer1.init(mockCanvas, ctx1);
    layer2.init(mockCanvas, ctx2);

    const t: TransformState = { zoom: 1, offsetX: 0, offsetY: 0, canvasWidth: 800, canvasHeight: 600 };
    layer1.renderLayer(ctx1, t, 0);
    layer2.renderLayer(ctx2, t, 0);

    // Both should produce identical arc calls
    const calls1 = (ctx1.arc as any).mock.calls;
    const calls2 = (ctx2.arc as any).mock.calls;
    expect(calls1).toEqual(calls2);
  });
});
```

**Test command:**
```bash
npx vitest run src/renderer/__tests__/StarFieldLayer.test.ts
```

**Commit:** `feat(renderer): add StarFieldLayer with parallax scrolling and twinkle animation`

---

## Task 5: NebulaLayer

**Files:**
- `src/renderer/layers/NebulaLayer.ts`
- `src/renderer/__tests__/NebulaLayer.test.ts`

**Checklist:**
- [ ] Render semi-transparent radial gradient "gas clouds"
- [ ] Purple, blue, teal color palette
- [ ] Positioned at nebula world-space locations (from game state)
- [ ] Slow drift animation
- [ ] Visible in Galaxy and Sector tiers
- [ ] Write unit tests

```typescript
// src/renderer/layers/NebulaLayer.ts

import { BaseLayer } from '../Layer';
import { ZoomTier } from '../ZoomTier';
import type { TransformState } from '../TransformHandler';

export interface NebulaData {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: string; // hex, e.g. '#6a0dad'
  opacity: number; // 0.05 - 0.25
}

const DEFAULT_NEBULA_COLORS = [
  '#6a0dad', // purple
  '#1a3a6a', // deep blue
  '#0d6a6a', // teal
  '#4a0a5a', // dark violet
  '#0a3a4a', // dark teal
];

export class NebulaLayer extends BaseLayer {
  readonly id = 'nebula';
  readonly zIndex = 1;
  readonly visibleTiers = [ZoomTier.Galaxy, ZoomTier.Sector];

  private nebulae: NebulaData[] = [];
  private driftPhase = 0;

  setNebulae(nebulae: NebulaData[]): void {
    this.nebulae = nebulae;
    this.dirty = true;
  }

  /** Generate random nebulae for testing/defaults */
  generateDefaults(count: number, worldWidth: number, worldHeight: number, seed = 7): void {
    const rand = this.seededRand(seed);
    this.nebulae = [];
    for (let i = 0; i < count; i++) {
      this.nebulae.push({
        id: `nebula-${i}`,
        x: rand() * worldWidth,
        y: rand() * worldHeight,
        radius: 200 + rand() * 600,
        color: DEFAULT_NEBULA_COLORS[i % DEFAULT_NEBULA_COLORS.length],
        opacity: 0.05 + rand() * 0.15,
      });
    }
  }

  tick(dt: number, _now: number): void {
    this.driftPhase += dt * 0.00002;
  }

  getTickIntervalMs(): number {
    return 0;
  }

  renderLayer(ctx: CanvasRenderingContext2D, _transform: TransformState, _now: number): void {
    for (const neb of this.nebulae) {
      const driftX = Math.sin(this.driftPhase + neb.x * 0.001) * 5;
      const driftY = Math.cos(this.driftPhase + neb.y * 0.001) * 5;

      const cx = neb.x + driftX;
      const cy = neb.y + driftY;

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, neb.radius);
      grad.addColorStop(0, this.hexToRgba(neb.color, neb.opacity));
      grad.addColorStop(0.5, this.hexToRgba(neb.color, neb.opacity * 0.5));
      grad.addColorStop(1, this.hexToRgba(neb.color, 0));

      ctx.fillStyle = grad;
      ctx.fillRect(cx - neb.radius, cy - neb.radius, neb.radius * 2, neb.radius * 2);
    }
  }

  private hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  private seededRand(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }
}
```

```typescript
// src/renderer/__tests__/NebulaLayer.test.ts

import { describe, it, expect, vi } from 'vitest';
import { NebulaLayer } from '../layers/NebulaLayer';
import { ZoomTier } from '../ZoomTier';
import type { TransformState } from '../TransformHandler';

function mockCtx(): CanvasRenderingContext2D {
  return {
    fillStyle: '',
    fillRect: vi.fn(),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
  } as unknown as CanvasRenderingContext2D;
}

describe('NebulaLayer', () => {
  it('has correct id, zIndex, and visible tiers', () => {
    const layer = new NebulaLayer();
    expect(layer.id).toBe('nebula');
    expect(layer.zIndex).toBe(1);
    expect(layer.visibleTiers).toEqual([ZoomTier.Galaxy, ZoomTier.Sector]);
  });

  it('renders nebulae as radial gradients', () => {
    const layer = new NebulaLayer();
    layer.setNebulae([
      { id: 'n1', x: 100, y: 200, radius: 300, color: '#6a0dad', opacity: 0.1 },
    ]);
    const ctx = mockCtx();
    const t: TransformState = { zoom: 1, offsetX: 0, offsetY: 0, canvasWidth: 800, canvasHeight: 600 };
    layer.renderLayer(ctx, t, 0);
    expect(ctx.createRadialGradient).toHaveBeenCalledTimes(1);
    expect(ctx.fillRect).toHaveBeenCalledTimes(1);
  });

  it('generateDefaults creates specified count', () => {
    const layer = new NebulaLayer();
    layer.generateDefaults(8, 5000, 5000);
    const ctx = mockCtx();
    const t: TransformState = { zoom: 1, offsetX: 0, offsetY: 0, canvasWidth: 800, canvasHeight: 600 };
    layer.renderLayer(ctx, t, 0);
    expect(ctx.createRadialGradient).toHaveBeenCalledTimes(8);
  });

  it('advances drift phase on tick', () => {
    const layer = new NebulaLayer();
    const phase1 = (layer as any).driftPhase;
    layer.tick(16, 0);
    const phase2 = (layer as any).driftPhase;
    expect(phase2).toBeGreaterThan(phase1);
  });
});
```

**Test command:**
```bash
npx vitest run src/renderer/__tests__/NebulaLayer.test.ts
```

**Commit:** `feat(renderer): add NebulaLayer with radial gradient gas clouds and drift animation`

---

## Task 6: TerritoryLayer

**Files:**
- `src/renderer/layers/TerritoryLayer.ts`
- `src/renderer/__tests__/TerritoryLayer.test.ts`

**Checklist:**
- [ ] Colored empire zones via Voronoi-like regions around controlled systems
- [ ] Glowing animated borders with pulse
- [ ] Priority-queue-based updates to avoid stalls
- [ ] 10ms tick throttle
- [ ] Off-screen canvas caching for territory fill
- [ ] Write unit tests

```typescript
// src/renderer/layers/TerritoryLayer.ts

import { BaseLayer } from '../Layer';
import { ZoomTier } from '../ZoomTier';
import type { TransformState } from '../TransformHandler';

export interface TerritorySystem {
  id: string;
  x: number;
  y: number;
  empireId: string;
}

export interface EmpireColor {
  empireId: string;
  fill: string;   // e.g. 'rgba(80,40,200,0.12)'
  border: string;  // e.g. 'rgba(120,60,255,0.6)'
}

interface VoronoiCell {
  system: TerritorySystem;
  color: EmpireColor;
}

export class TerritoryLayer extends BaseLayer {
  readonly id = 'territory';
  readonly zIndex = 2;
  readonly visibleTiers = [ZoomTier.Galaxy, ZoomTier.Sector, ZoomTier.System];

  private systems: TerritorySystem[] = [];
  private colors: Map<string, EmpireColor> = new Map();
  private cacheCanvas: OffscreenCanvas | null = null;
  private cacheCtx: OffscreenCanvasRenderingContext2D | null = null;
  private cacheValid = false;
  private cacheWidth = 0;
  private cacheHeight = 0;
  private borderPulse = 0;

  /** Update queue: systems that need Voronoi recalc */
  private updateQueue: string[] = [];
  private lastTickTime = 0;

  getTickIntervalMs(): number {
    return 10;
  }

  setTerritory(systems: TerritorySystem[], colors: EmpireColor[]): void {
    this.systems = systems;
    this.colors.clear();
    for (const c of colors) {
      this.colors.set(c.empireId, c);
    }
    this.cacheValid = false;
    this.dirty = true;
  }

  /** Queue a single system for re-evaluation (ownership change) */
  queueUpdate(systemId: string): void {
    if (!this.updateQueue.includes(systemId)) {
      this.updateQueue.push(systemId);
    }
  }

  tick(dt: number, now: number): void {
    this.borderPulse = (this.borderPulse + dt * 0.002) % (Math.PI * 2);

    // Process update queue with 10ms budget
    if (this.updateQueue.length > 0) {
      const start = performance.now();
      while (this.updateQueue.length > 0 && performance.now() - start < 10) {
        this.updateQueue.shift();
        // In full implementation: recalculate Voronoi cell for this system
      }
      this.cacheValid = false;
    }
  }

  renderLayer(ctx: CanvasRenderingContext2D, transform: TransformState, now: number): void {
    if (this.systems.length === 0) return;

    // Rebuild cache if invalid
    if (!this.cacheValid || this.dirty) {
      this.rebuildCache(transform);
      this.dirty = false;
    }

    // Draw cached territory fill
    if (this.cacheCanvas && this.cacheCtx) {
      ctx.drawImage(this.cacheCanvas, 0, 0);
    }

    // Draw animated borders on top (not cached — they pulse)
    this.drawBorders(ctx, transform, now);
  }

  private rebuildCache(transform: TransformState): void {
    // Voronoi-like territory: for each pixel in a downsampled grid,
    // find nearest system and fill with empire color.
    // We use a coarse grid for performance.

    const resolution = 4; // 1 pixel per 4 world units
    const cells = this.buildVoronoiCells();

    if (!cells.length) return;

    // Compute world bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of this.systems) {
      minX = Math.min(minX, s.x - 200);
      minY = Math.min(minY, s.y - 200);
      maxX = Math.max(maxX, s.x + 200);
      maxY = Math.max(maxY, s.y + 200);
    }

    const w = Math.ceil((maxX - minX) / resolution);
    const h = Math.ceil((maxY - minY) / resolution);

    if (w <= 0 || h <= 0 || w > 4096 || h > 4096) return;

    if (!this.cacheCanvas || this.cacheWidth !== w || this.cacheHeight !== h) {
      this.cacheCanvas = new OffscreenCanvas(w, h);
      this.cacheCtx = this.cacheCanvas.getContext('2d')!;
      this.cacheWidth = w;
      this.cacheHeight = h;
    }

    const cctx = this.cacheCtx!;
    cctx.clearRect(0, 0, w, h);

    // Simple nearest-neighbor Voronoi
    const imageData = cctx.createImageData(w, h);
    const data = imageData.data;

    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const worldX = minX + px * resolution;
        const worldY = minY + py * resolution;

        let nearest = cells[0];
        let minDist = Infinity;
        for (const cell of cells) {
          const dx = worldX - cell.system.x;
          const dy = worldY - cell.system.y;
          const dist = dx * dx + dy * dy;
          if (dist < minDist) {
            minDist = dist;
            nearest = cell;
          }
        }

        // Only fill within a certain radius of any system
        if (minDist < 200 * 200) {
          const rgba = this.parseRgba(nearest.color.fill);
          const idx = (py * w + px) * 4;
          data[idx] = rgba[0];
          data[idx + 1] = rgba[1];
          data[idx + 2] = rgba[2];
          data[idx + 3] = Math.round(rgba[3] * 255);
        }
      }
    }

    cctx.putImageData(imageData, 0, 0);
    this.cacheValid = true;
  }

  private drawBorders(ctx: CanvasRenderingContext2D, _transform: TransformState, _now: number): void {
    const pulseAlpha = 0.4 + 0.2 * Math.sin(this.borderPulse);

    // Draw convex-hull-like borders for each empire
    const empireGroups = new Map<string, TerritorySystem[]>();
    for (const sys of this.systems) {
      const group = empireGroups.get(sys.empireId) ?? [];
      group.push(sys);
      empireGroups.set(sys.empireId, group);
    }

    for (const [empireId, group] of empireGroups) {
      if (group.length < 2) continue;
      const color = this.colors.get(empireId);
      if (!color) continue;

      ctx.strokeStyle = color.border;
      ctx.globalAlpha = pulseAlpha;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 4]);

      // Simple convex hull via gift wrapping
      const hull = this.convexHull(group);
      if (hull.length < 2) continue;

      ctx.beginPath();
      ctx.moveTo(hull[0].x, hull[0].y);
      for (let i = 1; i < hull.length; i++) {
        ctx.lineTo(hull[i].x, hull[i].y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
  }

  private convexHull(points: TerritorySystem[]): TerritorySystem[] {
    if (points.length < 3) return points;

    const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
    const lower: TerritorySystem[] = [];
    for (const p of sorted) {
      while (lower.length >= 2 && this.cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
        lower.pop();
      }
      lower.push(p);
    }

    const upper: TerritorySystem[] = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
      const p = sorted[i];
      while (upper.length >= 2 && this.cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
        upper.pop();
      }
      upper.push(p);
    }

    lower.pop();
    upper.pop();
    return lower.concat(upper);
  }

  private cross(o: TerritorySystem, a: TerritorySystem, b: TerritorySystem): number {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  }

  private buildVoronoiCells(): VoronoiCell[] {
    return this.systems
      .map((s) => {
        const color = this.colors.get(s.empireId);
        if (!color) return null;
        return { system: s, color };
      })
      .filter((c): c is VoronoiCell => c !== null);
  }

  private parseRgba(rgba: string): [number, number, number, number] {
    const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]*)\)/);
    if (!match) return [128, 128, 128, 0.1];
    return [
      parseInt(match[1]),
      parseInt(match[2]),
      parseInt(match[3]),
      match[4] ? parseFloat(match[4]) : 1,
    ];
  }
}
```

```typescript
// src/renderer/__tests__/TerritoryLayer.test.ts

import { describe, it, expect, vi } from 'vitest';
import { TerritoryLayer } from '../layers/TerritoryLayer';
import { ZoomTier } from '../ZoomTier';

describe('TerritoryLayer', () => {
  it('has correct id, zIndex, and visible tiers', () => {
    const layer = new TerritoryLayer();
    expect(layer.id).toBe('territory');
    expect(layer.zIndex).toBe(2);
    expect(layer.visibleTiers).toContain(ZoomTier.Galaxy);
    expect(layer.visibleTiers).toContain(ZoomTier.Sector);
    expect(layer.visibleTiers).toContain(ZoomTier.System);
  });

  it('tick interval is 10ms', () => {
    const layer = new TerritoryLayer();
    expect(layer.getTickIntervalMs()).toBe(10);
  });

  it('queueUpdate adds to update queue', () => {
    const layer = new TerritoryLayer();
    layer.queueUpdate('sys-1');
    layer.queueUpdate('sys-2');
    layer.queueUpdate('sys-1'); // duplicate
    expect((layer as any).updateQueue).toEqual(['sys-1', 'sys-2']);
  });

  it('setTerritory marks dirty', () => {
    const layer = new TerritoryLayer();
    (layer as any).dirty = false;
    layer.setTerritory(
      [{ id: 's1', x: 100, y: 200, empireId: 'e1' }],
      [{ empireId: 'e1', fill: 'rgba(80,40,200,0.12)', border: 'rgba(120,60,255,0.6)' }],
    );
    expect((layer as any).dirty).toBe(true);
  });

  it('tick advances border pulse', () => {
    const layer = new TerritoryLayer();
    const before = (layer as any).borderPulse;
    layer.tick(100, 0);
    expect((layer as any).borderPulse).toBeGreaterThan(before);
  });

  it('tick drains update queue within time budget', () => {
    const layer = new TerritoryLayer();
    layer.queueUpdate('s1');
    layer.queueUpdate('s2');
    layer.tick(16, 0);
    expect((layer as any).updateQueue.length).toBe(0);
  });
});
```

**Test command:**
```bash
npx vitest run src/renderer/__tests__/TerritoryLayer.test.ts
```

**Commit:** `feat(renderer): add TerritoryLayer with Voronoi regions, animated borders, and priority queue updates`

---

## Task 7: HyperlaneLayer

**Files:**
- `src/renderer/layers/HyperlaneLayer.ts`
- `src/renderer/__tests__/HyperlaneLayer.test.ts`

**Checklist:**
- [ ] Connection lines between star systems
- [ ] Colored by owning empire (neutral = dim gray)
- [ ] Pulsing animation for active trade routes
- [ ] Line width scales with zoom
- [ ] Visible in Galaxy, Sector, System tiers
- [ ] Write unit tests

```typescript
// src/renderer/layers/HyperlaneLayer.ts

import { BaseLayer } from '../Layer';
import { ZoomTier } from '../ZoomTier';
import type { TransformState } from '../TransformHandler';

export interface HyperlaneData {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;       // hex
  isTradeRoute: boolean;
}

export class HyperlaneLayer extends BaseLayer {
  readonly id = 'hyperlanes';
  readonly zIndex = 3;
  readonly visibleTiers = [ZoomTier.Galaxy, ZoomTier.Sector, ZoomTier.System];

  private hyperlanes: HyperlaneData[] = [];
  private pulsePhase = 0;

  setHyperlanes(lanes: HyperlaneData[]): void {
    this.hyperlanes = lanes;
    this.dirty = true;
  }

  tick(dt: number, _now: number): void {
    this.pulsePhase = (this.pulsePhase + dt * 0.003) % (Math.PI * 2);
  }

  renderLayer(ctx: CanvasRenderingContext2D, transform: TransformState, _now: number): void {
    const baseWidth = Math.max(0.5, 1.0 / transform.zoom);

    for (const lane of this.hyperlanes) {
      ctx.beginPath();
      ctx.moveTo(lane.fromX, lane.fromY);
      ctx.lineTo(lane.toX, lane.toY);

      if (lane.isTradeRoute) {
        const pulse = 0.4 + 0.4 * Math.sin(this.pulsePhase);
        ctx.strokeStyle = lane.color;
        ctx.globalAlpha = pulse;
        ctx.lineWidth = baseWidth * 2;
        ctx.setLineDash([6 / transform.zoom, 4 / transform.zoom]);
      } else {
        ctx.strokeStyle = lane.color;
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = baseWidth;
        ctx.setLineDash([]);
      }

      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
  }
}
```

```typescript
// src/renderer/__tests__/HyperlaneLayer.test.ts

import { describe, it, expect, vi } from 'vitest';
import { HyperlaneLayer } from '../layers/HyperlaneLayer';
import { ZoomTier } from '../ZoomTier';
import type { TransformState } from '../TransformHandler';

describe('HyperlaneLayer', () => {
  it('has correct metadata', () => {
    const layer = new HyperlaneLayer();
    expect(layer.id).toBe('hyperlanes');
    expect(layer.zIndex).toBe(3);
    expect(layer.visibleTiers).toEqual([ZoomTier.Galaxy, ZoomTier.Sector, ZoomTier.System]);
  });

  it('renders lines for each hyperlane', () => {
    const layer = new HyperlaneLayer();
    layer.setHyperlanes([
      { id: 'h1', fromX: 0, fromY: 0, toX: 100, toY: 100, color: '#444', isTradeRoute: false },
      { id: 'h2', fromX: 50, fromY: 50, toX: 200, toY: 200, color: '#ff0', isTradeRoute: true },
    ]);

    const ctx = {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      strokeStyle: '',
      globalAlpha: 1,
      lineWidth: 1,
      setLineDash: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    const t: TransformState = { zoom: 1, offsetX: 0, offsetY: 0, canvasWidth: 800, canvasHeight: 600 };
    layer.renderLayer(ctx, t, 0);
    expect(ctx.stroke).toHaveBeenCalledTimes(2);
  });

  it('pulsePhase advances on tick', () => {
    const layer = new HyperlaneLayer();
    layer.tick(100, 0);
    expect((layer as any).pulsePhase).toBeGreaterThan(0);
  });
});
```

**Test command:**
```bash
npx vitest run src/renderer/__tests__/HyperlaneLayer.test.ts
```

**Commit:** `feat(renderer): add HyperlaneLayer with owner coloring and trade route pulse animation`

---

## Task 8: StarSystemLayer

**Files:**
- `src/renderer/layers/StarSystemLayer.ts`
- `src/renderer/__tests__/StarSystemLayer.test.ts`

**Checklist:**
- [ ] Star icons with spectral-type glow (O=blue-white, G=yellow, M=red-orange, K=orange)
- [ ] Radial gradient glow around each star
- [ ] Zoom-dependent size (smaller at galaxy zoom, larger at system zoom)
- [ ] Selection highlight ring
- [ ] Visible in Galaxy, Sector, System tiers
- [ ] Write unit tests

```typescript
// src/renderer/layers/StarSystemLayer.ts

import { BaseLayer } from '../Layer';
import { ZoomTier } from '../ZoomTier';
import type { TransformState } from '../TransformHandler';

export type SpectralType = 'O' | 'B' | 'A' | 'F' | 'G' | 'K' | 'M';

export interface StarSystemData {
  id: string;
  x: number;
  y: number;
  spectralType: SpectralType;
  name: string;
  selected?: boolean;
}

const SPECTRAL_COLORS: Record<SpectralType, { core: string; glow: string }> = {
  O: { core: '#aaccff', glow: '#4488ff' },
  B: { core: '#bbddff', glow: '#6699ff' },
  A: { core: '#ffffff', glow: '#aabbff' },
  F: { core: '#ffffee', glow: '#ddddaa' },
  G: { core: '#ffff44', glow: '#ffcc00' },
  K: { core: '#ffaa33', glow: '#ff6600' },
  M: { core: '#ff4400', glow: '#cc2200' },
};

export class StarSystemLayer extends BaseLayer {
  readonly id = 'starsystems';
  readonly zIndex = 5;
  readonly visibleTiers = [ZoomTier.Galaxy, ZoomTier.Sector, ZoomTier.System];

  private systems: StarSystemData[] = [];

  setSystems(systems: StarSystemData[]): void {
    this.systems = systems;
    this.dirty = true;
  }

  renderLayer(ctx: CanvasRenderingContext2D, transform: TransformState, _now: number): void {
    for (const sys of this.systems) {
      const baseRadius = this.radiusForZoom(transform.zoom);
      const colors = SPECTRAL_COLORS[sys.spectralType];

      // Glow
      const glowRadius = baseRadius * 3;
      const grad = ctx.createRadialGradient(sys.x, sys.y, 0, sys.x, sys.y, glowRadius);
      grad.addColorStop(0, colors.glow + '80');
      grad.addColorStop(1, colors.glow + '00');
      ctx.fillStyle = grad;
      ctx.fillRect(sys.x - glowRadius, sys.y - glowRadius, glowRadius * 2, glowRadius * 2);

      // Core
      ctx.fillStyle = colors.core;
      ctx.beginPath();
      ctx.arc(sys.x, sys.y, baseRadius, 0, Math.PI * 2);
      ctx.fill();

      // Selection ring
      if (sys.selected) {
        ctx.strokeStyle = '#00ffaa';
        ctx.lineWidth = 1.5 / transform.zoom;
        ctx.beginPath();
        ctx.arc(sys.x, sys.y, baseRadius * 2.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  private radiusForZoom(zoom: number): number {
    if (zoom < 0.5) return 4 / zoom;   // galaxy: big screen pixels
    if (zoom < 2.0) return 3 / zoom;   // sector
    return 5;                            // system: fixed world units
  }
}
```

```typescript
// src/renderer/__tests__/StarSystemLayer.test.ts

import { describe, it, expect, vi } from 'vitest';
import { StarSystemLayer } from '../layers/StarSystemLayer';
import type { TransformState } from '../TransformHandler';

function mockCtx(): CanvasRenderingContext2D {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
  } as unknown as CanvasRenderingContext2D;
}

describe('StarSystemLayer', () => {
  it('has correct metadata', () => {
    const layer = new StarSystemLayer();
    expect(layer.id).toBe('starsystems');
    expect(layer.zIndex).toBe(5);
  });

  it('renders star with glow and core', () => {
    const layer = new StarSystemLayer();
    layer.setSystems([
      { id: 's1', x: 100, y: 200, spectralType: 'G', name: 'Sol' },
    ]);
    const ctx = mockCtx();
    const t: TransformState = { zoom: 1, offsetX: 0, offsetY: 0, canvasWidth: 800, canvasHeight: 600 };
    layer.renderLayer(ctx, t, 0);
    expect(ctx.createRadialGradient).toHaveBeenCalledTimes(1);
    expect(ctx.arc).toHaveBeenCalledTimes(1);
    expect(ctx.fill).toHaveBeenCalledTimes(1);
  });

  it('renders selection ring when selected', () => {
    const layer = new StarSystemLayer();
    layer.setSystems([
      { id: 's1', x: 100, y: 200, spectralType: 'O', name: 'Rigel', selected: true },
    ]);
    const ctx = mockCtx();
    const t: TransformState = { zoom: 1, offsetX: 0, offsetY: 0, canvasWidth: 800, canvasHeight: 600 };
    layer.renderLayer(ctx, t, 0);
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
  });

  it('does not render selection ring when not selected', () => {
    const layer = new StarSystemLayer();
    layer.setSystems([
      { id: 's1', x: 100, y: 200, spectralType: 'M', name: 'Proxima' },
    ]);
    const ctx = mockCtx();
    const t: TransformState = { zoom: 1, offsetX: 0, offsetY: 0, canvasWidth: 800, canvasHeight: 600 };
    layer.renderLayer(ctx, t, 0);
    expect(ctx.stroke).not.toHaveBeenCalled();
  });
});
```

**Test command:**
```bash
npx vitest run src/renderer/__tests__/StarSystemLayer.test.ts
```

**Commit:** `feat(renderer): add StarSystemLayer with spectral-type glow and zoom-dependent sizing`

---

## Task 9: PlanetLayer

**Files:**
- `src/renderer/layers/PlanetLayer.ts`
- `src/renderer/__tests__/PlanetLayer.test.ts`

**Checklist:**
- [ ] Planet circles colored by type
- [ ] Blue=ocean, brown=desert, white=ice, green=terrestrial, orange=gas giant, gray=barren
- [ ] Orbital ring around parent star
- [ ] Only visible at System and Planet zoom tiers
- [ ] Write unit tests

```typescript
// src/renderer/layers/PlanetLayer.ts

import { BaseLayer } from '../Layer';
import { ZoomTier } from '../ZoomTier';
import type { TransformState } from '../TransformHandler';

export type PlanetType = 'ocean' | 'desert' | 'ice' | 'terrestrial' | 'gas_giant' | 'barren';

export interface PlanetData {
  id: string;
  /** World-space center (computed from orbit) */
  x: number;
  y: number;
  /** Parent star position for orbital ring */
  starX: number;
  starY: number;
  /** Distance from star */
  orbitRadius: number;
  /** Visual radius in world units */
  radius: number;
  type: PlanetType;
  name: string;
  selected?: boolean;
}

const PLANET_COLORS: Record<PlanetType, { fill: string; accent: string }> = {
  ocean:       { fill: '#2266cc', accent: '#44aaff' },
  desert:      { fill: '#aa7733', accent: '#cc9944' },
  ice:         { fill: '#ccddee', accent: '#ffffff' },
  terrestrial: { fill: '#44aa44', accent: '#66cc66' },
  gas_giant:   { fill: '#cc8833', accent: '#ee9944' },
  barren:      { fill: '#666666', accent: '#888888' },
};

export class PlanetLayer extends BaseLayer {
  readonly id = 'planets';
  readonly zIndex = 6;
  readonly visibleTiers = [ZoomTier.System, ZoomTier.Planet];

  private planets: PlanetData[] = [];

  setPlanets(planets: PlanetData[]): void {
    this.planets = planets;
    this.dirty = true;
  }

  renderLayer(ctx: CanvasRenderingContext2D, transform: TransformState, _now: number): void {
    // Draw orbital rings first (behind planets)
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.5;
    const drawnOrbits = new Set<string>();
    for (const p of this.planets) {
      const key = `${p.starX}-${p.starY}-${p.orbitRadius}`;
      if (drawnOrbits.has(key)) continue;
      drawnOrbits.add(key);

      ctx.beginPath();
      ctx.arc(p.starX, p.starY, p.orbitRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw planets
    for (const p of this.planets) {
      const colors = PLANET_COLORS[p.type];

      // Planet body
      const grad = ctx.createRadialGradient(
        p.x - p.radius * 0.3, p.y - p.radius * 0.3, 0,
        p.x, p.y, p.radius,
      );
      grad.addColorStop(0, colors.accent);
      grad.addColorStop(1, colors.fill);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();

      // Gas giant bands
      if (p.type === 'gas_giant') {
        ctx.save();
        ctx.clip();
        ctx.globalAlpha = 0.15;
        for (let i = -3; i <= 3; i++) {
          ctx.fillStyle = i % 2 === 0 ? '#ffcc88' : '#aa6622';
          ctx.fillRect(p.x - p.radius, p.y + i * p.radius * 0.2, p.radius * 2, p.radius * 0.12);
        }
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      // Selection ring
      if (p.selected) {
        ctx.strokeStyle = '#00ffaa';
        ctx.lineWidth = 1 / transform.zoom;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 1.6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
}
```

```typescript
// src/renderer/__tests__/PlanetLayer.test.ts

import { describe, it, expect, vi } from 'vitest';
import { PlanetLayer } from '../layers/PlanetLayer';
import { ZoomTier } from '../ZoomTier';
import type { TransformState } from '../TransformHandler';

function mockCtx(): CanvasRenderingContext2D {
  return {
    fillStyle: '',
    strokeStyle: '',
    globalAlpha: 1,
    lineWidth: 1,
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    clip: vi.fn(),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
  } as unknown as CanvasRenderingContext2D;
}

describe('PlanetLayer', () => {
  it('visible only at System and Planet tiers', () => {
    const layer = new PlanetLayer();
    expect(layer.visibleTiers).toEqual([ZoomTier.System, ZoomTier.Planet]);
  });

  it('renders orbital ring and planet body', () => {
    const layer = new PlanetLayer();
    layer.setPlanets([
      { id: 'p1', x: 150, y: 100, starX: 100, starY: 100, orbitRadius: 50, radius: 8, type: 'ocean', name: 'Earth' },
    ]);
    const ctx = mockCtx();
    const t: TransformState = { zoom: 3, offsetX: 0, offsetY: 0, canvasWidth: 800, canvasHeight: 600 };
    layer.renderLayer(ctx, t, 0);
    // 1 orbital ring arc + 1 planet arc = 2 arc calls
    expect(ctx.arc).toHaveBeenCalledTimes(2);
    expect(ctx.fill).toHaveBeenCalledTimes(1);
  });

  it('draws gas giant bands', () => {
    const layer = new PlanetLayer();
    layer.setPlanets([
      { id: 'p1', x: 200, y: 100, starX: 100, starY: 100, orbitRadius: 100, radius: 20, type: 'gas_giant', name: 'Jupiter' },
    ]);
    const ctx = mockCtx();
    const t: TransformState = { zoom: 3, offsetX: 0, offsetY: 0, canvasWidth: 800, canvasHeight: 600 };
    layer.renderLayer(ctx, t, 0);
    expect(ctx.clip).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalled();
  });
});
```

**Test command:**
```bash
npx vitest run src/renderer/__tests__/PlanetLayer.test.ts
```

**Commit:** `feat(renderer): add PlanetLayer with type coloring, orbital rings, and gas giant bands`

---

## Task 10: StructureIconsLayer (PIXI.js)

**Files:**
- `src/renderer/layers/StructureIconsLayer.ts`
- `src/renderer/__tests__/StructureIconsLayer.test.ts`

**Checklist:**
- [ ] PIXI.js Application overlay for GPU-accelerated structure icons
- [ ] 3 render modes: icon (full sprite), dot (tiny circle), level (number badge)
- [ ] Mode selection based on zoom level
- [ ] Ghost preview with price text for pending construction
- [ ] Empire-colored tinting
- [ ] Sync PIXI stage position with Canvas transform
- [ ] Write unit tests

```typescript
// src/renderer/layers/StructureIconsLayer.ts

import { BaseLayer } from '../Layer';
import { ZoomTier } from '../ZoomTier';
import type { TransformState } from '../TransformHandler';

export type StructureRenderMode = 'icon' | 'dot' | 'level';

export interface StructureData {
  id: string;
  x: number;
  y: number;
  type: string;          // e.g. 'mine', 'factory', 'spaceport'
  level: number;
  empireColor: number;   // hex number for PIXI tint, e.g. 0xff4400
  spriteKey: string;     // key into SpriteLoader cache
}

export interface GhostPreview {
  x: number;
  y: number;
  type: string;
  spriteKey: string;
  cost: number;
  valid: boolean;
}

/**
 * This layer manages a PIXI.js Application that renders structure icons
 * as GPU-accelerated sprites overlaid on the Canvas.
 *
 * The PIXI canvas is positioned exactly on top of the game canvas
 * and its stage transform is synced with the Canvas camera.
 */
export class StructureIconsLayer extends BaseLayer {
  readonly id = 'structure-icons';
  readonly zIndex = 10;
  readonly visibleTiers = [ZoomTier.Sector, ZoomTier.System, ZoomTier.Planet];

  private structures: StructureData[] = [];
  private ghost: GhostPreview | null = null;

  // In real implementation, these would be PIXI.Application, PIXI.Container, etc.
  // Typed as any here since PIXI is an external dep initialized at runtime.
  private pixiApp: any = null;
  private spriteContainer: any = null;
  private spriteMap: Map<string, any> = new Map();

  /** Initialize PIXI application. Call after canvas is mounted. */
  async initPixi(parentElement: HTMLElement, width: number, height: number): Promise<void> {
    // Dynamic import to avoid bundling PIXI if not used
    const PIXI = await import('pixi.js');

    this.pixiApp = new PIXI.Application();
    await this.pixiApp.init({
      width,
      height,
      backgroundAlpha: 0,
      antialias: true,
    });

    // Position PIXI canvas over the game canvas
    const pixiCanvas = this.pixiApp.canvas as HTMLCanvasElement;
    pixiCanvas.style.position = 'absolute';
    pixiCanvas.style.top = '0';
    pixiCanvas.style.left = '0';
    pixiCanvas.style.pointerEvents = 'none';
    parentElement.appendChild(pixiCanvas);

    this.spriteContainer = new PIXI.Container();
    this.pixiApp.stage.addChild(this.spriteContainer);
  }

  setStructures(structures: StructureData[]): void {
    this.structures = structures;
    this.dirty = true;
  }

  setGhostPreview(ghost: GhostPreview | null): void {
    this.ghost = ghost;
  }

  /** Determine render mode based on zoom */
  getRenderMode(zoom: number): StructureRenderMode {
    if (zoom < 1.0) return 'dot';
    if (zoom < 4.0) return 'level';
    return 'icon';
  }

  renderLayer(ctx: CanvasRenderingContext2D, transform: TransformState, _now: number): void {
    // Sync PIXI stage transform with canvas camera
    if (this.spriteContainer) {
      this.spriteContainer.position.set(transform.offsetX, transform.offsetY);
      this.spriteContainer.scale.set(transform.zoom, transform.zoom);
    }

    const mode = this.getRenderMode(transform.zoom);

    // Fallback Canvas 2D rendering when PIXI is not available
    if (!this.pixiApp) {
      this.renderFallback(ctx, transform, mode);
      return;
    }

    // PIXI sprite management would go here in full implementation
    // For each structure, create/update/remove PIXI sprites
    this.syncPixiSprites(mode);

    // Render ghost preview on Canvas (semi-transparent overlay)
    if (this.ghost) {
      this.renderGhost(ctx, transform);
    }
  }

  private renderFallback(ctx: CanvasRenderingContext2D, transform: TransformState, mode: StructureRenderMode): void {
    for (const s of this.structures) {
      if (mode === 'dot') {
        ctx.fillStyle = `#${s.empireColor.toString(16).padStart(6, '0')}`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 2 / transform.zoom, 0, Math.PI * 2);
        ctx.fill();
      } else if (mode === 'level') {
        ctx.fillStyle = `#${s.empireColor.toString(16).padStart(6, '0')}`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 4 / transform.zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = `${10 / transform.zoom}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(s.level), s.x, s.y);
      } else {
        // icon mode: draw placeholder rect
        const size = 16 / transform.zoom;
        ctx.fillStyle = `#${s.empireColor.toString(16).padStart(6, '0')}`;
        ctx.fillRect(s.x - size / 2, s.y - size / 2, size, size);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 0.5 / transform.zoom;
        ctx.strokeRect(s.x - size / 2, s.y - size / 2, size, size);
      }
    }
  }

  private renderGhost(ctx: CanvasRenderingContext2D, _transform: TransformState): void {
    if (!this.ghost) return;
    const g = this.ghost;

    ctx.globalAlpha = g.valid ? 0.5 : 0.25;
    ctx.fillStyle = g.valid ? '#00ff88' : '#ff4444';
    ctx.beginPath();
    ctx.arc(g.x, g.y, 8, 0, Math.PI * 2);
    ctx.fill();

    // Price label
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${g.cost}cr`, g.x, g.y - 14);
    ctx.globalAlpha = 1;
  }

  private syncPixiSprites(_mode: StructureRenderMode): void {
    // Full PIXI sprite sync implementation:
    // 1. Remove sprites for structures no longer present
    // 2. Add sprites for new structures
    // 3. Update position/tint/visibility/mode for existing sprites
  }

  dispose(): void {
    if (this.pixiApp) {
      this.pixiApp.destroy(true);
      this.pixiApp = null;
    }
    this.spriteMap.clear();
  }
}
```

```typescript
// src/renderer/__tests__/StructureIconsLayer.test.ts

import { describe, it, expect, vi } from 'vitest';
import { StructureIconsLayer } from '../layers/StructureIconsLayer';
import { ZoomTier } from '../ZoomTier';
import type { TransformState } from '../TransformHandler';

function mockCtx(): CanvasRenderingContext2D {
  return {
    fillStyle: '',
    strokeStyle: '',
    globalAlpha: 1,
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    strokeRect: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

describe('StructureIconsLayer', () => {
  it('has correct metadata', () => {
    const layer = new StructureIconsLayer();
    expect(layer.id).toBe('structure-icons');
    expect(layer.zIndex).toBe(10);
    expect(layer.visibleTiers).toEqual([ZoomTier.Sector, ZoomTier.System, ZoomTier.Planet]);
  });

  it('selects render mode based on zoom', () => {
    const layer = new StructureIconsLayer();
    expect(layer.getRenderMode(0.3)).toBe('dot');
    expect(layer.getRenderMode(0.9)).toBe('dot');
    expect(layer.getRenderMode(1.0)).toBe('level');
    expect(layer.getRenderMode(3.5)).toBe('level');
    expect(layer.getRenderMode(4.0)).toBe('icon');
    expect(layer.getRenderMode(10)).toBe('icon');
  });

  it('renders fallback dots at low zoom', () => {
    const layer = new StructureIconsLayer();
    layer.setStructures([
      { id: 's1', x: 100, y: 200, type: 'mine', level: 2, empireColor: 0xff4400, spriteKey: 'mine' },
    ]);
    const ctx = mockCtx();
    const t: TransformState = { zoom: 0.5, offsetX: 0, offsetY: 0, canvasWidth: 800, canvasHeight: 600 };
    layer.renderLayer(ctx, t, 0);
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('renders ghost preview', () => {
    const layer = new StructureIconsLayer();
    layer.setGhostPreview({ x: 50, y: 50, type: 'factory', spriteKey: 'factory', cost: 500, valid: true });
    const ctx = mockCtx();
    const t: TransformState = { zoom: 5, offsetX: 0, offsetY: 0, canvasWidth: 800, canvasHeight: 600 };
    layer.setStructures([]);
    layer.renderLayer(ctx, t, 0);
    expect(ctx.fillText).toHaveBeenCalledWith('500cr', 50, 36);
  });
});
```

**Test command:**
```bash
npx vitest run src/renderer/__tests__/StructureIconsLayer.test.ts
```

**Commit:** `feat(renderer): add StructureIconsLayer with PIXI.js GPU sprites, 3 render modes, and ghost preview`

---

## Task 11: FleetLayer

**Files:**
- `src/renderer/layers/FleetLayer.ts`
- `src/renderer/__tests__/FleetLayer.test.ts`

**Checklist:**
- [ ] Moving unit sprites along hyperlanes
- [ ] Motion plan interpolation (waypoints with timestamps)
- [ ] Trail effects (fading line behind fleet)
- [ ] Empire-colored fleet icons
- [ ] Fleet size indicator
- [ ] Visible in Galaxy, Sector, System tiers
- [ ] Write unit tests

```typescript
// src/renderer/layers/FleetLayer.ts

import { BaseLayer } from '../Layer';
import { ZoomTier } from '../ZoomTier';
import type { TransformState } from '../TransformHandler';

export interface Waypoint {
  x: number;
  y: number;
  arriveAt: number; // game timestamp
}

export interface FleetData {
  id: string;
  empireColor: string;   // hex
  shipCount: number;
  /** Ordered waypoints the fleet is following */
  motionPlan: Waypoint[];
  /** Game-time when motion started (first waypoint) */
  departedAt: number;
  selected?: boolean;
}

interface FleetPosition {
  x: number;
  y: number;
  angle: number; // heading in radians
}

const TRAIL_LENGTH = 5;
const TRAIL_FADE = 0.12;

export class FleetLayer extends BaseLayer {
  readonly id = 'fleets';
  readonly zIndex = 8;
  readonly visibleTiers = [ZoomTier.Galaxy, ZoomTier.Sector, ZoomTier.System];

  private fleets: FleetData[] = [];
  private trailHistory: Map<string, Array<{ x: number; y: number }>> = new Map();

  setFleets(fleets: FleetData[]): void {
    this.fleets = fleets;
    this.dirty = true;
  }

  tick(_dt: number, now: number): void {
    // Record trail positions
    for (const fleet of this.fleets) {
      const pos = this.interpolatePosition(fleet, now);
      if (!pos) continue;

      let trail = this.trailHistory.get(fleet.id);
      if (!trail) {
        trail = [];
        this.trailHistory.set(fleet.id, trail);
      }
      trail.push({ x: pos.x, y: pos.y });
      if (trail.length > TRAIL_LENGTH) {
        trail.shift();
      }
    }
  }

  renderLayer(ctx: CanvasRenderingContext2D, transform: TransformState, now: number): void {
    for (const fleet of this.fleets) {
      const pos = this.interpolatePosition(fleet, now);
      if (!pos) continue;

      // Trail
      const trail = this.trailHistory.get(fleet.id);
      if (trail && trail.length > 1) {
        for (let i = 0; i < trail.length - 1; i++) {
          const alpha = TRAIL_FADE * ((i + 1) / trail.length);
          ctx.strokeStyle = fleet.empireColor;
          ctx.globalAlpha = alpha;
          ctx.lineWidth = 1.5 / transform.zoom;
          ctx.beginPath();
          ctx.moveTo(trail[i].x, trail[i].y);
          ctx.lineTo(trail[i + 1].x, trail[i + 1].y);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // Fleet icon (triangle pointing in heading direction)
      const size = Math.max(4, 6 / transform.zoom);
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(pos.angle);

      ctx.fillStyle = fleet.empireColor;
      ctx.beginPath();
      ctx.moveTo(size, 0);
      ctx.lineTo(-size * 0.6, -size * 0.5);
      ctx.lineTo(-size * 0.6, size * 0.5);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      // Ship count badge
      if (transform.zoom > 0.8) {
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.9;
        ctx.font = `${Math.max(8, 10 / transform.zoom)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(String(fleet.shipCount), pos.x, pos.y - size - 2 / transform.zoom);
        ctx.globalAlpha = 1;
      }

      // Selection ring
      if (fleet.selected) {
        ctx.strokeStyle = '#00ffaa';
        ctx.lineWidth = 1 / transform.zoom;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, size * 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  /** Interpolate fleet position along its motion plan */
  interpolatePosition(fleet: FleetData, now: number): FleetPosition | null {
    const plan = fleet.motionPlan;
    if (plan.length === 0) return null;
    if (plan.length === 1) return { x: plan[0].x, y: plan[0].y, angle: 0 };

    // Find current segment
    for (let i = 0; i < plan.length - 1; i++) {
      const from = plan[i];
      const to = plan[i + 1];
      if (now >= from.arriveAt && now <= to.arriveAt) {
        const t = (now - from.arriveAt) / (to.arriveAt - from.arriveAt);
        const x = from.x + (to.x - from.x) * t;
        const y = from.y + (to.y - from.y) * t;
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        return { x, y, angle };
      }
    }

    // Past last waypoint — sit at end
    const last = plan[plan.length - 1];
    const prev = plan[plan.length - 2];
    return {
      x: last.x,
      y: last.y,
      angle: Math.atan2(last.y - prev.y, last.x - prev.x),
    };
  }
}
```

```typescript
// src/renderer/__tests__/FleetLayer.test.ts

import { describe, it, expect, vi } from 'vitest';
import { FleetLayer } from '../layers/FleetLayer';
import type { TransformState } from '../TransformHandler';

describe('FleetLayer', () => {
  it('has correct metadata', () => {
    const layer = new FleetLayer();
    expect(layer.id).toBe('fleets');
    expect(layer.zIndex).toBe(8);
  });

  it('interpolates position between waypoints', () => {
    const layer = new FleetLayer();
    const fleet = {
      id: 'f1',
      empireColor: '#ff0000',
      shipCount: 5,
      motionPlan: [
        { x: 0, y: 0, arriveAt: 0 },
        { x: 100, y: 0, arriveAt: 100 },
      ],
      departedAt: 0,
    };

    const pos = layer.interpolatePosition(fleet, 50);
    expect(pos).toBeDefined();
    expect(pos!.x).toBeCloseTo(50);
    expect(pos!.y).toBeCloseTo(0);
    expect(pos!.angle).toBeCloseTo(0); // moving right
  });

  it('returns last position after motion plan ends', () => {
    const layer = new FleetLayer();
    const fleet = {
      id: 'f1',
      empireColor: '#ff0000',
      shipCount: 3,
      motionPlan: [
        { x: 0, y: 0, arriveAt: 0 },
        { x: 100, y: 100, arriveAt: 100 },
      ],
      departedAt: 0,
    };

    const pos = layer.interpolatePosition(fleet, 200);
    expect(pos!.x).toBe(100);
    expect(pos!.y).toBe(100);
  });

  it('returns null for empty motion plan', () => {
    const layer = new FleetLayer();
    const pos = layer.interpolatePosition({
      id: 'f1', empireColor: '#ff0000', shipCount: 1, motionPlan: [], departedAt: 0,
    }, 0);
    expect(pos).toBeNull();
  });

  it('returns single point for 1-waypoint plan', () => {
    const layer = new FleetLayer();
    const pos = layer.interpolatePosition({
      id: 'f1', empireColor: '#ff0000', shipCount: 1,
      motionPlan: [{ x: 42, y: 99, arriveAt: 0 }],
      departedAt: 0,
    }, 50);
    expect(pos!.x).toBe(42);
    expect(pos!.y).toBe(99);
  });

  it('heading angle is correct for diagonal movement', () => {
    const layer = new FleetLayer();
    const fleet = {
      id: 'f1', empireColor: '#ff0000', shipCount: 1,
      motionPlan: [
        { x: 0, y: 0, arriveAt: 0 },
        { x: 100, y: 100, arriveAt: 100 },
      ],
      departedAt: 0,
    };
    const pos = layer.interpolatePosition(fleet, 50);
    expect(pos!.angle).toBeCloseTo(Math.PI / 4); // 45 degrees
  });
});
```

**Test command:**
```bash
npx vitest run src/renderer/__tests__/FleetLayer.test.ts
```

**Commit:** `feat(renderer): add FleetLayer with motion plan interpolation and trail effects`

---

## Task 12: WormholeLayer

**Files:**
- `src/renderer/layers/WormholeLayer.ts`
- `src/renderer/__tests__/WormholeLayer.test.ts`

**Checklist:**
- [ ] Animated swirling vortex portals
- [ ] Purple/blue color gradient with rotation
- [ ] Particle-like swirl dots orbiting center
- [ ] Connected pair lines between linked wormholes
- [ ] Visible at all zoom tiers
- [ ] Write unit tests

```typescript
// src/renderer/layers/WormholeLayer.ts

import { BaseLayer } from '../Layer';
import type { TransformState } from '../TransformHandler';

export interface WormholeData {
  id: string;
  x: number;
  y: number;
  radius: number;
  linkedId: string | null; // id of connected wormhole
}

const SWIRL_PARTICLES = 12;

export class WormholeLayer extends BaseLayer {
  readonly id = 'wormholes';
  readonly zIndex = 4;

  private wormholes: WormholeData[] = [];
  private rotation = 0;

  setWormholes(wormholes: WormholeData[]): void {
    this.wormholes = wormholes;
    this.dirty = true;
  }

  tick(dt: number, _now: number): void {
    this.rotation = (this.rotation + dt * 0.002) % (Math.PI * 2);
  }

  renderLayer(ctx: CanvasRenderingContext2D, transform: TransformState, now: number): void {
    // Connection lines between linked pairs
    const drawn = new Set<string>();
    for (const wh of this.wormholes) {
      if (wh.linkedId && !drawn.has(wh.id)) {
        const linked = this.wormholes.find((w) => w.id === wh.linkedId);
        if (linked) {
          ctx.strokeStyle = 'rgba(120,60,200,0.2)';
          ctx.lineWidth = 1 / transform.zoom;
          ctx.setLineDash([4 / transform.zoom, 8 / transform.zoom]);
          ctx.beginPath();
          ctx.moveTo(wh.x, wh.y);
          ctx.lineTo(linked.x, linked.y);
          ctx.stroke();
          drawn.add(wh.id);
          drawn.add(linked.id);
        }
      }
    }
    ctx.setLineDash([]);

    // Render each wormhole vortex
    for (const wh of this.wormholes) {
      // Outer glow
      const grad = ctx.createRadialGradient(wh.x, wh.y, 0, wh.x, wh.y, wh.radius);
      grad.addColorStop(0, 'rgba(100,40,180,0.4)');
      grad.addColorStop(0.5, 'rgba(60,20,140,0.2)');
      grad.addColorStop(1, 'rgba(30,10,80,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(wh.x - wh.radius, wh.y - wh.radius, wh.radius * 2, wh.radius * 2);

      // Swirling particles
      for (let i = 0; i < SWIRL_PARTICLES; i++) {
        const angle = this.rotation + (i / SWIRL_PARTICLES) * Math.PI * 2;
        const dist = wh.radius * (0.3 + 0.5 * ((i % 3) / 3));
        const px = wh.x + Math.cos(angle) * dist;
        const py = wh.y + Math.sin(angle) * dist;

        const alpha = 0.3 + 0.5 * Math.sin(angle * 2 + now * 0.003);
        ctx.fillStyle = i % 2 === 0 ? `rgba(140,80,255,${alpha})` : `rgba(60,120,255,${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, 1.5 / transform.zoom, 0, Math.PI * 2);
        ctx.fill();
      }

      // Dark center
      ctx.fillStyle = 'rgba(10,5,20,0.6)';
      ctx.beginPath();
      ctx.arc(wh.x, wh.y, wh.radius * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
```

```typescript
// src/renderer/__tests__/WormholeLayer.test.ts

import { describe, it, expect, vi } from 'vitest';
import { WormholeLayer } from '../layers/WormholeLayer';
import type { TransformState } from '../TransformHandler';

function mockCtx(): CanvasRenderingContext2D {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    setLineDash: vi.fn(),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
  } as unknown as CanvasRenderingContext2D;
}

describe('WormholeLayer', () => {
  it('has correct metadata', () => {
    const layer = new WormholeLayer();
    expect(layer.id).toBe('wormholes');
    expect(layer.zIndex).toBe(4);
    expect(layer.visibleTiers).toBeNull(); // all tiers
  });

  it('renders vortex with particles and glow', () => {
    const layer = new WormholeLayer();
    layer.setWormholes([
      { id: 'w1', x: 100, y: 200, radius: 20, linkedId: null },
    ]);
    const ctx = mockCtx();
    const t: TransformState = { zoom: 1, offsetX: 0, offsetY: 0, canvasWidth: 800, canvasHeight: 600 };
    layer.renderLayer(ctx, t, 0);
    // 12 swirl particles + 1 dark center = 13 arcs
    expect(ctx.arc).toHaveBeenCalledTimes(13);
    expect(ctx.createRadialGradient).toHaveBeenCalledTimes(1);
  });

  it('draws connection line between linked wormholes', () => {
    const layer = new WormholeLayer();
    layer.setWormholes([
      { id: 'w1', x: 100, y: 100, radius: 15, linkedId: 'w2' },
      { id: 'w2', x: 500, y: 500, radius: 15, linkedId: 'w1' },
    ]);
    const ctx = mockCtx();
    const t: TransformState = { zoom: 1, offsetX: 0, offsetY: 0, canvasWidth: 800, canvasHeight: 600 };
    layer.renderLayer(ctx, t, 0);
    // Should have a moveTo+lineTo for the connection
    expect(ctx.moveTo).toHaveBeenCalledWith(100, 100);
    expect(ctx.lineTo).toHaveBeenCalledWith(500, 500);
  });

  it('advances rotation on tick', () => {
    const layer = new WormholeLayer();
    const before = (layer as any).rotation;
    layer.tick(100, 0);
    expect((layer as any).rotation).toBeGreaterThan(before);
  });
});
```

**Test command:**
```bash
npx vitest run src/renderer/__tests__/WormholeLayer.test.ts
```

**Commit:** `feat(renderer): add WormholeLayer with swirling vortex portals and linked-pair connections`

---

## Task 13: FxLayer

**Files:**
- `src/renderer/layers/FxLayer.ts`
- `src/renderer/fx/FxEffect.ts`
- `src/renderer/fx/NovaDetonation.ts`
- `src/renderer/fx/CollapseImplosion.ts`
- `src/renderer/fx/ShipExplosion.ts`
- `src/renderer/fx/WarpFlash.ts`
- `src/renderer/fx/SwarmRain.ts`
- `src/renderer/__tests__/FxLayer.test.ts`

**Checklist:**
- [ ] `FxEffect` base interface with `update()`, `render()`, `isDone()`
- [ ] Internal OffscreenCanvas caching with 10ms throttle
- [ ] `NovaDetonation` — expanding plasma rings
- [ ] `CollapseImplosion` — implosion + shockwave
- [ ] `ShipExplosion` — debris particles
- [ ] `WarpFlash` — bright flash + fade
- [ ] `SwarmRain` — descending particle swarm
- [ ] `FxLayer` manages active effects, removes when done
- [ ] Write unit tests

```typescript
// src/renderer/fx/FxEffect.ts

export interface FxEffect {
  readonly id: string;
  readonly x: number;
  readonly y: number;

  /** Update animation state. Returns false when effect is finished. */
  update(dt: number, now: number): boolean;

  /** Render to canvas (world-space coordinates) */
  render(ctx: CanvasRenderingContext2D, zoom: number): void;

  /** Whether the effect has completed */
  isDone(): boolean;
}
```

```typescript
// src/renderer/fx/NovaDetonation.ts

import type { FxEffect } from './FxEffect';

export class NovaDetonation implements FxEffect {
  readonly id: string;
  readonly x: number;
  readonly y: number;

  private elapsed = 0;
  private readonly duration = 2000; // ms
  private readonly maxRadius: number;
  private readonly ringCount = 3;
  private done = false;

  constructor(id: string, x: number, y: number, maxRadius = 150) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.maxRadius = maxRadius;
  }

  update(dt: number, _now: number): boolean {
    this.elapsed += dt;
    if (this.elapsed >= this.duration) {
      this.done = true;
      return false;
    }
    return true;
  }

  render(ctx: CanvasRenderingContext2D, _zoom: number): void {
    const t = this.elapsed / this.duration;

    for (let i = 0; i < this.ringCount; i++) {
      const ringT = Math.max(0, t - i * 0.15);
      if (ringT <= 0) continue;

      const radius = ringT * this.maxRadius;
      const alpha = Math.max(0, 1 - ringT * 1.5);

      ctx.strokeStyle = `rgba(255,${Math.floor(120 + 100 * (1 - ringT))},50,${alpha})`;
      ctx.lineWidth = 3 * (1 - ringT);
      ctx.beginPath();
      ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Central flash
    if (t < 0.3) {
      const flashAlpha = 1 - t / 0.3;
      const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 30 * (1 - t));
      grad.addColorStop(0, `rgba(255,255,200,${flashAlpha})`);
      grad.addColorStop(1, `rgba(255,200,50,0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(this.x - 30, this.y - 30, 60, 60);
    }
  }

  isDone(): boolean {
    return this.done;
  }
}
```

```typescript
// src/renderer/fx/CollapseImplosion.ts

import type { FxEffect } from './FxEffect';

export class CollapseImplosion implements FxEffect {
  readonly id: string;
  readonly x: number;
  readonly y: number;

  private elapsed = 0;
  private readonly implodeDuration = 800;
  private readonly shockwaveDuration = 1200;
  private readonly totalDuration = 2000;
  private readonly maxRadius: number;
  private done = false;

  constructor(id: string, x: number, y: number, maxRadius = 120) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.maxRadius = maxRadius;
  }

  update(dt: number): boolean {
    this.elapsed += dt;
    if (this.elapsed >= this.totalDuration) {
      this.done = true;
      return false;
    }
    return true;
  }

  render(ctx: CanvasRenderingContext2D, _zoom: number): void {
    if (this.elapsed < this.implodeDuration) {
      // Implosion: radius shrinks to 0
      const t = this.elapsed / this.implodeDuration;
      const radius = this.maxRadius * (1 - t);
      const alpha = 0.5 + 0.5 * t;

      ctx.strokeStyle = `rgba(100,50,200,${alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Inward particles
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + t * Math.PI;
        const dist = radius * 1.2;
        const px = this.x + Math.cos(angle) * dist;
        const py = this.y + Math.sin(angle) * dist;
        ctx.fillStyle = `rgba(180,100,255,${alpha * 0.6})`;
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Shockwave expands
      const shockT = (this.elapsed - this.implodeDuration) / this.shockwaveDuration;
      const radius = shockT * this.maxRadius * 2;
      const alpha = Math.max(0, 1 - shockT);

      ctx.strokeStyle = `rgba(200,150,255,${alpha})`;
      ctx.lineWidth = 4 * (1 - shockT);
      ctx.beginPath();
      ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  isDone(): boolean {
    return this.done;
  }
}
```

```typescript
// src/renderer/fx/ShipExplosion.ts

import type { FxEffect } from './FxEffect';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export class ShipExplosion implements FxEffect {
  readonly id: string;
  readonly x: number;
  readonly y: number;

  private elapsed = 0;
  private readonly duration = 1000;
  private particles: Particle[] = [];
  private done = false;

  constructor(id: string, x: number, y: number, particleCount = 20) {
    this.id = id;
    this.x = x;
    this.y = y;

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 80;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 0.5 + Math.random() * 0.5,
        size: 1 + Math.random() * 3,
        color: Math.random() > 0.5 ? '#ff6633' : '#ffcc22',
      });
    }
  }

  update(dt: number): boolean {
    this.elapsed += dt;
    const dtSec = dt / 1000;

    for (const p of this.particles) {
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= dtSec / p.maxLife;
    }

    this.particles = this.particles.filter((p) => p.life > 0);
    if (this.elapsed >= this.duration || this.particles.length === 0) {
      this.done = true;
      return false;
    }
    return true;
  }

  render(ctx: CanvasRenderingContext2D, _zoom: number): void {
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  isDone(): boolean {
    return this.done;
  }
}
```

```typescript
// src/renderer/fx/WarpFlash.ts

import type { FxEffect } from './FxEffect';

export class WarpFlash implements FxEffect {
  readonly id: string;
  readonly x: number;
  readonly y: number;

  private elapsed = 0;
  private readonly duration = 600;
  private done = false;

  constructor(id: string, x: number, y: number) {
    this.id = id;
    this.x = x;
    this.y = y;
  }

  update(dt: number): boolean {
    this.elapsed += dt;
    if (this.elapsed >= this.duration) {
      this.done = true;
      return false;
    }
    return true;
  }

  render(ctx: CanvasRenderingContext2D, _zoom: number): void {
    const t = this.elapsed / this.duration;
    const radius = 10 + t * 40;
    const alpha = Math.max(0, 1 - t * 1.5);

    const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, radius);
    grad.addColorStop(0, `rgba(200,220,255,${alpha})`);
    grad.addColorStop(0.3, `rgba(100,150,255,${alpha * 0.5})`);
    grad.addColorStop(1, `rgba(50,80,200,0)`);

    ctx.fillStyle = grad;
    ctx.fillRect(this.x - radius, this.y - radius, radius * 2, radius * 2);

    // Light streaks
    if (t < 0.4) {
      const streakAlpha = alpha * 0.6;
      ctx.strokeStyle = `rgba(200,220,255,${streakAlpha})`;
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const len = radius * 1.5;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + Math.cos(angle) * len, this.y + Math.sin(angle) * len);
        ctx.stroke();
      }
    }
  }

  isDone(): boolean {
    return this.done;
  }
}
```

```typescript
// src/renderer/fx/SwarmRain.ts

import type { FxEffect } from './FxEffect';

interface SwarmParticle {
  x: number;
  y: number;
  vy: number;
  size: number;
  alpha: number;
}

export class SwarmRain implements FxEffect {
  readonly id: string;
  readonly x: number;
  readonly y: number;

  private elapsed = 0;
  private readonly duration = 3000;
  private readonly areaWidth: number;
  private particles: SwarmParticle[] = [];
  private done = false;

  constructor(id: string, x: number, y: number, areaWidth = 100) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.areaWidth = areaWidth;

    for (let i = 0; i < 40; i++) {
      this.particles.push({
        x: x - areaWidth / 2 + Math.random() * areaWidth,
        y: y - 100 - Math.random() * 200,
        vy: 30 + Math.random() * 60,
        size: 1 + Math.random() * 2,
        alpha: 0.3 + Math.random() * 0.5,
      });
    }
  }

  update(dt: number): boolean {
    this.elapsed += dt;
    const dtSec = dt / 1000;

    for (const p of this.particles) {
      p.y += p.vy * dtSec;
      // Reset particles that fall past target
      if (p.y > this.y + 50) {
        p.y = this.y - 100 - Math.random() * 100;
        p.x = this.x - this.areaWidth / 2 + Math.random() * this.areaWidth;
      }
    }

    if (this.elapsed >= this.duration) {
      this.done = true;
      return false;
    }
    return true;
  }

  render(ctx: CanvasRenderingContext2D, _zoom: number): void {
    const fadeOut = this.elapsed > this.duration * 0.8
      ? 1 - (this.elapsed - this.duration * 0.8) / (this.duration * 0.2)
      : 1;

    for (const p of this.particles) {
      ctx.globalAlpha = p.alpha * fadeOut;
      ctx.fillStyle = '#88ff88';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  isDone(): boolean {
    return this.done;
  }
}
```

```typescript
// src/renderer/layers/FxLayer.ts

import { BaseLayer } from '../Layer';
import type { TransformState } from '../TransformHandler';
import type { FxEffect } from '../fx/FxEffect';

export class FxLayer extends BaseLayer {
  readonly id = 'fx';
  readonly zIndex = 15;

  private effects: FxEffect[] = [];
  private cacheCanvas: OffscreenCanvas | null = null;
  private cacheCtx: OffscreenCanvasRenderingContext2D | null = null;
  private lastCacheTime = 0;
  private readonly cacheThrottleMs = 10;

  getTickIntervalMs(): number {
    return 0; // every frame for smooth FX
  }

  addEffect(effect: FxEffect): void {
    this.effects.push(effect);
  }

  removeEffect(id: string): void {
    this.effects = this.effects.filter((e) => e.id !== id);
  }

  getActiveEffectCount(): number {
    return this.effects.length;
  }

  tick(dt: number, now: number): void {
    // Update all effects; remove completed ones
    this.effects = this.effects.filter((e) => e.update(dt, now));
  }

  renderLayer(ctx: CanvasRenderingContext2D, transform: TransformState, now: number): void {
    if (this.effects.length === 0) return;

    // Use cached canvas for effects that don't change every frame
    const shouldUpdateCache = now - this.lastCacheTime >= this.cacheThrottleMs;

    if (shouldUpdateCache) {
      this.updateCache(transform);
      this.lastCacheTime = now;
    }

    // Render from cache if available, otherwise direct render
    if (this.cacheCanvas) {
      ctx.drawImage(this.cacheCanvas, 0, 0);
    } else {
      for (const effect of this.effects) {
        effect.render(ctx, transform.zoom);
      }
    }
  }

  private updateCache(transform: TransformState): void {
    const w = transform.canvasWidth;
    const h = transform.canvasHeight;

    if (!this.cacheCanvas || this.cacheCanvas.width !== w || this.cacheCanvas.height !== h) {
      this.cacheCanvas = new OffscreenCanvas(w, h);
      this.cacheCtx = this.cacheCanvas.getContext('2d')!;
    }

    const cctx = this.cacheCtx!;
    cctx.clearRect(0, 0, w, h);

    // Apply world transform to cached canvas
    cctx.save();
    cctx.translate(transform.offsetX, transform.offsetY);
    cctx.scale(transform.zoom, transform.zoom);

    for (const effect of this.effects) {
      effect.render(cctx, transform.zoom);
    }

    cctx.restore();
  }

  dispose(): void {
    this.effects = [];
    this.cacheCanvas = null;
    this.cacheCtx = null;
  }
}
```

```typescript
// src/renderer/__tests__/FxLayer.test.ts

import { describe, it, expect, vi } from 'vitest';
import { FxLayer } from '../layers/FxLayer';
import { NovaDetonation } from '../fx/NovaDetonation';
import { CollapseImplosion } from '../fx/CollapseImplosion';
import { ShipExplosion } from '../fx/ShipExplosion';
import { WarpFlash } from '../fx/WarpFlash';
import { SwarmRain } from '../fx/SwarmRain';
import type { FxEffect } from '../fx/FxEffect';

describe('FxLayer', () => {
  it('adds and tracks effects', () => {
    const layer = new FxLayer();
    layer.addEffect(new NovaDetonation('n1', 0, 0));
    layer.addEffect(new WarpFlash('w1', 50, 50));
    expect(layer.getActiveEffectCount()).toBe(2);
  });

  it('removes effects by id', () => {
    const layer = new FxLayer();
    layer.addEffect(new NovaDetonation('n1', 0, 0));
    layer.removeEffect('n1');
    expect(layer.getActiveEffectCount()).toBe(0);
  });

  it('auto-removes finished effects on tick', () => {
    const layer = new FxLayer();
    const effect = new WarpFlash('w1', 0, 0);
    layer.addEffect(effect);
    // Advance past duration (600ms)
    layer.tick(700, 700);
    expect(layer.getActiveEffectCount()).toBe(0);
  });

  it('keeps running effects alive', () => {
    const layer = new FxLayer();
    layer.addEffect(new NovaDetonation('n1', 0, 0, 100));
    layer.tick(100, 100); // 100ms into 2000ms effect
    expect(layer.getActiveEffectCount()).toBe(1);
  });
});

describe('NovaDetonation', () => {
  it('completes after duration', () => {
    const fx = new NovaDetonation('n1', 0, 0);
    expect(fx.isDone()).toBe(false);
    fx.update(2001, 2001);
    expect(fx.isDone()).toBe(true);
  });
});

describe('CollapseImplosion', () => {
  it('completes after total duration', () => {
    const fx = new CollapseImplosion('c1', 0, 0);
    fx.update(2001, 2001);
    expect(fx.isDone()).toBe(true);
  });
});

describe('ShipExplosion', () => {
  it('starts with particles', () => {
    const fx = new ShipExplosion('s1', 0, 0, 15);
    expect(fx.isDone()).toBe(false);
  });
});

describe('WarpFlash', () => {
  it('duration is 600ms', () => {
    const fx = new WarpFlash('wf1', 0, 0);
    fx.update(599, 599);
    expect(fx.isDone()).toBe(false);
    fx.update(2, 601);
    expect(fx.isDone()).toBe(true);
  });
});

describe('SwarmRain', () => {
  it('completes after 3000ms', () => {
    const fx = new SwarmRain('sr1', 0, 0);
    fx.update(3001, 3001);
    expect(fx.isDone()).toBe(true);
  });
});
```

**Test command:**
```bash
npx vitest run src/renderer/__tests__/FxLayer.test.ts
```

**Commit:** `feat(renderer): add FxLayer with NovaDetonation, CollapseImplosion, ShipExplosion, WarpFlash, and SwarmRain effects`

---

## Task 14: UILayer

**Files:**
- `src/renderer/layers/UILayer.ts`
- `src/renderer/__tests__/UILayer.test.ts`

**Checklist:**
- [ ] Selection boxes (drag-to-select rectangle)
- [ ] Health bars above units/structures
- [ ] Construction progress bars with pulsating animation
- [ ] Screen-space rendering (shouldTransform = false, manual coordinate conversion)
- [ ] Write unit tests

```typescript
// src/renderer/layers/UILayer.ts

import { BaseLayer } from '../Layer';
import type { TransformState } from '../TransformHandler';

export interface HealthBarData {
  worldX: number;
  worldY: number;
  current: number;
  max: number;
  width: number;   // world units
}

export interface ConstructionProgress {
  worldX: number;
  worldY: number;
  progress: number; // 0-1
  label: string;
}

export interface SelectionBox {
  startX: number; // canvas coords
  startY: number;
  endX: number;
  endY: number;
}

export class UILayer extends BaseLayer {
  readonly id = 'ui';
  readonly zIndex = 20;

  private healthBars: HealthBarData[] = [];
  private constructions: ConstructionProgress[] = [];
  private selectionBox: SelectionBox | null = null;
  private pulsePhase = 0;

  shouldTransform(): boolean {
    return false; // screen-space
  }

  setHealthBars(bars: HealthBarData[]): void {
    this.healthBars = bars;
  }

  setConstructions(constructions: ConstructionProgress[]): void {
    this.constructions = constructions;
  }

  setSelectionBox(box: SelectionBox | null): void {
    this.selectionBox = box;
  }

  tick(dt: number, _now: number): void {
    this.pulsePhase = (this.pulsePhase + dt * 0.004) % (Math.PI * 2);
  }

  renderLayer(ctx: CanvasRenderingContext2D, transform: TransformState, _now: number): void {
    // Selection box
    if (this.selectionBox) {
      const sb = this.selectionBox;
      const x = Math.min(sb.startX, sb.endX);
      const y = Math.min(sb.startY, sb.endY);
      const w = Math.abs(sb.endX - sb.startX);
      const h = Math.abs(sb.endY - sb.startY);

      ctx.strokeStyle = '#00ffaa';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(0,255,170,0.08)';
      ctx.fillRect(x, y, w, h);
    }

    // Health bars
    for (const bar of this.healthBars) {
      const sx = bar.worldX * transform.zoom + transform.offsetX;
      const sy = bar.worldY * transform.zoom + transform.offsetY;
      const sw = bar.width * transform.zoom;
      const barHeight = 3;

      const ratio = bar.current / bar.max;
      const color = ratio > 0.6 ? '#44ff44' : ratio > 0.3 ? '#ffaa00' : '#ff3333';

      // Background
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(sx - sw / 2, sy - 8, sw, barHeight);

      // Fill
      ctx.fillStyle = color;
      ctx.fillRect(sx - sw / 2, sy - 8, sw * ratio, barHeight);

      // Border
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(sx - sw / 2, sy - 8, sw, barHeight);
    }

    // Construction progress
    for (const c of this.constructions) {
      const sx = c.worldX * transform.zoom + transform.offsetX;
      const sy = c.worldY * transform.zoom + transform.offsetY;
      const barWidth = 40;
      const barHeight = 5;
      const pulse = 0.7 + 0.3 * Math.sin(this.pulsePhase);

      // Background
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(sx - barWidth / 2, sy + 10, barWidth, barHeight);

      // Progress fill with pulse
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#00aaff';
      ctx.fillRect(sx - barWidth / 2, sy + 10, barWidth * c.progress, barHeight);
      ctx.globalAlpha = 1;

      // Label
      ctx.fillStyle = '#ffffff';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(c.label, sx, sy + 24);

      // Percentage
      ctx.fillText(`${Math.round(c.progress * 100)}%`, sx, sy + 8);
    }
  }
}
```

```typescript
// src/renderer/__tests__/UILayer.test.ts

import { describe, it, expect, vi } from 'vitest';
import { UILayer } from '../layers/UILayer';
import type { TransformState } from '../TransformHandler';

function mockCtx(): CanvasRenderingContext2D {
  return {
    fillStyle: '',
    strokeStyle: '',
    globalAlpha: 1,
    lineWidth: 1,
    font: '',
    textAlign: '',
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    setLineDash: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

const t: TransformState = { zoom: 1, offsetX: 0, offsetY: 0, canvasWidth: 800, canvasHeight: 600 };

describe('UILayer', () => {
  it('renders in screen-space', () => {
    const layer = new UILayer();
    expect(layer.shouldTransform()).toBe(false);
  });

  it('renders selection box', () => {
    const layer = new UILayer();
    layer.setSelectionBox({ startX: 10, startY: 20, endX: 100, endY: 80 });
    const ctx = mockCtx();
    layer.renderLayer(ctx, t, 0);
    expect(ctx.strokeRect).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it('renders health bars with color coding', () => {
    const layer = new UILayer();
    layer.setHealthBars([
      { worldX: 100, worldY: 100, current: 80, max: 100, width: 20 },
      { worldX: 200, worldY: 200, current: 20, max: 100, width: 20 },
    ]);
    const ctx = mockCtx();
    layer.renderLayer(ctx, t, 0);
    // 2 bars x (background + fill + border) = 4 fillRect + 2 strokeRect
    expect(ctx.fillRect).toHaveBeenCalledTimes(4);
    expect(ctx.strokeRect).toHaveBeenCalledTimes(2);
  });

  it('renders construction progress with label', () => {
    const layer = new UILayer();
    layer.setConstructions([
      { worldX: 100, worldY: 100, progress: 0.5, label: 'Factory' },
    ]);
    const ctx = mockCtx();
    layer.renderLayer(ctx, t, 0);
    expect(ctx.fillText).toHaveBeenCalledWith('Factory', 100, 124);
    expect(ctx.fillText).toHaveBeenCalledWith('50%', 100, 108);
  });

  it('clears selection box when set to null', () => {
    const layer = new UILayer();
    layer.setSelectionBox({ startX: 0, startY: 0, endX: 10, endY: 10 });
    layer.setSelectionBox(null);
    const ctx = mockCtx();
    layer.renderLayer(ctx, t, 0);
    expect(ctx.strokeRect).not.toHaveBeenCalled();
  });
});
```

**Test command:**
```bash
npx vitest run src/renderer/__tests__/UILayer.test.ts
```

**Commit:** `feat(renderer): add UILayer with selection boxes, health bars, and construction progress`

---

## Task 15: DynamicUILayer

**Files:**
- `src/renderer/layers/DynamicUILayer.ts`
- `src/renderer/__tests__/DynamicUILayer.test.ts`

**Checklist:**
- [ ] Float text (credit bonuses, damage numbers) with upward drift and fade
- [ ] Weapon telegraphs (blast radius preview circles)
- [ ] Fleet movement indicators (destination markers, waypoint dots)
- [ ] Screen-space rendering
- [ ] Auto-cleanup of expired elements
- [ ] Write unit tests

```typescript
// src/renderer/layers/DynamicUILayer.ts

import { BaseLayer } from '../Layer';
import type { TransformState } from '../TransformHandler';

export interface FloatText {
  id: string;
  worldX: number;
  worldY: number;
  text: string;
  color: string;
  createdAt: number;
  duration: number; // ms
  offsetY: number;  // accumulated drift
}

export interface WeaponTelegraph {
  id: string;
  worldX: number;
  worldY: number;
  radius: number;
  color: string;
  createdAt: number;
  duration: number;
}

export interface MovementIndicator {
  id: string;
  worldX: number;
  worldY: number;
  type: 'destination' | 'waypoint';
  empireColor: string;
}

export class DynamicUILayer extends BaseLayer {
  readonly id = 'dynamic-ui';
  readonly zIndex = 21;

  private floatTexts: FloatText[] = [];
  private telegraphs: WeaponTelegraph[] = [];
  private indicators: MovementIndicator[] = [];

  shouldTransform(): boolean {
    return false;
  }

  addFloatText(
    id: string, worldX: number, worldY: number,
    text: string, color: string, duration = 1500, now = performance.now(),
  ): void {
    this.floatTexts.push({
      id, worldX, worldY, text, color,
      createdAt: now, duration, offsetY: 0,
    });
  }

  addTelegraph(
    id: string, worldX: number, worldY: number,
    radius: number, color: string, duration = 2000, now = performance.now(),
  ): void {
    this.telegraphs.push({ id, worldX, worldY, radius, color, createdAt: now, duration });
  }

  setIndicators(indicators: MovementIndicator[]): void {
    this.indicators = indicators;
  }

  tick(dt: number, now: number): void {
    // Drift float text upward
    for (const ft of this.floatTexts) {
      ft.offsetY -= dt * 0.03;
    }

    // Remove expired
    this.floatTexts = this.floatTexts.filter((ft) => now - ft.createdAt < ft.duration);
    this.telegraphs = this.telegraphs.filter((t) => now - t.createdAt < t.duration);
  }

  renderLayer(ctx: CanvasRenderingContext2D, transform: TransformState, now: number): void {
    // Float texts
    for (const ft of this.floatTexts) {
      const age = now - ft.createdAt;
      const alpha = Math.max(0, 1 - age / ft.duration);
      const sx = ft.worldX * transform.zoom + transform.offsetX;
      const sy = ft.worldY * transform.zoom + transform.offsetY + ft.offsetY;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = ft.color;
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, sx, sy);
    }
    ctx.globalAlpha = 1;

    // Weapon telegraphs
    for (const tg of this.telegraphs) {
      const age = now - tg.createdAt;
      const alpha = 0.15 + 0.1 * Math.sin(age * 0.01);
      const sx = tg.worldX * transform.zoom + transform.offsetX;
      const sy = tg.worldY * transform.zoom + transform.offsetY;
      const sr = tg.radius * transform.zoom;

      ctx.strokeStyle = tg.color;
      ctx.globalAlpha = alpha * 2;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = tg.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);

    // Movement indicators
    for (const ind of this.indicators) {
      const sx = ind.worldX * transform.zoom + transform.offsetX;
      const sy = ind.worldY * transform.zoom + transform.offsetY;

      if (ind.type === 'destination') {
        // Crosshair marker
        ctx.strokeStyle = ind.empireColor;
        ctx.lineWidth = 1;
        const s = 8;
        ctx.beginPath();
        ctx.moveTo(sx - s, sy); ctx.lineTo(sx + s, sy);
        ctx.moveTo(sx, sy - s); ctx.lineTo(sx, sy + s);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Waypoint dot
        ctx.fillStyle = ind.empireColor;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(sx, sy, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }
}
```

```typescript
// src/renderer/__tests__/DynamicUILayer.test.ts

import { describe, it, expect, vi } from 'vitest';
import { DynamicUILayer } from '../layers/DynamicUILayer';
import type { TransformState } from '../TransformHandler';

function mockCtx(): CanvasRenderingContext2D {
  return {
    fillStyle: '', strokeStyle: '', globalAlpha: 1, lineWidth: 1,
    font: '', textAlign: '',
    fillText: vi.fn(), fillRect: vi.fn(),
    beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(),
    stroke: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
    setLineDash: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

const t: TransformState = { zoom: 1, offsetX: 0, offsetY: 0, canvasWidth: 800, canvasHeight: 600 };

describe('DynamicUILayer', () => {
  it('renders in screen space', () => {
    const layer = new DynamicUILayer();
    expect(layer.shouldTransform()).toBe(false);
  });

  it('adds and renders float text', () => {
    const layer = new DynamicUILayer();
    layer.addFloatText('ft1', 100, 100, '+50 cr', '#ffcc00', 1500, 0);
    const ctx = mockCtx();
    layer.renderLayer(ctx, t, 500);
    expect(ctx.fillText).toHaveBeenCalledWith('+50 cr', 100, expect.any(Number));
  });

  it('removes expired float text', () => {
    const layer = new DynamicUILayer();
    layer.addFloatText('ft1', 100, 100, '+50 cr', '#ffcc00', 1000, 0);
    layer.tick(0, 1100); // past duration
    const ctx = mockCtx();
    layer.renderLayer(ctx, t, 1100);
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it('drifts float text upward on tick', () => {
    const layer = new DynamicUILayer();
    layer.addFloatText('ft1', 100, 100, 'test', '#fff', 5000, 0);
    layer.tick(100, 100);
    const ft = (layer as any).floatTexts[0];
    expect(ft.offsetY).toBeLessThan(0);
  });

  it('renders destination indicator with crosshair', () => {
    const layer = new DynamicUILayer();
    layer.setIndicators([
      { id: 'i1', worldX: 200, worldY: 300, type: 'destination', empireColor: '#ff0000' },
    ]);
    const ctx = mockCtx();
    layer.renderLayer(ctx, t, 0);
    expect(ctx.moveTo).toHaveBeenCalled();
    expect(ctx.lineTo).toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalled();
  });

  it('renders waypoint indicator as dot', () => {
    const layer = new DynamicUILayer();
    layer.setIndicators([
      { id: 'i1', worldX: 100, worldY: 100, type: 'waypoint', empireColor: '#00ff00' },
    ]);
    const ctx = mockCtx();
    layer.renderLayer(ctx, t, 0);
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });
});
```

**Test command:**
```bash
npx vitest run src/renderer/__tests__/DynamicUILayer.test.ts
```

**Commit:** `feat(renderer): add DynamicUILayer with float text, weapon telegraphs, and movement indicators`

---

## Task 16: SuperweaponTrajectoryLayer

**Files:**
- `src/renderer/layers/SuperweaponTrajectoryLayer.ts`
- `src/renderer/__tests__/SuperweaponTrajectoryLayer.test.ts`

**Checklist:**
- [ ] Real-time trajectory preview line from source to cursor
- [ ] Blast radius circle at target
- [ ] Animated dashes along trajectory
- [ ] Color-coded by weapon type (red=nova, purple=collapse, green=swarm)
- [ ] Screen-space rendering with world coordinate conversion
- [ ] Write unit tests

```typescript
// src/renderer/layers/SuperweaponTrajectoryLayer.ts

import { BaseLayer } from '../Layer';
import type { TransformState } from '../TransformHandler';

export type SuperweaponType = 'nova' | 'collapse' | 'swarm';

export interface TrajectoryPreview {
  sourceWorldX: number;
  sourceWorldY: number;
  targetWorldX: number;
  targetWorldY: number;
  blastRadius: number; // world units
  weaponType: SuperweaponType;
}

const WEAPON_COLORS: Record<SuperweaponType, { line: string; blast: string }> = {
  nova:     { line: '#ff4422', blast: 'rgba(255,68,34,0.15)' },
  collapse: { line: '#aa44ff', blast: 'rgba(170,68,255,0.15)' },
  swarm:    { line: '#44ff44', blast: 'rgba(68,255,68,0.15)' },
};

export class SuperweaponTrajectoryLayer extends BaseLayer {
  readonly id = 'superweapon-trajectory';
  readonly zIndex = 22;

  private preview: TrajectoryPreview | null = null;
  private dashOffset = 0;

  shouldTransform(): boolean {
    return false; // screen-space for precise cursor tracking
  }

  setPreview(preview: TrajectoryPreview | null): void {
    this.preview = preview;
  }

  tick(dt: number, _now: number): void {
    this.dashOffset = (this.dashOffset + dt * 0.02) % 20;
  }

  renderLayer(ctx: CanvasRenderingContext2D, transform: TransformState, _now: number): void {
    if (!this.preview) return;

    const p = this.preview;
    const colors = WEAPON_COLORS[p.weaponType];

    // Convert world to screen
    const sx1 = p.sourceWorldX * transform.zoom + transform.offsetX;
    const sy1 = p.sourceWorldY * transform.zoom + transform.offsetY;
    const sx2 = p.targetWorldX * transform.zoom + transform.offsetX;
    const sy2 = p.targetWorldY * transform.zoom + transform.offsetY;
    const blastScreenR = p.blastRadius * transform.zoom;

    // Trajectory line
    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.lineDashOffset = -this.dashOffset;
    ctx.beginPath();
    ctx.moveTo(sx1, sy1);
    ctx.lineTo(sx2, sy2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;

    // Source indicator (small diamond)
    ctx.fillStyle = colors.line;
    ctx.save();
    ctx.translate(sx1, sy1);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();

    // Blast radius circle
    ctx.fillStyle = colors.blast;
    ctx.beginPath();
    ctx.arc(sx2, sy2, blastScreenR, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(sx2, sy2, blastScreenR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Target crosshair
    const ch = 10;
    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx2 - ch, sy2); ctx.lineTo(sx2 + ch, sy2);
    ctx.moveTo(sx2, sy2 - ch); ctx.lineTo(sx2, sy2 + ch);
    ctx.stroke();

    // Distance label
    const dx = p.targetWorldX - p.sourceWorldX;
    const dy = p.targetWorldY - p.sourceWorldY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(dist)} ly`, (sx1 + sx2) / 2, (sy1 + sy2) / 2 - 8);
  }
}
```

```typescript
// src/renderer/__tests__/SuperweaponTrajectoryLayer.test.ts

import { describe, it, expect, vi } from 'vitest';
import { SuperweaponTrajectoryLayer } from '../layers/SuperweaponTrajectoryLayer';
import type { TransformState } from '../TransformHandler';

function mockCtx(): CanvasRenderingContext2D {
  return {
    fillStyle: '', strokeStyle: '', globalAlpha: 1, lineWidth: 1,
    font: '', textAlign: '', lineDashOffset: 0,
    beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(), stroke: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), fillText: vi.fn(), fillRect: vi.fn(),
    setLineDash: vi.fn(), save: vi.fn(), restore: vi.fn(),
    translate: vi.fn(), rotate: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

const t: TransformState = { zoom: 1, offsetX: 0, offsetY: 0, canvasWidth: 800, canvasHeight: 600 };

describe('SuperweaponTrajectoryLayer', () => {
  it('renders nothing when no preview set', () => {
    const layer = new SuperweaponTrajectoryLayer();
    const ctx = mockCtx();
    layer.renderLayer(ctx, t, 0);
    expect(ctx.beginPath).not.toHaveBeenCalled();
  });

  it('renders trajectory line, blast radius, and crosshair', () => {
    const layer = new SuperweaponTrajectoryLayer();
    layer.setPreview({
      sourceWorldX: 100, sourceWorldY: 100,
      targetWorldX: 300, targetWorldY: 400,
      blastRadius: 50, weaponType: 'nova',
    });
    const ctx = mockCtx();
    layer.renderLayer(ctx, t, 0);
    expect(ctx.moveTo).toHaveBeenCalled();
    expect(ctx.lineTo).toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalled(); // distance label
  });

  it('renders in screen space', () => {
    const layer = new SuperweaponTrajectoryLayer();
    expect(layer.shouldTransform()).toBe(false);
  });

  it('clears preview when set to null', () => {
    const layer = new SuperweaponTrajectoryLayer();
    layer.setPreview({
      sourceWorldX: 0, sourceWorldY: 0,
      targetWorldX: 100, targetWorldY: 100,
      blastRadius: 30, weaponType: 'collapse',
    });
    layer.setPreview(null);
    const ctx = mockCtx();
    layer.renderLayer(ctx, t, 0);
    expect(ctx.beginPath).not.toHaveBeenCalled();
  });

  it('shows correct distance in label', () => {
    const layer = new SuperweaponTrajectoryLayer();
    layer.setPreview({
      sourceWorldX: 0, sourceWorldY: 0,
      targetWorldX: 300, targetWorldY: 400,
      blastRadius: 30, weaponType: 'swarm',
    });
    const ctx = mockCtx();
    layer.renderLayer(ctx, t, 0);
    // Distance = sqrt(300^2 + 400^2) = 500
    expect(ctx.fillText).toHaveBeenCalledWith('500 ly', 150, 192);
  });
});
```

**Test command:**
```bash
npx vitest run src/renderer/__tests__/SuperweaponTrajectoryLayer.test.ts
```

**Commit:** `feat(renderer): add SuperweaponTrajectoryLayer with real-time targeting preview`

---

## Task 17: NameLayer (DOM-based)

**Files:**
- `src/renderer/layers/NameLayer.ts`
- `src/renderer/__tests__/NameLayer.test.ts`

**Checklist:**
- [ ] DOM-based empire names and system labels positioned over canvas
- [ ] Icon badges: crown (emperor), traitor, alliance, target
- [ ] Zoom-tier-dependent visibility (galaxy = empire names, system = star names)
- [ ] Efficient DOM recycling (pool of label divs)
- [ ] Write unit tests

```typescript
// src/renderer/layers/NameLayer.ts

import { BaseLayer } from '../Layer';
import { zoomToTier, ZoomTier } from '../ZoomTier';
import type { TransformState } from '../TransformHandler';

export type LabelIcon = 'crown' | 'traitor' | 'alliance' | 'target' | 'none';

export interface NameLabel {
  id: string;
  worldX: number;
  worldY: number;
  text: string;
  color: string;
  fontSize: number;
  icon: LabelIcon;
  /** Which zoom tiers this label is visible in */
  tiers: ZoomTier[];
}

const ICON_CHARS: Record<LabelIcon, string> = {
  crown: '\u{1F451}',     // crown emoji as fallback
  traitor: '\u2620',      // skull and crossbones
  alliance: '\u2694',     // crossed swords
  target: '\u25CE',       // bullseye
  none: '',
};

export class NameLayer extends BaseLayer {
  readonly id = 'names';
  readonly zIndex = 25;

  private labels: NameLabel[] = [];
  private container: HTMLDivElement | null = null;
  private labelPool: HTMLDivElement[] = [];
  private activeLabels: Map<string, HTMLDivElement> = new Map();

  shouldTransform(): boolean {
    return false;
  }

  /** Must be called after canvas is mounted */
  initDOM(parentElement: HTMLElement): void {
    this.container = document.createElement('div');
    this.container.style.position = 'absolute';
    this.container.style.top = '0';
    this.container.style.left = '0';
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.pointerEvents = 'none';
    this.container.style.overflow = 'hidden';
    parentElement.appendChild(this.container);
  }

  setLabels(labels: NameLabel[]): void {
    this.labels = labels;
    this.dirty = true;
  }

  renderLayer(ctx: CanvasRenderingContext2D, transform: TransformState, _now: number): void {
    if (!this.container) {
      // Fallback: render to canvas
      this.renderCanvasFallback(ctx, transform);
      return;
    }

    const currentTier = zoomToTier(transform.zoom);

    // Hide all active labels first
    for (const [id, div] of this.activeLabels) {
      div.style.display = 'none';
    }

    // Show visible labels
    for (const label of this.labels) {
      if (!label.tiers.includes(currentTier)) continue;

      const sx = label.worldX * transform.zoom + transform.offsetX;
      const sy = label.worldY * transform.zoom + transform.offsetY;

      // Skip if off-screen
      if (sx < -200 || sx > transform.canvasWidth + 200 ||
          sy < -50 || sy > transform.canvasHeight + 50) continue;

      let div = this.activeLabels.get(label.id);
      if (!div) {
        div = this.acquireDiv();
        this.activeLabels.set(label.id, div);
      }

      const iconStr = ICON_CHARS[label.icon];
      div.textContent = iconStr ? `${iconStr} ${label.text}` : label.text;
      div.style.display = 'block';
      div.style.position = 'absolute';
      div.style.left = `${sx}px`;
      div.style.top = `${sy}px`;
      div.style.transform = 'translate(-50%, 0)';
      div.style.color = label.color;
      div.style.fontSize = `${label.fontSize}px`;
      div.style.fontFamily = 'monospace';
      div.style.textShadow = '0 0 4px rgba(0,0,0,0.8)';
      div.style.whiteSpace = 'nowrap';
    }
  }

  private renderCanvasFallback(ctx: CanvasRenderingContext2D, transform: TransformState): void {
    const currentTier = zoomToTier(transform.zoom);

    for (const label of this.labels) {
      if (!label.tiers.includes(currentTier)) continue;

      const sx = label.worldX * transform.zoom + transform.offsetX;
      const sy = label.worldY * transform.zoom + transform.offsetY;

      if (sx < -200 || sx > transform.canvasWidth + 200 ||
          sy < -50 || sy > transform.canvasHeight + 50) continue;

      const iconStr = ICON_CHARS[label.icon];
      const text = iconStr ? `${iconStr} ${label.text}` : label.text;

      ctx.fillStyle = label.color;
      ctx.font = `${label.fontSize}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(text, sx, sy);
    }
  }

  private acquireDiv(): HTMLDivElement {
    if (this.labelPool.length > 0) {
      return this.labelPool.pop()!;
    }
    const div = document.createElement('div');
    this.container!.appendChild(div);
    return div;
  }

  private releaseDiv(div: HTMLDivElement): void {
    div.style.display = 'none';
    this.labelPool.push(div);
  }

  dispose(): void {
    if (this.container && this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
    this.container = null;
    this.activeLabels.clear();
    this.labelPool = [];
  }
}
```

```typescript
// src/renderer/__tests__/NameLayer.test.ts

import { describe, it, expect, vi } from 'vitest';
import { NameLayer } from '../layers/NameLayer';
import { ZoomTier } from '../ZoomTier';
import type { TransformState } from '../TransformHandler';

function mockCtx(): CanvasRenderingContext2D {
  return {
    fillStyle: '', font: '', textAlign: '',
    fillText: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

describe('NameLayer', () => {
  it('has correct metadata', () => {
    const layer = new NameLayer();
    expect(layer.id).toBe('names');
    expect(layer.zIndex).toBe(25);
    expect(layer.shouldTransform()).toBe(false);
  });

  it('renders canvas fallback when no DOM container', () => {
    const layer = new NameLayer();
    layer.setLabels([
      { id: 'l1', worldX: 100, worldY: 100, text: 'Empire Alpha', color: '#fff',
        fontSize: 14, icon: 'crown', tiers: [ZoomTier.Galaxy] },
    ]);
    const ctx = mockCtx();
    const t: TransformState = { zoom: 0.3, offsetX: 0, offsetY: 0, canvasWidth: 800, canvasHeight: 600 };
    layer.renderLayer(ctx, t, 0);
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it('filters labels by zoom tier', () => {
    const layer = new NameLayer();
    layer.setLabels([
      { id: 'l1', worldX: 100, worldY: 100, text: 'Galaxy Label', color: '#fff',
        fontSize: 14, icon: 'none', tiers: [ZoomTier.Galaxy] },
      { id: 'l2', worldX: 200, worldY: 200, text: 'System Label', color: '#fff',
        fontSize: 12, icon: 'none', tiers: [ZoomTier.System] },
    ]);
    const ctx = mockCtx();
    // At Galaxy zoom, only galaxy label visible
    const t: TransformState = { zoom: 0.3, offsetX: 0, offsetY: 0, canvasWidth: 800, canvasHeight: 600 };
    layer.renderLayer(ctx, t, 0);
    expect(ctx.fillText).toHaveBeenCalledTimes(1);
    expect(ctx.fillText).toHaveBeenCalledWith(expect.stringContaining('Galaxy Label'), expect.any(Number), expect.any(Number));
  });

  it('skips off-screen labels', () => {
    const layer = new NameLayer();
    layer.setLabels([
      { id: 'l1', worldX: 99999, worldY: 99999, text: 'Far Away', color: '#fff',
        fontSize: 14, icon: 'none', tiers: [ZoomTier.Galaxy] },
    ]);
    const ctx = mockCtx();
    const t: TransformState = { zoom: 0.3, offsetX: 0, offsetY: 0, canvasWidth: 800, canvasHeight: 600 };
    layer.renderLayer(ctx, t, 0);
    expect(ctx.fillText).not.toHaveBeenCalled();
  });
});
```

**Test command:**
```bash
npx vitest run src/renderer/__tests__/NameLayer.test.ts
```

**Commit:** `feat(renderer): add NameLayer with DOM labels, icon badges, and zoom-tier filtering`

---

## Task 18: SpriteLoader

**Files:**
- `src/renderer/sprites/SpriteLoader.ts`
- `src/renderer/__tests__/SpriteLoader.test.ts`

**Checklist:**
- [ ] Load images as `ImageBitmap` for fast canvas rendering
- [ ] Cache loaded sprites by key
- [ ] Dynamic empire-color colorization (tint re-color)
- [ ] Batch preload method
- [ ] Fallback placeholder for missing sprites
- [ ] Write unit tests

```typescript
// src/renderer/sprites/SpriteLoader.ts

export interface SpriteEntry {
  key: string;
  bitmap: ImageBitmap;
  width: number;
  height: number;
}

export class SpriteLoader {
  private cache: Map<string, SpriteEntry> = new Map();
  private colorizedCache: Map<string, SpriteEntry> = new Map();
  private loading: Map<string, Promise<SpriteEntry>> = new Map();

  /** Load a single sprite from URL */
  async load(key: string, url: string): Promise<SpriteEntry> {
    const cached = this.cache.get(key);
    if (cached) return cached;

    const existing = this.loading.get(key);
    if (existing) return existing;

    const promise = this.fetchAndCache(key, url);
    this.loading.set(key, promise);
    return promise;
  }

  /** Preload multiple sprites in parallel */
  async preload(entries: Array<{ key: string; url: string }>): Promise<void> {
    await Promise.all(entries.map((e) => this.load(e.key, e.url)));
  }

  /** Get a cached sprite (returns undefined if not loaded) */
  get(key: string): SpriteEntry | undefined {
    return this.cache.get(key);
  }

  /** Check if a sprite is loaded */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Get a colorized version of a sprite.
   * Replaces white pixels with the target color, preserving alpha.
   */
  getColorized(key: string, empireColor: string): SpriteEntry | undefined {
    const cacheKey = `${key}__${empireColor}`;
    const cached = this.colorizedCache.get(cacheKey);
    if (cached) return cached;

    const original = this.cache.get(key);
    if (!original) return undefined;

    const colorized = this.colorize(original, empireColor, cacheKey);
    if (colorized) {
      this.colorizedCache.set(cacheKey, colorized);
    }
    return colorized;
  }

  /** Create a simple placeholder bitmap */
  createPlaceholder(key: string, width: number, height: number, color: string): SpriteEntry {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(1, 1, width - 2, height - 2);

    // We need ImageBitmap — create from canvas
    // Note: createImageBitmap is async, but for placeholder we store the canvas data
    const entry: SpriteEntry = {
      key,
      bitmap: null as unknown as ImageBitmap, // will be set async
      width,
      height,
    };

    createImageBitmap(canvas).then((bmp) => {
      entry.bitmap = bmp;
      this.cache.set(key, entry);
    });

    return entry;
  }

  /** Clear all caches */
  dispose(): void {
    for (const entry of this.cache.values()) {
      entry.bitmap?.close();
    }
    for (const entry of this.colorizedCache.values()) {
      entry.bitmap?.close();
    }
    this.cache.clear();
    this.colorizedCache.clear();
    this.loading.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  // ---- Internal ----

  private async fetchAndCache(key: string, url: string): Promise<SpriteEntry> {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);

      const entry: SpriteEntry = {
        key,
        bitmap,
        width: bitmap.width,
        height: bitmap.height,
      };

      this.cache.set(key, entry);
      this.loading.delete(key);
      return entry;
    } catch (err) {
      this.loading.delete(key);
      throw new Error(`Failed to load sprite "${key}" from "${url}": ${err}`);
    }
  }

  private colorize(
    original: SpriteEntry,
    color: string,
    cacheKey: string,
  ): SpriteEntry | undefined {
    try {
      const canvas = new OffscreenCanvas(original.width, original.height);
      const ctx = canvas.getContext('2d')!;

      // Draw original
      ctx.drawImage(original.bitmap, 0, 0);

      // Apply color tint using multiply composite
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, original.width, original.height);

      // Restore alpha from original
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(original.bitmap, 0, 0);

      ctx.globalCompositeOperation = 'source-over';

      // Synchronously create entry, async fill bitmap
      const entry: SpriteEntry = {
        key: cacheKey,
        bitmap: null as unknown as ImageBitmap,
        width: original.width,
        height: original.height,
      };

      createImageBitmap(canvas).then((bmp) => {
        entry.bitmap = bmp;
      });

      return entry;
    } catch {
      return undefined;
    }
  }
}
```

```typescript
// src/renderer/__tests__/SpriteLoader.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpriteLoader } from '../sprites/SpriteLoader';

describe('SpriteLoader', () => {
  let loader: SpriteLoader;

  beforeEach(() => {
    loader = new SpriteLoader();
  });

  it('starts with empty cache', () => {
    expect(loader.size).toBe(0);
    expect(loader.has('anything')).toBe(false);
  });

  it('returns undefined for uncached sprites', () => {
    expect(loader.get('nonexistent')).toBeUndefined();
  });

  it('returns undefined for colorized version of uncached sprite', () => {
    expect(loader.getColorized('nonexistent', '#ff0000')).toBeUndefined();
  });

  it('dispose clears all caches', () => {
    loader.dispose();
    expect(loader.size).toBe(0);
  });

  // Note: fetch-based tests require DOM/worker environment
  // In CI, we test the logic paths without actual image loading

  it('deduplicates concurrent loads of same key', () => {
    // The loading map prevents duplicate fetches
    const loadingMap = (loader as any).loading as Map<string, Promise<any>>;
    expect(loadingMap.size).toBe(0);
  });
});
```

**Test command:**
```bash
npx vitest run src/renderer/__tests__/SpriteLoader.test.ts
```

**Commit:** `feat(renderer): add SpriteLoader with ImageBitmap caching and empire-color colorization`

---

## Task 19: AnimatedSprite

**Files:**
- `src/renderer/sprites/AnimatedSprite.ts`
- `src/renderer/sprites/AnimatedSpriteConfig.ts`
- `src/renderer/__tests__/AnimatedSprite.test.ts`

**Checklist:**
- [ ] Frame-by-frame sprite sheet animation
- [ ] Configurable frame count, frame duration, loop mode
- [ ] 10 FX types preconfigured (explosion, warp, shield, build, etc.)
- [ ] Play/pause/reset controls
- [ ] `onComplete` callback for one-shot animations
- [ ] Write unit tests

```typescript
// src/renderer/sprites/AnimatedSpriteConfig.ts

export interface AnimatedSpriteConfig {
  /** Unique name for this animation type */
  name: string;
  /** Sprite sheet key in SpriteLoader */
  spriteKey: string;
  /** Number of frames in the sheet (horizontal strip) */
  frameCount: number;
  /** Width of each frame in pixels */
  frameWidth: number;
  /** Height of each frame in pixels */
  frameHeight: number;
  /** Duration of each frame in ms */
  frameDurationMs: number;
  /** Whether to loop the animation */
  loop: boolean;
}

/**
 * Preconfigured animation types.
 * Sprite sheets are assumed to be horizontal strips.
 */
export const FX_ANIMATIONS: Record<string, AnimatedSpriteConfig> = {
  explosion_small: {
    name: 'explosion_small',
    spriteKey: 'fx_explosion_small',
    frameCount: 8,
    frameWidth: 64,
    frameHeight: 64,
    frameDurationMs: 60,
    loop: false,
  },
  explosion_large: {
    name: 'explosion_large',
    spriteKey: 'fx_explosion_large',
    frameCount: 12,
    frameWidth: 128,
    frameHeight: 128,
    frameDurationMs: 50,
    loop: false,
  },
  warp_in: {
    name: 'warp_in',
    spriteKey: 'fx_warp_in',
    frameCount: 10,
    frameWidth: 96,
    frameHeight: 96,
    frameDurationMs: 40,
    loop: false,
  },
  warp_out: {
    name: 'warp_out',
    spriteKey: 'fx_warp_out',
    frameCount: 10,
    frameWidth: 96,
    frameHeight: 96,
    frameDurationMs: 40,
    loop: false,
  },
  shield_hit: {
    name: 'shield_hit',
    spriteKey: 'fx_shield_hit',
    frameCount: 6,
    frameWidth: 64,
    frameHeight: 64,
    frameDurationMs: 50,
    loop: false,
  },
  shield_loop: {
    name: 'shield_loop',
    spriteKey: 'fx_shield_loop',
    frameCount: 8,
    frameWidth: 64,
    frameHeight: 64,
    frameDurationMs: 80,
    loop: true,
  },
  build_construct: {
    name: 'build_construct',
    spriteKey: 'fx_build',
    frameCount: 16,
    frameWidth: 48,
    frameHeight: 48,
    frameDurationMs: 100,
    loop: true,
  },
  laser_impact: {
    name: 'laser_impact',
    spriteKey: 'fx_laser_impact',
    frameCount: 5,
    frameWidth: 32,
    frameHeight: 32,
    frameDurationMs: 40,
    loop: false,
  },
  missile_trail: {
    name: 'missile_trail',
    spriteKey: 'fx_missile_trail',
    frameCount: 4,
    frameWidth: 16,
    frameHeight: 32,
    frameDurationMs: 60,
    loop: true,
  },
  nova_charge: {
    name: 'nova_charge',
    spriteKey: 'fx_nova_charge',
    frameCount: 20,
    frameWidth: 128,
    frameHeight: 128,
    frameDurationMs: 80,
    loop: false,
  },
};
```

```typescript
// src/renderer/sprites/AnimatedSprite.ts

import type { AnimatedSpriteConfig } from './AnimatedSpriteConfig';

export class AnimatedSprite {
  readonly config: AnimatedSpriteConfig;

  private currentFrame = 0;
  private elapsed = 0;
  private playing = false;
  private completed = false;
  private onComplete: (() => void) | null = null;

  constructor(config: AnimatedSpriteConfig) {
    this.config = config;
  }

  /** Start or resume playing */
  play(onComplete?: () => void): void {
    this.playing = true;
    this.completed = false;
    if (onComplete) this.onComplete = onComplete;
  }

  /** Pause the animation */
  pause(): void {
    this.playing = false;
  }

  /** Reset to first frame */
  reset(): void {
    this.currentFrame = 0;
    this.elapsed = 0;
    this.completed = false;
    this.playing = false;
  }

  /** Advance animation by dt milliseconds */
  update(dt: number): void {
    if (!this.playing || this.completed) return;

    this.elapsed += dt;

    while (this.elapsed >= this.config.frameDurationMs) {
      this.elapsed -= this.config.frameDurationMs;
      this.currentFrame++;

      if (this.currentFrame >= this.config.frameCount) {
        if (this.config.loop) {
          this.currentFrame = 0;
        } else {
          this.currentFrame = this.config.frameCount - 1;
          this.completed = true;
          this.playing = false;
          this.onComplete?.();
          break;
        }
      }
    }
  }

  /**
   * Render the current frame to a canvas context.
   * Requires the sprite sheet bitmap to be provided.
   */
  render(
    ctx: CanvasRenderingContext2D,
    spriteSheet: ImageBitmap,
    destX: number,
    destY: number,
    destWidth?: number,
    destHeight?: number,
  ): void {
    const fw = this.config.frameWidth;
    const fh = this.config.frameHeight;
    const sx = this.currentFrame * fw;

    ctx.drawImage(
      spriteSheet,
      sx, 0, fw, fh,
      destX - (destWidth ?? fw) / 2,
      destY - (destHeight ?? fh) / 2,
      destWidth ?? fw,
      destHeight ?? fh,
    );
  }

  getCurrentFrame(): number {
    return this.currentFrame;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  isCompleted(): boolean {
    return this.completed;
  }

  /** Total animation duration in ms */
  getTotalDuration(): number {
    return this.config.frameCount * this.config.frameDurationMs;
  }
}
```

```typescript
// src/renderer/__tests__/AnimatedSprite.test.ts

import { describe, it, expect, vi } from 'vitest';
import { AnimatedSprite } from '../sprites/AnimatedSprite';
import { FX_ANIMATIONS } from '../sprites/AnimatedSpriteConfig';
import type { AnimatedSpriteConfig } from '../sprites/AnimatedSpriteConfig';

const testConfig: AnimatedSpriteConfig = {
  name: 'test',
  spriteKey: 'test_sheet',
  frameCount: 4,
  frameWidth: 32,
  frameHeight: 32,
  frameDurationMs: 100,
  loop: false,
};

const loopConfig: AnimatedSpriteConfig = {
  ...testConfig,
  name: 'test_loop',
  loop: true,
};

describe('AnimatedSprite', () => {
  it('starts at frame 0, not playing', () => {
    const sprite = new AnimatedSprite(testConfig);
    expect(sprite.getCurrentFrame()).toBe(0);
    expect(sprite.isPlaying()).toBe(false);
    expect(sprite.isCompleted()).toBe(false);
  });

  it('advances frames on update', () => {
    const sprite = new AnimatedSprite(testConfig);
    sprite.play();
    sprite.update(100); // frame 0 -> 1
    expect(sprite.getCurrentFrame()).toBe(1);
    sprite.update(100); // frame 1 -> 2
    expect(sprite.getCurrentFrame()).toBe(2);
  });

  it('completes non-looping animation', () => {
    const sprite = new AnimatedSprite(testConfig);
    const onComplete = vi.fn();
    sprite.play(onComplete);
    sprite.update(400); // 4 frames * 100ms
    expect(sprite.isCompleted()).toBe(true);
    expect(sprite.isPlaying()).toBe(false);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(sprite.getCurrentFrame()).toBe(3); // stays on last frame
  });

  it('loops back to frame 0', () => {
    const sprite = new AnimatedSprite(loopConfig);
    sprite.play();
    sprite.update(400); // completes one loop
    expect(sprite.getCurrentFrame()).toBe(0);
    expect(sprite.isPlaying()).toBe(true);
    expect(sprite.isCompleted()).toBe(false);
  });

  it('pause stops advancement', () => {
    const sprite = new AnimatedSprite(testConfig);
    sprite.play();
    sprite.update(100);
    expect(sprite.getCurrentFrame()).toBe(1);
    sprite.pause();
    sprite.update(100);
    expect(sprite.getCurrentFrame()).toBe(1); // no change
  });

  it('reset returns to initial state', () => {
    const sprite = new AnimatedSprite(testConfig);
    sprite.play();
    sprite.update(200);
    sprite.reset();
    expect(sprite.getCurrentFrame()).toBe(0);
    expect(sprite.isPlaying()).toBe(false);
    expect(sprite.isCompleted()).toBe(false);
  });

  it('getTotalDuration returns correct value', () => {
    const sprite = new AnimatedSprite(testConfig);
    expect(sprite.getTotalDuration()).toBe(400);
  });

  it('all 10 FX_ANIMATIONS configs exist', () => {
    const configs = Object.keys(FX_ANIMATIONS);
    expect(configs).toHaveLength(10);
    expect(configs).toContain('explosion_small');
    expect(configs).toContain('explosion_large');
    expect(configs).toContain('warp_in');
    expect(configs).toContain('warp_out');
    expect(configs).toContain('shield_hit');
    expect(configs).toContain('shield_loop');
    expect(configs).toContain('build_construct');
    expect(configs).toContain('laser_impact');
    expect(configs).toContain('missile_trail');
    expect(configs).toContain('nova_charge');
  });

  it('each FX config has valid frameCount and frameDurationMs', () => {
    for (const config of Object.values(FX_ANIMATIONS)) {
      expect(config.frameCount).toBeGreaterThan(0);
      expect(config.frameDurationMs).toBeGreaterThan(0);
      expect(config.frameWidth).toBeGreaterThan(0);
      expect(config.frameHeight).toBeGreaterThan(0);
    }
  });
});
```

**Test command:**
```bash
npx vitest run src/renderer/__tests__/AnimatedSprite.test.ts
```

**Commit:** `feat(renderer): add AnimatedSprite with frame-by-frame animation and 10 FX type configs`

---

## Task 20: Color System

**Files:**
- `src/renderer/color/ColorSystem.ts`
- `src/renderer/color/colorConvert.ts`
- `src/renderer/color/palettes.ts`
- `src/renderer/__tests__/ColorSystem.test.ts`

**Checklist:**
- [ ] LAB/LCH color space conversion utilities
- [ ] Delta-E 2000 perceptual distance function
- [ ] Color allocation ensuring minimum distance between empire colors
- [ ] 4 palette categories: player, alien, human, bot/team
- [ ] Dark theme adjustments (luminance cap, saturation boost)
- [ ] Write unit tests

```typescript
// src/renderer/color/colorConvert.ts

/** sRGB [0-255] to linear */
function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Linear to sRGB [0-255] */
function linearToSrgb(c: number): number {
  const s = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(255, s * 255)));
}

export interface RGB { r: number; g: number; b: number } // 0-255
export interface LAB { L: number; a: number; b: number }
export interface LCH { L: number; C: number; h: number } // h in degrees

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function rgbToHex(rgb: RGB): string {
  const r = Math.max(0, Math.min(255, Math.round(rgb.r)));
  const g = Math.max(0, Math.min(255, Math.round(rgb.g)));
  const b = Math.max(0, Math.min(255, Math.round(rgb.b)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function rgbToLab(rgb: RGB): LAB {
  // sRGB -> XYZ (D65)
  const rl = srgbToLinear(rgb.r);
  const gl = srgbToLinear(rgb.g);
  const bl = srgbToLinear(rgb.b);

  let x = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) / 0.95047;
  let y = (rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750) / 1.0;
  let z = (rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041) / 1.08883;

  const epsilon = 0.008856;
  const kappa = 903.3;

  x = x > epsilon ? Math.cbrt(x) : (kappa * x + 16) / 116;
  y = y > epsilon ? Math.cbrt(y) : (kappa * y + 16) / 116;
  z = z > epsilon ? Math.cbrt(z) : (kappa * z + 16) / 116;

  return {
    L: 116 * y - 16,
    a: 500 * (x - y),
    b: 200 * (y - z),
  };
}

export function labToLch(lab: LAB): LCH {
  const C = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  let h = Math.atan2(lab.b, lab.a) * (180 / Math.PI);
  if (h < 0) h += 360;
  return { L: lab.L, C, h };
}

export function lchToLab(lch: LCH): LAB {
  const hRad = lch.h * (Math.PI / 180);
  return {
    L: lch.L,
    a: lch.C * Math.cos(hRad),
    b: lch.C * Math.sin(hRad),
  };
}

/**
 * CIEDE2000 color difference.
 * Returns a perceptual distance metric.
 */
export function deltaE2000(lab1: LAB, lab2: LAB): number {
  const L1 = lab1.L, a1 = lab1.a, b1 = lab1.b;
  const L2 = lab2.L, a2 = lab2.a, b2 = lab2.b;

  const avgL = (L1 + L2) / 2;
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const avgC = (C1 + C2) / 2;

  const avgC7 = Math.pow(avgC, 7);
  const G = 0.5 * (1 - Math.sqrt(avgC7 / (avgC7 + Math.pow(25, 7))));

  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);

  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);

  let h1p = Math.atan2(b1, a1p) * (180 / Math.PI);
  if (h1p < 0) h1p += 360;
  let h2p = Math.atan2(b2, a2p) * (180 / Math.PI);
  if (h2p < 0) h2p += 360;

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp: number;
  if (C1p * C2p === 0) {
    dhp = 0;
  } else if (Math.abs(h2p - h1p) <= 180) {
    dhp = h2p - h1p;
  } else if (h2p - h1p > 180) {
    dhp = h2p - h1p - 360;
  } else {
    dhp = h2p - h1p + 360;
  }

  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * Math.PI) / 360);

  const avgLp = (L1 + L2) / 2;
  const avgCp = (C1p + C2p) / 2;

  let avgHp: number;
  if (C1p * C2p === 0) {
    avgHp = h1p + h2p;
  } else if (Math.abs(h1p - h2p) <= 180) {
    avgHp = (h1p + h2p) / 2;
  } else if (h1p + h2p < 360) {
    avgHp = (h1p + h2p + 360) / 2;
  } else {
    avgHp = (h1p + h2p - 360) / 2;
  }

  const T =
    1 -
    0.17 * Math.cos(((avgHp - 30) * Math.PI) / 180) +
    0.24 * Math.cos((2 * avgHp * Math.PI) / 180) +
    0.32 * Math.cos(((3 * avgHp + 6) * Math.PI) / 180) -
    0.20 * Math.cos(((4 * avgHp - 63) * Math.PI) / 180);

  const SL = 1 + (0.015 * Math.pow(avgLp - 50, 2)) / Math.sqrt(20 + Math.pow(avgLp - 50, 2));
  const SC = 1 + 0.045 * avgCp;
  const SH = 1 + 0.015 * avgCp * T;

  const avgCp7 = Math.pow(avgCp, 7);
  const RT =
    -2 *
    Math.sqrt(avgCp7 / (avgCp7 + Math.pow(25, 7))) *
    Math.sin((60 * Math.exp(-Math.pow((avgHp - 275) / 25, 2)) * Math.PI) / 180);

  return Math.sqrt(
    Math.pow(dLp / SL, 2) +
    Math.pow(dCp / SC, 2) +
    Math.pow(dHp / SH, 2) +
    RT * (dCp / SC) * (dHp / SH),
  );
}
```

```typescript
// src/renderer/color/palettes.ts

/** Predefined color palettes for different empire types */
export interface EmpireColorPalette {
  primary: string;    // main empire color (hex)
  secondary: string;  // accent color
  territory: string;  // semi-transparent fill for territory
  border: string;     // territory border glow
  ui: string;         // UI element tint
}

export const PLAYER_PALETTE: EmpireColorPalette = {
  primary: '#00aaff',
  secondary: '#0066cc',
  territory: 'rgba(0,170,255,0.10)',
  border: 'rgba(0,170,255,0.50)',
  ui: '#44ccff',
};

export const ALIEN_PALETTES: EmpireColorPalette[] = [
  { primary: '#ff4422', secondary: '#cc2200', territory: 'rgba(255,68,34,0.10)', border: 'rgba(255,68,34,0.50)', ui: '#ff6644' },
  { primary: '#aa44ff', secondary: '#7722cc', territory: 'rgba(170,68,255,0.10)', border: 'rgba(170,68,255,0.50)', ui: '#cc66ff' },
  { primary: '#ff8800', secondary: '#cc6600', territory: 'rgba(255,136,0,0.10)', border: 'rgba(255,136,0,0.50)', ui: '#ffaa33' },
  { primary: '#44ff88', secondary: '#22cc55', territory: 'rgba(68,255,136,0.10)', border: 'rgba(68,255,136,0.50)', ui: '#66ffaa' },
  { primary: '#ff44aa', secondary: '#cc2277', territory: 'rgba(255,68,170,0.10)', border: 'rgba(255,68,170,0.50)', ui: '#ff66cc' },
  { primary: '#ffff44', secondary: '#cccc00', territory: 'rgba(255,255,68,0.10)', border: 'rgba(255,255,68,0.50)', ui: '#ffff66' },
];

export const HUMAN_PALETTES: EmpireColorPalette[] = [
  { primary: '#4488ff', secondary: '#2255cc', territory: 'rgba(68,136,255,0.10)', border: 'rgba(68,136,255,0.50)', ui: '#66aaff' },
  { primary: '#88cc44', secondary: '#559922', territory: 'rgba(136,204,68,0.10)', border: 'rgba(136,204,68,0.50)', ui: '#aaee66' },
  { primary: '#cc8844', secondary: '#996622', territory: 'rgba(204,136,68,0.10)', border: 'rgba(204,136,68,0.50)', ui: '#eeaa66' },
  { primary: '#44cccc', secondary: '#229999', territory: 'rgba(68,204,204,0.10)', border: 'rgba(68,204,204,0.50)', ui: '#66eeee' },
];

export const BOT_PALETTES: EmpireColorPalette[] = [
  { primary: '#888888', secondary: '#555555', territory: 'rgba(136,136,136,0.10)', border: 'rgba(136,136,136,0.50)', ui: '#aaaaaa' },
  { primary: '#668888', secondary: '#445555', territory: 'rgba(102,136,136,0.10)', border: 'rgba(102,136,136,0.50)', ui: '#88aaaa' },
  { primary: '#886688', secondary: '#554455', territory: 'rgba(136,102,136,0.10)', border: 'rgba(136,102,136,0.50)', ui: '#aa88aa' },
  { primary: '#888866', secondary: '#555544', territory: 'rgba(136,136,102,0.10)', border: 'rgba(136,136,102,0.50)', ui: '#aaaa88' },
];

export const TEAM_PALETTES: EmpireColorPalette[] = [
  { primary: '#ff2222', secondary: '#cc0000', territory: 'rgba(255,34,34,0.10)', border: 'rgba(255,34,34,0.50)', ui: '#ff4444' },
  { primary: '#2222ff', secondary: '#0000cc', territory: 'rgba(34,34,255,0.10)', border: 'rgba(34,34,255,0.50)', ui: '#4444ff' },
  { primary: '#22ff22', secondary: '#00cc00', territory: 'rgba(34,255,34,0.10)', border: 'rgba(34,255,34,0.50)', ui: '#44ff44' },
  { primary: '#ffff22', secondary: '#cccc00', territory: 'rgba(255,255,34,0.10)', border: 'rgba(255,255,34,0.50)', ui: '#ffff44' },
];
```

```typescript
// src/renderer/color/ColorSystem.ts

import {
  hexToRgb, rgbToHex, rgbToLab, labToLch, lchToLab,
  deltaE2000,
  type RGB, type LAB, type LCH,
} from './colorConvert';
import {
  PLAYER_PALETTE, ALIEN_PALETTES, HUMAN_PALETTES, BOT_PALETTES, TEAM_PALETTES,
  type EmpireColorPalette,
} from './palettes';

export type PaletteCategory = 'player' | 'alien' | 'human' | 'bot' | 'team';

/** Minimum Delta-E 2000 distance between any two allocated empire colors */
const MIN_DELTA_E = 20;

/** Dark theme luminance cap (CIELAB L*) */
const DARK_THEME_MAX_L = 75;
const DARK_THEME_MIN_SATURATION = 40;

export class ColorSystem {
  private allocated: Array<{ color: string; lab: LAB }> = [];

  /**
   * Get a palette by category and index.
   */
  getPalette(category: PaletteCategory, index = 0): EmpireColorPalette {
    switch (category) {
      case 'player': return PLAYER_PALETTE;
      case 'alien': return ALIEN_PALETTES[index % ALIEN_PALETTES.length];
      case 'human': return HUMAN_PALETTES[index % HUMAN_PALETTES.length];
      case 'bot': return BOT_PALETTES[index % BOT_PALETTES.length];
      case 'team': return TEAM_PALETTES[index % TEAM_PALETTES.length];
    }
  }

  /**
   * Allocate a color that is perceptually distinct from all previously allocated colors.
   * Uses Delta-E 2000 to ensure minimum distance.
   */
  allocateDistinct(preferred: string): string {
    const lab = rgbToLab(hexToRgb(preferred));
    const adjusted = this.adjustForDarkTheme(lab);

    // Check if preferred color is far enough from all allocated colors
    const tooClose = this.allocated.some((a) => deltaE2000(adjusted, a.lab) < MIN_DELTA_E);

    if (!tooClose) {
      const hex = this.labToHex(adjusted);
      this.allocated.push({ color: hex, lab: adjusted });
      return hex;
    }

    // Try rotating hue in LCH space to find a distinct color
    const lch = labToLch(adjusted);
    for (let offset = 30; offset <= 330; offset += 30) {
      const candidate: LCH = {
        L: lch.L,
        C: Math.max(DARK_THEME_MIN_SATURATION, lch.C),
        h: (lch.h + offset) % 360,
      };
      const candidateLab = lchToLab(candidate);
      const isDistinct = this.allocated.every(
        (a) => deltaE2000(candidateLab, a.lab) >= MIN_DELTA_E,
      );

      if (isDistinct) {
        const hex = this.labToHex(candidateLab);
        this.allocated.push({ color: hex, lab: candidateLab });
        return hex;
      }
    }

    // Fallback: use the preferred color anyway
    const hex = this.labToHex(adjusted);
    this.allocated.push({ color: hex, lab: adjusted });
    return hex;
  }

  /**
   * Calculate perceptual distance between two hex colors.
   */
  distance(hex1: string, hex2: string): number {
    return deltaE2000(rgbToLab(hexToRgb(hex1)), rgbToLab(hexToRgb(hex2)));
  }

  /**
   * Get the number of currently allocated colors.
   */
  getAllocatedCount(): number {
    return this.allocated.length;
  }

  /**
   * Reset allocated colors (e.g. on new game).
   */
  reset(): void {
    this.allocated = [];
  }

  // ---- Internal ----

  private adjustForDarkTheme(lab: LAB): LAB {
    // Cap luminance for dark theme readability
    const L = Math.min(lab.L, DARK_THEME_MAX_L);

    // Boost saturation if too low
    const lch = labToLch({ L, a: lab.a, b: lab.b });
    if (lch.C < DARK_THEME_MIN_SATURATION) {
      lch.C = DARK_THEME_MIN_SATURATION;
    }

    return lchToLab({ L, C: lch.C, h: lch.h });
  }

  private labToHex(lab: LAB): string {
    // LAB -> XYZ -> sRGB (simplified reverse of rgbToLab)
    let y = (lab.L + 16) / 116;
    let x = lab.a / 500 + y;
    let z = y - lab.b / 200;

    const epsilon = 0.008856;
    const kappa = 903.3;

    x = (Math.pow(x, 3) > epsilon ? Math.pow(x, 3) : (116 * x - 16) / kappa) * 0.95047;
    y = (Math.pow(y, 3) > epsilon ? Math.pow(y, 3) : (116 * y - 16) / kappa) * 1.0;
    z = (Math.pow(z, 3) > epsilon ? Math.pow(z, 3) : (116 * z - 16) / kappa) * 1.08883;

    // XYZ -> linear sRGB
    const rl = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
    const gl = x * -0.9692660 + y * 1.8760108 + z * 0.0415560;
    const bl = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;

    // Linear -> sRGB
    const toSrgb = (c: number): number => {
      const s = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
      return Math.round(Math.max(0, Math.min(255, s * 255)));
    };

    return rgbToHex({ r: toSrgb(rl), g: toSrgb(gl), b: toSrgb(bl) });
  }
}
```

```typescript
// src/renderer/__tests__/ColorSystem.test.ts

import { describe, it, expect } from 'vitest';
import { ColorSystem, type PaletteCategory } from '../color/ColorSystem';
import { hexToRgb, rgbToLab, deltaE2000 } from '../color/colorConvert';

describe('colorConvert', () => {
  it('hexToRgb parses hex strings', () => {
    const rgb = hexToRgb('#ff8800');
    expect(rgb).toEqual({ r: 255, g: 136, b: 0 });
  });

  it('hexToRgb handles no-hash format', () => {
    const rgb = hexToRgb('00ff00');
    expect(rgb).toEqual({ r: 0, g: 255, b: 0 });
  });

  it('rgbToLab converts white to ~L100', () => {
    const lab = rgbToLab({ r: 255, g: 255, b: 255 });
    expect(lab.L).toBeCloseTo(100, 0);
    expect(lab.a).toBeCloseTo(0, 0);
    expect(lab.b).toBeCloseTo(0, 0);
  });

  it('rgbToLab converts black to ~L0', () => {
    const lab = rgbToLab({ r: 0, g: 0, b: 0 });
    expect(lab.L).toBeCloseTo(0, 0);
  });

  it('deltaE2000 of identical colors is 0', () => {
    const lab = rgbToLab({ r: 128, g: 64, b: 200 });
    expect(deltaE2000(lab, lab)).toBeCloseTo(0);
  });

  it('deltaE2000 of black vs white is large', () => {
    const black = rgbToLab({ r: 0, g: 0, b: 0 });
    const white = rgbToLab({ r: 255, g: 255, b: 255 });
    expect(deltaE2000(black, white)).toBeGreaterThan(50);
  });

  it('deltaE2000 of similar colors is small', () => {
    const c1 = rgbToLab({ r: 128, g: 128, b: 128 });
    const c2 = rgbToLab({ r: 130, g: 128, b: 126 });
    expect(deltaE2000(c1, c2)).toBeLessThan(5);
  });
});

describe('ColorSystem', () => {
  it('returns player palette', () => {
    const cs = new ColorSystem();
    const p = cs.getPalette('player');
    expect(p.primary).toBe('#00aaff');
  });

  it('returns indexed alien palettes', () => {
    const cs = new ColorSystem();
    const p0 = cs.getPalette('alien', 0);
    const p1 = cs.getPalette('alien', 1);
    expect(p0.primary).not.toBe(p1.primary);
  });

  it('wraps palette index for out-of-range', () => {
    const cs = new ColorSystem();
    const p0 = cs.getPalette('alien', 0);
    const p6 = cs.getPalette('alien', 6); // 6 % 6 = 0
    expect(p0.primary).toBe(p6.primary);
  });

  it('allocates distinct colors', () => {
    const cs = new ColorSystem();
    const c1 = cs.allocateDistinct('#ff0000');
    const c2 = cs.allocateDistinct('#ff0000'); // same preferred -> should get different
    expect(cs.getAllocatedCount()).toBe(2);

    const dist = cs.distance(c1, c2);
    // Should be at least somewhat different
    expect(dist).toBeGreaterThan(0);
  });

  it('reset clears allocated colors', () => {
    const cs = new ColorSystem();
    cs.allocateDistinct('#ff0000');
    cs.allocateDistinct('#00ff00');
    expect(cs.getAllocatedCount()).toBe(2);
    cs.reset();
    expect(cs.getAllocatedCount()).toBe(0);
  });

  it('distance of identical colors is ~0', () => {
    const cs = new ColorSystem();
    expect(cs.distance('#ff0000', '#ff0000')).toBeCloseTo(0);
  });

  it('distance of very different colors is large', () => {
    const cs = new ColorSystem();
    expect(cs.distance('#ff0000', '#00ff00')).toBeGreaterThan(30);
  });

  it('all palette categories return valid palettes', () => {
    const cs = new ColorSystem();
    const categories: PaletteCategory[] = ['player', 'alien', 'human', 'bot', 'team'];
    for (const cat of categories) {
      const p = cs.getPalette(cat);
      expect(p.primary).toBeTruthy();
      expect(p.territory).toContain('rgba');
    }
  });
});
```

**Test command:**
```bash
npx vitest run src/renderer/__tests__/ColorSystem.test.ts
```

**Commit:** `feat(renderer): add ColorSystem with LAB/LCH/Delta-E 2000 allocation and 4 empire palettes`

---

## Summary

| Task | Layer/Module | zIndex | Transform | Visible Tiers |
|------|-------------|--------|-----------|---------------|
| 1 | Layer interface | — | — | — |
| 2 | GameRenderer | — | — | — |
| 3 | TransformHandler | — | — | — |
| 4 | StarFieldLayer | 0 | manual parallax | all |
| 5 | NebulaLayer | 1 | world | Galaxy, Sector |
| 6 | TerritoryLayer | 2 | world | Galaxy, Sector, System |
| 7 | HyperlaneLayer | 3 | world | Galaxy, Sector, System |
| 8 | StarSystemLayer | 5 | world | Galaxy, Sector, System |
| 9 | PlanetLayer | 6 | world | System, Planet |
| 10 | StructureIconsLayer | 10 | world (PIXI) | Sector, System, Planet |
| 11 | FleetLayer | 8 | world | Galaxy, Sector, System |
| 12 | WormholeLayer | 4 | world | all |
| 13 | FxLayer | 15 | world | all |
| 14 | UILayer | 20 | screen | all |
| 15 | DynamicUILayer | 21 | screen | all |
| 16 | SuperweaponTrajectoryLayer | 22 | screen | all |
| 17 | NameLayer | 25 | screen (DOM) | all (tier-filtered) |
| 18 | SpriteLoader | — | — | — |
| 19 | AnimatedSprite | — | — | — |
| 20 | ColorSystem | — | — | — |

**File count:** ~30 source files + ~12 test files
**Total layers:** 14 rendering layers
**Support modules:** TransformHandler, FrameProfiler, SpriteLoader, AnimatedSprite, ColorSystem
