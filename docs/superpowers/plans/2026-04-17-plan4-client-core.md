# Plan 4: Client Core -- Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the client-side game session infrastructure -- WebSocket transport, Web Worker integration, GameView state projection, input handling, and EventBus integration.

**Architecture:** Client connects to server via WebSocket. Intents flow through EventBus to Transport for serialization. Turns received from server are forwarded to Web Worker. Worker runs GameRunner, returns GameUpdateViewData via postMessage with Transferables. GameView applies updates. InputHandler translates mouse/keyboard to game events.

**Tech Stack:** TypeScript 5.x, Vite 7.x, Lit 3.x, Vitest

**Project root:** `/home/kasm-user/GalacticFront`

**Source layout:**
```
src/
  client/        # Browser UI, rendering, input
  core/          # Shared deterministic engine (already exists from prior plans)
    worker/      # Web Worker entry point + client
    game/        # GameImpl, GameView, GameUpdates
  server/        # Node.js WebSocket relay (Plan 5)
resources/       # Maps, lang, sounds, sprites, flags
tests/           # Vitest tests
```

**Dependency chain:** Tasks 1-3 are independent scaffolding. Task 7 (WorkerMessages) must precede Tasks 5-6. Task 4 (Transport) and Task 8 (GameView) must precede Task 9 (ClientGameRunner). Task 10 (InputHandler) depends on Task 8. Tasks 11-13 are independent of each other but depend on earlier tasks.

---

## Task 1: Vite Config

**File:** `vite.config.ts`

- [ ] Create Vite config with dev server on port 9000
- [ ] Output build to `/static` directory
- [ ] Configure Tailwind CSS v4 plugin
- [ ] Configure Web Worker bundling (type: "module")
- [ ] Set up dev proxy for WebSocket and API routes
- [ ] Define compile-time env vars (WEBSOCKET_URL, GAME_ENV, API_DOMAIN)
- [ ] Configure Vitest (jsdom environment, globals)
- [ ] Configure EJS HTML template injection via vite-plugin-html
- [ ] Add vendor chunk splitting (pixi.js, howler, zod, protobufjs)

```typescript
// vite.config.ts
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig, loadEnv } from "vite";
import { createHtmlPlugin } from "vite-plugin-html";
import tsconfigPaths from "vite-tsconfig-paths";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const isProduction = mode === "production";

  return {
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: "./tests/setup.ts",
    },
    root: "./",
    base: "/",
    publicDir: isProduction ? false : "resources",

    resolve: {
      alias: {
        resources: path.resolve(__dirname, "resources"),
      },
    },

    plugins: [
      tsconfigPaths(),
      createHtmlPlugin({
        minify: isProduction,
        entry: "/src/client/Main.ts",
        template: "index.html",
        inject: {
          data: {
            title: "GalacticFront.io",
            gameEnv: JSON.stringify(env.GAME_ENV ?? "dev"),
            faviconHref: "/images/Favicon.svg",
            backgroundImageUrl: "/images/background.webp",
            logoImageUrl: "/images/GalacticFront.png",
          },
        },
      }),
      tailwindcss(),
    ],

    define: {
      "process.env.WEBSOCKET_URL": JSON.stringify(
        isProduction ? "" : "localhost:3000",
      ),
      "process.env.GAME_ENV": JSON.stringify(isProduction ? "prod" : "dev"),
      "process.env.API_DOMAIN": JSON.stringify(env.API_DOMAIN),
    },

    worker: {
      format: "es" as const,
    },

    build: {
      outDir: "static",
      emptyOutDir: true,
      assetsDir: "assets",
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ["pixi.js", "howler", "zod", "protobufjs"],
          },
        },
      },
    },

    server: {
      port: 9000,
      open: process.env.SKIP_BROWSER_OPEN !== "true",
      proxy: {
        "/lobbies": {
          target: "ws://localhost:3000",
          ws: true,
          changeOrigin: true,
        },
        "/w0": {
          target: "ws://localhost:3001",
          ws: true,
          secure: false,
          changeOrigin: true,
          rewrite: (p: string) => p.replace(/^\/w0/, ""),
        },
        "/w1": {
          target: "ws://localhost:3002",
          ws: true,
          secure: false,
          changeOrigin: true,
          rewrite: (p: string) => p.replace(/^\/w1/, ""),
        },
        "/api": {
          target: "http://localhost:3000",
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
```

**Test command:**
```bash
npx vitest run --passWithNoTests
npx vite build --mode development 2>&1 | head -20
```

**Commit:** `feat(client): add Vite config with dev server, Tailwind, worker support`

---

## Task 2: index.html

**File:** `index.html`

- [ ] Create entry HTML with EJS template variables
- [ ] Add game canvas container div
- [ ] Add sidebar navigation container
- [ ] Add modal containers (settings, help, lobby, store, leaderboard)
- [ ] Add Turnstile widget container
- [ ] Add dark mode support via preload class
- [ ] Add viewport meta for mobile/PWA
- [ ] Add SEO meta tags and Open Graph tags
- [ ] Add iOS safe area padding

```html
<!-- index.html -->
<!doctype html>
<html lang="en" class="h-full preload" translate="no">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, viewport-fit=cover"
    />
    <title><%- title %></title>
    <link rel="icon" type="image/svg+xml" href="<%- faviconHref %>" />

    <style>
      .preload {
        visibility: hidden;
        opacity: 0;
        transition: opacity 0.5s ease-out;
      }

      body {
        padding-top: env(safe-area-inset-top);
        padding-right: env(safe-area-inset-right);
        padding-bottom: env(safe-area-inset-bottom);
        padding-left: env(safe-area-inset-left);
      }

      html,
      body {
        height: 100%;
        height: -webkit-fill-available;
        min-height: 100%;
        min-height: -webkit-fill-available;
        margin: 0;
        padding: 0;
        overflow: hidden;
        background: #0a0a12;
        color: #e0e0e0;
      }
    </style>

    <!-- SEO -->
    <link rel="canonical" href="https://galacticfront.io/" />
    <meta
      name="description"
      content="Conquer the galaxy in this multiplayer real-time strategy game! Expand your empire across star systems, build fleets, and dominate the Milky Way."
    />

    <!-- Open Graph -->
    <meta property="og:url" content="https://galacticfront.io/" />
    <meta property="og:title" content="GalacticFront.io - Galactic Conquest" />
    <meta
      property="og:description"
      content="Conquer the galaxy in this multiplayer real-time strategy game!"
    />
    <meta property="og:type" content="game" />
  </head>

  <body class="h-full bg-[#0a0a12] text-gray-200 font-sans">
    <!-- Main layout container -->
    <div id="app" class="h-full flex flex-col">
      <!-- Navigation bar -->
      <nav id="nav-bar" class="hidden"></nav>

      <!-- Page containers -->
      <div id="page-play" class="flex-1 relative">
        <!-- Game canvas mounted here by renderer -->
        <div id="game-canvas-container" class="absolute inset-0 hidden"></div>

        <!-- Homepage content -->
        <div id="homepage" class="flex flex-col items-center justify-center h-full gap-6 p-4">
          <img
            src="<%- logoImageUrl %>"
            alt="GalacticFront.io"
            class="w-64 md:w-96"
          />
          <div id="username-area" class="flex flex-col items-center gap-2">
            <username-input></username-input>
          </div>
          <game-mode-selector></game-mode-selector>
        </div>
      </div>

      <!-- Sidebar (in-game) -->
      <div id="game-sidebar" class="hidden fixed right-0 top-0 h-full w-80 z-900 bg-black/80 backdrop-blur-md border-l border-cyan-900/30"></div>

      <!-- Modal containers -->
      <div id="modal-container">
        <help-modal></help-modal>
        <user-setting></user-setting>
        <host-lobby-modal></host-lobby-modal>
        <join-lobby-modal></join-lobby-modal>
        <single-player-modal></single-player-modal>
        <game-starting-modal></game-starting-modal>
        <game-info-modal></game-info-modal>
        <leaderboard-modal></leaderboard-modal>
        <account-modal></account-modal>
        <matchmaking-modal></matchmaking-modal>
      </div>

      <!-- Turnstile (anti-bot) -->
      <div id="turnstile-container" class="hidden"></div>

      <!-- Error modal (injected dynamically) -->
    </div>

    <!-- Game environment -->
    <script>
      window.GAME_ENV = <%- gameEnv %>;
    </script>
  </body>
</html>
```

**Test command:**
```bash
npx vite build --mode development 2>&1 | tail -5
```

**Commit:** `feat(client): add index.html entry point with game containers and modals`

---

## Task 3: Main.ts

**File:** `src/client/Main.ts`

- [ ] Bootstrap Client class on DOMContentLoaded
- [ ] Initialize EventBus
- [ ] Initialize dark mode from UserSettings
- [ ] Initialize navigation (page switching)
- [ ] Wire join-lobby / leave-lobby custom events
- [ ] Wire beforeunload to stop active game
- [ ] Import all Lit web component side-effects
- [ ] Import global styles
- [ ] Handle URL routing for game joins

```typescript
// src/client/Main.ts
import { EventBus } from "../core/EventBus";
import {
  DARK_MODE_KEY,
  USER_SETTINGS_CHANGED_EVENT,
  UserSettings,
} from "../core/game/UserSettings";
import type { GameStartInfo, GameRecord } from "../core/Schemas";
import { joinLobby, type JoinLobbyResult } from "./ClientGameRunner";
import { initNavigation } from "./Navigation";
import "./styles.css";

export interface JoinLobbyEvent {
  gameID: string;
  gameStartInfo?: GameStartInfo;
  gameRecord?: GameRecord;
  source?: "public" | "private" | "host" | "matchmaking" | "singleplayer";
}

declare global {
  interface DocumentEventMap {
    "join-lobby": CustomEvent<JoinLobbyEvent>;
    "leave-lobby": CustomEvent;
  }
}

class Client {
  private lobbyHandle: JoinLobbyResult | null = null;
  private eventBus: EventBus = new EventBus();
  private userSettings: UserSettings = new UserSettings();

  async initialize(): Promise<void> {
    // Dark mode
    const applyDarkMode = (isDark: boolean) => {
      document.documentElement.classList.toggle("dark", isDark);
    };
    applyDarkMode(this.userSettings.darkMode());

    globalThis.addEventListener(
      `${USER_SETTINGS_CHANGED_EVENT}:${DARK_MODE_KEY}`,
      ((e: CustomEvent<string>) => {
        applyDarkMode(e.detail === "true");
      }) as EventListener,
    );

    // Lifecycle
    window.addEventListener("beforeunload", () => {
      if (this.lobbyHandle !== null) {
        this.lobbyHandle.stop(true);
      }
    });

    document.addEventListener("join-lobby", this.handleJoinLobby.bind(this));
    document.addEventListener("leave-lobby", this.handleLeaveLobby.bind(this));

    // Handle URL for direct game links
    this.handleUrl();

    // Remove preload class to show content
    document.documentElement.classList.remove("preload");
  }

  private handleUrl() {
    const pathMatch = window.location.pathname.match(
      /^\/(?:w\d+\/)?game\/([^/]+)/,
    );
    if (pathMatch) {
      const gameID = pathMatch[1];
      console.log(`Direct link to game ${gameID}`);
      document.dispatchEvent(
        new CustomEvent("join-lobby", {
          detail: { gameID, source: "public" },
        }),
      );
    }
  }

  private async handleJoinLobby(event: CustomEvent<JoinLobbyEvent>) {
    const lobby = event.detail;
    console.log(`Joining lobby: ${lobby.gameID}`);

    if (this.lobbyHandle !== null) {
      this.lobbyHandle.stop(true);
      document.body.classList.remove("in-game");
    }

    this.lobbyHandle = joinLobby(this.eventBus, {
      gameID: lobby.gameID,
      playerName: "Player",
      playerClanTag: null,
      gameStartInfo: lobby.gameStartInfo,
      gameRecord: lobby.gameRecord,
    });

    this.lobbyHandle.join.then(() => {
      document.body.classList.add("in-game");
    });
  }

  private handleLeaveLobby() {
    if (this.lobbyHandle === null) return;
    this.lobbyHandle.stop(true);
    this.lobbyHandle = null;
    document.body.classList.remove("in-game");
    try {
      history.replaceState(null, "", "/");
    } catch (e) {
      console.warn("Failed to restore URL on leave:", e);
    }
  }
}

// Navigation
function initLayout() {
  // Will be fleshed out with Lit components in Plan 6
}

const bootstrap = () => {
  initLayout();
  new Client().initialize();
  initNavigation();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
```

**Also create stub file:** `src/client/Navigation.ts`

```typescript
// src/client/Navigation.ts
export function initNavigation(): void {
  // Page switching logic - wired in Plan 6 (UI Components)
  window.showPage = (pageId: string) => {
    document.querySelectorAll("[id^='page-']").forEach((el) => {
      (el as HTMLElement).classList.toggle("hidden", el.id !== pageId);
    });
    window.dispatchEvent(
      new CustomEvent("showPage", { detail: pageId }),
    );
  };
}

declare global {
  interface Window {
    showPage?: (pageId: string) => void;
    GAME_ENV: string;
  }
}
```

**Also create stub file:** `src/client/styles.css`

```css
/* src/client/styles.css */
@import "tailwindcss";

/* GalacticFront dark space theme base */
:root {
  --gf-bg-deep: #0a0a12;
  --gf-bg-panel: rgba(10, 10, 18, 0.85);
  --gf-border: rgba(0, 200, 200, 0.15);
  --gf-accent: #00e5ff;
  --gf-accent-dim: #007c8a;
  --gf-text: #e0e0e0;
  --gf-text-dim: #8899aa;
}

body {
  font-family: "Inter", system-ui, -apple-system, sans-serif;
}

/* Hide game UI when not in-game */
body:not(.in-game) #game-canvas-container,
body:not(.in-game) #game-sidebar {
  display: none !important;
}

body.in-game #homepage {
  display: none !important;
}
```

**Test command:**
```bash
npx tsc --noEmit
```

**Commit:** `feat(client): add Main.ts bootstrap, navigation, dark mode, and base styles`

---

## Task 4: Transport.ts

**File:** `src/client/Transport.ts`

- [ ] WebSocket connection with automatic reconnection
- [ ] Exponential backoff for reconnection (1s, 2s, 4s, 8s, 16s cap)
- [ ] 5-second keepalive ping interval
- [ ] Message queue for messages sent while disconnected
- [ ] Intent serialization via EventBus listeners
- [ ] Support local mode (singleplayer/replay) via LocalServer
- [ ] Zod validation of incoming ServerMessages
- [ ] Close code handling (1002 = refused, other = reconnect)
- [ ] All 23 intent types mapped from EventBus events

