/**
 * Keyboard + mouse + touch input handler with customizable keybinds.
 */

const KEYBINDS_KEY = "gf_keybinds";

// ── Event Types ────────────────────────────────────────────────────────────

export interface MouseUpEvent {
  kind: "mouseup";
  x: number;
  y: number;
  button: number;
}

export interface MouseDownEvent {
  kind: "mousedown";
  x: number;
  y: number;
  button: number;
}

export interface DragEvent {
  kind: "drag";
  dx: number;
  dy: number;
  x: number;
  y: number;
}

export interface ZoomEvent {
  kind: "zoom";
  delta: number;
  x: number;
  y: number;
}

export interface ContextMenuEvent {
  kind: "contextmenu";
  x: number;
  y: number;
}

export type InputEvent =
  | MouseUpEvent
  | MouseDownEvent
  | DragEvent
  | ZoomEvent
  | ContextMenuEvent;

// ── Default Keybinds ───────────────────────────────────────────────────────

export const DEFAULT_KEYBINDS: Record<string, string> = {
  move_up: "w",
  move_down: "s",
  move_left: "a",
  move_right: "d",
  zoom_in: "=",
  zoom_out: "-",
  attack: "q",
  cancel_attack: "Escape",
  retreat: "r",
  build_colony: "1",
  build_starport: "2",
  build_forge: "3",
  build_shield: "4",
  build_superweapon: "5",
  build_interceptor: "6",
  build_wormhole: "7",
  build_hyperloop: "8",
  toggle_pause: " ",
  speed_up: "]",
  speed_down: "[",
  chat: "Enter",
  emoji_menu: "e",
  alliance_menu: "t",
  surrender: "",
  ping: "p",
  select_all: "ctrl+a",
  deselect: "Escape",
  upgrade_unit: "u",
  destroy_unit: "Delete",
  activate_unit: "f",
  toggle_hud: "h",
  fullscreen: "F11",
  screenshot: "F12",
  minimap_toggle: "m",
  leaderboard_toggle: "l",
  donate: "g",
  embargo: "x",
};

// ── Platform Detection ─────────────────────────────────────────────────────

export function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform ?? "");
}

export function getModifierKey(): string {
  return isMac() ? "Meta" : "Control";
}

// ── InputHandler ───────────────────────────────────────────────────────────

export type InputCallback = (event: InputEvent) => void;
export type KeyActionCallback = (action: string) => void;

export class InputHandler {
  private keybinds: Record<string, string>;
  private reverseMap: Map<string, string> = new Map();
  private element: HTMLElement | null = null;
  private inputCallbacks: InputCallback[] = [];
  private keyActionCallbacks: KeyActionCallback[] = [];
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private pinchStartDist = 0;
  private attached = false;

  // Bound handlers for cleanup
  private _onKeyDown = this.handleKeyDown.bind(this);
  private _onMouseDown = this.handleMouseDown.bind(this);
  private _onMouseUp = this.handleMouseUp.bind(this);
  private _onMouseMove = this.handleMouseMove.bind(this);
  private _onWheel = this.handleWheel.bind(this);
  private _onContextMenu = this.handleContextMenu.bind(this);
  private _onTouchStart = this.handleTouchStart.bind(this);
  private _onTouchMove = this.handleTouchMove.bind(this);
  private _onTouchEnd = this.handleTouchEnd.bind(this);

  constructor() {
    this.keybinds = this.loadKeybinds();
    this.buildReverseMap();
  }

  private loadKeybinds(): Record<string, string> {
    if (typeof localStorage === "undefined") return { ...DEFAULT_KEYBINDS };
    try {
      const stored = localStorage.getItem(KEYBINDS_KEY);
      if (stored) {
        return { ...DEFAULT_KEYBINDS, ...JSON.parse(stored) };
      }
    } catch {
      // ignore
    }
    return { ...DEFAULT_KEYBINDS };
  }

  private buildReverseMap(): void {
    this.reverseMap.clear();
    for (const [action, key] of Object.entries(this.keybinds)) {
      if (key) {
        this.reverseMap.set(key.toLowerCase(), action);
      }
    }
  }

  getKeybind(action: string): string | undefined {
    return this.keybinds[action];
  }

