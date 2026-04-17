import { LitElement, html, css, TemplateResult, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import * as d3 from "d3";

export interface MenuSlice {
  id: string;
  label: string;
  icon: string;
  category: "attack" | "ally" | "fleet" | "build";
  disabled?: boolean;
  cooldownPct?: number; // 0-1 for cooldown fill
  children?: MenuSlice[];
}

const CATEGORY_COLORS: Record<string, string> = {
  attack: "#ef4444",
  ally: "#22c55e",
  fleet: "#3b82f6",
  build: "#eab308",
};

const OUTER_RADIUS = 140;
const INNER_RADIUS = 40;
const BACK_RADIUS = 36;

@customElement("gf-radial-menu")
export class RadialMenu extends LitElement {
  @property({ type: Array }) items: MenuSlice[] = [];
  @property({ type: Number }) x = 0;
  @property({ type: Number }) y = 0;
  @property({ type: Boolean, reflect: true }) open = false;

  @state() private navStack: MenuSlice[][] = [];

  static styles = css`
    :host {
      position: fixed;
      z-index: 800;
      pointer-events: none;
    }

    :host([open]) {
      pointer-events: auto;
    }

    .radial-container {
      position: absolute;
      transform: translate(-50%, -50%);
    }

    svg {
      overflow: visible;
      filter: drop-shadow(0 4px 24px rgba(0, 0, 0, 0.5));
    }

    .slice {
      cursor: pointer;
      transition: opacity 0.15s;
    }

    .slice:hover .slice-bg {
      filter: brightness(1.3);
    }

    .slice.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .slice-bg {
      transition: filter 0.15s;
    }

    .slice-label {
      font-size: 11px;
      fill: #f1f5f9;
      text-anchor: middle;
      dominant-baseline: middle;
      pointer-events: none;
      font-family: "Inter", system-ui, sans-serif;
      font-weight: 500;
    }

    .slice-icon {
      font-size: 18px;
      text-anchor: middle;
      dominant-baseline: middle;
      pointer-events: none;
    }

    .back-btn {
      cursor: pointer;
      transition: opacity 0.15s;
    }

    .back-btn:hover .back-circle {
      fill: rgba(100, 116, 139, 0.6);
    }

    .back-circle {
      fill: rgba(51, 65, 85, 0.8);
      stroke: rgba(148, 163, 184, 0.3);
      stroke-width: 1.5;
      transition: fill 0.15s;
    }

    .cooldown-arc {
      pointer-events: none;
    }
  `;

  private get currentItems(): MenuSlice[] {
    return this.navStack.length > 0
      ? this.navStack[this.navStack.length - 1]
      : this.items;
  }

  show(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.navStack = [];
    this.open = true;
  }

  close(): void {
    this.open = false;
    this.navStack = [];
  }

  private handleSliceClick(item: MenuSlice): void {
    if (item.disabled) return;

    if (item.children && item.children.length > 0) {
      if (this.navStack.length < 3) {
        this.navStack = [...this.navStack, item.children];
      }
      return;
    }

    this.dispatchEvent(
      new CustomEvent("slice-select", {
        detail: { sliceId: item.id, slice: item },
        bubbles: true,
      }),
    );
    this.close();
  }

  private handleBack(): void {
    if (this.navStack.length > 0) {
      this.navStack = this.navStack.slice(0, -1);
    } else {
      this.close();
    }
  }

  private handleTouch(e: TouchEvent, item: MenuSlice): void {
    e.preventDefault();
    this.handleSliceClick(item);
  }

  private renderSvg(): TemplateResult {
    const slices = this.currentItems;
    const pie = d3
      .pie<MenuSlice>()
      .value(1)
      .sort(null)
      .padAngle(0.03);

    const arcGen = d3
      .arc<d3.PieArcDatum<MenuSlice>>()
      .innerRadius(INNER_RADIUS)
      .outerRadius(OUTER_RADIUS)
      .cornerRadius(4);

    const cooldownArc = d3
      .arc<d3.PieArcDatum<MenuSlice>>()
      .innerRadius(INNER_RADIUS)
      .outerRadius(OUTER_RADIUS)
      .cornerRadius(0);

    const arcs = pie(slices);
    const size = OUTER_RADIUS * 2 + 40;
    const center = size / 2;

    return html`
      <svg
        width="${size}"
        height="${size}"
        viewBox="0 0 ${size} ${size}"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g transform="translate(${center},${center})">
          ${arcs.map((arc) => {
            const item = arc.data;
            const baseColor = CATEGORY_COLORS[item.category] ?? "#64748b";
            const centroid = arcGen.centroid(arc);
            const iconY = centroid[1] - 8;
            const labelY = centroid[1] + 10;
            const d = arcGen(arc) ?? "";

            // Cooldown overlay
            let cooldownD = "";
            if (item.cooldownPct && item.cooldownPct > 0) {
              const cdArc = {
                ...arc,
                endAngle:
                  arc.startAngle +
                  (arc.endAngle - arc.startAngle) * item.cooldownPct,
              };
              cooldownD = cooldownArc(cdArc) ?? "";
            }

            return html`
              <g
                class="slice ${item.disabled ? "disabled" : ""}"
                @click=${() => this.handleSliceClick(item)}
                @touchend=${(e: TouchEvent) => this.handleTouch(e, item)}
              >
                <path class="slice-bg" d="${d}" fill="${baseColor}" opacity="0.7" />
                ${cooldownD
                  ? html`<path
                      class="cooldown-arc"
                      d="${cooldownD}"
                      fill="rgba(0,0,0,0.5)"
                    />`
                  : null}
                <text class="slice-icon" x="${centroid[0]}" y="${iconY}">
                  ${item.icon}
                </text>
                <text class="slice-label" x="${centroid[0]}" y="${labelY}">
                  ${item.label}
                </text>
                ${item.children
                  ? html`<text
                      class="slice-label"
                      x="${centroid[0]}"
                      y="${labelY + 14}"
                      font-size="8"
                      opacity="0.6"
                    >
                      \u25B6
                    </text>`
                  : null}
              </g>
            `;
          })}

          ${this.navStack.length > 0
            ? html`
                <g class="back-btn" @click=${this.handleBack}>
                  <circle class="back-circle" cx="0" cy="0" r="${BACK_RADIUS}" />
                  <text
                    x="0"
                    y="0"
                    text-anchor="middle"
                    dominant-baseline="middle"
                    fill="#e2e8f0"
                    font-size="12"
                    font-family="Inter, system-ui, sans-serif"
                  >
                    \u2190 Back
                  </text>
                </g>
              `
            : html`
                <g class="back-btn" @click=${this.close}>
                  <circle class="back-circle" cx="0" cy="0" r="${BACK_RADIUS}" />
                  <text
                    x="0"
                    y="1"
                    text-anchor="middle"
                    dominant-baseline="middle"
                    fill="#94a3b8"
                    font-size="16"
                  >
                    \u2715
                  </text>
                </g>
              `}
        </g>
      </svg>
    `;
  }

  protected render(): TemplateResult | typeof nothing {
    if (!this.open || this.items.length === 0) return nothing;

    return html`
      <div
        class="radial-container"
        style="left: ${this.x}px; top: ${this.y}px;"
      >
        ${this.renderSvg()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "gf-radial-menu": RadialMenu;
  }
}