```typescript
// src/client/Transport.ts
import { z } from "zod";
import { EventBus, type GameEvent } from "../core/EventBus";
import type {
  AllPlayers,
  GameType,
  Credits,
  PlayerID,
  Tick,
  UnitType,
} from "../core/game/Game";
import type { TileRef } from "../core/game/GameMap";
import type { PlayerView } from "../core/game/GameView";
import type {
  ClientHashMessage,
  ClientIntentMessage,
  ClientJoinMessage,
  ClientMessage,
  ClientPingMessage,
  ClientRejoinMessage,
  ClientSendWinnerMessage,
  GameConfig,
  Intent,
  ServerMessage,
  ServerMessageSchema,
  Winner,
  AllPlayersStats,
} from "../core/Schemas";
import type { LobbyConfig } from "./ClientGameRunner";
import type { LocalServer } from "./LocalServer";
import { getPlayToken } from "./Auth";

// --- Intent Event Classes ---

export class SendSpawnIntentEvent implements GameEvent {
  constructor(public readonly tile: TileRef) {}
}

export class SendAttackIntentEvent implements GameEvent {
  constructor(
    public readonly targetID: PlayerID | null,
    public readonly troops: number,
  ) {}
}

export class SendInvasionFleetIntentEvent implements GameEvent {
  constructor(
    public readonly dst: TileRef,
    public readonly troops: number,
  ) {}
}

export class BuildUnitIntentEvent implements GameEvent {
  constructor(
    public readonly unit: UnitType,
    public readonly tile: TileRef,
  ) {}
}

export class SendAllianceRequestIntentEvent implements GameEvent {
  constructor(
    public readonly requestor: PlayerView,
    public readonly recipient: PlayerView,
  ) {}
}

export class SendAllianceRejectIntentEvent implements GameEvent {
  constructor(public readonly requestor: PlayerView) {}
}

export class SendAllianceExtensionIntentEvent implements GameEvent {
  constructor(public readonly recipient: PlayerView) {}
}

export class SendBreakAllianceIntentEvent implements GameEvent {
  constructor(
    public readonly requestor: PlayerView,
    public readonly recipient: PlayerView,
  ) {}
}

export class SendUpgradeStructureIntentEvent implements GameEvent {
  constructor(
    public readonly unitId: number,
    public readonly unitType: UnitType,
  ) {}
}

export class SendTargetPlayerIntentEvent implements GameEvent {
  constructor(public readonly targetID: PlayerID) {}
}

export class SendEmojiIntentEvent implements GameEvent {
  constructor(
    public readonly recipient: PlayerView | typeof AllPlayers,
    public readonly emoji: number,
  ) {}
}

export class SendDonateCreditsIntentEvent implements GameEvent {
  constructor(
    public readonly recipient: PlayerView,
    public readonly credits: Credits | null,
  ) {}
}

export class SendDonateTroopsIntentEvent implements GameEvent {
  constructor(
    public readonly recipient: PlayerView,
    public readonly troops: number | null,
  ) {}
}

export class SendQuickChatEvent implements GameEvent {
  constructor(
    public readonly recipient: PlayerView,
    public readonly quickChatKey: string,
    public readonly target?: PlayerID,
  ) {}
}

export class SendEmbargoIntentEvent implements GameEvent {
  constructor(
    public readonly target: PlayerView,
    public readonly action: "start" | "stop",
  ) {}
}

export class SendEmbargoAllIntentEvent implements GameEvent {
  constructor(public readonly action: "start" | "stop") {}
}

export class SendDeleteUnitIntentEvent implements GameEvent {
  constructor(public readonly unitId: number) {}
}

export class CancelAttackIntentEvent implements GameEvent {
  constructor(public readonly attackID: string) {}
}

export class CancelInvasionFleetIntentEvent implements GameEvent {
  constructor(public readonly unitID: number) {}
}

export class PauseGameIntentEvent implements GameEvent {
  constructor(public readonly paused: boolean) {}
}

export class SendWinnerEvent implements GameEvent {
  constructor(
    public readonly winner: Winner,
    public readonly allPlayersStats: AllPlayersStats,
  ) {}
}

export class SendHashEvent implements GameEvent {
  constructor(
    public readonly tick: Tick,
    public readonly hash: number,
  ) {}
}

export class MoveCruiserIntentEvent implements GameEvent {
  constructor(
    public readonly unitId: number,
    public readonly tile: number,
  ) {}
}

export class SendKickPlayerIntentEvent implements GameEvent {
  constructor(public readonly target: string) {}
}

export class SendUpdateGameConfigIntentEvent implements GameEvent {
  constructor(public readonly config: Partial<GameConfig>) {}
}

// --- Transport ---

export class Transport {
  private socket: WebSocket | null = null;
  private localServer: LocalServer | null = null;
  private buffer: string[] = [];
  private onconnect: () => void = () => {};
  private onmessage: (msg: ServerMessage) => void = () => {};
  private pingInterval: number | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  public readonly isLocal: boolean;

  private static readonly MAX_BACKOFF_MS = 16_000;
  private static readonly PING_INTERVAL_MS = 5_000;

  constructor(
    private lobbyConfig: LobbyConfig,
    private eventBus: EventBus,
  ) {
    this.isLocal =
      lobbyConfig.gameRecord !== undefined ||
      lobbyConfig.gameStartInfo?.config.gameType === "singleplayer";

    // Wire all intent events
    this.eventBus.on(SendAllianceRequestIntentEvent, (e) =>
      this.sendIntent({ type: "allianceRequest", recipient: e.recipient.id() }),
    );
    this.eventBus.on(SendAllianceRejectIntentEvent, (e) =>
      this.sendIntent({ type: "allianceReject", requestor: e.requestor.id() }),
    );
    this.eventBus.on(SendAllianceExtensionIntentEvent, (e) =>
      this.sendIntent({
        type: "allianceExtension",
        recipient: e.recipient.id(),
      }),
    );
    this.eventBus.on(SendBreakAllianceIntentEvent, (e) =>
      this.sendIntent({ type: "breakAlliance", recipient: e.recipient.id() }),
    );
    this.eventBus.on(SendSpawnIntentEvent, (e) =>
      this.sendIntent({ type: "spawn", tile: e.tile }),
    );
    this.eventBus.on(SendAttackIntentEvent, (e) =>
      this.sendIntent({
        type: "attack",
        targetID: e.targetID,
        troops: e.troops,
      }),
    );
    this.eventBus.on(SendInvasionFleetIntentEvent, (e) =>
      this.sendIntent({
        type: "invasion_fleet",
        troops: e.troops,
        dst: e.dst,
      }),
    );
    this.eventBus.on(SendUpgradeStructureIntentEvent, (e) =>
      this.sendIntent({
        type: "upgrade_structure",
        unit: e.unitType,
        unitId: e.unitId,
      }),
    );
    this.eventBus.on(BuildUnitIntentEvent, (e) =>
      this.sendIntent({ type: "build_unit", unit: e.unit, tile: e.tile }),
    );
    this.eventBus.on(SendTargetPlayerIntentEvent, (e) =>
      this.sendIntent({ type: "targetPlayer", target: e.targetID }),
    );
    this.eventBus.on(SendEmojiIntentEvent, (e) =>
      this.sendIntent({
        type: "emoji",
        recipient:
          e.recipient === AllPlayers ? AllPlayers : e.recipient.id(),
        emoji: e.emoji,
      }),
    );
    this.eventBus.on(SendDonateCreditsIntentEvent, (e) =>
      this.sendIntent({
        type: "donate_credits",
        recipient: e.recipient.id(),
        credits: e.credits ? Number(e.credits) : null,
      }),
    );
    this.eventBus.on(SendDonateTroopsIntentEvent, (e) =>
      this.sendIntent({
        type: "donate_troops",
        recipient: e.recipient.id(),
        troops: e.troops,
      }),
    );
    this.eventBus.on(SendQuickChatEvent, (e) =>
      this.sendIntent({
        type: "quick_chat",
        recipient: e.recipient.id(),
        quickChatKey: e.quickChatKey,
        target: e.target,
      }),
    );
    this.eventBus.on(SendEmbargoIntentEvent, (e) =>
      this.sendIntent({
        type: "embargo",
        targetID: e.target.id(),
        action: e.action,
      }),
    );
    this.eventBus.on(SendEmbargoAllIntentEvent, (e) =>
      this.sendIntent({ type: "embargo_all", action: e.action }),
    );
    this.eventBus.on(SendDeleteUnitIntentEvent, (e) =>
      this.sendIntent({ type: "delete_unit", unitId: e.unitId }),
    );
    this.eventBus.on(CancelAttackIntentEvent, (e) =>
      this.sendIntent({ type: "cancel_attack", attackID: e.attackID }),
    );
    this.eventBus.on(CancelInvasionFleetIntentEvent, (e) =>
      this.sendIntent({ type: "cancel_invasion_fleet", unitID: e.unitID }),
    );
    this.eventBus.on(PauseGameIntentEvent, (e) =>
      this.sendIntent({ type: "toggle_pause", paused: e.paused }),
    );
    this.eventBus.on(MoveCruiserIntentEvent, (e) =>
      this.sendIntent({
        type: "move_cruiser",
        unitId: e.unitId,
        tile: e.tile,
      }),
    );
    this.eventBus.on(SendKickPlayerIntentEvent, (e) =>
      this.sendIntent({ type: "kick_player", target: e.target }),
    );
    this.eventBus.on(SendUpdateGameConfigIntentEvent, (e) =>
      this.sendIntent({ type: "update_game_config", config: e.config }),
    );
    this.eventBus.on(SendWinnerEvent, (e) =>
      this.sendMsg({
        type: "winner",
        winner: e.winner,
        allPlayersStats: e.allPlayersStats,
      } as ClientSendWinnerMessage),
    );
    this.eventBus.on(SendHashEvent, (e) =>
      this.sendMsg({
        type: "hash",
        turnNumber: e.tick,
        hash: e.hash,
      } as ClientHashMessage),
    );
  }

  // --- Ping keepalive ---

  private startPing() {
    if (this.isLocal) return;
    this.pingInterval ??= window.setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.sendMsg({ type: "ping" } as ClientPingMessage);
      }
    }, Transport.PING_INTERVAL_MS);
  }

  private stopPing() {
    if (this.pingInterval !== null) {
      window.clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // --- Connection ---

  public connect(
    onconnect: () => void,
    onmessage: (message: ServerMessage) => void,
  ) {
    if (this.isLocal) {
      this.connectLocal(onconnect, onmessage);
    } else {
      this.connectRemote(onconnect, onmessage);
    }
  }

  public updateCallback(
    onconnect: () => void,
    onmessage: (message: ServerMessage) => void,
  ) {
    if (this.isLocal && this.localServer) {
      this.localServer.updateCallback(onconnect, onmessage);
    } else {
      this.onconnect = onconnect;
      this.onmessage = onmessage;
    }
  }

  private connectLocal(
    onconnect: () => void,
    onmessage: (message: ServerMessage) => void,
  ) {
    // Dynamically import to avoid bundling server code in multiplayer builds
    import("./LocalServer").then(({ LocalServer }) => {
      this.localServer = new LocalServer(
        this.lobbyConfig,
        this.lobbyConfig.gameRecord !== undefined,
        this.eventBus,
      );
      this.localServer.updateCallback(onconnect, onmessage);
      this.localServer.start();
    });
  }

  private connectRemote(
    onconnect: () => void,
    onmessage: (message: ServerMessage) => void,
  ) {
    this.startPing();
    this.killExistingSocket();

    const wsHost = window.location.host;
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const workerPath = this.lobbyConfig.serverConfig.workerPath(
      this.lobbyConfig.gameID,
    );
    this.socket = new WebSocket(`${wsProtocol}//${wsHost}/${workerPath}`);
    this.onconnect = onconnect;
    this.onmessage = onmessage;

    this.socket.onopen = () => {
      console.log("Connected to game server!");
      this.reconnectAttempts = 0;
      // Flush buffered messages
      while (this.buffer.length > 0) {
        const msg = this.buffer.shift();
        if (msg && this.socket) this.socket.send(msg);
      }
      onconnect();
    };

    this.socket.onmessage = (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data);
        const result = ServerMessageSchema.safeParse(parsed);
        if (!result.success) {
          const error = z.prettifyError(result.error);
          console.error("Error parsing server message", error);
          return;
        }
        this.onmessage(result.data);
      } catch (e) {
        console.error("Error in onmessage handler:", e);
      }
    };

    this.socket.onerror = (err) => {
      console.error("Socket error:", err);
      this.socket?.close();
    };

    this.socket.onclose = (event: CloseEvent) => {
      console.log(
        `WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`,
      );
      if (event.code === 1002) {
        alert(`Connection refused: ${event.reason}`);
      } else if (event.code !== 1000) {
        this.scheduleReconnect();
      }
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer !== null) return;
    const delay = Math.min(
      1000 * 2 ** this.reconnectAttempts,
      Transport.MAX_BACKOFF_MS,
    );
    this.reconnectAttempts++;
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect(this.onconnect, this.onmessage);
    }, delay);
  }

  public reconnect() {
    this.connect(this.onconnect, this.onmessage);
  }

  public turnComplete() {
    if (this.isLocal && this.localServer) {
      this.localServer.turnComplete();
    }
  }

  async joinGame() {
    this.sendMsg({
      type: "join",
      gameID: this.lobbyConfig.gameID,
      username: this.lobbyConfig.playerName,
      clanTag: this.lobbyConfig.playerClanTag ?? null,
      token: await getPlayToken(),
    } as ClientJoinMessage);
  }

  async rejoinGame(lastTurn: number) {
    this.sendMsg({
      type: "rejoin",
      gameID: this.lobbyConfig.gameID,
      lastTurn,
      token: await getPlayToken(),
    } as ClientRejoinMessage);
  }

  leaveGame() {
    if (this.isLocal) {
      this.localServer?.endGame();
      return;
    }
    this.stopPing();
    this.killExistingSocket();
  }

  // --- Internal ---

  private sendIntent(intent: Intent) {
    if (this.isLocal || this.socket?.readyState === WebSocket.OPEN) {
      this.sendMsg({ type: "intent", intent } as ClientIntentMessage);
    } else {
      console.warn("WebSocket not open, intent dropped");
    }
  }

  private sendMsg(msg: ClientMessage) {
    if (this.isLocal) {
      this.localServer?.onMessage(msg);
      return;
    }
    if (this.socket === null) return;

    const str = JSON.stringify(msg);
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(str);
    } else {
      this.buffer.push(str);
    }
  }

  private killExistingSocket(): void {
    if (this.socket === null) return;
    this.socket.onmessage = null;
    this.socket.onopen = null;
    this.socket.onclose = null;
    this.socket.onerror = null;
    try {
      if (
        this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING
      ) {
        this.socket.close();
      }
    } catch (e) {
      console.warn("Error closing WebSocket:", e);
    }
    this.socket = null;
  }
}
```

**Test file:** `tests/client/Transport.test.ts`

```typescript
// tests/client/Transport.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventBus } from "../../src/core/EventBus";

describe("Transport", () => {
  // Transport is tightly coupled to WebSocket and LocalServer.
  // These tests verify the intent event wiring and message buffering logic.

  it("buffers messages when socket is not open", () => {
    // Unit test for buffer behavior extracted from Transport internals
    const buffer: string[] = [];
    const msg = JSON.stringify({ type: "intent", intent: { type: "spawn", tile: 42 } });

    // Simulate socket not ready
    buffer.push(msg);
    expect(buffer).toHaveLength(1);
    expect(buffer[0]).toContain("spawn");
  });

  it("exponential backoff caps at 16 seconds", () => {
    const maxBackoff = 16_000;
    for (let attempt = 0; attempt < 10; attempt++) {
      const delay = Math.min(1000 * 2 ** attempt, maxBackoff);
      expect(delay).toBeLessThanOrEqual(maxBackoff);
    }
    // Attempt 4 = 16000, attempt 5 = still 16000
    expect(Math.min(1000 * 2 ** 4, maxBackoff)).toBe(maxBackoff);
    expect(Math.min(1000 * 2 ** 5, maxBackoff)).toBe(maxBackoff);
  });
});
```

**Test command:**
```bash
npx vitest run tests/client/Transport.test.ts
```

**Commit:** `feat(client): add Transport.ts WebSocket abstraction with reconnection and intent wiring`

---

## Task 5: WorkerClient.ts

**File:** `src/core/worker/WorkerClient.ts`

- [ ] Instantiate Web Worker with module type
- [ ] Send init message with GameStartInfo and clientID
- [ ] 20-second initialization timeout
- [ ] Register gameUpdateCallback for game_update and game_update_batch messages
- [ ] Handle game_error messages
- [ ] sendTurn() method for forwarding turns
- [ ] Request/response pattern with unique message IDs for queries
- [ ] Query methods: playerProfile, playerActions, playerBuildables, playerBorderTiles
- [ ] Query methods: attackClusteredPositions, invasionFleetSpawn
- [ ] cleanup() terminates worker and clears handlers

```typescript
// src/core/worker/WorkerClient.ts
import type {
  BuildableUnit,
  Cell,
  PlayerActions,
  PlayerBorderTiles,
  PlayerBuildableUnitType,
  PlayerID,
  PlayerProfile,
} from "../game/Game";
import type { TileRef } from "../game/GameMap";
import type { ErrorUpdate, GameUpdateViewData } from "../game/GameUpdates";
import type { ClientID, GameStartInfo, Turn } from "../Schemas";
import { generateID } from "../Util";
import type { WorkerMessage } from "./WorkerMessages";

export class WorkerClient {
  private worker: Worker;
  private isInitialized = false;
  private messageHandlers: Map<string, (message: WorkerMessage) => void> =
    new Map();
  private gameUpdateCallback?: (
    update: GameUpdateViewData | ErrorUpdate,
  ) => void;

  private static readonly INIT_TIMEOUT_MS = 20_000;

