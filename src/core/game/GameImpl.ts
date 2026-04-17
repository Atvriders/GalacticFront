import type { GameConfig } from "../Schemas.js";
import type { GameBalanceConfig } from "../configuration/Config.js";
import { DEFAULT_CONFIG, getUnitCost } from "../configuration/DefaultConfig.js";
import { GameUpdateType, UnitType, TerrainType, PlanetType } from "./Types.js";
import { GameMap, NO_OWNER } from "./GameMap.js";
import { PlayerImpl, type PlayerData } from "./PlayerImpl.js";
import { AttackImpl } from "./AttackImpl.js";
import { AllianceImpl, AllianceRequestImpl } from "./AllianceImpl.js";
import { UnitImpl } from "./UnitImpl.js";
import { EventBus } from "../EventBus.js";
import { PseudoRandom } from "../PseudoRandom.js";
import { uniqueId } from "../Util.js";

export interface GameUpdate {
  type: GameUpdateType;
  tick: number;
  payload: unknown;
}

export interface TickResult {
  updates: GameUpdate[];
  tileChanges: Array<{ tile: number; packed: number }>;
}

/**
 * Core game simulation. Owns map, players, attacks, alliances, units,
 * and runs the tick loop.
 */
export class GameImpl {
  readonly config: GameConfig;
  readonly balance: GameBalanceConfig;
  readonly map: GameMap;
  readonly eventBus: EventBus;
  readonly rng: PseudoRandom;

  // Collections
  private _players: Map<number, PlayerImpl> = new Map();
  private _attacks: Map<string, AttackImpl> = new Map();
  private _alliances: Map<string, AllianceImpl> = new Map();
  private _allianceRequests: Map<string, AllianceRequestImpl> = new Map();
  private _units: Map<string, UnitImpl> = new Map();

  // State
  private _currentTick = 0;
  private _isGameOver = false;
  private _winnerID: number | null = null;
  private _pendingUpdates: GameUpdate[] = [];
  private _tileChanges: Map<number, { from: number; to: number }> = new Map();
  private _nextPlayerID = 1;

  constructor(config: GameConfig, balance: GameBalanceConfig = DEFAULT_CONFIG) {
    this.config = config;
    this.balance = balance;
    this.map = new GameMap(config.mapWidth, config.mapHeight);
    this.eventBus = new EventBus();
    this.rng = new PseudoRandom(config.seed);
    this.generateMap();
  }

  // ─── Getters ────────────────────────────────────────────────────────────────

  get currentTick(): number {
    return this._currentTick;
  }

  get tick(): number {
    return this._currentTick;
  }

  isGameOver(): boolean {
    return this._isGameOver;
  }

  get winnerID(): number | null {
    return this._winnerID;
  }

  // ─── Player management ──────────────────────────────────────────────────────

  spawnPlayer(data: Omit<PlayerData, "id">): PlayerImpl;
  spawnPlayer(name: string, tile: number): number;
  spawnPlayer(
    dataOrName: Omit<PlayerData, "id"> | string,
    tile?: number,
  ): PlayerImpl | number {
    if (typeof dataOrName === "string") {
      // Legacy signature: (name, tile) -> playerID
      const id = this._nextPlayerID++;
      const player = new PlayerImpl({
        id,
        clientID: `client-${id}`,
        name: dataOrName,
        playerType: 0 as never, // PlayerType.Human
        spawnTile: tile!,
      });
      this._players.set(id, player);
      this._claimSpawnArea(player, tile!);
      player.troops = 100n;
      this.emitUpdate(GameUpdateType.PlayerSpawned, {
        playerID: id,
        name: dataOrName,
      });
      return id;
    }

    // Full signature: (data) -> PlayerImpl
    const id = this._nextPlayerID++;
    const player = new PlayerImpl({ ...dataOrName, id });
    this._players.set(id, player);
    this._claimSpawnArea(player, dataOrName.spawnTile);
    player.troops = 100n;
    this.emitUpdate(GameUpdateType.PlayerSpawned, {
      playerID: id,
      name: player.name,
    });
    return player;
  }