  setKeybind(action: string, key: string): void {
    this.keybinds[action] = key;
    this.buildReverseMap();
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(KEYBINDS_KEY, JSON.stringify(this.keybinds));
    }
  }

  getAction(key: string): string | undefined {
    return this.reverseMap.get(key.toLowerCase());
  }

  onInput(callback: InputCallback): () => void {
    this.inputCallbacks.push(callback);
    return () => {
      const idx = this.inputCallbacks.indexOf(callback);
      if (idx >= 0) this.inputCallbacks.splice(idx, 1);
    };
  }

  onKeyAction(callback: KeyActionCallback): () => void {
    this.keyActionCallbacks.push(callback);
    return () => {
      const idx = this.keyActionCallbacks.indexOf(callback);
      if (idx >= 0) this.keyActionCallbacks.splice(idx, 1);
    };
  }

  attach(element: HTMLElement): void {
    if (this.attached) this.detach();
    this.element = element;
    this.attached = true;

    document.addEventListener("keydown", this._onKeyDown);
    element.addEventListener("mousedown", this._onMouseDown);
    element.addEventListener("mouseup", this._onMouseUp);
    element.addEventListener("mousemove", this._onMouseMove);
    element.addEventListener("wheel", this._onWheel, { passive: false });
    element.addEventListener("contextmenu", this._onContextMenu);
    element.addEventListener("touchstart", this._onTouchStart, {
      passive: false,
    });
    element.addEventListener("touchmove", this._onTouchMove, {
      passive: false,
    });
    element.addEventListener("touchend", this._onTouchEnd);
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;

    document.removeEventListener("keydown", this._onKeyDown);
    if (this.element) {
      this.element.removeEventListener("mousedown", this._onMouseDown);
      this.element.removeEventListener("mouseup", this._onMouseUp);
      this.element.removeEventListener("mousemove", this._onMouseMove);
      this.element.removeEventListener("wheel", this._onWheel);
      this.element.removeEventListener("contextmenu", this._onContextMenu);
      this.element.removeEventListener("touchstart", this._onTouchStart);
      this.element.removeEventListener("touchmove", this._onTouchMove);
      this.element.removeEventListener("touchend", this._onTouchEnd);
    }
    this.element = null;
  }

  private emit(event: InputEvent): void {
    for (const cb of this.inputCallbacks) {
      cb(event);
    }
  }

  private emitAction(action: string): void {
    for (const cb of this.keyActionCallbacks) {
      cb(action);
    }
  }

  private handleKeyDown(ev: KeyboardEvent): void {
    // Build key string with modifiers
    const parts: string[] = [];
    if (ev.ctrlKey || ev.metaKey) parts.push("ctrl");
    if (ev.shiftKey) parts.push("shift");
    if (ev.altKey) parts.push("alt");

    const key = ev.key;
    if (!["Control", "Meta", "Shift", "Alt"].includes(key)) {
      parts.push(key.toLowerCase());
    }

    const keyStr = parts.join("+");
    const action = this.reverseMap.get(keyStr);
    if (action) {
      this.emitAction(action);
    }
  }

  private handleMouseDown(ev: MouseEvent): void {
    this.dragging = true;
    this.lastX = ev.clientX;
    this.lastY = ev.clientY;
    this.emit({ kind: "mousedown", x: ev.clientX, y: ev.clientY, button: ev.button });
  }

  private handleMouseUp(ev: MouseEvent): void {
    this.dragging = false;
    this.emit({ kind: "mouseup", x: ev.clientX, y: ev.clientY, button: ev.button });
  }

  private handleMouseMove(ev: MouseEvent): void {
    if (this.dragging) {
      const dx = ev.clientX - this.lastX;
      const dy = ev.clientY - this.lastY;
      this.lastX = ev.clientX;
      this.lastY = ev.clientY;
      this.emit({ kind: "drag", dx, dy, x: ev.clientX, y: ev.clientY });
    }
  }

  private handleWheel(ev: WheelEvent): void {
    ev.preventDefault();
    this.emit({ kind: "zoom", delta: ev.deltaY, x: ev.clientX, y: ev.clientY });
  }

  private handleContextMenu(ev: Event): void {
    ev.preventDefault();
    const me = ev as MouseEvent;
    this.emit({ kind: "contextmenu", x: me.clientX, y: me.clientY });
  }

  private handleTouchStart(ev: TouchEvent): void {
    if (ev.touches.length === 1) {
      const touch = ev.touches[0]!;
      this.dragging = true;
      this.lastX = touch.clientX;
      this.lastY = touch.clientY;
      this.emit({
        kind: "mousedown",
        x: touch.clientX,
        y: touch.clientY,
        button: 0,
      });
    } else if (ev.touches.length === 2) {
      ev.preventDefault();
      const [t1, t2] = [ev.touches[0]!, ev.touches[1]!];
      this.pinchStartDist = Math.hypot(
        t2.clientX - t1.clientX,
        t2.clientY - t1.clientY,
      );
    }
  }

  private handleTouchMove(ev: TouchEvent): void {
    if (ev.touches.length === 1 && this.dragging) {
      const touch = ev.touches[0]!;
      const dx = touch.clientX - this.lastX;
      const dy = touch.clientY - this.lastY;
      this.lastX = touch.clientX;
      this.lastY = touch.clientY;
      this.emit({
        kind: "drag",
        dx,
        dy,
        x: touch.clientX,
        y: touch.clientY,
      });
    } else if (ev.touches.length === 2) {
      ev.preventDefault();
      const [t1, t2] = [ev.touches[0]!, ev.touches[1]!];
      const dist = Math.hypot(
        t2.clientX - t1.clientX,
        t2.clientY - t1.clientY,
      );
      const midX = (t1.clientX + t2.clientX) / 2;
      const midY = (t1.clientY + t2.clientY) / 2;
      const delta = this.pinchStartDist - dist;
      this.pinchStartDist = dist;
      this.emit({ kind: "zoom", delta, x: midX, y: midY });
    }
  }

  private handleTouchEnd(_ev: TouchEvent): void {
    this.dragging = false;
  }
}
