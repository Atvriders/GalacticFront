/**
 * Client bootstrap for GalacticFront.io
 * SPA router + singleplayer game with self-contained, inline Canvas 2D rendering.
 *
 * This entry deliberately avoids the layered GameRenderer stack so the playable
 * game path is minimal, inspectable, and cannot fail due to layer setup issues.
 * Everything needed to draw the map lives in this file.
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
import { PseudoRandom } from "@core/PseudoRandom";
import { TerrainType } from "@core/game/Types";
import type { GameConfig } from "@core/Schemas";

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

// ── Transient toast ──────────────────────────────────────────────────────────

function showToast(msg: string): void {
  const t = document.createElement("div");
  t.textContent = msg;
  t.style.cssText =
    "position:fixed;top:80px;left:50%;transform:translateX(-50%);" +
    "background:rgba(10,10,18,0.9);backdrop-filter:blur(8px);" +
    "border:1px solid rgba(34,211,238,0.4);border-radius:10px;" +
    "padding:10px 18px;color:#6ee7b7;font-size:13px;font-weight:600;" +
    "z-index:80;letter-spacing:0.3px;box-shadow:0 4px 24px rgba(0,0,0,0.4);" +
    "pointer-events:none;";
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.transition = "opacity 0.4s";
    t.style.opacity = "0";
    setTimeout(() => t.remove(), 400);
  }, 2200);
}

// ── Setup state ──────────────────────────────────────────────────────────────

let selectedDifficulty = "Medium";
let selectedMapSize = "arm";
let selectedAiCount = 5;

const MAP_SIZES: Record<string, { width: number; height: number }> = {
  sector: { width: 80, height: 80 },
  arm: { width: 150, height: 150 },
  galaxy: { width: 300, height: 300 },
};

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

// Legacy exposed-on-window helper for any inline markup that still uses it.
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

// ── Game state ───────────────────────────────────────────────────────────────

let activeRunner: GameRunner | null = null;
let gameLoopInterval: ReturnType<typeof setInterval> | null = null;
let activeCanvas: HTMLCanvasElement | null = null;
let animFrameId = 0;
let gameCleanupFns: Array<() => void> = [];

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatNum(n: bigint): string {
  const num = Number(n);
  if (num >= 1e12) return (num / 1e12).toFixed(1) + "T";
  if (num >= 1e9) return (num / 1e9).toFixed(1) + "B";
  if (num >= 1e6) return (num / 1e6).toFixed(1) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(1) + "K";
  return String(n);
}

const AI_COLORS = [
  "#ef4444", // red
  "#f59e0b", // amber
  "#10b981", // emerald
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
  "#6366f1", // indigo
  "#84cc16", // lime
];

const AI_NAMES = [
  "Zyr'kathi Hive",
  "Crystalline Concord",
  "Vortani Dominion",
  "Synth Collective",
  "Pyrathi Warclans",
  "Aetheri Nomads",
  "Solar Federation",
  "Martian Collective",
  "Outer Rim Alliance",
  "Centauri Republic",
];

const PLAYER_COLOR = "#22d3ee";

// ── Start singleplayer game ──────────────────────────────────────────────────

function startSingleplayerGame(): void {
  try {
    const mapDims = MAP_SIZES[selectedMapSize] ?? MAP_SIZES["arm"]!;
    const seed = `sp_${Date.now()}`;

    const config: GameConfig = {
      gameID: `local_${Date.now()}` as GameConfig["gameID"],
      mapWidth: mapDims.width,
      mapHeight: mapDims.height,
      maxPlayers: selectedAiCount + 1,
      seed,
      ticksPerTurn: 1,
      turnIntervalMs: 100,
      gameMapType: "Standard",
      difficulty: selectedDifficulty,
    };

    // ── Create runner and game ────────────────────────────────────────────
    const runner = new GameRunner(config);
    const game = runner.game;

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

    // ── Spawn players ─────────────────────────────────────────────────────
    const spawnRng = new PseudoRandom(seed + "_spawn");
    const totalTiles = config.mapWidth * config.mapHeight;

    const findValidTile = (): number => {
      for (let attempts = 0; attempts < 500; attempts++) {
        const tile = spawnRng.nextInt(0, totalTiles - 1);
        if (game.map.isTraversable(tile) && !game.map.isOwned(tile)) {
          return tile;
        }
      }
      // Fallback linear scan
      for (let t = 0; t < totalTiles; t++) {
        if (game.map.isTraversable(t) && !game.map.isOwned(t)) return t;
      }
      return 0;
    };

    const playerTile = findValidTile();
    const playerID = game.spawnPlayer("Commander", playerTile) as number;

    const aiPlayers: number[] = [];
    for (let i = 0; i < selectedAiCount; i++) {
      const tile = findValidTile();
      if (tile <= 0 && i > 0) continue;
      const name = AI_NAMES[i % AI_NAMES.length] ?? `AI ${i + 1}`;
      const aiID = game.spawnPlayer(name, tile) as number;
      aiPlayers.push(aiID);
    }

    // ── Player color map ──────────────────────────────────────────────────
    const playerColors = new Map<number, string>();
    playerColors.set(playerID, PLAYER_COLOR);
    aiPlayers.forEach((id, i) => {
      playerColors.set(id, AI_COLORS[i % AI_COLORS.length]!);
    });

    // ── Set up canvas ─────────────────────────────────────────────────────
    const gamePage = document.getElementById("page-game")!;
    const oldCanvas = gamePage.querySelector("canvas");
    if (oldCanvas) oldCanvas.remove();

    const canvas = document.createElement("canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.cssText =
      "position:fixed;top:0;left:0;width:100vw;height:100vh;" +
      "display:block;cursor:grab;z-index:1;";
    gamePage.appendChild(canvas);
    activeCanvas = canvas;

    const ctx = canvas.getContext("2d")!;

    // ── Camera ────────────────────────────────────────────────────────────
    const tileSize = 6;
    let zoom = 2;

    const playerPos = game.map.fromIndex(playerTile);
    let camX = canvas.width / 2 - playerPos.x * tileSize * zoom;
    let camY = canvas.height / 2 - playerPos.y * tileSize * zoom;

    // ── Stars ─────────────────────────────────────────────────────────────
    const stars: Array<{ x: number; y: number; size: number; alpha: number }> =
      [];
    const starRng = new PseudoRandom(seed + "_stars");
    for (let i = 0; i < 800; i++) {
      stars.push({
        x: starRng.nextFloat(0, canvas.width),
        y: starRng.nextFloat(0, canvas.height),
        size: starRng.chance(0.12) ? 2 : 1,
        alpha: starRng.nextFloat(0.2, 0.9),
      });
    }

    // ── Mouse interaction ─────────────────────────────────────────────────
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const onMouseDown = (e: MouseEvent): void => {
      if (e.button !== 0) return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.style.cursor = "grabbing";
    };
    const onMouseUp = (): void => {
      dragging = false;
      canvas.style.cursor = "grab";
    };
    const onMouseMove = (e: MouseEvent): void => {
      if (!dragging) return;
      camX += e.clientX - lastX;
      camY += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const oldZoom = zoom;
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      zoom = Math.max(0.3, Math.min(8, zoom * factor));
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      camX = mx - ((mx - camX) * zoom) / oldZoom;
      camY = my - ((my - camY) * zoom) / oldZoom;
    };

    const screenToTile = (clientX: number, clientY: number): number | null => {
      const ts = tileSize * zoom;
      const wx = (clientX - camX) / ts;
      const wy = (clientY - camY) / ts;
      if (wx < 0 || wx >= config.mapWidth) return null;
      if (wy < 0 || wy >= config.mapHeight) return null;
      return Math.floor(wy) * config.mapWidth + Math.floor(wx);
    };

    const onContextMenu = (e: MouseEvent): void => {
      e.preventDefault();
      const tile = screenToTile(e.clientX, e.clientY);
      if (tile === null) return;
      const owner = game.map.getOwner(tile);
      if (owner === 0 || owner === playerID) return;

      const player = game.getPlayer(playerID);
      if (!player || player.territory.size === 0) {
        showToast("You have no territory to attack from!");
        return;
      }
      const sourceTile = player.territory.values().next().value as number;
      try {
        const attack = game.startAttack(playerID, owner, sourceTile, 0.5);
        if (attack) {
          const target = game.getPlayer(owner);
          showToast(`Attacking ${target?.name ?? "enemy"}!`);
        } else {
          showToast("Cannot start attack right now");
        }
      } catch (err) {
        console.error("[GalacticFront] Attack failed:", err);
      }
    };

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mouseleave", onMouseUp);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("contextmenu", onContextMenu);

    // ── Window resize ────────────────────────────────────────────────────
    const onResize = (): void => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    gameCleanupFns = [
      () => canvas.removeEventListener("mousedown", onMouseDown),
      () => canvas.removeEventListener("mouseup", onMouseUp),
      () => canvas.removeEventListener("mouseleave", onMouseUp),
      () => canvas.removeEventListener("mousemove", onMouseMove),
      () => canvas.removeEventListener("wheel", onWheel),
      () => canvas.removeEventListener("contextmenu", onContextMenu),
      () => window.removeEventListener("resize", onResize),
    ];

    // ── Leaderboard helper ───────────────────────────────────────────────
    const drawLeaderboard = (
      c: CanvasRenderingContext2D,
      w: number,
    ): void => {
      const alive = game.getAlivePlayers();
      alive.sort((a, b) => b.territoryCount - a.territoryCount);

      const W = 220;
      const pad = 10;
      const lh = 20;
      const H = alive.length * lh + pad * 2 + 26;
      const x = w - W - 16;
      const y = 16;

      c.fillStyle = "rgba(10,10,18,0.85)";
      c.fillRect(x, y, W, H);
      c.strokeStyle = "rgba(255,255,255,0.08)";
      c.lineWidth = 1;
      c.strokeRect(x + 0.5, y + 0.5, W - 1, H - 1);

      c.font = "bold 12px system-ui, sans-serif";
      c.fillStyle = "#e0e0e0";
      c.textAlign = "left";
      c.fillText("LEADERBOARD", x + pad, y + pad + 10);

      c.font = "12px system-ui, sans-serif";
      let rowY = y + pad + 30;
      for (const p of alive) {
        c.fillStyle = playerColors.get(p.id) ?? "#888";
        c.fillRect(x + pad, rowY - 9, 10, 10);

        c.fillStyle = p.id === playerID ? "#6ee7b7" : "#d1d5db";
        const nameLabel =
          p.name.length > 18 ? p.name.slice(0, 17) + "…" : p.name;
        c.fillText(nameLabel, x + pad + 16, rowY);

        c.fillStyle = "#6b7280";
        c.textAlign = "right";
        c.fillText(String(p.territoryCount), x + W - pad, rowY);
        c.textAlign = "left";
        rowY += lh;
      }
    };

    // ── Render loop ──────────────────────────────────────────────────────
    let frameCount = 0;
    let lastFpsTime = performance.now();

    const render = (): void => {
      if (activeRunner !== runner) return;

      const w = canvas.width;
      const h = canvas.height;

      // Deep space background
      ctx.fillStyle = "#0a0a12";
      ctx.fillRect(0, 0, w, h);

      // Stars (subtle parallax)
      const parallax = 0.15;
      for (const star of stars) {
        let sx = (star.x + camX * parallax) % w;
        let sy = (star.y + camY * parallax) % h;
        if (sx < 0) sx += w;
        if (sy < 0) sy += h;
        ctx.globalAlpha = star.alpha;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(sx, sy, star.size, star.size);
      }
      ctx.globalAlpha = 1;

      // Visible tile range
      const ts = tileSize * zoom;
      const startX = Math.max(0, Math.floor(-camX / ts));
      const endX = Math.min(config.mapWidth, Math.ceil((w - camX) / ts) + 1);
      const startY = Math.max(0, Math.floor(-camY / ts));
      const endY = Math.min(config.mapHeight, Math.ceil((h - camY) / ts) + 1);

      // Terrain and territory
      const drawSize = Math.max(1, Math.ceil(ts));
      for (let ty = startY; ty < endY; ty++) {
        for (let tx = startX; tx < endX; tx++) {
          const idx = ty * config.mapWidth + tx;
          const sx = tx * ts + camX;
          const sy = ty * ts + camY;
          const owner = game.map.getOwner(idx);

          if (owner !== 0) {
            ctx.fillStyle = playerColors.get(owner) ?? "#888";
            ctx.fillRect(sx, sy, drawSize, drawSize);
            continue;
          }

          const terrain = game.map.getTerrainType(idx);
          if (terrain === TerrainType.Planet) {
            // Neutral planet dot
            ctx.fillStyle = "#4a5568";
            const d = Math.max(2, ts * 0.5);
            ctx.fillRect(sx + (ts - d) / 2, sy + (ts - d) / 2, d, d);
          } else if (terrain === TerrainType.Asteroid) {
            ctx.fillStyle = "#2a1a0a";
            ctx.fillRect(sx, sy, drawSize, drawSize);
          } else if (terrain === TerrainType.Nebula) {
            ctx.globalAlpha = 0.45;
            ctx.fillStyle = "#1a0f2e";
            ctx.fillRect(sx, sy, drawSize, drawSize);
            ctx.globalAlpha = 1;
          }
        }
      }

      // Highlight player capital
      const player = game.getPlayer(playerID);
      if (player && player.isAlive) {
        const pt = player.capitalTile;
        const px = (pt % config.mapWidth) * ts + camX;
        const py = Math.floor(pt / config.mapWidth) * ts + camY;
        ctx.strokeStyle = PLAYER_COLOR;
        ctx.lineWidth = 2;
        ctx.strokeRect(px - 3, py - 3, ts + 6, ts + 6);
      }

      // Leaderboard
      drawLeaderboard(ctx, w);

      // FPS
      frameCount++;
      const now = performance.now();
      if (now - lastFpsTime > 500) {
        const fps = Math.round((frameCount * 1000) / (now - lastFpsTime));
        frameCount = 0;
        lastFpsTime = now;
        const hudFps = document.getElementById("hud-fps");
        if (hudFps) hudFps.textContent = String(fps);
      }

      animFrameId = requestAnimationFrame(render);
    };

    // ── Help overlay ──────────────────────────────────────────────────────
    const helpDiv = document.createElement("div");
    helpDiv.id = "game-help";
    helpDiv.style.cssText =
      "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);" +
      "background:rgba(10,10,18,0.92);backdrop-filter:blur(10px);" +
      "border:1px solid rgba(34,211,238,0.2);border-radius:12px;" +
      "padding:14px 22px;color:#e0e0e0;font-size:13px;z-index:50;" +
      "max-width:640px;text-align:center;" +
      "box-shadow:0 8px 32px rgba(0,0,0,0.5);pointer-events:none;";
    helpDiv.innerHTML =
      '<div style="margin-bottom:8px;color:#22d3ee;font-weight:700;font-size:14px;">' +
      "Welcome, Commander!</div>" +
      '<div style="color:#9ca3af;line-height:1.7;">' +
      '<strong style="color:#e0e0e0;">Drag</strong> to pan · ' +
      '<strong style="color:#e0e0e0;">Scroll</strong> to zoom · ' +
      '<strong style="color:#e0e0e0;">Right-click</strong> enemy territory to attack · ' +
      '<strong style="color:#e0e0e0;">ESC</strong> to exit' +
      "</div>" +
      '<div style="margin-top:8px;font-size:11px;color:#6b7280;">' +
      'Your color is <span style="color:#22d3ee;font-weight:600;">cyan</span>. ' +
      "Conquer the galaxy!</div>";
    document.body.appendChild(helpDiv);
    const helpTimeout = setTimeout(() => {
      helpDiv.style.transition = "opacity 1s";
      helpDiv.style.opacity = "0";
      setTimeout(() => helpDiv.remove(), 1000);
    }, 9000);
    gameCleanupFns.push(() => {
      clearTimeout(helpTimeout);
      helpDiv.remove();
    });

    // ── Show HUD and exit button ─────────────────────────────────────────
    const hud = document.getElementById("game-hud");
    if (hud) hud.style.display = "flex";
    const exitBtn = document.getElementById("btn-exit-game");
    if (exitBtn) exitBtn.style.display = "block";

    // ── Game tick loop ───────────────────────────────────────────────────
    let turnCount = 0;
    gameLoopInterval = setInterval(() => {
      if (runner.isGameOver()) {
        if (gameLoopInterval !== null) {
          clearInterval(gameLoopInterval);
          gameLoopInterval = null;
        }
        const winnerID = game.winnerID;
        const winner = winnerID !== null ? game.getPlayer(winnerID) : null;
        if (winner && winner.id === playerID) {
          showToast("Victory! You conquered the galaxy.");
        } else if (winner) {
          showToast(`Defeat — ${winner.name} wins.`);
        } else {
          showToast("Game over.");
        }
        return;
      }

      runner.processTurn();
      turnCount++;

      // Simple AI behavior — occasionally launch attacks
      if (turnCount % 8 === 0) {
        for (const aiID of aiPlayers) {
          const ai = game.getPlayer(aiID);
          if (!ai || !ai.isAlive) continue;
          if (ai.troops < 50n) continue;
          if (ai.territory.size === 0) continue;

          const candidates = game
            .getAlivePlayers()
            .filter((p) => p.id !== aiID && !ai.isAlliedWith(p.id));
          if (candidates.length === 0) continue;

          const target =
            candidates[Math.floor(Math.random() * candidates.length)]!;
          const sourceTile = ai.territory.values().next().value as number;
          try {
            game.startAttack(aiID, target.id, sourceTile, 0.3);
          } catch {
            // ignore — attack limits, alliances, etc.
          }
        }
      }

      // Update HUD
      const player = game.getPlayer(playerID);
      const hudTurn = document.getElementById("hud-turn");
      const hudTroops = document.getElementById("hud-troops");
      const hudTerritory = document.getElementById("hud-territory");

      if (hudTurn) hudTurn.textContent = String(turnCount);
      if (hudTroops)
        hudTroops.textContent = player ? formatNum(player.troops) : "0";
      if (hudTerritory)
        hudTerritory.textContent = player
          ? String(player.territoryCount)
          : "0";
    }, config.turnIntervalMs);

    // Start rendering
    activeRunner = runner;
    render();

    // Switch to game page
    showPage("page-game");

    console.log(
      `[GalacticFront] Game started: ${config.mapWidth}x${config.mapHeight}, ` +
        `${aiPlayers.length + 1} players, difficulty=${selectedDifficulty}`,
    );
  } catch (err) {
    console.error("[GalacticFront] Failed to start game:", err);
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

// ── Exit game ────────────────────────────────────────────────────────────────

function exitGame(): void {
  if (gameLoopInterval !== null) {
    clearInterval(gameLoopInterval);
    gameLoopInterval = null;
  }

  activeRunner = null;
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = 0;
  }

  for (const fn of gameCleanupFns) {
    try {
      fn();
    } catch {
      // ignore
    }
  }
  gameCleanupFns = [];

  const hud = document.getElementById("game-hud");
  if (hud) hud.style.display = "none";
  const exitBtn = document.getElementById("btn-exit-game");
  if (exitBtn) exitBtn.style.display = "none";

  if (activeCanvas) {
    activeCanvas.remove();
    activeCanvas = null;
  }

  document.getElementById("game-help")?.remove();

  showPage("page-home");
}

// ── AI count selector ───────────────────────────────────────────────────────

function setupAiCountSelector(): void {
  const slider = document.getElementById(
    "ai-count-slider",
  ) as HTMLInputElement | null;
  const valueEl = document.getElementById("ai-count-value");
  const minusBtn = document.getElementById("btn-ai-minus");
  const plusBtn = document.getElementById("btn-ai-plus");

  const sync = (): void => {
    if (valueEl) valueEl.textContent = String(selectedAiCount);
    if (slider) slider.value = String(selectedAiCount);
  };

  const setCount = (n: number): void => {
    selectedAiCount = Math.max(1, Math.min(10, Math.round(n)));
    sync();
  };

  slider?.addEventListener("input", () => {
    setCount(parseInt(slider.value, 10));
  });
  minusBtn?.addEventListener("click", () => setCount(selectedAiCount - 1));
  plusBtn?.addEventListener("click", () => setCount(selectedAiCount + 1));

  sync();
}

// ── Navigation wiring ────────────────────────────────────────────────────────

function setupNavigation(): void {
  document.getElementById("nav-logo")?.addEventListener("click", () => {
    if (activeRunner) {
      exitGame();
    } else {
      showPage("page-home");
    }
  });

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

  document.getElementById("modal-wip-close")?.addEventListener("click", () => {
    closeModal();
  });

  document.getElementById("modal-wip")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) {
      closeModal();
    }
  });

  document.getElementById("btn-play-now")?.addEventListener("click", () => {
    showPage("page-singleplayer");
  });

  const modeCards = document.querySelectorAll<HTMLElement>(".mode-card");
  for (const card of modeCards) {
    card.addEventListener("click", () => {
      const mode = card.dataset.mode;
      if (mode === "ai") {
        showPage("page-singleplayer");
      } else {
        showModal(
          "Coming Soon",
          `${
            card.querySelector("h3")?.textContent ?? "This mode"
          } is under construction. Singleplayer vs AI is available now!`,
        );
      }
    });
  }

  document.getElementById("btn-setup-back")?.addEventListener("click", () => {
    showPage("page-home");
  });

  setupOptionGrid("difficulty-grid", "difficulty", (val) => {
    selectedDifficulty = val;
  });
  setupOptionGrid("mapsize-grid", "mapsize", (val) => {
    selectedMapSize = val;
  });
  setupAiCountSelector();

  document.getElementById("btn-start-game")?.addEventListener("click", () => {
    startSingleplayerGame();
  });

  document.getElementById("btn-exit-game")?.addEventListener("click", () => {
    exitGame();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && activeRunner) {
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

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}
