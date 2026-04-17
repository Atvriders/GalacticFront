import type { Layer } from "../Layer.js";

/** Spectral classification for star rendering. */
export type SpectralType = "O" | "B" | "A" | "F" | "G" | "K" | "M";

export interface StarSystem {
  x: number;
  y: number;
  name: string;
  spectralType: SpectralType;
  /** Base visual radius in world pixels. */
  baseRadius: number;
}

export interface StarSystemDataSource {
  getStarSystems(): StarSystem[];
  getZoom(): number;
}

/** Color by spectral type. */
const SPECTRAL_COLORS: Record<SpectralType, string> = {
  O: "#99bbff",
  B: "#aaccff",
  A: "#cce0ff",
  F: "#fff4e0",
  G: "#ffdd44",
  K: "#ffaa33",
  M: "#ff6622",
};

const LABEL_ZOOM_MIN = 0.8;
const LABEL_ZOOM_MAX = 8;

/**
 * Renders star system icons with colored glow and labels
 * at medium zoom levels.
 */
export class StarSystemLayer implements Layer {
  private _data: StarSystemDataSource;

  constructor(data: StarSystemDataSource) {
    this._data = data;
  }

  shouldTransform(): boolean {
    return true;
  }

  renderLayer(ctx: CanvasRenderingContext2D): void {
    const systems = this._data.getStarSystems();
    const zoom = this._data.getZoom();

    for (const sys of systems) {
      const color = SPECTRAL_COLORS[sys.spectralType] ?? SPECTRAL_COLORS.G;
      const radius = sys.baseRadius * Math.max(0.5, Math.min(zoom * 0.5, 3));

      // Glow
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(sys.x, sys.y, radius * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Core star
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(sys.x, sys.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Label at medium zoom
      if (zoom >= LABEL_ZOOM_MIN && zoom <= LABEL_ZOOM_MAX) {
        const fontSize = Math.max(8, 12 / zoom);
        ctx.font = `${fontSize}px sans-serif`;
        ctx.fillStyle = "#cccccc";
        ctx.textAlign = "center";
        ctx.fillText(sys.name, sys.x, sys.y + radius + fontSize + 2);
      }
    }
  }
}
