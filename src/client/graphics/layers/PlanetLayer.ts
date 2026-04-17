import type { Layer } from "../Layer.js";
import { PlanetType } from "../../../core/game/Types.js";

export interface PlanetData {
  x: number;
  y: number;
  type: PlanetType;
  radius: number;
  name?: string;
}

export interface PlanetDataSource {
  getPlanets(): PlanetData[];
  getZoom(): number;
}

/** Planet type to fill color mapping. */
const PLANET_COLORS: Record<PlanetType, string> = {
  [PlanetType.Barren]: "#888888",
  [PlanetType.Terran]: "#44aa55",
  [PlanetType.Oceanic]: "#3388cc",
  [PlanetType.Volcanic]: "#cc4400",
  [PlanetType.GasGiant]: "#dd8833",
  [PlanetType.Ice]: "#ddeeff",
  [PlanetType.Desert]: "#aa8844",
  [PlanetType.Nebula]: "#9966cc",
};

const SYSTEM_ZOOM_THRESHOLD = 3;

/**
 * Renders planet circles at close zoom levels.
 * Only visible when zoomed in enough to see individual systems.
 */
export class PlanetLayer implements Layer {
  private _data: PlanetDataSource;

  constructor(data: PlanetDataSource) {
    this._data = data;
  }

  shouldTransform(): boolean {
    return true;
  }

  renderLayer(ctx: CanvasRenderingContext2D): void {
    const zoom = this._data.getZoom();
    if (zoom < SYSTEM_ZOOM_THRESHOLD) return;

    const planets = this._data.getPlanets();

    for (const planet of planets) {
      const color = PLANET_COLORS[planet.type] ?? "#888888";
      const r = planet.radius;

      // Planet body
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(planet.x, planet.y, r, 0, Math.PI * 2);
      ctx.fill();

      // Subtle ring for gas giants
      if (planet.type === PlanetType.GasGiant) {
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = "#eebb66";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(planet.x, planet.y, r * 1.6, r * 0.4, 0.3, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Label
      if (planet.name && zoom >= 5) {
        const fontSize = Math.max(6, 10 / zoom);
        ctx.globalAlpha = 0.8;
        ctx.font = `${fontSize}px sans-serif`;
        ctx.fillStyle = "#aaaaaa";
        ctx.textAlign = "center";
        ctx.fillText(planet.name, planet.x, planet.y + r + fontSize + 2);
      }
    }

    ctx.globalAlpha = 1;
  }
}
