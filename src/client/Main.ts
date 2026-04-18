/**
 * Client bootstrap for GalacticFront.io
 * SPA router + singleplayer game launcher
 */

import { GameRunner } from "@core/GameRunner";
import { ExecutionManager } from "@core/execution/ExecutionManager";
import { SpawnExecution } from "@core/execution/SpawnExecution";
import {
  AttackExecution,
  CancelAttackExecution,
  SetTargetTroopRatioExecution,
} from "@core/execution/AttackExecution";
import { RetreatExecution } from "@core/execution/RetreatExecution";
import {
  SetNameExecution,
  SurrenderExecution,
  DonateExecution,
  SetEmbargoExecution,
  ClearEmbargoExecution,
} from "@core/execution/PlayerExecution";
import { EmpireExecution } from "@core/execution/EmpireExecution";
import {
  createEmpiresForGame,
  type EmpireCreationConfig,
} from "@core/execution/empire/EmpireCreation";
import { findSpawnTile } from "@core/execution/TribeSpawner";
import { PseudoRandom } from "@core/PseudoRandom";
import { PlayerType } from "@core/game/Types";
import type { GameConfig } from "@core/Schemas";
import { GameRenderer } from "@client/graphics/GameRenderer";
import { StarFieldLayer } from "@client/graphics/layers/StarFieldLayer";
import {
  TerritoryLayer,
  type GameView as TerritoryGameView,
} from "@client/graphics/layers/TerritoryLayer";
import { TransformHandler } from "@client/graphics/TransformHandler";

// ── Dark mode ────────────────────────────────────────────────────────────────

const DARK_MODE_KEY = "gf_dark_mode";

