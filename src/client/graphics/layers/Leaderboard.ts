import { LitElement, html, css, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

export interface LeaderboardEntry {
  playerId: string;
  name: string;
  color: string;
  planets: number;
  credits: number;
  population: number;
}

type SortKey = "planets" | "credits" | "population";

@customElement("gf-leaderboard")
export class Leaderboard extends LitElement {
  @property({ type: Array }) entries: LeaderboardEntry[] = [];
  @property({ type: String }) currentPlayerId = "";
  @state() private sortBy: SortKey = "planets";
  @property({ type: Boolean }) collapsed = false;

  static styles = css`
    :host {
      position: fixed;
      top: 24px;
      right: 16px;
      z-index: 600;
      pointer-events: auto;
    }

    .panel {
      background: rgba(15, 23, 42, 0.92);
      border: 1px solid rgba(148, 163, 184, 0.12);
      border-radius: 10px;
      padding: 10px;
      min-width: 240px;
      backdrop-filter: blur(12px);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      font-family: "Inter", system-ui, sans-serif;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 2px 6px 8px;
    }

    .title {
      font-size: 12px;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .sort-btns {
      display: flex;
      gap: 2px;
    }

    .sort-btn {
      padding: 2px 6px;
      border-radius: 4px;
      border: none;
      background: transparent;
      color: #64748b;
      font-size: 10px;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.1s;
    }

    .sort-btn:hover {
      color: #e2e8f0;
    }

    .sort-btn.active {
      background: rgba(99, 102, 241, 0.2);
      color: #818cf8;
    }

    .row {
      display: grid;
      grid-template-columns: 20px 1fr auto;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.1s;
      font-size: 12px;
    }

    .row:hover {
      background: rgba(99, 102, 241, 0.08);
    }

    .row.current {
      background: rgba(99, 102, 241, 0.12);
      border: 1px solid rgba(99, 102, 241, 0.2);
    }

    .rank {
      font-weight: 700;
      color: #64748b;
      text-align: center;
      font-size: 11px;
    }

    .rank-1 {
      color: #fbbf24;
    }
    .rank-2 {
      color: #94a3b8;
    }
    .rank-3 {
      color: #cd7f32;
    }

    .name {
      font-weight: 500;
      color: #e2e8f0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .score {
      font-variant-numeric: tabular-nums;
      font-weight: 600;
      color: #94a3b8;
      font-size: 11px;
    }

    .toggle-btn {
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(148, 163, 184, 0.15);
      border-radius: 6px;
      padding: 4px 10px;
      color: #94a3b8;
      font-size: 11px;
      cursor: pointer;
      font-family: "Inter", system-ui, sans-serif;
      margin-bottom: 6px;
    }

    .toggle-btn:hover {
      background: rgba(30, 41, 59, 0.9);
      color: #e2e8f0;
    }
  `;

  private get sortedTop5(): LeaderboardEntry[] {
    return [...this.entries]
      .sort((a, b) => b[this.sortBy] - a[this.sortBy])
      .slice(0, 5);
  }

  private handleRowClick(entry: LeaderboardEntry): void {
    this.dispatchEvent(
      new CustomEvent("leaderboard-navigate", {
        detail: { playerId: entry.playerId },
        bubbles: true,
      }),
    );
  }

  private rankClass(i: number): string {
    if (i === 0) return "rank rank-1";
    if (i === 1) return "rank rank-2";
    if (i === 2) return "rank rank-3";
    return "rank";
  }

  private formatScore(entry: LeaderboardEntry): string {
    const val = entry[this.sortBy];
    if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
    return String(val);
  }

  protected render(): TemplateResult {
    const top5 = this.sortedTop5;

    return html`
      <button
        class="toggle-btn"
        @click=${() => (this.collapsed = !this.collapsed)}
      >
        ${this.collapsed ? "\u25C0 Leaderboard" : "\u25B6 Leaderboard"}
      </button>

      ${!this.collapsed
        ? html`
            <div class="panel">
              <div class="header">
                <span class="title">Top 5</span>
                <div class="sort-btns">
                  ${(["planets", "credits", "population"] as SortKey[]).map(
                    (key) => html`
                      <button
                        class="sort-btn ${this.sortBy === key ? "active" : ""}"
                        @click=${() => (this.sortBy = key)}
                      >
                        ${key.charAt(0).toUpperCase() + key.slice(1, 4)}
                      </button>
                    `,
                  )}
                </div>
              </div>

              ${top5.map(
                (entry, i) => html`
                  <div
                    class="row ${entry.playerId === this.currentPlayerId ? "current" : ""}"
                    @click=${() => this.handleRowClick(entry)}
                  >
                    <span class="${this.rankClass(i)}">#${i + 1}</span>
                    <span class="name" style="color: ${entry.color}">
                      ${entry.name}
                    </span>
                    <span class="score">${this.formatScore(entry)}</span>
                  </div>
                `,
              )}
            </div>
          `
        : null}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "gf-leaderboard": Leaderboard;
  }
}
