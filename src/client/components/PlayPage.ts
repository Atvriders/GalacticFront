import { LitElement, html, TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";

interface GameMode {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  borderColor: string;
  glowColor: string;
}

const GAME_MODES: GameMode[] = [
  {
    id: "ffa",
    title: "Free For All",
    description: "Every commander for themselves. Last one standing wins.",
    icon: "\u2694\uFE0F",
    color: "from-red-600/20 to-red-900/10",
    borderColor: "border-red-500/30 hover:border-red-400/50",
    glowColor: "shadow-red-500/10",
  },
  {
    id: "teams",
    title: "Teams",
    description: "Coordinate with allies to dominate the galaxy.",
    icon: "\u{1F91D}",
    color: "from-blue-600/20 to-blue-900/10",
    borderColor: "border-blue-500/30 hover:border-blue-400/50",
    glowColor: "shadow-blue-500/10",
  },
  {
    id: "special",
    title: "Special Event",
    description: "Limited-time game modes with unique rules.",
    icon: "\u2B50",
    color: "from-amber-600/20 to-amber-900/10",
    borderColor: "border-amber-500/30 hover:border-amber-400/50",
    glowColor: "shadow-amber-500/10",
  },
  {
    id: "singleplayer",
    title: "Singleplayer",
    description: "Practice against AI opponents at your own pace.",
    icon: "\u{1F916}",
    color: "from-emerald-600/20 to-emerald-900/10",
    borderColor: "border-emerald-500/30 hover:border-emerald-400/50",
    glowColor: "shadow-emerald-500/10",
  },
  {
    id: "ranked",
    title: "Ranked",
    description: "Compete for galactic supremacy on the leaderboards.",
    icon: "\u{1F451}",
    color: "from-purple-600/20 to-purple-900/10",
    borderColor: "border-purple-500/30 hover:border-purple-400/50",
    glowColor: "shadow-purple-500/10",
  },
];

@customElement("gf-play-page")
export class PlayPage extends LitElement {
  protected createRenderRoot(): this {
    return this;
  }

  private handleModeClick(mode: GameMode): void {
    this.dispatchEvent(
      new CustomEvent("mode-select", {
        detail: { modeId: mode.id },
        bubbles: true,
      }),
    );
  }

  private renderCard(mode: GameMode): TemplateResult {
    return html`
      <button
        class="group relative flex flex-col p-6 rounded-xl bg-gradient-to-br ${mode.color} border ${mode.borderColor} shadow-lg ${mode.glowColor} hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5 text-left cursor-pointer"
        @click=${() => this.handleModeClick(mode)}
      >
        <span class="text-3xl mb-3">${mode.icon}</span>
        <h3
          class="text-lg font-semibold text-slate-100 group-hover:text-white transition-colors"
        >
          ${mode.title}
        </h3>
        <p class="mt-1 text-sm text-slate-400 group-hover:text-slate-300">
          ${mode.description}
        </p>
      </button>
    `;
  }

  protected render(): TemplateResult {
    return html`
      <div class="max-w-4xl mx-auto px-4 py-8" data-page="play">
        <h1
          class="text-2xl font-bold text-slate-100 mb-2 flex items-center gap-2"
        >
          <span class="text-indigo-400">Select Game Mode</span>
        </h1>
        <p class="text-slate-400 mb-8">
          Choose how you want to conquer the galaxy
        </p>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          ${GAME_MODES.map((mode) => this.renderCard(mode))}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "gf-play-page": PlayPage;
  }
}
