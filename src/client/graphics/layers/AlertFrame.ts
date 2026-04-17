import { LitElement, html, css, TemplateResult, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

export type AlertType = "betrayal" | "major-attack";

const ALERT_COOLDOWN_MS = 5000;

@customElement("gf-alert-frame")
export class AlertFrame extends LitElement {
  @state() private activeAlert: AlertType | null = null;
  @state() private visible = false;

  private cooldownUntil = 0;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      z-index: 750;
      pointer-events: none;
    }

    .frame {
      position: absolute;
      inset: 0;
      border-style: solid;
      border-width: 4px;
      border-radius: 0;
      animation: pulse 0.6s ease-in-out infinite alternate;
    }

    .frame.betrayal {
      border-color: rgba(239, 68, 68, 0.8);
      box-shadow:
        inset 0 0 60px rgba(239, 68, 68, 0.15),
        0 0 30px rgba(239, 68, 68, 0.1);
    }

    .frame.major-attack {
      border-color: rgba(249, 115, 22, 0.7);
      box-shadow:
        inset 0 0 60px rgba(249, 115, 22, 0.12),
        0 0 30px rgba(249, 115, 22, 0.08);
    }

    @keyframes pulse {
      from {
        opacity: 0.4;
      }
      to {
        opacity: 1;
      }
    }
  `;

  /**
   * Trigger an alert. Respects cooldown between alerts.
   * @param type "betrayal" for red pulse, "major-attack" for orange pulse
   * @param durationMs how long the alert shows (default 3000ms)
   */
  triggerAlert(type: AlertType, durationMs = 3000): void {
    const now = Date.now();
    if (now < this.cooldownUntil) return;

    this.activeAlert = type;
    this.visible = true;
    this.cooldownUntil = now + ALERT_COOLDOWN_MS;

    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
    }

    this.hideTimer = setTimeout(() => {
      this.visible = false;
      this.activeAlert = null;
    }, durationMs);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
    }
  }

  protected render(): TemplateResult | typeof nothing {
    if (!this.visible || !this.activeAlert) return nothing;

    return html`
      <div class="frame ${this.activeAlert}"></div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "gf-alert-frame": AlertFrame;
  }
}
