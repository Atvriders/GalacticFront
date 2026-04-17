import { LitElement, html, TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";

export interface NavItem {
  id: string;
  label: string;
  icon: string;
}

const DEFAULT_NAV_ITEMS: NavItem[] = [
  { id: "play", label: "Play", icon: "\u{1F680}" },
  { id: "store", label: "Store", icon: "\u{1F6D2}" },
  { id: "leaderboard", label: "Leaderboard", icon: "\u{1F3C6}" },
  { id: "settings", label: "Settings", icon: "\u2699\uFE0F" },
  { id: "account", label: "Account", icon: "\u{1F464}" },
];

@customElement("gf-desktop-nav")
export class DesktopNavBar extends LitElement {
  @property({ type: String }) activePage = "play";
  @property({ type: Array }) items: NavItem[] = DEFAULT_NAV_ITEMS;

  protected createRenderRoot(): this {
    return this;
  }

  private handleNav(id: string): void {
    this.activePage = id;
    this.dispatchEvent(
      new CustomEvent("nav-change", { detail: { pageId: id }, bubbles: true }),
    );
  }

  protected render(): TemplateResult {
    return html`
      <nav
        class="hidden md:flex items-center gap-1 px-4 py-2 bg-slate-900/80 backdrop-blur border-b border-slate-700/50"
      >
        <div
          class="flex items-center gap-2 mr-6 cursor-pointer select-none"
          @click=${() => this.handleNav("play")}
        >
          <span class="text-xl font-bold text-indigo-400 tracking-tight"
            >GalacticFront</span
          >
          <span class="text-xs text-slate-500">.io</span>
        </div>

        <div class="flex items-center gap-1 flex-1">
          ${this.items.map(
            (item) => html`
              <button
                class="px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ${this
                  .activePage === item.id
                  ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"}"
                @click=${() => this.handleNav(item.id)}
              >
                <span class="mr-1.5">${item.icon}</span>${item.label}
              </button>
            `,
          )}
        </div>
      </nav>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "gf-desktop-nav": DesktopNavBar;
  }
}
