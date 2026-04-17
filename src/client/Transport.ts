/**
 * WebSocket transport abstraction with reconnection, message queuing, and keepalive.
 */

export interface TransportOptions {
  url: string;
  onMessage?: (msg: unknown) => void;
  onOpen?: () => void;
  onClose?: (code: number, reason: string) => void;
}

export class Transport {
  private ws: WebSocket | null = null;
  private url: string;
  private queue: string[] = [];
  private reconnectDelay = 1000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private _connected = false;
  private _closed = false;

  onMessage: ((msg: unknown) => void) | null = null;
  onOpen: (() => void) | null = null;
  onClose: ((code: number, reason: string) => void) | null = null;

  constructor() {
    this.url = "";
  }

  get connected(): boolean {
    return this._connected;
  }

  connect(url: string): void {
    this.url = url;
    this._closed = false;
    this.reconnectDelay = 1000;
    this._openSocket();
  }

  disconnect(): void {
    this._closed = true;
    this._stopPing();
    this._clearReconnect();
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
    this._connected = false;
  }

  send(msg: unknown): void {
    const serialized = JSON.stringify(msg);
    if (this._connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(serialized);
    } else {
      this.queue.push(serialized);
    }
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  private _openSocket(): void {
    if (this._closed) return;
    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this._scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this._connected = true;
      this.reconnectDelay = 1000;
      this._startPing();
      this._flushQueue();
      this.onOpen?.();
    };

    this.ws.onmessage = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data as string);
        this.onMessage?.(data);
      } catch {
        // Ignore malformed messages
      }
    };

    this.ws.onclose = (ev: CloseEvent) => {
      this._connected = false;
      this._stopPing();
      this.onClose?.(ev.code, ev.reason);
      if (!this._closed) {
        this._scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // Error is followed by close event
    };
  }

  private _flushQueue(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const toSend = this.queue.splice(0);
    for (const msg of toSend) {
      this.ws.send(msg);
    }
  }

  private _scheduleReconnect(): void {
    if (this._closed) return;
    this._clearReconnect();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
      this._openSocket();
    }, this.reconnectDelay);
  }

  private _clearReconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private _startPing(): void {
    this._stopPing();
    this.pingTimer = setInterval(() => {
      if (this._connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 5000);
  }

  private _stopPing(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}
