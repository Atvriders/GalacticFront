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

// ── Sound system ─────────────────────────────────────────────────────────────
let audioCtx: AudioContext | null = null;
let soundEnabled = localStorage.getItem("gf_sound") !== "false";

function getAudio(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function beep(freq: number, duration: number, type: OscillatorType = "sine", vol: number = 0.08): void {
  if (!soundEnabled) return;
  try {
    const ctx = getAudio();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

function sfxClaim(): void { beep(880, 0.08, "sine", 0.05); }
function sfxAttack(): void { beep(220, 0.15, "sawtooth", 0.08); beep(180, 0.1, "square", 0.05); }
function sfxHit(): void { beep(440, 0.05, "square", 0.06); }
function sfxVictory(): void {
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.25, "sine", 0.1), i * 150));
}
function sfxDefeat(): void {
  [400, 300, 200].forEach((f, i) => setTimeout(() => beep(f, 0.4, "triangle", 0.1), i * 200));
}

export function toggleSound(): boolean {
  soundEnabled = !soundEnabled;
  localStorage.setItem("gf_sound", String(soundEnabled));
  if (soundEnabled) beep(800, 0.1, "sine", 0.05);
  return soundEnabled;
}
(window as any).gf_toggleSound = toggleSound;
(window as any).gf_sfxClaim = sfxClaim;
(window as any).gf_sfxAttack = sfxAttack;
(window as any).gf_sfxVictory = sfxVictory;
(window as any).gf_sfxDefeat = sfxDefeat;

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

// ── Live events panel ────────────────────────────────────────────────────────

function logEvent(
  text: string,
  type: "info" | "attack" | "capture" | "warning" = "info",
): void {
  const colors = {
    info: "#9ca3af",
    attack: "#ef4444",
    capture: "#10b981",
    warning: "#f59e0b",
  };
  const events = document.getElementById("game-events");
  if (!events) return;

  const div = document.createElement("div");
  div.style.cssText = `background:rgba(10,10,18,0.9);backdrop-filter:blur(8px);border-left:3px solid ${colors[type]};border-radius:6px;padding:10px 14px;color:#e0e0e0;font-size:12px;animation:gfSlideIn 0.3s ease-out;line-height:1.4;`;
  div.textContent = text;
  events.insertBefore(div, events.firstChild);

  // Keep only last 5 events
  while (events.children.length > 5) events.removeChild(events.lastChild!);

  setTimeout(() => {
    div.style.transition = "opacity 0.6s, transform 0.6s";
    div.style.opacity = "0";
    div.style.transform = "translateX(30px)";
    setTimeout(() => div.remove(), 600);
  }, 6000);
}

