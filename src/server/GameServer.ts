import { GameRunner, type TurnResult } from "../core/GameRunner.js";
import type { GameConfig, StampedIntent, ClientID, PlayerID } from "../core/Schemas.js";
import { IntentSchema, StampedIntentSchema } from "../core/Schemas.js";
import type { Client } from "./Client.js";
import { ClientMsgRateLimiter } from "./ClientMsgRateLimiter.js";
import crypto from "node:crypto";

const TICK_INTERVAL_MS = 100;
const HASH_EVERY_N_TICKS = 10;
const DISCONNECT_TIMEOUT_MS = 30_000;

export interface GameServerOptions {
  config: GameConfig;
  onEmpty?: () => void;
}

export class GameServer {
  public readonly gameId: string;
  public readonly config: GameConfig;
  public readonly runner: GameRunner;

  private clients = new Map<string, Client>();
  private playerMap = new Map<string, number>(); // clientId -> playerID
  private nextPlayerId = 0;
  private tickCount = 0;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private lastHash: string = "";
  private running = false;
  private rateLimiters = new Map<string, ClientMsgRateLimiter>();
  private onEmpty: (() => void) | null;

  constructor(options: GameServerOptions) {
    this.gameId = options.config.gameID;
    this.config = options.config;
    this.runner = new GameRunner(options.config);
    this.onEmpty = options.onEmpty ?? null;
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    this.tickTimer = setInterval(() => {
      this.tick();
    }, TICK_INTERVAL_MS);
  }

  stop(): void {
    this.running = false;
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  addClient(client: Client): number {
    const playerId = this.nextPlayerId++;
    this.clients.set(client.clientId, client);
    this.playerMap.set(client.clientId, playerId);
    this.rateLimiters.set(client.clientId, new ClientMsgRateLimiter());

    client.onMessage((data: unknown) => {
      this.handleClientMessage(client.clientId, data);
    });

    // Send current game state
    client.send({
      type: "game_state",
      gameId: this.gameId,
      playerId,
      turn: this.runner.getCurrentTurn(),
    });

    return playerId;
  }

  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.close();
      this.clients.delete(clientId);
      this.playerMap.delete(clientId);
      this.rateLimiters.delete(clientId);
    }
  }

  rejoinClient(clientId: string, client: Client): boolean {
    if (!this.playerMap.has(clientId)) return false;
    const playerId = this.playerMap.get(clientId)!;
    this.clients.set(clientId, client);
    this.rateLimiters.set(clientId, new ClientMsgRateLimiter());

    client.onMessage((data: unknown) => {
      this.handleClientMessage(clientId, data);
    });

    client.send({
      type: "game_state",
      gameId: this.gameId,
      playerId,
      turn: this.runner.getCurrentTurn(),
      rejoin: true,
    });

    return true;
  }

  get clientCount(): number {
    return this.clients.size;
  }

  get isRunning(): boolean {
    return this.running;
  }

  /** Lifecycle tick - check for disconnected clients */
  lifecycleTick(): void {
    const now = Date.now();
    for (const [clientId, client] of this.clients) {
      if (
        !client.connected &&
        client.disconnectedAt !== null &&
        now - client.disconnectedAt > DISCONNECT_TIMEOUT_MS
      ) {
        console.log(`[GameServer ${this.gameId}] Client ${clientId} timed out`);
        this.removeClient(clientId);
      }
    }

    if (this.clients.size === 0 && this.onEmpty) {
      this.onEmpty();
    }
  }

  private tick(): void {
    this.tickCount++;

    // Process a turn
    const result = this.runner.processTurn();

    // Broadcast turn result to all connected clients
    const turnMsg = {
      type: "turn_result",
      turn: result.turn,
      updates: result.updates,
      tileChanges: result.tileChanges,
    };

    this.broadcast(turnMsg);

    // Hash validation every N ticks
    if (this.tickCount % HASH_EVERY_N_TICKS === 0) {
      const hash = this.computeStateHash();
      const hashMsg = {
        type: "hash_check",
        turn: result.turn,
        hash,
      };
      if (this.lastHash !== "" && this.lastHash === hash) {
        // State consistent
      }
      this.lastHash = hash;
      this.broadcast(hashMsg);
    }
  }

  private handleClientMessage(clientId: string, data: unknown): void {
    const limiter = this.rateLimiters.get(clientId);
    if (!limiter) return;

    const raw = typeof data === "string" ? data : JSON.stringify(data);
    if (!limiter.allow(raw)) {
      const client = this.clients.get(clientId);
      client?.send({ type: "error", message: "Rate limited" });
      return;
    }

    const playerId = this.playerMap.get(clientId);
    if (playerId === undefined) return;

    const msg = data as { type?: string; intent?: unknown };
    if (msg.type === "submit_intent" && msg.intent) {
      const parsed = IntentSchema.safeParse(msg.intent);
      if (parsed.success) {
        const stamped: StampedIntent = {
          clientID: clientId as ClientID,
          playerID: playerId,
          turn: this.runner.getCurrentTurn(),
          intent: parsed.data,
        };
        this.runner.queueIntent(stamped);
      }
    }
  }

  private broadcast(msg: unknown): void {
    for (const client of this.clients.values()) {
      if (client.connected) {
        client.send(msg);
      }
    }
  }

  private computeStateHash(): string {
    // Simple hash of turn number + game state summary
    const data = `${this.runner.getCurrentTurn()}`;
    return crypto.createHash("md5").update(data).digest("hex").slice(0, 8);
  }
}