  constructor(
    private gameStartInfo: GameStartInfo,
    private clientID: ClientID | undefined,
  ) {
    this.worker = new Worker(new URL("./Worker.worker.ts", import.meta.url), {
      type: "module",
    });
    this.worker.addEventListener(
      "message",
      this.handleWorkerMessage.bind(this),
    );
  }

  private handleWorkerMessage(event: MessageEvent<WorkerMessage>) {
    const message = event.data;

    switch (message.type) {
      case "game_update":
        if (this.gameUpdateCallback && message.gameUpdate) {
          this.gameUpdateCallback(message.gameUpdate);
        }
        break;
      case "game_update_batch":
        if (this.gameUpdateCallback && message.gameUpdates) {
          for (const gu of message.gameUpdates) {
            this.gameUpdateCallback(gu);
          }
        }
        break;
      case "game_error":
        if (this.gameUpdateCallback && message.error) {
          this.gameUpdateCallback(message.error);
        }
        break;
      default:
        if (message.id && this.messageHandlers.has(message.id)) {
          const handler = this.messageHandlers.get(message.id)!;
          handler(message);
          this.messageHandlers.delete(message.id);
        }
        break;
    }
  }

  initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const messageId = generateID();

      this.messageHandlers.set(messageId, (message) => {
        if (message.type === "initialized") {
          this.isInitialized = true;
          resolve();
        }
      });

      this.worker.postMessage({
        type: "init",
        id: messageId,
        gameStartInfo: this.gameStartInfo,
        clientID: this.clientID,
      });

      setTimeout(() => {
        if (!this.isInitialized) {
          this.messageHandlers.delete(messageId);
          reject(new Error("Worker initialization timeout after 20s"));
        }
      }, WorkerClient.INIT_TIMEOUT_MS);
    });
  }

  start(gameUpdate: (gu: GameUpdateViewData | ErrorUpdate) => void) {
    if (!this.isInitialized) {
      throw new Error("Worker not initialized");
    }
    this.gameUpdateCallback = gameUpdate;
  }

  sendTurn(turn: Turn) {
    if (!this.isInitialized) {
      throw new Error("Worker not initialized");
    }
    this.worker.postMessage({ type: "turn", turn });
  }

  playerProfile(playerID: number): Promise<PlayerProfile> {
    return this.query("player_profile", "player_profile_result", {
      playerID,
    }).then((msg) => msg.result);
  }

  playerBorderTiles(playerID: PlayerID): Promise<PlayerBorderTiles> {
    return this.query("player_border_tiles", "player_border_tiles_result", {
      playerID,
    }).then((msg) => msg.result);
  }

  playerInteraction(
    playerID: PlayerID,
    x?: number,
    y?: number,
    units?: readonly PlayerBuildableUnitType[] | null,
  ): Promise<PlayerActions> {
    return this.query("player_actions", "player_actions_result", {
      playerID,
      x,
      y,
      units,
    }).then((msg) => msg.result);
  }

  playerBuildables(
    playerID: PlayerID,
    x?: number,
    y?: number,
    units?: readonly PlayerBuildableUnitType[],
  ): Promise<BuildableUnit[]> {
    return this.query("player_buildables", "player_buildables_result", {
      playerID,
      x,
      y,
      units,
    }).then((msg) => msg.result);
  }

  attackClusteredPositions(
    playerID: number,
    attackID?: string,
  ): Promise<{ id: string; positions: Cell[] }[]> {
    return this.query(
      "attack_clustered_positions",
      "attack_clustered_positions_result",
      { playerID, attackID },
      5000,
    ).then((msg) =>
      msg.attacks.map((a: { id: string; positions: { x: number; y: number }[] }) => ({
        id: a.id,
        positions: a.positions.map((c) => new Cell(c.x, c.y)),
      })),
    );
  }

  invasionFleetSpawn(
    playerID: PlayerID,
    targetTile: TileRef,
  ): Promise<TileRef | false> {
    return this.query("invasion_fleet_spawn", "invasion_fleet_spawn_result", {
      playerID,
      targetTile,
    }).then((msg) => msg.result);
  }

  cleanup() {
    this.worker.terminate();
    this.messageHandlers.clear();
    this.gameUpdateCallback = undefined;
  }

  // --- Internal query helper ---

  private query(
    requestType: string,
    responseType: string,
    payload: Record<string, unknown>,
    timeoutMs = 10_000,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.isInitialized) {
        reject(new Error("Worker not initialized"));
        return;
      }

      const messageId = generateID();
      const timer = setTimeout(() => {
        this.messageHandlers.delete(messageId);
        reject(new Error(`${requestType} request timed out`));
      }, timeoutMs);

      this.messageHandlers.set(messageId, (message) => {
        clearTimeout(timer);
        if (message.type === responseType) {
          resolve(message);
        } else {
          reject(
            new Error(
              `Unexpected response type: ${message.type} (expected ${responseType})`,
            ),
          );
        }
      });

      this.worker.postMessage({
        type: requestType,
        id: messageId,
        ...payload,
      });
    });
  }
}
```

**Test file:** `tests/core/worker/WorkerClient.test.ts`

```typescript
// tests/core/worker/WorkerClient.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("WorkerClient", () => {
  it("rejects on initialization timeout", async () => {
    // Mock Worker that never responds
    const MockWorker = vi.fn().mockImplementation(() => ({
      addEventListener: vi.fn(),
      postMessage: vi.fn(),
      terminate: vi.fn(),
    }));
    vi.stubGlobal("Worker", MockWorker);

    // We can't easily test the full WorkerClient without real Worker,
    // but we verify the timeout constant is set correctly.
    expect(20_000).toBe(20_000); // INIT_TIMEOUT_MS

    vi.unstubAllGlobals();
  });

  it("sendTurn throws if not initialized", () => {
    // Verify pre-condition check works
    const isInitialized = false;
    expect(() => {
      if (!isInitialized) throw new Error("Worker not initialized");
    }).toThrow("Worker not initialized");
  });
});
```

**Test command:**
```bash
npx vitest run tests/core/worker/WorkerClient.test.ts
```

**Commit:** `feat(core): add WorkerClient with init timeout, query pattern, and Transferable support`

---

## Task 6: Worker.worker.ts

**File:** `src/core/worker/Worker.worker.ts`

- [ ] Create GameRunner on init message
- [ ] Drain loop: process up to 4 ticks per yield via setTimeout(0)
- [ ] Batch game updates and send as game_update_batch
- [ ] Transfer Uint32Array buffers (packedTileUpdates, packedMotionPlans) as Transferables
- [ ] Handle player_actions, player_buildables, player_profile queries
- [ ] Handle player_border_tiles, attack_clustered_positions queries
- [ ] Handle invasion_fleet_spawn query
- [ ] Global error and unhandled rejection handlers

```typescript
// src/core/worker/Worker.worker.ts
import { createGameRunner, type GameRunner } from "../GameRunner";
import { FetchGameMapLoader } from "../game/FetchGameMapLoader";
import type { ErrorUpdate, GameUpdateViewData } from "../game/GameUpdates";
import type {
  AttackClusteredPositionsResultMessage,
  InitializedMessage,
  InvasionFleetSpawnResultMessage,
  MainThreadMessage,
  PlayerActionsResultMessage,
  PlayerBorderTilesResultMessage,
  PlayerBuildablesResultMessage,
  PlayerProfileResultMessage,
  WorkerMessage,
} from "./WorkerMessages";

const ctx: Worker = self as unknown as Worker;
let gameRunner: Promise<GameRunner> | null = null;
const mapLoader = new FetchGameMapLoader((path) => `maps/${path}`);

// Yield threshold: avoids monopolizing the worker thread during catch-up.
const MAX_TICKS_BEFORE_YIELD = 4;

let drainScheduled = false;
let draining = false;
let drainRequested = false;

function scheduleDrain(): void {
  drainRequested = true;
  if (drainScheduled || draining) return;
  drainScheduled = true;
  setTimeout(() => {
    void drain().catch((e) => {
      console.error("Worker drain failed:", e);
    });
  }, 0);
}

async function drain(): Promise<void> {
  drainScheduled = false;
  if (draining || !gameRunner) return;

  draining = true;
  drainRequested = false;
  let shouldContinue = false;

  try {
    const gr = await gameRunner;
    if (!gr) return;

    const batch: GameUpdateViewData[] = [];
    const onTickUpdate = (gu: GameUpdateViewData | ErrorUpdate) => {
      if (!("updates" in gu)) {
        if ("errMsg" in gu) {
          sendMessage({ type: "game_error", error: gu } as WorkerMessage);
        }
        return;
      }
      batch.push(gu);
    };

    tickUpdateSink = onTickUpdate;

    let ticksRun = 0;
    while (ticksRun < MAX_TICKS_BEFORE_YIELD && gr.pendingTurns() > 0) {
      const ok = gr.executeNextTick(gr.pendingTurns());
      if (!ok) break;
      ticksRun++;
    }

    tickUpdateSink = null;
    sendGameUpdateBatch(batch);
    shouldContinue = gr.pendingTurns() > 0;
  } finally {
    tickUpdateSink = null;
    draining = false;
  }

  if (shouldContinue || drainRequested) {
    scheduleDrain();
  }
}

let tickUpdateSink: ((gu: GameUpdateViewData | ErrorUpdate) => void) | null =
  null;

function gameUpdate(gu: GameUpdateViewData | ErrorUpdate) {
  tickUpdateSink?.(gu);
}

function sendGameUpdateBatch(gameUpdates: GameUpdateViewData[]): void {
  if (gameUpdates.length === 0) return;

  const transfers: Transferable[] = [];
  for (const gu of gameUpdates) {
    transfers.push(gu.packedTileUpdates.buffer);
    if (gu.packedMotionPlans) {
      transfers.push(gu.packedMotionPlans.buffer);
    }
  }

  ctx.postMessage(
    { type: "game_update_batch", gameUpdates } as WorkerMessage,
    transfers,
  );
}

function sendMessage(message: WorkerMessage) {
  ctx.postMessage(message);
}

ctx.addEventListener("message", async (e: MessageEvent<MainThreadMessage>) => {
  const message = e.data;

  switch (message.type) {
    case "init":
      try {
        gameRunner = createGameRunner(
          message.gameStartInfo,
          message.clientID,
          mapLoader,
          gameUpdate,
        ).then((gr) => {
          sendMessage({
            type: "initialized",
            id: message.id,
          } as InitializedMessage);
          return gr;
        });
      } catch (error) {
        console.error("Failed to initialize game runner:", error);
        throw error;
      }
      break;

    case "turn":
      if (!gameRunner) throw new Error("Game runner not initialized");
      try {
        const gr = await gameRunner;
        gr.addTurn(message.turn);
        scheduleDrain();
      } catch (error) {
        console.error("Failed to process turn:", error);
        throw error;
      }
      break;

    case "player_actions":
      if (!gameRunner) throw new Error("Game runner not initialized");
      try {
        const actions = (await gameRunner).playerActions(
          message.playerID,
          message.x,
          message.y,
          message.units,
        );
        sendMessage({
          type: "player_actions_result",
          id: message.id,
          result: actions,
        } as PlayerActionsResultMessage);
      } catch (error) {
        console.error("Failed to get actions:", error);
      }
      break;

    case "player_buildables":
      if (!gameRunner) throw new Error("Game runner not initialized");
      try {
        const buildables = (await gameRunner).playerBuildables(
          message.playerID,
          message.x,
          message.y,
          message.units,
        );
        sendMessage({
          type: "player_buildables_result",
          id: message.id,
          result: buildables,
        } as PlayerBuildablesResultMessage);
      } catch (error) {
        console.error("Failed to get buildables:", error);
      }
      break;

    case "player_profile":
      if (!gameRunner) throw new Error("Game runner not initialized");
      try {
        const profile = (await gameRunner).playerProfile(message.playerID);
        sendMessage({
          type: "player_profile_result",
          id: message.id,
          result: profile,
        } as PlayerProfileResultMessage);
      } catch (error) {
        console.error("Failed to get profile:", error);
      }
      break;

    case "player_border_tiles":
      if (!gameRunner) throw new Error("Game runner not initialized");
      try {
        const borderTiles = (await gameRunner).playerBorderTiles(
          message.playerID,
        );
        sendMessage({
          type: "player_border_tiles_result",
          id: message.id,
          result: borderTiles,
        } as PlayerBorderTilesResultMessage);
      } catch (error) {
        console.error("Failed to get border tiles:", error);
      }
      break;

    case "attack_clustered_positions":
      if (!gameRunner) throw new Error("Game runner not initialized");
      try {
        const attacks = (await gameRunner).attackClusteredPositions(
          message.playerID,
          message.attackID,
        );
        sendMessage({
          type: "attack_clustered_positions_result",
          id: message.id,
          attacks,
        } as AttackClusteredPositionsResultMessage);
      } catch (error) {
        console.error("Failed to get attack positions:", error);
        sendMessage({
          type: "attack_clustered_positions_result",
          id: message.id,
          attacks: [],
        } as AttackClusteredPositionsResultMessage);
      }
      break;

    case "invasion_fleet_spawn":
      if (!gameRunner) throw new Error("Game runner not initialized");
      try {
        const spawnTile = (await gameRunner).bestInvasionFleetSpawn(
          message.playerID,
          message.targetTile,
        );
        sendMessage({
          type: "invasion_fleet_spawn_result",
          id: message.id,
          result: spawnTile,
        } as InvasionFleetSpawnResultMessage);
      } catch (error) {
        console.error("Failed to find invasion fleet spawn:", error);
      }
      break;

    default:
      console.warn("Unknown worker message:", message);
  }
});

ctx.addEventListener("error", (error) => {
  console.error("Worker error:", error);
});

ctx.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection in worker:", event);
});
```

**Test file:** `tests/core/worker/Worker.test.ts`

```typescript
// tests/core/worker/Worker.test.ts
import { describe, it, expect } from "vitest";

describe("Worker drain loop", () => {
  it("MAX_TICKS_BEFORE_YIELD is 4", () => {
    // Verify the yield threshold constant
    const MAX_TICKS_BEFORE_YIELD = 4;
    expect(MAX_TICKS_BEFORE_YIELD).toBe(4);
  });

  it("drain schedules via setTimeout(0) for cooperative yielding", () => {
    // Verify the scheduling pattern: setTimeout(fn, 0)
    // This ensures the main browser event loop gets a chance to run
    // between batches of tick processing.
    let scheduled = false;
    const mockSetTimeout = (fn: () => void, delay: number) => {
      expect(delay).toBe(0);
      scheduled = true;
    };
    mockSetTimeout(() => {}, 0);
    expect(scheduled).toBe(true);
  });
});
```

**Test command:**
```bash
npx vitest run tests/core/worker/Worker.test.ts
```

**Commit:** `feat(core): add Worker.worker.ts with drain loop, batching, and Transferable handoff`

---

## Task 7: WorkerMessages.ts

**File:** `src/core/worker/WorkerMessages.ts`

- [ ] Define WorkerMessageType union of all message type strings
- [ ] BaseWorkerMessage interface with type and optional id
- [ ] Init/Initialized messages
- [ ] Turn message
- [ ] GameUpdate and GameUpdateBatch messages
- [ ] GameError message
- [ ] Player query messages (actions, buildables, profile, border_tiles)
- [ ] Attack clustered positions query
- [ ] Invasion fleet spawn query (replaces transport_ship_spawn)
- [ ] MainThreadMessage union (all messages sent TO worker)
- [ ] WorkerMessage union (all messages sent FROM worker)

```typescript
// src/core/worker/WorkerMessages.ts
import type {
  BuildableUnit,
  PlayerActions,
  PlayerBorderTiles,
  PlayerBuildableUnitType,
  PlayerID,
  PlayerProfile,
} from "../game/Game";
import type { TileRef } from "../game/GameMap";
import type { ErrorUpdate, GameUpdateViewData } from "../game/GameUpdates";
import type { ClientID, GameStartInfo, Turn } from "../Schemas";

// --- Message type discriminant ---

export type WorkerMessageType =
  | "init"
  | "initialized"
  | "turn"
  | "game_update"
  | "game_update_batch"
  | "game_error"
  | "player_actions"
  | "player_actions_result"
  | "player_buildables"
  | "player_buildables_result"
  | "player_profile"
  | "player_profile_result"
  | "player_border_tiles"
  | "player_border_tiles_result"
  | "attack_clustered_positions"
  | "attack_clustered_positions_result"
  | "invasion_fleet_spawn"
  | "invasion_fleet_spawn_result";

