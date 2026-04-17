import { LitElement, html, css, TemplateResult, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

export interface GameStats {
  duration: string;
  planetsOwned: number;
  troopsDeployed: number;
  attacksLaunched: number;
  alliancesFormed: number;
}

@customElement("gf-win-modal")
export class WinModal extends LitElement {
  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: Boolean }) victory = false;
  @property({ type: String }) winnerName = "";
  @property({ type: String }) winnerColor = "#6366f1";
  @property({ type: Boolean }) ranked = false;
  @property({ attribute: false }) stats: GameStats = {
    duration: "0:00",
    planetsOwned: 0,
    troopsDeployed: 0,
    attacksLaunched: 0,
    alliancesFormed: 0,
  };

  static styles = css`
    :host {
      display: contents;
    }

    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 950;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(10px);
      animation: fadeIn 0.3s ease-out;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @keyframes scaleIn {
      from {
        opacity: 0;
        transform: scale(0.9);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    .panel {
      background: linear-gradient(
        135deg,
        rgba(15, 23, 42, 0.97),
        rgba(30, 41, 59, 0.95)
      );
      border: 1px solid rgba(148, 163, 184, 0.15);
      border-radius: 16px;
      padding: 32px 40px;
      text-align: center;
      min-width: 340px;
      max-width: 90vw;
      box-shadow:
        0 25px 60px rgba(0, 0, 0, 0.6),
        0 0 80px rgba(99, 102, 241, 0.08);
      animation: scaleIn 0.3s ease-out;
      font-family: "Inter", system-ui, sans-serif;
    }

    .result-icon {
      font-size: 48px;
      margin-bottom: 12px;
    }

    .result-text {
      font-size: 28px;
      font-weight: 800;
      margin-bottom: 4px;
      letter-spacing: -0.02em;
    }

    .victory-text {
      background: linear-gradient(135deg, #fbbf24, #f59e0b);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .defeat-text {
      color: #94a3b8;
    }

    .winner-name {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 20px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 24px;
    }

    .stat-card {
      background: rgba(51, 65, 85, 0.3);
      border: 1px solid rgba(148, 163, 184, 0.08);
      border-radius: 8px;
      padding: 10px;
    }

    .stat-label {
      font-size: 10px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .stat-val {
      font-size: 18px;
      font-weight: 700;
      color: #e2e8f0;
      font-variant-numeric: tabular-nums;
      margin-top: 2px;
    }

    .actions {
      display: flex;
      gap: 10px;
      justify-content: center;
    }

    .btn {
      padding: 10px 24px;
      border-radius: 8px;
      border: none;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.15s;
    }

    .btn-primary {
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      color: white;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
    }

    .btn-primary:hover {
      background: linear-gradient(135deg, #818cf8, #6366f1);
      box-shadow: 0 4px 16px rgba(99, 102, 241, 0.4);
    }

    .btn-secondary {
      background: rgba(51, 65, 85, 0.5);
      color: #cbd5e1;
      border: 1px solid rgba(148, 163, 184, 0.15);
    }

    .btn-secondary:hover {
      background: rgba(71, 85, 105, 0.5);
    }

    .duration-full {
      grid-column: 1 / -1;
    }
  `;

  show(): void {
    this.open = true;
  }

  close(): void {
    this.open = false;
  }

  private handleRequeue(): void {
    this.dispatchEvent(
      new CustomEvent("requeue", { bubbles: true }),
    );
    this.close();
  }

  private handleExit(): void {
    this.dispatchEvent(
      new CustomEvent("exit-game", { bubbles: true }),
    );
    this.close();
  }

  protected render(): TemplateResult | typeof nothing {
    if (!this.open) return nothing;

    const s = this.stats;

    return html`
      <div class="backdrop">
        <div class="panel">
          <div class="result-icon">${this.victory ? "\u{1F3C6}" : "\u{1F4A5}"}</div>
          <div
            class="result-text ${this.victory ? "victory-text" : "defeat-text"}"
          >
            ${this.victory ? "VICTORY" : "DEFEAT"}
          </div>
          <div class="winner-name" style="color: ${this.winnerColor}">
            ${this.victory
              ? "You conquered the galaxy!"
              : `${this.winnerName} wins`}
          </div>

          <div class="stats-grid">
            <div class="stat-card duration-full">
              <div class="stat-label">Duration</div>
              <div class="stat-val">${s.duration}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Planets</div>
              <div class="stat-val">${s.planetsOwned}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Troops</div>
              <div class="stat-val">${s.troopsDeployed.toLocaleString()}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Attacks</div>
              <div class="stat-val">${s.attacksLaunched}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Alliances</div>
              <div class="stat-val">${s.alliancesFormed}</div>
            </div>
          </div>

          <div class="actions">
            ${this.ranked
              ? html`<button class="btn btn-primary" @click=${this.handleRequeue}>
                  Requeue
                </button>`
              : null}
            <button class="btn btn-secondary" @click=${this.handleExit}>
              Exit to Menu
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "gf-win-modal": WinModal;
  }
}
