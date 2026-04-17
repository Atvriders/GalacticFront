import { LitElement, html, css, TemplateResult, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

@customElement("gf-settings-modal")
export class SettingsModal extends LitElement {
  @property({ type: Boolean, reflect: true }) open = false;

  @state() private musicVolume = 70;
  @state() private sfxVolume = 80;
  @state() private darkMode = true;
  @state() private effects = true;
  @state() private emojis = true;
  @state() private confirmingExit = false;

  static styles = css`
    :host {
      display: contents;
    }

    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 900;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(8px);
      animation: fadeIn 0.15s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .panel {
      background: linear-gradient(135deg, rgba(15, 23, 42, 0.97), rgba(30, 41, 59, 0.94));
      border: 1px solid rgba(148, 163, 184, 0.15);
      border-radius: 12px;
      padding: 24px;
      min-width: 360px;
      max-width: 90vw;
      max-height: 85vh;
      overflow-y: auto;
      box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
      animation: slideUp 0.2s ease-out;
      font-family: "Inter", system-ui, sans-serif;
      color: #e2e8f0;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }

    h2 {
      font-size: 1.25rem;
      font-weight: 600;
      color: #f1f5f9;
      margin: 0;
    }

    .close-btn {
      background: transparent;
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 6px;
      color: #94a3b8;
      cursor: pointer;
      padding: 4px 8px;
      font-size: 1rem;
      transition: all 0.15s;
    }

    .close-btn:hover {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
    }

    .section {
      margin-bottom: 20px;
    }

    .section-title {
      font-size: 11px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 600;
      margin-bottom: 10px;
    }

    .slider-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .slider-label {
      font-size: 13px;
      color: #cbd5e1;
      min-width: 60px;
    }

    .slider-wrapper {
      flex: 1;
      margin: 0 12px;
    }

    .slider-value {
      font-size: 12px;
      font-weight: 600;
      color: #818cf8;
      min-width: 32px;
      text-align: right;
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
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #6366f1;
      border: 2px solid #818cf8;
      cursor: pointer;
    }

    input[type="range"]::-moz-range-thumb {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #6366f1;
      border: 2px solid #818cf8;
      cursor: pointer;
    }

    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;
    }

    .toggle-label {
      font-size: 13px;
      color: #cbd5e1;
    }

    .toggle-switch {
      position: relative;
      width: 40px;
      height: 22px;
      background: rgba(51, 65, 85, 0.6);
      border-radius: 11px;
      cursor: pointer;
      transition: background 0.2s;
      border: none;
      padding: 0;
    }

    .toggle-switch.on {
      background: #6366f1;
    }

    .toggle-knob {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: white;
      transition: transform 0.2s;
      pointer-events: none;
    }

    .toggle-switch.on .toggle-knob {
      transform: translateX(18px);
    }

    .divider {
      height: 1px;
      background: rgba(148, 163, 184, 0.1);
      margin: 16px 0;
    }

    .exit-btn {
      width: 100%;
      padding: 10px;
      border-radius: 8px;
      border: 1px solid rgba(239, 68, 68, 0.3);
      background: rgba(239, 68, 68, 0.1);
      color: #ef4444;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.15s;
    }

    .exit-btn:hover {
      background: rgba(239, 68, 68, 0.2);
    }

    .confirm-box {
      background: rgba(239, 68, 68, 0.08);
      border: 1px solid rgba(239, 68, 68, 0.2);
      border-radius: 8px;
      padding: 14px;
      text-align: center;
    }

    .confirm-text {
      font-size: 13px;
      color: #fca5a5;
      margin-bottom: 10px;
    }

    .confirm-actions {
      display: flex;
      gap: 8px;
      justify-content: center;
    }

    .confirm-yes {
      padding: 6px 20px;
      border-radius: 6px;
      border: none;
      background: #ef4444;
      color: white;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      font-family: inherit;
    }

    .confirm-no {
      padding: 6px 20px;
      border-radius: 6px;
      border: 1px solid rgba(148, 163, 184, 0.2);
      background: transparent;
      color: #94a3b8;
      font-size: 13px;
      cursor: pointer;
      font-family: inherit;
    }
  `;

  show(): void {
    this.open = true;
    this.confirmingExit = false;
  }

  close(): void {
    this.open = false;
    this.confirmingExit = false;
  }

  private handleBackdrop(e: Event): void {
    if ((e.target as HTMLElement).classList.contains("backdrop")) {
      this.close();
    }
  }

  private dispatchSetting(key: string, value: unknown): void {
    this.dispatchEvent(
      new CustomEvent("setting-change", {
        detail: { key, value },
        bubbles: true,
      }),
    );
  }

  private handleExit(): void {
    if (!this.confirmingExit) {
      this.confirmingExit = true;
      return;
    }
    this.dispatchEvent(new CustomEvent("exit-game", { bubbles: true }));
    this.close();
  }

  protected render(): TemplateResult | typeof nothing {
    if (!this.open) return nothing;

    return html`
      <div class="backdrop" @click=${this.handleBackdrop}>
        <div class="panel">
          <div class="header">
            <h2>Settings</h2>
            <button class="close-btn" @click=${this.close}>\u2715</button>
          </div>

          <!-- Audio -->
          <div class="section">
            <div class="section-title">Audio</div>
            <div class="slider-row">
              <span class="slider-label">Music</span>
              <div class="slider-wrapper">
                <input type="range" min="0" max="100"
                  .value=${String(this.musicVolume)}
                  @input=${(e: Event) => {
                    this.musicVolume = parseInt((e.target as HTMLInputElement).value, 10);
                    this.dispatchSetting("musicVolume", this.musicVolume);
                  }}
                />
              </div>
              <span class="slider-value">${this.musicVolume}%</span>
            </div>
            <div class="slider-row">
              <span class="slider-label">SFX</span>
              <div class="slider-wrapper">
                <input type="range" min="0" max="100"
                  .value=${String(this.sfxVolume)}
                  @input=${(e: Event) => {
                    this.sfxVolume = parseInt((e.target as HTMLInputElement).value, 10);
                    this.dispatchSetting("sfxVolume", this.sfxVolume);
                  }}
                />
              </div>
              <span class="slider-value">${this.sfxVolume}%</span>
            </div>
          </div>

          <!-- Visual -->
          <div class="section">
            <div class="section-title">Visual</div>
            <div class="toggle-row">
              <span class="toggle-label">Dark Mode</span>
              <button class="toggle-switch ${this.darkMode ? "on" : ""}"
                @click=${() => {
                  this.darkMode = !this.darkMode;
                  this.dispatchSetting("darkMode", this.darkMode);
                }}>
                <span class="toggle-knob"></span>
              </button>
            </div>
            <div class="toggle-row">
              <span class="toggle-label">Visual Effects</span>
              <button class="toggle-switch ${this.effects ? "on" : ""}"
                @click=${() => {
                  this.effects = !this.effects;
                  this.dispatchSetting("effects", this.effects);
                }}>
                <span class="toggle-knob"></span>
              </button>
            </div>
            <div class="toggle-row">
              <span class="toggle-label">Emojis</span>
              <button class="toggle-switch ${this.emojis ? "on" : ""}"
                @click=${() => {
                  this.emojis = !this.emojis;
                  this.dispatchSetting("emojis", this.emojis);
                }}>
                <span class="toggle-knob"></span>
              </button>
            </div>
          </div>

          <div class="divider"></div>

          ${this.confirmingExit
            ? html`
                <div class="confirm-box">
                  <div class="confirm-text">Are you sure you want to exit?</div>
                  <div class="confirm-actions">
                    <button class="confirm-yes" @click=${this.handleExit}>
                      Yes, Exit
                    </button>
                    <button class="confirm-no" @click=${() => (this.confirmingExit = false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              `
            : html`
                <button class="exit-btn" @click=${this.handleExit}>
                  Exit Game
                </button>
              `}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "gf-settings-modal": SettingsModal;
  }
}