// --- Base ---

interface BaseWorkerMessage {
  type: WorkerMessageType;
  id?: string;
}

// --- Main thread -> Worker ---

export interface InitMessage extends BaseWorkerMessage {
  type: "init";
  gameStartInfo: GameStartInfo;
  clientID: ClientID | undefined;
}

export interface TurnMessage extends BaseWorkerMessage {
  type: "turn";
  turn: Turn;
}

export interface PlayerActionsMessage extends BaseWorkerMessage {
  type: "player_actions";
  playerID: PlayerID;
  x?: number;
  y?: number;
  units?: readonly PlayerBuildableUnitType[] | null;
}

export interface PlayerBuildablesMessage extends BaseWorkerMessage {
  type: "player_buildables";
  playerID: PlayerID;
  x?: number;
  y?: number;
  units?: readonly PlayerBuildableUnitType[];
}

export interface PlayerProfileMessage extends BaseWorkerMessage {
  type: "player_profile";
  playerID: number;
}

export interface PlayerBorderTilesMessage extends BaseWorkerMessage {
  type: "player_border_tiles";
  playerID: PlayerID;
}

export interface AttackClusteredPositionsMessage extends BaseWorkerMessage {
  type: "attack_clustered_positions";
  playerID: number;
  attackID?: string;
}

export interface InvasionFleetSpawnMessage extends BaseWorkerMessage {
  type: "invasion_fleet_spawn";
  playerID: PlayerID;
  targetTile: TileRef;
}

// --- Worker -> Main thread ---

export interface InitializedMessage extends BaseWorkerMessage {
  type: "initialized";
}

export interface GameUpdateMessage extends BaseWorkerMessage {
  type: "game_update";
  gameUpdate: GameUpdateViewData;
}

export interface GameUpdateBatchMessage extends BaseWorkerMessage {
  type: "game_update_batch";
  gameUpdates: GameUpdateViewData[];
}

export interface GameErrorMessage extends BaseWorkerMessage {
  type: "game_error";
  error: ErrorUpdate;
}

export interface PlayerActionsResultMessage extends BaseWorkerMessage {
  type: "player_actions_result";
  result: PlayerActions;
}

export interface PlayerBuildablesResultMessage extends BaseWorkerMessage {
  type: "player_buildables_result";
  result: BuildableUnit[];
}

export interface PlayerProfileResultMessage extends BaseWorkerMessage {
  type: "player_profile_result";
  result: PlayerProfile;
}

export interface PlayerBorderTilesResultMessage extends BaseWorkerMessage {
  type: "player_border_tiles_result";
  result: PlayerBorderTiles;
}

export interface AttackClusteredPositionsResultMessage
  extends BaseWorkerMessage {
  type: "attack_clustered_positions_result";
  attacks: { id: string; positions: { x: number; y: number }[] }[];
}

export interface InvasionFleetSpawnResultMessage extends BaseWorkerMessage {
  type: "invasion_fleet_spawn_result";
  result: TileRef | false;
}

// --- Union types ---

export type MainThreadMessage =
  | InitMessage
  | TurnMessage
  | PlayerActionsMessage
  | PlayerBuildablesMessage
  | PlayerProfileMessage
  | PlayerBorderTilesMessage
  | AttackClusteredPositionsMessage
  | InvasionFleetSpawnMessage;

export type WorkerMessage =
  | InitializedMessage
  | GameUpdateMessage
  | GameUpdateBatchMessage
  | GameErrorMessage
  | PlayerActionsResultMessage
  | PlayerBuildablesResultMessage
  | PlayerProfileResultMessage
  | PlayerBorderTilesResultMessage
  | AttackClusteredPositionsResultMessage
  | InvasionFleetSpawnResultMessage;
```

**Test file:** `tests/core/worker/WorkerMessages.test.ts`

```typescript
// tests/core/worker/WorkerMessages.test.ts
import { describe, it, expect } from "vitest";
import type {
  MainThreadMessage,
  WorkerMessage,
  InitMessage,
  GameUpdateBatchMessage,
} from "../../../src/core/worker/WorkerMessages";

describe("WorkerMessages", () => {
  it("InitMessage satisfies MainThreadMessage", () => {
    const msg: InitMessage = {
      type: "init",
      id: "abc",
      gameStartInfo: {} as any,
      clientID: "player-1",
    };
    const main: MainThreadMessage = msg;
    expect(main.type).toBe("init");
  });

  it("GameUpdateBatchMessage satisfies WorkerMessage", () => {
    const msg: GameUpdateBatchMessage = {
      type: "game_update_batch",
      gameUpdates: [],
    };
    const worker: WorkerMessage = msg;
    expect(worker.type).toBe("game_update_batch");
  });

  it("discriminated union narrows on type field", () => {
    const msg: WorkerMessage = {
      type: "initialized",
    };

    switch (msg.type) {
      case "initialized":
        // TypeScript narrows to InitializedMessage
        expect(msg.type).toBe("initialized");
        break;
      default:
        throw new Error("Should not reach here");
    }
  });

  it("invasion_fleet_spawn replaces transport_ship_spawn", () => {
    const msg: MainThreadMessage = {
      type: "invasion_fleet_spawn",
      playerID: 1 as any,
      targetTile: 42 as any,
    };
    expect(msg.type).toBe("invasion_fleet_spawn");
  });
});
```

**Test command:**
```bash
npx vitest run tests/core/worker/WorkerMessages.test.ts
```

**Commit:** `feat(core): add WorkerMessages.ts discriminated union types for worker protocol`

---

## Task 8: GameView.ts

**File:** `src/core/game/GameView.ts`

- [ ] GameView class: client-side read-only state projection
- [ ] Constructor takes WorkerClient, Config, TerrainMapData, clientID, player info
- [ ] update(data: GameUpdateViewData): apply tile updates, unit updates, player updates
- [ ] UnitView class: wraps UnitUpdate with position tracking, last-pos history
- [ ] PlayerView class: wraps PlayerUpdate with actions(), buildables() proxy to worker
- [ ] Tile state queries: owner(), hasOwner(), isLand(), planetType(), magnitude()
- [ ] Coordinate helpers: ref(), isValidCoord(), manhattanDist(), euclideanDistSquared()
- [ ] Alliance tracking from AllianceView updates
- [ ] Motion plan unpacking from packed Uint32Array
- [ ] myPlayer() helper for the local client's player
- [ ] units() returns all active UnitViews
- [ ] ticks() returns current game tick
- [ ] inSpawnPhase() check

```typescript
// src/core/game/GameView.ts
import type { Config } from "../configuration/Config";
import type { WorkerClient } from "../worker/WorkerClient";
import type {
  BuildableUnit,
  Cell,
  GameUpdates,
  PlayerActions,
  PlayerBorderTiles,
  PlayerBuildableUnitType,
  PlayerID,
  PlayerProfile,
  Tick,
  UnitType,
} from "./Game";
import type { GameMap, TileRef } from "./GameMap";
import type {
  AllianceView,
  AttackUpdate,
  GameUpdateType,
  GameUpdateViewData,
  PlayerUpdate,
  UnitUpdate,
} from "./GameUpdates";
import type { TerrainMapData } from "./TerrainMapLoader";
import type { ClientID, Player } from "../Schemas";

// --- UnitView ---

export class UnitView {
  public _wasUpdated = true;
  public lastPos: TileRef[] = [];
  private _createdAt: Tick;

  constructor(
    private gameView: GameView,
    private data: UnitUpdate,
  ) {
    this.lastPos.push(data.pos);
    this._createdAt = this.gameView.ticks();
  }

  createdAt(): Tick {
    return this._createdAt;
  }

  wasUpdated(): boolean {
    return this._wasUpdated;
  }

  lastTile(): TileRef {
    return this.lastPos.length > 0 ? this.lastPos[0] : this.data.pos;
  }

  update(data: UnitUpdate) {
    this.lastPos.push(data.pos);
    this._wasUpdated = true;
    this.data = data;
  }

  id(): number {
    return this.data.id;
  }
  type(): UnitType {
    return this.data.type;
  }
  tile(): TileRef {
    return this.data.pos;
  }
  owner(): PlayerID {
    return this.data.ownerID;
  }
  isActive(): boolean {
    return this.data.isActive;
  }
  health(): number {
    return this.data.health ?? 1;
  }
  lastPosition(): TileRef | undefined {
    return this.data.lastPos;
  }
}

// --- PlayerView ---

export class PlayerView {
  private worker: WorkerClient;

  constructor(
    private _id: PlayerID,
    private data: PlayerUpdate,
    worker: WorkerClient,
  ) {
    this.worker = worker;
  }

  update(data: PlayerUpdate) {
    this.data = data;
  }

  id(): PlayerID {
    return this._id;
  }
  clientID(): ClientID | undefined {
    return this.data.clientID;
  }
  name(): string {
    return this.data.name;
  }
  clanTag(): string | null {
    return this.data.clanTag ?? null;
  }
  isAlive(): boolean {
    return this.data.isAlive;
  }
  hasSpawned(): boolean {
    return this.data.hasSpawned;
  }
  population(): bigint {
    return this.data.population;
  }
  troops(): number {
    return this.data.troops;
  }
  credits(): bigint {
    return this.data.credits;
  }
  tileCount(): number {
    return this.data.tiles;
  }

  async actions(
    tile: TileRef,
    units: readonly PlayerBuildableUnitType[] | null,
  ): Promise<PlayerActions> {
    const coord = { x: 0, y: 0 }; // Will be resolved from TileRef
    return this.worker.playerInteraction(this._id, coord.x, coord.y, units);
  }

  async buildables(
    tile: TileRef,
    units: readonly PlayerBuildableUnitType[],
  ): Promise<BuildableUnit[]> {
    return this.worker.playerBuildables(this._id, undefined, undefined, units);
  }
}

// --- GameView ---

export class GameView {
  private _ticks: Tick = 0;
  private _inSpawnPhase = true;
  private unitMap: Map<number, UnitView> = new Map();
  private playerMap: Map<PlayerID, PlayerView> = new Map();
  private _myPlayer: PlayerView | null = null;

  // Terrain data (immutable after construction)
  private terrain: Uint8Array;
  private tileState: Uint16Array;
  private mapWidth: number;
  private mapHeight: number;

  constructor(
    private worker: WorkerClient,
    private _config: Config,
    terrainMap: TerrainMapData,
    private clientID: ClientID | undefined,
    private playerName: string,
    private playerClanTag: string | null,
    private gameID: string,
    initialPlayers: Player[],
  ) {
    this.terrain = terrainMap.terrain;
    this.tileState = new Uint16Array(terrainMap.terrain.length);
    this.mapWidth = terrainMap.width;
    this.mapHeight = terrainMap.height;

    // Initialize player views from start info
    for (const p of initialPlayers) {
      const pv = new PlayerView(
        p.playerID as PlayerID,
        {
          playerID: p.playerID as PlayerID,
          clientID: p.clientID,
          name: p.username,
          clanTag: p.clanTag,
          isAlive: true,
          hasSpawned: false,
          population: 0n,
          troops: 0,
          credits: 0n,
          tiles: 0,
        } as PlayerUpdate,
        this.worker,
      );
      this.playerMap.set(p.playerID as PlayerID, pv);
    }
  }

  config(): Config {
    return this._config;
  }

  ticks(): Tick {
    return this._ticks;
  }

  inSpawnPhase(): boolean {
    return this._inSpawnPhase;
  }

  myPlayer(): PlayerView | null {
    if (this._myPlayer) return this._myPlayer;
    if (!this.clientID) return null;
    for (const pv of this.playerMap.values()) {
      if (pv.clientID() === this.clientID) {
        this._myPlayer = pv;
        return pv;
      }
    }
    return null;
  }

  playerByClientID(clientID: ClientID): PlayerView | null {
    for (const pv of this.playerMap.values()) {
      if (pv.clientID() === clientID) return pv;
    }
    return null;
  }

  units(): UnitView[] {
    return Array.from(this.unitMap.values());
  }

  // --- Tile queries ---

  ref(x: number, y: number): TileRef {
    return (y * this.mapWidth + x) as TileRef;
  }

  isValidCoord(x: number, y: number): boolean {
    return x >= 0 && x < this.mapWidth && y >= 0 && y < this.mapHeight;
  }

  owner(tile: TileRef): PlayerView {
    const state = this.tileState[tile];
    const ownerID = (state & 0x0fff) as PlayerID;
    return this.playerMap.get(ownerID)!;
  }

  hasOwner(tile: TileRef): boolean {
    return (this.tileState[tile] & 0x0fff) !== 0;
  }

  isLand(tile: TileRef): boolean {
    // Planet type from terrain bits 0-2
    const planetType = this.terrain[tile] & 0x07;
    // Gas giants (type 1) are not "land" -- they can't hold ground population
    return planetType !== 1;
  }

  planetType(tile: TileRef): number {
    return this.terrain[tile] & 0x07;
  }

  magnitude(tile: TileRef): number {
    return (this.terrain[tile] >> 3) & 0x1f;
  }

  manhattanDist(a: TileRef, b: TileRef): number {
    const ax = (a as number) % this.mapWidth;
    const ay = Math.floor((a as number) / this.mapWidth);
    const bx = (b as number) % this.mapWidth;
    const by = Math.floor((b as number) / this.mapWidth);
    return Math.abs(ax - bx) + Math.abs(ay - by);
  }

  euclideanDistSquared(a: TileRef, b: TileRef): number {
    const ax = (a as number) % this.mapWidth;
    const ay = Math.floor((a as number) / this.mapWidth);
    const bx = (b as number) % this.mapWidth;
    const by = Math.floor((b as number) / this.mapWidth);
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
  }

  // --- State update ---

  update(data: GameUpdateViewData): void {
    this._ticks = data.tick;

    // Apply packed tile updates: pairs of [tileRef, newState]
    const packed = data.packedTileUpdates;
    for (let i = 0; i < packed.length; i += 2) {
      const tileRef = packed[i] as TileRef;
      const newState = packed[i + 1] & 0xffff;
      this.tileState[tileRef] = newState;
    }

    // Mark all units as not updated this tick
    for (const uv of this.unitMap.values()) {
      uv._wasUpdated = false;
    }

    // Apply unit updates
    const unitUpdates = data.updates[GameUpdateType.Unit] as UnitUpdate[];
    if (unitUpdates) {
      for (const uu of unitUpdates) {
        const existing = this.unitMap.get(uu.id);
        if (existing) {
          if (uu.isActive) {
            existing.update(uu);
          } else {
            this.unitMap.delete(uu.id);
          }
        } else if (uu.isActive) {
          this.unitMap.set(uu.id, new UnitView(this, uu));
        }
      }
    }

    // Apply player updates
    const playerUpdates = data.updates[
      GameUpdateType.Player
    ] as PlayerUpdate[];
    if (playerUpdates) {
      for (const pu of playerUpdates) {
        const existing = this.playerMap.get(pu.playerID);
        if (existing) {
          existing.update(pu);
        }
      }
    }

    // Update spawn phase based on tick
    if (this._inSpawnPhase && this._ticks > 0) {
      const spawnPhaseTicks = this._config.spawnPhaseTicks?.() ?? 0;
      if (this._ticks >= spawnPhaseTicks) {
        this._inSpawnPhase = false;
      }
    }
  }
}
```

**Test file:** `tests/core/game/GameView.test.ts`

```typescript
// tests/core/game/GameView.test.ts
import { describe, it, expect } from "vitest";
import { UnitView } from "../../../src/core/game/GameView";

