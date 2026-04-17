import type { Layer } from "./Layer.js";
import type { TransformHandler } from "./TransformHandler.js";

/**
 * Tracks frames-per-second over a rolling window.
 */
export class FrameProfiler {
  private _timestamps: number[] = [];
  private _fps = 0;

  /** Call once per frame with the current timestamp. */
  recordFrame(now: number): void {
    this._timestamps.push(now);
    // Keep only the last second of timestamps
    const cutoff = now - 1000;
    while (this._timestamps.length > 0 && this._timestamps[0]! < cutoff) {
      this._timestamps.shift();
    }
    this._fps = this._timestamps.length;
  }

  get fps(): number {
    return this._fps;
  }
}

interface LayerEntry {
  layer: Layer;
  zIndex: number;
  lastTickTime: number;
}

/**
 * Main rendering loop. Manages an ordered array of Layer instances,
 * drives requestAnimationFrame, and delegates camera transforms.
 */
export class GameRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly profiler = new FrameProfiler();

  private _width: number;
  private _height: number;
  private _layers: LayerEntry[] = [];
  private _running = false;
  private _rafId = 0;
  private _transform: TransformHandler | null = null;

  constructor(canvas: HTMLCanvasElement, width: number, height: number) {
    this.canvas = canvas;
    this._width = width;
    this._height = height;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get 2d context");
    this.ctx = ctx;
  }

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  /** Attach a TransformHandler for camera pan/zoom. */
  setTransform(transform: TransformHandler): void {
    this._transform = transform;
  }

  /** Add a layer at the given z-index (lower = drawn first / behind). */
  addLayer(layer: Layer, zIndex: number): void {
    this._layers.push({ layer, zIndex, lastTickTime: 0 });
    this._layers.sort((a, b) => a.zIndex - b.zIndex);
    layer.init?.();
  }

  /** Remove a previously added layer. */
  removeLayer(layer: Layer): void {
    const idx = this._layers.findIndex((e) => e.layer === layer);
    if (idx !== -1) {
      this._layers[idx]!.layer.dispose?.();
      this._layers.splice(idx, 1);
    }
  }

  /** Start the render loop. */
  start(): void {
    if (this._running) return;
    this._running = true;
    this._rafId = requestAnimationFrame((t) => this._loop(t));
  }

  /** Stop the render loop. */
  stop(): void {
    this._running = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = 0;
    }
  }

  // ── Private ──────────────────────────────────────────────────────────

  private _loop(now: number): void {
    if (!this._running) return;

    this.profiler.recordFrame(now);
    this._tickLayers(now);
    this._renderFrame();

    this._rafId = requestAnimationFrame((t) => this._loop(t));
  }

  private _tickLayers(now: number): void {
    for (const entry of this._layers) {
      const { layer } = entry;
      if (!layer.tick) continue;
      const interval = layer.getTickIntervalMs?.() ?? 0;
      if (interval <= 0) {
        layer.tick(now - entry.lastTickTime || 16);
        entry.lastTickTime = now;
      } else if (now - entry.lastTickTime >= interval) {
        layer.tick(now - entry.lastTickTime);
        entry.lastTickTime = now;
      }
    }
  }

  private _renderFrame(): void {
    const { ctx } = this;
    const w = this._width;
    const h = this._height;

    // Clear entire canvas
    ctx.clearRect(0, 0, w, h);

    // Render layers grouped by transform requirement
    for (const entry of this._layers) {
      const { layer } = entry;
      if (!layer.renderLayer) continue;

      const needsTransform = layer.shouldTransform?.() ?? false;

      ctx.save();
      if (needsTransform && this._transform) {
        this._transform.applyTransform(ctx);
      }
      layer.renderLayer(ctx);
      ctx.restore();
    }
  }
}
