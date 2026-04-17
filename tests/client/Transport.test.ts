import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Transport } from "@client/Transport";

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onclose: ((ev: { code: number; reason: string }) => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
  }

  // Test helpers
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  simulateClose(code = 1000, reason = "") {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code, reason });
  }

  static instances: MockWebSocket[] = [];
  static reset() {
    MockWebSocket.instances = [];
  }
}

describe("Transport", () => {
  let transport: Transport;

  beforeEach(() => {
    MockWebSocket.reset();
    vi.useFakeTimers();
    (globalThis as any).WebSocket = MockWebSocket;
    transport = new Transport();
  });

  afterEach(() => {
    transport.disconnect();
    vi.useRealTimers();
    delete (globalThis as any).WebSocket;
  });

  it("should connect and call onOpen", () => {
    const onOpen = vi.fn();
    transport.onOpen = onOpen;
    transport.connect("ws://localhost:9000");

    const ws = MockWebSocket.instances[0]!;
    ws.simulateOpen();

    expect(transport.connected).toBe(true);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("should send messages as JSON", () => {
    transport.connect("ws://localhost:9000");
    const ws = MockWebSocket.instances[0]!;
    ws.simulateOpen();

    transport.send({ type: "test", value: 42 });
    expect(ws.sent).toHaveLength(1);
    expect(JSON.parse(ws.sent[0]!)).toEqual({ type: "test", value: 42 });
  });

  it("should queue messages when disconnected and flush on reconnect", () => {
    transport.connect("ws://localhost:9000");

    // Send before open - should queue
    transport.send({ type: "queued1" });
    transport.send({ type: "queued2" });
    expect(transport.getQueueSize()).toBe(2);

    const ws = MockWebSocket.instances[0]!;
    ws.simulateOpen();

    // Queue should be flushed
    expect(transport.getQueueSize()).toBe(0);
    expect(ws.sent.length).toBe(2);
    expect(JSON.parse(ws.sent[0]!)).toEqual({ type: "queued1" });
    expect(JSON.parse(ws.sent[1]!)).toEqual({ type: "queued2" });
  });

  it("should parse incoming messages and call onMessage", () => {
    const onMessage = vi.fn();
    transport.onMessage = onMessage;
    transport.connect("ws://localhost:9000");

    const ws = MockWebSocket.instances[0]!;
    ws.simulateOpen();
    ws.simulateMessage({ type: "hello", data: [1, 2, 3] });

    expect(onMessage).toHaveBeenCalledWith({ type: "hello", data: [1, 2, 3] });
  });

  it("should reconnect with exponential backoff", () => {
    transport.connect("ws://localhost:9000");
    const ws1 = MockWebSocket.instances[0]!;
    ws1.simulateClose(1006, "abnormal");

    expect(MockWebSocket.instances).toHaveLength(1);

    // After 1s delay
    vi.advanceTimersByTime(1000);
    expect(MockWebSocket.instances).toHaveLength(2);

    // Close again
    MockWebSocket.instances[1]!.simulateClose(1006, "");

    // After 2s delay (doubled)
    vi.advanceTimersByTime(1999);
    expect(MockWebSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(MockWebSocket.instances).toHaveLength(3);
  });

  it("should cap reconnect delay at 30s", () => {
    transport.connect("ws://localhost:9000");

    // Simulate many disconnects to push delay past 30s
    for (let i = 0; i < 10; i++) {
      const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1]!;
      ws.simulateClose(1006, "");
      vi.advanceTimersByTime(30000);
    }

    // The delay should be capped at 30s, not growing beyond
    const count = MockWebSocket.instances.length;
    const ws = MockWebSocket.instances[count - 1]!;
    ws.simulateClose(1006, "");
    vi.advanceTimersByTime(30000);
    expect(MockWebSocket.instances.length).toBe(count + 1);
  });

  it("should call onClose when disconnected", () => {
    const onClose = vi.fn();
    transport.onClose = onClose;
    transport.connect("ws://localhost:9000");

    const ws = MockWebSocket.instances[0]!;
    ws.simulateOpen();
    ws.simulateClose(1000, "normal");

    expect(onClose).toHaveBeenCalledWith(1000, "normal");
  });

  it("should not reconnect after explicit disconnect", () => {
    transport.connect("ws://localhost:9000");
    transport.disconnect();

    vi.advanceTimersByTime(60000);
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("should send keepalive pings every 5s", () => {
    transport.connect("ws://localhost:9000");
    const ws = MockWebSocket.instances[0]!;
    ws.simulateOpen();

    // Clear any existing sent messages
    ws.sent = [];

    vi.advanceTimersByTime(5000);
    expect(ws.sent.length).toBe(1);
    expect(JSON.parse(ws.sent[0]!)).toEqual({ type: "ping" });

    vi.advanceTimersByTime(5000);
    expect(ws.sent.length).toBe(2);
  });
});
