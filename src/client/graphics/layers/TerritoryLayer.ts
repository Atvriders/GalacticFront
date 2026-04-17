import type { Layer } from "../Layer.js";
import type { GameMap } from "../../../core/game/GameMap.js";
import { NO_OWNER } from "../../../core/game/GameMap.js";

/**
 * Minimal game view contract needed by rendering layers.
 * Implemented by the client-side game state holder.
 */
export interface GameView {
  map: GameMap;
  /** Map from playerID to their display color (CSS string). */
  playerColors: Map<number, string>;
  /** Currently active/alive player IDs. */
  activePlayers: Set<number>;
}

/**
 * Renders semi-transparent territory fills colored by owner,
 * with animated glowing borders.
 */
export class TerritoryLayer implements Layer {
  private _gameView: GameView;
  private _tileSize: number;
  private _animPhase = 0;

  constructor(gameView: GameView, tileSize: number) {
    this._gameView = gameView;
    this._tileSize = tileSize;
  }

  shouldTransform(): boolean {
    return true;
  }

  getTickIntervalMs(): number {
    return 10;
  }

  tick(): void {
    this._animPhase = (this._animPhase + 0.02) % (Math.PI * 2);
  }

  renderLayer(ctx: CanvasRenderingContext2D): void {
    const map = this._gameView.map;
    const ts = this._tileSize;
    const w = map.width;
    const h = map.height;

    // Fill territory tiles
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const tile = y * w + x;
        const owner = map.getOwner(tile);
        if (owner === NO_OWNER) continue;

        const color = this._gameView.playerColors.get(owner);
        if (!color) continue;

        ctx.globalAlpha = 0.25;
        ctx.fillStyle = color;
        ctx.fillRect(x * ts, y * ts, ts, ts);
      }
    }

    // Draw glowing borders (tiles adjacent to non-owned tiles)
    const borderAlpha = 0.4 + 0.3 * Math.sin(this._animPhase);
    ctx.globalAlpha = borderAlpha;
    ctx.lineWidth = 2;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const tile = y * w + x;
        const owner = map.getOwner(tile);
        if (owner === NO_OWNER) continue;

        const color = this._gameView.playerColors.get(owner);
        if (!color) continue;

        const isBorder = this._isBorderTile(map, tile, owner, w, h);
        if (!isBorder) continue;

        ctx.strokeStyle = color;
        ctx.strokeRect(x * ts, y * ts, ts, ts);
      }
    }

    ctx.globalAlpha = 1;
  }

  private _isBorderTile(
    map: GameMap,
    tile: number,
    owner: number,
    w: number,
    h: number,
  ): boolean {
    const x = tile % w;
    const y = Math.floor(tile / w);

    // Check 4-directional neighbors
    if (x > 0 && map.getOwner(tile - 1) !== owner) return true;
    if (x < w - 1 && map.getOwner(tile + 1) !== owner) return true;
    if (y > 0 && map.getOwner(tile - w) !== owner) return true;
    if (y < h - 1 && map.getOwner(tile + w) !== owner) return true;
    return false;
  }
}