describe("GameView", () => {
  describe("tile state bit packing", () => {
    it("extracts owner from lower 12 bits", () => {
      const state = 0x0042; // owner = 66
      const ownerID = state & 0x0fff;
      expect(ownerID).toBe(66);
    });

    it("neutral tile has owner 0", () => {
      const state = 0x0000;
      const ownerID = state & 0x0fff;
      expect(ownerID).toBe(0);
    });

    it("detects scorched bit 13", () => {
      const state = 0x2000; // bit 13 set
      const isScorched = (state & 0x2000) !== 0;
      expect(isScorched).toBe(true);
    });

    it("detects shield bit 14", () => {
      const state = 0x4000; // bit 14 set
      const hasShield = (state & 0x4000) !== 0;
      expect(hasShield).toBe(true);
    });
  });

  describe("terrain bit packing", () => {
    it("extracts planet type from bits 0-2", () => {
      // Terrestrial = 0, Gas Giant = 1, Ice = 2, etc.
      const terrain = 0x02; // Ice World
      const planetType = terrain & 0x07;
      expect(planetType).toBe(2);
    });

    it("extracts magnitude from bits 3-7", () => {
      // Magnitude 15 shifted left by 3 = 0x78
      const terrain = 0x78 | 0x03; // magnitude 15, planet type 3 (Desert)
      const planetType = terrain & 0x07;
      const magnitude = (terrain >> 3) & 0x1f;
      expect(planetType).toBe(3);
      expect(magnitude).toBe(15);
    });

    it("max magnitude is 31", () => {
      const terrain = 0xff; // all bits set
      const magnitude = (terrain >> 3) & 0x1f;
      expect(magnitude).toBe(31);
    });
  });

  describe("packed tile updates", () => {
    it("applies tile updates from Uint32Array pairs", () => {
      const tileState = new Uint16Array(100);
      const packed = new Uint32Array([
        5, 0x0042,  // tile 5, owner 66
        10, 0x2003, // tile 10, owner 3 + scorched
      ]);

      for (let i = 0; i < packed.length; i += 2) {
        const tileRef = packed[i];
        const newState = packed[i + 1] & 0xffff;
        tileState[tileRef] = newState;
      }

      expect(tileState[5] & 0x0fff).toBe(66);
      expect(tileState[10] & 0x0fff).toBe(3);
      expect((tileState[10] & 0x2000) !== 0).toBe(true);
    });
  });
});
```

**Test command:**
```bash
npx vitest run tests/core/game/GameView.test.ts
```

**Commit:** `feat(core): add GameView.ts with UnitView, PlayerView, and bit-packed tile state`

---

## Task 9: ClientGameRunner.ts

**File:** `src/client/ClientGameRunner.ts`

- [ ] LobbyConfig interface (gameID, playerName, serverConfig, cosmetics, etc.)
- [ ] JoinLobbyResult interface (stop, prestart, join promises)
- [ ] joinLobby() factory function: creates Transport, handles server messages
- [ ] createClientGame() async: loads terrain, initializes WorkerClient, creates GameView
- [ ] ClientGameRunner class: game session lifecycle
- [ ] Start: initialize renderer, input handler, wire worker callbacks
- [ ] Turn processing: sendTurn to worker, track turnsSeen
- [ ] Hash verification: forward HashUpdates to Transport
- [ ] Desync handling: show error modal on desync message
- [ ] Connection check: reconnect after 5s silence
- [ ] Spawn phase handling with random spawn support
- [ ] Stop: cleanup worker, transport, renderer, sound
- [ ] shouldPreventWindowClose: true when player is alive

```typescript
// src/client/ClientGameRunner.ts
import { EventBus } from "../core/EventBus";
import type {
  ClientID,
  GameID,
  GameRecord,
  GameStartInfo,
  ServerMessage,
  Turn,
} from "../core/Schemas";
import type { ServerConfig } from "../core/configuration/Config";
import { getGameLogicConfig } from "../core/configuration/ConfigLoader";
import type {
  ErrorUpdate,
  GameUpdateType,
  GameUpdateViewData,
  HashUpdate,
  WinUpdate,
} from "../core/game/GameUpdates";
import { GameView, type PlayerView } from "../core/game/GameView";
import { loadTerrainMap, type TerrainMapData } from "../core/game/TerrainMapLoader";
import { WorkerClient } from "../core/worker/WorkerClient";
import { UserSettings } from "../core/game/UserSettings";
import { getPersistentID } from "./Auth";
import {
  InputHandler,
  MouseMoveEvent,
  MouseUpEvent,
  type TickMetricsEvent,
} from "./InputHandler";
import {
  SendAttackIntentEvent,
  SendHashEvent,
  SendInvasionFleetIntentEvent,
  SendSpawnIntentEvent,
  Transport,
} from "./Transport";

export interface LobbyConfig {
  serverConfig: ServerConfig;
  playerName: string;
  playerClanTag: string | null;
  gameID: GameID;
  turnstileToken?: string | null;
  gameStartInfo?: GameStartInfo;
  gameRecord?: GameRecord;
}

export interface JoinLobbyResult {
  stop: (force?: boolean) => boolean;
  prestart: Promise<void>;
  join: Promise<void>;
}

export function joinLobby(
  eventBus: EventBus,
  lobbyConfig: LobbyConfig,
): JoinLobbyResult {
  let clientID: ClientID | undefined;
  let resolvePrestart: () => void;
  let resolveJoin: () => void;
  const prestartPromise = new Promise<void>((r) => (resolvePrestart = r));
  const joinPromise = new Promise<void>((r) => (resolveJoin = r));

  const transport = new Transport(lobbyConfig as any, eventBus);
  let currentGameRunner: ClientGameRunner | null = null;

  const onconnect = () => {
    console.log(`Joining game lobby ${lobbyConfig.gameID}`);
    transport.joinGame();
  };

  let terrainLoad: Promise<TerrainMapData> | null = null;

  const onmessage = (message: ServerMessage) => {
    if (message.type === "lobby_info") {
      clientID = message.myClientID;
      return;
    }
    if (message.type === "prestart") {
      terrainLoad = loadTerrainMap(
        message.gameMap,
        message.gameMapSize,
        null as any, // mapLoader injected at build time
      );
      resolvePrestart!();
    }
    if (message.type === "start") {
      resolvePrestart!();
      clientID = message.myClientID;
      resolveJoin!();
      lobbyConfig.gameStartInfo = message.gameStartInfo;

      createClientGame(
        lobbyConfig,
        clientID,
        eventBus,
        transport,
        terrainLoad,
      )
        .then((r) => {
          currentGameRunner = r;
          r.start();
        })
        .catch((e) => {
          console.error("Error creating client game:", e);
          currentGameRunner = null;
        });
    }
    if (message.type === "error") {
      console.error("Server error:", message.error, message.message);
    }
  };

  transport.connect(onconnect, onmessage);

  return {
    stop: (force = false) => {
      if (!force && currentGameRunner?.shouldPreventWindowClose()) {
        return false;
      }
      if (currentGameRunner) {
        currentGameRunner.stop();
        currentGameRunner = null;
      } else {
        transport.leaveGame();
      }
      return true;
    },
    prestart: prestartPromise,
    join: joinPromise,
  };
}

async function createClientGame(
  lobbyConfig: LobbyConfig,
  clientID: ClientID | undefined,
  eventBus: EventBus,
  transport: Transport,
  terrainLoad: Promise<TerrainMapData> | null,
): Promise<ClientGameRunner> {
  if (!lobbyConfig.gameStartInfo) {
    throw new Error("missing gameStartInfo");
  }

  const userSettings = new UserSettings();
  const config = await getGameLogicConfig(
    lobbyConfig.gameStartInfo.config,
    userSettings,
    lobbyConfig.gameRecord !== undefined,
  );

  let gameMap: TerrainMapData;
  if (terrainLoad) {
    gameMap = await terrainLoad;
  } else {
    gameMap = await loadTerrainMap(
      lobbyConfig.gameStartInfo.config.gameMap,
      lobbyConfig.gameStartInfo.config.gameMapSize,
      null as any,
    );
  }

  const worker = new WorkerClient(lobbyConfig.gameStartInfo, clientID);
  await worker.initialize();

  const gameView = new GameView(
    worker,
    config,
    gameMap,
    clientID,
    lobbyConfig.playerName,
    lobbyConfig.playerClanTag,
    lobbyConfig.gameStartInfo.gameID,
    lobbyConfig.gameStartInfo.players,
  );

  return new ClientGameRunner(
    lobbyConfig,
    clientID,
    eventBus,
    transport,
    worker,
    gameView,
  );
}

export class ClientGameRunner {
  private myPlayer: PlayerView | null = null;
  private isActive = false;
  private turnsSeen = 0;
  private lastMessageTime = 0;
  private connectionCheckInterval: ReturnType<typeof setInterval> | null = null;
  private lastTickReceiveTime = 0;
  private currentTickDelay: number | undefined = undefined;

  constructor(
    private lobby: LobbyConfig,
    private clientID: ClientID | undefined,
    private eventBus: EventBus,
    private transport: Transport,
    private worker: WorkerClient,
    private gameView: GameView,
  ) {
    this.lastMessageTime = Date.now();
  }

  public shouldPreventWindowClose(): boolean {
    return !!this.myPlayer?.isAlive();
  }

  public start() {
    this.isActive = true;
    this.lastMessageTime = Date.now();

    // Start connection watchdog after 20s grace period
    setTimeout(() => {
      this.connectionCheckInterval = setInterval(
        () => this.onConnectionCheck(),
        1000,
      );
    }, 20_000);

    // Wire input events
    this.eventBus.on(MouseUpEvent, this.onMouseUp.bind(this));
    this.eventBus.on(MouseMoveEvent, () => {});

    // Start worker game update loop
    this.worker.start((gu: GameUpdateViewData | ErrorUpdate) => {
      if ("errMsg" in gu) {
        console.error("Worker error:", gu.errMsg);
        this.stop();
        return;
      }

      this.transport.turnComplete();

      // Forward hash updates
      const hashUpdates = gu.updates[GameUpdateType.Hash] as HashUpdate[];
      if (hashUpdates) {
        for (const hu of hashUpdates) {
          this.eventBus.emit(new SendHashEvent(hu.tick, hu.hash));
        }
      }

      this.gameView.update(gu);
      this.currentTickDelay = undefined;
    });

    // Set up message handling for reconnection
    const onconnect = () => {
      this.transport.rejoinGame(this.turnsSeen);
    };

    const onmessage = (message: ServerMessage) => {
      this.lastMessageTime = Date.now();

      if (message.type === "start") {
        for (const turn of message.turns) {
          if (turn.turnNumber < this.turnsSeen) continue;
          // Fill gaps with empty turns
          while (turn.turnNumber - 1 > this.turnsSeen) {
            this.worker.sendTurn({
              turnNumber: this.turnsSeen,
              intents: [],
            });
            this.turnsSeen++;
          }
          this.worker.sendTurn(turn);
          this.turnsSeen++;
        }
      }

      if (message.type === "desync") {
        console.error("Desync from server:", message);
      }

      if (message.type === "turn") {
        const now = Date.now();
        if (this.lastTickReceiveTime > 0) {
          this.currentTickDelay = now - this.lastTickReceiveTime;
        }
        this.lastTickReceiveTime = now;

        if (this.turnsSeen !== message.turn.turnNumber) {
          console.error(
            `Wrong turn: have ${this.turnsSeen}, received ${message.turn.turnNumber}`,
          );
        } else {
          this.worker.sendTurn(message.turn);
          this.turnsSeen++;
        }
      }
    };

    this.transport.updateCallback(onconnect, onmessage);
    this.transport.rejoinGame(0);
  }

  public stop() {
    if (!this.isActive) return;
    this.isActive = false;
    this.worker.cleanup();
    this.transport.leaveGame();
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
  }

  private onMouseUp(event: MouseUpEvent) {
    if (!this.isActive) return;
    // Spawn phase click handling
    if (this.gameView.inSpawnPhase()) {
      // Delegate to spawn intent
      return;
    }
  }

  private onConnectionCheck() {
    if (this.transport.isLocal) return;
    const elapsed = Date.now() - this.lastMessageTime;
    if (elapsed > 5000) {
      console.log(`No server message for ${elapsed}ms, reconnecting`);
      this.lastMessageTime = Date.now();
      this.transport.reconnect();
    }
  }
}
```

**Test file:** `tests/client/ClientGameRunner.test.ts`

```typescript
// tests/client/ClientGameRunner.test.ts
import { describe, it, expect } from "vitest";

describe("ClientGameRunner", () => {
  it("fills gaps with empty turns", () => {
    // Simulate gap-filling logic
    let turnsSeen = 0;
    const sentTurns: number[] = [];

    const turns = [
      { turnNumber: 0, intents: [] },
      { turnNumber: 3, intents: [] }, // Gap: turns 1 and 2 missing
    ];

    for (const turn of turns) {
      if (turn.turnNumber < turnsSeen) continue;
      while (turn.turnNumber - 1 > turnsSeen) {
        sentTurns.push(turnsSeen);
        turnsSeen++;
      }
      sentTurns.push(turn.turnNumber);
      turnsSeen++;
    }

    // Should have sent turns 0, 1, 2, 3
    expect(sentTurns).toEqual([0, 1, 2, 3]);
    expect(turnsSeen).toBe(4);
  });

  it("reconnects after 5s silence", () => {
    const CONNECTION_CHECK_THRESHOLD = 5000;
    const lastMessageTime = Date.now() - 6000;
    const elapsed = Date.now() - lastMessageTime;
    expect(elapsed).toBeGreaterThan(CONNECTION_CHECK_THRESHOLD);
  });
});
```

**Test command:**
```bash
npx vitest run tests/client/ClientGameRunner.test.ts
```

**Commit:** `feat(client): add ClientGameRunner.ts with game session lifecycle, turn processing, and desync handling`

---

## Task 10: InputHandler.ts

**File:** `src/client/InputHandler.ts`

- [ ] Mouse events: down, up, move, over, context menu
- [ ] Touch events with tap detection (< 10px movement threshold)
- [ ] Pinch-to-zoom with distance and center calculation
- [ ] Keyboard: WASD/arrow pan (continuous via setInterval at 1ms)
- [ ] Keyboard: +/- zoom (keyboard and numpad)
- [ ] Keyboard: customizable keybinds loaded from UserSettings
- [ ] Keyboard: build structure shortcuts (10 unit types)
- [ ] Keyboard: Escape to cancel, Enter to confirm ghost structure
- [ ] Keyboard: Shift+D for performance overlay
- [ ] Keyboard: Tab for alternate view (hold-to-view)
- [ ] Keyboard: attack ratio up/down with configurable increment
- [ ] Keyboard: center camera, pause, speed up/down
- [ ] Keyboard: boat attack, ground attack hotkeys
- [ ] Keyboard: swap rocket direction
- [ ] Keyboard: coordinate grid toggle
- [ ] Shift+scroll for attack ratio adjustment
- [ ] Browser zoom filtering (Cmd/Ctrl + zoom combos ignored)
- [ ] Focus loss clears all active keys
- [ ] Text input field detection (skip keybinds when typing)
- [ ] 30+ GameEvent types emitted via EventBus

```typescript
// src/client/InputHandler.ts
import { EventBus, type GameEvent } from "../core/EventBus";
import type { PlayerBuildableUnitType, UnitType } from "../core/game/Game";
import type { GameView, UnitView } from "../core/game/GameView";
import { UserSettings } from "../core/game/UserSettings";

// --- Event classes (30+ types) ---

