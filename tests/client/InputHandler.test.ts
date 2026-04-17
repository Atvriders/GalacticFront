import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  InputHandler,
  DEFAULT_KEYBINDS,
  isMac,
  getModifierKey,
} from "@client/InputHandler";

describe("InputHandler", () => {
  let handler: InputHandler;

  beforeEach(() => {
    // Mock localStorage
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => {
        store[key] = val;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
    });
    handler = new InputHandler();
  });

  it("should load default keybinds", () => {
    expect(handler.getKeybind("move_up")).toBe("w");
    expect(handler.getKeybind("attack")).toBe("q");
    expect(handler.getKeybind("toggle_pause")).toBe(" ");
  });

  it("should set and get custom keybind", () => {
    handler.setKeybind("attack", "z");
    expect(handler.getKeybind("attack")).toBe("z");
    expect(handler.getAction("z")).toBe("attack");
  });

  it("should resolve action from key", () => {
    expect(handler.getAction("w")).toBe("move_up");
    expect(handler.getAction("q")).toBe("attack");
    expect(handler.getAction("nonexistent")).toBeUndefined();
  });

  it("should persist keybinds to localStorage", () => {
    handler.setKeybind("zoom_in", "x");
    const stored = JSON.parse(localStorage.getItem("gf_keybinds")!);
    expect(stored.zoom_in).toBe("x");
  });

  it("should have all default keybinds", () => {
    const keys = Object.keys(DEFAULT_KEYBINDS);
    expect(keys.length).toBeGreaterThanOrEqual(36);
  });

  it("getModifierKey returns platform-appropriate key", () => {
    // In test environment, navigator may not be defined
    const mod = getModifierKey();
    expect(["Control", "Meta"]).toContain(mod);
  });

  it("isMac returns a boolean", () => {
    expect(typeof isMac()).toBe("boolean");
  });

  it("should register and unregister input callbacks", () => {
    const cb = vi.fn();
    const unsub = handler.onInput(cb);
    expect(typeof unsub).toBe("function");
    unsub();
  });

  it("should register and unregister key action callbacks", () => {
    const cb = vi.fn();
    const unsub = handler.onKeyAction(cb);
    expect(typeof unsub).toBe("function");
    unsub();
  });
});
