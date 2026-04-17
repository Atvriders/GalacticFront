import { LitElement, html, css, TemplateResult, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

export interface ChatMessage {
  id: string;
  sender: string;
  senderColor: string;
  text: string;
  timestamp: number;
}

@customElement("gf-chat-display")
export class ChatDisplay extends LitElement {
  @state() private messages: ChatMessage[] = [];
  @property({ type: Number }) maxVisible = 6;
  @property({ type: Boolean }) hidden = false;
  @state() private unreadCount = 0;

  static styles = css`
    :host {
      position: fixed;
      bottom: 16px;
      right: 16px;
      z-index: 600;
      pointer-events: auto;
    }

    .chat-container {
      max-width: 280px;
      font-family: "Inter", system-ui, sans-serif;
    }

    .messages {
      display: flex;
      flex-direction: column;
      gap: 3px;
      margin-bottom: 8px;
    }

    .msg {
      padding: 4px 10px;
      border-radius: 6px;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(8px);
      font-size: 12px;
      color: #cbd5e1;
      animation: fadeIn 0.2s ease-out;
      line-height: 1.4;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(6px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .msg-sender {
      font-weight: 600;
      margin-right: 4px;
    }

    .toggle-btn {
      position: relative;
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid rgba(148, 163, 184, 0.15);
      border-radius: 8px;
      padding: 6px 14px;
      color: #94a3b8;
      font-size: 12px;
      font-family: "Inter", system-ui, sans-serif;
      cursor: pointer;
      transition: all 0.15s;
    }

    .toggle-btn:hover {
      background: rgba(30, 41, 59, 0.95);
      color: #e2e8f0;
    }

    .badge {
      position: absolute;
      top: -6px;
      right: -6px;
      min-width: 18px;
      height: 18px;
      border-radius: 9px;
      background: #ef4444;
      color: white;
      font-size: 10px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 4px;
      line-height: 1;
    }

    .open-chat-btn {
      margin-top: 4px;
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid rgba(99, 102, 241, 0.3);
      border-radius: 6px;
      padding: 5px 12px;
      color: #818cf8;
      font-size: 11px;
      font-family: "Inter", system-ui, sans-serif;
      cursor: pointer;
      width: 100%;
      transition: all 0.15s;
    }

    .open-chat-btn:hover {
      background: rgba(99, 102, 241, 0.25);
    }
  `;

  addMessage(msg: ChatMessage): void {
    this.messages = [...this.messages, msg];
    if (this.hidden) {
      this.unreadCount++;
    }
  }

  private toggleVisibility(): void {
    this.hidden = !this.hidden;
    if (!this.hidden) {
      this.unreadCount = 0;
    }
  }

  private openChatModal(): void {
    this.dispatchEvent(
      new CustomEvent("open-chat-modal", { bubbles: true }),
    );
  }

  protected render(): TemplateResult {
    const recent = this.messages.slice(-this.maxVisible);

    return html`
      <div class="chat-container">
        <button class="toggle-btn" @click=${this.toggleVisibility}>
          ${this.hidden ? "\u{1F4AC} Show Chat" : "\u{1F4AC} Hide Chat"}
          ${this.unreadCount > 0
            ? html`<span class="badge">${this.unreadCount}</span>`
            : nothing}
        </button>

        ${!this.hidden
          ? html`
              <div class="messages">
                ${recent.map(
                  (m) => html`
                    <div class="msg">
                      <span class="msg-sender" style="color: ${m.senderColor}"
                        >${m.sender}:</span
                      >
                      ${m.text}
                    </div>
                  `,
                )}
              </div>
              <button class="open-chat-btn" @click=${this.openChatModal}>
                Send Message
              </button>
            `
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "gf-chat-display": ChatDisplay;
  }
}