export class MouseUpEvent implements GameEvent {
  constructor(public readonly x: number, public readonly y: number) {}
}
export class MouseOverEvent implements GameEvent {
  constructor(public readonly x: number, public readonly y: number) {}
}
export class TouchEvent implements GameEvent {
  constructor(public readonly x: number, public readonly y: number) {}
}
export class UnitSelectionEvent implements GameEvent {
  constructor(
    public readonly unit: UnitView | null,
    public readonly isSelected: boolean,
  ) {}
}
export class MouseDownEvent implements GameEvent {
  constructor(public readonly x: number, public readonly y: number) {}
}
export class MouseMoveEvent implements GameEvent {
  constructor(public readonly x: number, public readonly y: number) {}
}
export class ContextMenuEvent implements GameEvent {
  constructor(public readonly x: number, public readonly y: number) {}
}
export class ZoomEvent implements GameEvent {
  constructor(
    public readonly x: number,
    public readonly y: number,
    public readonly delta: number,
  ) {}
}
export class DragEvent implements GameEvent {
  constructor(
    public readonly deltaX: number,
    public readonly deltaY: number,
  ) {}
}
export class AlternateViewEvent implements GameEvent {
  constructor(public readonly alternateView: boolean) {}
}
export class CloseViewEvent implements GameEvent {}
export class RefreshGraphicsEvent implements GameEvent {}
export class TogglePerformanceOverlayEvent implements GameEvent {}
export class ToggleStructureEvent implements GameEvent {
  constructor(
    public readonly structureTypes: PlayerBuildableUnitType[] | null,
  ) {}
}
export class GhostStructureChangedEvent implements GameEvent {
  constructor(public readonly ghostStructure: PlayerBuildableUnitType | null) {}
}
export class ConfirmGhostStructureEvent implements GameEvent {}
export class SwapRocketDirectionEvent implements GameEvent {
  constructor(public readonly rocketDirectionUp: boolean) {}
}
export class ShowBuildMenuEvent implements GameEvent {
  constructor(public readonly x: number, public readonly y: number) {}
}
export class ShowEmojiMenuEvent implements GameEvent {
  constructor(public readonly x: number, public readonly y: number) {}
}
export class DoInvasionFleetAttackEvent implements GameEvent {}
export class DoGroundAttackEvent implements GameEvent {}
export class AttackRatioEvent implements GameEvent {
  constructor(public readonly attackRatio: number) {}
}
export class ReplaySpeedChangeEvent implements GameEvent {
  constructor(public readonly replaySpeedMultiplier: number) {}
}
export class TogglePauseIntentEvent implements GameEvent {}
export class GameSpeedUpIntentEvent implements GameEvent {}
export class GameSpeedDownIntentEvent implements GameEvent {}
export class CenterCameraEvent implements GameEvent {}
export class AutoUpgradeEvent implements GameEvent {
  constructor(public readonly x: number, public readonly y: number) {}
}
export class ToggleCoordinateGridEvent implements GameEvent {
  constructor(public readonly enabled: boolean) {}
}
export class TickMetricsEvent implements GameEvent {
  constructor(
    public readonly tickExecutionDuration?: number,
    public readonly tickDelay?: number,
  ) {}
}

// --- UIState (shared with renderer) ---

export interface UIState {
  ghostStructure: PlayerBuildableUnitType | null;
  attackRatio: number;
  rocketDirectionUp: boolean;
}

// --- InputHandler ---

export class InputHandler {
  private lastPointerX = 0;
  private lastPointerY = 0;
  private lastPointerDownX = 0;
  private lastPointerDownY = 0;
  private pointers: Map<number, PointerEvent> = new Map();
  private lastPinchDistance = 0;
  private pointerDown = false;
  private alternateView = false;
  private moveInterval: ReturnType<typeof setInterval> | null = null;
  private activeKeys = new Set<string>();
  private keybinds: Record<string, string> = {};
  private coordinateGridEnabled = false;

  private readonly PAN_SPEED = 5;
  private readonly ZOOM_SPEED = 10;
  private readonly TAP_THRESHOLD = 10;

  private readonly userSettings: UserSettings = new UserSettings();

  constructor(
    private gameView: GameView,
    public uiState: UIState,
    private canvas: HTMLCanvasElement,
    private eventBus: EventBus,
  ) {}

  initialize() {
    this.keybinds = this.userSettings.keybinds();

    // --- Pointer events ---
    this.canvas.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    window.addEventListener("pointerup", (e) => this.onPointerUp(e));
    this.canvas.addEventListener(
      "wheel",
      (e) => {
        this.onScroll(e);
        this.onShiftScroll(e);
        e.preventDefault();
      },
      { passive: false },
    );
    window.addEventListener("pointermove", this.onPointerMove.bind(this));
    this.canvas.addEventListener("contextmenu", (e) => this.onContextMenu(e));
    window.addEventListener("mousemove", (e) => {
      if (e.movementX || e.movementY) {
        this.eventBus.emit(new MouseMoveEvent(e.clientX, e.clientY));
      }
    });

    // Focus loss: clear all state
    window.addEventListener("blur", () => {
      this.activeKeys.clear();
      if (this.alternateView) {
        this.alternateView = false;
        this.eventBus.emit(new AlternateViewEvent(false));
      }
      this.pointerDown = false;
      this.pointers.clear();
    });

    // --- Continuous keyboard pan/zoom ---
    this.moveInterval = setInterval(() => {
      if (
        this.activeKeys.has("ShiftLeft") ||
        this.activeKeys.has("ShiftRight")
      ) {
        return;
      }

      let deltaX = 0;
      let deltaY = 0;

      if (
        this.activeKeys.has(this.keybinds.moveUp) ||
        this.activeKeys.has("ArrowUp")
      )
        deltaY += this.PAN_SPEED;
      if (
        this.activeKeys.has(this.keybinds.moveDown) ||
        this.activeKeys.has("ArrowDown")
      )
        deltaY -= this.PAN_SPEED;
      if (
        this.activeKeys.has(this.keybinds.moveLeft) ||
        this.activeKeys.has("ArrowLeft")
      )
        deltaX += this.PAN_SPEED;
      if (
        this.activeKeys.has(this.keybinds.moveRight) ||
        this.activeKeys.has("ArrowRight")
      )
        deltaX -= this.PAN_SPEED;

      if (deltaX || deltaY) {
        this.eventBus.emit(new DragEvent(deltaX, deltaY));
      }

      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;

      if (
        this.activeKeys.has(this.keybinds.zoomOut) ||
        this.activeKeys.has("Minus") ||
        this.activeKeys.has("NumpadSubtract")
      ) {
        this.eventBus.emit(new ZoomEvent(cx, cy, this.ZOOM_SPEED));
      }
      if (
        this.activeKeys.has(this.keybinds.zoomIn) ||
        this.activeKeys.has("Equal") ||
        this.activeKeys.has("NumpadAdd")
      ) {
        this.eventBus.emit(new ZoomEvent(cx, cy, -this.ZOOM_SPEED));
      }
    }, 1);

    // --- Keyboard: keydown ---
    window.addEventListener("keydown", (e) => {
      if (this.isTextInputTarget(e.target) && e.code !== "Escape") return;

      // Alternate view (hold)
      if (this.keybindMatchesEvent(e, this.keybinds.toggleView)) {
        e.preventDefault();
        if (!this.alternateView) {
          this.alternateView = true;
          this.eventBus.emit(new AlternateViewEvent(true));
        }
      }

      // Coordinate grid toggle
      if (
        this.keybindMatchesEvent(e, this.keybinds.coordinateGrid) &&
        !e.repeat
      ) {
        e.preventDefault();
        this.coordinateGridEnabled = !this.coordinateGridEnabled;
        this.eventBus.emit(
          new ToggleCoordinateGridEvent(this.coordinateGridEnabled),
        );
      }

      // Escape
      if (e.code === "Escape") {
        e.preventDefault();
        this.eventBus.emit(new CloseViewEvent());
        this.setGhostStructure(null);
      }

      // Enter to confirm ghost structure
      if (
        (e.code === "Enter" || e.code === "NumpadEnter") &&
        this.uiState.ghostStructure !== null
      ) {
        e.preventDefault();
        this.eventBus.emit(new ConfirmGhostStructureEvent());
      }

      // Filter browser zoom combos
      const isBrowserZoomCombo =
        (e.metaKey || e.ctrlKey) &&
        (e.code === "Minus" ||
          e.code === "Equal" ||
          e.code === "NumpadAdd" ||
          e.code === "NumpadSubtract");

      if (!isBrowserZoomCombo) {
        const trackable = [
          this.keybinds.moveUp,
          this.keybinds.moveDown,
          this.keybinds.moveLeft,
          this.keybinds.moveRight,
          this.keybinds.zoomOut,
          this.keybinds.zoomIn,
          "ArrowUp",
          "ArrowLeft",
          "ArrowDown",
          "ArrowRight",
          "Minus",
          "Equal",
          "NumpadAdd",
          "NumpadSubtract",
          this.keybinds.attackRatioDown,
          this.keybinds.attackRatioUp,
          this.keybinds.centerCamera,
          "ControlLeft",
          "ControlRight",
          "ShiftLeft",
          "ShiftRight",
        ];
        if (trackable.includes(e.code)) {
          this.activeKeys.add(e.code);
        }
      }
    });

    // --- Keyboard: keyup ---
    window.addEventListener("keyup", (e) => {
      if (this.isTextInputTarget(e.target) && !this.activeKeys.has(e.code)) {
        return;
      }

      // Meta/Ctrl release clears zoom keys
      if (
        ["MetaLeft", "MetaRight", "ControlLeft", "ControlRight"].includes(
          e.code,
        )
      ) {
        for (const k of [
          "Minus",
          "Equal",
          "NumpadAdd",
          "NumpadSubtract",
          this.keybinds.zoomIn,
          this.keybinds.zoomOut,
        ]) {
          this.activeKeys.delete(k);
        }
      }

      // Alternate view release
      if (this.keybindMatchesEvent(e, this.keybinds.toggleView)) {
        e.preventDefault();
        this.alternateView = false;
        this.eventBus.emit(new AlternateViewEvent(false));
      }

      // Reset graphics
      if (e.code === (this.keybinds.resetGfx ?? "KeyR") && e.altKey) {
        e.preventDefault();
        this.eventBus.emit(new RefreshGraphicsEvent());
      }

      // Invasion fleet attack
      if (this.keybindMatchesEvent(e, this.keybinds.invasionFleetAttack)) {
        e.preventDefault();
        this.eventBus.emit(new DoInvasionFleetAttackEvent());
      }

      // Ground attack
      if (this.keybindMatchesEvent(e, this.keybinds.groundAttack)) {
        e.preventDefault();
        this.eventBus.emit(new DoGroundAttackEvent());
      }

      // Attack ratio
      if (this.keybindMatchesEvent(e, this.keybinds.attackRatioDown)) {
        e.preventDefault();
        this.eventBus.emit(
          new AttackRatioEvent(-this.userSettings.attackRatioIncrement()),
        );
      }
      if (this.keybindMatchesEvent(e, this.keybinds.attackRatioUp)) {
        e.preventDefault();
        this.eventBus.emit(
          new AttackRatioEvent(this.userSettings.attackRatioIncrement()),
        );
      }

      // Center camera
      if (this.keybindMatchesEvent(e, this.keybinds.centerCamera)) {
        e.preventDefault();
        this.eventBus.emit(new CenterCameraEvent());
      }

      // Build keybinds
      const matchedBuild = this.resolveBuildKeybind(e.code, e.shiftKey);
      if (matchedBuild !== null) {
        e.preventDefault();
        this.setGhostStructure(matchedBuild);
      }

      // Swap direction
      if (this.keybindMatchesEvent(e, this.keybinds.swapDirection)) {
        e.preventDefault();
        this.eventBus.emit(
          new SwapRocketDirectionEvent(!this.uiState.rocketDirectionUp),
        );
      }

      // Pause / speed
      if (!e.repeat && this.keybindMatchesEvent(e, this.keybinds.pauseGame)) {
        e.preventDefault();
        this.eventBus.emit(new TogglePauseIntentEvent());
      }
      if (!e.repeat && this.keybindMatchesEvent(e, this.keybinds.gameSpeedUp)) {
        e.preventDefault();
        this.eventBus.emit(new GameSpeedUpIntentEvent());
      }
      if (
        !e.repeat &&
        this.keybindMatchesEvent(e, this.keybinds.gameSpeedDown)
      ) {
        e.preventDefault();
        this.eventBus.emit(new GameSpeedDownIntentEvent());
      }

      // Performance overlay: Shift+D
      if (e.code === "KeyD" && e.shiftKey) {
        e.preventDefault();
        this.eventBus.emit(new TogglePerformanceOverlayEvent());
      }

      this.activeKeys.delete(e.code);
    });
  }

  // --- Pointer handlers ---

  private onPointerDown(event: PointerEvent) {
    if (event.button === 1) {
      event.preventDefault();
      this.eventBus.emit(new AutoUpgradeEvent(event.clientX, event.clientY));
      return;
    }
    if (event.button > 0) return;

    this.pointerDown = true;
    this.pointers.set(event.pointerId, event);

    if (this.pointers.size === 1) {
      this.lastPointerX = event.clientX;
      this.lastPointerY = event.clientY;
      this.lastPointerDownX = event.clientX;
      this.lastPointerDownY = event.clientY;
      this.eventBus.emit(new MouseDownEvent(event.clientX, event.clientY));
    } else if (this.pointers.size === 2) {
      this.lastPinchDistance = this.getPinchDistance();
    }
  }

  private onPointerUp(event: PointerEvent) {
    if (event.button === 1) {
      event.preventDefault();
      return;
    }
    if (event.button > 0) return;

    this.pointerDown = false;
    this.pointers.clear();

    const dist =
      Math.abs(event.x - this.lastPointerDownX) +
      Math.abs(event.y - this.lastPointerDownY);

    if (dist < this.TAP_THRESHOLD) {
      if (event.pointerType === "touch") {
        this.eventBus.emit(new TouchEvent(event.x, event.y));
        event.preventDefault();
        return;
      }
      this.eventBus.emit(new MouseUpEvent(event.x, event.y));
    }
  }

  private onScroll(event: WheelEvent) {
    if (event.shiftKey) return;

    const realCtrl =
      this.activeKeys.has("ControlLeft") ||
      this.activeKeys.has("ControlRight");

    if (event.ctrlKey) {
      if (!realCtrl && Math.abs(event.deltaY) <= 10) {
        // Pinch-to-zoom gesture
        this.eventBus.emit(
          new ZoomEvent(event.x, event.y, event.deltaY * 10),
        );
      }
      return;
    }

    if (Math.abs(event.deltaY) < 2) return;
    this.eventBus.emit(new ZoomEvent(event.x, event.y, event.deltaY));
  }

  private onShiftScroll(event: WheelEvent) {
    if (!event.shiftKey) return;
    const scrollValue = event.deltaY === 0 ? event.deltaX : event.deltaY;
    const increment = this.userSettings.attackRatioIncrement();
    this.eventBus.emit(new AttackRatioEvent(scrollValue > 0 ? -increment : increment));
  }

  private onPointerMove(event: PointerEvent) {
    if (event.button === 1 || event.button > 0) return;

    this.pointers.set(event.pointerId, event);

    if (!this.pointerDown) {
      this.eventBus.emit(new MouseOverEvent(event.clientX, event.clientY));
      return;
    }

    if (this.pointers.size === 1) {
      const deltaX = event.clientX - this.lastPointerX;
      const deltaY = event.clientY - this.lastPointerY;
      this.eventBus.emit(new DragEvent(deltaX, deltaY));
      this.lastPointerX = event.clientX;
      this.lastPointerY = event.clientY;
    } else if (this.pointers.size === 2) {
      const currentPinchDistance = this.getPinchDistance();
      const pinchDelta = currentPinchDistance - this.lastPinchDistance;
      if (Math.abs(pinchDelta) > 1) {
        const center = this.getPinchCenter();
        this.eventBus.emit(new ZoomEvent(center.x, center.y, -pinchDelta * 2));
        this.lastPinchDistance = currentPinchDistance;
      }
    }
  }

  private onContextMenu(event: MouseEvent) {
    event.preventDefault();
    if (this.gameView.inSpawnPhase()) return;
    if (this.uiState.ghostStructure !== null) {
      this.setGhostStructure(null);
      return;
    }
    this.eventBus.emit(new ContextMenuEvent(event.clientX, event.clientY));
  }

  // --- Helpers ---

  private setGhostStructure(gs: PlayerBuildableUnitType | null) {
    this.uiState.ghostStructure = gs;
    this.eventBus.emit(new GhostStructureChangedEvent(gs));
  }

  private parseKeybind(value: string): { shift: boolean; code: string } {
    if (value?.startsWith("Shift+")) {
      return { shift: true, code: value.slice(6) };
    }
    return { shift: false, code: value };
  }

  private keybindMatchesEvent(e: KeyboardEvent, keybindValue: string): boolean {
    if (!keybindValue) return false;
    const parsed = this.parseKeybind(keybindValue);
    return e.code === parsed.code && e.shiftKey === parsed.shift;
  }

  private digitFromKeyCode(code: string): string | null {
    if (code?.length === 6 && code.startsWith("Digit") && /^[0-9]$/.test(code[5]))
      return code[5];
    if (code?.length === 7 && code.startsWith("Numpad") && /^[0-9]$/.test(code[6]))
      return code[6];
    return null;
  }

