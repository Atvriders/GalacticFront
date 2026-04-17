/**
 * Client-side state projection for rendering.
 * Applies GameUpdate data to maintain a local view of the game state.
 */

import { GameUpdateType, type UnitType } from "@core/game/Types";
import type { GameUpdate } from "@core/game/GameImpl";
import type { GameUpdateMessage } from "@core/worker/WorkerMessages";

// ── View Data Classes ──────────────────────────────────────────────────────

export class UnitView {
  readonly id: string;
  readonly type: UnitType;
  ownerID: number;
  tile: number;
  level: number;
  active: boolean;
  positionHistory: Array<{ tile: number; tick: number }>;

  constructor(id: string, type: UnitType, ownerID: number, tile: number) {
    this.id = id;
    this.type = type;
    this.ownerID = ownerID;
    this.tile = tile;
    this.level = 1;
    this.active = true;
    this.positionHistory = [{ tile, tick: 0 }];
  }

  recordPosition(tile: number, tick: number): void {
    if (this.tile !== tile) {
      this.tile = tile;
      this.positionHistory.push({ tile, tick });
    }
  }
}

export interface PlayerCosmetics {
  name: string;
  color?: string;
}

export class PlayerView {
  readonly id: number;
  name: string;
  isAlive: boolean;
  territoryCount: number;
  cosmetics: PlayerCosmetics;

  constructor(id: number, name: string) {
    this.id = id;
    this.name = name;
    this.isAlive = true;
    this.territoryCount = 0;
    this.cosmetics = { name };
  }
}

// ── GameView ───────────────────────────────────────────────────────────────

export class GameView {
  private _myPlayerID: number | null = null;
  private _players: Map<number, PlayerView> = new Map();
  private _units: Map<string, UnitView> = new Map();
  private _tileOwners: Map<number, number> = new Map();
  private _tick = 0;

  setMyPlayerID(id: number): void {
    this._myPlayerID = id;
  }

  /**
   * Apply a full game update message (turn result from worker).
   */
  applyUpdateMessage(msg: GameUpdateMessage): void {
    // Apply tile changes
    for (const tc of msg.tileChanges) {
      // packed tile contains owner info in the map encoding
      // For view purposes we track ownership separately via updates
      this._tileOwners.set(tc.tile, tc.packed);
    }

    // Apply individual updates
    for (const update of msg.updates) {
      this.applyUpdate(update);
    }
  }

  /**
   * Apply a single GameUpdate to the view state.
   */
  applyUpdate(update: GameUpdate): void {
    this._tick = Math.max(this._tick, update.tick);
    const payload = update.payload as Record<string, unknown>;

    switch (update.type) {
      case GameUpdateType.PlayerSpawned: {
        const id = payload.playerID as number;
        const name = (payload.name as string) ?? `Player ${id}`;
        this._players.set(id, new PlayerView(id, name));
        break;
      }

      case GameUpdateType.PlayerEliminated:
      case GameUpdateType.PlayerSurrendered: {
        const id = payload.playerID as number;
        const player = this._players.get(id);
        if (player) player.isAlive = false;
        break;
      }

      case GameUpdateType.TileOwnerChange: {
        const tile = payload.tile as number;
        const newOwner = payload.newOwner as number;
        const oldOwner = payload.oldOwner as number | undefined;

        if (oldOwner !== undefined) {
          const oldP = this._players.get(oldOwner);
          if (oldP) oldP.territoryCount = Math.max(0, oldP.territoryCount - 1);
        }

        this._tileOwners.set(tile, newOwner);
        const newP = this._players.get(newOwner);
        if (newP) newP.territoryCount++;
        break;
      }

      case GameUpdateType.UnitBuilt: {
        const unitID = payload.unitID as string;
        const unitType = payload.type as UnitType;
        const ownerID = payload.ownerID as number;
        const tile = payload.tile as number;
        this._units.set(unitID, new UnitView(unitID, unitType, ownerID, tile));
        break;
      }

      case GameUpdateType.UnitDestroyed: {
        const unitID = payload.unitID as string;
        this._units.delete(unitID);
        break;
      }

      case GameUpdateType.UnitUpgraded: {
        const unitID = payload.unitID as string;
        const unit = this._units.get(unitID);
        if (unit) unit.level++;
        break;
      }

      case GameUpdateType.UnitActivated: {
        const unitID = payload.unitID as string;
        const unit = this._units.get(unitID);
        if (unit) unit.active = true;
        break;
      }

      case GameUpdateType.UnitDeactivated: {
        const unitID = payload.unitID as string;
        const unit = this._units.get(unitID);
        if (unit) unit.active = false;
        break;
      }

      default:
        // Other updates are tracked but don't require view state changes
        break;
    }
  }

  // ── Accessors ────────────────────────────────────────────────────────────

  myPlayer(): PlayerView | null {
    if (this._myPlayerID === null) return null;
    return this._players.get(this._myPlayerID) ?? null;
  }

  players(): PlayerView[] {
    return [...this._players.values()];
  }

  getPlayer(id: number): PlayerView | undefined {
    return this._players.get(id);
  }

  owner(tile: number): number | undefined {
    return this._tileOwners.get(tile);
  }

  units(): UnitView[] {
    return [...this._units.values()];
  }

  getUnit(id: string): UnitView | undefined {
    return this._units.get(id);
  }

  ticks(): number {
    return this._tick;
  }
}