function initDarkMode(): void {
  const stored = localStorage.getItem(DARK_MODE_KEY);
  const prefersDark =
    stored === null
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : stored === "true";

  if (prefersDark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export function setDarkMode(enabled: boolean): void {
  localStorage.setItem(DARK_MODE_KEY, String(enabled));
  if (enabled) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

// ── SPA Router ───────────────────────────────────────────────────────────────

type PageId = "page-home" | "page-singleplayer" | "page-lobby" | "page-game";

function showPage(pageId: PageId): void {
  const pages = document.querySelectorAll<HTMLElement>(".page");
  for (const page of pages) {
    page.classList.remove("active");
  }
  const target = document.getElementById(pageId);
  if (target) {
    target.classList.add("active");
  }

  // Hide/show cosmetic backgrounds during gameplay
  const starfield = document.getElementById("starfield");
  const nebulas = document.querySelectorAll<HTMLElement>(".nebula");
  const navEl = document.querySelector<HTMLElement>("nav");
  const isGame = pageId === "page-game";

  if (starfield) starfield.style.display = isGame ? "none" : "";
  for (const n of nebulas) n.style.display = isGame ? "none" : "";
  if (navEl) navEl.style.display = isGame ? "none" : "";
}

// ── Modal ────────────────────────────────────────────────────────────────────

function showWipModal(title: string, text: string): void {
  const overlay = document.getElementById("modal-wip");
  const titleEl = document.getElementById("modal-wip-title");
  const textEl = document.getElementById("modal-wip-text");
  if (overlay && titleEl && textEl) {
    titleEl.textContent = title;
    textEl.textContent = text;
    overlay.classList.add("visible");
  }
}

// ── Setup state ──────────────────────────────────────────────────────────────

let selectedDifficulty = "Medium";
let selectedMapSize = "arm";

const MAP_SIZES: Record<string, { width: number; height: number }> = {
  sector: { width: 50, height: 50 },
  arm: { width: 100, height: 100 },
  galaxy: { width: 200, height: 200 },
};

// ── Option card selection ────────────────────────────────────────────────────

function setupOptionGrid(
  gridId: string,
  attrName: string,
  onSelect: (value: string) => void,
): void {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.addEventListener("click", (e) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>(".option-card");
    if (!card) return;
    const value = card.dataset[attrName];
    if (!value) return;
    for (const c of grid.querySelectorAll(".option-card")) {
      c.classList.remove("selected");
    }
    card.classList.add("selected");
    onSelect(value);
  });
}

// ── Game state ───────────────────────────────────────────────────────────────

let activeRunner: GameRunner | null = null;
let activeRenderer: GameRenderer | null = null;
let gameLoopInterval: ReturnType<typeof setInterval> | null = null;

// Player color palette for rendering territory
const PLAYER_COLORS = [
  "#3b82f6", // blue (player)
  "#ef4444", // red
  "#22c55e", // green
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#f97316", // orange
  "#14b8a6", // teal
  "#a855f7", // purple
  "#eab308", // yellow
  "#64748b", // slate
];

// ── Start singleplayer game ──────────────────────────────────────────────────

function startSingleplayerGame(): void {
  const mapDims = MAP_SIZES[selectedMapSize] ?? MAP_SIZES["arm"]!;
  const seed = `sp_${Date.now()}`;

  const config: GameConfig = {
    gameID: `local_${Date.now()}` as GameConfig["gameID"],
    mapWidth: mapDims.width,
    mapHeight: mapDims.height,
    maxPlayers: 12,
    seed,
    ticksPerTurn: 5,
    turnIntervalMs: 200,
    gameMapType: "Standard",
    difficulty: selectedDifficulty,
  };

  // Create GameRunner (creates GameImpl internally)
  const runner = new GameRunner(config);
  const game = runner.game;

  // Create ExecutionManager and register executions
  const execManager = new ExecutionManager(game);
  execManager.registerAll([
    new SpawnExecution(),
    new AttackExecution(),
    new CancelAttackExecution(),
    new SetTargetTroopRatioExecution(),
    new RetreatExecution(),
    new SetNameExecution(),
    new SurrenderExecution(),
    new DonateExecution(),
    new SetEmbargoExecution(),
    new ClearEmbargoExecution(),
  ]);
  runner.setIntentHandler(execManager.createIntentHandler());

  // RNG for spawning
  const spawnRng = new PseudoRandom(seed + "_spawn");

  // Helper: check if a tile is valid for spawning
  const isValidSpawn = (tile: number): boolean =>
    game.map.isTraversable(tile) && !game.map.isOwned(tile);

  // Spawn player
  const playerTile = findSpawnTile(
    config.mapWidth,
    config.mapHeight,
    isValidSpawn,
    spawnRng,
  );
  const playerID = game.spawnPlayer("Commander", playerTile) as number;

  // Spawn AI empires
  const empireConfig: EmpireCreationConfig = {
    empireMode: "default",
    maxPlayers: config.maxPlayers,
    isCompactMap: selectedMapSize === "sector",
  };

  const empireRng = new PseudoRandom(seed + "_empires");
  const empires = createEmpiresForGame(empireConfig, empireRng);
  const aiTickFns: Array<{ playerID: number; ai: EmpireExecution }> = [];

  for (const empire of empires) {
    const aiTile = findSpawnTile(
      config.mapWidth,
      config.mapHeight,
      isValidSpawn,
      spawnRng,
    );
    if (aiTile === -1) continue;

    const aiID = game.spawnPlayer(empire.definition.name, aiTile) as number;
    const aiExec = new EmpireExecution(
      empire.definition,
      selectedDifficulty,
      new PseudoRandom(seed + `_ai_${empire.definition.id}`),
      50,
    );
    aiTickFns.push({ playerID: aiID, ai: aiExec });
  }

  // Build player color map
  const playerColors = new Map<number, string>();
  const allPlayers = game.getPlayers();
  for (let i = 0; i < allPlayers.length; i++) {
    const p = allPlayers[i]!;
    // Use empire flag color if available, otherwise palette
    const empireMatch = empires.find((e) => e.definition.name === p.name);
    if (empireMatch) {
      playerColors.set(p.id, empireMatch.definition.flagColors.primary);
    } else {
      playerColors.set(p.id, PLAYER_COLORS[i % PLAYER_COLORS.length]!);
    }
  }

  // Create canvas and renderer
  const gamePage = document.getElementById("page-game")!;

  // Clean up any previous game canvas
  const oldCanvas = gamePage.querySelector("canvas");
  if (oldCanvas) oldCanvas.remove();

  const canvas = document.createElement("canvas");
  const canvasWidth = window.innerWidth;
  const canvasHeight = window.innerHeight;
  canvas.style.width = "100%";
  canvas.style.height = "100vh";
  gamePage.appendChild(canvas);

  const renderer = new GameRenderer(canvas, canvasWidth, canvasHeight);

  // Camera / transform
  const tileSize = 8;
  const worldWidth = config.mapWidth * tileSize;
  const worldHeight = config.mapHeight * tileSize;

  const transform = new TransformHandler(canvasWidth, canvasHeight);
  transform.setWorldBounds(worldWidth, worldHeight);
  renderer.setTransform(transform);

  // Center camera on player spawn
  const playerPos = game.map.fromIndex(playerTile);
  transform.zoom = 2;
  transform.offsetX = canvasWidth / 2 - playerPos.x * tileSize * transform.zoom;
  transform.offsetY =
    canvasHeight / 2 - playerPos.y * tileSize * transform.zoom;

  // Layers
  const starField = new StarFieldLayer(worldWidth, worldHeight);
  renderer.addLayer(starField, 0);

  // Territory layer needs a GameView interface
  const territoryView: TerritoryGameView = {
    map: game.map,
    playerColors,
    activePlayers: new Set(allPlayers.map((p) => p.id)),
  };
  const territoryLayer = new TerritoryLayer(territoryView, tileSize);
  renderer.addLayer(territoryLayer, 10);

  // Start renderer
  renderer.start();

  // Mouse interaction: pan & zoom
  let isDragging = false;
  let lastMouseX = 0;
  let lastMouseY = 0;

  canvas.addEventListener("mousedown", (e) => {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  });

  canvas.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    transform.pan(dx, dy);
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  });

  canvas.addEventListener("mouseup", () => {
    isDragging = false;
  });

  canvas.addEventListener("mouseleave", () => {
    isDragging = false;
  });

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    transform.zoomToPoint(delta, e.offsetX, e.offsetY);
  });

  // Handle window resize
  const onResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;
    transform.setCanvasSize(w, h);
  };
  window.addEventListener("resize", onResize);

  // Show HUD and exit button
  const hud = document.getElementById("game-hud");
  if (hud) hud.style.display = "flex";
  const exitBtn = document.getElementById("btn-exit-game");
  if (exitBtn) exitBtn.style.display = "block";

  // Game loop: process turns at the configured interval
  let turnCount = 0;
  gameLoopInterval = setInterval(() => {
    if (runner.isGameOver()) {
      if (gameLoopInterval !== null) {
        clearInterval(gameLoopInterval);
        gameLoopInterval = null;
      }
      return;
    }

    // Tick AI empires
    const currentTick = game.currentTick;
    for (const entry of aiTickFns) {
      const aiPlayer = game.getPlayer(entry.playerID);
      if (aiPlayer && aiPlayer.isAlive) {
        entry.ai.tick(game, entry.playerID, currentTick);
      }
    }

    // Process turn
    runner.processTurn();
    turnCount++;

    // Update active players set
    territoryView.activePlayers = new Set(
      game.getAlivePlayers().map((p) => p.id),
    );

    // Update HUD
    const player = game.getPlayer(playerID);
    const hudTurn = document.getElementById("hud-turn");
    const hudTroops = document.getElementById("hud-troops");
    const hudTerritory = document.getElementById("hud-territory");
    const hudFps = document.getElementById("hud-fps");

    if (hudTurn) hudTurn.textContent = String(turnCount);
    if (hudTroops && player)
      hudTroops.textContent = String(player.troops);
    if (hudTerritory && player)
      hudTerritory.textContent = String(player.territoryCount);
    if (hudFps) hudFps.textContent = String(renderer.profiler.fps);
  }, config.turnIntervalMs);

  // Store active game refs
  activeRunner = runner;
  activeRenderer = renderer;

  // Switch to game page
  showPage("page-game");
}

