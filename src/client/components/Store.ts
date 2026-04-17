import { LitElement, html, css, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

export interface StoreItem {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: "stardust" | "plasma";
  preview: string; // emoji or image url
  owned: boolean;
  equipped: boolean;
}

type StoreTab = "patterns" | "flags" | "currency";

const CURRENCY_ICONS: Record<string, string> = {
  stardust: "\u2728",
  plasma: "\u{1F7E3}",
};

@customElement("gf-store")
export class Store extends LitElement {
  @property({ type: Array }) items: StoreItem[] = [];
  @property({ type: Number }) stardust = 0;
  @property({ type: Number }) plasma = 0;

  @state() private activeTab: StoreTab = "patterns";

  static styles = css`
    :host {
      display: block;
      font-family: "Inter", system-ui, sans-serif;
      color: #e2e8f0;
    }

    .store-container {
      max-width: 900px;
      margin: 0 auto;
      padding: 24px 16px;
    }

    .store-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
      flex-wrap: wrap;
      gap: 12px;
    }

    h1 {
      font-size: 1.5rem;
      font-weight: 700;
      color: #f1f5f9;
      margin: 0;
    }

    .currency-display {
      display: flex;
      gap: 16px;
    }

    .currency-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(51, 65, 85, 0.4);
      border: 1px solid rgba(148, 163, 184, 0.1);
      border-radius: 8px;
      padding: 6px 12px;
      font-size: 13px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    .currency-icon {
      font-size: 16px;
    }

    .stardust-val {
      color: #fbbf24;
    }

    .plasma-val {
      color: #a78bfa;
    }

    .tabs {
      display: flex;
      gap: 4px;
      margin-bottom: 20px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.1);
      padding-bottom: 4px;
    }

    .tab {
      padding: 8px 16px;
      border-radius: 6px 6px 0 0;
      border: none;
      background: transparent;
      color: #64748b;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.15s;
    }

    .tab:hover {
      color: #cbd5e1;
      background: rgba(99, 102, 241, 0.05);
    }

    .tab.active {
      color: #818cf8;
      background: rgba(99, 102, 241, 0.1);
      border-bottom: 2px solid #6366f1;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 12px;
    }

    .item-card {
      background: rgba(30, 41, 59, 0.5);
      border: 1px solid rgba(148, 163, 184, 0.1);
      border-radius: 10px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      transition: all 0.15s;
    }

    .item-card:hover {
      border-color: rgba(99, 102, 241, 0.3);
      background: rgba(30, 41, 59, 0.7);
    }

    .item-card.owned {
      border-color: rgba(34, 197, 94, 0.2);
    }

    .item-card.equipped {
      border-color: rgba(34, 197, 94, 0.4);
      box-shadow: 0 0 12px rgba(34, 197, 94, 0.1);
    }

    .item-preview {
      font-size: 40px;
      margin-bottom: 10px;
      width: 64px;
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(15, 23, 42, 0.5);
      border-radius: 8px;
    }

    .item-name {
      font-size: 13px;
      font-weight: 600;
      color: #f1f5f9;
      margin-bottom: 4px;
    }

    .item-desc {
      font-size: 11px;
      color: #64748b;
      margin-bottom: 10px;
      line-height: 1.3;
    }

    .buy-btn {
      width: 100%;
      padding: 6px 12px;
      border-radius: 6px;
      border: none;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.15s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }

    .buy-btn.purchasable {
      background: rgba(99, 102, 241, 0.2);
      border: 1px solid rgba(99, 102, 241, 0.3);
      color: #818cf8;
    }

    .buy-btn.purchasable:hover {
      background: rgba(99, 102, 241, 0.3);
    }

    .buy-btn.too-expensive {
      background: rgba(51, 65, 85, 0.3);
      color: #475569;
      cursor: not-allowed;
    }

    .owned-badge {
      font-size: 11px;
      color: #22c55e;
      font-weight: 500;
    }

    .equip-btn {
      width: 100%;
      padding: 6px 12px;
      border-radius: 6px;
      border: 1px solid rgba(34, 197, 94, 0.3);
      background: rgba(34, 197, 94, 0.1);
      color: #22c55e;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.15s;
    }

    .equip-btn:hover {
      background: rgba(34, 197, 94, 0.2);
    }

    .equipped-label {
      font-size: 11px;
      color: #22c55e;
      font-weight: 600;
      padding: 6px 0;
    }

    .empty-state {
      grid-column: 1 / -1;
      text-align: center;
      color: #475569;
      padding: 40px;
      font-size: 14px;
    }
  `;

  private get filteredItems(): StoreItem[] {
    return this.items.filter((item) => {
      if (this.activeTab === "currency") return false;
      // For now, tab is just a category filter concept
      return true;
    });
  }

  private canAfford(item: StoreItem): boolean {
    if (item.currency === "stardust") return this.stardust >= item.price;
    return this.plasma >= item.price;
  }

  private handlePurchase(item: StoreItem): void {
    if (!this.canAfford(item) || item.owned) return;
    this.dispatchEvent(
      new CustomEvent("store-purchase", {
        detail: { itemId: item.id },
        bubbles: true,
      }),
    );
  }

  private handleEquip(item: StoreItem): void {
    this.dispatchEvent(
      new CustomEvent("store-equip", {
        detail: { itemId: item.id },
        bubbles: true,
      }),
    );
  }

  private renderItem(item: StoreItem): TemplateResult {
    const affordable = this.canAfford(item);

    return html`
      <div
        class="item-card ${item.owned ? "owned" : ""} ${item.equipped ? "equipped" : ""}"
      >
        <div class="item-preview">${item.preview}</div>
        <div class="item-name">${item.name}</div>
        <div class="item-desc">${item.description}</div>

        ${item.equipped
          ? html`<div class="equipped-label">Equipped</div>`
          : item.owned
            ? html`<button class="equip-btn" @click=${() => this.handleEquip(item)}>
                Equip
              </button>`
            : html`<button
                class="buy-btn ${affordable ? "purchasable" : "too-expensive"}"
                @click=${() => this.handlePurchase(item)}
              >
                <span>${CURRENCY_ICONS[item.currency]}</span>
                ${item.price.toLocaleString()}
              </button>`}
      </div>
    `;
  }

  protected render(): TemplateResult {
    const items = this.filteredItems;

    return html`
      <div class="store-container" data-page="store">
        <div class="store-header">
          <h1>Galactic Store</h1>
          <div class="currency-display">
            <div class="currency-badge">
              <span class="currency-icon">\u2728</span>
              <span class="stardust-val"
                >${this.stardust.toLocaleString()}</span
              >
            </div>
            <div class="currency-badge">
              <span class="currency-icon">\u{1F7E3}</span>
              <span class="plasma-val">${this.plasma.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div class="tabs">
          ${(["patterns", "flags", "currency"] as StoreTab[]).map(
            (tab) => html`
              <button
                class="tab ${this.activeTab === tab ? "active" : ""}"
                @click=${() => (this.activeTab = tab)}
              >
                ${tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            `,
          )}
        </div>

        ${this.activeTab === "currency"
          ? html`
              <div class="grid">
                <div class="empty-state">
                  Currency bundles coming soon. Earn Stardust by playing matches
                  and Plasma through ranked victories.
                </div>
              </div>
            `
          : html`
              <div class="grid">
                ${items.length > 0
                  ? items.map((item) => this.renderItem(item))
                  : html`<div class="empty-state">
                      No items available in this category yet.
                    </div>`}
              </div>
            `}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "gf-store": Store;
  }
}
