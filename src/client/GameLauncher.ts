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
import { TribeExecution } from "@core/execution/TribeExecution";
import type { GameImpl } from "@core/game/GameImpl";
import type { GameConfig } from "@core/Schemas";
import { PlayerType, Difficulty } from "@core/game/Types";
import { PseudoRandom } from "@core/PseudoRandom";
import { SimpleRenderer } from "./SimpleRenderer";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LaunchConfig {
  difficulty: string;
  mapSize: string; // "sector" | "arm" | "galaxy"
  aiCount: number;
}

interface AIEntry {
  playerID: number;
  ai: TribeExecution;
}

const MAP_SIZES: Record<string, { w: number; h: number }> = {
  sector: { w: 100, h: 100 },
  arm: { w: 200, h: 200 },
  galaxy: { w: 400, h: 400 },
};

const AI_NAMES: string[] = [
  "Zoltan",
  "Xarith",
  "Vek'tar",
  "Nexari",
  "Prython",
  "Kelmora",
  "Draxxis",
  "Ulvani",
  "Gravon",
  "Typhex",
  "Syndara",
  "Crythan",
];

const TICK_INTERVAL_MS = 100;

// ─── GameLauncher ────────────────────────────────────────────────────────────

export class GameLauncher {
  private runner: GameRunner | null = null;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private renderer: SimpleRenderer | null = null;
  private aiEntries: AIEntry[] = [];
  private humanPlayerID: number | null = null;

  /**
   * Launch a singleplayer game.
   *
   * 1. Build GameConfig from LaunchConfig
   * 2. Create GameRunner + ExecutionManager
   * 3. Generate map (done in GameImpl constructor)
   * 4. Spawn human + AI players
   * 5. Start tick loop
   */
  launch(config: LaunchConfig, canvas: HTMLCanvasElement): void {
    this.stop();

    const size = MAP_SIZES[config.mapSize] ?? MAP_SIZES["sector"]!;
    const totalPlayers = 1 + config.aiCount;
    const seed = `sp-${Date.now()}`;

    const gameConfig: GameConfig = {
      gameID: `local-${Date.now()}` as GameConfig["gameID"],
      mapWidth: size.w,
      mapHeight: size.h,
      maxPlayers: totalPlayers + 2, // headroom
      seed,
      ticksPerTurn: 1,
      turnIntervalMs: TICK_INTERVAL_MS,
      gameMapType: "Standard",
      difficulty: config.difficulty,
    };

    // 1. Create runner (map is generated inside GameImpl constructor)
    this.runner = new GameRunner(gameConfig);
    const game = this.runner.game;

    // 2. Create ExecutionManager and register all intent handlers
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

    // Wire intent handler into runner
    this.runner.setIntentHandler(execManager.createIntentHandler());

    // 3. Spawn human player at a random valid tile
    const rng = new PseudoRandom(seed);
    const humanTile = this.findSpawnTile(game, rng);
    this.humanPlayerID = game.spawnPlayer("Commander", humanTile) as number;

    // 4. Spawn AI players
    this.aiEntries = [];
    const aiInterval = this.difficultyToInterval(config.difficulty);

    for (let i = 0; i < config.aiCount; i++) {
      const name = AI_NAMES[i % AI_NAMES.length]!;
      const tile = this.findSpawnTile(game, rng);
      const aiID = game.spawnPlayer(name, tile) as number;

      const tribe = new TribeExecution(rng, aiInterval);
      this.aiEntries.push({ playerID: aiID, ai: tribe });
    }

    // 5. Set up renderer
    canvas.width = canvas.clientWidth * (window.devicePixelRatio || 1);
    canvas.height = canvas.clientHeight * (window.devicePixelRatio || 1);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2D canvas context");
    this.renderer = new SimpleRenderer(canvas, ctx);

    // 6. Start tick loop
    let tickCount = 0;
    this.tickInterval = setInterval(() => {
      if (!this.runner || this.runner.isGameOver()) {
        this.stop();
        return;
      }

      tickCount++;

      // Run AI behaviors
      for (const entry of this.aiEntries) {
        entry.ai.tick(game, entry.playerID, tickCount);
      }

      // Process one turn
      this.runner.processTurn();

      // Render
      this.renderer?.render(game);
    }, TICK_INTERVAL_MS);

    // Initial render
    this.renderer.render(game);
  }

  /** Stop the game loop and clean up. */
  stop(): void {
    if (this.tickInterval !== null) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    this.runner = null;
    this.renderer = null;
    this.aiEntries = [];
    this.humanPlayerID = null;
  }

  /** Returns true if the game tick loop is active. */
  isRunning(): boolean {
    return this.tickInterval !== null;
  }

  /** Returns the underlying GameImpl if running, else null. */
  getGame(): GameImpl | null {
    return this.runner?.game ?? null;
  }

  /** Returns the human player's ID, or null if not launched. */
  getHumanPlayerID(): number | null {
    return this.humanPlayerID;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Find a random traversable, unowned tile suitable for spawning.
   * Tries up to 1000 random tiles, then falls back to linear scan.
   */
  private findSpawnTile(game: GameImpl, rng: PseudoRandom): number {
    const map = game.map;
    const total = map.width * map.height;

    // Random probing
    for (let attempt = 0; attempt < 1000; attempt++) {
      const tile = rng.nextInt(0, total - 1);
      if (map.isTraversable(tile) && !map.isOwned(tile)) {
        // Ensure some distance from edges
        const { x, y } = map.fromIndex(tile);
        if (x > 3 && x < map.width - 3 && y > 3 && y < map.height - 3) {
          return tile;
        }
      }
    }

    // Fallback: linear scan
    for (let i = 0; i < total; i++) {
      if (map.isTraversable(i) && !map.isOwned(i)) {
        return i;
      }
    }

    return Math.floor(total / 2); // absolute fallback
  }

  /** Map difficulty string to AI tick interval (lower = harder). */
  private difficultyToInterval(difficulty: string): number {
    switch (difficulty) {
      case Difficulty.Easy:
        return 120;
      case Difficulty.Medium:
        return 60;
      case Difficulty.Hard:
        return 30;
      case Difficulty.Impossible:
        return 15;
      default:
        return 60;
    }
  }
}
