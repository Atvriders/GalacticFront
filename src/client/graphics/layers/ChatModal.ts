import { LitElement, html, css, TemplateResult, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

interface ChatPhrase {
  id: string;
  text: string;
}

interface ChatCategory {
  id: string;
  label: string;
  icon: string;
  phrases: ChatPhrase[];
}

export interface ChatTarget {
  id: string;
  name: string;
  color: string;
}

const CHAT_CATEGORIES: ChatCategory[] = [
  {
    id: "help",
    label: "Help",
    icon: "\u{1F198}",
    phrases: [
      { id: "h1", text: "I need reinforcements!" },
      { id: "h2", text: "Send troops to my sector" },
      { id: "h3", text: "Can someone help me?" },
      { id: "h4", text: "I'm under heavy fire" },
      { id: "h5", text: "Requesting backup" },
      { id: "h6", text: "Mayday! Mayday!" },
      { id: "h7", text: "SOS - losing territory fast" },
      { id: "h8", text: "Need credits urgently" },
      { id: "h9", text: "Requesting alliance" },
      { id: "h10", text: "Cover my flank!" },
    ],
  },
  {
    id: "attack",
    label: "Attack",
    icon: "\u2694\uFE0F",
    phrases: [
      { id: "a1", text: "Attack now!" },
      { id: "a2", text: "Focus fire on the leader" },
      { id: "a3", text: "Flank them from the nebula" },
      { id: "a4", text: "All forces engage!" },
      { id: "a5", text: "Push the offensive" },
      { id: "a6", text: "Target their starports" },
      { id: "a7", text: "Initiate orbital strike" },
      { id: "a8", text: "Cut their supply lines" },
      { id: "a9", text: "Pincer movement - go!" },
      { id: "a10", text: "Launch the superweapon" },
      { id: "a11", text: "Charge!" },
    ],
  },
  {
    id: "defend",
    label: "Defend",
    icon: "\u{1F6E1}\uFE0F",
    phrases: [
      { id: "d1", text: "Hold the line!" },
      { id: "d2", text: "Fortify this sector" },
      { id: "d3", text: "Build planetary shields" },
      { id: "d4", text: "Don't overextend" },
      { id: "d5", text: "Fall back to home system" },
      { id: "d6", text: "Defensive positions!" },
      { id: "d7", text: "Protect the starports" },
      { id: "d8", text: "They're flanking us" },
      { id: "d9", text: "Reinforce the border" },
      { id: "d10", text: "Shields up!" },
      { id: "d11", text: "Retreat and regroup" },
    ],
  },
  {
    id: "greet",
    label: "Greet",
    icon: "\u{1F44B}",
    phrases: [
      { id: "g1", text: "Hello, commander!" },
      { id: "g2", text: "Good game!" },
      { id: "g3", text: "Well played" },
      { id: "g4", text: "Welcome to the galaxy" },
      { id: "g5", text: "May the stars align" },
      { id: "g6", text: "Greetings from sector 7" },
      { id: "g7", text: "Peace and prosperity" },
      { id: "g8", text: "Ready for battle?" },
      { id: "g9", text: "See you among the stars" },
      { id: "g10", text: "Glory to the empire!" },
    ],
  },
  {
    id: "misc",
    label: "Misc",
    icon: "\u{1F4AC}",
    phrases: [
      { id: "m1", text: "Nice move" },
      { id: "m2", text: "Wait for my signal" },
      { id: "m3", text: "Check the leaderboard" },
      { id: "m4", text: "Let's trade resources" },
      { id: "m5", text: "I'll handle this sector" },
      { id: "m6", text: "Expanding northwest" },
      { id: "m7", text: "Roger that" },
      { id: "m8", text: "Acknowledged" },
      { id: "m9", text: "Negative, not possible" },
      { id: "m10", text: "Stand by..." },
    ],
  },
  {
    id: "warnings",
    label: "Warnings",
    icon: "\u26A0\uFE0F",
    phrases: [
      { id: "w1", text: "Incoming attack!" },
      { id: "w2", text: "Enemy fleet detected" },
      { id: "w3", text: "Betrayal! Alliance broken!" },
      { id: "w4", text: "Superweapon charging nearby" },
      { id: "w5", text: "They're massing troops" },
      { id: "w6", text: "Watch your back" },
      { id: "w7", text: "Trap ahead - be careful" },
      { id: "w8", text: "Multiple hostiles inbound" },
      { id: "w9", text: "Wormhole activity detected" },
      { id: "w10", text: "Danger zone - avoid!" },
    ],
  },
];

@customElement("gf-chat-modal")
export class ChatModal extends LitElement {
  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: Array }) targets: ChatTarget[] = [];

  @state() private selectedCategory: ChatCategory | null = null;
  @state() private selectedPhrase: ChatPhrase | null = null;

  static styles = css`
    :host {
      display: contents;
    }

    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 850;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(6px);
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

    .panel {
      display: grid;
      grid-template-columns: 140px 1fr 160px;
      gap: 1px;
      background: rgba(51, 65, 85, 0.3);
      border: 1px solid rgba(148, 163, 184, 0.15);
      border-radius: 12px;
      overflow: hidden;
      width: 640px;
      max-width: 95vw;
      height: 400px;
      max-height: 80vh;
      box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
      font-family: "Inter", system-ui, sans-serif;
    }

    .column {
      background: rgba(15, 23, 42, 0.95);
      overflow-y: auto;
      padding: 8px;
      scrollbar-width: thin;
      scrollbar-color: rgba(100, 116, 139, 0.3) transparent;
    }

    .column::-webkit-scrollbar {
      width: 4px;
    }

    .column::-webkit-scrollbar-thumb {
      background: rgba(100, 116, 139, 0.3);
      border-radius: 2px;
    }

    .col-header {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      padding: 6px 8px;
      font-weight: 600;
    }

    .item {
      display: block;
      width: 100%;
      text-align: left;
      padding: 8px 10px;
      border-radius: 6px;
      border: none;
      background: transparent;
      color: #cbd5e1;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.1s;
      font-family: inherit;
      line-height: 1.3;
    }

    .item:hover {
      background: rgba(99, 102, 241, 0.1);
      color: #e2e8f0;
    }

    .item.selected {
      background: rgba(99, 102, 241, 0.2);
      color: #818cf8;
    }

    .cat-icon {
      margin-right: 6px;
    }

    .target-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .target-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .send-all {
      margin-top: 8px;
      width: 100%;
      padding: 8px;
      border-radius: 6px;
      border: 1px solid rgba(99, 102, 241, 0.3);
      background: rgba(99, 102, 241, 0.15);
      color: #818cf8;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.15s;
    }

    .send-all:hover {
      background: rgba(99, 102, 241, 0.25);
    }

    .close-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      background: transparent;
      border: none;
      color: #64748b;
      font-size: 18px;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
    }

    .close-btn:hover {
      color: #ef4444;
      background: rgba(239, 68, 68, 0.1);
    }

    .placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #475569;
      font-size: 12px;
      text-align: center;
      padding: 16px;
    }
  `;

  show(): void {
    this.open = true;
    this.selectedCategory = null;
    this.selectedPhrase = null;
  }

  close(): void {
    this.open = false;
  }

  private selectCategory(cat: ChatCategory): void {
    this.selectedCategory = cat;
    this.selectedPhrase = null;
  }

  private selectPhrase(phrase: ChatPhrase): void {
    this.selectedPhrase = phrase;
    // If no targets available, send to all immediately
    if (this.targets.length === 0) {
      this.sendMessage(null);
    }
  }

  private sendMessage(target: ChatTarget | null): void {
    if (!this.selectedPhrase) return;

    this.dispatchEvent(
      new CustomEvent("chat-send", {
        detail: {
          phraseId: this.selectedPhrase.id,
          text: this.selectedPhrase.text,
          targetId: target?.id ?? null,
          targetName: target?.name ?? "All",
        },
        bubbles: true,
      }),
    );
    this.close();
  }

  private handleBackdropClick(e: Event): void {
    if ((e.target as HTMLElement).classList.contains("backdrop")) {
      this.close();
    }
  }

  protected render(): TemplateResult | typeof nothing {
    if (!this.open) return nothing;

    return html`
      <div class="backdrop" @click=${this.handleBackdropClick}>
        <div class="panel" style="position: relative;">
          <button class="close-btn" @click=${this.close}>\u2715</button>

          <!-- Column 1: Categories -->
          <div class="column">
            <div class="col-header">Category</div>
            ${CHAT_CATEGORIES.map(
              (cat) => html`
                <button
                  class="item ${this.selectedCategory?.id === cat.id ? "selected" : ""}"
                  @click=${() => this.selectCategory(cat)}
                >
                  <span class="cat-icon">${cat.icon}</span>${cat.label}
                </button>
              `,
            )}
          </div>

          <!-- Column 2: Phrases -->
          <div class="column">
            <div class="col-header">
              ${this.selectedCategory ? this.selectedCategory.label : "Phrase"}
            </div>
            ${this.selectedCategory
              ? this.selectedCategory.phrases.map(
                  (p) => html`
                    <button
                      class="item ${this.selectedPhrase?.id === p.id ? "selected" : ""}"
                      @click=${() => this.selectPhrase(p)}
                    >
                      ${p.text}
                    </button>
                  `,
                )
              : html`<div class="placeholder">
                  Select a category to see phrases
                </div>`}
          </div>

          <!-- Column 3: Targets -->
          <div class="column">
            <div class="col-header">Send To</div>
            ${this.selectedPhrase
              ? html`
                  <button
                    class="send-all"
                    @click=${() => this.sendMessage(null)}
                  >
                    Send to All
                  </button>
                  ${this.targets.map(
                    (t) => html`
                      <button
                        class="item target-item"
                        @click=${() => this.sendMessage(t)}
                      >
                        <span
                          class="target-dot"
                          style="background: ${t.color}"
                        ></span>
                        ${t.name}
                      </button>
                    `,
                  )}
                `
              : html`<div class="placeholder">
                  Select a phrase first
                </div>`}
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "gf-chat-modal": ChatModal;
  }
}
