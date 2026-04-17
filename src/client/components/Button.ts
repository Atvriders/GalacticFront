import { LitElement, html, css, TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

@customElement("gf-button")
export class GfButton extends LitElement {
  @property({ type: String }) variant: ButtonVariant = "primary";
  @property({ type: String }) size: ButtonSize = "md";
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ type: Boolean }) loading = false;

  /** Render into light DOM for Tailwind compatibility */
  protected createRenderRoot(): this {
    return this;
  }

  private get sizeClasses(): string {
    const map: Record<ButtonSize, string> = {
      sm: "px-3 py-1 text-xs rounded",
      md: "px-4 py-2 text-sm rounded-md",
      lg: "px-6 py-3 text-base rounded-lg",
    };
    return map[this.size];
  }

  private get variantClasses(): string {
    const map: Record<ButtonVariant, string> = {
      primary:
        "bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500 shadow-lg shadow-indigo-500/20",
      secondary:
        "bg-slate-700 hover:bg-slate-600 text-slate-100 border border-slate-600",
      ghost:
        "bg-transparent hover:bg-white/10 text-slate-300 border border-transparent",
      danger:
        "bg-red-600 hover:bg-red-500 text-white border border-red-500 shadow-lg shadow-red-500/20",
    };
    return map[this.variant];
  }

  private handleClick(e: Event): void {
    if (this.disabled || this.loading) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  protected render(): TemplateResult {
    const disabledCls =
      this.disabled || this.loading
        ? "opacity-50 cursor-not-allowed pointer-events-none"
        : "cursor-pointer";

    return html`
      <button
        class="inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 select-none focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-900 ${this
          .sizeClasses} ${this.variantClasses} ${disabledCls}"
        ?disabled=${this.disabled || this.loading}
        @click=${this.handleClick}
      >
        ${this.loading
          ? html`<span
              class="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
            ></span>`
          : null}
        <slot></slot>
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "gf-button": GfButton;
  }
}
