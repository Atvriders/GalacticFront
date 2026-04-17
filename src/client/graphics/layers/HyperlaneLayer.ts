import type { Layer } from "../Layer.js";

/** A connection between two star systems. */
export interface Hyperlane {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** Owner player ID, or null for neutral. */
  ownerID: number | null;
  /** True if there is active trade/traffic on this lane. */
  active: boolean;
}

export interface HyperlaneDataSource {
  getHyperlanes(): Hyperlane[];
  getPlayerColor(playerID: number): string;
}

const NEUTRAL_COLOR = "#333344";

/**
 * Draws hyperlane connections between star systems.
 * Active trade routes pulse with animation.
 */
export class HyperlaneLayer implements Layer {
  private _data: HyperlaneDataSource;
  private _animPhase = 0;

  constructor(data: HyperlaneDataSource) {
    this._data = data;
  }

  shouldTransform(): boolean {
    return true;
  }

  getTickIntervalMs(): number {
    return 10;
  }

  tick(): void {
    this._animPhase = (this._animPhase + 0.03) % (Math.PI * 2);
  }

  renderLayer(ctx: CanvasRenderingContext2D): void {
    const lanes = this._data.getHyperlanes();

    for (const lane of lanes) {
      const color =
        lane.ownerID !== null
          ? this._data.getPlayerColor(lane.ownerID)
          : NEUTRAL_COLOR;

      if (lane.active) {
        // Pulsing active lane
        const alpha = 0.5 + 0.4 * Math.sin(this._animPhase);
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
      } else {
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 1;
        ctx.strokeStyle = color;
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
      }

      ctx.beginPath();
      ctx.moveTo(lane.fromX, lane.fromY);
      ctx.lineTo(lane.toX, lane.toY);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
  }
}
