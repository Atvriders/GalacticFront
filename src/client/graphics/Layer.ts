/**
 * Layer interface for the rendering pipeline.
 *
 * Each layer represents one visual concern (stars, territory, UI, etc.)
 * and is composited by GameRenderer in z-index order.
 */
export interface Layer {
  /** One-time setup, called when the layer is added to the renderer. */
  init?(): void;

  /**
   * Called at a throttled rate determined by getTickIntervalMs().
   * Use for simulation-driven updates (animation state, data polling).
   */
  tick?(dt: number): void;

  /**
   * Minimum milliseconds between tick() calls.
   * Return 0 or omit for every-frame ticking.
   */
  getTickIntervalMs?(): number;

  /**
   * Render this layer onto the shared canvas context.
   * Called every animation frame.
   */
  renderLayer?(ctx: CanvasRenderingContext2D): void;

  /**
   * If true, the renderer applies the camera transform (pan/zoom)
   * before calling renderLayer. If false, the layer draws in
   * screen-space coordinates.
   */
  shouldTransform?(): boolean;

  /**
   * Force a full redraw on the next frame (e.g. after resize).
   */
  redraw?(): void;

  /**
   * Cleanup resources when the layer is removed from the renderer.
   */
  dispose?(): void;
}
