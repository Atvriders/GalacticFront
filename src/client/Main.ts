/**
 * Client bootstrap for GalacticFront.io
 * SPA router + singleplayer game with direct Canvas 2D rendering
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
import { TerrainType } from "@core/game/Types";
import type { GameConfig } from "@core/Schemas";
import type { GameImpl } from "@core/game/GameImpl";

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

function showPage(pageId: string): void {
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

function showModal(title: string, text: string): void {
  const overlay = document.getElementById("modal-wip");
  const titleEl = document.getElementById("modal-wip-title");
  const textEl = document.getElementById("modal-wip-text");
  if (overlay && titleEl && textEl) {
    titleEl.textContent = title;
    textEl.textContent = text;
    overlay.classList.add("visible");
  }
}

function closeModal(): void {
  const overlay = document.getElementById("modal-wip");
  if (overlay) overlay.classList.remove("visible");
}

// ── Setup state ──────────────────────────────────────────────────────────────

let selectedDifficulty = "Medium";
let selectedMapSize = "arm";

const MAP_SIZES: Record<string, { width: number; height: number }> = {
  sector: { width: 80, height: 80 },
  arm: { width: 150, height: 150 },
  galaxy: { width: 300, height: 300 },
};

// ── Card selection ───────────────────────────────────────────────────────────

function selectCard(
  group: string,
  value: string,
  element: HTMLElement,
): void {
  const grid = element.closest(".option-grid");
  if (grid) {
    for (const card of grid.querySelectorAll(".option-card")) {
      card.classList.remove("selected");
    }
  }
  element.classList.add("selected");

  if (group === "difficulty") {
    selectedDifficulty = value;
  } else if (group === "mapsize") {
    selectedMapSize = value;
  }
}

// ── Option grid setup ────────────────────────────────────────────────────────

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

// ── Player colors ────────────────────────────────────────────────────────────

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

// ── Game state ───────────────────────────────────────────────────────────────

let running = false;
let gameLoopInterval: ReturnType<typeof setInterval> | null = null;
let activeCanvas: HTMLCanvasElement | null = null;
let animFrameId = 0;

// ── Start singleplayer game ──────────────────────────────────────────────────

function startSingleplayerGame(): void {
  try {
    const mapDims = MAP_SIZES[selectedMapSize] ?? MAP_SIZES["arm"]!;
    const seed = `sp_${Date.now()}`;

    const config: GameConfig = {
      gameID: `local_${Date.now()}` as GameConfig["gameID"],
      mapWidth: mapDims.width,
      mapHeight: mapDims.height,
      maxPlayers: 12,
      seed,
      ticksPerTurn: 5,
      turnIntervalMs: 150,
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
      const empireMatch = empires.find((e) => e.definition.name === p.name);
      if (empireMatch) {
        playerColors.set(p.id, empireMatch.definition.flagColors.primary);
      } else {
        playerColors.set(p.id, PLAYER_COLORS[i % PLAYER_COLORS.length]!);
      }
    }

    function getPlayerColor(ownerID: number): string {
      return playerColors.get(ownerID) ?? "#444";
    }

    // ── Create Canvas ──────────────────────────────────────────────────────
    const gamePage = document.getElementById("page-game")!;

    // Clean up any previous game canvas
    const oldCanvas = gamePage.querySelector("canvas");
    if (oldCanvas) oldCanvas.remove();

    const canvas = document.createElement("canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.width = "100%";
    canvas.style.height = "100vh";
    canvas.style.display = "block";
    gamePage.appendChild(canvas);
    activeCanvas = canvas;

    const ctx = canvas.getContext("2d")!;

    // ── Camera state ───────────────────────────────────────────────────────
    let camX = 0;
    let camY = 0;
    let zoom = 3;
    const TILE = 6; // pixels per tile at 1x zoom

    // Generate background stars (fixed positions)
    const bgStars: Array<{
      x: number;
      y: number;
      size: number;
      alpha: number;
    }> = [];
    const starRng = new PseudoRandom(seed + "_stars");
    for (let i = 0; i < 400; i++) {
      bgStars.push({
        x: starRng.nextFloat(0, canvas.width),
        y: starRng.nextFloat(0, canvas.height),
        size: starRng.chance(0.1) ? 2 : 1,
        alpha: starRng.nextFloat(0.15, 0.5),
      });
    }

    // Center camera on player territory
    const playerPos = game.map.fromIndex(playerTile);
    camX = canvas.width / 2 - playerPos.x * TILE * zoom;
    camY = canvas.height / 2 - playerPos.y * TILE * zoom;

    // ── Render function ────────────────────────────────────────────────────
    running = true;
    let turnCount = 0;

    function render(): void {
      if (!running) return;

      const w = canvas.width;
      const h = canvas.height;

      // Clear with space background
      ctx.fillStyle = "#0a0a12";
      ctx.fillRect(0, 0, w, h);

      // Draw background stars
      for (const star of bgStars) {
        ctx.globalAlpha = star.alpha;
        ctx.fillStyle = "white";
        ctx.fillRect(star.x, star.y, star.size, star.size);
      }
      ctx.globalAlpha = 1;

      ctx.save();
      ctx.translate(camX, camY);
      ctx.scale(zoom, zoom);

      // Compute visible tile range for culling
      const tileWorldSize = TILE;
      const visMinX = Math.max(
        0,
        Math.floor(-camX / zoom / tileWorldSize) - 1,
      );
      const visMinY = Math.max(
        0,
        Math.floor(-camY / zoom / tileWorldSize) - 1,
      );
      const visMaxX = Math.min(
        game.map.width - 1,
        Math.ceil((-camX + w) / zoom / tileWorldSize) + 1,
      );
      const visMaxY = Math.min(
        game.map.height - 1,
        Math.ceil((-camY + h) / zoom / tileWorldSize) + 1,
      );

      // Draw map tiles (only visible area)
      for (let ty = visMinY; ty <= visMaxY; ty++) {
        for (let tx = visMinX; tx <= visMaxX; tx++) {
          const i = ty * game.map.width + tx;
          const x = tx * TILE;
          const y = ty * TILE;

          const owner = game.map.getOwner(i);
          if (owner > 0) {
            ctx.fillStyle = getPlayerColor(owner);
            ctx.fillRect(x, y, TILE - 1, TILE - 1);
          } else if (game.map.getTerrainType(i) === TerrainType.Planet) {
            ctx.fillStyle = "#1a1a2e";
            ctx.fillRect(x, y, TILE - 1, TILE - 1);
          } else if (game.map.getTerrainType(i) === TerrainType.Asteroid) {
            ctx.fillStyle = "#2a1a0a";
            ctx.fillRect(x, y, TILE - 1, TILE - 1);
          } else if (game.map.getTerrainType(i) === TerrainType.Nebula) {
            ctx.fillStyle = "#0f0a1e";
            ctx.fillRect(x, y, TILE - 1, TILE - 1);
          }
        }
      }

      // Draw player names on territory centers
      if (zoom > 1) {
        ctx.font = `${Math.max(3, Math.round(5 / Math.sqrt(zoom)))}px sans-serif`;
        ctx.textAlign = "center";
        for (const player of game.getAlivePlayers()) {
          if (player.territoryCount < 5) continue;
          const tiles = Array.from(player.territory);
          const cx =
            tiles.reduce((s, t) => s + (t % game.map.width), 0) /
            tiles.length;
          const cy =
            tiles.reduce(
              (s, t) => s + Math.floor(t / game.map.width),
              0,
            ) / tiles.length;
          ctx.fillStyle = "rgba(255,255,255,0.8)";
          ctx.fillText(
            player.name,
            cx * TILE + TILE / 2,
            cy * TILE + TILE / 2,
          );
        }
      }

      ctx.restore();

      // ── HUD overlay ────────────────────────────────────────────────────
      drawHUD(ctx, game, playerID, playerColors, turnCount, w, h);

      animFrameId = requestAnimationFrame(render);
    }

    // ── Mouse interaction ──────────────────────────────────────────────────
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
      camX += dx;
      camY += dy;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    });

    canvas.addEventListener("mouseup", () => {
      isDragging = false;
    });

    canvas.addEventListener("mouseleave", () => {
      isDragging = false;
    });

    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const oldZoom = zoom;
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        zoom = Math.max(0.3, Math.min(20, zoom * factor));

        // Zoom toward cursor
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        camX = mx - ((mx - camX) * zoom) / oldZoom;
        camY = my - ((my - camY) * zoom) / oldZoom;
      },
      { passive: false },
    );

    // Handle window resize
    const onResize = (): void => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      // Regenerate star positions for new dimensions
      bgStars.length = 0;
      const resizeRng = new PseudoRandom(seed + "_stars_resize");
      for (let i = 0; i < 400; i++) {
        bgStars.push({
          x: resizeRng.nextFloat(0, canvas.width),
          y: resizeRng.nextFloat(0, canvas.height),
          size: resizeRng.chance(0.1) ? 2 : 1,
          alpha: resizeRng.nextFloat(0.15, 0.5),
        });
      }
    };
    window.addEventListener("resize", onResize);

    // Show HUD and exit button
    const hud = document.getElementById("game-hud");
    if (hud) hud.style.display = "flex";
    const exitBtn = document.getElementById("btn-exit-game");
    if (exitBtn) exitBtn.style.display = "block";

    // Show objectives banner
    const objectives = document.getElementById("game-objectives");
    if (objectives) objectives.style.display = "block";

    // Show tutorial overlay (auto-dismiss after 15s or on click)
    const tutorial = document.getElementById("game-tutorial");
    let tutorialTimeout: ReturnType<typeof setTimeout> | null = null;
    if (tutorial) {
      tutorial.style.display = "block";
      const dismissBtn = document.getElementById("tutorial-dismiss");
      const dismiss = (): void => {
        tutorial.style.display = "none";
        if (tutorialTimeout !== null) {
          clearTimeout(tutorialTimeout);
          tutorialTimeout = null;
        }
      };
      if (dismissBtn) {
        (dismissBtn as HTMLButtonElement).onclick = dismiss;
      }
      tutorialTimeout = setTimeout(dismiss, 15000);
    }

    // Show minimap + set up rendering
    const minimap = document.getElementById("game-minimap");
    if (minimap) minimap.style.display = "block";
    const minimapCanvas = document.getElementById(
      "minimap-canvas",
    ) as HTMLCanvasElement | null;
    let minimapCtx: CanvasRenderingContext2D | null = null;
    if (minimapCanvas) {
      // Match backing store to displayed size for crisp rendering
      const mmRect = minimapCanvas.getBoundingClientRect();
      minimapCanvas.width = Math.max(1, Math.floor(mmRect.width));
      minimapCanvas.height = Math.max(1, Math.floor(mmRect.height));
      minimapCtx = minimapCanvas.getContext("2d");
    }

    function drawMinimap(): void {
      if (!minimapCtx || !minimapCanvas) return;
      const mw = minimapCanvas.width;
      const mh = minimapCanvas.height;
      const gw = game.map.width;
      const gh = game.map.height;
      const sx = mw / gw;
      const sy = mh / gh;

      minimapCtx.fillStyle = "#05050a";
      minimapCtx.fillRect(0, 0, mw, mh);

      // Draw ownership as colored pixels (sample per-cell)
      const cellW = Math.max(1, Math.ceil(sx));
      const cellH = Math.max(1, Math.ceil(sy));
      for (let ty = 0; ty < gh; ty++) {
        for (let tx = 0; tx < gw; tx++) {
          const idx = ty * gw + tx;
          const owner = game.map.getOwner(idx);
          if (owner > 0) {
            minimapCtx.fillStyle = getPlayerColor(owner);
            minimapCtx.fillRect(tx * sx, ty * sy, cellW, cellH);
          }
        }
      }

      // Draw viewport rectangle (what the main camera is showing)
      const vx = (-camX / zoom / TILE) * sx;
      const vy = (-camY / zoom / TILE) * sy;
      const vw = ((canvas.width / zoom) / TILE) * sx;
      const vh = ((canvas.height / zoom) / TILE) * sy;
      minimapCtx.strokeStyle = "rgba(110,231,183,0.9)";
      minimapCtx.lineWidth = 1;
      minimapCtx.strokeRect(vx, vy, vw, vh);
    }

    // ── Game tick loop ───────────────────────────────────────────────────
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

      // Update HTML HUD elements
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
      if (hudFps) hudFps.textContent = "60";

      // Update minimap each turn
      drawMinimap();
    }, config.turnIntervalMs);

    // Start rendering
    render();

    // Switch to game page
    showPage("page-game");

    console.log(
      `[GalacticFront] Game started: ${config.mapWidth}x${config.mapHeight}, ${allPlayers.length} players`,
    );
  } catch (err) {
    console.error("[GalacticFront] Failed to start game:", err);
    // Show error on screen
    const gamePage = document.getElementById("page-game");
    if (gamePage) {
      const errDiv = document.createElement("div");
      errDiv.style.cssText =
        "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);" +
        "background:#1a0000;border:2px solid #ff3333;color:#ff6666;padding:32px;" +
        "border-radius:12px;max-width:600px;font-family:monospace;z-index:999;";
      const heading = document.createElement("h3");
      heading.style.cssText = "color:#ff3333;margin-bottom:12px;";
      heading.textContent = "Game Init Error";
      const pre = document.createElement("pre");
      pre.style.cssText = "white-space:pre-wrap;font-size:13px;";
      pre.textContent = String(err);
      const btn = document.createElement("button");
      btn.style.cssText =
        "margin-top:16px;padding:8px 20px;background:#333;color:#eee;" +
        "border:1px solid #666;border-radius:6px;cursor:pointer;";
      btn.textContent = "Reload";
      btn.addEventListener("click", () => location.reload());
      errDiv.appendChild(heading);
      errDiv.appendChild(pre);
      errDiv.appendChild(btn);
      gamePage.appendChild(errDiv);
    }
    showPage("page-game");
  }
}

// ── HUD drawing ──────────────────────────────────────────────────────────────

function drawHUD(
  ctx: CanvasRenderingContext2D,
  game: GameImpl,
  playerID: number,
  playerColors: Map<number, string>,
  _turnCount: number,
  w: number,
  h: number,
): void {
  // Leaderboard / player list - draw on canvas top-right
  const alivePlayers = game.getAlivePlayers();
  alivePlayers.sort((a, b) => b.territoryCount - a.territoryCount);

  const lbX = w - 200;
  let lbY = 16;
  const lineHeight = 18;
  const padding = 10;
  const lbHeight = alivePlayers.length * lineHeight + padding * 2 + 24;

  ctx.fillStyle = "rgba(10,10,18,0.85)";
  ctx.fillRect(lbX - padding, lbY - padding, 200, lbHeight);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.strokeRect(lbX - padding, lbY - padding, 200, lbHeight);

  ctx.font = "bold 13px sans-serif";
  ctx.fillStyle = "#e0e0e0";
  ctx.textAlign = "left";
  ctx.fillText("Leaderboard", lbX, lbY + 12);
  lbY += 24;

  ctx.font = "12px sans-serif";
  for (const p of alivePlayers) {
    // Color swatch
    ctx.fillStyle = playerColors.get(p.id) ?? "#888";
    ctx.fillRect(lbX + 2, lbY + 3, 10, 10);

    // Name + territory
    ctx.fillStyle = p.id === playerID ? "#6ee7b7" : "#9ca3af";
    ctx.fillText(`${p.name}: ${p.territoryCount}`, lbX + 16, lbY + 12);
    lbY += lineHeight;
  }

  // Bottom center hint
  const hint = "WASD or drag to pan | Scroll to zoom | ESC to exit";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fillText(hint, w / 2, h - 16);
}

// ── Exit game ────────────────────────────────────────────────────────────────

function exitGame(): void {
  // Stop game tick loop
  if (gameLoopInterval !== null) {
    clearInterval(gameLoopInterval);
    gameLoopInterval = null;
  }

  // Stop rendering
  running = false;
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = 0;
  }

  // Hide HUD and exit button
  const hud = document.getElementById("game-hud");
  if (hud) hud.style.display = "none";
  const exitBtn = document.getElementById("btn-exit-game");
  if (exitBtn) exitBtn.style.display = "none";

  // Hide tutorial, objectives, minimap
  const tutorial = document.getElementById("game-tutorial");
  if (tutorial) tutorial.style.display = "none";
  const objectives = document.getElementById("game-objectives");
  if (objectives) objectives.style.display = "none";
  const minimap = document.getElementById("game-minimap");
  if (minimap) minimap.style.display = "none";

  // Remove game canvas
  if (activeCanvas) {
    activeCanvas.remove();
    activeCanvas = null;
  }

  // Navigate home
  showPage("page-home");
}

// ── Navigation wiring ────────────────────────────────────────────────────────

function setupNavigation(): void {
  // Logo -> home (exits game if running)
  document.getElementById("nav-logo")?.addEventListener("click", () => {
    if (running) {
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
    showModal(
      "Leaderboard",
      "The leaderboard is under construction. Climb the ranks once multiplayer launches!",
    );
  });

  document.getElementById("nav-store")?.addEventListener("click", () => {
    showModal(
      "Store",
      "The cosmetics store is under construction. Customize your empire soon!",
    );
  });

  document.getElementById("nav-settings")?.addEventListener("click", () => {
    showModal(
      "Settings",
      "Settings panel is under construction. Configuration options coming soon!",
    );
  });

  // Modal close
  document.getElementById("modal-wip-close")?.addEventListener("click", () => {
    closeModal();
  });

  // Close modal on overlay click
  document.getElementById("modal-wip")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) {
      closeModal();
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
        showModal(
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
    if (e.key === "Escape" && running) {
      exitGame();
    }
  });
}

// ── Expose on window ─────────────────────────────────────────────────────────

(window as any).showPage = showPage;
(window as any).startSingleplayerGame = startSingleplayerGame;
(window as any).exitGame = exitGame;
(window as any).showModal = showModal;
(window as any).closeModal = closeModal;
(window as any).selectCard = selectCard;

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
