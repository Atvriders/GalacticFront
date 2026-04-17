import type { Layer } from "../Layer.js";

export interface Waypoint {
  x: number;
  y: number;
}

export interface Fleet {
  id: string;
  ownerID: number;
  /** Ordered waypoints the fleet is traveling through. */
  waypoints: Waypoint[];
  /** Current progress along the path, 0-1 for each segment. */
  segmentIndex: number;
  segmentProgress: number;
  /** Speed in world units per tick. */
  speed: number;
}

export interface FleetDataSource {
  getFleets(): Fleet[];
  getPlayerColor(playerID: number): string;
}

const TRAIL_LENGTH = 8;
const FLEET_RADIUS = 4;

/**
 * Renders moving fleet sprites along hyperlanes with trail effects.
 * Interpolates between motion plan waypoints each tick.
 */
export class FleetLayer implements Layer {
  private _data: FleetDataSource;
  /** Trail history per fleet: array of recent positions. */
  private _trails = new Map<string, Waypoint[]>();

  constructor(data: FleetDataSource) {
    this._data = data;
  }

  shouldTransform(): boolean {
    return true;
  }

  getTickIntervalMs(): number {
    return 10;
  }

  tick(): void {
    const fleets = this._data.getFleets();
    const activeIds = new Set<string>();

    for (const fleet of fleets) {
      activeIds.add(fleet.id);
      const pos = this._interpolatePosition(fleet);
      let trail = this._trails.get(fleet.id);
      if (!trail) {
        trail = [];
        this._trails.set(fleet.id, trail);
      }
      trail.push({ x: pos.x, y: pos.y });
      if (trail.length > TRAIL_LENGTH) {
        trail.shift();
      }
    }

    // Clean up trails for removed fleets
    for (const id of this._trails.keys()) {
      if (!activeIds.has(id)) this._trails.delete(id);
    }
  }

  renderLayer(ctx: CanvasRenderingContext2D): void {
    const fleets = this._data.getFleets();

    for (const fleet of fleets) {
      const color = this._data.getPlayerColor(fleet.ownerID);
      const pos = this._interpolatePosition(fleet);

      // Trail
      const trail = this._trails.get(fleet.id);
      if (trail && trail.length > 1) {
        for (let i = 0; i < trail.length - 1; i++) {
          const alpha = (i + 1) / trail.length * 0.4;
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(trail[i]!.x, trail[i]!.y);
          ctx.lineTo(trail[i + 1]!.x, trail[i + 1]!.y);
          ctx.stroke();
        }
      }

      // Fleet icon (triangle pointing in direction of travel)
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, FLEET_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // Bright core
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, FLEET_RADIUS * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  dispose(): void {
    this._trails.clear();
  }

  private _interpolatePosition(fleet: Fleet): Waypoint {
    const { waypoints, segmentIndex, segmentProgress } = fleet;
    if (waypoints.length === 0) return { x: 0, y: 0 };
    if (waypoints.length === 1 || segmentIndex >= waypoints.length - 1) {
      return waypoints[waypoints.length - 1]!;
    }
    const from = waypoints[segmentIndex]!;
    const to = waypoints[segmentIndex + 1]!;
    const t = Math.max(0, Math.min(1, segmentProgress));
    return {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
    };
  }
}
