import { WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
import type { ClientID } from "../core/Schemas.js";

export class Client {
  public readonly clientId: string;
  public latencyMs: number = 0;
  public connected: boolean = true;
  public disconnectedAt: number | null = null;

  private ws: WebSocket;
  private lastPingSent: number = 0;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private messageHandler: ((data: unknown) => void) | null = null;

  constructor(ws: WebSocket) {
    this.clientId = uuidv4();
    this.ws = ws;

    this.ws.on("pong", () => {
      this.latencyMs = Date.now() - this.lastPingSent;
    });

    this.ws.on("message", (raw: Buffer | string) => {
      try {
        const data = JSON.parse(raw.toString());
        if (this.messageHandler) {
          this.messageHandler(data);
        }
      } catch {
        // ignore malformed messages
      }
    });

    this.ws.on("close", () => {
      this.connected = false;
      this.disconnectedAt = Date.now();
      this.stopPing();
    });

    this.ws.on("error", () => {
      this.connected = false;
      this.disconnectedAt = Date.now();
      this.stopPing();
    });

    this.startPing();
  }

  onMessage(handler: (data: unknown) => void): void {
    this.messageHandler = handler;
  }

  send(data: unknown): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  close(code?: number, reason?: string): void {
    this.stopPing();
    this.ws.close(code, reason);
  }

  /** Reconnect this client with a new WebSocket */
  reconnect(ws: WebSocket): void {
    this.ws = ws;
    this.connected = true;
    this.disconnectedAt = null;

    this.ws.on("pong", () => {
      this.latencyMs = Date.now() - this.lastPingSent;
    });

    this.ws.on("message", (raw: Buffer | string) => {
      try {
        const data = JSON.parse(raw.toString());
        if (this.messageHandler) {
          this.messageHandler(data);
        }
      } catch {
        // ignore
      }
    });

    this.ws.on("close", () => {
      this.connected = false;
      this.disconnectedAt = Date.now();
      this.stopPing();
    });

    this.ws.on("error", () => {
      this.connected = false;
      this.disconnectedAt = Date.now();
      this.stopPing();
    });

    this.startPing();
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.lastPingSent = Date.now();
        this.ws.ping();
      }
    }, 5000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}
