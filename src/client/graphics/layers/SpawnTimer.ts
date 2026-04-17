import { LitElement, html, css, TemplateResult, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("gf-spawn-timer")
export class SpawnTimer extends LitElement {
  /** Progress value 0-1 */
  @property({ type: Number }) progress = 0;
  @property({ type: Boolean }) visible = false;

  static styles = css`
    :host {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 700;
      pointer-events: none;
    }

    .bar-bg {
      width: 100%;
      height: 7px;
      background: rgba(15, 23, 42, 0.6);
    }

    .bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #3b82f6, #60a5fa);
      box-shadow: 0 0 8px rgba(59, 130, 246, 0.4);
      transition: width 0.1s linear;
    }
  `;

  protected render(): TemplateResult | typeof nothing {
    if (!this.visible) return nothing;

    const pct = Math.min(100, Math.max(0, this.progress * 100));

    return html`
      <div class="bar-bg">
        <div class="bar-fill" style="width: ${pct}%"></div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "gf-spawn-timer": SpawnTimer;
  }
}
