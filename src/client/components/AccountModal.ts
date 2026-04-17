import { html, css, TemplateResult, CSSResultGroup } from "lit";
import { customElement, property } from "lit/decorators.js";
import { BaseModal } from "./BaseModal.js";

export interface PlayerProfile {
  username: string;
  avatarUrl: string;
  gamesPlayed: number;
  gamesWon: number;
  totalPlanets: number;
  totalKills: number;
}

export interface RecentGame {
  id: string;
  mode: string;
  result: "win" | "loss";
  duration: string;
  date: string;
}

@customElement("gf-account-modal")
export class AccountModal extends BaseModal {
  @property({ type: Boolean }) loggedIn = false;
  @property({ attribute: false }) profile: PlayerProfile = {
    username: "Commander",
    avatarUrl: "",
    gamesPlayed: 0,
    gamesWon: 0,
    totalPlanets: 0,
    totalKills: 0,
  };
  @property({ type: Array }) recentGames: RecentGame[] = [];

  static styles: CSSResultGroup = [
    BaseModal.styles,
    css`
      .profile-header {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 20px;
      }

      .avatar {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: rgba(99, 102, 241, 0.2);
        border: 2px solid rgba(99, 102, 241, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
        color: #818cf8;
        overflow: hidden;
        flex-shrink: 0;
      }

      .avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .username {
        font-size: 20px;
        font-weight: 700;
        color: #f1f5f9;
      }

      .stats-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-bottom: 20px;
      }

      .stat-card {
        background: rgba(51, 65, 85, 0.3);
        border: 1px solid rgba(148, 163, 184, 0.08);
        border-radius: 8px;
        padding: 10px;
        text-align: center;
      }

      .stat-label {
        font-size: 10px;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .stat-val {
        font-size: 18px;
        font-weight: 700;
        color: #e2e8f0;
        margin-top: 2px;
        font-variant-numeric: tabular-nums;
      }

      .section-title {
        font-size: 11px;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        font-weight: 600;
        margin-bottom: 8px;
      }

      .games-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-bottom: 20px;
        max-height: 160px;
        overflow-y: auto;
      }

      .game-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 10px;
        border-radius: 6px;
        background: rgba(51, 65, 85, 0.2);
        font-size: 12px;
        color: #cbd5e1;
      }

      .game-result {
        font-weight: 600;
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 4px;
      }

      .game-win {
        background: rgba(34, 197, 94, 0.15);
        color: #22c55e;
      }

      .game-loss {
        background: rgba(239, 68, 68, 0.15);
        color: #ef4444;
      }

      .game-meta {
        color: #64748b;
        font-size: 11px;
      }

      .auth-btn {
        width: 100%;
        padding: 10px;
        border-radius: 8px;
        border: none;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        font-family: "Inter", system-ui, sans-serif;
        transition: all 0.15s;
      }

      .login-btn {
        background: #5865f2;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }

      .login-btn:hover {
        background: #4752c4;
      }

      .logout-btn {
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: #ef4444;
      }

      .logout-btn:hover {
        background: rgba(239, 68, 68, 0.2);
      }

      .guest-msg {
        text-align: center;
        color: #64748b;
        font-size: 13px;
        margin-bottom: 16px;
      }
    `,
  ];

  constructor() {
    super();
    this.modalTitle = "Account";
  }

  private handleLogin(): void {
    this.dispatchEvent(
      new CustomEvent("discord-login", { bubbles: true }),
    );
  }

  private handleLogout(): void {
    this.dispatchEvent(
      new CustomEvent("logout", { bubbles: true }),
    );
  }

  protected renderContent(): TemplateResult {
    if (!this.loggedIn) {
      return html`
        <div class="guest-msg">
          Sign in with Discord to save your progress and stats.
        </div>
        <button class="auth-btn login-btn" @click=${this.handleLogin}>
          <svg
            width="20"
            height="15"
            viewBox="0 0 71 55"
            fill="currentColor"
          >
            <path
              d="M60.1 4.9A58.5 58.5 0 0045.4.2a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.5 37.5 0 0025.4.3a.2.2 0 00-.2-.1 58.4 58.4 0 00-14.7 4.6.2.2 0 00-.1.1C1.5 18.7-.9 32 .3 45.2v.1a58.7 58.7 0 0017.9 9.1.2.2 0 00.3-.1 42 42 0 003.6-5.9.2.2 0 00-.1-.3 38.7 38.7 0 01-5.5-2.6.2.2 0 01 0-.4l1.1-.9a.2.2 0 01.2 0 41.9 41.9 0 0035.6 0 .2.2 0 01.2 0l1.1.9a.2.2 0 010 .3 36.3 36.3 0 01-5.5 2.7.2.2 0 00-.1.3 47.2 47.2 0 003.6 5.9.2.2 0 00.3.1A58.5 58.5 0 0070.7 45.3v-.1C72.1 30.1 68.1 16.9 60.2 5a.2.2 0 00-.1-.1zM23.7 37.1c-3.5 0-6.3-3.2-6.3-7.1s2.8-7.1 6.3-7.1 6.4 3.2 6.3 7.1c0 3.9-2.8 7.1-6.3 7.1zm23.3 0c-3.5 0-6.3-3.2-6.3-7.1s2.8-7.1 6.3-7.1 6.4 3.2 6.3 7.1c0 3.9-2.8 7.1-6.3 7.1z"
            />
          </svg>
          Sign in with Discord
        </button>
      `;
    }

    const p = this.profile;
    const winRate =
      p.gamesPlayed > 0
        ? Math.round((p.gamesWon / p.gamesPlayed) * 100)
        : 0;

    return html`
      <div class="profile-header">
        <div class="avatar">
          ${p.avatarUrl
            ? html`<img src="${p.avatarUrl}" alt="${p.username}" />`
            : html`${p.username.charAt(0).toUpperCase()}`}
        </div>
        <div class="username">${p.username}</div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Games</div>
          <div class="stat-val">${p.gamesPlayed}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Win Rate</div>
          <div class="stat-val">${winRate}%</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Planets</div>
          <div class="stat-val">${p.totalPlanets.toLocaleString()}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Kills</div>
          <div class="stat-val">${p.totalKills.toLocaleString()}</div>
        </div>
      </div>

      ${this.recentGames.length > 0
        ? html`
            <div class="section-title">Recent Games</div>
            <div class="games-list">
              ${this.recentGames.map(
                (g) => html`
                  <div class="game-row">
                    <span>${g.mode}</span>
                    <span class="game-meta">${g.duration}</span>
                    <span
                      class="game-result ${g.result === "win" ? "game-win" : "game-loss"}"
                    >
                      ${g.result === "win" ? "W" : "L"}
                    </span>
                  </div>
                `,
              )}
            </div>
          `
        : null}

      <button class="auth-btn logout-btn" @click=${this.handleLogout}>
        Log Out
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "gf-account-modal": AccountModal;
  }
}
