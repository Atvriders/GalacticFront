/**
 * 2D point.
 */
export interface Point2D {
  x: number;
  y: number;
}

/**
 * Configuration for parabolic trajectory generation.
 */
export interface ParabolaConfig {
  /** Height factor of the arc (0..1+). Default 0.5. */
  height?: number;
  /** Direction of the bulge: 1 = left/up, -1 = right/down. Default 1. */
  direction?: number;
  /** Number of interpolation steps. Default 20. */
  steps?: number;
}

/**
 * Generate a quadratic Bezier parabolic trajectory between two points.
 * Used for superweapon projectile arcs.
 *
 * The control point is placed perpendicular to the midpoint of start-end,
 * offset by height * distance * direction.
 */
export function parabolaPath(
  start: Point2D,
  end: Point2D,
  config: ParabolaConfig = {}
): Point2D[] {
  const height = config.height ?? 0.5;
  const direction = config.direction ?? 1;
  const steps = config.steps ?? 20;

  // Midpoint
  const mx = (start.x + end.x) / 2;
  const my = (start.y + end.y) / 2;

  // Direction vector from start to end
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Perpendicular direction (normalized), rotated 90 degrees
  const perpX = dist > 0 ? (-dy / dist) * direction : 0;
  const perpY = dist > 0 ? (dx / dist) * direction : 0;

  // Control point
  const offset = height * dist;
  const cx = mx + perpX * offset;
  const cy = my + perpY * offset;

  // Generate points along the quadratic Bezier curve
  const points: Point2D[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const invT = 1 - t;
    const x = invT * invT * start.x + 2 * invT * t * cx + t * t * end.x;
    const y = invT * invT * start.y + 2 * invT * t * cy + t * t * end.y;
    points.push({ x, y });
  }

  return points;
}

/**
 * Calculate the approximate arc length of a polyline.
 */
export function parabolaLength(points: Point2D[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length;
}
