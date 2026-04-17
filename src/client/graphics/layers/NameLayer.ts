import type { Layer } from "../Layer.js";

export interface EmpireLabel {
  playerID: number;
  name: string;
  /** World position for the label center. */
  worldX: number;
  worldY: number;
  color: string;
  isLeader: boolean;
  isAllied: boolean;
  isTarget: boolean;
}

export interface NameDataSource {
  getEmpireLabels(): EmpireLabel[];
  worldToScreen(worldX: number, worldY: number): { x: number; y: number };
}

/**
 * DOM-based empire name labels positioned over territory.
 * Draws in screen-space (shouldTransform = false) and uses
 * the data source's worldToScreen for positioning.
 */
export class NameLayer implements Layer {
  private _data: NameDataSource;
  private _container: HTMLElement | null = null;
  private _labelElements = new Map<number, HTMLElement>();

  constructor(data: NameDataSource, container?: HTMLElement) {
    this._data = data;
    this._container = container ?? null;
  }

  shouldTransform(): boolean {
    return false;
  }

  init(): void {
    if (!this._container && typeof document !== "undefined") {
      this._container = document.createElement("div");
      this._container.style.position = "absolute";
      this._container.style.top = "0";
      this._container.style.left = "0";
      this._container.style.pointerEvents = "none";
      this._container.style.overflow = "hidden";
      this._container.style.width = "100%";
      this._container.style.height = "100%";
    }
  }

  getTickIntervalMs(): number {
    return 50;
  }

  tick(): void {
    if (!this._container) return;

    const labels = this._data.getEmpireLabels();
    const activeIds = new Set<number>();

    for (const label of labels) {
      activeIds.add(label.playerID);
      const screen = this._data.worldToScreen(label.worldX, label.worldY);
      let el = this._labelElements.get(label.playerID);

      if (!el) {
        el = document.createElement("div");
        el.style.position = "absolute";
        el.style.whiteSpace = "nowrap";
        el.style.fontFamily = "sans-serif";
        el.style.fontSize = "13px";
        el.style.fontWeight = "bold";
        el.style.textShadow = "0 0 4px rgba(0,0,0,0.8)";
        el.style.pointerEvents = "none";
        el.style.transform = "translate(-50%, -50%)";
        this._container!.appendChild(el);
        this._labelElements.set(label.playerID, el);
      }

      // Build label text with icons
      let text = "";
      if (label.isLeader) text += "\u{1F451} "; // crown
      if (label.isAllied) text += "\u{1F91D} "; // handshake
      if (label.isTarget) text += "\u{1F3AF} "; // target
      text += label.name;

      el.textContent = text;
      el.style.left = `${screen.x}px`;
      el.style.top = `${screen.y}px`;
      el.style.color = label.color;
    }

    // Remove labels for players no longer present
    for (const [id, el] of this._labelElements) {
      if (!activeIds.has(id)) {
        el.remove();
        this._labelElements.delete(id);
      }
    }
  }

  /** NameLayer does not draw on canvas; positioning is DOM-based. */
  renderLayer(_ctx: CanvasRenderingContext2D): void {
    // Intentionally empty - this layer uses DOM elements
  }

  dispose(): void {
    for (const el of this._labelElements.values()) {
      el.remove();
    }
    this._labelElements.clear();
    if (this._container?.parentElement) {
      this._container.remove();
    }
    this._container = null;
  }

  /** Get the DOM container for external attachment. */
  getContainer(): HTMLElement | null {
    return this._container;
  }
}
