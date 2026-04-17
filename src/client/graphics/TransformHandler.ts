/**
 * Camera system: zoom, pan, smooth follow, and coordinate conversion.
 */
export class TransformHandler {
  /** Current zoom level. */
  zoom = 1;

  /** Camera offset in world-space pixels. */
  offsetX = 0;
  offsetY = 0;

  /** Canvas dimensions (screen-space). */
  private _canvasWidth: number;
  private _canvasHeight: number;

  /** Zoom limits. */
  private readonly _minZoom = 0.2;
  private readonly _maxZoom = 20;

  /** Smooth follow target (world coords) and lerp factor. */
  private _targetX: number | null = null;
  private _targetY: number | null = null;
  private readonly _lerpFactor = 0.03;

  /** Optional world bounds for pan clamping. */
  private _worldWidth = Infinity;
  private _worldHeight = Infinity;

  constructor(canvasWidth: number, canvasHeight: number) {
    this._canvasWidth = canvasWidth;
    this._canvasHeight = canvasHeight;
  }

  /** Update canvas dimensions (e.g. on resize). */
  setCanvasSize(width: number, height: number): void {
    this._canvasWidth = width;
    this._canvasHeight = height;
  }

  /** Set world bounds for offset clamping. */
  setWorldBounds(width: number, height: number): void {
    this._worldWidth = width;
    this._worldHeight = height;
  }

  // ── Zoom ────────────────────────────────────────────────────────────

  /**
   * Zoom toward/away from a point on the canvas.
   * @param delta Positive = zoom in, negative = zoom out.
   * @param canvasX Point on canvas to zoom toward.
   * @param canvasY Point on canvas to zoom toward.
   */
  zoomToPoint(delta: number, canvasX: number, canvasY: number): void {
    const oldZoom = this.zoom;
    this.zoom = clamp(this.zoom * (1 + delta), this._minZoom, this._maxZoom);
    const ratio = this.zoom / oldZoom;

    // Adjust offset so the world point under the cursor stays fixed
    this.offsetX = canvasX - (canvasX - this.offsetX) * ratio;
    this.offsetY = canvasY - (canvasY - this.offsetY) * ratio;
    this._clampOffset();
  }

  // ── Pan ─────────────────────────────────────────────────────────────

  /** Pan by screen-space pixel deltas. */
  pan(dx: number, dy: number): void {
    this.offsetX += dx;
    this.offsetY += dy;
    this._clampOffset();
  }

  // ── Smooth follow ───────────────────────────────────────────────────

  /**
   * Begin smoothly centering the camera on the given world coordinate.
   * Call update() each frame to advance.
   */
  goTo(worldX: number, worldY: number): void {
    this._targetX = worldX;
    this._targetY = worldY;
  }

  /** Cancel any active smooth follow. */
  cancelFollow(): void {
    this._targetX = null;
    this._targetY = null;
  }

  /** Advance smooth follow by one step. Call once per frame. */
  update(): void {
    if (this._targetX === null || this._targetY === null) return;

    // Target offset to center the world point on screen
    const targetOffsetX =
      this._canvasWidth / 2 - this._targetX * this.zoom;
    const targetOffsetY =
      this._canvasHeight / 2 - this._targetY * this.zoom;

    this.offsetX += (targetOffsetX - this.offsetX) * this._lerpFactor;
    this.offsetY += (targetOffsetY - this.offsetY) * this._lerpFactor;

    // Stop once close enough
    const dx = Math.abs(targetOffsetX - this.offsetX);
    const dy = Math.abs(targetOffsetY - this.offsetY);
    if (dx < 0.5 && dy < 0.5) {
      this.offsetX = targetOffsetX;
      this.offsetY = targetOffsetY;
      this._targetX = null;
      this._targetY = null;
    }

    this._clampOffset();
  }

  // ── Coordinate conversion ───────────────────────────────────────────

  /** Convert world coordinates to canvas (pixel) coordinates. */
  worldToCanvas(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: worldX * this.zoom + this.offsetX,
      y: worldY * this.zoom + this.offsetY,
    };
  }

  /** Convert canvas coordinates to world coordinates. */
  canvasToWorld(
    canvasX: number,
    canvasY: number,
  ): { x: number; y: number } {
    return {
      x: (canvasX - this.offsetX) / this.zoom,
      y: (canvasY - this.offsetY) / this.zoom,
    };
  }

  /**
   * Convert screen (page) coordinates to world coordinates.
   * Accounts for the canvas element's position on the page.
   */
  screenToWorld(
    screenX: number,
    screenY: number,
    canvasRect?: DOMRect,
  ): { x: number; y: number } {
    const rect = canvasRect ?? { left: 0, top: 0 };
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;
    return this.canvasToWorld(canvasX, canvasY);
  }

  // ── Context helpers ─────────────────────────────────────────────────

  /** Apply the camera transform to a canvas 2d context. */
  applyTransform(ctx: CanvasRenderingContext2D): void {
    ctx.setTransform(this.zoom, 0, 0, this.zoom, this.offsetX, this.offsetY);
  }

  /** Reset the context to the identity transform. */
  resetTransform(ctx: CanvasRenderingContext2D): void {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ── Internal ────────────────────────────────────────────────────────

  private _clampOffset(): void {
    if (this._worldWidth !== Infinity) {
      const maxOffsetX = 0;
      const minOffsetX =
        this._canvasWidth - this._worldWidth * this.zoom;
      this.offsetX = clamp(this.offsetX, minOffsetX, maxOffsetX);
    }
    if (this._worldHeight !== Infinity) {
      const maxOffsetY = 0;
      const minOffsetY =
        this._canvasHeight - this._worldHeight * this.zoom;
      this.offsetY = clamp(this.offsetY, minOffsetY, maxOffsetY);
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
