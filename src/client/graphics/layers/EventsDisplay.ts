import { LitElement, html, css, TemplateResult, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

export type EventCategory =
  | "attack"
  | "alliance"
  | "system"
  | "build"
  | "elimination"
  | "donation";

export interface GameEvent {
  id: string;
  message: string;
  category: EventCategory;
  timestamp: number;
  /** For alliance requests: player ID of the requester */
  allianceRequestFrom?: string;
}

const MAX_EVENTS = 30;
const EVENT_TTL_MS = 60_000;

const CATEGORY_COLORS: Record<EventCategory, string> = {
  attack: "#ef4444",
  alliance: "#22c55e",
  system: "#94a3b8",
  build: "#eab308",
  elimination: "#f97316",
  donation: "#8b5cf6",
};

@customElement("gf-events-display")
export class EventsDisplay extends LitElement {
  @state() private events: GameEvent[] = [];
  @property({ type: Boolean }) collapsed = false;

  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  static styles = css`
    :host {
      position: fixed;
      top: 24px;
      left: 16px;
      z-index: 600;
      pointer-events: auto;
    }

    .container {
      max-width: 320px;
      max-height: 360px;
      overflow-y: auto;
      overflow-x: hidden;
      font-family: "Inter", system-ui, sans-serif;
      scrollbar-width: thin;
      scrollbar-color: rgba(100, 116, 139, 0.3) transparent;
    }

    .container::-webkit-scrollbar {
      width: 4px;
    }

    .container::-webkit-scrollbar-thumb {
      background: rgba(100, 116, 139, 0.3);
      border-radius: 2px;
    }

    .event-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 6px 10px;
      margin-bottom: 2px;
      border-radius: 6px;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(8px);
      border-left: 3px solid;
      font-size: 12px;
      color: #cbd5e1;
      animation: slideIn 0.2s ease-out;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateX(-12px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    .event-msg {
      flex: 1;
      line-height: 1.4;
    }

    .event-time {
      font-size: 10px;
      color: #64748b;
      white-space: nowrap;
      margin-top: 1px;
    }

    .alliance-actions {
      display: flex;
      gap: 4px;
      margin-top: 4px;
    }

    .alliance-btn {
      padding: 2px 8px;
      border-radius: 4px;
      border: none;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.15s;
    }

    .alliance-btn:hover {
      opacity: 0.85;
    }

    .accept-btn {
      background: #22c55e;
      color: #052e16;
    }

    .reject-btn {
      background: #ef4444;
      color: #450a0a;
    }

    .toggle-btn {
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(148, 163, 184, 0.15);
      border-radius: 6px;
      padding: 4px 10px;
      color: #94a3b8;
      font-size: 11px;
      cursor: pointer;
      margin-bottom: 6px;
      font-family: "Inter", system-ui, sans-serif;
    }

    .toggle-btn:hover {
      background: rgba(30, 41, 59, 0.9);
      color: #e2e8f0;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    this.cleanupTimer = setInterval(() => this.pruneExpired(), 5000);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.cleanupTimer !== null) {
      clearInterval(this.cleanupTimer);
    }
  }

  addEvent(event: GameEvent): void {
    this.events = [event, ...this.events].slice(0, MAX_EVENTS);
  }

  private pruneExpired(): void {
    const now = Date.now();
    const filtered = this.events.filter(
      (e) => now - e.timestamp < EVENT_TTL_MS,
    );
    if (filtered.length !== this.events.length) {
      this.events = filtered;
    }
  }

  private handleAllianceResponse(eventId: string, accepted: boolean): void {
    this.dispatchEvent(
      new CustomEvent("alliance-response", {
        detail: { eventId, accepted },
        bubbles: true,
      }),
    );
    this.events = this.events.filter((e) => e.id !== eventId);
  }

  private formatTime(ts: number): string {
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 5) return "now";
    if (sec < 60) return `${sec}s`;
    return `${Math.floor(sec / 60)}m`;
  }

  protected render(): TemplateResult {
    return html`
      <button class="toggle-btn" @click=${() => (this.collapsed = !this.collapsed)}>
        ${this.collapsed ? "\u25B6 Events" : "\u25BC Events"} (${this.events.length})
      </button>
      ${this.collapsed
        ? nothing
        : html`
            <div class="container">
              ${this.events.map(
                (evt) => html`
                  <div
                    class="event-item"
                    style="border-left-color: ${CATEGORY_COLORS[evt.category]}"
                  >
                    <div class="event-msg">
                      ${evt.message}
                      ${evt.allianceRequestFrom
                        ? html`
                            <div class="alliance-actions">
                              <button
                                class="alliance-btn accept-btn"
                                @click=${() =>
                                  this.handleAllianceResponse(evt.id, true)}
                              >
                                Accept
                              </button>
                              <button
                                class="alliance-btn reject-btn"
                                @click=${() =>
                                  this.handleAllianceResponse(evt.id, false)}
                              >
                                Reject
                              </button>
                            </div>
                          `
                        : null}
                    </div>
                    <span class="event-time"
                      >${this.formatTime(evt.timestamp)}</span
                    >
                  </div>
                `,
              )}
            </div>
          `}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "gf-events-display": EventsDisplay;
  }
}