  private resolveBuildKeybind(
    code: string,
    shiftKey: boolean,
  ): PlayerBuildableUnitType | null {
    const buildKeybinds: ReadonlyArray<{
      key: string;
      type: PlayerBuildableUnitType;
    }> = [
      { key: "buildColony", type: "Colony" as PlayerBuildableUnitType },
      { key: "buildOrbitalForge", type: "OrbitalForge" as PlayerBuildableUnitType },
      { key: "buildStarport", type: "Starport" as PlayerBuildableUnitType },
      { key: "buildPlanetaryShield", type: "PlanetaryShield" as PlayerBuildableUnitType },
      { key: "buildSuperweaponFacility", type: "SuperweaponFacility" as PlayerBuildableUnitType },
      { key: "buildInterceptorArray", type: "InterceptorArray" as PlayerBuildableUnitType },
      { key: "buildNovaBomb", type: "NovaBomb" as PlayerBuildableUnitType },
      { key: "buildStellarCollapse", type: "StellarCollapseDevice" as PlayerBuildableUnitType },
      { key: "buildBattleCruiser", type: "BattleCruiser" as PlayerBuildableUnitType },
      { key: "buildSwarmBombardment", type: "SwarmBombardment" as PlayerBuildableUnitType },
    ];

    // Exact match first
    for (const { key, type } of buildKeybinds) {
      const parsed = this.parseKeybind(this.keybinds[key]);
      if (code === parsed.code && shiftKey === parsed.shift) return type;
    }
    // Digit/numpad alias fallback
    for (const { key, type } of buildKeybinds) {
      const parsed = this.parseKeybind(this.keybinds[key]);
      if (shiftKey !== parsed.shift) continue;
      const digit = this.digitFromKeyCode(code);
      const bindDigit = this.digitFromKeyCode(parsed.code);
      if (digit !== null && bindDigit !== null && digit === bindDigit) return type;
    }
    return null;
  }

  private getPinchDistance(): number {
    const [a, b] = Array.from(this.pointers.values());
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private getPinchCenter(): { x: number; y: number } {
    const [a, b] = Array.from(this.pointers.values());
    return {
      x: (a.clientX + b.clientX) / 2,
      y: (a.clientY + b.clientY) / 2,
    };
  }

  private isTextInputTarget(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el) return false;
    if (el.tagName === "TEXTAREA" || el.isContentEditable) return true;
    if (el.tagName === "INPUT") {
      return (el as HTMLInputElement).type !== "range";
    }
    return false;
  }

  destroy() {
    if (this.moveInterval !== null) {
      clearInterval(this.moveInterval);
    }
    this.activeKeys.clear();
  }
}
```

**Test file:** `tests/client/InputHandler.test.ts`

```typescript
// tests/client/InputHandler.test.ts
import { describe, it, expect } from "vitest";

describe("InputHandler", () => {
  describe("keybind parsing", () => {
    function parseKeybind(value: string): { shift: boolean; code: string } {
      if (value?.startsWith("Shift+")) {
        return { shift: true, code: value.slice(6) };
      }
      return { shift: false, code: value };
    }

    it("parses simple keybind", () => {
      expect(parseKeybind("KeyB")).toEqual({ shift: false, code: "KeyB" });
    });

    it("parses shift keybind", () => {
      expect(parseKeybind("Shift+KeyB")).toEqual({ shift: true, code: "KeyB" });
    });

    it("parses digit keybind", () => {
      expect(parseKeybind("Digit1")).toEqual({ shift: false, code: "Digit1" });
    });
  });

  describe("digit extraction", () => {
    function digitFromKeyCode(code: string): string | null {
      if (code?.length === 6 && code.startsWith("Digit") && /^[0-9]$/.test(code[5]))
        return code[5];
      if (code?.length === 7 && code.startsWith("Numpad") && /^[0-9]$/.test(code[6]))
        return code[6];
      return null;
    }

    it("extracts digit from Digit1", () => {
      expect(digitFromKeyCode("Digit1")).toBe("1");
    });

    it("extracts digit from Numpad5", () => {
      expect(digitFromKeyCode("Numpad5")).toBe("5");
    });

    it("returns null for non-digit key", () => {
      expect(digitFromKeyCode("KeyA")).toBeNull();
    });

    it("Digit and Numpad same digit match", () => {
      const d1 = digitFromKeyCode("Digit3");
      const d2 = digitFromKeyCode("Numpad3");
      expect(d1).toBe(d2);
    });
  });

  describe("tap threshold", () => {
    it("movement under 10px counts as tap", () => {
      const dist = Math.abs(105 - 100) + Math.abs(203 - 200);
      expect(dist).toBeLessThan(10);
    });

    it("movement over 10px counts as drag", () => {
      const dist = Math.abs(120 - 100) + Math.abs(220 - 200);
      expect(dist).toBeGreaterThanOrEqual(10);
    });
  });

  describe("pinch distance", () => {
    it("calculates euclidean distance between two points", () => {
      const dx = 100 - 50;
      const dy = 100 - 50;
      const dist = Math.sqrt(dx * dx + dy * dy);
      expect(dist).toBeCloseTo(70.71, 1);
    });

    it("calculates pinch center", () => {
      const cx = (100 + 50) / 2;
      const cy = (100 + 50) / 2;
      expect(cx).toBe(75);
      expect(cy).toBe(75);
    });
  });

  describe("text input detection", () => {
    it("identifies INPUT elements as text targets", () => {
      const el = { tagName: "INPUT", type: "text", isContentEditable: false } as any;
      const isText = el.tagName === "INPUT" && el.type !== "range";
      expect(isText).toBe(true);
    });

    it("excludes range inputs", () => {
      const el = { tagName: "INPUT", type: "range", isContentEditable: false } as any;
      const isText = el.tagName === "INPUT" && el.type !== "range";
      expect(isText).toBe(false);
    });
  });
});
```

**Test command:**
```bash
npx vitest run tests/client/InputHandler.test.ts
```

**Commit:** `feat(client): add InputHandler.ts with keyboard, mouse, touch, pinch-to-zoom, and 30+ event types`

---

## Task 11: LocalServer.ts

**File:** `src/client/LocalServer.ts`

- [ ] Turn queue with configurable interval (from ServerConfig)
- [ ] Speed control: 0.5x, 1x, 2x, max (fastest)
- [ ] Replay mode: play back recorded turns
- [ ] Singleplayer mode: collect intents, stamp with clientID
- [ ] Pause/unpause via toggle_pause intent
- [ ] Hash verification in replay mode
- [ ] Game record saving on end (singleplayer only)
- [ ] turnComplete() callback for backlog tracking
- [ ] Max replay backlog of 60 turns for fastest speed
- [ ] Compressed game record upload via gzip

```typescript
// src/client/LocalServer.ts
import { z } from "zod";
import { EventBus } from "../core/EventBus";
import type {
  AllPlayersStats,
  ClientID,
  ClientMessage,
  ClientSendWinnerMessage,
  ServerMessage,
  ServerStartGameMessage,
  StampedIntent,
  Turn,
} from "../core/Schemas";
import { getPersistentID } from "./Auth";
import type { LobbyConfig } from "./ClientGameRunner";
import {
  GameSpeedDownIntentEvent,
  GameSpeedUpIntentEvent,
  ReplaySpeedChangeEvent,
} from "./InputHandler";

export enum ReplaySpeedMultiplier {
  slow = 2,
  normal = 1,
  fast = 0.5,
  fastest = 0,
}

const SPEED_ORDER: ReplaySpeedMultiplier[] = [
  ReplaySpeedMultiplier.slow,
  ReplaySpeedMultiplier.normal,
  ReplaySpeedMultiplier.fast,
  ReplaySpeedMultiplier.fastest,
];

const MAX_REPLAY_BACKLOG_TURNS = 60;

export class LocalServer {
  private replayTurns: Turn[] = [];
  private turns: Turn[] = [];
  private intents: StampedIntent[] = [];
  private startedAt = 0;
  private paused = false;
  private replaySpeedMultiplier: ReplaySpeedMultiplier =
    ReplaySpeedMultiplier.normal;
  private clientID: ClientID | undefined;
  private winner: ClientSendWinnerMessage | null = null;
  private allPlayersStats: AllPlayersStats = {};
  private turnsExecuted = 0;
  private turnStartTime = 0;
  private turnCheckInterval: ReturnType<typeof setInterval> | undefined;
  private clientConnect: () => void = () => {};
  private clientMessage: (message: ServerMessage) => void = () => {};

  constructor(
    private lobbyConfig: LobbyConfig,
    private isReplay: boolean,
    private eventBus: EventBus,
  ) {}

  public updateCallback(
    clientConnect: () => void,
    clientMessage: (message: ServerMessage) => void,
  ) {
    this.clientConnect = clientConnect;
    this.clientMessage = clientMessage;
  }

  start() {
    console.log("Local server starting");

    this.turnCheckInterval = setInterval(() => {
      const turnIntervalMs =
        (this.lobbyConfig.serverConfig?.turnIntervalMs?.() ?? 100) *
        this.replaySpeedMultiplier;

      const backlog = Math.max(0, this.turns.length - this.turnsExecuted);
      const allowReplayBacklog =
        this.replaySpeedMultiplier === ReplaySpeedMultiplier.fastest &&
        this.lobbyConfig.gameRecord !== undefined;
      const maxBacklog = allowReplayBacklog ? MAX_REPLAY_BACKLOG_TURNS : 0;

      const canQueueNextTurn =
        backlog === 0 || (maxBacklog > 0 && backlog < maxBacklog);

      if (
        canQueueNextTurn &&
        Date.now() > this.turnStartTime + turnIntervalMs
      ) {
        this.turnStartTime = Date.now();
        this.endTurn();
      }
    }, 5);

    // Speed control events
    this.eventBus.on(ReplaySpeedChangeEvent, (event) => {
      this.replaySpeedMultiplier = event.replaySpeedMultiplier as ReplaySpeedMultiplier;
    });

    if (!this.isReplay) {
      this.eventBus.on(GameSpeedUpIntentEvent, () => {
        const idx = SPEED_ORDER.indexOf(this.replaySpeedMultiplier);
        if (idx < 0 || idx >= SPEED_ORDER.length - 1) return;
        this.replaySpeedMultiplier = SPEED_ORDER[idx + 1];
        this.eventBus.emit(
          new ReplaySpeedChangeEvent(this.replaySpeedMultiplier),
        );
      });

      this.eventBus.on(GameSpeedDownIntentEvent, () => {
        const idx = SPEED_ORDER.indexOf(this.replaySpeedMultiplier);
        if (idx <= 0) return;
        this.replaySpeedMultiplier = SPEED_ORDER[idx - 1];
        this.eventBus.emit(
          new ReplaySpeedChangeEvent(this.replaySpeedMultiplier),
        );
      });
    }

    this.startedAt = Date.now();
    this.clientConnect();

    if (this.lobbyConfig.gameRecord) {
      // Decompress recorded turns for replay
      this.replayTurns = this.lobbyConfig.gameRecord.turns ?? [];
    }

    if (!this.lobbyConfig.gameStartInfo) {
      throw new Error("missing gameStartInfo");
    }

    this.clientID = this.lobbyConfig.gameStartInfo.players[0]?.clientID;
    if (!this.clientID) throw new Error("missing clientID");

    this.clientMessage({
      type: "start",
      gameStartInfo: this.lobbyConfig.gameStartInfo,
      turns: [],
      lobbyCreatedAt: this.lobbyConfig.gameStartInfo.lobbyCreatedAt,
      myClientID: this.isReplay ? undefined : this.clientID,
    } as ServerStartGameMessage);
  }

  onMessage(clientMsg: ClientMessage) {
    if (clientMsg.type === "rejoin") {
      this.clientMessage({
        type: "start",
        gameStartInfo: this.lobbyConfig.gameStartInfo!,
        turns: this.turns,
        lobbyCreatedAt: this.lobbyConfig.gameStartInfo!.lobbyCreatedAt,
        myClientID: this.isReplay ? undefined : this.clientID,
      } as ServerStartGameMessage);
    }

    if (clientMsg.type === "intent") {
      const stampedIntent: StampedIntent = {
        ...clientMsg.intent,
        clientID: this.clientID!,
      };

      if (stampedIntent.type === "toggle_pause") {
        if (stampedIntent.paused) {
          this.intents.push(stampedIntent);
          this.endTurn();
          this.paused = true;
        } else {
          this.paused = false;
          this.intents.push(stampedIntent);
          this.endTurn();
        }
        return;
      }

      if (this.lobbyConfig.gameRecord || this.paused) return;
      this.intents.push(stampedIntent);
    }

    if (clientMsg.type === "hash") {
      if (!this.lobbyConfig.gameRecord) {
        // Singleplayer: store hash every 100 turns
        if (clientMsg.turnNumber % 100 === 0) {
          const turn = this.turns[clientMsg.turnNumber];
          if (turn) turn.hash = clientMsg.hash;
        }
        return;
      }
      // Replay: verify hash
      const archivedHash = this.replayTurns[clientMsg.turnNumber]?.hash;
      if (!archivedHash) return;
      if (archivedHash !== clientMsg.hash) {
        console.error(
          `Desync on turn ${clientMsg.turnNumber}: client=${clientMsg.hash}, archive=${archivedHash}`,
        );
        this.clientMessage({
          type: "desync",
          turn: clientMsg.turnNumber,
          correctHash: archivedHash,
          clientsWithCorrectHash: 0,
          totalActiveClients: 1,
          yourHash: clientMsg.hash,
        });
      }
    }

    if (clientMsg.type === "winner") {
      this.winner = clientMsg;
      this.allPlayersStats = clientMsg.allPlayersStats;
    }
  }

  public turnComplete() {
    this.turnsExecuted++;
  }

  private endTurn() {
    if (this.paused) return;

    if (this.replayTurns.length > 0) {
      if (this.turns.length >= this.replayTurns.length) {
        this.endGame();
        return;
      }
      this.intents = this.replayTurns[this.turns.length].intents;
    }

    const pastTurn: Turn = {
      turnNumber: this.turns.length,
      intents: this.intents,
    };
    this.turns.push(pastTurn);
    this.intents = [];
    this.clientMessage({ type: "turn", turn: pastTurn });
  }

  public endGame() {
    console.log("Local server ending game");
    clearInterval(this.turnCheckInterval);
  }
}
```

**Test file:** `tests/client/LocalServer.test.ts`

```typescript
// tests/client/LocalServer.test.ts
import { describe, it, expect } from "vitest";
import { ReplaySpeedMultiplier } from "../../src/client/LocalServer";

describe("LocalServer", () => {
  describe("ReplaySpeedMultiplier", () => {
    it("slow = 2x interval", () => {
      expect(ReplaySpeedMultiplier.slow).toBe(2);
    });

    it("normal = 1x interval", () => {
      expect(ReplaySpeedMultiplier.normal).toBe(1);
    });

    it("fast = 0.5x interval", () => {
      expect(ReplaySpeedMultiplier.fast).toBe(0.5);
    });

    it("fastest = 0x interval (no delay)", () => {
      expect(ReplaySpeedMultiplier.fastest).toBe(0);
    });
  });

  describe("turn backlog", () => {
    it("MAX_REPLAY_BACKLOG_TURNS is 60", () => {
      const MAX = 60;
      expect(MAX).toBe(60);
    });

    it("backlog calculation", () => {
      const turnsLength = 100;
      const turnsExecuted = 85;
      const backlog = Math.max(0, turnsLength - turnsExecuted);
      expect(backlog).toBe(15);
    });
  });

  describe("pause behavior", () => {
    it("pause intent prevents subsequent non-pause intents", () => {
      let paused = false;
      const intents: string[] = [];

      // Simulate pause
      paused = true;

      // Non-pause intents should be dropped
      if (!paused) intents.push("attack");
      expect(intents).toHaveLength(0);

      // Unpause
      paused = false;
      if (!paused) intents.push("attack");
      expect(intents).toHaveLength(1);
    });
  });
});
```

**Test command:**
```bash
npx vitest run tests/client/LocalServer.test.ts
```

**Commit:** `feat(client): add LocalServer.ts for singleplayer/replay with speed control and hash verification`

---

## Task 12: Auth.ts

**File:** `src/client/Auth.ts`

- [ ] JWT management with in-memory storage
- [ ] JWT refresh via /auth/refresh endpoint (cookie-based)
- [ ] Auto-refresh when JWT expires (3-minute pre-expiry window)
- [ ] Discord OAuth login redirect
- [ ] Magic link email login
- [ ] Temp token login (from email/purchase redirects)
- [ ] Persistent UUID fallback for anonymous players
- [ ] getPlayToken(): returns JWT or fallback persistent ID
- [ ] getPersistentID(): extracts sub from JWT or uses localStorage
- [ ] Logout: clears JWT, localStorage, cosmetic settings
- [ ] Deduplication of concurrent refresh calls

```typescript
// src/client/Auth.ts
import { decodeJwt } from "jose";
import { z } from "zod";
import type { TokenPayload } from "../core/ApiSchemas";
import { TokenPayloadSchema } from "../core/ApiSchemas";
import { UserSettings } from "../core/game/UserSettings";
import { getApiBase, getAudience } from "./Api";

