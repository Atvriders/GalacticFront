import { LitElement, html, css, TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("gf-control-panel")
export class ControlPanel extends LitElement {
  @property({ type: Number }) troops = 0;
  @property({ type: Number }) maxTroops = 100;
  @property({ type: Number }) popRate = 0;
  @property({ type: Number }) credits = 0;
  @property({ type: Number }) attackRatio = 50;

  static styles = css`
    :host {
      position: fixed;
      bottom: 16px;
      left: 16px;
      z-index: 600;
      pointer-events: auto;
    }

    .panel {
      background: linear-gradient(
        135deg,
        rgba(15, 23, 42, 0.92),
        rgba(30, 41, 59, 0.88)
      );
      border: 1px solid rgba(148, 163, 184, 0.15);
      border-radius: 10px;
      padding: 14px 16px;
      min-width: 220px;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      font-family: "Inter", system-ui, sans-serif;
      color: #e2e8f0;
    }

    .stat-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
    }

    .stat-label {
      font-size: 11px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 500;
    }

    .stat-value {
      font-size: 14px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    .troop-bar-bg {
      width: 100%;
      height: 6px;
      background: rgba(51, 65, 85, 0.6);
      border-radius: 3px;
      overflow: hidden;
      margin-top: 4px;
      margin-bottom: 10px;
    }

    .troop-bar-fill {
      height: 100%;
      border-radius: 3px;
      background: linear-gradient(90deg, #6366f1, #818cf8);
      transition: width 0.3s ease;
    }

    .pop-rate {
      font-variant-numeric: tabular-nums;
    }

    .pop-positive {
      color: #22c55e;
    }

    .pop-warning {
      color: #f97316;
    }

    .credits-value {
      color: #fbbf24;
    }

    .slider-container {
      margin-top: 4px;
    }

    .slider-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
    }

    .slider-value {
      font-size: 13px;
      font-weight: 600;
      color: #818cf8;
      font-variant-numeric: tabular-nums;
    }

    input[type="range"] {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 6px;
      background: rgba(51, 65, 85, 0.6);
      border-radius: 3px;
      outline: none;
      cursor: pointer;
    }

    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #6366f1;
      border: 2px solid #818cf8;
      box-shadow: 0 2px 6px rgba(99, 102, 241, 0.4);
      cursor: pointer;
    }

    input[type="range"]::-moz-range-thumb {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #6366f1;
      border: 2px solid #818cf8;
      box-shadow: 0 2px 6px rgba(99, 102, 241, 0.4);
      cursor: pointer;
    }
  `;

  private onSliderInput(e: Event): void {
    const value = parseInt((e.target as HTMLInputElement).value, 10);
    this.attackRatio = value;
    this.dispatchEvent(
      new CustomEvent("attack-ratio-change", {
        detail: { ratio: value },
        bubbles: true,
      }),
    );
  }

  private get troopPct(): number {
    return this.maxTroops > 0
      ? Math.min(100, (this.troops / this.maxTroops) * 100)
      : 0;
  }

  protected render(): TemplateResult {
    const ratePositive = this.popRate >= 0;

    return html`
      <div class="panel">
        <div class="stat-row">
          <span class="stat-label">Troops</span>
          <span class="stat-value"
            >${this.troops.toLocaleString()} /
            ${this.maxTroops.toLocaleString()}</span
          >
        </div>
        <div class="troop-bar-bg">
          <div
            class="troop-bar-fill"
            style="width: ${this.troopPct}%"
          ></div>
        </div>

        <div class="stat-row">
          <span class="stat-label">Pop. Rate</span>
          <span
            class="stat-value pop-rate ${ratePositive ? "pop-positive" : "pop-warning"}"
          >
            ${ratePositive ? "+" : ""}${this.popRate.toFixed(1)}/s
          </span>
        </div>

        <div class="stat-row">
          <span class="stat-label">Credits</span>
          <span class="stat-value credits-value">
            ${this.credits.toLocaleString()}
          </span>
        </div>

        <div class="slider-container">
          <div class="slider-header">
            <span class="stat-label">Attack Ratio</span>
            <span class="slider-value">${this.attackRatio}%</span>
          </div>
          <input
            type="range"
            min="1"
            max="100"
            .value=${String(this.attackRatio)}
            @input=${this.onSliderInput}
          />
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "gf-control-panel": ControlPanel;
  }
}
