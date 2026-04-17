import type { Layer } from "../Layer.js";

export interface SelectableUnit {
  x: number;
  y: number;
  width: number;
  height: number;
  selected: boolean;
  health: number; // 0-1
  maxHealth: number;
  /** Construction progress 0-1, or null if complete. */
  constructionProgress: number | null;
  ownerColor: string;
}

export interface UIDataSource {
  getSelectableUnits(): SelectableUnit[];
}

const HEALTH_BAR_HEIGHT = 3;
const HEALTH_BAR_OFFSET = 4;
const CONSTRUCTION_BAR_HEIGHT = 3;
const SELECTION_PADDING = 3;

/**
 * Draws selection boxes, health bars, and construction progress bars
 * over selected/visible units in world space.
 */
export class UILayer implements Layer {
  private _data: UIDataSource;
  private _animPhase = 0;

  constructor(data: UIDataSource) {
    this._data = data;
  }

  shouldTransform(): boolean {
    return true;
  }

  getTickIntervalMs(): number {
    return 16;
  }

  tick(): void {
    this._animPhase = (this._animPhase + 0.05) % (Math.PI * 2);
  }

  renderLayer(ctx: CanvasRenderingContext2D): void {
    const units = this._data.getSelectableUnits();

    for (const unit of units) {
      // Selection box
      if (unit.selected) {
        const pad = SELECTION_PADDING;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(
          unit.x - pad,
          unit.y - pad,
          unit.width + pad * 2,
          unit.height + pad * 2,
        );
        ctx.setLineDash([]);
      }

      // Health bar (above unit)
      if (unit.maxHealth > 0) {
        const barWidth = unit.width;
        const barX = unit.x;
        const barY = unit.y - HEALTH_BAR_OFFSET - HEALTH_BAR_HEIGHT;
        const ratio = Math.max(0, Math.min(1, unit.health / unit.maxHealth));

        // Background
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = "#222222";
        ctx.fillRect(barX, barY, barWidth, HEALTH_BAR_HEIGHT);

        // Fill
        ctx.globalAlpha = 0.9;
        const healthColor =
          ratio > 0.6 ? "#44cc44" : ratio > 0.3 ? "#ccaa22" : "#cc3333";
        ctx.fillStyle = healthColor;
        ctx.fillRect(barX, barY, barWidth * ratio, HEALTH_BAR_HEIGHT);
      }

      // Construction progress bar (below unit)
      if (unit.constructionProgress !== null) {
        const barWidth = unit.width;
        const barX = unit.x;
        const barY = unit.y + unit.height + 2;
        const progress = Math.max(0, Math.min(1, unit.constructionProgress));

        // Pulsating alpha
        const pulse = 0.6 + 0.3 * Math.sin(this._animPhase);

        // Background
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = "#222222";
        ctx.fillRect(barX, barY, barWidth, CONSTRUCTION_BAR_HEIGHT);

        // Progress fill
        ctx.globalAlpha = pulse;
        ctx.fillStyle = unit.ownerColor;
        ctx.fillRect(barX, barY, barWidth * progress, CONSTRUCTION_BAR_HEIGHT);
      }
    }

    ctx.globalAlpha = 1;
  }
}