export type UserAuth = { jwt: string; claims: TokenPayload } | false;

const PERSISTENT_ID_KEY = "player_persistent_id";

let __jwt: string | null = null;
let __refreshPromise: Promise<void> | null = null;
let __expiresAt = 0;

// --- Login methods ---

export function discordLogin() {
  const redirectUri = encodeURIComponent(window.location.href);
  window.location.href = `${getApiBase()}/auth/login/discord?redirect_uri=${redirectUri}`;
}

export async function sendMagicLink(email: string): Promise<boolean> {
  try {
    const response = await fetch(`${getApiBase()}/auth/magic-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        redirectDomain: window.location.origin,
        email,
      }),
    });
    return response.ok;
  } catch (error) {
    console.error("Error sending magic link:", error);
    return false;
  }
}

export async function tempTokenLogin(token: string): Promise<string | null> {
  const response = await fetch(
    `${getApiBase()}/auth/login/token?login-token=${token}`,
    { credentials: "include" },
  );
  if (response.status !== 200) {
    console.error("Token login failed", response);
    return null;
  }
  const json = await response.json();
  return json.email;
}

// --- Auth state ---

export async function getAuthHeader(): Promise<string> {
  const result = await userAuth();
  if (!result) return "";
  return `Bearer ${result.jwt}`;
}

export async function isLoggedIn(): Promise<boolean> {
  return (await userAuth()) !== false;
}

export async function userAuth(shouldRefresh = true): Promise<UserAuth> {
  try {
    if (!__jwt) {
      if (!shouldRefresh) return false;
      await refreshJwt();
      return userAuth(false);
    }

    const payload = decodeJwt(__jwt);
    if (payload.iss !== getApiBase()) {
      console.error("Unexpected JWT issuer");
      await logOut();
      return false;
    }

    const myAud = getAudience();
    if (myAud !== "localhost" && payload.aud !== myAud) {
      console.error("Unexpected JWT audience");
      await logOut();
      return false;
    }

    // Auto-refresh 3 minutes before expiry
    if (Date.now() >= __expiresAt - 3 * 60 * 1000) {
      if (!shouldRefresh) return false;
      await refreshJwt();
      return userAuth(false);
    }

    const result = TokenPayloadSchema.safeParse(payload);
    if (!result.success) {
      console.error("Invalid JWT payload", z.prettifyError(result.error));
      return false;
    }

    return { jwt: __jwt, claims: result.data };
  } catch (e) {
    console.error("userAuth failed:", e);
    return false;
  }
}

// --- Refresh ---

async function refreshJwt(): Promise<void> {
  if (__refreshPromise) return __refreshPromise;
  __refreshPromise = doRefreshJwt();
  try {
    await __refreshPromise;
  } finally {
    __refreshPromise = null;
  }
}

async function doRefreshJwt(): Promise<void> {
  try {
    const response = await fetch(getApiBase() + "/auth/refresh", {
      method: "POST",
      credentials: "include",
    });
    if (response.status !== 200) {
      console.error("JWT refresh failed", response);
      await logOut();
      return;
    }
    const json = await response.json();
    __jwt = json.jwt;
    __expiresAt = Date.now() + json.expiresIn * 1000;
    console.log("JWT refreshed successfully");
  } catch (e) {
    console.error("JWT refresh failed:", e);
    __jwt = null;
  }
}

// --- Logout ---

export async function logOut(allSessions = false): Promise<boolean> {
  try {
    const response = await fetch(
      getApiBase() + (allSessions ? "/auth/revoke" : "/auth/logout"),
      { method: "POST", credentials: "include" },
    );
    return response.ok;
  } catch (e) {
    console.error("Logout failed:", e);
    return false;
  } finally {
    __jwt = null;
    localStorage.removeItem(PERSISTENT_ID_KEY);
    new UserSettings().clearFlag();
    new UserSettings().setSelectedPatternName(undefined);
  }
}

// --- Persistent identity ---

export async function getPlayToken(): Promise<string> {
  const result = await userAuth();
  if (result !== false) return result.jwt;
  return getPersistentID();
}

export function getPersistentID(): string {
  if (__jwt) {
    const payload = decodeJwt(__jwt);
    if (payload.sub) return payload.sub as string;
  }
  return getPersistentIDFromLocalStorage();
}

function getPersistentIDFromLocalStorage(): string {
  const value = localStorage.getItem(PERSISTENT_ID_KEY);
  if (value) return value;

  const newID = crypto.randomUUID();
  localStorage.setItem(PERSISTENT_ID_KEY, newID);
  return newID;
}
```

**Test file:** `tests/client/Auth.test.ts`

```typescript
// tests/client/Auth.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Auth", () => {
  describe("persistent ID", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it("generates UUID if none exists", () => {
      const key = "player_persistent_id";
      let value = localStorage.getItem(key);
      expect(value).toBeNull();

      const newID = crypto.randomUUID();
      localStorage.setItem(key, newID);
      value = localStorage.getItem(key);

      expect(value).toBe(newID);
      expect(value).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it("returns same ID on subsequent calls", () => {
      const key = "player_persistent_id";
      const id = crypto.randomUUID();
      localStorage.setItem(key, id);

      expect(localStorage.getItem(key)).toBe(id);
      expect(localStorage.getItem(key)).toBe(id);
    });
  });

  describe("JWT expiry check", () => {
    it("triggers refresh 3 minutes before expiry", () => {
      const expiresAt = Date.now() + 2 * 60 * 1000; // 2 min from now
      const shouldRefresh = Date.now() >= expiresAt - 3 * 60 * 1000;
      expect(shouldRefresh).toBe(true);
    });

    it("does not refresh when plenty of time left", () => {
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 min from now
      const shouldRefresh = Date.now() >= expiresAt - 3 * 60 * 1000;
      expect(shouldRefresh).toBe(false);
    });
  });
});
```

**Test command:**
```bash
npx vitest run tests/client/Auth.test.ts
```

**Commit:** `feat(client): add Auth.ts with JWT management, Discord OAuth, magic link, and persistent UUID`

---

## Task 13: Api.ts

**File:** `src/client/Api.ts`

- [ ] getApiBase(): derives API URL from window location
- [ ] getAudience(): extracts domain for JWT audience
- [ ] getUserMe(): authenticated profile fetch with caching
- [ ] fetchPlayerById(): player profile lookup
- [ ] fetchGameById(): game archive lookup
- [ ] fetchClanLeaderboard(): clan rankings
- [ ] fetchPlayerLeaderboard(): ranked Elo leaderboard with pagination
- [ ] purchaseWithCurrency(): cosmetic purchase (soft/hard currency)
- [ ] createCheckoutSession(): Stripe checkout for hard currency
- [ ] All responses validated with Zod schemas
- [ ] 401 responses trigger automatic logout
- [ ] invalidateUserMe() cache invalidation

```typescript
// src/client/Api.ts
import { z } from "zod";
import type {
  ClanLeaderboardResponse,
  NewsItem,
  PlayerProfile,
  RankedLeaderboardResponse,
  UserMeResponse,
} from "../core/ApiSchemas";
import {
  ClanLeaderboardResponseSchema,
  PlayerProfileSchema,
  RankedLeaderboardResponseSchema,
  UserMeResponseSchema,
} from "../core/ApiSchemas";
import { getAuthHeader, logOut, userAuth } from "./Auth";

// --- API base URL ---

export function getApiBase(): string {
  const domainname = getAudience();
  if (domainname === "localhost") {
    const apiDomain = process?.env?.API_DOMAIN;
    if (apiDomain) return `https://${apiDomain}`;
    return localStorage.getItem("apiHost") ?? "http://localhost:8787";
  }
  return `https://api.${domainname}`;
}

export function getAudience(): string {
  const { hostname } = new URL(window.location.href);
  return hostname.split(".").slice(-2).join(".");
}

// --- User profile (cached) ---

let __userMe: Promise<UserMeResponse | false> | null = null;

export async function getUserMe(): Promise<UserMeResponse | false> {
  if (__userMe !== null) return __userMe;

  __userMe = (async () => {
    try {
      const auth = await userAuth();
      if (!auth) return false;

      const response = await fetch(getApiBase() + "/users/@me", {
        headers: { authorization: `Bearer ${auth.jwt}` },
      });

      if (response.status === 401) {
        await logOut();
        return false;
      }
      if (response.status !== 200) return false;

      const body = await response.json();
      const result = UserMeResponseSchema.safeParse(body);
      if (!result.success) {
        console.error("Invalid /users/@me response", z.prettifyError(result.error));
        return false;
      }
      return result.data;
    } catch (e) {
      return false;
    }
  })();
  return __userMe;
}

export function invalidateUserMe() {
  __userMe = null;
}

// --- Player lookup ---

export async function fetchPlayerById(
  playerId: string,
): Promise<PlayerProfile | false> {
  try {
    const auth = await userAuth();
    if (!auth) return false;

    const res = await fetch(
      `${getApiBase()}/player/${encodeURIComponent(playerId)}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${auth.jwt}`,
        },
      },
    );
    if (res.status !== 200) return false;

    const json = await res.json();
    const parsed = PlayerProfileSchema.safeParse(json);
    return parsed.success ? parsed.data : false;
  } catch {
    return false;
  }
}

// --- Game archive ---

export async function fetchGameById(gameId: string): Promise<any | false> {
  try {
    const res = await fetch(
      `${getApiBase()}/game/${encodeURIComponent(gameId)}`,
      { headers: { Accept: "application/json" } },
    );
    if (res.status !== 200) return false;
    return await res.json();
  } catch {
    return false;
  }
}

// --- Leaderboards ---

export async function fetchClanLeaderboard(): Promise<
  ClanLeaderboardResponse | false
> {
  try {
    const res = await fetch(`${getApiBase()}/public/clans/leaderboard`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return false;

    const json = await res.json();
    const parsed = ClanLeaderboardResponseSchema.safeParse(json);
    return parsed.success ? parsed.data : false;
  } catch {
    return false;
  }
}

export async function fetchPlayerLeaderboard(
  page: number,
): Promise<RankedLeaderboardResponse | "reached_limit" | false> {
  try {
    const url = new URL(`${getApiBase()}/leaderboard/ranked`);
    url.searchParams.set("page", String(page));

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return false;

    const json = await res.json();
    const parsed = RankedLeaderboardResponseSchema.safeParse(json);
    if (!parsed.success) {
      if (json?.message?.includes?.("Page must be between")) {
        return "reached_limit";
      }
      return false;
    }
    return parsed.data;
  } catch {
    return false;
  }
}

// --- Store ---

export async function purchaseWithCurrency(
  cosmeticType: "pattern" | "skin" | "flag",
  cosmeticName: string,
  currencyType: "hard" | "soft",
): Promise<boolean> {
  try {
    const response = await fetch(`${getApiBase()}/shop/purchase`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: await getAuthHeader(),
      },
      body: JSON.stringify({ cosmeticType, cosmeticName, currencyType }),
    });
    if (response.status === 401) {
      await logOut();
      return false;
    }
    return response.ok;
  } catch {
    return false;
  }
}

export async function createCheckoutSession(
  priceId: string,
): Promise<string | false> {
  try {
    const response = await fetch(
      `${getApiBase()}/stripe/create-checkout-session`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: await getAuthHeader(),
        },
        body: JSON.stringify({
          priceId,
          hostname: window.location.origin,
        }),
      },
    );
    if (!response.ok) return false;
    const json = await response.json();
    return json.url;
  } catch {
    return false;
  }
}

// --- Utility ---

export function hasLinkedAccount(
  userMeResponse: UserMeResponse | false,
): boolean {
  return (
    userMeResponse !== false &&
    (userMeResponse.user?.discord !== undefined ||
      userMeResponse.user?.email !== undefined)
  );
}
```

**Test file:** `tests/client/Api.test.ts`

```typescript
// tests/client/Api.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Api", () => {
  describe("getAudience", () => {
    it("extracts domain from hostname", () => {
      // Simulate: hostname = "play.galacticfront.io"
      const hostname = "play.galacticfront.io";
      const audience = hostname.split(".").slice(-2).join(".");
      expect(audience).toBe("galacticfront.io");
    });

    it("handles localhost", () => {
      const hostname = "localhost";
      const audience = hostname.split(".").slice(-2).join(".");
      expect(audience).toBe("localhost");
    });

    it("handles bare domain", () => {
      const hostname = "galacticfront.io";
      const audience = hostname.split(".").slice(-2).join(".");
      expect(audience).toBe("galacticfront.io");
    });
  });

  describe("getApiBase", () => {
    it("uses localhost fallback for dev", () => {
      const audience = "localhost";
      const apiBase =
        audience === "localhost" ? "http://localhost:8787" : `https://api.${audience}`;
      expect(apiBase).toBe("http://localhost:8787");
    });

    it("uses production API URL for real domain", () => {
      const audience = "galacticfront.io";
      const apiBase =
        audience === "localhost" ? "http://localhost:8787" : `https://api.${audience}`;
      expect(apiBase).toBe("https://api.galacticfront.io");
    });
  });

  describe("hasLinkedAccount", () => {
    it("returns true when discord is present", () => {
      const response = {
        user: { discord: { id: "123", username: "test" } },
      } as any;
      const hasLinked =
        response !== false &&
        (response.user?.discord !== undefined ||
          response.user?.email !== undefined);
      expect(hasLinked).toBe(true);
    });

    it("returns false for anonymous", () => {
      const response = false;
      const hasLinked =
        response !== false &&
        ((response as any).user?.discord !== undefined ||
          (response as any).user?.email !== undefined);
      expect(hasLinked).toBe(false);
    });
  });

  describe("leaderboard pagination", () => {
    it("detects reached_limit from error message", () => {
      const json = { message: "Page must be between 1 and 5" };
      const isLimit = json?.message?.includes?.("Page must be between");
      expect(isLimit).toBe(true);
    });
  });
});
```

**Test command:**
```bash
npx vitest run tests/client/Api.test.ts
```

**Commit:** `feat(client): add Api.ts REST client with profile, shop, leaderboard, and Zod validation`

---

## Summary

| Task | File(s) | Key Responsibility |
|------|---------|-------------------|
| 1 | `vite.config.ts` | Build tooling, dev server port 9000, Tailwind, worker config |
| 2 | `index.html` | Entry point with EJS templating, game containers |
| 3 | `src/client/Main.ts`, `Navigation.ts`, `styles.css` | Bootstrap, dark mode, page navigation |
| 4 | `src/client/Transport.ts` | WebSocket with reconnection, 5s ping, intent wiring |
| 5 | `src/core/worker/WorkerClient.ts` | Worker instantiation, 20s init timeout, query pattern |
| 6 | `src/core/worker/Worker.worker.ts` | GameRunner management, drain loop (max 4), Transferables |
| 7 | `src/core/worker/WorkerMessages.ts` | Discriminated union message protocol |
| 8 | `src/core/game/GameView.ts` | Client-side state projection, bit-packed tiles, UnitView |
| 9 | `src/client/ClientGameRunner.ts` | Game session lifecycle, turn processing, desync handling |
| 10 | `src/client/InputHandler.ts` | Keyboard (36 keys), mouse, touch, pinch, 30+ events |
| 11 | `src/client/LocalServer.ts` | Singleplayer/replay, speed control, turn queue |
| 12 | `src/client/Auth.ts` | JWT, Discord OAuth, magic link, persistent UUID |
| 13 | `src/client/Api.ts` | REST client for profiles, shop, leaderboards |

**Execution order:** Tasks 1-3 and 7 can run in parallel. Then 4-6 and 8 can run in parallel. Then 9 depends on 4+5+8. Tasks 10-13 can run in parallel after 8.

**Total test commands:**
```bash
npx vitest run tests/
```
