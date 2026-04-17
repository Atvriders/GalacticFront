import { LitElement, html, TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { NavItem } from "./DesktopNavBar.js";

const DEFAULT_NAV_ITEMS: NavItem[] = [
  { id: "play", label: "Play", icon: "\u{1F680}" },
  { id: "store", label: "Store", icon: "\u{1F6D2}" },
  { id: "leaderboard", label: "Leaderboard", icon: "\u{1F3C6}" },
  { id: "settings", label: "Settings", icon: "\u2699\uFE0F" },
  { id: "account", label: "Account", icon: "\u{1F464}" },
];

@customElement("gf-mobile-nav")
export class MobileNavBar extends LitElement {
  @property({ type: String }) activePage = "play";
  @property({ type: Array }) items: NavItem[] = DEFAULT_NAV_ITEMS;
  @property({ type: Boolean }) menuOpen = false;

  protected createRenderRoot(): this {
    return this;
  }

  private toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  private handleNav(id: string): void {
    this.activePage = id;
    this.menuOpen = false;
    this.dispatchEvent(
      new CustomEvent("nav-change", { detail: { pageId: id }, bubbles: true }),
    );
  }

  protected render(): TemplateResult {
    return html`
      <nav class="md:hidden bg-slate-900/90 backdrop-blur border-b border-slate-700/50">
        <div class="flex items-center justify-between px-4 py-3">
          <span class="text-lg font-bold text-indigo-400">GalacticFront</span>
          <button
            class="p-2 rounded-md text-slate-300 hover:bg-white/10 transition-colors"
            @click=${this.toggleMenu}
            aria-label="Toggle menu"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              ${
                this.menuOpen
                  ? html`<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>`
                  : html`<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>`
              }
            </svg>
          </button>
        </div>

        ${
          this.menuOpen
            ? html`
                <div class="px-2 pb-3 space-y-1 border-t border-slate-700/50">
                  ${this.items.map(
                    (item) => html`
                      <button
                        class="w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ${this
                          .activePage === item.id
                          ? "bg-indigo-600/20 text-indigo-300"
                          : "text-slate-400 hover:text-slate-200 hover:bg-white/5"}"
                        @click=${() => this.handleNav(item.id)}
                      >
                        <span class="mr-2">${item.icon}</span>${item.label}
                      </button>
                    `,
                  )}
                </div>
              `
            : null
        }
      </nav>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "gf-mobile-nav": MobileNavBar;
  }
}