(window as any).gf_logEvent = logEvent;

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
let activeKeyHandler: ((e: KeyboardEvent) => void) | null = null;
let animFrameId = 0;
let gameCleanupFns: Array<() => void> = [];
let isMuted = false;
let isAutoExpand = false;
let gameSpeed = 1; // 1 = 1x, 2 = 2x, 4 = 4x
let isPaused = false;
let gameRecorded = false;
let activeGameSnapshot: (() => {
  turns: number;
  territory: number;
  kills: number;
}) | null = null;

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
    gameRecorded = false;
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

    // Claim a (2*radius+1)x(2*radius+1) area around centerTile for playerID.
    const claimArea = (
      playerID: number,
      centerTile: number,
      radius: number,
    ): void => {
      const cx = centerTile % config.mapWidth;
      const cy = Math.floor(centerTile / config.mapWidth);
      const player = game.getPlayer(playerID);
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || x >= config.mapWidth) continue;
          if (y < 0 || y >= config.mapHeight) continue;
          const tile = y * config.mapWidth + x;
          if (!game.map.isTraversable(tile)) continue;
          const owner = game.map.getOwner(tile);
          if (owner !== 0 && owner !== playerID) continue;
          if (typeof (game as any).claimTile === "function") {
            (game as any).claimTile(tile, playerID);
          } else {
            game.map.setOwner(tile, playerID);
            if (player) player.territory.add(tile);
          }
        }
      }
    };

    const playerTile = findValidTile();
    const playerID = game.spawnPlayer("Commander", playerTile) as number;
    // Give the human commander a clearly visible 9x9 starting territory.
    claimArea(playerID, playerTile, 4);

    const aiPlayers: number[] = [];
    for (let i = 0; i < selectedAiCount; i++) {
      const tile = findValidTile();
      if (tile <= 0 && i > 0) continue;
      const name = AI_NAMES[i % AI_NAMES.length] ?? `AI ${i + 1}`;
      const aiID = game.spawnPlayer(name, tile) as number;
      // Give each AI a matching 9x9 starting empire so they're visible too.
      claimArea(aiID, tile, 4);
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
    const tileSize = 12;
    let zoom = 3;

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

    // ── Fleet particles ───────────────────────────────────────────────────
    const fleetParticles: Array<{
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
      age: number;
      maxAge: number;
      color: string;
    }> = [];

    const spawnFleet = (
      fromTile: number,
      toTile: number,
      color: string,
    ): void => {
      const fromX = (fromTile % config.mapWidth) + 0.5;
      const fromY = Math.floor(fromTile / config.mapWidth) + 0.5;
      const toX = (toTile % config.mapWidth) + 0.5;
      const toY = Math.floor(toTile / config.mapWidth) + 0.5;
      for (let i = 0; i < 5; i++) {
        fleetParticles.push({
          fromX: fromX + (Math.random() - 0.5) * 2,
          fromY: fromY + (Math.random() - 0.5) * 2,
          toX,
          toY,
          age: -i * 3,
          maxAge: 60,
          color,
        });
      }
    };

    // ── Mouse interaction ─────────────────────────────────────────────────
    let dragging = false;
    let didDrag = false;
    let lastX = 0;
    let lastY = 0;
    let downX = 0;
    let downY = 0;

    const onMouseDown = (e: MouseEvent): void => {
      if (e.button !== 0) return;
      dragging = true;
      didDrag = false;
      lastX = e.clientX;
      lastY = e.clientY;
      downX = e.clientX;
      downY = e.clientY;
      canvas.style.cursor = "grabbing";
    };
    const onMouseUp = (): void => {
      dragging = false;
      canvas.style.cursor = "grab";
    };
    const onMouseMove = (e: MouseEvent): void => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      camX += dx;
      camY += dy;
      lastX = e.clientX;
      lastY = e.clientY;
      if (Math.abs(e.clientX - downX) > 4 || Math.abs(e.clientY - downY) > 4) {
        didDrag = true;
      }
    };

    // ── Hover preview tracking ────────────────────────────────────────────
    let hoverTile = -1;
    const onHoverMove = (e: MouseEvent): void => {
      // Track hover separately from drag
      const isDragging = dragging;
      if (!isDragging) {
        const wx = Math.floor((e.clientX - camX) / (tileSize * zoom));
        const wy = Math.floor((e.clientY - camY) / (tileSize * zoom));
        if (wx >= 0 && wx < config.mapWidth && wy >= 0 && wy < config.mapHeight) {
          hoverTile = wy * config.mapWidth + wx;
        } else {
          hoverTile = -1;
        }
      }
    };
    const onHoverLeave = (): void => {
      hoverTile = -1;
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
          logEvent(`⚔ Attacking ${target?.name ?? "enemy"}!`, "attack");
          spawnFleet(sourceTile, tile, PLAYER_COLOR);
          sfxAttack();
        } else {
          showToast("Cannot start attack right now");
        }
      } catch (err) {
        console.error("[GalacticFront] Attack failed:", err);
      }
    };

    // LEFT-click on an unowned tile adjacent to your territory to claim it.
    const onClick = (e: MouseEvent): void => {
      if (e.button !== 0) return;
      // Ignore clicks that were really drags.
      if (didDrag) {
        didDrag = false;
        return;
      }
      const tile = screenToTile(e.clientX, e.clientY);
      if (tile === null) return;

      const owner = game.map.getOwner(tile);
      const player = game.getPlayer(playerID);
      if (!player) return;

      if (owner === playerID) return;

      if (owner === 0) {
        if (!game.map.isTraversable(tile)) {
          showToast("Cannot claim asteroid fields");
          return;
        }
        const W = config.mapWidth;
        const H = config.mapHeight;
        const tx = tile % W;
        const ty = Math.floor(tile / W);
        const neighbors: number[] = [];
        if (tx > 0) neighbors.push(tile - 1);
        if (tx < W - 1) neighbors.push(tile + 1);
        if (ty > 0) neighbors.push(tile - W);
        if (ty < H - 1) neighbors.push(tile + W);
        const adjacent = neighbors.some(
          (n) => game.map.getOwner(n) === playerID,
        );

        if (!adjacent) {
          showToast("Click adjacent to your territory to expand");
          return;
        }
        if (player.troops < 10n) {
          showToast("Need 10 troops to claim tile");
          return;
        }
        player.troops -= 10n;
        if (typeof (game as any).claimTile === "function") {
          (game as any).claimTile(tile, playerID);
        } else {
          game.map.setOwner(tile, playerID);
          player.territory.add(tile);
        }
        sfxClaim();
        logEvent(`✚ Claimed tile (${player.territory.size} total)`, "capture");
      } else {
        showToast("Right-click enemy territory to attack");
      }
    };

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mouseleave", onMouseUp);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mousemove", onHoverMove);
    canvas.addEventListener("mouseleave", onHoverLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("contextmenu", onContextMenu);
    canvas.addEventListener("click", onClick);

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
      () => canvas.removeEventListener("mousemove", onHoverMove),
      () => canvas.removeEventListener("mouseleave", onHoverLeave),
      () => canvas.removeEventListener("wheel", onWheel),
      () => canvas.removeEventListener("contextmenu", onContextMenu),
      () => canvas.removeEventListener("click", onClick),
      () => window.removeEventListener("resize", onResize),
    ];

    // ── Keyboard shortcuts ───────────────────────────────────────────────
    const keyHandler = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement;
      if (target && target.tagName === "INPUT") return;

      const panAmount = 80;
      switch (e.key.toLowerCase()) {
        case "w":
        case "arrowup":
          camY += panAmount;
          e.preventDefault();
          break;
        case "s":
        case "arrowdown":
          camY -= panAmount;
          e.preventDefault();
          break;
        case "a":
        case "arrowleft":
          camX += panAmount;
          e.preventDefault();
          break;
        case "d":
        case "arrowright":
          camX -= panAmount;
          e.preventDefault();
          break;
        case "+":
        case "=": {
          const oldZ = zoom;
          zoom = Math.min(8, zoom * 1.2);
          const cx = canvas.width / 2, cy = canvas.height / 2;
          const factor = zoom / oldZ;
          camX = cx - (cx - camX) * factor;
          camY = cy - (cy - camY) * factor;
          break;
        }
        case "-":
        case "_": {
          const oldZ = zoom;
          zoom = Math.max(0.3, zoom / 1.2);
          const cx = canvas.width / 2, cy = canvas.height / 2;
          const factor = zoom / oldZ;
          camX = cx - (cx - camX) * factor;
          camY = cy - (cy - camY) * factor;
          break;
        }
        case "c": {
          const player = game.getPlayer(playerID);
          if (player && player.territory.size > 0) {
            const t = Array.from(player.territory)[0] as number;
            camX = canvas.width / 2 - (t % config.mapWidth) * tileSize * zoom;
            camY = canvas.height / 2 - Math.floor(t / config.mapWidth) * tileSize * zoom;
          }
          break;
        }
        case "e": {
          const player = game.getPlayer(playerID);
          if (!player || player.troops < 10n) break;
          for (const t of player.territory) {
            const neighbors = [t - 1, t + 1, t - config.mapWidth, t + config.mapWidth];
            const n = neighbors.find(nn => nn >= 0 && nn < config.mapWidth * config.mapHeight && game.map.isTraversable(nn) && !game.map.isOwned(nn));
            if (n !== undefined) {
              player.troops -= 10n;
              if (typeof (game as any).claimTile === "function") (game as any).claimTile(n, playerID);
              else { game.map.setOwner(n, playerID); player.territory.add(n); }
              break;
            }
          }
          break;
        }
      }
    };
    window.addEventListener("keydown", keyHandler);
    activeKeyHandler = keyHandler;

    // ── Keyboard help overlay ────────────────────────────────────────────
    const kbdHelp = document.createElement("div");
    kbdHelp.id = "kbd-help";
    kbdHelp.style.cssText = "position:fixed;bottom:20px;left:20px;background:rgba(10,10,18,0.9);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px 14px;color:#9ca3af;font-size:11px;z-index:40;line-height:1.7;";
    kbdHelp.innerHTML = `
      <div style="color:#22d3ee;font-weight:600;font-size:12px;margin-bottom:4px;">⌨ Shortcuts</div>
      <div><strong>WASD</strong> Pan · <strong>+/-</strong> Zoom</div>
      <div><strong>C</strong> Center · <strong>E</strong> Expand</div>
      <div><strong>ESC</strong> Exit</div>
    `;
    document.body.appendChild(kbdHelp);

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

    // ── Minimap ──────────────────────────────────────────────────────────
    function drawMinimap(): void {
      const mm = document.getElementById(
        "minimap-canvas",
      ) as HTMLCanvasElement | null;
      if (!mm) return;
      const mctx = mm.getContext("2d");
      if (!mctx) return;

      const w = (mm.width = 200);
      const h = (mm.height = 130);

      mctx.fillStyle = "#0a0a12";
      mctx.fillRect(0, 0, w, h);

      const sx = w / config.mapWidth;
      const sy = h / config.mapHeight;

      // Draw owned tiles as colored pixels
      for (let ty = 0; ty < config.mapHeight; ty++) {
        for (let tx = 0; tx < config.mapWidth; tx++) {
          const tile = ty * config.mapWidth + tx;
          const owner = game.map.getOwner(tile);
          if (owner !== 0) {
            mctx.fillStyle = playerColors.get(owner) ?? "#666";
            mctx.fillRect(tx * sx, ty * sy, Math.max(1, sx), Math.max(1, sy));
          }
        }
      }

      // Viewport rectangle
      const vx = (-camX / (tileSize * zoom)) * sx;
      const vy = (-camY / (tileSize * zoom)) * sy;
      const vw = (canvas.width / (tileSize * zoom)) * sx;
      const vh = (canvas.height / (tileSize * zoom)) * sy;
      mctx.strokeStyle = "#22d3ee";
      mctx.lineWidth = 1.5;
      mctx.strokeRect(vx, vy, vw, vh);
    }

    // Click-to-teleport on the minimap
    const minimapEl = document.getElementById("minimap-canvas");
    const onMinimapClick = (e: Event): void => {
      if (!minimapEl) return;
      const rect = (minimapEl as HTMLElement).getBoundingClientRect();
      const mouseEvent = e as MouseEvent;
      const x =
        ((mouseEvent.clientX - rect.left) / rect.width) * config.mapWidth;
      const y =
        ((mouseEvent.clientY - rect.top) / rect.height) * config.mapHeight;
      camX = canvas.width / 2 - x * tileSize * zoom;
      camY = canvas.height / 2 - y * tileSize * zoom;
    };
    if (minimapEl) {
      minimapEl.addEventListener("click", onMinimapClick);
      gameCleanupFns.push(() =>
        minimapEl.removeEventListener("click", onMinimapClick),
      );
    }

    // Show the minimap container during gameplay
    const minimapContainer = document.getElementById("game-minimap");
    if (minimapContainer) {
      minimapContainer.style.display = "block";
      gameCleanupFns.push(() => {
        minimapContainer.style.display = "none";
      });
    }

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

      // Glowing border around player territory (draw only edges)
      const player = game.getPlayer(playerID);
      if (player && player.isAlive) {
        ctx.strokeStyle = PLAYER_COLOR;
        ctx.lineWidth = 2;
        ctx.shadowColor = PLAYER_COLOR;
        ctx.shadowBlur = 8;
        for (const tile of player.territory) {
          const x = tile % config.mapWidth;
          const y = Math.floor(tile / config.mapWidth);
          if (x < startX || x >= endX || y < startY || y >= endY) continue;
          const sx = x * ts + camX;
          const sy = y * ts + camY;
          const up = tile - config.mapWidth;
          const down = tile + config.mapWidth;
          const left = tile - 1;
          const right = tile + 1;
          ctx.beginPath();
          if (!player.territory.has(up)) { ctx.moveTo(sx, sy); ctx.lineTo(sx + ts, sy); }
          if (!player.territory.has(down)) { ctx.moveTo(sx, sy + ts); ctx.lineTo(sx + ts, sy + ts); }
          if (!player.territory.has(left)) { ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + ts); }
          if (!player.territory.has(right)) { ctx.moveTo(sx + ts, sy); ctx.lineTo(sx + ts, sy + ts); }
          ctx.stroke();
        }
        ctx.shadowBlur = 0;

        // Capital marker
        const pt = player.capitalTile;
        const px = (pt % config.mapWidth) * ts + camX;
        const py = Math.floor(pt / config.mapWidth) * ts + camY;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.strokeRect(px - 3, py - 3, ts + 6, ts + 6);
      }

      // Hover preview
      if (hoverTile >= 0) {
        const tx = hoverTile % config.mapWidth;
        const ty = Math.floor(hoverTile / config.mapWidth);
        const sx = tx * ts + camX;
        const sy = ty * ts + camY;
        const owner = game.map.getOwner(hoverTile);
        const hoverPlayer = game.getPlayer(playerID);

        if (owner === 0 && hoverPlayer) {
          // Check if adjacent to player territory
          const neighbors = [
            hoverTile - 1,
            hoverTile + 1,
            hoverTile - config.mapWidth,
            hoverTile + config.mapWidth,
          ];
          const adjacent = neighbors.some(
            (n) =>
              n >= 0 &&
              n < config.mapWidth * config.mapHeight &&
              hoverPlayer.territory.has(n),
          );
          if (adjacent) {
            ctx.strokeStyle = "#10b981";
            ctx.lineWidth = 2;
            ctx.fillStyle = "rgba(16,185,129,0.25)";
            ctx.fillRect(sx, sy, ts, ts);
            ctx.strokeRect(sx, sy, ts, ts);
            // Tooltip text
            ctx.fillStyle = "#10b981";
            ctx.font = "bold 12px system-ui";
            ctx.fillText("CLICK TO CLAIM (10)", sx + ts + 4, sy + 12);
          }
        } else if (owner !== 0 && owner !== playerID) {
          ctx.strokeStyle = "#ef4444";
          ctx.lineWidth = 2;
          ctx.fillStyle = "rgba(239,68,68,0.25)";
          ctx.fillRect(sx, sy, ts, ts);
          ctx.strokeRect(sx, sy, ts, ts);
          const enemy = game.getPlayer(owner);
          if (enemy) {
            ctx.fillStyle = "#ef4444";
            ctx.font = "bold 12px system-ui";
            ctx.fillText(
              `RIGHT-CLICK to ATTACK ${enemy.name}`,
              sx + ts + 4,
              sy + 12,
            );
          }
        }
      }

      // Fleet particles — animate triangle "ships" flying between tiles
      for (let i = fleetParticles.length - 1; i >= 0; i--) {
        const f = fleetParticles[i]!;
        f.age++;
        if (f.age > f.maxAge) {
          fleetParticles.splice(i, 1);
          continue;
        }
        if (f.age < 0) continue;
        const t = f.age / f.maxAge;
        const x = (f.fromX + (f.toX - f.fromX) * t) * ts + camX;
        const y = (f.fromY + (f.toY - f.fromY) * t) * ts + camY;
        const angle = Math.atan2(f.toY - f.fromY, f.toX - f.fromX);

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillStyle = f.color;
        ctx.shadowColor = f.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.moveTo(6, 0);
        ctx.lineTo(-3, -3);
        ctx.lineTo(-3, 3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.shadowBlur = 0;

      // Leaderboard
      drawLeaderboard(ctx, w);

      // Minimap (throttled for performance)
      if (frameCount % 10 === 0) drawMinimap();

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
      '🖱 <strong style="color:#e0e0e0;">Drag</strong> map to pan · ' +
      '🔍 <strong style="color:#e0e0e0;">Scroll</strong> to zoom<br>' +
      '👈 <strong style="color:#6ee7b7;">LEFT-click</strong> adjacent to your territory to ' +
      '<strong style="color:#6ee7b7;">EXPAND</strong> · ' +
      '⚔️ <strong style="color:#fca5a5;">RIGHT-click</strong> enemy territory to ' +
      '<strong style="color:#fca5a5;">ATTACK</strong><br>' +
      '⎋ <strong style="color:#e0e0e0;">ESC</strong> to exit' +
      "</div>" +
      '<div style="margin-top:8px;font-size:11px;color:#6b7280;">' +
      'Your color is <span style="color:#22d3ee;font-weight:600;">cyan</span>. ' +
      "Click adjacent tiles to expand your empire — Conquer the galaxy!</div>";
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

    const soundBtn = document.createElement("button");
    soundBtn.textContent = soundEnabled ? "🔊" : "🔇";
    soundBtn.title = "Toggle sound";
    soundBtn.style.cssText = "padding:6px 10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#9ca3af;cursor:pointer;font-size:14px;margin-left:8px;";
    soundBtn.onclick = () => { soundBtn.textContent = toggleSound() ? "🔊" : "🔇"; };
    hud?.appendChild(soundBtn);

    // ── Game tick loop ───────────────────────────────────────────────────
    let turnCount = 0;
    activeGameSnapshot = () => {
      const playerRef = game.getPlayer(playerID);
      const territoryCount = playerRef ? playerRef.territoryCount : 0;
      const kills = aiPlayers.filter((id) => {
        const p = game.getPlayer(id);
        return !p || !p.isAlive;
      }).length;
      return { turns: turnCount, territory: territoryCount, kills };
    };
    gameLoopInterval = setInterval(() => {
      if (runner.isGameOver()) {
        if (gameLoopInterval !== null) {
          clearInterval(gameLoopInterval);
          gameLoopInterval = null;
        }
        const winnerID = game.winnerID;
        const winner = winnerID !== null ? game.getPlayer(winnerID) : null;
        const playerRef = game.getPlayer(playerID);
        const territoryCount = playerRef ? playerRef.territoryCount : 0;
        const kills = aiPlayers.filter((id) => {
          const p = game.getPlayer(id);
          return !p || !p.isAlive;
        }).length;

        if (winner && winner.id === playerID) {
          trackGameResult("victory", {
            turns: turnCount,
            territory: territoryCount,
            kills,
          });
          showToast("Victory! You conquered the galaxy.");
          sfxVictory();
        } else if (winner) {
          trackGameResult("defeat", {
            turns: turnCount,
            territory: territoryCount,
            kills,
          });
          showToast(`Defeat — ${winner.name} wins.`);
          sfxDefeat();
        } else {
          trackGameResult("defeat", {
            turns: turnCount,
            territory: territoryCount,
            kills,
          });
          showToast("Game over.");
          sfxDefeat();
        }
        gameRecorded = true;
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
            const attack = game.startAttack(aiID, target.id, sourceTile, 0.3);
            if (attack && target.territory.size > 0) {
              const targetTile = target.territory.values().next()
                .value as number;
              const aiColor =
                playerColors.get(aiID) ?? AI_COLORS[0]!;
              spawnFleet(sourceTile, targetTile, aiColor);
              // Notify player when an AI specifically attacks them
              if (target.id === playerID) {
                logEvent(`⚠ ${ai.name} attacks you!`, "warning");
              }
            }
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

    logEvent("🌌 Your empire rises! Conquer the galaxy.", "info");

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
  if (!gameRecorded && activeRunner !== null && activeGameSnapshot !== null) {
    try {
      trackGameResult("abandoned", activeGameSnapshot());
    } catch {
      // ignore — best-effort tracking
    }
    gameRecorded = true;
  }
  activeGameSnapshot = null;

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

  if (activeKeyHandler) {
    window.removeEventListener("keydown", activeKeyHandler);
    activeKeyHandler = null;
  }

  const hud = document.getElementById("game-hud");
  if (hud) hud.style.display = "none";
  const exitBtn = document.getElementById("btn-exit-game");
  if (exitBtn) exitBtn.style.display = "none";

  if (activeCanvas) {
    activeCanvas.remove();
    activeCanvas = null;
  }

  document.getElementById("game-help")?.remove();
  document.getElementById("kbd-help")?.remove();

  const events = document.getElementById("game-events");
  if (events) events.innerHTML = "";

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

// ── Stats / local leaderboard ────────────────────────────────────────────────

function trackGameResult(
  result: "victory" | "defeat" | "abandoned",
  stats: { turns: number; territory: number; kills: number },
): void {
  const games = JSON.parse(localStorage.getItem("gf_games") || "[]");
  games.push({
    timestamp: Date.now(),
    result,
    ...stats,
  });
  // Keep last 50 games
  if (games.length > 50) games.shift();
  localStorage.setItem("gf_games", JSON.stringify(games));
}

function showStatsModal(): void {
  const overlay = document.getElementById("modal-wip");
  const box = overlay?.querySelector(".modal-box");
  if (!overlay || !box) return;

  const games = JSON.parse(localStorage.getItem("gf_games") || "[]");
  const wins = games.filter((g: any) => g.result === "victory").length;
  const losses = games.filter((g: any) => g.result === "defeat").length;
  const total = games.length;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
  const totalTurns = games.reduce((s: number, g: any) => s + g.turns, 0);
  const totalKills = games.reduce(
    (s: number, g: any) => s + (g.kills || 0),
    0,
  );

  (box as HTMLElement).style.maxWidth = "500px";
  box.innerHTML = `
    <h3>📊 Your Stats</h3>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:20px 0;">
      <div style="background:rgba(34,211,238,0.1);border:1px solid rgba(34,211,238,0.3);padding:12px;border-radius:8px;">
        <div style="font-size:11px;color:#22d3ee;text-transform:uppercase;letter-spacing:1px;">Games</div>
        <div style="font-size:24px;font-weight:800;color:#22d3ee;">${total}</div>
      </div>
      <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);padding:12px;border-radius:8px;">
        <div style="font-size:11px;color:#10b981;text-transform:uppercase;letter-spacing:1px;">Wins</div>
        <div style="font-size:24px;font-weight:800;color:#10b981;">${wins}</div>
      </div>
      <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);padding:12px;border-radius:8px;">
        <div style="font-size:11px;color:#ef4444;text-transform:uppercase;letter-spacing:1px;">Win Rate</div>
        <div style="font-size:24px;font-weight:800;color:#ef4444;">${winRate}%</div>
      </div>
    </div>
    <div style="background:rgba(255,255,255,0.04);padding:12px;border-radius:8px;margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;color:#9ca3af;font-size:13px;margin-bottom:4px;">
        <span>Total turns played</span>
        <span style="color:#e0e0e0;font-weight:600;">${totalTurns.toLocaleString()}</span>
      </div>
      <div style="display:flex;justify-content:space-between;color:#9ca3af;font-size:13px;">
        <span>Empires defeated</span>
        <span style="color:#e0e0e0;font-weight:600;">${totalKills}</span>
      </div>
    </div>
    ${
      total === 0
        ? '<p style="color:#6b7280;font-size:14px;text-align:center;padding:20px 0;">Play a game to see your stats!</p>'
        : `
    <div style="max-height:200px;overflow-y:auto;background:rgba(255,255,255,0.02);border-radius:8px;padding:8px;">
      ${games
        .slice()
        .reverse()
        .slice(0, 10)
        .map(
          (g: any) => `
        <div style="display:flex;justify-content:space-between;padding:8px;border-bottom:1px solid rgba(255,255,255,0.05);font-size:12px;">
          <span style="color:${g.result === "victory" ? "#10b981" : g.result === "defeat" ? "#ef4444" : "#9ca3af"};font-weight:600;text-transform:uppercase;">${g.result}</span>
          <span style="color:#6b7280;">${new Date(g.timestamp).toLocaleDateString()}</span>
          <span style="color:#9ca3af;">${g.turns} turns</span>
        </div>
      `,
        )
        .join("")}
    </div>`
    }
    <button class="modal-close" id="modal-wip-close" style="margin-top:16px;">Close</button>
  `;

  // losses isn't displayed but is computed for potential future surfaces
  void losses;

  document
    .getElementById("modal-wip-close")
    ?.addEventListener("click", () => overlay.classList.remove("visible"));
  overlay.classList.add("visible");
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

  document.getElementById("nav-leaderboard")?.addEventListener("click", (e) => {
    e.preventDefault();
    showStatsModal();
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
      "Game settings are coming soon. Sound, music, and keybind customization will be configurable here.",
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
