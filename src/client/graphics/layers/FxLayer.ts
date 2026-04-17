import type { Layer } from "../Layer.js";

// ── Effect types ──────────────────────────────────────────────────────

interface BaseEffect {
  x: number;
  y: number;
  startTime: number;
  duration: number;
}

export interface NovaDetonation extends BaseEffect {
  kind: "nova";
  /** Max ring radius in world pixels. */
  maxRadius: number;
  color: string;
}

export interface CollapseImplosion extends BaseEffect {
  kind: "collapse";
  maxRadius: number;
  color: string;
}

export interface ShipExplosion extends BaseEffect {
  kind: "shipExplosion";
  maxRadius: number;
  color: string;
}

export type VisualEffect = NovaDetonation | CollapseImplosion | ShipExplosion;

/**
 * Renders transient visual effects (explosions, shockwaves).
 * Uses an internal offscreen canvas for compositing, throttled at 10ms.
 */
export class FxLayer implements Layer {
  private _effects: VisualEffect[] = [];
  private _now = 0;
  private _offscreen: OffscreenCanvas | null = null;
  private _offCtx: OffscreenCanvasRenderingContext2D | null = null;
  private _width: number;
  private _height: number;

  constructor(width: number, height: number) {
    this._width = width;
    this._height = height;
    if (typeof OffscreenCanvas !== "undefined") {
      this._offscreen = new OffscreenCanvas(width, height);
      this._offCtx = this._offscreen.getContext("2d");
    }
  }

  shouldTransform(): boolean {
    return true;
  }

  getTickIntervalMs(): number {
    return 10;
  }

  tick(dt: number): void {
    this._now += dt;
    // Remove expired effects
    this._effects = this._effects.filter(
      (e) => this._now - e.startTime < e.duration,
    );
  }

  /** Queue a new visual effect. */
  addEffect(effect: VisualEffect): void {
    this._effects.push(effect);
  }

  renderLayer(ctx: CanvasRenderingContext2D): void {
    if (this._effects.length === 0) return;

    // Use offscreen canvas if available, otherwise draw directly
    const drawCtx = this._offCtx ?? ctx;
    const useOffscreen = this._offCtx !== null && this._offscreen !== null;

    if (useOffscreen) {
      drawCtx.clearRect(0, 0, this._width, this._height);
    }

    for (const effect of this._effects) {
      const elapsed = this._now - effect.startTime;
      const t = Math.max(0, Math.min(1, elapsed / effect.duration));

      switch (effect.kind) {
        case "nova":
          this._renderNova(drawCtx as CanvasRenderingContext2D, effect, t);
          break;
        case "collapse":
          this._renderCollapse(drawCtx as CanvasRenderingContext2D, effect, t);
          break;
        case "shipExplosion":
          this._renderShipExplosion(drawCtx as CanvasRenderingContext2D, effect, t);
          break;
      }
    }

    if (useOffscreen && this._offscreen) {
      ctx.drawImage(this._offscreen, 0, 0);
    }
  }

  dispose(): void {
    this._effects = [];
    this._offscreen = null;
    this._offCtx = null;
  }

  // ── Effect renderers ────────────────────────────────────────────────

  private _renderNova(
    ctx: CanvasRenderingContext2D,
    effect: NovaDetonation,
    t: number,
  ): void {
    const radius = effect.maxRadius * t;
    const alpha = 1 - t;

    ctx.globalAlpha = alpha * 0.8;
    ctx.strokeStyle = effect.color;
    ctx.lineWidth = 3 + (1 - t) * 4;
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Inner glow
    ctx.globalAlpha = alpha * 0.3;
    ctx.fillStyle = effect.color;
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, radius * 0.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
  }

  private _renderCollapse(
    ctx: CanvasRenderingContext2D,
    effect: CollapseImplosion,
    t: number,
  ): void {
    let radius: number;
    let alpha: number;

    if (t < 0.5) {
      // Inward phase
      const inT = t / 0.5;
      radius = effect.maxRadius * (1 - inT);
      alpha = 0.5 + inT * 0.5;
    } else {
      // Outward shockwave
      const outT = (t - 0.5) / 0.5;
      radius = effect.maxRadius * outT * 1.5;
      alpha = 1 - outT;
    }

    ctx.globalAlpha = alpha * 0.7;
    ctx.strokeStyle = effect.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, Math.max(1, radius), 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 1;
  }

  private _renderShipExplosion(
    ctx: CanvasRenderingContext2D,
    effect: ShipExplosion,
    t: number,
  ): void {
    const radius = effect.maxRadius * t;
    const alpha = (1 - t) * 0.9;

    // Fireball
    ctx.globalAlpha = alpha;
    ctx.fillStyle = effect.color;
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
    ctx.fill();

    // Debris sparks
    ctx.globalAlpha = alpha * 0.6;
    ctx.fillStyle = "#ffcc00";
    const sparkCount = 6;
    for (let i = 0; i < sparkCount; i++) {
      const angle = (i / sparkCount) * Math.PI * 2;
      const dist = radius * 1.2;
      const sx = effect.x + Math.cos(angle) * dist;
      const sy = effect.y + Math.sin(angle) * dist;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }
}
