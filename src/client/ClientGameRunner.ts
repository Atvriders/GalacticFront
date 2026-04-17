/**
 * Game session controller.
 * Connects Transport + WorkerClient + GameView into a unified game session.
 */

import { Transport } from "./Transport.js";
import { GameView } from "./GameView.js";
import { WorkerClient } from "@core/worker/WorkerClient";
import type {
  GameUpdateMessage,
  GameUpdateBatchMessage,
} from "@core/worker/WorkerMessages";
import type { GameConfig, StampedIntent, ClientID, PlayerID } from "@core/Schemas";
import { ServerMessageType, ClientMessageType } from "@core/Schemas";

export interface ClientGameConfig {
  gameConfig: GameConfig;
  clientID: ClientID;
  playerID: PlayerID;
  wsUrl: string;
  useWorker?: boolean;
}

export type GamePhase = "connecting" | "spawning" | "playing" | "gameover" | "disconnected";

export interface ClientGameRunnerCallbacks {
  onPhaseChange?: (phase: GamePhase) => void;
  onDesync?: (message: string) => void;
  onGameUpdate?: (msg: GameUpdateMessage) => void;
  onError?: (error: string) => void;
}

export class ClientGameRunner {
  private transport: Transport;
  private workerClient: WorkerClient;
  private view: GameView;
  private config: ClientGameConfig | null = null;
  private callbacks: ClientGameRunnerCallbacks = {};
  private _phase: GamePhase = "disconnected";
  private _lastServerTurn = 0;
  private _lastClientTurn = 0;
  private desyncThreshold = 5;

  constructor() {
    this.transport = new Transport();
    this.workerClient = new WorkerClient();
    this.view = new GameView();
  }

  get phase(): GamePhase {
    return this._phase;
  }

  get gameView(): GameView {
    return this.view;
  }

  /**
   * Start a game session with the given configuration.
   */
  async start(
    config: ClientGameConfig,
    callbacks: ClientGameRunnerCallbacks = {},
  ): Promise<void> {
    this.config = config;
    this.callbacks = callbacks;
    this.view = new GameView();
    this.view.setMyPlayerID(config.playerID);

    this._setPhase("connecting");

    // Setup transport handlers
    this.transport.onMessage = (msg: unknown) => this.onMessage(msg);
    this.transport.onOpen = () => {
      // Send join message
      this.transport.send({
        type: ClientMessageType.JoinGame,
        gameID: config.gameConfig.gameID,
        clientID: config.clientID,
      });
    };
    this.transport.onClose = (_code: number, _reason: string) => {
      if (this._phase !== "gameover") {
        this._setPhase("disconnected");
      }
    };

    // Initialize worker if requested
    if (config.useWorker !== false) {
      try {
        await this.workerClient.init(config.gameConfig, {
          onGameUpdate: (update: GameUpdateMessage) => {
            this._lastClientTurn = update.turn;
            this.view.applyUpdateMessage(update);
            this.callbacks.onGameUpdate?.(update);
            this._checkDesync();
          },
          onGameUpdateBatch: (batch: GameUpdateBatchMessage) => {
            for (const update of batch.batch) {
              this._lastClientTurn = update.turn;
              this.view.applyUpdateMessage(update);
              this.callbacks.onGameUpdate?.(update);
            }
            this._checkDesync();
          },
          onError: (error: string) => {
            this.callbacks.onError?.(error);
          },
        });
      } catch (err) {
        this.callbacks.onError?.(
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    // Connect WebSocket
    this.transport.connect(config.wsUrl);
  }

  /**
   * Stop the game session and clean up.
   */
  stop(): void {
    this.transport.disconnect();
    this.workerClient.terminate();
    this._setPhase("disconnected");
  }

  /**
   * Send an intent to the server.
   */
  sendIntent(intent: StampedIntent): void {
    this.transport.send({
      type: ClientMessageType.SubmitIntent,
      intent,
    });
  }

  /**
   * Handle incoming server messages.
   */
  onMessage(msg: unknown): void {
    if (!msg || typeof msg !== "object") return;
    const data = msg as Record<string, unknown>;

    switch (data.type) {
      case ServerMessageType.GameState: {
        this._setPhase("spawning");
        break;
      }

      case ServerMessageType.TurnResult: {
        if (this._phase === "spawning" || this._phase === "connecting") {
          this._setPhase("playing");
        }
        this._lastServerTurn = (data.turn as number) ?? 0;

        // Forward turn to worker for local simulation
        if (this.workerClient.ready) {
          const intents = (data.intents as StampedIntent[]) ?? [];
          this.workerClient.sendTurn(this._lastServerTurn, intents);
        }

        // If no worker, apply directly
        if (!this.workerClient.ready && data.updates) {
          const updateMsg: GameUpdateMessage = {
            type: "game_update",
            turn: this._lastServerTurn,
            updates: (data.updates as GameUpdateMessage["updates"]) ?? [],
            tileChanges:
              (data.tileChanges as GameUpdateMessage["tileChanges"]) ?? [],
          };
          this.view.applyUpdateMessage(updateMsg);
          this.callbacks.onGameUpdate?.(updateMsg);
        }
        break;
      }

      case ServerMessageType.GameOver: {
        this._setPhase("gameover");
        break;
      }

      case ServerMessageType.Error: {
        this.callbacks.onError?.((data.message as string) ?? "Unknown error");
        break;
      }

      default:
        break;
    }
  }

  private _setPhase(phase: GamePhase): void {
    if (this._phase !== phase) {
      this._phase = phase;
      this.callbacks.onPhaseChange?.(phase);
    }
  }

  private _checkDesync(): void {
    const drift = Math.abs(this._lastServerTurn - this._lastClientTurn);
    if (drift > this.desyncThreshold && this._lastServerTurn > 0) {
      this.callbacks.onDesync?.(
        `Desync detected: server turn ${this._lastServerTurn}, client turn ${this._lastClientTurn}`,
      );
    }
  }
}
