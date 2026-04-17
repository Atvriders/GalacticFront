import type { Layer } from "../Layer.js";

interface Star {
  x: number;
  y: number;
  brightness: number; // 0-1
  size: number; // radius in pixels
  /** Parallax depth factor: 0 = fixed, 1 = moves with camera. */
  depth: number;
}

const BG_COLOR = "#0a0a12";
const STAR_COUNT = 3000;

/**
 * Renders a dense star field as the background layer.
 * Stars at different parallax depths create a sense of scale.
 */
export class StarFieldLayer implements Layer {
  private _stars: Star[] = [];
  private _worldWidth: number;
  private _worldHeight: number;

  constructor(worldWidth: number, worldHeight: number) {
    this._worldWidth = worldWidth;
    this._worldHeight = worldHeight;
    this._generateStars();
  }

  shouldTransform(): boolean {
    return true;
  }

  renderLayer(ctx: CanvasRenderingContext2D): void {
    // Fill deep black background across visible area
    // We use a large rect since we are in world-transformed space
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(
      -this._worldWidth,
      -this._worldHeight,
      this._worldWidth * 3,
      this._worldHeight * 3,
    );

    for (const star of this._stars) {
      const alpha = 0.3 + star.brightness * 0.7;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  dispose(): void {
    this._stars = [];
  }

  // ── Internal ────────────────────────────────────────────────────────

  private _generateStars(): void {
    this._stars = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      this._stars.push({
        x: Math.random() * this._worldWidth,
        y: Math.random() * this._worldHeight,
        brightness: Math.random(),
        size: 0.3 + Math.random() * 1.2,
        depth: 0.1 + Math.random() * 0.9,
      });
    }
  }
}