// ── Exit game ───────────────────────────────────────────────────────────────

function exitGame(): void {
  // Stop game tick loop
  if (gameLoopInterval !== null) {
    clearInterval(gameLoopInterval);
    gameLoopInterval = null;
  }

  // Stop renderer
  if (activeRenderer) {
    activeRenderer.stop();
    activeRenderer = null;
  }

  activeRunner = null;

  // Hide HUD and exit button
  const hud = document.getElementById("game-hud");
  if (hud) hud.style.display = "none";
  const exitBtn = document.getElementById("btn-exit-game");
  if (exitBtn) exitBtn.style.display = "none";

  // Remove game canvas
  const gamePage = document.getElementById("page-game");
  const canvas = gamePage?.querySelector("canvas");
  if (canvas) canvas.remove();

  // Navigate home
  showPage("page-home");
}

// ── Navigation wiring ────────────────────────────────────────────────────────

function setupNavigation(): void {
  // Logo -> home (exits game if running)
  document.getElementById("nav-logo")?.addEventListener("click", () => {
    if (activeRunner !== null) {
      exitGame();
    } else {
      showPage("page-home");
    }
  });

  // Nav links
  document.getElementById("nav-play")?.addEventListener("click", () => {
    showPage("page-home");
  });

  document.getElementById("nav-leaderboard")?.addEventListener("click", () => {
    showWipModal(
      "Leaderboard",
      "The leaderboard is under construction. Climb the ranks once multiplayer launches!",
    );
  });

  document.getElementById("nav-store")?.addEventListener("click", () => {
    showWipModal(
      "Store",
      "The cosmetics store is under construction. Customize your empire soon!",
    );
  });

  document.getElementById("nav-settings")?.addEventListener("click", () => {
    showWipModal(
      "Settings",
      "Settings panel is under construction. Configuration options coming soon!",
    );
  });

  // Modal close
  document.getElementById("modal-wip-close")?.addEventListener("click", () => {
    const overlay = document.getElementById("modal-wip");
    if (overlay) overlay.classList.remove("visible");
  });

  // Close modal on overlay click
  document.getElementById("modal-wip")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) {
      (e.currentTarget as HTMLElement).classList.remove("visible");
    }
  });

  // Play Now button
  document.getElementById("btn-play-now")?.addEventListener("click", () => {
    showPage("page-singleplayer");
  });

  // Mode cards -> singleplayer setup
  const modeCards = document.querySelectorAll<HTMLElement>(".mode-card");
  for (const card of modeCards) {
    card.addEventListener("click", () => {
      const mode = card.dataset.mode;
      if (mode === "ai") {
        showPage("page-singleplayer");
      } else {
        showWipModal(
          "Coming Soon",
          `${card.querySelector("h3")?.textContent ?? "This mode"} is under construction. Singleplayer vs AI is available now!`,
        );
      }
    });
  }

  // Setup page: back button
  document.getElementById("btn-setup-back")?.addEventListener("click", () => {
    showPage("page-home");
  });

  // Setup page: option grids
  setupOptionGrid("difficulty-grid", "difficulty", (val) => {
    selectedDifficulty = val;
  });
  setupOptionGrid("mapsize-grid", "mapsize", (val) => {
    selectedMapSize = val;
  });

  // Setup page: start game
  document.getElementById("btn-start-game")?.addEventListener("click", () => {
    startSingleplayerGame();
  });

  // Exit game button
  document.getElementById("btn-exit-game")?.addEventListener("click", () => {
    exitGame();
  });

  // ESC key exits the game
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && activeRunner !== null) {
      exitGame();
    }
  });
}

// ── Init ─────────────────────────────────────────────────────────────────────

export function init(): void {
  initDarkMode();
  setupNavigation();
  console.log("[GalacticFront] Client initialized");
}

// Auto-init on module load
if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}