  private _claimSpawnArea(player: PlayerImpl, spawnTile: number): void {
    const { x: sx, y: sy } = this.map.fromIndex(spawnTile);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = sx + dx;
        const ny = sy + dy;
        if (this.map.isInBounds(nx, ny)) {
          const t = this.map.toIndex(nx, ny);
          if (this.map.isTraversable(t) && !this.map.isOwned(t)) {
            this.claimTile(t, player.id);
          }
        }
      }
    }
  }

  getPlayer(id: number): PlayerImpl | undefined {
    return this._players.get(id);
  }

  getPlayers(): PlayerImpl[] {
    return [...this._players.values()];
  }

  getAlivePlayers(): PlayerImpl[] {
    return [...this._players.values()].filter((p) => p.isAlive);
  }

  /** Legacy API compatibility */
  eliminatePlayer(playerID: number): void {
    const player = this._players.get(playerID);
    if (player && player.isAlive) {
      // Clear territory from map
      for (const tile of player.territory) {
        this.map.setOwner(tile, NO_OWNER);
      }
      player.eliminate(this._currentTick);
      this.emitUpdate(GameUpdateType.PlayerEliminated, { playerID });

      // Cancel their attacks
      const toCancel: string[] = [];
      for (const [id, atk] of this._attacks.entries()) {
        if (atk.attackerID === playerID) toCancel.push(id);
      }
      for (const id of toCancel) this.endAttack(id);

      // Check win via last standing
      if (this._players.size > 1) {
        const alive = this.getAlivePlayers();
        if (alive.length <= 1) {
          this._isGameOver = true;
          this._winnerID = alive.length === 1 ? alive[0]!.id : null;
          if (this._winnerID !== null) {
            this.emitUpdate(GameUpdateType.GameWon, {
              winnerID: this._winnerID,
            });
          }
        }
      }
    }
  }

  // ─── Territory ──────────────────────────────────────────────────────────────

  claimTile(tile: number, ownerID: number): void {
    const prevOwner = this.map.getOwner(tile);
    if (prevOwner !== NO_OWNER && prevOwner !== ownerID) {
      const prevPlayer = this._players.get(prevOwner);
      if (prevPlayer) prevPlayer.removeTerritory(tile);
    }
    this.map.setOwner(tile, ownerID);
    const newPlayer = this._players.get(ownerID);
    if (newPlayer) newPlayer.addTerritory(tile);
    this.recordTileChange(tile, prevOwner, ownerID);
  }

  transferTiles(tiles: number[], fromID: number, toID: number): void {
    for (const tile of tiles) {
      if (this.map.getOwner(tile) === fromID) {
        this.claimTile(tile, toID);
      }
    }
  }

  // ─── Attacks ────────────────────────────────────────────────────────────────

  startAttack(
    attackerID: number,
    defenderID: number,
    sourceTile: number,
    troopRatio: number,
  ): AttackImpl | null {
    const attacker = this._players.get(attackerID);
    const defender = this._players.get(defenderID);
    if (!attacker || !defender) return null;
    if (!attacker.isAlive || !defender.isAlive) return null;
    if (attackerID === defenderID) return null;
    if (attacker.isAlliedWith(defenderID)) return null;

    let activeCount = 0;
    for (const atk of this._attacks.values()) {
      if (atk.attackerID === attackerID) activeCount++;
    }
    if (activeCount >= this.balance.attack.maxActiveAttacks) return null;

    const id = uniqueId("atk_");
    const attack = new AttackImpl(
      id,
      attackerID,
      defenderID,
      sourceTile,
      troopRatio,
      this._currentTick,
    );

    const troopAmount = BigInt(
      Math.floor(Number(attacker.troops) * troopRatio),
    );
    attacker.troops -= troopAmount;
    attack.troops = troopAmount;

    // Initialize border
    for (const n of this.map.getNeighbors4(sourceTile)) {
      if (
        this.map.getOwner(n) === defenderID &&
        this.map.isTraversable(n)
      ) {
        attack.addBorderTile(n);
      }
    }

    this._attacks.set(id, attack);
    this.emitUpdate(GameUpdateType.AttackStarted, {
      attackID: id,
      attackerID,
      defenderID,
    });
    return attack;
  }

  endAttack(attackID: string): void {
    const attack = this._attacks.get(attackID);
    if (!attack) return;
    this._attacks.delete(attackID);
    this.emitUpdate(GameUpdateType.AttackEnded, { attackID });
  }

  // ─── Alliances ──────────────────────────────────────────────────────────────

  createAllianceRequest(
    requestorID: number,
    recipientID: number,
    duration: number,
  ): AllianceRequestImpl | null {
    const requestor = this._players.get(requestorID);
    const recipient = this._players.get(recipientID);
    if (!requestor || !recipient) return null;
    if (!requestor.isAlive || !recipient.isAlive) return null;
    if (
      requestor.getAllianceCount() >= this.balance.alliance.maxAlliances
    )
      return null;

    const id = uniqueId("req_");
    const request = new AllianceRequestImpl(
      id,
      requestorID,
      recipientID,
      duration,
      this._currentTick,
      this.balance.alliance.requestExpiry,
    );
    this._allianceRequests.set(id, request);
    this.emitUpdate(GameUpdateType.AllianceRequested, {
      requestID: id,
      requestorID,
      recipientID,
    });
    return request;
  }

  acceptAlliance(requestID: string): AllianceImpl | null {
    const request = this._allianceRequests.get(requestID);
    if (!request) return null;
    this._allianceRequests.delete(requestID);

    const agreedDuration = request.getAgreedDuration();
    const id = uniqueId("all_");
    const alliance = new AllianceImpl(
      id,
      request.requestorID,
      request.recipientID,
      this._currentTick,
      agreedDuration,
    );
    this._alliances.set(id, alliance);

    const p1 = this._players.get(request.requestorID);
    const p2 = this._players.get(request.recipientID);
    if (p1) p1.addAlliance(request.recipientID, alliance.expirationTick);
    if (p2) p2.addAlliance(request.requestorID, alliance.expirationTick);

    this.emitUpdate(GameUpdateType.AllianceFormed, {
      allianceID: id,
      player1ID: request.requestorID,
      player2ID: request.recipientID,
    });
    return alliance;
  }

  breakAlliance(allianceID: string, breakerID: number): void {
    const alliance = this._alliances.get(allianceID);
    if (!alliance) return;
    this._alliances.delete(allianceID);

    const p1 = this._players.get(alliance.player1ID);
    const p2 = this._players.get(alliance.player2ID);
    if (p1) {
      p1.removeAlliance(alliance.player2ID);
      p1.adjustRelation(alliance.player2ID, -30);
    }
    if (p2) {
      p2.removeAlliance(alliance.player1ID);
      p2.adjustRelation(alliance.player1ID, -30);
    }

    this.emitUpdate(GameUpdateType.AllianceBroken, { allianceID, breakerID });
  }

  // ─── Units ──────────────────────────────────────────────────────────────────

  buildUnit(ownerID: number, type: UnitType, tile: number): UnitImpl | null {
    const player = this._players.get(ownerID);
    if (!player) return null;
    if (!player.isAlive) return null;
    if (!player.ownsTerritory(tile)) return null;

    const existingCount = player.getUnitCount(type);
    const cost = getUnitCost(type, existingCount, this.balance);
    if (player.credits < cost) return null;

    player.credits -= cost;
    const id = uniqueId("unit_");
    const unit = new UnitImpl({ id, type, ownerID, tile });
    this._units.set(id, unit);
    player.addUnit(id, type, tile);

    this.emitUpdate(GameUpdateType.UnitBuilt, { unitID: id, ownerID, type, tile });
    return unit;
  }

  destroyUnit(unitID: string): void {
    const unit = this._units.get(unitID);
    if (!unit) return;
    this._units.delete(unitID);

    const player = this._players.get(unit.ownerID);
    if (player) player.removeUnit(unitID);

    this.emitUpdate(GameUpdateType.UnitDestroyed, {
      unitID,
      ownerID: unit.ownerID,
    });
  }

  // ─── Tick loop ──────────────────────────────────────────────────────────────

  executeTick(): TickResult {
    if (this._isGameOver) {
      return { updates: [], tileChanges: [] };
    }

    this._pendingUpdates = [];
    this._tileChanges.clear();
    this._currentTick++;

    this.tickPlayerIncome();
    this.tickUnits();
    this.tickAttacks();
    this.tickAlliances();
    this.tickRelations();
    this.checkElimination();
    this.checkWinCondition();

    // Build packed tile changes array
    const tileChanges: Array<{ tile: number; packed: number }> = [];
    for (const [tile] of this._tileChanges) {
      tileChanges.push({ tile, packed: this.map.packTile(tile) });
    }

    return { updates: [...this._pendingUpdates], tileChanges };
  }

  private tickPlayerIncome(): void {
    const bal = this.balance;
    for (const player of this._players.values()) {
      if (!player.isAlive) continue;

      // Troop generation
      let troopGen = player.territoryCount * bal.troopGen.basePerTile;
      for (const tile of player.territory) {
        if (this.map.isPlanet(tile)) {
          const mag = this.map.getMagnitude(tile);
          troopGen += mag * bal.troopGen.planetMultiplier;
        }
      }
      player.troops += BigInt(Math.floor(troopGen));

      // Credit generation
      let creditGen =
        bal.credits.baseIncome +
        player.territoryCount * bal.credits.perTileIncome;

      // Starport multiplier
      let starportCount = 0;
      for (const unit of this._units.values()) {
        if (
          unit.ownerID === player.id &&
          unit.type === UnitType.Starport &&
          !unit.isConstructing
        ) {
          starportCount++;
        }
      }
      if (starportCount > 0) {
        creditGen *=
          1 + (bal.credits.starportMultiplier - 1) * starportCount;
      }

      player.credits += BigInt(Math.floor(creditGen));
    }
  }

  private tickUnits(): void {
    for (const unit of this._units.values()) {
      unit.tickConstruction();
      unit.tickCooldown();
    }
  }

  private tickAttacks(): void {
    const toRemove: string[] = [];

    for (const [id, attack] of this._attacks.entries()) {
      const defender = this._players.get(attack.defenderID);

      if (
        attack.isTimedOut(
          this._currentTick,
          this.balance.attack.idleTimeoutTicks,
        ) ||
        !defender ||
        !defender.isAlive
      ) {
        toRemove.push(id);
        continue;
      }

      if (attack.isRetreating) {
        const tilesToLose = [...attack.conqueredTiles];
        for (const tile of tilesToLose) {
          attack.loseTile(tile);
          this.claimTile(tile, attack.defenderID);
        }
        if (attack.conqueredTiles.size === 0) {
          toRemove.push(id);
        }
        continue;
      }

      // Expand
      const borderCopy = [...attack.borderTiles];
      let expanded = 0;
      const maxExpand = Math.max(
        1,
        Math.floor(this.balance.attack.expansionRate),
      );

      for (const tile of borderCopy) {
        if (expanded >= maxExpand) break;
        if (attack.troops <= 0n) break;

        let defense = this.balance.defense.baseTerritoryDefense;
        if (this.map.isPlanet(tile)) {
          const pType = this.map.getPlanetType(tile);
          const pConfig = this.balance.planetTypes[pType];
          if (pConfig) defense *= pConfig.defenseMultiplier;
        }
        if (this.map.isShielded(tile)) {
          defense += this.balance.defense.shieldBonus;
        }

        const cost = BigInt(
          Math.ceil(this.balance.attack.troopCostPerTile * defense),
        );
        if (attack.troops < cost) continue;

        attack.troops -= cost;
        attack.conquerTile(tile);
        this.claimTile(tile, attack.attackerID);
        attack.recordExpansion(this._currentTick);
        expanded++;

        for (const n of this.map.getNeighbors4(tile)) {
          if (
            this.map.getOwner(n) === attack.defenderID &&
            this.map.isTraversable(n) &&
            !attack.conqueredTiles.has(n) &&
            !attack.borderTiles.has(n)
          ) {
            attack.addBorderTile(n);
          }
        }
      }

      if (attack.isExhausted()) {
        toRemove.push(id);
      }
    }

    for (const id of toRemove) {
      this.endAttack(id);
    }
  }

  private tickAlliances(): void {
    const expiredAlliances: string[] = [];
    for (const [id, alliance] of this._alliances.entries()) {
      if (alliance.isExpired(this._currentTick)) {
        expiredAlliances.push(id);
      }
    }
    for (const id of expiredAlliances) {
      const alliance = this._alliances.get(id)!;
      const p1 = this._players.get(alliance.player1ID);
      const p2 = this._players.get(alliance.player2ID);
      if (p1) p1.removeAlliance(alliance.player2ID);
      if (p2) p2.removeAlliance(alliance.player1ID);
      this._alliances.delete(id);
    }

    const expiredRequests: string[] = [];
    for (const [id, request] of this._allianceRequests.entries()) {
      if (request.isExpired(this._currentTick)) {
        expiredRequests.push(id);
      }
    }
    for (const id of expiredRequests) {
      this._allianceRequests.delete(id);
    }
  }

  private tickRelations(): void {
    for (const player of this._players.values()) {
      if (!player.isAlive) continue;
      player.decayRelations(this.balance.relationDecayRate);
    }
  }

  private checkElimination(): void {
    if (this._currentTick <= 1) return;
    for (const player of this._players.values()) {
      if (!player.isAlive) continue;
      if (player.territoryCount === 0) {
        player.eliminate(this._currentTick);
        this.emitUpdate(GameUpdateType.PlayerEliminated, {
          playerID: player.id,
        });

        const toCancel: string[] = [];
        for (const [id, atk] of this._attacks.entries()) {
          if (atk.attackerID === player.id) toCancel.push(id);
        }
        for (const id of toCancel) this.endAttack(id);
      }
    }
  }

  private checkWinCondition(): void {
    if (this._isGameOver) return;

    const alive = this.getAlivePlayers();

    // Last player standing
    if (this._players.size > 1 && alive.length === 1) {
      this._isGameOver = true;
      this._winnerID = alive[0]!.id;
      this.emitUpdate(GameUpdateType.GameWon, { winnerID: this._winnerID });
      return;
    }

    // Territory threshold
    const totalTiles = this.map.width * this.map.height;
    for (const player of alive) {
      if (
        player.territoryCount / totalTiles >=
        this.balance.winConditionTerritory
      ) {
        this._isGameOver = true;
        this._winnerID = player.id;
        this.emitUpdate(GameUpdateType.GameWon, { winnerID: this._winnerID });
        return;
      }
    }

    // Max game ticks
    if (
      this.balance.maxGameTicks > 0 &&
      this._currentTick >= this.balance.maxGameTicks
    ) {
      this._isGameOver = true;
      let bestPlayer: PlayerImpl | null = null;
      let bestTerritory = -1;
      for (const player of alive) {
        if (player.territoryCount > bestTerritory) {
          bestTerritory = player.territoryCount;
          bestPlayer = player;
        }
      }
      this._winnerID = bestPlayer?.id ?? null;
      if (this._winnerID !== null) {
        this.emitUpdate(GameUpdateType.GameWon, {
          winnerID: this._winnerID,
        });
      }
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private emitUpdate(type: GameUpdateType, payload: unknown): void {
    const update: GameUpdate = { type, tick: this._currentTick, payload };
    this._pendingUpdates.push(update);
    this.eventBus.emit(type, update);
  }

  private recordTileChange(tile: number, from: number, to: number): void {
    this._tileChanges.set(tile, { from, to });
  }

  getTileChanges(): ReadonlyMap<number, { from: number; to: number }> {
    return this._tileChanges;
  }

  getAttacks(): Map<string, AttackImpl> {
    return this._attacks;
  }

  getAlliances(): Map<string, AllianceImpl> {
    return this._alliances;
  }

  getAllianceRequests(): Map<string, AllianceRequestImpl> {
    return this._allianceRequests;
  }

  getUnits(): Map<string, UnitImpl> {
    return this._units;
  }

  private generateMap(): void {
    const totalTiles = this.map.width * this.map.height;
    for (let i = 0; i < totalTiles; i++) {
      const roll = this.rng.next();
      if (roll < 0.05) {
        this.map.setTerrainType(i, TerrainType.Asteroid);
      } else if (roll < 0.1) {
        this.map.setTerrainType(i, TerrainType.Nebula);
      } else if (roll < 0.15) {
        const planetTypes = [
          PlanetType.Barren,
          PlanetType.Terran,
          PlanetType.Oceanic,
          PlanetType.Volcanic,
          PlanetType.GasGiant,
          PlanetType.Ice,
          PlanetType.Desert,
        ];
        const pType =
          planetTypes[this.rng.nextInt(0, planetTypes.length - 1)]!;
        const pConfig = this.balance.planetTypes[pType];
        const mag = this.rng.nextInt(
          pConfig.magnitudeRange[0],
          pConfig.magnitudeRange[1],
        );
        this.map.setPlanet(i, pType, mag);
      }
    }
  }
}
