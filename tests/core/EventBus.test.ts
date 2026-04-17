import { describe, it, expect, vi } from "vitest";
import { EventBus } from "@core/EventBus";

describe("EventBus", () => {
  describe("on() and emit()", () => {
    it("calls handler when event is emitted", () => {
      const bus = new EventBus();
      const handler = vi.fn();
      bus.on("test", handler);
      bus.emit("test", 42);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(42);
    });

    it("calls multiple handlers for the same event", () => {
      const bus = new EventBus();
      const h1 = vi.fn();
      const h2 = vi.fn();
      bus.on("ev", h1);
      bus.on("ev", h2);
      bus.emit("ev", "data");
      expect(h1).toHaveBeenCalledWith("data");
      expect(h2).toHaveBeenCalledWith("data");
    });

    it("does not call handlers for different events", () => {
      const bus = new EventBus();
      const h1 = vi.fn();
      const h2 = vi.fn();
      bus.on("event-a", h1);
      bus.on("event-b", h2);
      bus.emit("event-a", 1);
      expect(h1).toHaveBeenCalledTimes(1);
      expect(h2).not.toHaveBeenCalled();
    });

    it("emitting with no listeners does not throw", () => {
      const bus = new EventBus();
      expect(() => bus.emit("no-one-listening", {})).not.toThrow();
    });

    it("passes data of any type", () => {
      const bus = new EventBus();
      const handler = vi.fn();
      const obj = { x: 1, y: 2 };
      bus.on("obj-event", handler);
      bus.emit("obj-event", obj);
      expect(handler).toHaveBeenCalledWith(obj);
    });
  });

  describe("on() unsubscribe", () => {
    it("returns an unsubscribe function", () => {
      const bus = new EventBus();
      const handler = vi.fn();
      const unsub = bus.on("ev", handler);
      expect(typeof unsub).toBe("function");
    });

    it("unsubscribing stops handler from being called", () => {
      const bus = new EventBus();
      const handler = vi.fn();
      const unsub = bus.on("ev", handler);
      bus.emit("ev", 1);
      unsub();
      bus.emit("ev", 2);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("unsubscribing one handler leaves others intact", () => {
      const bus = new EventBus();
      const h1 = vi.fn();
      const h2 = vi.fn();
      const unsub1 = bus.on("ev", h1);
      bus.on("ev", h2);
      unsub1();
      bus.emit("ev", "x");
      expect(h1).not.toHaveBeenCalled();
      expect(h2).toHaveBeenCalledWith("x");
    });

    it("calling unsubscribe twice does not throw", () => {
      const bus = new EventBus();
      const unsub = bus.on("ev", vi.fn());
      expect(() => { unsub(); unsub(); }).not.toThrow();
    });
  });

  describe("once()", () => {
    it("fires only once", () => {
      const bus = new EventBus();
      const handler = vi.fn();
      bus.once("ev", handler);
      bus.emit("ev", 1);
      bus.emit("ev", 2);
      bus.emit("ev", 3);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(1);
    });

    it("returns an unsubscribe function that prevents the single fire", () => {
      const bus = new EventBus();
      const handler = vi.fn();
      const unsub = bus.once("ev", handler);
      unsub();
      bus.emit("ev", 1);
      expect(handler).not.toHaveBeenCalled();
    });

    it("multiple once handlers each fire once independently", () => {
      const bus = new EventBus();
      const h1 = vi.fn();
      const h2 = vi.fn();
      bus.once("ev", h1);
      bus.once("ev", h2);
      bus.emit("ev", "a");
      bus.emit("ev", "b");
      expect(h1).toHaveBeenCalledTimes(1);
      expect(h2).toHaveBeenCalledTimes(1);
    });

    it("once and on can coexist for the same event", () => {
      const bus = new EventBus();
      const onceHandler = vi.fn();
      const onHandler = vi.fn();
      bus.once("ev", onceHandler);
      bus.on("ev", onHandler);
      bus.emit("ev", 1);
      bus.emit("ev", 2);
      expect(onceHandler).toHaveBeenCalledTimes(1);
      expect(onHandler).toHaveBeenCalledTimes(2);
    });
  });

  describe("off()", () => {
    it("removes all handlers for a specific event", () => {
      const bus = new EventBus();
      const h1 = vi.fn();
      const h2 = vi.fn();
      bus.on("ev", h1);
      bus.on("ev", h2);
      bus.off("ev");
      bus.emit("ev", 1);
      expect(h1).not.toHaveBeenCalled();
      expect(h2).not.toHaveBeenCalled();
    });

    it("off on a non-existent event does not throw", () => {
      const bus = new EventBus();
      expect(() => bus.off("nothing")).not.toThrow();
    });

    it("off does not affect other events", () => {
      const bus = new EventBus();
      const hA = vi.fn();
      const hB = vi.fn();
      bus.on("a", hA);
      bus.on("b", hB);
      bus.off("a");
      bus.emit("b", 1);
      expect(hA).not.toHaveBeenCalled();
      expect(hB).toHaveBeenCalledTimes(1);
    });
  });

  describe("clear()", () => {
    it("removes all handlers for all events", () => {
      const bus = new EventBus();
      const h1 = vi.fn();
      const h2 = vi.fn();
      bus.on("a", h1);
      bus.on("b", h2);
      bus.clear();
      bus.emit("a", 1);
      bus.emit("b", 2);
      expect(h1).not.toHaveBeenCalled();
      expect(h2).not.toHaveBeenCalled();
    });

    it("can subscribe again after clear", () => {
      const bus = new EventBus();
      const handler = vi.fn();
      bus.on("ev", vi.fn());
      bus.clear();
      bus.on("ev", handler);
      bus.emit("ev", "x");
      expect(handler).toHaveBeenCalledWith("x");
    });
  });

  describe("listenerCount()", () => {
    it("returns 0 for unknown event", () => {
      const bus = new EventBus();
      expect(bus.listenerCount("none")).toBe(0);
    });

    it("returns correct count after subscriptions", () => {
      const bus = new EventBus();
      bus.on("ev", vi.fn());
      bus.on("ev", vi.fn());
      expect(bus.listenerCount("ev")).toBe(2);
    });

    it("decrements after unsubscribe", () => {
      const bus = new EventBus();
      const unsub = bus.on("ev", vi.fn());
      bus.on("ev", vi.fn());
      unsub();
      expect(bus.listenerCount("ev")).toBe(1);
    });

    it("returns 0 after off()", () => {
      const bus = new EventBus();
      bus.on("ev", vi.fn());
      bus.off("ev");
      expect(bus.listenerCount("ev")).toBe(0);
    });

    it("returns 0 after clear()", () => {
      const bus = new EventBus();
      bus.on("ev", vi.fn());
      bus.on("other", vi.fn());
      bus.clear();
      expect(bus.listenerCount("ev")).toBe(0);
      expect(bus.listenerCount("other")).toBe(0);
    });

    it("once handler reduces count after firing", () => {
      const bus = new EventBus();
      bus.once("ev", vi.fn());
      expect(bus.listenerCount("ev")).toBe(1);
      bus.emit("ev", null);
      expect(bus.listenerCount("ev")).toBe(0);
    });
  });
});
