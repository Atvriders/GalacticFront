import {
  LitElement,
  html,
  css,
  TemplateResult,
  nothing,
  CSSResultGroup,
} from "lit";
import { property } from "lit/decorators.js";

/**
 * Abstract base class for all modals.
 * Subclasses must implement renderContent().
 * Uses shadow DOM with glassmorphic dark backdrop.
 */
export abstract class BaseModal extends LitElement {
  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: Boolean }) loading = false;
  @property({ type: String }) modalTitle = "";

  static styles: CSSResultGroup = css`
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
      -webkit-backdrop-filter: blur(8px);
      animation: fadeIn 0.15s ease-out;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(24px) scale(0.97);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .modal-panel {
      position: relative;
      background: linear-gradient(
        135deg,
        rgba(15, 23, 42, 0.95),
        rgba(30, 41, 59, 0.9)
      );
      border: 1px solid rgba(148, 163, 184, 0.15);
      border-radius: 12px;
      padding: 24px;
      min-width: 320px;
      max-width: 90vw;
      max-height: 85vh;
      overflow-y: auto;
      box-shadow:
        0 25px 50px rgba(0, 0, 0, 0.5),
        0 0 40px rgba(99, 102, 241, 0.08);
      animation: slideUp 0.2s ease-out;
      color: #e2e8f0;
      font-family:
        "Inter",
        system-ui,
        -apple-system,
        sans-serif;
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .modal-title {
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
      line-height: 1;
    }

    .close-btn:hover {
      background: rgba(239, 68, 68, 0.15);
      border-color: rgba(239, 68, 68, 0.4);
      color: #ef4444;
    }

    .spinner-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(15, 23, 42, 0.7);
      border-radius: 12px;
      z-index: 10;
    }

    .spinner {
      width: 36px;
      height: 36px;
      border: 3px solid rgba(99, 102, 241, 0.3);
      border-top-color: #6366f1;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    this._onKeyDown = this._onKeyDown.bind(this);
    document.addEventListener("keydown", this._onKeyDown);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener("keydown", this._onKeyDown);
  }

  private _onKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape" && this.open) {
      this.close();
    }
  }

  show(): void {
    this.open = true;
    this.dispatchEvent(new CustomEvent("modal-open", { bubbles: true }));
  }

  close(): void {
    this.open = false;
    this.dispatchEvent(new CustomEvent("modal-close", { bubbles: true }));
  }

  toggle(): void {
    if (this.open) {
      this.close();
    } else {
      this.show();
    }
  }

  /** Subclasses implement this to provide modal body content */
  protected abstract renderContent(): TemplateResult;

  private handleBackdropClick(e: Event): void {
    if ((e.target as HTMLElement).classList.contains("backdrop")) {
      this.close();
    }
  }

  protected renderSpinner(): TemplateResult {
    return html`
      <div class="spinner-overlay">
        <div class="spinner"></div>
      </div>
    `;
  }

  protected render(): TemplateResult | typeof nothing {
    if (!this.open) return nothing;

    return html`
      <div class="backdrop" @click=${this.handleBackdropClick}>
        <div class="modal-panel" role="dialog" aria-modal="true">
          ${this.modalTitle
            ? html`
                <div class="modal-header">
                  <h2 class="modal-title">${this.modalTitle}</h2>
                  <button
                    class="close-btn"
                    @click=${this.close}
                    aria-label="Close"
                  >
                    &#x2715;
                  </button>
                </div>
              `
            : null}
          ${this.loading ? this.renderSpinner() : null}
          ${this.renderContent()}
        </div>
      </div>
    `;
  }
}
