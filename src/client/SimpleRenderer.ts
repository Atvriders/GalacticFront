import type { GameImpl } from "@core/game/GameImpl";
import { TerrainType } from "@core/game/Types";
import { NO_OWNER } from "@core/game/GameMap";

/** Player color palette — up to 16 players. */
const PLAYER_COLORS: string[] = [
  "#00000000", // 0 = no owner (unused)
  "#4fc3f7", // 1 — cyan (human)
  "#ef5350", // 2 — red
  "#66bb6a", // 3 — green
  "#ffa726", // 4 — orange
  "#ab47bc", // 5 — purple
  "#ffee58", // 6 — yellow
  "#26c6da", // 7 — teal
  "#ec407a", // 8 — pink
  "#8d6e63", // 9 — brown
  "#78909c", // 10 — blue-gray
  "#7e57c2", // 11 — deep purple
  "#29b6f6", // 12 — light blue
  "#9ccc65", // 13 — light green
  "#ff7043", // 14 — deep orange
  "#5c6bc0", // 15 — indigo
  "#26a69a", // 16 — teal-dark
];

const TERRAIN_COLORS: Record<number, string> = {
  [TerrainType.Asteroid]: "#3e2723",
  [TerrainType.Nebula]: "#1a237e",
  [TerrainType.Planet]: "#555555",
};

const BG_COLOR = "#0a0a12";
const NEUTRAL_TILE_COLOR = "#555555";
const STAR_COLOR = "rgba(255, 255, 255, 0.6)";
const HUD_FONT = '13px "Courier New", monospace';
const HUD_COLOR = "#cccccc";

interface StarPoint {
  x: number;
  y: number;
  r: number;
}

/**
 * Lightweight Canvas 2D renderer for singleplayer.
 * Draws the game map as colored dots, a starfield background, and a HUD overlay.
 */
export class SimpleRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private stars: StarPoint[] | null = null;
  private lastWidth = 0;
  private lastHeight = 0;

  constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    this.canvas = canvas;
    this.ctx = ctx;
  }

  render(game: GameImpl): void {
    const { canvas, ctx } = this;
    const w = canvas.width;
    const h = canvas.height;

    // Regenerate stars if canvas size changed
    if (this.stars === null || w !== this.lastWidth || h !== this.lastHeight) {
      this.stars = this.generateStars(w, h);
      this.lastWidth = w;
      this.lastHeight = h;
    }

    // 1. Clear
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // 2. Draw starfield
    this.drawStars(ctx);

    // 3. Draw map tiles
    this.drawMap(ctx, game, w, h);

    // 4. Draw HUD
    this.drawHUD(ctx, game, w, h);
  }

  // ── Stars ──────────────────────────────────────────────────────────────────

  private generateStars(w: number, h: number): StarPoint[] {
    const count = Math.floor((w * h) / 800);
    const stars: StarPoint[] = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.2 + 0.3,
      });
    }
    return stars;
  }

  private drawStars(ctx: CanvasRenderingContext2D): void {
    if (!this.stars) return;
    ctx.fillStyle = STAR_COLOR;
    for (const s of this.stars) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Map ────────────────────────────────────────────────────────────────────

  private drawMap(
    ctx: CanvasRenderingContext2D,
    game: GameImpl,
    canvasW: number,
    canvasH: number,
  ): void {
    const map = game.map;
    const mw = map.width;
    const mh = map.height;

    // Compute tile pixel size so the map fits inside the canvas with padding
    const pad = 40;
    const tileW = (canvasW - pad * 2) / mw;
    const tileH = (canvasH - pad * 2) / mh;
    const tileSize = Math.max(1, Math.min(tileW, tileH));

    const offsetX = (canvasW - mw * tileSize) / 2;
    const offsetY = (canvasH - mh * tileSize) / 2;

    const totalTiles = mw * mh;

    for (let i = 0; i < totalTiles; i++) {
      const terrain = map.getTerrainType(i);

      // Skip empty space tiles that are unowned
      const owner = map.getOwner(i);
      if (terrain === TerrainType.Space && owner === NO_OWNER) continue;

      const tx = i % mw;
      const ty = Math.floor(i / mw);
      const px = offsetX + tx * tileSize;
      const py = offsetY + ty * tileSize;

      if (owner !== NO_OWNER) {
        // Owned tile — use player color
        ctx.fillStyle =
          owner < PLAYER_COLORS.length
            ? PLAYER_COLORS[owner]!
            : PLAYER_COLORS[1]!;
      } else if (terrain === TerrainType.Planet) {
        ctx.fillStyle = NEUTRAL_TILE_COLOR;
      } else {
        ctx.fillStyle = TERRAIN_COLORS[terrain] ?? NEUTRAL_TILE_COLOR;
      }

      if (tileSize >= 4) {
        // Draw as filled rect with 1px gap
        const gap = tileSize > 6 ? 1 : 0;
        ctx.fillRect(px + gap, py + gap, tileSize - gap * 2, tileSize - gap * 2);
      } else {
        // Very small tiles — just fill the pixel
        ctx.fillRect(px, py, Math.ceil(tileSize), Math.ceil(tileSize));
      }

      // Draw planet indicator
      if (terrain === TerrainType.Planet && tileSize >= 6) {
        const mag = map.getMagnitude(i);
        const r = Math.max(1, (mag / 8) * (tileSize * 0.35));
        ctx.fillStyle = owner !== NO_OWNER ? "rgba(255,255,255,0.4)" : "rgba(200,200,200,0.5)";
        ctx.beginPath();
        ctx.arc(px + tileSize / 2, py + tileSize / 2, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ── HUD ────────────────────────────────────────────────────────────────────

  private drawHUD(
    ctx: CanvasRenderingContext2D,
    game: GameImpl,
    _canvasW: number,
    _canvasH: number,
  ): void {
    const players = game.getAlivePlayers();
    if (players.length === 0) return;

    ctx.font = HUD_FONT;
    ctx.textBaseline = "top";

    let y = 12;
    for (const player of players) {
      const color =
        player.id < PLAYER_COLORS.length
          ? PLAYER_COLORS[player.id]!
          : HUD_COLOR;

      // Color swatch
      ctx.fillStyle = color;
      ctx.fillRect(10, y + 2, 10, 10);

      // Player info text
      ctx.fillStyle = HUD_COLOR;
      const troops = player.troops.toString();
      const territory = player.territoryCount;
      ctx.fillText(
        `${player.name}  T:${troops}  Tiles:${territory}`,
        26,
        y,
      );

      y += 18;
    }
  }
}
