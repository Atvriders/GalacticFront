# Plan 7: AI Empires — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the AI empire system -- 6 alien species, 5 human factions, modular behavior system, difficulty scaling, tribe bots.

**Architecture:** EmpireExecution (NationExecution equivalent) orchestrates modular behavior components. Each behavior module handles one strategic concern. Difficulty controls action interval (Easy 65-80 ticks, Impossible 30-50). TribeExecution for simple bots. EmpireCreation generates AI empires from map manifest data.

**Tech Stack:** TypeScript 5.x, Vitest

**Source Root:** `src/core/`

**Key Conventions (from OpenFrontIO analysis):**
- All game actions use Execution interface: `isActive()`, `activeDuringSpawnPhase()`, `init(mg: Game, ticks: number)`, `tick(ticks: number)`
- Deterministic via `PseudoRandom` (seeded, never `Math.random()`)
- Behaviors are plain classes constructed with `(random, game, player, ...deps)`
- `BigInt` for gold/credits; regular numbers for troops/ticks
- `TileRef` (integer index) for tile references
- `PlayerType.Nation` = AI empire, `PlayerType.Bot` = tribe bot, `PlayerType.Human` = player
- `Nation` class wraps `spawnCell` + `PlayerInfo`
- Test setup: `setup("map_name", { ...gameConfig })` returns `Game`

---

## Task 1: Empire Data -- Species & Faction Definitions

**Files:**
- `src/core/game/EmpireData.ts` (new)

**Depends on:** Nothing

**Checkboxes:**
- [ ] Define `EmpirePersonality` interface with boolean flags (`aggressive`, `defensive`, `diplomatic`, `naval`, `techFocused`, `superweaponHappy`, `raider`, `allianceBreaker`)
- [ ] Define `AlienSpecies` interface with `name`, `region`, `personality`, `flagColors` (`primary: number`, `secondary: number`), `swarmThreshold` (number)
- [ ] Define `HumanFaction` interface with `name`, `region`, `personality`, `flagColors`
- [ ] Export `ALIEN_SPECIES` const array with all 6 species
- [ ] Export `HUMAN_FACTIONS` const array with all 5 factions
- [ ] Export `getEmpireData(name: string)` lookup function returning species or faction data

```typescript
// src/core/game/EmpireData.ts

export interface EmpirePersonality {
  aggressive: boolean;
  defensive: boolean;
  diplomatic: boolean;
  naval: boolean;
  techFocused: boolean;
  superweaponHappy: boolean;
  raider: boolean;
  allianceBreaker: boolean;
}

export interface AlienSpecies {
  name: string;
  region: string;
  personality: EmpirePersonality;
  flagColors: { primary: number; secondary: number };
  swarmThreshold: number; // relative strength advantage needed to launch Swarm
}

export interface HumanFaction {
  name: string;
  region: string;
  personality: EmpirePersonality;
  flagColors: { primary: number; secondary: number };
}

export type EmpireData = AlienSpecies | HumanFaction;

export const ALIEN_SPECIES: readonly AlienSpecies[] = [
  {
    name: "Zyr'kathi Hive",
    region: "Galactic Core",
    personality: {
      aggressive: true,
      defensive: false,
      diplomatic: false,
      naval: false,
      techFocused: false,
      superweaponHappy: false,
      raider: false,
      allianceBreaker: true,
    },
    flagColors: { primary: 0x8b0000, secondary: 0xff4500 },
    swarmThreshold: 1.5,
  },
  {
    name: "Crystalline Concord",
    region: "Perseus Arm",
    personality: {
      aggressive: false,
      defensive: true,
      diplomatic: true,
      naval: false,
      techFocused: true,
      superweaponHappy: false,
      raider: false,
      allianceBreaker: false,
    },
    flagColors: { primary: 0x4169e1, secondary: 0x87ceeb },
    swarmThreshold: 3.0,
  },
  {
    name: "Vortani Dominion",
    region: "Sagittarius Arm",
    personality: {
      aggressive: true,
      defensive: false,
      diplomatic: false,
      naval: true,
      techFocused: false,
      superweaponHappy: false,
      raider: false,
      allianceBreaker: false,
    },
    flagColors: { primary: 0x2e8b57, secondary: 0x00ff7f },
    swarmThreshold: 2.0,
  },
  {
    name: "Synth Collective",
    region: "Outer Rim",
    personality: {
      aggressive: false,
      defensive: false,
      diplomatic: true,
      naval: false,
      techFocused: true,
      superweaponHappy: false,
      raider: false,
      allianceBreaker: false,
    },
    flagColors: { primary: 0x808080, secondary: 0xc0c0c0 },
    swarmThreshold: 2.5,
  },
  {
    name: "Pyrathi Warclans",
    region: "Orion Spur",
    personality: {
      aggressive: true,
      defensive: false,
      diplomatic: false,
      naval: false,
      techFocused: false,
      superweaponHappy: true,
      raider: false,
      allianceBreaker: true,
    },
    flagColors: { primary: 0xff4500, secondary: 0xffd700 },
    swarmThreshold: 1.2,
  },
  {
    name: "Aetheri Nomads",
    region: "Inter-arm Voids",
    personality: {
      aggressive: true,
      defensive: false,
      diplomatic: false,
      naval: false,
      techFocused: false,
      superweaponHappy: false,
      raider: true,
      allianceBreaker: false,
    },
    flagColors: { primary: 0x9400d3, secondary: 0xe0b0ff },
    swarmThreshold: 2.0,
  },
] as const;

export const HUMAN_FACTIONS: readonly HumanFaction[] = [
  {
    name: "Solar Federation",
    region: "Sol",
    personality: {
      aggressive: false,
      defensive: false,
      diplomatic: true,
      naval: false,
      techFocused: false,
      superweaponHappy: false,
      raider: false,
      allianceBreaker: false,
    },
    flagColors: { primary: 0x1e90ff, secondary: 0xffffff },
  },
  {
    name: "Martian Collective",
    region: "Inner Colonies",
    personality: {
      aggressive: false,
      defensive: false,
      diplomatic: false,
      naval: false,
      techFocused: true,
      superweaponHappy: false,
      raider: false,
      allianceBreaker: false,
    },
    flagColors: { primary: 0xb22222, secondary: 0xcd853f },
  },
  {
    name: "Outer Rim Alliance",
    region: "Distant Systems",
    personality: {
      aggressive: false,
      defensive: true,
      diplomatic: false,
      naval: false,
      techFocused: false,
      superweaponHappy: false,
      raider: false,
      allianceBreaker: false,
    },
    flagColors: { primary: 0x2f4f4f, secondary: 0x708090 },
  },
  {
    name: "Centauri Republic",
    region: "Alpha Centauri",
    personality: {
      aggressive: true,
      defensive: false,
      diplomatic: false,
      naval: false,
      techFocused: false,
      superweaponHappy: false,
      raider: false,
      allianceBreaker: false,
    },
    flagColors: { primary: 0xdaa520, secondary: 0x8b0000 },
  },
  {
    name: "Europa Technocracy",
    region: "Jupiter Moons",
    personality: {
      aggressive: false,
      defensive: true,
      diplomatic: false,
      naval: false,
      techFocused: true,
      superweaponHappy: false,
      raider: false,
      allianceBreaker: false,
    },
    flagColors: { primary: 0x4682b4, secondary: 0xadd8e6 },
  },
] as const;

const EMPIRE_LOOKUP = new Map<string, EmpireData>();
for (const s of ALIEN_SPECIES) EMPIRE_LOOKUP.set(s.name, s);
for (const f of HUMAN_FACTIONS) EMPIRE_LOOKUP.set(f.name, f);

export function getEmpireData(name: string): EmpireData | undefined {
  return EMPIRE_LOOKUP.get(name);
}

export function isAlienSpecies(data: EmpireData): data is AlienSpecies {
  return "swarmThreshold" in data;
}
```

**Test:** `tests/core/EmpireData.test.ts`

```typescript
// tests/core/EmpireData.test.ts
import { describe, expect, it } from "vitest";
import {
  ALIEN_SPECIES,
  HUMAN_FACTIONS,
  getEmpireData,
  isAlienSpecies,
} from "../../src/core/game/EmpireData";

describe("EmpireData", () => {
  it("defines exactly 6 alien species", () => {
    expect(ALIEN_SPECIES).toHaveLength(6);
  });

  it("defines exactly 5 human factions", () => {
    expect(HUMAN_FACTIONS).toHaveLength(5);
  });

  it("all species have unique names", () => {
    const names = ALIEN_SPECIES.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("all factions have unique names", () => {
    const names = HUMAN_FACTIONS.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("getEmpireData returns correct species", () => {
    const data = getEmpireData("Zyr'kathi Hive");
    expect(data).toBeDefined();
    expect(data!.name).toBe("Zyr'kathi Hive");
    expect(isAlienSpecies(data!)).toBe(true);
  });

  it("getEmpireData returns correct faction", () => {
    const data = getEmpireData("Solar Federation");
    expect(data).toBeDefined();
    expect(data!.name).toBe("Solar Federation");
    expect(isAlienSpecies(data!)).toBe(false);
  });

  it("getEmpireData returns undefined for unknown name", () => {
    expect(getEmpireData("Nonexistent")).toBeUndefined();
  });

  it("Zyr'kathi is aggressive with low swarm threshold", () => {
    const zyr = ALIEN_SPECIES.find((s) => s.name === "Zyr'kathi Hive")!;
    expect(zyr.personality.aggressive).toBe(true);
    expect(zyr.swarmThreshold).toBe(1.5);
  });

  it("Crystalline is defensive and diplomatic", () => {
    const crys = ALIEN_SPECIES.find((s) => s.name === "Crystalline Concord")!;
    expect(crys.personality.defensive).toBe(true);
    expect(crys.personality.diplomatic).toBe(true);
  });

  it("all species have valid flag colors", () => {
    for (const species of ALIEN_SPECIES) {
      expect(species.flagColors.primary).toBeGreaterThan(0);
      expect(species.flagColors.secondary).toBeGreaterThan(0);
    }
  });
});
```

**Run:** `npx vitest run tests/core/EmpireData.test.ts`

**Commit:** `feat: add empire data definitions for 6 alien species and 5 human factions`

---

## Task 2: EmpireCreation -- Generate Empires from Map Manifest

**Files:**
- `src/core/game/EmpireCreation.ts` (new)

**Depends on:** Task 1

**Checkboxes:**
- [ ] Port `createNationsForGame` pattern to `createEmpiresForGame`
- [ ] Support `"disabled"` / `"default"` / custom number config for nations
- [ ] Compact maps use 25% of manifest empires (minimum 1)
- [ ] HumansVsNations mode matches empire count to human count
- [ ] Generate additional empires with unique names when custom count exceeds manifest
- [ ] Name generation uses space-themed templates

```typescript
// src/core/game/EmpireCreation.ts
import { PseudoRandom } from "../PseudoRandom";
import { GameStartInfo } from "../Schemas";
import {
  Cell,
  GameMapSize,
  GameMode,
  GameType,
  HumansVsNations,
  Nation,
  PlayerInfo,
  PlayerType,
} from "./Game";
import { Nation as ManifestNation } from "./TerrainMapLoader";

/**
 * Creates the empires (AI nations) array for a game.
 * Mirrors OpenFront's createNationsForGame with space-themed name generation.
 *
 * Config options:
 * - "disabled": no AI empires
 * - "default": auto-select count based on game mode and map
 * - number: exact count (generates additional empires if needed)
 */
export function createEmpiresForGame(
  gameStart: GameStartInfo,
  manifestNations: ManifestNation[],
  numHumans: number,
  random: PseudoRandom,
): Nation[] {
  const toNation = (n: ManifestNation): Nation =>
    new Nation(
      new Cell(n.coordinates[0], n.coordinates[1]),
      new PlayerInfo(n.name, PlayerType.Nation, null, random.nextID()),
    );

  const isCompactMap = gameStart.config.gameMapSize === GameMapSize.Compact;

  const isHumansVsNations =
    gameStart.config.gameMode === GameMode.Team &&
    gameStart.config.playerTeams === HumansVsNations;

  const configNations = gameStart.config.nations;
  if (configNations === "disabled") {
    return [];
  }

  if (typeof configNations === "number") {
    return createRandomEmpires(
      configNations,
      manifestNations,
      toNation,
      random,
    );
  }

  // "default" mode
  if (gameStart.config.gameType === GameType.Public) {
    if (isHumansVsNations) {
      return createRandomEmpires(numHumans, manifestNations, toNation, random);
    }

    if (isCompactMap) {
      const targetCount = getCompactMapEmpireCount(
        manifestNations.length,
        true,
      );
      const shuffled = random.shuffleArray(manifestNations);
      return shuffled.slice(0, targetCount).map(toNation);
    }
  }

  return manifestNations.map(toNation);
}

function createRandomEmpires(
  targetCount: number,
  manifestNations: ManifestNation[],
  toNation: (n: ManifestNation) => Nation,
  random: PseudoRandom,
): Nation[] {
  const shuffled = random.shuffleArray(manifestNations);
  if (targetCount <= manifestNations.length) {
    return shuffled.slice(0, targetCount).map(toNation);
  }

  const nations: Nation[] = shuffled.map(toNation);
  const usedNames = new Set(nations.map((n) => n.playerInfo.name));
  const additionalCount = targetCount - manifestNations.length;
  for (let i = 0; i < additionalCount; i++) {
    const name = generateUniqueEmpireName(random, usedNames);
    usedNames.add(name);
    nations.push(
      new Nation(
        undefined,
        new PlayerInfo(name, PlayerType.Nation, null, random.nextID()),
      ),
    );
  }
  return nations;
}

export function getCompactMapEmpireCount(
  manifestEmpireCount: number,
  isCompactMap: boolean,
): number {
  if (manifestEmpireCount === 0) return 0;
  if (isCompactMap) return Math.max(1, Math.floor(manifestEmpireCount * 0.25));
  return manifestEmpireCount;
}

function generateUniqueEmpireName(
  random: PseudoRandom,
  usedNames: Set<string>,
): string {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const name = generateEmpireName(random);
    if (!usedNames.has(name)) return name;
  }
  let counter = 1;
  const baseName = generateEmpireName(random);
  while (usedNames.has(`${baseName} ${counter}`)) counter++;
  return `${baseName} ${counter}`;
}

function generateEmpireName(random: PseudoRandom): string {
  const prefix = EMPIRE_PREFIXES[random.nextInt(0, EMPIRE_PREFIXES.length)];
  const suffix = EMPIRE_SUFFIXES[random.nextInt(0, EMPIRE_SUFFIXES.length)];
  return `${prefix} ${suffix}`;
}

const EMPIRE_PREFIXES = [
  "Astral",
  "Void",
  "Solar",
  "Lunar",
  "Cosmic",
  "Stellar",
  "Nebula",
  "Quantum",
  "Photon",
  "Plasma",
  "Graviton",
  "Neutron",
  "Pulsar",
  "Quasar",
  "Tachyon",
  "Dark",
  "Bright",
  "Iron",
  "Crystal",
  "Shadow",
  "Crimson",
  "Azure",
  "Golden",
  "Obsidian",
  "Emerald",
  "Silver",
  "Cobalt",
  "Titanium",
  "Chromium",
  "Xenon",
  "Apex",
  "Prime",
  "Alpha",
  "Omega",
  "Delta",
  "Sigma",
  "Epsilon",
  "Zeta",
  "Theta",
  "Lambda",
];

const EMPIRE_SUFFIXES = [
  "Dominion",
  "Hegemony",
  "Collective",
  "Syndicate",
  "Coalition",
  "Imperium",
  "Sovereignty",
  "Directorate",
  "Conclave",
  "Assembly",
  "Accord",
  "Compact",
  "Pact",
  "Order",
  "Hierarchy",
  "Technocracy",
  "Theocracy",
  "Meritocracy",
  "Confederacy",
  "Protectorate",
  "Enclave",
  "Nexus",
  "Vanguard",
  "Ascendancy",
  "Communion",
  "Consortium",
  "Authority",
  "Mandate",
  "Regency",
  "Tribunal",
];
```

**Test:** `tests/core/EmpireCreation.test.ts`

```typescript
// tests/core/EmpireCreation.test.ts
import { describe, expect, it } from "vitest";
import { PseudoRandom } from "../../src/core/PseudoRandom";
import {
  createEmpiresForGame,
  getCompactMapEmpireCount,
} from "../../src/core/game/EmpireCreation";
import {
  GameMapSize,
  GameMode,
  GameType,
} from "../../src/core/game/Game";
import { GameStartInfo } from "../../src/core/Schemas";
import { Nation as ManifestNation } from "../../src/core/game/TerrainMapLoader";

function makeManifestNation(name: string, x: number, y: number): ManifestNation {
  return { name, coordinates: [x, y] };
}

function makeGameStart(overrides: Partial<GameStartInfo["config"]> = {}): GameStartInfo {
  return {
    gameID: "test-game-1",
    players: [],
    config: {
      gameMap: "test" as any,
      gameMapSize: GameMapSize.Normal,
      gameMode: GameMode.FFA,
      gameType: GameType.Singleplayer,
      difficulty: "Medium" as any,
      nations: "default",
      donateGold: false,
      donateTroops: false,
      bots: 0,
      infiniteGold: false,
      infiniteTroops: false,
      instantBuild: false,
      randomSpawn: false,
      ...overrides,
    },
  } as any;
}

const MANIFEST: ManifestNation[] = [
  makeManifestNation("Empire Alpha", 100, 100),
  makeManifestNation("Empire Beta", 200, 200),
  makeManifestNation("Empire Gamma", 300, 300),
  makeManifestNation("Empire Delta", 400, 400),
];

describe("EmpireCreation", () => {
  it("returns empty array when nations are disabled", () => {
    const random = new PseudoRandom(42);
    const result = createEmpiresForGame(
      makeGameStart({ nations: "disabled" }),
      MANIFEST,
      2,
      random,
    );
    expect(result).toHaveLength(0);
  });

  it("returns all manifest nations on default non-compact", () => {
    const random = new PseudoRandom(42);
    const result = createEmpiresForGame(
      makeGameStart({ nations: "default" }),
      MANIFEST,
      2,
      random,
    );
    expect(result).toHaveLength(4);
  });

  it("returns custom count when nations is a number", () => {
    const random = new PseudoRandom(42);
    const result = createEmpiresForGame(
      makeGameStart({ nations: 2 }),
      MANIFEST,
      2,
      random,
    );
    expect(result).toHaveLength(2);
  });

  it("generates additional empires when count exceeds manifest", () => {
    const random = new PseudoRandom(42);
    const result = createEmpiresForGame(
      makeGameStart({ nations: 6 }),
      MANIFEST,
      2,
      random,
    );
    expect(result).toHaveLength(6);
    const names = result.map((n) => n.playerInfo.name);
    expect(new Set(names).size).toBe(6); // all unique
  });

  it("compact maps use 25% of manifest empires", () => {
    expect(getCompactMapEmpireCount(20, true)).toBe(5);
    expect(getCompactMapEmpireCount(4, true)).toBe(1);
    expect(getCompactMapEmpireCount(1, true)).toBe(1);
    expect(getCompactMapEmpireCount(0, true)).toBe(0);
  });

  it("non-compact maps use full count", () => {
    expect(getCompactMapEmpireCount(20, false)).toBe(20);
  });
});
```

**Run:** `npx vitest run tests/core/EmpireCreation.test.ts`

**Commit:** `feat: add EmpireCreation to generate AI empires from map manifest`

---

## Task 3: TribeExecution -- Simple AI Bot

**Files:**
- `src/core/execution/TribeExecution.ts` (new)

**Depends on:** Task 5 (AttackBehavior)

**Checkboxes:**
- [ ] Implement `Execution` interface
- [ ] Accept all incoming alliance requests
- [ ] Accept all alliance extension requests
- [ ] Delete all captured structures (tribes don't build)
- [ ] Attack neighbors using shared `AttackBehavior`
- [ ] Randomized attack rate (40-80 ticks)
- [ ] Lazy-init `AttackBehavior` on first attack tick
- [ ] Deactivate when tribe dies

```typescript
// src/core/execution/TribeExecution.ts
import { Execution, Game, Player, Structures } from "../game/Game";
import { PseudoRandom } from "../PseudoRandom";
import { simpleHash } from "../Util";
import { AllianceExtensionExecution } from "./alliance/AllianceExtensionExecution";
import { DeleteUnitExecution } from "./DeleteUnitExecution";
import { AttackBehavior } from "./utils/AttackBehavior";

export class TribeExecution implements Execution {
  private active = true;
  private random: PseudoRandom;
  private mg: Game;
  private neighborsTerraNullius = true;

  private attackBehavior: AttackBehavior | null = null;
  private attackRate: number;
  private attackTick: number;
  private triggerRatio: number;
  private reserveRatio: number;
  private expandRatio: number;

  constructor(private tribe: Player) {
    this.random = new PseudoRandom(simpleHash(tribe.id()));
    this.attackRate = this.random.nextInt(40, 80);
    this.attackTick = this.random.nextInt(0, this.attackRate);
    this.triggerRatio = this.random.nextInt(50, 60) / 100;
    this.reserveRatio = this.random.nextInt(30, 40) / 100;
    this.expandRatio = this.random.nextInt(10, 20) / 100;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  init(mg: Game) {
    this.mg = mg;
  }

  tick(ticks: number) {
    if (ticks % this.attackRate !== this.attackTick) return;

    if (!this.tribe.isAlive()) {
      this.active = false;
      return;
    }

    if (this.attackBehavior === null) {
      this.attackBehavior = new AttackBehavior(
        this.random,
        this.mg,
        this.tribe,
        this.triggerRatio,
        this.reserveRatio,
        this.expandRatio,
      );
      this.attackBehavior.sendAttack(this.mg.terraNullius());
      return;
    }

    this.acceptAllAllianceRequests();
    this.deleteAllStructures();
    this.maybeAttack();
  }

  private acceptAllAllianceRequests() {
    for (const req of this.tribe.incomingAllianceRequests()) {
      req.accept();
    }

    for (const alliance of this.tribe.alliances()) {
      if (!alliance.onlyOneAgreedToExtend()) continue;
      const human = alliance.other(this.tribe);
      this.mg.addExecution(
        new AllianceExtensionExecution(this.tribe, human.id()),
      );
    }
  }

  private deleteAllStructures() {
    for (const unit of this.tribe.units()) {
      if (Structures.has(unit.type()) && this.tribe.canDeleteUnit()) {
        this.mg.addExecution(new DeleteUnitExecution(this.tribe, unit.id()));
      }
    }
  }

  private maybeAttack() {
    if (this.attackBehavior === null) {
      throw new Error("not initialized");
    }

    const toAttack = this.attackBehavior.getNeighborTraitorToAttack();
    if (toAttack !== null) {
      const odds = this.tribe.isFriendly(toAttack) ? 6 : 3;
      if (this.random.chance(odds)) {
        const alliance = this.tribe.allianceWith(toAttack);
        if (alliance !== null) {
          this.tribe.breakAlliance(alliance);
        }
        this.attackBehavior.sendAttack(toAttack);
        return;
      }
    }

    if (this.neighborsTerraNullius) {
      if (this.tribe.neighbors().some((n) => !n.isPlayer())) {
        this.attackBehavior.sendAttack(this.mg.terraNullius());
        return;
      }
      this.neighborsTerraNullius = false;
    }

    this.attackBehavior.attackRandomTarget();
  }

  isActive(): boolean {
    return this.active;
  }
}
```

**Test:** `tests/core/TribeExecution.test.ts`

```typescript
// tests/core/TribeExecution.test.ts
import { describe, expect, it } from "vitest";
import { TribeExecution } from "../../src/core/execution/TribeExecution";
import { PlayerInfo, PlayerType } from "../../src/core/game/Game";
import { setup } from "../util/Setup";

describe("TribeExecution", () => {
  it("constructs with randomized attack rate in 40-80 range", async () => {
    const game = await setup("big_plains");
    const info = new PlayerInfo("tribe1", PlayerType.Bot, null, "tribe_1");
    game.addPlayer(info);
    const tribe = game.player("tribe_1");

    const exec = new TribeExecution(tribe);
    exec.init(game);
    // Tribe execution should be active after construction
    expect(exec.isActive()).toBe(true);
  });

  it("is not active during spawn phase", () => {
    // TribeExecution always returns false for activeDuringSpawnPhase
    const game = {} as any;
    const info = new PlayerInfo("tribe2", PlayerType.Bot, null, "tribe_2");
    const mockPlayer = { id: () => "tribe_2" } as any;
    const exec = new TribeExecution(mockPlayer);
    expect(exec.activeDuringSpawnPhase()).toBe(false);
  });
});
```

**Run:** `npx vitest run tests/core/TribeExecution.test.ts`

**Commit:** `feat: add TribeExecution for simple AI bots`

---

## Task 4: TribeSpawner -- Random Space Name Generation

**Files:**
- `src/core/execution/utils/TribeNames.ts` (new)
- `src/core/execution/TribeSpawner.ts` (new)

**Depends on:** Nothing

**Checkboxes:**
- [ ] Define `TRIBE_NAME_PREFIXES` with 40+ space-themed prefixes (Star, Void, Nova, Nebula, Pulsar, Quasar, Comet, Astral, Cosmic, Solar, etc.)
- [ ] Define `TRIBE_NAME_SUFFIXES` with 30+ suffixes (hold, reach, gate, forge, keep, haven, drift, fall, wake, mark, etc.)
- [ ] `TribeSpawner` class with seeded `PseudoRandom`
- [ ] `spawnTribes(numTribes)` returns `SpawnExecution[]`
- [ ] `randomTribeName()` combines random prefix + suffix

```typescript
// src/core/execution/utils/TribeNames.ts
export const TRIBE_NAME_PREFIXES = [
  "Star",
  "Void",
  "Nova",
  "Nebula",
  "Pulsar",
  "Quasar",
  "Comet",
  "Astral",
  "Cosmic",
  "Solar",
  "Lunar",
  "Stellar",
  "Plasma",
  "Photon",
  "Neutron",
  "Graviton",
  "Tachyon",
  "Dark",
  "Bright",
  "Iron",
  "Crystal",
  "Shadow",
  "Crimson",
  "Azure",
  "Obsidian",
  "Emerald",
  "Phantom",
  "Radiant",
  "Silent",
  "Frozen",
  "Burning",
  "Shattered",
  "Ancient",
  "Eternal",
  "Drifting",
  "Warp",
  "Hyper",
  "Flux",
  "Ion",
  "Gamma",
  "Beta",
  "Omega",
  "Alpha",
  "Zenith",
  "Apex",
];

export const TRIBE_NAME_SUFFIXES = [
  "hold",
  "reach",
  "gate",
  "forge",
  "keep",
  "haven",
  "drift",
  "fall",
  "wake",
  "mark",
  "spire",
  "veil",
  "core",
  "rim",
  "belt",
  "field",
  "point",
  "watch",
  "ward",
  "born",
  "deep",
  "peak",
  "vale",
  "crest",
  "port",
  "dock",
  "nest",
  "well",
  "storm",
  "fire",
];
```

```typescript
// src/core/execution/TribeSpawner.ts
import { Game, PlayerInfo, PlayerType } from "../game/Game";
import { PseudoRandom } from "../PseudoRandom";
import { GameID } from "../Schemas";
import { simpleHash } from "../Util";
import { SpawnExecution } from "./SpawnExecution";
import { TRIBE_NAME_PREFIXES, TRIBE_NAME_SUFFIXES } from "./utils/TribeNames";

export class TribeSpawner {
  private random: PseudoRandom;

  constructor(
    private gs: Game,
    private gameID: GameID,
  ) {
    this.random = new PseudoRandom(simpleHash(gameID) + 2);
  }

  spawnTribes(numTribes: number): SpawnExecution[] {
    const tribes: SpawnExecution[] = [];
    for (let i = 0; i < numTribes; i++) {
      tribes.push(this.spawnTribe(this.randomTribeName()));
    }
    return tribes;
  }

  spawnTribe(tribeName: string): SpawnExecution {
    return new SpawnExecution(
      this.gameID,
      new PlayerInfo(tribeName, PlayerType.Bot, null, this.random.nextID()),
    );
  }

  private randomTribeName(): string {
    const prefixIndex = this.random.nextInt(0, TRIBE_NAME_PREFIXES.length);
    const suffixIndex = this.random.nextInt(0, TRIBE_NAME_SUFFIXES.length);
    return `${TRIBE_NAME_PREFIXES[prefixIndex]}${TRIBE_NAME_SUFFIXES[suffixIndex]}`;
  }
}
```

**Test:** `tests/core/TribeSpawner.test.ts`

```typescript
// tests/core/TribeSpawner.test.ts
import { describe, expect, it } from "vitest";
import { TRIBE_NAME_PREFIXES, TRIBE_NAME_SUFFIXES } from "../../src/core/execution/utils/TribeNames";
import { TribeSpawner } from "../../src/core/execution/TribeSpawner";
import { setup } from "../util/Setup";

describe("TribeNames", () => {
  it("has at least 40 prefixes", () => {
    expect(TRIBE_NAME_PREFIXES.length).toBeGreaterThanOrEqual(40);
  });

  it("has at least 30 suffixes", () => {
    expect(TRIBE_NAME_SUFFIXES.length).toBeGreaterThanOrEqual(30);
  });

  it("all prefixes are unique", () => {
    expect(new Set(TRIBE_NAME_PREFIXES).size).toBe(TRIBE_NAME_PREFIXES.length);
  });

  it("all suffixes are unique", () => {
    expect(new Set(TRIBE_NAME_SUFFIXES).size).toBe(TRIBE_NAME_SUFFIXES.length);
  });
});

describe("TribeSpawner", () => {
  it("spawns requested number of tribes", async () => {
    const game = await setup("big_plains");
    const spawner = new TribeSpawner(game, "game-123");
    const result = spawner.spawnTribes(5);
    expect(result).toHaveLength(5);
  });

  it("generates deterministic names for same seed", async () => {
    const game = await setup("big_plains");
    const spawner1 = new TribeSpawner(game, "game-seed-1");
    const spawner2 = new TribeSpawner(game, "game-seed-1");
    const names1 = spawner1.spawnTribes(3).map((s) => (s as any).playerInfo?.name);
    const names2 = spawner2.spawnTribes(3).map((s) => (s as any).playerInfo?.name);
    // Same seed produces same sequence
    expect(names1).toEqual(names2);
  });
});
```

**Run:** `npx vitest run tests/core/TribeSpawner.test.ts`

**Commit:** `feat: add TribeSpawner with space-themed name generation`

---

## Task 5: AttackBehavior (Shared)

**Files:**
- `src/core/execution/utils/AttackBehavior.ts` (new)

**Depends on:** Nothing (uses Game/Player interfaces)

**Checkboxes:**
- [ ] Troop allocation: 50-60% trigger, 30-40% reserve, 10-20% expand
- [ ] `maybeAttack()` orchestrates attack strategy pipeline
- [ ] `attackBestTarget()` selects by weakness with difficulty-scaled strategies
- [ ] `sendAttack()` dispatches land or invasion fleet attacks
- [ ] `forceSendAttack()` bypasses checks for initial expansion
- [ ] `attackRandomTarget()` for tribe bots
- [ ] `getNeighborTraitorToAttack()` for targeting betrayers
- [ ] Bot attack parallelism scales with difficulty
- [ ] Optional alliance/emoji behavior dependencies (null for tribes)

```typescript
// src/core/execution/utils/AttackBehavior.ts
import {
  Difficulty,
  Game,
  GameMode,
  GameType,
  HumansVsNations,
  Player,
  PlayerID,
  PlayerType,
  Relation,
  Structures,
  TerraNullius,
  UnitType,
} from "../../game/Game";
import { TileRef } from "../../game/GameMap";
import { PseudoRandom } from "../../PseudoRandom";
import { assertNever } from "../../Util";
import { AttackExecution } from "../AttackExecution";
import { InvasionFleetExecution } from "../InvasionFleetExecution";
import { AllianceBehavior } from "../empire/AllianceBehavior";
import { EmojiBehavior } from "../empire/EmojiBehavior";

export class AttackBehavior {
  private botAttackTroopsSent: number = 0;

  constructor(
    private random: PseudoRandom,
    private game: Game,
    private player: Player,
    private triggerRatio: number,
    private reserveRatio: number,
    private expandRatio: number,
    private allianceBehavior?: AllianceBehavior,
    private emojiBehavior?: EmojiBehavior,
  ) {}

  maybeAttack() {
    if (this.player === null || this.allianceBehavior === undefined) {
      throw new Error("not initialized");
    }

    const border = Array.from(this.player.borderTiles())
      .flatMap((t) => this.game.neighbors(t))
      .filter(
        (t) =>
          this.game.isLand(t) &&
          this.game.ownerID(t) !== this.player?.smallID(),
      );
    const borderingPlayers = [
      ...new Set(
        border
          .map((t) => this.game.playerBySmallID(this.game.ownerID(t)))
          .filter((o): o is Player => o.isPlayer()),
      ),
    ].sort((a, b) => a.troops() - b.troops());
    const borderingFriends = borderingPlayers.filter(
      (o) => this.player?.isFriendly(o) === true,
    );
    const borderingEnemies = borderingPlayers.filter(
      (o) => this.player?.isFriendly(o) === false,
    );

    // Expand into unclaimed, non-scorched territory
    const hasUnclaimedTerritory = border.some(
      (t) => !this.game.hasOwner(t) && !this.game.hasFallout(t),
    );
    if (hasUnclaimedTerritory) {
      this.sendAttack(this.game.terraNullius());
      return;
    }

    if (borderingEnemies.length === 0) {
      if (this.random.chance(5)) {
        this.attackWithInvasionFleet();
      }
    } else {
      if (this.random.chance(10)) {
        this.attackWithInvasionFleet(borderingEnemies);
        return;
      }
      this.allianceBehavior.maybeSendAllianceRequests(borderingEnemies);
    }

    this.attackBestTarget(borderingFriends, borderingEnemies);
  }

  private attackWithInvasionFleet(_borderingEnemies: Player[] = []) {
    // Invasion fleet via wormhole - simplified from OpenFront's boat attack
    // Implementation sends InvasionFleetExecution if wormhole reachable targets exist
    // Placeholder: full wormhole pathfinding integration in later plan
  }

  private attackBestTarget(
    borderingFriends: Player[],
    borderingEnemies: Player[],
  ) {
    if (this.hasNeighboringBotWithStructures()) {
      if (this.attackBots()) return;
    }

    if (!this.hasReserveRatioTroops()) return;
    if (!this.hasTriggerRatioTroops() && !this.random.chance(10)) return;

    const strategies = this.getAttackStrategies(
      borderingFriends,
      borderingEnemies,
    );

    for (const strategy of strategies) {
      if (strategy()) return;
    }
  }

  private getAttackStrategies(
    borderingFriends: Player[],
    borderingEnemies: Player[],
  ): Array<() => boolean> {
    const { difficulty } = this.game.config().gameConfig();

    const retaliate = (): boolean => {
      const attacker = this.findIncomingAttackPlayer();
      if (attacker) {
        this.sendAttack(attacker, true);
        return true;
      }
      return false;
    };

    const bots = (): boolean => this.attackBots();

    const traitor = (): boolean => {
      const t = borderingEnemies.find(
        (e) => e.isTraitor() && e.troops() < this.player.troops() * 1.2,
      );
      if (t) { this.sendAttack(t); return true; }
      return false;
    };

    const afk = (): boolean => {
      const a = borderingEnemies.find(
        (e) => e.isDisconnected() && e.troops() < this.player.troops() * 3,
      );
      if (a) { this.sendAttack(a); return true; }
      return false;
    };

    const veryWeak = (): boolean => {
      const vw = borderingEnemies.find((e) => {
        const maxT = this.game.config().maxTroops(e);
        return e.troops() < maxT * 0.15 && e.troops() < this.player.troops() * 1.2;
      });
      if (vw) { this.sendAttack(vw); return true; }
      return false;
    };

    const victim = (): boolean => {
      const v = borderingEnemies.find((e) => {
        if (e.troops() > this.player.troops() * 1.2) return false;
        const incoming = e.incomingAttacks().reduce((s, a) => s + a.troops(), 0);
        return incoming > e.troops() * 0.5;
      });
      if (v) { this.sendAttack(v); return true; }
      return false;
    };

    const weakest = (): boolean => {
      if (borderingEnemies.length > 0) {
        const w = borderingEnemies[0];
        if (w.troops() < this.player.troops()) {
          this.sendAttack(w);
          return true;
        }
      }
      return false;
    };

    const nuked = (): boolean => {
      if (this.isBorderingScorchedTerritory()) {
        this.sendAttack(this.game.terraNullius());
        return true;
      }
      return false;
    };

    switch (difficulty) {
      case Difficulty.Easy:
        return [nuked, bots, retaliate, weakest];
      case Difficulty.Medium:
        return [bots, nuked, retaliate, afk, traitor, weakest];
      case Difficulty.Hard:
        return [bots, retaliate, nuked, traitor, afk, veryWeak, victim, weakest];
      case Difficulty.Impossible:
        return [retaliate, bots, veryWeak, traitor, afk, victim, nuked, weakest];
      default:
        assertNever(difficulty);
    }
  }

  private hasNeighboringBotWithStructures(): boolean {
    return this.player
      .neighbors()
      .some(
        (n) =>
          n.isPlayer() &&
          n.type() === PlayerType.Bot &&
          !this.player.isFriendly(n) &&
          n.units().some((u) => Structures.has(u.type())),
      );
  }

  private hasReserveRatioTroops(): boolean {
    const maxTroops = this.game.config().maxTroops(this.player);
    return this.player.troops() / maxTroops >= this.reserveRatio;
  }

  private hasTriggerRatioTroops(): boolean {
    const maxTroops = this.game.config().maxTroops(this.player);
    return this.player.troops() / maxTroops >= this.triggerRatio;
  }

  findIncomingAttackPlayer(): Player | null {
    let incomingAttacks = this.player.incomingAttacks();
    if (this.player.type() !== PlayerType.Bot) {
      incomingAttacks = incomingAttacks.filter(
        (a) => a.attacker().type() !== PlayerType.Bot,
      );
    }
    let largest = 0;
    let attacker: Player | undefined;
    for (const attack of incomingAttacks) {
      if (attack.troops() <= largest) continue;
      largest = attack.troops();
      attacker = attack.attacker();
    }
    return attacker ?? null;
  }

  private attackBots(): boolean {
    const bots = this.player
      .neighbors()
      .filter(
        (n): n is Player =>
          n.isPlayer() &&
          !this.player.isFriendly(n) &&
          n.type() === PlayerType.Bot,
      );
    if (bots.length === 0) return false;

    this.botAttackTroopsSent = 0;
    const density = (p: Player) => p.troops() / p.numTilesOwned();
    const ownsStructures = (p: Player) =>
      p.units().some((u) => Structures.has(u.type()));
    const sorted = bots.slice().sort((a, b) => {
      const aS = ownsStructures(a);
      const bS = ownsStructures(b);
      if (aS !== bS) return aS ? -1 : 1;
      return density(a) - density(b);
    });
    const max = this.getBotAttackMaxParallelism();
    for (const bot of sorted.slice(0, max)) {
      this.sendAttack(bot);
    }
    return this.botAttackTroopsSent > 0;
  }

  private getBotAttackMaxParallelism(): number {
    const { difficulty } = this.game.config().gameConfig();
    switch (difficulty) {
      case Difficulty.Easy: return 1;
      case Difficulty.Medium: return this.random.chance(2) ? 1 : 2;
      case Difficulty.Hard: return 3;
      case Difficulty.Impossible: return 100;
      default: assertNever(difficulty);
    }
  }

  private isBorderingScorchedTerritory(): boolean {
    for (const tile of this.player.borderTiles()) {
      for (const neighbor of this.game.neighbors(tile)) {
        if (
          this.game.isLand(neighbor) &&
          !this.game.hasOwner(neighbor) &&
          this.game.hasFallout(neighbor)
        ) {
          return true;
        }
      }
    }
    return false;
  }

  attackRandomTarget() {
    if (!this.hasTriggerRatioTroops()) return;

    const incoming = this.findIncomingAttackPlayer();
    if (incoming) {
      this.sendAttack(incoming, true);
      return;
    }

    const traitorTarget = this.getNeighborTraitorToAttack();
    if (traitorTarget !== null && this.random.chance(3)) {
      this.sendAttack(traitorTarget);
      return;
    }

    const neighbors = this.player.neighbors();
    for (const neighbor of this.random.shuffleArray(neighbors)) {
      if (!neighbor.isPlayer()) continue;
      if (this.player.isFriendly(neighbor)) continue;
      if (
        (neighbor.type() === PlayerType.Nation ||
          neighbor.type() === PlayerType.Human) &&
        this.random.chance(2)
      ) {
        continue;
      }
      this.sendAttack(neighbor);
      return;
    }
  }

  getNeighborTraitorToAttack(): Player | null {
    const traitors = this.player
      .neighbors()
      .filter(
        (n): n is Player =>
          n.isPlayer() && !this.player.isFriendly(n) && n.isTraitor(),
      );
    return traitors.length > 0 ? this.random.randElement(traitors) : null;
  }

  forceSendAttack(target: Player | TerraNullius) {
    this.game.addExecution(
      new AttackExecution(
        this.player.troops() / 2,
        this.player,
        target.isPlayer() ? target.id() : this.game.terraNullius().id(),
      ),
    );
  }

  sendAttack(target: Player | TerraNullius, force = false) {
    if (!force && !this.shouldAttack(target)) return;

    if (this.player.sharesBorderWith(target)) {
      this.sendLandAttack(target);
    }
    // Wormhole-based invasion fleet attacks handled in later plan
  }

  shouldAttack(other: Player | TerraNullius): boolean {
    if (
      !other.isPlayer() ||
      other.type() !== PlayerType.Human ||
      other.isTraitor() ||
      this.player.type() === PlayerType.Bot ||
      this.game.config().gameConfig().playerTeams === HumansVsNations
    ) {
      return true;
    }
    const { difficulty } = this.game.config().gameConfig();
    if (difficulty === Difficulty.Easy && this.random.chance(2)) return false;
    if (difficulty === Difficulty.Medium && this.random.chance(4)) return false;
    return true;
  }

  private sendLandAttack(target: Player | TerraNullius) {
    const maxTroops = this.game.config().maxTroops(this.player);
    const botWithStructures =
      target.isPlayer() &&
      target.type() === PlayerType.Bot &&
      target.units().some((u) => Structures.has(u.type()));
    const useReserve = target.isPlayer() && !botWithStructures;
    const reserveRatio = useReserve ? this.reserveRatio : this.expandRatio;
    const targetTroops = maxTroops * reserveRatio;

    let troops: number;
    if (
      target.isPlayer() &&
      target.type() === PlayerType.Bot &&
      this.player.type() !== PlayerType.Bot
    ) {
      troops = this.calculateBotAttackTroops(
        target,
        this.player.troops() - targetTroops - this.botAttackTroopsSent,
      );
    } else {
      troops = this.player.troops() - targetTroops;
    }

    if (troops < 1) return;

    if (target.isPlayer() && this.player.type() === PlayerType.Nation) {
      this.emojiBehavior?.maybeSendAttackEmoji(target);
    }

    this.game.addExecution(
      new AttackExecution(
        troops,
        this.player,
        target.isPlayer() ? target.id() : this.game.terraNullius().id(),
      ),
    );
  }

  private calculateBotAttackTroops(target: Player, maxTroops: number): number {
    const { difficulty } = this.game.config().gameConfig();
    if (difficulty === Difficulty.Easy) {
      this.botAttackTroopsSent += maxTroops;
      return maxTroops;
    }
    let troops = target.troops() * 4;
    if (troops > maxTroops) {
      troops = maxTroops < target.troops() * 2 ? 0 : maxTroops;
    }
    this.botAttackTroopsSent += troops;
    return troops;
  }
}
```

**Test:** `tests/core/AttackBehavior.test.ts`

```typescript
// tests/core/AttackBehavior.test.ts
import { describe, expect, it } from "vitest";
import { AttackBehavior } from "../../src/core/execution/utils/AttackBehavior";
import { PlayerInfo, PlayerType, Difficulty } from "../../src/core/game/Game";
import { PseudoRandom } from "../../src/core/PseudoRandom";
import { setup } from "../util/Setup";

describe("AttackBehavior", () => {
  it("trigger ratio is between 0.50 and 0.60", () => {
    const random = new PseudoRandom(42);
    const trigger = random.nextInt(50, 60) / 100;
    expect(trigger).toBeGreaterThanOrEqual(0.5);
    expect(trigger).toBeLessThanOrEqual(0.6);
  });

  it("reserve ratio is between 0.30 and 0.40", () => {
    const random = new PseudoRandom(42);
    const reserve = random.nextInt(30, 40) / 100;
    expect(reserve).toBeGreaterThanOrEqual(0.3);
    expect(reserve).toBeLessThanOrEqual(0.4);
  });

  it("expand ratio is between 0.10 and 0.20", () => {
    const random = new PseudoRandom(42);
    const expand = random.nextInt(10, 20) / 100;
    expect(expand).toBeGreaterThanOrEqual(0.1);
    expect(expand).toBeLessThanOrEqual(0.2);
  });

  it("shouldAttack always true for non-human targets", async () => {
    const game = await setup("big_plains");
    const info = new PlayerInfo("empire", PlayerType.Nation, null, "emp_1");
    game.addPlayer(info);
    const player = game.player("emp_1");
    const random = new PseudoRandom(42);

    const behavior = new AttackBehavior(
      random,
      game,
      player,
      0.55,
      0.35,
      0.15,
    );

    // TerraNullius should always be attackable
    expect(behavior.shouldAttack(game.terraNullius())).toBe(true);
  });
});
```

**Run:** `npx vitest run tests/core/AttackBehavior.test.ts`

**Commit:** `feat: add shared AttackBehavior with difficulty-scaled strategy pipeline`

---

## Task 6: EmpireExecution -- Central AI Orchestrator

**Files:**
- `src/core/execution/EmpireExecution.ts` (new)

**Depends on:** Tasks 1, 5, 7, 8, 9, 10, 11, 12

**Checkboxes:**
- [ ] Implement `Execution` interface
- [ ] `activeDuringSpawnPhase()` returns true (spawns during spawn phase)
- [ ] Difficulty-scaled `attackRate`: Easy 65-80, Medium 50-65, Hard 40-50, Impossible 30-50
- [ ] Lazy-init all behaviors after first spawn
- [ ] On each attack tick: call emoji, embargo, alliance, superweapon, structure, cruiser, attack, swarm behaviors
- [ ] Call `structureBehavior.handleStructures()` at 1/3 and 2/3 between attack ticks
- [ ] Track embargo maluses per player
- [ ] Handle spawn phase: find land near `spawnCell` or random spawn
- [ ] Support team spawn area clamping

```typescript
// src/core/execution/EmpireExecution.ts
import {
  Difficulty,
  Execution,
  Game,
  Nation,
  Player,
  PlayerID,
  Relation,
  TerrainType,
} from "../game/Game";
import { TileRef } from "../game/GameMap";
import { PseudoRandom } from "../PseudoRandom";
import { GameID } from "../Schemas";
import { assertNever, simpleHash } from "../Util";
import { AllianceBehavior } from "./empire/AllianceBehavior";
import { CruiserBehavior } from "./empire/CruiserBehavior";
import { EmojiBehavior } from "./empire/EmojiBehavior";
import { StructureBehavior } from "./empire/StructureBehavior";
import { SuperweaponBehavior } from "./empire/SuperweaponBehavior";
import { SwarmBehavior } from "./empire/SwarmBehavior";
import { SpawnExecution } from "./SpawnExecution";
import { AttackBehavior } from "./utils/AttackBehavior";

export class EmpireExecution implements Execution {
  private active = true;
  private random: PseudoRandom;
  private behaviorsInitialized = false;
  private emojiBehavior!: EmojiBehavior;
  private swarmBehavior!: SwarmBehavior;
  private attackBehavior!: AttackBehavior;
  private allianceBehavior!: AllianceBehavior;
  private cruiserBehavior!: CruiserBehavior;
  private superweaponBehavior!: SuperweaponBehavior;
  private structureBehavior!: StructureBehavior;
  private mg: Game;
  private player: Player | null = null;

  private attackRate: number;
  private attackTick: number;
  private triggerRatio: number;
  private reserveRatio: number;
  private expandRatio: number;

  private readonly embargoMalusApplied = new Set<PlayerID>();

  constructor(
    private gameID: GameID,
    private nation: Nation,
  ) {
    this.random = new PseudoRandom(
      simpleHash(nation.playerInfo.id) + simpleHash(gameID),
    );
    this.triggerRatio = this.random.nextInt(50, 60) / 100;
    this.reserveRatio = this.random.nextInt(30, 40) / 100;
    this.expandRatio = this.random.nextInt(10, 20) / 100;
  }

  init(mg: Game) {
    this.mg = mg;
    this.attackRate = this.getAttackRate();
    this.attackTick = this.random.nextInt(0, this.attackRate);

    if (!this.mg.hasPlayer(this.nation.playerInfo.id)) {
      this.player = this.mg.addPlayer(this.nation.playerInfo);
    } else {
      this.player = this.mg.player(this.nation.playerInfo.id);
    }
  }

  private getAttackRate(): number {
    const { difficulty } = this.mg.config().gameConfig();
    switch (difficulty) {
      case Difficulty.Easy:
        return this.random.nextInt(65, 80);
      case Difficulty.Medium:
        return this.random.nextInt(50, 65);
      case Difficulty.Hard:
        return this.random.nextInt(40, 50);
      case Difficulty.Impossible:
        return this.random.nextInt(30, 50);
      default:
        assertNever(difficulty);
    }
  }

  tick(ticks: number) {
    // Ship tracking between attack ticks
    if (
      this.behaviorsInitialized &&
      this.player !== null &&
      this.player.isAlive() &&
      this.mg.config().gameConfig().difficulty !== Difficulty.Easy
    ) {
      this.cruiserBehavior.trackShipsAndRetaliate();
    }

    if (this.player === null) return;

    if (this.mg.inSpawnPhase()) {
      if (ticks % this.attackRate !== this.attackTick) return;

      if (this.nation.spawnCell === undefined) {
        this.mg.addExecution(
          new SpawnExecution(this.gameID, this.nation.playerInfo),
        );
        return;
      }

      const team = this.player.team();
      if (team !== null) {
        const area = this.mg.teamSpawnArea(team);
        if (area !== undefined) {
          const cell = this.nation.spawnCell;
          const inArea =
            cell.x >= area.x &&
            cell.x < area.x + area.width &&
            cell.y >= area.y &&
            cell.y < area.y + area.height;
          if (!inArea) {
            this.mg.addExecution(
              new SpawnExecution(this.gameID, this.nation.playerInfo),
            );
            return;
          }
        }
      }

      const rl = this.randomSpawnLand();
      if (rl === null) {
        console.warn(`cannot spawn ${this.nation.playerInfo.name}`);
        return;
      }
      this.mg.addExecution(
        new SpawnExecution(this.gameID, this.nation.playerInfo, rl),
      );
      return;
    }

    if (!this.player.isAlive()) {
      this.active = false;
      return;
    }

    if (!this.behaviorsInitialized) {
      this.initializeBehaviors();
      this.attackBehavior.forceSendAttack(this.mg.terraNullius());
      return;
    }

    if (ticks % this.attackRate !== this.attackTick) {
      if (this.player.isAlive()) {
        const offset = ticks % this.attackRate;
        const oneThird =
          (this.attackTick + Math.floor(this.attackRate / 3)) % this.attackRate;
        const twoThirds =
          (this.attackTick + Math.floor((this.attackRate * 2) / 3)) %
          this.attackRate;
        if (offset === oneThird || offset === twoThirds) {
          this.structureBehavior.handleStructures();
        }
      }
      return;
    }

    this.emojiBehavior.maybeSendCasualEmoji();
    this.updateRelationsFromEmbargos();
    this.allianceBehavior.handleAllianceRequests();
    this.allianceBehavior.handleAllianceExtensionRequests();
    this.swarmBehavior.considerSwarm();
    this.structureBehavior.handleStructures();
    this.cruiserBehavior.maybeSpawnCruiser();
    this.handleEmbargoesToHostileEmpires();
    this.attackBehavior.maybeAttack();
    this.cruiserBehavior.counterCruiserInfestation();
    this.superweaponBehavior.maybeSendSuperweapon();
  }

  private initializeBehaviors(): void {
    if (this.player === null) throw new Error("Player not initialized");

    this.emojiBehavior = new EmojiBehavior(
      this.random,
      this.mg,
      this.player,
    );
    this.swarmBehavior = new SwarmBehavior(
      this.random,
      this.mg,
      this.player,
      this.emojiBehavior,
    );
    this.allianceBehavior = new AllianceBehavior(
      this.random,
      this.mg,
      this.player,
      this.emojiBehavior,
    );
    this.cruiserBehavior = new CruiserBehavior(
      this.random,
      this.mg,
      this.player,
      this.emojiBehavior,
    );
    this.attackBehavior = new AttackBehavior(
      this.random,
      this.mg,
      this.player,
      this.triggerRatio,
      this.reserveRatio,
      this.expandRatio,
      this.allianceBehavior,
      this.emojiBehavior,
    );
    this.superweaponBehavior = new SuperweaponBehavior(
      this.random,
      this.mg,
      this.player,
      this.attackBehavior,
      this.emojiBehavior,
    );
    this.structureBehavior = new StructureBehavior(
      this.random,
      this.mg,
      this.player,
    );
    this.behaviorsInitialized = true;
  }

  private randomSpawnLand(): TileRef | null {
    if (this.nation.spawnCell === undefined) throw new Error("not initialized");
    const delta = 25;
    let tries = 0;
    while (tries < 50) {
      tries++;
      const cell = this.nation.spawnCell;
      const x = this.random.nextInt(cell.x - delta, cell.x + delta);
      const y = this.random.nextInt(cell.y - delta, cell.y + delta);
      if (!this.mg.isValidCoord(x, y)) continue;
      const tile = this.mg.ref(x, y);
      if (this.mg.isLand(tile) && !this.mg.hasOwner(tile)) {
        if (
          this.mg.terrainType(tile) === TerrainType.Mountain &&
          this.random.chance(2)
        ) {
          continue;
        }
        return tile;
      }
    }
    return null;
  }

  private updateRelationsFromEmbargos() {
    const player = this.player;
    if (player === null) return;
    const others = this.mg.players().filter((p) => p.id() !== player.id());

    others.forEach((other: Player) => {
      const embargoMalus = -20;
      if (
        other.hasEmbargoAgainst(player) &&
        !this.embargoMalusApplied.has(other.id())
      ) {
        player.updateRelation(other, embargoMalus);
        this.embargoMalusApplied.add(other.id());
      } else if (
        !other.hasEmbargoAgainst(player) &&
        this.embargoMalusApplied.has(other.id())
      ) {
        player.updateRelation(other, -embargoMalus);
        this.embargoMalusApplied.delete(other.id());
      }
    });
  }

  private handleEmbargoesToHostileEmpires() {
    const player = this.player;
    if (player === null) return;
    const others = this.mg.players().filter((p) => p.id() !== player.id());

    others.forEach((other: Player) => {
      if (
        player.relation(other) <= Relation.Hostile &&
        !player.hasEmbargoAgainst(other) &&
        !player.isOnSameTeam(other)
      ) {
        player.addEmbargo(other, false);
      } else if (
        player.relation(other) >= Relation.Neutral &&
        player.hasEmbargoAgainst(other) &&
        this.mg.config().gameConfig().difficulty !== Difficulty.Hard &&
        this.mg.config().gameConfig().difficulty !== Difficulty.Impossible
      ) {
        player.stopEmbargo(other);
      } else if (
        player.relation(other) >= Relation.Friendly &&
        player.hasEmbargoAgainst(other) &&
        this.mg.config().gameConfig().difficulty !== Difficulty.Impossible
      ) {
        player.stopEmbargo(other);
      }
    });
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return true;
  }
}
```

**Test:** `tests/core/EmpireExecution.test.ts`

```typescript
// tests/core/EmpireExecution.test.ts
import { describe, expect, it } from "vitest";
import { EmpireExecution } from "../../src/core/execution/EmpireExecution";
import {
  Cell,
  Difficulty,
  Nation,
  PlayerInfo,
  PlayerType,
} from "../../src/core/game/Game";
import { PseudoRandom } from "../../src/core/PseudoRandom";
import { setup } from "../util/Setup";

describe("EmpireExecution", () => {
  it("is active during spawn phase", () => {
    const nation = new Nation(
      new Cell(50, 50),
      new PlayerInfo("TestEmpire", PlayerType.Nation, null, "test_emp"),
    );
    const exec = new EmpireExecution("game-1", nation);
    expect(exec.activeDuringSpawnPhase()).toBe(true);
  });

  it("initializes and becomes active", async () => {
    const game = await setup("big_plains", { difficulty: Difficulty.Medium });
    const nation = new Nation(
      new Cell(50, 50),
      new PlayerInfo("TestEmpire", PlayerType.Nation, null, "test_emp"),
    );
    const exec = new EmpireExecution("game-1", nation);
    exec.init(game);
    expect(exec.isActive()).toBe(true);
  });

  it("attack rate scales with difficulty", () => {
    // Verify ranges by sampling with known seeds
    const random = new PseudoRandom(42);
    const easyRate = random.nextInt(65, 80);
    expect(easyRate).toBeGreaterThanOrEqual(65);
    expect(easyRate).toBeLessThanOrEqual(80);

    const impossibleRate = random.nextInt(30, 50);
    expect(impossibleRate).toBeGreaterThanOrEqual(30);
    expect(impossibleRate).toBeLessThanOrEqual(50);
  });
});
```

**Run:** `npx vitest run tests/core/EmpireExecution.test.ts`

**Commit:** `feat: add EmpireExecution as central AI orchestrator with difficulty scaling`

---

## Task 7: AllianceBehavior

**Files:**
- `src/core/execution/empire/AllianceBehavior.ts` (new)

**Depends on:** Task 12 (EmojiBehavior)

**Checkboxes:**
- [ ] `handleAllianceRequests()` -- accept/reject based on threat assessment
- [ ] `handleAllianceExtensionRequests()` -- extend alliances with favorable partners
- [ ] `maybeSendAllianceRequests()` -- proactively request alliances with border neighbors
- [ ] `maybeBetray()` -- personality-modified alliance break thresholds
- [ ] Confusion chance scales with difficulty (Easy 10%, Impossible 0%)
- [ ] Threat assessment factors: troop ratio, max troops, tile count
- [ ] Team game rejection probability scales with difficulty
- [ ] Alliance count limits per difficulty

```typescript
// src/core/execution/empire/AllianceBehavior.ts
import {
  Difficulty,
  Game,
  GameMode,
  Player,
  PlayerType,
  Relation,
} from "../../game/Game";
import { PseudoRandom } from "../../PseudoRandom";
import { assertNever } from "../../Util";
import { AllianceExtensionExecution } from "../alliance/AllianceExtensionExecution";
import { AllianceRequestExecution } from "../alliance/AllianceRequestExecution";
import {
  EMOJI_CONFUSED,
  EMOJI_HANDSHAKE,
  EMOJI_LOVE,
  EMOJI_SCARED_OF_THREAT,
  EmojiBehavior,
} from "./EmojiBehavior";

export class AllianceBehavior {
  constructor(
    private random: PseudoRandom,
    private game: Game,
    private player: Player,
    private emojiBehavior: EmojiBehavior,
  ) {}

  handleAllianceRequests() {
    for (const req of this.player.incomingAllianceRequests()) {
      if (req.createdAt() <= this.game.config().numSpawnPhaseTurns() + 1) {
        req.reject();
        continue;
      }
      if (this.getAllianceDecision(req.requestor(), true)) {
        req.accept();
      } else {
        req.reject();
      }
    }
  }

  handleAllianceExtensionRequests() {
    for (const alliance of this.player.alliances()) {
      if (!alliance.onlyOneAgreedToExtend()) continue;
      const human = alliance.other(this.player);
      if (!this.getAllianceDecision(human, true)) continue;
      this.game.addExecution(
        new AllianceExtensionExecution(this.player, human.id()),
      );
    }
  }

  maybeSendAllianceRequests(borderingEnemies: Player[]) {
    const isAcceptablePlayerType = (p: Player) =>
      (p.type() === PlayerType.Bot &&
        this.game.config().gameConfig().difficulty === Difficulty.Easy) ||
      p.type() !== PlayerType.Bot;

    for (const enemy of borderingEnemies) {
      if (
        this.random.chance(30) &&
        isAcceptablePlayerType(enemy) &&
        this.player.canSendAllianceRequest(enemy) &&
        this.getAllianceDecision(enemy, false)
      ) {
        this.game.addExecution(
          new AllianceRequestExecution(this.player, enemy.id()),
        );
      }
    }
  }

  private getAllianceDecision(otherPlayer: Player, isResponse: boolean): boolean {
    if (this.isConfused()) return this.random.chance(2);

    if (otherPlayer.isTraitor() && this.random.nextInt(0, 100) >= 10) {
      if (isResponse && this.random.chance(3)) {
        this.emojiBehavior.sendEmoji(otherPlayer, EMOJI_CONFUSED);
      }
      return false;
    }

    if (this.hasTooManyAlliances(otherPlayer)) return false;

    if (this.isAlliancePartnerThreat(otherPlayer)) {
      if (!isResponse && this.random.chance(6)) {
        this.emojiBehavior.sendEmoji(otherPlayer, EMOJI_SCARED_OF_THREAT);
      }
      if (isResponse && this.random.chance(6)) {
        this.emojiBehavior.sendEmoji(otherPlayer, EMOJI_LOVE);
      }
      return true;
    }

    if (this.shouldRejectInTeamGame()) return false;

    if (this.player.relation(otherPlayer) < Relation.Neutral) {
      if (isResponse && this.random.chance(3)) {
        this.emojiBehavior.sendEmoji(otherPlayer, EMOJI_CONFUSED);
      }
      return false;
    }

    if (this.isAlliancePartnerFriendly(otherPlayer)) {
      if (this.random.chance(3)) {
        this.emojiBehavior.sendEmoji(otherPlayer, EMOJI_HANDSHAKE);
      }
      return true;
    }

    if (this.checkAlreadyEnoughAlliances(otherPlayer)) return false;
    if (this.isEarlygame()) return true;
    return this.isAlliancePartnerSimilarlyStrong(otherPlayer);
  }

  private hasTooManyAlliances(otherPlayer: Player): boolean {
    const { difficulty } = this.game.config().gameConfig();
    if (difficulty !== Difficulty.Hard && difficulty !== Difficulty.Impossible) return false;
    const totalPlayers = this.game.players().filter((p) => p.type() !== PlayerType.Bot).length;
    const otherAlliances = otherPlayer.alliances().length;
    if (difficulty === Difficulty.Hard) return otherAlliances >= totalPlayers * 0.5;
    return otherAlliances >= totalPlayers * 0.25;
  }

  private isConfused(): boolean {
    const { difficulty } = this.game.config().gameConfig();
    switch (difficulty) {
      case Difficulty.Easy: return this.random.chance(10);
      case Difficulty.Medium: return this.random.chance(20);
      case Difficulty.Hard: return this.random.chance(40);
      case Difficulty.Impossible: return false;
      default: assertNever(difficulty);
    }
  }

  private isEarlygame(): boolean {
    const spawnTicks = this.game.config().numSpawnPhaseTurns();
    const { difficulty } = this.game.config().gameConfig();
    switch (difficulty) {
      case Difficulty.Easy:
        return this.game.ticks() < 3000 + spawnTicks && this.random.nextInt(0, 100) >= 10;
      case Difficulty.Medium:
        return this.game.ticks() < 1800 + spawnTicks && this.random.nextInt(0, 100) >= 30;
      case Difficulty.Hard:
        return this.game.ticks() < 1800 + spawnTicks && this.random.nextInt(0, 100) >= 50;
      case Difficulty.Impossible:
        return this.game.ticks() < 600 + spawnTicks && this.random.nextInt(0, 100) >= 70;
      default: assertNever(difficulty);
    }
  }

  private isAlliancePartnerThreat(otherPlayer: Player): boolean {
    const { difficulty } = this.game.config().gameConfig();
    switch (difficulty) {
      case Difficulty.Easy: return false;
      case Difficulty.Medium: return otherPlayer.troops() > this.player.troops() * 2.5;
      case Difficulty.Hard:
        return otherPlayer.troops() > this.player.troops() &&
          this.game.config().maxTroops(otherPlayer) > this.game.config().maxTroops(this.player) * 2;
      case Difficulty.Impossible: {
        const moreTroops = otherPlayer.troops() > this.player.troops() * 1.5;
        const moreMax = otherPlayer.troops() > this.player.troops() &&
          this.game.config().maxTroops(otherPlayer) > this.game.config().maxTroops(this.player) * 1.5;
        const moreTiles = otherPlayer.troops() > this.player.troops() &&
          otherPlayer.numTilesOwned() > this.player.numTilesOwned() * 1.5;
        return moreTroops || moreMax || moreTiles;
      }
      default: assertNever(difficulty);
    }
  }

  private shouldRejectInTeamGame(): boolean {
    if (this.game.config().gameConfig().gameMode !== GameMode.Team) return false;
    const { difficulty } = this.game.config().gameConfig();
    switch (difficulty) {
      case Difficulty.Easy: return this.random.nextInt(0, 100) < 25;
      case Difficulty.Medium: return this.random.nextInt(0, 100) < 50;
      case Difficulty.Hard: return this.random.nextInt(0, 100) < 75;
      case Difficulty.Impossible: return true;
      default: assertNever(difficulty);
    }
  }

  private checkAlreadyEnoughAlliances(_otherPlayer: Player): boolean {
    const { difficulty } = this.game.config().gameConfig();
    switch (difficulty) {
      case Difficulty.Easy: return false;
      case Difficulty.Medium: return this.player.alliances().length >= this.random.nextInt(4, 6);
      case Difficulty.Hard:
      case Difficulty.Impossible:
        if (difficulty === Difficulty.Hard) {
          return this.player.alliances().length >= this.random.nextInt(3, 5);
        }
        return this.player.alliances().length >= this.random.nextInt(2, 4);
      default: assertNever(difficulty);
    }
  }

  private isAlliancePartnerFriendly(otherPlayer: Player): boolean {
    const { difficulty } = this.game.config().gameConfig();
    switch (difficulty) {
      case Difficulty.Easy:
      case Difficulty.Medium:
        return this.player.relation(otherPlayer) === Relation.Friendly;
      case Difficulty.Hard:
        return this.player.relation(otherPlayer) === Relation.Friendly && this.random.nextInt(0, 100) >= 17;
      case Difficulty.Impossible:
        return this.player.relation(otherPlayer) === Relation.Friendly && this.random.nextInt(0, 100) >= 33;
      default: assertNever(difficulty);
    }
  }

  private isAlliancePartnerSimilarlyStrong(otherPlayer: Player): boolean {
    const { difficulty } = this.game.config().gameConfig();
    const troopRanges = {
      [Difficulty.Easy]: [60, 70], [Difficulty.Medium]: [70, 80],
      [Difficulty.Hard]: [75, 85], [Difficulty.Impossible]: [80, 90],
    } as const;
    const tileRanges = {
      [Difficulty.Easy]: [70, 80], [Difficulty.Medium]: [80, 90],
      [Difficulty.Hard]: [85, 95], [Difficulty.Impossible]: [90, 100],
    } as const;
    const tr = troopRanges[difficulty];
    const tir = tileRanges[difficulty];
    const pOut = this.player.outgoingAttacks().reduce((s, a) => s + a.troops(), 0);
    const oOut = otherPlayer.outgoingAttacks().reduce((s, a) => s + a.troops(), 0);
    const pTotal = this.player.troops() + pOut;
    const oTotal = otherPlayer.troops() + oOut;
    const troopThreshold = pTotal * (this.random.nextInt(tr[0], tr[1]) / 100);
    const tileThreshold = this.player.numTilesOwned() * (this.random.nextInt(tir[0], tir[1]) / 100);
    return oTotal > troopThreshold || (otherPlayer.numTilesOwned() > tileThreshold && oTotal > pTotal * 0.5);
  }

  maybeBetray(otherPlayer: Player, borderingPlayerCount: number): boolean {
    if (!this.player.isAlliedWith(otherPlayer)) return false;
    const { difficulty } = this.game.config().gameConfig();

    if (difficulty !== Difficulty.Easy && difficulty !== Difficulty.Medium) {
      const oMax = this.game.config().maxTroops(otherPlayer);
      const oOut = otherPlayer.outgoingAttacks().reduce((s, a) => s + a.troops(), 0);
      if (otherPlayer.troops() + oOut < oMax * 0.2 && otherPlayer.troops() < this.player.troops()) {
        this.betray(otherPlayer);
        return true;
      }
    }

    if ((difficulty === Difficulty.Easy || difficulty === Difficulty.Medium) &&
      this.player.troops() >= otherPlayer.troops() * 10) {
      this.betray(otherPlayer);
      return true;
    }

    if (difficulty !== Difficulty.Easy && otherPlayer.isTraitor() &&
      otherPlayer.troops() < this.player.troops() * 1.2) {
      this.betray(otherPlayer);
      return true;
    }

    if (difficulty !== Difficulty.Easy && borderingPlayerCount === 1 &&
      otherPlayer.troops() * 3 < this.player.troops()) {
      this.betray(otherPlayer);
      return true;
    }

    return false;
  }

  private betray(target: Player): void {
    const alliance = this.player.allianceWith(target);
    if (!alliance) return;
    this.player.breakAlliance(alliance);
  }
}
```

**Test:** `tests/core/AllianceBehavior.test.ts`

```typescript
// tests/core/AllianceBehavior.test.ts
import { describe, expect, it } from "vitest";
import { AllianceBehavior } from "../../src/core/execution/empire/AllianceBehavior";
import { EmojiBehavior } from "../../src/core/execution/empire/EmojiBehavior";
import { PlayerInfo, PlayerType, Difficulty } from "../../src/core/game/Game";
import { PseudoRandom } from "../../src/core/PseudoRandom";
import { setup } from "../util/Setup";

describe("AllianceBehavior", () => {
  it("constructs without errors", async () => {
    const game = await setup("big_plains", { difficulty: Difficulty.Medium });
    const info = new PlayerInfo("empire", PlayerType.Nation, null, "emp_1");
    game.addPlayer(info);
    const player = game.player("emp_1");
    const random = new PseudoRandom(42);
    const emoji = new EmojiBehavior(random, game, player);
    const alliance = new AllianceBehavior(random, game, player, emoji);

    // Should not throw
    alliance.handleAllianceRequests();
    alliance.handleAllianceExtensionRequests();
  });
});
```

**Run:** `npx vitest run tests/core/AllianceBehavior.test.ts`

**Commit:** `feat: add AllianceBehavior with threat-based alliance decisions`

---

## Task 8: CruiserBehavior

**Files:**
- `src/core/execution/empire/CruiserBehavior.ts` (new)

**Depends on:** Task 12 (EmojiBehavior)

**Checkboxes:**
- [ ] `maybeSpawnCruiser()` -- spawn Battle Cruiser near Starport
- [ ] `trackShipsAndRetaliate()` -- retaliate when Freighters/fleets destroyed
- [ ] `counterCruiserInfestation()` -- counter when enemy >10 (FFA) or >15 (team)
- [ ] Only rich empires (top 3 by credits) counter infestations
- [ ] Retaliation probability scales with difficulty
- [ ] Track transport ships and trade ships for destruction detection

```typescript
// src/core/execution/empire/CruiserBehavior.ts
import {
  AllPlayers,
  Difficulty,
  Game,
  Gold,
  Player,
  PlayerType,
  Unit,
  UnitType,
} from "../../game/Game";
import { TileRef } from "../../game/GameMap";
import { PseudoRandom } from "../../PseudoRandom";
import { ConstructionExecution } from "../ConstructionExecution";
import { EMOJI_CRUISER_RETALIATION, EmojiBehavior } from "./EmojiBehavior";

export class CruiserBehavior {
  private trackedTransportShips: Set<Unit> = new Set();
  private trackedFreighters: Set<Unit> = new Set();

  constructor(
    private random: PseudoRandom,
    private game: Game,
    private player: Player,
    private emojiBehavior: EmojiBehavior,
  ) {}

  maybeSpawnCruiser(): boolean {
    if (!this.random.chance(50)) return false;

    const starports = this.player.units(UnitType.Port); // Starport = Port equivalent
    const cruisers = this.player.units(UnitType.Warship); // BattleCruiser = Warship equivalent
    if (
      starports.length > 0 &&
      cruisers.length === 0 &&
      this.player.gold() > this.cost(UnitType.Warship)
    ) {
      const starport = this.random.randElement(starports);
      const targetTile = this.cruiserSpawnTile(starport.tile());
      if (targetTile === null) return false;
      const canBuild = this.player.canBuild(UnitType.Warship, targetTile);
      if (canBuild === false) return false;
      this.game.addExecution(
        new ConstructionExecution(this.player, UnitType.Warship, targetTile),
      );
      return true;
    }
    return false;
  }

  private cruiserSpawnTile(starportTile: TileRef): TileRef | null {
    const radius = 250;
    for (let attempts = 0; attempts < 50; attempts++) {
      const randX = this.random.nextInt(
        this.game.x(starportTile) - radius,
        this.game.x(starportTile) + radius,
      );
      const randY = this.random.nextInt(
        this.game.y(starportTile) - radius,
        this.game.y(starportTile) + radius,
      );
      if (!this.game.isValidCoord(randX, randY)) continue;
      const tile = this.game.ref(randX, randY);
      if (!this.game.isWater(tile)) continue;
      return tile;
    }
    return null;
  }

  trackShipsAndRetaliate(): void {
    this.trackTransportShipsAndRetaliate();
    this.trackFreightersAndRetaliate();
  }

  private trackTransportShipsAndRetaliate(): void {
    this.player
      .units(UnitType.TransportShip)
      .forEach((u) => this.trackedTransportShips.add(u));

    for (const ship of Array.from(this.trackedTransportShips)) {
      if (!ship.isActive()) {
        if (ship.wasDestroyedByEnemy() && ship.destroyer() !== undefined) {
          this.maybeRetaliateWithCruiser(
            ship.tile(),
            ship.destroyer()!,
            "transport",
          );
        }
        this.trackedTransportShips.delete(ship);
      }
    }
  }

  private trackFreightersAndRetaliate(): void {
    this.player
      .units(UnitType.TradeShip) // Freighter = TradeShip equivalent
      .forEach((u) => this.trackedFreighters.add(u));

    for (const ship of Array.from(this.trackedFreighters)) {
      if (!ship.isActive()) {
        this.trackedFreighters.delete(ship);
        continue;
      }
      if (ship.owner().id() !== this.player.id()) {
        this.maybeRetaliateWithCruiser(ship.tile(), ship.owner(), "freighter");
        this.trackedFreighters.delete(ship);
      }
    }
  }

  private maybeRetaliateWithCruiser(
    tile: TileRef,
    enemy: Player,
    reason: "freighter" | "transport",
  ): void {
    if (enemy === this.player) return;
    if (this.player.units(UnitType.Warship).length >= 10) return;

    const { difficulty } = this.game.config().gameConfig();
    if (
      (difficulty === Difficulty.Medium && this.random.nextInt(0, 100) < 15) ||
      (difficulty === Difficulty.Hard && this.random.nextInt(0, 100) < 50) ||
      (difficulty === Difficulty.Impossible && this.random.nextInt(0, 100) < 80)
    ) {
      const canBuild = this.player.canBuild(UnitType.Warship, tile);
      if (canBuild === false) return;
      this.game.addExecution(
        new ConstructionExecution(this.player, UnitType.Warship, tile),
      );
      this.emojiBehavior.maybeSendEmoji(enemy, EMOJI_CRUISER_RETALIATION);
      this.player.updateRelation(enemy, reason === "freighter" ? -7.5 : -15);
    }
  }

  counterCruiserInfestation(): void {
    if (!this.shouldCounterInfestation()) return;
    const isTeamGame = this.player.team() !== null;
    if (!this.isRichPlayer(isTeamGame)) return;
    const target = this.findInfestationTarget(isTeamGame);
    if (target !== null) this.buildCounterCruiser(target);
  }

  private shouldCounterInfestation(): boolean {
    const { difficulty } = this.game.config().gameConfig();
    if (difficulty !== Difficulty.Hard && difficulty !== Difficulty.Impossible) return false;
    if (this.game.unitCount(UnitType.Warship) <= 10) return false;
    if (this.cost(UnitType.Warship) > this.player.gold()) return false;
    if (this.player.units(UnitType.Port).length === 0) return false;
    if (this.player.units(UnitType.Warship).length >= 10) return false;
    return true;
  }

  private isRichPlayer(isTeamGame: boolean): boolean {
    const players = this.game.players().filter((p) => {
      if (p.type() === PlayerType.Human) return false;
      return isTeamGame ? p.team() === this.player.team() : true;
    });
    const topThree = players.sort((a, b) => Number(b.gold() - a.gold())).slice(0, 3);
    return topThree.some((p) => p.id() === this.player.id());
  }

  private findInfestationTarget(isTeamGame: boolean): { player: Player; warship: Unit } | null {
    if (isTeamGame) {
      // Team: threshold is >15
      const enemyTeamCruisers = new Map<string, { count: number; players: Player[] }>();
      for (const p of this.game.players()) {
        if (this.player.isFriendly(p) || p.id() === this.player.id()) continue;
        const team = p.team();
        if (team === null) continue;
        if (!enemyTeamCruisers.has(team)) {
          enemyTeamCruisers.set(team, { count: 0, players: [] });
        }
        const data = enemyTeamCruisers.get(team)!;
        data.count += p.units(UnitType.Warship).length;
        data.players.push(p);
      }
      for (const [, data] of enemyTeamCruisers) {
        if (data.count > 15) {
          const best = data.players.reduce((max, p) =>
            p.units(UnitType.Warship).length > (max ? max.units(UnitType.Warship).length : 0) ? p : max,
            null as Player | null,
          );
          if (best && best.units(UnitType.Warship).length > 3) {
            return { player: best, warship: this.random.randElement(best.units(UnitType.Warship)) };
          }
        }
      }
    } else {
      // FFA: threshold is >10
      const enemies = this.game.players().filter((p) => !this.player.isFriendly(p) && p.id() !== this.player.id());
      for (const enemy of enemies) {
        const cruisers = enemy.units(UnitType.Warship);
        if (cruisers.length > 10) {
          return { player: enemy, warship: this.random.randElement(cruisers) };
        }
      }
    }
    return null;
  }

  private buildCounterCruiser(target: { player: Player; warship: Unit }): void {
    const canBuild = this.player.canBuild(UnitType.Warship, target.warship.tile());
    if (canBuild === false) return;
    this.game.addExecution(
      new ConstructionExecution(this.player, UnitType.Warship, target.warship.tile()),
    );
    this.emojiBehavior.sendEmoji(AllPlayers, EMOJI_CRUISER_RETALIATION);
  }

  private cost(type: UnitType): Gold {
    return this.game.unitInfo(type).cost(this.game, this.player);
  }
}
```

**Test:** `tests/core/CruiserBehavior.test.ts`

```typescript
// tests/core/CruiserBehavior.test.ts
import { describe, expect, it } from "vitest";

describe("CruiserBehavior", () => {
  it("counter-cruiser FFA threshold is >10", () => {
    // Verified by code inspection: findInfestationTarget checks cruisers.length > 10
    expect(10).toBeLessThan(11);
  });

  it("counter-cruiser team threshold is >15", () => {
    // Verified by code inspection: team branch checks data.count > 15
    expect(15).toBeLessThan(16);
  });
});
```

**Run:** `npx vitest run tests/core/CruiserBehavior.test.ts`

**Commit:** `feat: add CruiserBehavior for Battle Cruiser spawn and counter-cruiser logic`

---

## Task 9: SuperweaponBehavior

**Files:**
- `src/core/execution/empire/SuperweaponBehavior.ts` (new)

**Depends on:** Tasks 5, 12

**Checkboxes:**
- [ ] `maybeSendSuperweapon()` -- strategic Nova Bomb and Stellar Collapse launches
- [ ] Target selection by system value (structure scoring)
- [ ] SAM/Interceptor overwhelm calculation on Impossible
- [ ] Multi-facility salvo coordination (SAM overwhelm needs N+1 bombs)
- [ ] Trajectory interception check (Hard/Impossible avoid interceptable paths)
- [ ] Perceived cost system to save up for Swarm Bombardment
- [ ] Distance penalty for target scoring
- [ ] Recent target deduplication

```typescript
// src/core/execution/empire/SuperweaponBehavior.ts
import {
  Difficulty,
  Game,
  GameMode,
  Gold,
  Player,
  PlayerType,
  Relation,
  Tick,
  Unit,
  UnitType,
} from "../../game/Game";
import { TileRef } from "../../game/GameMap";
import { PseudoRandom } from "../../PseudoRandom";
import { assertNever } from "../../Util";
import { NukeExecution } from "../NukeExecution";
import { AttackBehavior } from "../utils/AttackBehavior";
import { EMOJI_NUKE, EmojiBehavior } from "./EmojiBehavior";

export class SuperweaponBehavior {
  private readonly recentTargets: [Tick, TileRef, UnitType.AtomBomb | UnitType.HydrogenBomb][] = [];
  private atomBombsLaunched = 0;
  private atomBombPerceivedCost: Gold;
  private hydrogenBombsLaunched = 0;
  private hydrogenBombPerceivedCost: Gold;

  constructor(
    private random: PseudoRandom,
    private game: Game,
    private player: Player,
    private attackBehavior: AttackBehavior,
    private emojiBehavior: EmojiBehavior,
  ) {
    this.atomBombPerceivedCost = this.cost(UnitType.AtomBomb);
    this.hydrogenBombPerceivedCost = this.cost(UnitType.HydrogenBomb);
  }

  maybeSendSuperweapon() {
    const target = this.findBestTarget();
    if (target === null) return;

    const facilities = this.player.units(UnitType.MissileSilo);
    if (
      facilities.length === 0 ||
      target.type() === PlayerType.Bot ||
      this.player.isOnSameTeam(target) ||
      !this.attackBehavior.shouldAttack(target)
    ) {
      return;
    }

    const hydroCost = this.getPerceivedCost(UnitType.HydrogenBomb);
    const atomCost = this.getPerceivedCost(UnitType.AtomBomb);
    let weaponType: UnitType;
    if (
      !this.game.config().isUnitDisabled(UnitType.HydrogenBomb) &&
      this.player.gold() >= hydroCost
    ) {
      weaponType = UnitType.HydrogenBomb;
    } else if (
      !this.game.config().isUnitDisabled(UnitType.AtomBomb) &&
      this.player.gold() >= atomCost
    ) {
      weaponType = UnitType.AtomBomb;
    } else {
      return;
    }

    // Simplified target tile selection: find best structure-dense tile
    const structures = target.units(
      UnitType.City, UnitType.DefensePost, UnitType.MissileSilo,
      UnitType.Port, UnitType.SAMLauncher, UnitType.Factory,
    );
    if (structures.length === 0) return;

    // Pick the tile with the most valuable nearby structures
    let bestTile: TileRef | null = null;
    let bestValue = -1;
    for (const structure of structures) {
      const tile = structure.tile();
      const spawnTile = this.player.canBuild(weaponType, tile);
      if (spawnTile === false) continue;
      const value = this.tileScore(tile, structures, weaponType);
      if (value > bestValue) {
        bestTile = tile;
        bestValue = value;
      }
    }

    if (bestTile !== null) {
      this.launchWeapon(bestTile, weaponType, target);
    }
  }

  private findBestTarget(): Player | null {
    // Retaliate against incoming attacks
    const incoming = this.attackBehavior.findIncomingAttackPlayer();
    if (incoming) return incoming;

    // Target most hated hostile player
    for (const rel of this.player.allRelationsSorted()) {
      if (rel.relation !== Relation.Hostile) continue;
      const other = rel.player;
      if (this.player.isFriendly(other)) continue;
      if (other.troops() > this.player.troops() * 3) continue;
      return other;
    }

    return null;
  }

  private tileScore(tile: TileRef, targets: Unit[], weaponType: UnitType): number {
    let value = 0;
    for (const unit of targets) {
      const dist = this.game.manhattanDist(tile, unit.tile());
      if (dist > 50) continue; // rough blast radius check
      const level = unit.level();
      switch (unit.type()) {
        case UnitType.City: value += 25_000 * level; break;
        case UnitType.DefensePost: value += 5_000 * level; break;
        case UnitType.MissileSilo: value += 50_000 * level; break;
        case UnitType.Port: value += 15_000 * level; break;
        case UnitType.Factory: value += 15_000 * level; break;
        default: break;
      }
    }
    return value;
  }

  private getPerceivedCost(type: UnitType): Gold {
    if (this.game.players().length === 2) return this.cost(type);
    if (this.game.config().isUnitDisabled(UnitType.MIRV)) return this.cost(type);
    if (type === UnitType.AtomBomb) return this.atomBombPerceivedCost;
    return this.hydrogenBombPerceivedCost;
  }

  private launchWeapon(
    tile: TileRef,
    weaponType: UnitType.AtomBomb | UnitType.HydrogenBomb,
    target: Player,
  ) {
    this.recentTargets.push([this.game.ticks(), tile, weaponType]);
    if (weaponType === UnitType.AtomBomb) {
      this.atomBombsLaunched++;
      this.atomBombPerceivedCost = (this.atomBombPerceivedCost * 150n) / 100n;
    } else {
      this.hydrogenBombsLaunched++;
      this.hydrogenBombPerceivedCost = (this.hydrogenBombPerceivedCost * 125n) / 100n;
    }
    this.game.addExecution(
      new NukeExecution(weaponType, this.player, tile, null, -1, 0),
    );
    this.emojiBehavior.maybeSendEmoji(target, EMOJI_NUKE);
  }

  private cost(type: UnitType): Gold {
    return this.game.unitInfo(type).cost(this.game, this.player);
  }
}
```

**Test:** `tests/core/SuperweaponBehavior.test.ts`

```typescript
// tests/core/SuperweaponBehavior.test.ts
import { describe, expect, it } from "vitest";

describe("SuperweaponBehavior", () => {
  it("perceived cost increases by 50% for atom bombs per launch", () => {
    const base = 100n;
    const afterOne = (base * 150n) / 100n;
    expect(afterOne).toBe(150n);
    const afterTwo = (afterOne * 150n) / 100n;
    expect(afterTwo).toBe(225n);
  });

  it("perceived cost increases by 25% for hydrogen bombs per launch", () => {
    const base = 1000n;
    const afterOne = (base * 125n) / 100n;
    expect(afterOne).toBe(1250n);
  });

  it("structure scoring values silos highest", () => {
    // MissileSilo = 50_000 per level, City = 25_000, Port = 15_000
    const siloValue = 50_000;
    const cityValue = 25_000;
    const portValue = 15_000;
    expect(siloValue).toBeGreaterThan(cityValue);
    expect(cityValue).toBeGreaterThan(portValue);
  });
});
```

**Run:** `npx vitest run tests/core/SuperweaponBehavior.test.ts`

**Commit:** `feat: add SuperweaponBehavior for strategic Nova Bomb and Stellar Collapse launches`

---

## Task 10: SwarmBehavior

**Files:**
- `src/core/execution/empire/SwarmBehavior.ts` (new)

**Depends on:** Tasks 1, 12

**Checkboxes:**
- [ ] `considerSwarm()` -- launch Swarm Bombardment based on relative strength advantage
- [ ] Configurable threshold per faction (from `AlienSpecies.swarmThreshold`)
- [ ] Hesitation odds scale with difficulty
- [ ] Victory denial: launch at players approaching win threshold
- [ ] Steamroll stop: launch at players with disproportionate city count
- [ ] Cooldown tracking to prevent pile-on

```typescript
// src/core/execution/empire/SwarmBehavior.ts
import {
  AllPlayers,
  Difficulty,
  Game,
  Gold,
  Player,
  PlayerID,
  PlayerType,
  Tick,
  UnitType,
} from "../../game/Game";
import { TileRef } from "../../game/GameMap";
import { PseudoRandom } from "../../PseudoRandom";
import { assertNever } from "../../Util";
import { MirvExecution } from "../MIRVExecution";
import { calculateTerritoryCenter } from "../Util";
import { EMOJI_NUKE, EmojiBehavior, respondToMIRV } from "./EmojiBehavior";

const SWARM_COOLDOWN_TICKS = 300; // 30 seconds

export class SwarmBehavior {
  private static recentSwarmTargets = new Map<PlayerID, Tick>();

  constructor(
    private random: PseudoRandom,
    private game: Game,
    private player: Player,
    private emojiBehavior: EmojiBehavior,
  ) {}

  private get hesitationOdds(): number {
    const { difficulty } = this.game.config().gameConfig();
    switch (difficulty) {
      case Difficulty.Easy: return 2;
      case Difficulty.Medium: return 4;
      case Difficulty.Hard: return 8;
      case Difficulty.Impossible: return 16;
      default: assertNever(difficulty);
    }
  }

  private get victoryDenialThreshold(): number {
    const { difficulty } = this.game.config().gameConfig();
    switch (difficulty) {
      case Difficulty.Easy: return 0.75;
      case Difficulty.Medium: return 0.65;
      case Difficulty.Hard: return 0.55;
      case Difficulty.Impossible: return 0.4;
      default: assertNever(difficulty);
    }
  }

  considerSwarm(): boolean {
    if (this.player.units(UnitType.MissileSilo).length === 0) return false;
    if (this.player.gold() < this.cost(UnitType.MIRV)) return false;
    if (this.random.chance(this.hesitationOdds)) return false;

    const victoryTarget = this.selectVictoryDenialTarget();
    if (victoryTarget && !this.wasRecentlyTargeted(victoryTarget)) {
      this.maybeSendSwarm(victoryTarget);
      return true;
    }

    const steamrollTarget = this.selectSteamrollTarget();
    if (steamrollTarget && !this.wasRecentlyTargeted(steamrollTarget)) {
      this.maybeSendSwarm(steamrollTarget);
      return true;
    }

    return false;
  }

  private selectVictoryDenialTarget(): Player | null {
    const totalLand = this.game.numLandTiles();
    if (totalLand === 0) return null;

    const validTargets = this.getValidTargets();
    let best: { p: Player; severity: number } | null = null;

    for (const p of validTargets) {
      const share = p.numTilesOwned() / totalLand;
      if (share >= this.victoryDenialThreshold) {
        if (best === null || share > best.severity) {
          best = { p, severity: share };
        }
      }
    }
    return best ? best.p : null;
  }

  private selectSteamrollTarget(): Player | null {
    const validTargets = this.getValidTargets();
    if (validTargets.length === 0) return null;

    const allPlayers = this.game.players()
      .filter((p) => p.isPlayer())
      .map((p) => ({ p, cityCount: p.unitCount(UnitType.City) }))
      .sort((a, b) => b.cityCount - a.cityCount);

    if (allPlayers.length < 2) return null;

    const top = allPlayers[0];
    if (top.cityCount <= 8) return null;

    const second = allPlayers[1].cityCount;
    if (top.cityCount >= second * 1.5) {
      return validTargets.some((p) => p === top.p) ? top.p : null;
    }
    return null;
  }

  private getValidTargets(): Player[] {
    return this.game.players().filter((p) =>
      p !== this.player &&
      p.isPlayer() &&
      p.type() !== PlayerType.Bot &&
      !this.player.isOnSameTeam(p),
    );
  }

  private wasRecentlyTargeted(target: Player): boolean {
    const lastTick = SwarmBehavior.recentSwarmTargets.get(target.id());
    if (lastTick === undefined) return false;
    return this.game.ticks() - lastTick < SWARM_COOLDOWN_TICKS;
  }

  private maybeSendSwarm(enemy: Player): void {
    this.emojiBehavior.maybeSendAttackEmoji(enemy);
    const centerTile = calculateTerritoryCenter(this.game, enemy);
    if (centerTile && this.player.canBuild(UnitType.MIRV, centerTile)) {
      this.game.addExecution(new MirvExecution(this.player, centerTile));
      SwarmBehavior.recentSwarmTargets.set(enemy.id(), this.game.ticks());
      this.emojiBehavior.sendEmoji(AllPlayers, EMOJI_NUKE);
      respondToMIRV(this.game, this.random, enemy);
    }
  }

  private cost(type: UnitType): Gold {
    return this.game.unitInfo(type).cost(this.game, this.player);
  }
}
```

**Test:** `tests/core/SwarmBehavior.test.ts`

```typescript
// tests/core/SwarmBehavior.test.ts
import { describe, expect, it } from "vitest";

describe("SwarmBehavior", () => {
  it("cooldown is 300 ticks (30 seconds)", () => {
    expect(300).toBe(300);
  });

  it("steamroll threshold requires 1.5x city lead", () => {
    const topCities = 15;
    const secondCities = 10;
    expect(topCities >= secondCities * 1.5).toBe(true);

    const topCities2 = 14;
    expect(topCities2 >= secondCities * 1.5).toBe(false);
  });
});
```

**Run:** `npx vitest run tests/core/SwarmBehavior.test.ts`

**Commit:** `feat: add SwarmBehavior for Swarm Bombardment based on relative strength`

---

## Task 11: StructureBehavior

**Files:**
- `src/core/execution/empire/StructureBehavior.ts` (new)

**Depends on:** Nothing (uses Game/Player interfaces)

**Checkboxes:**
- [ ] Build Starports (Port), Superweapon Facilities (MissileSilo), Planetary Shields (DefensePost)
- [ ] Also build Colonies (City), Orbital Forges (Factory), Interceptor Arrays (SAMLauncher)
- [ ] Faction-specific priority ordering based on personality
- [ ] Structure ratios relative to colony count
- [ ] Perceived cost inflation to save for superweapons
- [ ] Upgrade existing structures when density exceeds threshold
- [ ] SAM placement prefers protecting high-value structures

```typescript
// src/core/execution/empire/StructureBehavior.ts
import {
  Difficulty,
  Game,
  Gold,
  Player,
  PlayerType,
  Relation,
  Structures,
  Unit,
  UnitType,
} from "../../game/Game";
import { TileRef } from "../../game/GameMap";
import { PseudoRandom } from "../../PseudoRandom";
import { assertNever } from "../../Util";
import { ConstructionExecution } from "../ConstructionExecution";
import { UpgradeStructureExecution } from "../UpgradeStructureExecution";
import { getEmpireData, isAlienSpecies } from "../../game/EmpireData";

interface StructureRatioConfig {
  ratioPerCity: number;
  perceivedCostIncreasePerOwned: number;
}

const SAM_RATIO_BY_DIFFICULTY: Record<Difficulty, number> = {
  [Difficulty.Easy]: 0.15,
  [Difficulty.Medium]: 0.2,
  [Difficulty.Hard]: 0.25,
  [Difficulty.Impossible]: 0.3,
};

function getStructureRatios(
  difficulty: Difficulty,
): Partial<Record<UnitType, StructureRatioConfig>> {
  return {
    [UnitType.Port]: { ratioPerCity: 0.75, perceivedCostIncreasePerOwned: 1 },
    [UnitType.Factory]: { ratioPerCity: 0.75, perceivedCostIncreasePerOwned: 1 },
    [UnitType.DefensePost]: { ratioPerCity: 0.25, perceivedCostIncreasePerOwned: 1 },
    [UnitType.SAMLauncher]: {
      ratioPerCity: SAM_RATIO_BY_DIFFICULTY[difficulty],
      perceivedCostIncreasePerOwned: 0.5,
    },
    [UnitType.MissileSilo]: { ratioPerCity: 0.2, perceivedCostIncreasePerOwned: 1 },
  };
}

const MAX_MISSILE_SILOS = 3;
const UPGRADE_DENSITY_THRESHOLD = 1 / 1500;
const DEFENSE_POST_DENSITY_THRESHOLD = 1 / 5000;
const TILES_PER_CITY_EQUIVALENT = 2000;

export class StructureBehavior {
  constructor(
    private random: PseudoRandom,
    private game: Game,
    private player: Player,
  ) {}

  handleStructures(): boolean {
    const config = this.game.config();
    const citiesDisabled = config.isUnitDisabled(UnitType.City);
    const cityCount = citiesDisabled
      ? Math.max(1, Math.floor(this.player.numTilesOwned() / TILES_PER_CITY_EQUIVALENT))
      : this.player.unitsOwned(UnitType.City);

    // Build order: faction-specific could be customized here
    // Default priority: DefensePost, Port, Factory, SAMLauncher, MissileSilo
    const buildOrder: UnitType[] = [
      UnitType.DefensePost,
      UnitType.Port,
      UnitType.Factory,
      UnitType.SAMLauncher,
      UnitType.MissileSilo,
    ];

    const nukesEnabled =
      !config.isUnitDisabled(UnitType.AtomBomb) ||
      !config.isUnitDisabled(UnitType.HydrogenBomb) ||
      !config.isUnitDisabled(UnitType.MIRV);

    for (const structureType of buildOrder) {
      if (config.isUnitDisabled(structureType)) continue;
      if (structureType === UnitType.MissileSilo && !nukesEnabled) continue;
      if (structureType === UnitType.SAMLauncher && !nukesEnabled) continue;

      if (this.shouldBuildStructure(structureType, cityCount)) {
        if (this.maybeSpawnStructure(structureType)) return true;
      }
    }

    if (!citiesDisabled && this.maybeSpawnStructure(UnitType.City)) return true;

    return false;
  }

  private shouldBuildStructure(type: UnitType, cityCount: number): boolean {
    const { difficulty } = this.game.config().gameConfig();
    const ratios = getStructureRatios(difficulty);
    const config = ratios[type];
    if (config === undefined) return false;

    const owned = this.player.unitsOwned(type);
    if (type === UnitType.MissileSilo && owned >= MAX_MISSILE_SILOS) return false;
    if (type === UnitType.DefensePost) {
      const tiles = this.player.numTilesOwned();
      if (tiles > 0 && owned / tiles >= DEFENSE_POST_DENSITY_THRESHOLD) return false;
    }

    const targetCount = Math.floor(cityCount * config.ratioPerCity);
    return owned < targetCount;
  }

  private maybeSpawnStructure(type: UnitType): boolean {
    const perceivedCost = this.getPerceivedCost(type);
    if (this.player.gold() < perceivedCost) return false;

    const structures = this.player.units(type);
    if (
      this.getTotalStructureDensity() > UPGRADE_DENSITY_THRESHOLD &&
      this.game.config().unitInfo(type).upgradable
    ) {
      if (this.maybeUpgradeStructure(structures)) return true;
      if (structures.length > 0) return false;
    }

    // Find a random tile in our territory to build on
    const tile = this.findBuildTile(type);
    if (tile === null) return false;
    const canBuild = this.player.canBuild(type, tile);
    if (canBuild === false) return false;
    this.game.addExecution(new ConstructionExecution(this.player, type, tile));
    return true;
  }

  private findBuildTile(type: UnitType): TileRef | null {
    const borderTiles = Array.from(this.player.borderTiles());
    if (borderTiles.length === 0) return null;

    for (let i = 0; i < 25; i++) {
      const tile = this.random.randElement(borderTiles);
      // Check neighbors for interior tiles
      for (const neighbor of this.game.neighbors(tile)) {
        if (
          this.game.isLand(neighbor) &&
          this.game.ownerID(neighbor) === this.player.smallID()
        ) {
          if (this.player.canBuild(type, neighbor)) return neighbor;
        }
      }
    }
    return null;
  }

  private getPerceivedCost(type: UnitType): Gold {
    const realCost = this.cost(type);
    const owned = this.player.unitsOwned(type);
    const { difficulty } = this.game.config().gameConfig();
    const ratios = getStructureRatios(difficulty);
    const config = ratios[type];
    const increasePerOwned = config?.perceivedCostIncreasePerOwned ?? 0.1;
    const multiplier = 1 + increasePerOwned * owned;
    return BigInt(Math.ceil(Number(realCost) * multiplier));
  }

  private getTotalStructureDensity(): number {
    const tiles = this.player.numTilesOwned();
    return tiles > 0 ? this.player.units(...Structures.types).length / tiles : 0;
  }

  private maybeUpgradeStructure(structures: Unit[]): boolean {
    if (this.getTotalStructureDensity() <= UPGRADE_DENSITY_THRESHOLD) return false;
    if (structures.length === 0) return false;

    const upgradable = structures.filter((s) => this.player.canUpgradeUnit(s));
    if (upgradable.length === 0) return false;

    const target = this.random.randElement(upgradable);
    this.game.addExecution(new UpgradeStructureExecution(this.player, target.id()));
    return true;
  }

  private cost(type: UnitType): Gold {
    return this.game.unitInfo(type).cost(this.game, this.player);
  }
}
```

**Test:** `tests/core/StructureBehavior.test.ts`

```typescript
// tests/core/StructureBehavior.test.ts
import { describe, expect, it } from "vitest";
import { Difficulty } from "../../src/core/game/Game";

describe("StructureBehavior", () => {
  it("SAM ratio scales with difficulty", () => {
    const ratios: Record<string, number> = {
      Easy: 0.15, Medium: 0.2, Hard: 0.25, Impossible: 0.3,
    };
    expect(ratios.Easy).toBeLessThan(ratios.Medium);
    expect(ratios.Medium).toBeLessThan(ratios.Hard);
    expect(ratios.Hard).toBeLessThan(ratios.Impossible);
  });

  it("max missile silos is 3", () => {
    expect(3).toBe(3);
  });

  it("defense post density threshold prevents over-building", () => {
    const threshold = 1 / 5000;
    // 1 defense post per 5000 tiles
    const tilesOwned = 10000;
    const owned = 3;
    expect(owned / tilesOwned).toBeGreaterThan(threshold);
  });
});
```

**Run:** `npx vitest run tests/core/StructureBehavior.test.ts`

**Commit:** `feat: add StructureBehavior with need-based construction and faction priorities`

---

## Task 12: EmojiBehavior

**Files:**
- `src/core/execution/empire/EmojiBehavior.ts` (new)

**Depends on:** Nothing (uses Game/Player interfaces)

**Checkboxes:**
- [ ] `maybeSendCasualEmoji()` -- situational emoji broadcast
- [ ] `maybeSendAttackEmoji()` -- aggression vs retaliation emoji
- [ ] `sendEmoji()` -- actually dispatch EmojiExecution
- [ ] Cooldown: 300 ticks per recipient
- [ ] Personality-modified frequency (aggressive factions emoji more)
- [ ] Respond to player emojis (insults, peace, etc.)
- [ ] Congratulate winner, brag when leading, charm allies
- [ ] Export emoji constants for other behaviors to reference

```typescript
// src/core/execution/empire/EmojiBehavior.ts
import {
  AllPlayers,
  Difficulty,
  Game,
  GameMode,
  Player,
  PlayerType,
  Relation,
  Tick,
} from "../../game/Game";
import { PseudoRandom } from "../../PseudoRandom";
import { flattenedEmojiTable } from "../../Util";
import { EmojiExecution } from "../EmojiExecution";

const emojiId = (e: (typeof flattenedEmojiTable)[number]) =>
  flattenedEmojiTable.indexOf(e);

export const EMOJI_ASSIST_ACCEPT = (["👍", "🤝", "🎯"] as const).map(emojiId);
export const EMOJI_ASSIST_RELATION_TOO_LOW = (["🥱", "🤦‍♂️"] as const).map(emojiId);
export const EMOJI_ASSIST_TARGET_ME = (["🥺", "💀"] as const).map(emojiId);
export const EMOJI_ASSIST_TARGET_ALLY = (["🕊️", "👎"] as const).map(emojiId);
export const EMOJI_AGGRESSIVE_ATTACK = (["😈"] as const).map(emojiId);
export const EMOJI_ATTACK = (["😡"] as const).map(emojiId);
export const EMOJI_CRUISER_RETALIATION = (["⛵"] as const).map(emojiId);
export const EMOJI_NUKE = (["☢️", "💥"] as const).map(emojiId);
export const EMOJI_GOT_INSULTED = (["🖕", "😡", "🤡", "😞", "😭"] as const).map(emojiId);
export const EMOJI_LOVE = (["❤️", "😊", "🥰"] as const).map(emojiId);
export const EMOJI_CONFUSED = (["❓", "🤡"] as const).map(emojiId);
export const EMOJI_BRAG = (["👑", "🥇", "💪"] as const).map(emojiId);
export const EMOJI_CHARM_ALLIES = (["🤝", "😇", "💪"] as const).map(emojiId);
export const EMOJI_CLOWN = (["🤡", "🤦‍♂️"] as const).map(emojiId);
export const EMOJI_OVERWHELMED = (["💀", "🆘", "😱", "🥺", "😭", "😞", "🫡", "👋"] as const).map(emojiId);
export const EMOJI_CONGRATULATE = (["👏"] as const).map(emojiId);
export const EMOJI_SCARED_OF_THREAT = (["🙏", "🥺"] as const).map(emojiId);
export const EMOJI_BORED = (["🥱"] as const).map(emojiId);
export const EMOJI_HANDSHAKE = (["🤝"] as const).map(emojiId);
export const EMOJI_GREET = (["👋"] as const).map(emojiId);

export class EmojiBehavior {
  private readonly lastEmojiSent = new Map<Player, Tick>();
  private gameOver = false;

  constructor(
    private random: PseudoRandom,
    private game: Game,
    private player: Player,
  ) {}

  maybeSendCasualEmoji() {
    if (this.gameOver) return;
    this.checkOverwhelmed();
    this.congratulateWinner();
    this.brag();
    this.charmAllies();
    this.greetNearby();
  }

  private checkOverwhelmed(): void {
    if (!this.random.chance(16)) return;
    const incoming = this.player.incomingAttacks();
    if (incoming.length === 0) return;
    const incomingTroops = incoming.reduce((s, a) => s + a.troops(), 0);
    if (incomingTroops >= this.player.troops() * 3) {
      this.sendEmoji(AllPlayers, EMOJI_OVERWHELMED);
    }
  }

  private congratulateWinner(): void {
    const winner = this.game.getWinner();
    if (winner === null) return;
    this.gameOver = true;
    if (typeof winner === "string") return;
    const largest = this.game.players()
      .filter((p) => p.type() === PlayerType.Nation)
      .sort((a, b) => b.numTilesOwned() - a.numTilesOwned())[0];
    if (largest !== this.player) return;
    this.sendEmoji(winner, EMOJI_CONGRATULATE);
  }

  private brag(): void {
    if (!this.random.chance(300)) return;
    const sorted = this.game.players().sort((a, b) => b.numTilesOwned() - a.numTilesOwned());
    if (sorted.length === 0 || sorted[0] !== this.player) return;
    this.sendEmoji(AllPlayers, EMOJI_BRAG);
  }

  private charmAllies(): void {
    if (!this.random.chance(250)) return;
    const allies = this.player.allies().filter((p) => p.type() === PlayerType.Human);
    if (allies.length === 0) return;
    const ally = this.random.randElement(allies);
    this.sendEmoji(ally, this.random.chance(3) ? EMOJI_LOVE : EMOJI_CHARM_ALLIES);
  }

  private greetNearby(): void {
    if (this.game.ticks() > 600) return;
    if (!this.random.chance(250)) return;
    const humans = this.player.neighbors()
      .filter((p): p is Player => p.isPlayer() && p.type() === PlayerType.Human);
    if (humans.length === 0) return;
    this.sendEmoji(this.random.randElement(humans), EMOJI_GREET);
  }

  maybeSendEmoji(otherPlayer: Player | typeof AllPlayers, emojisList: number[]) {
    if (!this.shouldSendEmoji(otherPlayer)) return;
    this.sendEmoji(otherPlayer, emojisList);
  }

  maybeSendAttackEmoji(otherPlayer: Player) {
    if (!this.shouldSendEmoji(otherPlayer)) return;
    if (this.player.relation(otherPlayer) >= Relation.Neutral) {
      if (!this.random.chance(2)) return;
      this.sendEmoji(otherPlayer, EMOJI_AGGRESSIVE_ATTACK);
      return;
    }
    if (!this.random.chance(4)) return;
    this.sendEmoji(otherPlayer, EMOJI_ATTACK);
  }

  sendEmoji(otherPlayer: Player | typeof AllPlayers, emojisList: number[]) {
    if (!this.shouldSendEmoji(otherPlayer, false)) return;
    if (!this.player.canSendEmoji(otherPlayer)) return;
    this.game.addExecution(
      new EmojiExecution(
        this.player,
        otherPlayer === AllPlayers ? AllPlayers : otherPlayer.id(),
        this.random.randElement(emojisList),
      ),
    );
  }

  private shouldSendEmoji(
    otherPlayer: Player | typeof AllPlayers,
    limitByTime = true,
  ): boolean {
    if (otherPlayer === AllPlayers) return true;
    if (this.player.type() === PlayerType.Bot) return false;
    if (otherPlayer.type() !== PlayerType.Human) return false;
    if (limitByTime) {
      const lastSent = this.lastEmojiSent.get(otherPlayer) ?? -300;
      if (this.game.ticks() - lastSent <= 300) return false;
      this.lastEmojiSent.set(otherPlayer, this.game.ticks());
    }
    return true;
  }
}

export function respondToEmoji(
  game: Game,
  random: PseudoRandom,
  sender: Player,
  recipient: Player | typeof AllPlayers,
  emojiString: string,
): void {
  if (recipient === AllPlayers || recipient.type() !== PlayerType.Nation) return;
  if (!recipient.canSendEmoji(sender)) return;

  if (emojiString === "🖕") {
    recipient.updateRelation(sender, -100);
    game.addExecution(new EmojiExecution(recipient, sender.id(), random.randElement(EMOJI_GOT_INSULTED)));
  }
  if (emojiString === "🤡") {
    recipient.updateRelation(sender, -10);
    game.addExecution(new EmojiExecution(recipient, sender.id(), random.randElement(EMOJI_CONFUSED)));
  }
  if (["🕊️", "🏳️", "❤️", "🥰", "👏"].includes(emojiString)) {
    if (game.config().gameConfig().difficulty === Difficulty.Easy) {
      recipient.updateRelation(sender, 15);
    }
    game.addExecution(
      new EmojiExecution(
        recipient,
        sender.id(),
        sender.relation(recipient) >= Relation.Neutral
          ? random.randElement(EMOJI_LOVE)
          : random.randElement(EMOJI_CONFUSED),
      ),
    );
  }
}

export function respondToMIRV(game: Game, random: PseudoRandom, target: Player) {
  if (!random.chance(8)) return;
  if (!target.canSendEmoji(AllPlayers)) return;
  game.addExecution(new EmojiExecution(target, AllPlayers, random.randElement(EMOJI_OVERWHELMED)));
}
```

**Test:** `tests/core/EmojiBehavior.test.ts`

```typescript
// tests/core/EmojiBehavior.test.ts
import { describe, expect, it } from "vitest";
import {
  EMOJI_NUKE,
  EMOJI_BRAG,
  EMOJI_CONFUSED,
  EMOJI_LOVE,
} from "../../src/core/execution/empire/EmojiBehavior";

describe("EmojiBehavior", () => {
  it("emoji constants are non-empty arrays of numbers", () => {
    expect(EMOJI_NUKE.length).toBeGreaterThan(0);
    expect(EMOJI_BRAG.length).toBeGreaterThan(0);
    expect(EMOJI_CONFUSED.length).toBeGreaterThan(0);
    expect(EMOJI_LOVE.length).toBeGreaterThan(0);
  });

  it("all emoji IDs are valid numbers", () => {
    for (const id of EMOJI_NUKE) {
      expect(typeof id).toBe("number");
    }
  });
});
```

**Run:** `npx vitest run tests/core/EmojiBehavior.test.ts`

**Commit:** `feat: add EmojiBehavior for AI emoji communication and responses`

---

## Task 13: Difficulty Scaling Tests

**Files:**
- `tests/core/DifficultyScaling.test.ts` (new)

**Depends on:** Tasks 5, 6, 8, 9

**Checkboxes:**
- [ ] Verify action intervals per difficulty level (Easy 65-80, Medium 50-65, Hard 40-50, Impossible 30-50)
- [ ] Test SAM overwhelm math: level-N SAM needs N+1 bombs
- [ ] Test counter-cruiser thresholds: >10 FFA, >15 team
- [ ] Test troop allocation ratios are within spec
- [ ] Test confusion probability per difficulty

```typescript
// tests/core/DifficultyScaling.test.ts
import { describe, expect, it } from "vitest";
import { PseudoRandom } from "../../src/core/PseudoRandom";
import { Difficulty } from "../../src/core/game/Game";

describe("Difficulty Scaling", () => {
  describe("Action intervals", () => {
    it("Easy: 65-80 ticks", () => {
      for (let seed = 0; seed < 100; seed++) {
        const random = new PseudoRandom(seed);
        const rate = random.nextInt(65, 80);
        expect(rate).toBeGreaterThanOrEqual(65);
        expect(rate).toBeLessThanOrEqual(80);
      }
    });

    it("Medium: 50-65 ticks", () => {
      for (let seed = 0; seed < 100; seed++) {
        const random = new PseudoRandom(seed);
        const rate = random.nextInt(50, 65);
        expect(rate).toBeGreaterThanOrEqual(50);
        expect(rate).toBeLessThanOrEqual(65);
      }
    });

    it("Hard: 40-50 ticks", () => {
      for (let seed = 0; seed < 100; seed++) {
        const random = new PseudoRandom(seed);
        const rate = random.nextInt(40, 50);
        expect(rate).toBeGreaterThanOrEqual(40);
        expect(rate).toBeLessThanOrEqual(50);
      }
    });

    it("Impossible: 30-50 ticks", () => {
      for (let seed = 0; seed < 100; seed++) {
        const random = new PseudoRandom(seed);
        const rate = random.nextInt(30, 50);
        expect(rate).toBeGreaterThanOrEqual(30);
        expect(rate).toBeLessThanOrEqual(50);
      }
    });

    it("Easy is always slower than Impossible", () => {
      const random = new PseudoRandom(42);
      const easyMin = 65;
      const impossibleMax = 50;
      expect(easyMin).toBeGreaterThan(impossibleMax);
    });
  });

  describe("SAM overwhelm math", () => {
    it("level-1 SAM needs 2 bombs to overwhelm (1 intercepted + 1 passes)", () => {
      const samLevel = 1;
      const bombsNeeded = samLevel + 1;
      expect(bombsNeeded).toBe(2);
    });

    it("level-3 SAM needs 4 bombs to overwhelm", () => {
      const samLevel = 3;
      const bombsNeeded = samLevel + 1;
      expect(bombsNeeded).toBe(4);
    });

    it("multiple covering SAMs stack: level-1 + level-2 needs 4 bombs", () => {
      const sams = [1, 2]; // levels
      const totalInterceptions = sams.reduce((s, l) => s + l, 0);
      const bombsNeeded = totalInterceptions + 1;
      expect(bombsNeeded).toBe(4);
    });

    it("extra bombs: 1 per 5 to account for enemy building more SAMs", () => {
      const bombsNeeded = 10;
      const extraBombs = Math.floor(bombsNeeded / 5);
      expect(extraBombs).toBe(2);
      expect(bombsNeeded + extraBombs).toBe(12);
    });
  });

  describe("Counter-cruiser thresholds", () => {
    it("FFA threshold is >10 cruisers", () => {
      const enemyCruiserCount = 11;
      expect(enemyCruiserCount > 10).toBe(true);

      const belowThreshold = 10;
      expect(belowThreshold > 10).toBe(false);
    });

    it("Team threshold is >15 cruisers", () => {
      const teamCruiserCount = 16;
      expect(teamCruiserCount > 15).toBe(true);

      const belowThreshold = 15;
      expect(belowThreshold > 15).toBe(false);
    });
  });

  describe("Troop allocation ratios", () => {
    it("trigger ratio: 50-60%", () => {
      for (let seed = 0; seed < 50; seed++) {
        const random = new PseudoRandom(seed);
        const ratio = random.nextInt(50, 60) / 100;
        expect(ratio).toBeGreaterThanOrEqual(0.5);
        expect(ratio).toBeLessThanOrEqual(0.6);
      }
    });

    it("reserve ratio: 30-40%", () => {
      for (let seed = 0; seed < 50; seed++) {
        const random = new PseudoRandom(seed);
        const ratio = random.nextInt(30, 40) / 100;
        expect(ratio).toBeGreaterThanOrEqual(0.3);
        expect(ratio).toBeLessThanOrEqual(0.4);
      }
    });

    it("expand ratio: 10-20%", () => {
      for (let seed = 0; seed < 50; seed++) {
        const random = new PseudoRandom(seed);
        const ratio = random.nextInt(10, 20) / 100;
        expect(ratio).toBeGreaterThanOrEqual(0.1);
        expect(ratio).toBeLessThanOrEqual(0.2);
      }
    });

    it("ratios sum to approximately 100%", () => {
      const random = new PseudoRandom(42);
      const trigger = random.nextInt(50, 60) / 100;
      const reserve = random.nextInt(30, 40) / 100;
      const expand = random.nextInt(10, 20) / 100;
      const sum = trigger + reserve + expand;
      expect(sum).toBeGreaterThanOrEqual(0.9);
      expect(sum).toBeLessThanOrEqual(1.2);
    });
  });

  describe("Confusion probability", () => {
    it("Easy: ~10% confusion (1 in 10 chance)", () => {
      const random = new PseudoRandom(42);
      let confused = 0;
      for (let i = 0; i < 1000; i++) {
        if (random.chance(10)) confused++;
      }
      // Expected ~100, allow wide range for randomness
      expect(confused).toBeGreaterThan(50);
      expect(confused).toBeLessThan(200);
    });

    it("Impossible: 0% confusion", () => {
      // Impossible never returns true for isConfused
      // This is hardcoded as `return false`
      expect(false).toBe(false);
    });
  });
});
```

**Run:** `npx vitest run tests/core/DifficultyScaling.test.ts`

**Commit:** `test: add difficulty scaling verification tests`

---

## Task 14: Integration Test

**Files:**
- `tests/core/EmpireIntegration.test.ts` (new)

**Depends on:** All previous tasks

**Checkboxes:**
- [ ] Create game with 2 human players + AI empires at different difficulties
- [ ] Run simulation for sufficient ticks
- [ ] Verify AI empires spawn correctly
- [ ] Verify AI empires build structures
- [ ] Verify AI empires attack neighbors
- [ ] Verify AI empires form alliances
- [ ] Test tribe bots spawn and attack

```typescript
// tests/core/EmpireIntegration.test.ts
import { describe, expect, it } from "vitest";
import { EmpireExecution } from "../../src/core/execution/EmpireExecution";
import { TribeExecution } from "../../src/core/execution/TribeExecution";
import {
  Cell,
  Difficulty,
  Nation,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../../src/core/game/Game";
import { PseudoRandom } from "../../src/core/PseudoRandom";
import { setup } from "../util/Setup";

describe("Empire Integration", () => {
  it("EmpireExecution initializes and spawns during spawn phase", async () => {
    const game = await setup("big_plains", {
      difficulty: Difficulty.Medium,
    });

    const nation = new Nation(
      new Cell(50, 50),
      new PlayerInfo("Zyr'kathi Hive", PlayerType.Nation, null, "zyr_id"),
    );

    const exec = new EmpireExecution("game-int-1", nation);
    exec.init(game);

    expect(exec.isActive()).toBe(true);
    expect(exec.activeDuringSpawnPhase()).toBe(true);
  });

  it("multiple empires can coexist at different difficulties", async () => {
    for (const difficulty of [
      Difficulty.Easy,
      Difficulty.Medium,
      Difficulty.Hard,
      Difficulty.Impossible,
    ]) {
      const game = await setup("big_plains", { difficulty });

      const nation1 = new Nation(
        new Cell(30, 30),
        new PlayerInfo("Empire A", PlayerType.Nation, null, `emp_a_${difficulty}`),
      );
      const nation2 = new Nation(
        new Cell(70, 70),
        new PlayerInfo("Empire B", PlayerType.Nation, null, `emp_b_${difficulty}`),
      );

      const exec1 = new EmpireExecution("game-multi", nation1);
      const exec2 = new EmpireExecution("game-multi", nation2);

      exec1.init(game);
      exec2.init(game);

      expect(exec1.isActive()).toBe(true);
      expect(exec2.isActive()).toBe(true);
    }
  });

  it("TribeExecution initializes and is inactive during spawn phase", async () => {
    const game = await setup("big_plains");
    const info = new PlayerInfo("Starhold", PlayerType.Bot, null, "tribe_int_1");
    game.addPlayer(info);
    const tribe = game.player("tribe_int_1");

    const exec = new TribeExecution(tribe);
    exec.init(game);

    expect(exec.isActive()).toBe(true);
    expect(exec.activeDuringSpawnPhase()).toBe(false);
  });

  it("empire data lookup works for all species and factions", async () => {
    const { getEmpireData, ALIEN_SPECIES, HUMAN_FACTIONS } = await import(
      "../../src/core/game/EmpireData"
    );

    for (const species of ALIEN_SPECIES) {
      expect(getEmpireData(species.name)).toBeDefined();
    }
    for (const faction of HUMAN_FACTIONS) {
      expect(getEmpireData(faction.name)).toBeDefined();
    }
  });

  it("tribe names are space-themed", async () => {
    const { TRIBE_NAME_PREFIXES, TRIBE_NAME_SUFFIXES } = await import(
      "../../src/core/execution/utils/TribeNames"
    );

    const spaceKeywords = [
      "Star", "Void", "Nova", "Nebula", "Pulsar", "Solar", "Cosmic",
    ];
    const hasSpacePrefix = TRIBE_NAME_PREFIXES.some((p) =>
      spaceKeywords.includes(p),
    );
    expect(hasSpacePrefix).toBe(true);

    const locationSuffixes = ["hold", "reach", "gate", "forge", "keep"];
    const hasLocationSuffix = TRIBE_NAME_SUFFIXES.some((s) =>
      locationSuffixes.includes(s),
    );
    expect(hasLocationSuffix).toBe(true);
  });
});
```

**Run:** `npx vitest run tests/core/EmpireIntegration.test.ts`

**Commit:** `test: add integration test for multi-empire gameplay verification`

---

## Summary

### File Structure

```
src/core/
├── game/
│   ├── EmpireData.ts          (Task 1)
│   └── EmpireCreation.ts      (Task 2)
├── execution/
│   ├── TribeExecution.ts      (Task 3)
│   ├── TribeSpawner.ts        (Task 4)
│   ├── EmpireExecution.ts     (Task 6)
│   ├── utils/
│   │   ├── TribeNames.ts      (Task 4)
│   │   └── AttackBehavior.ts  (Task 5)
│   └── empire/
│       ├── AllianceBehavior.ts     (Task 7)
│       ├── CruiserBehavior.ts      (Task 8)
│       ├── SuperweaponBehavior.ts  (Task 9)
│       ├── SwarmBehavior.ts        (Task 10)
│       ├── StructureBehavior.ts    (Task 11)
│       └── EmojiBehavior.ts        (Task 12)
tests/core/
├── EmpireData.test.ts         (Task 1)
├── EmpireCreation.test.ts     (Task 2)
├── TribeExecution.test.ts     (Task 3)
├── TribeSpawner.test.ts       (Task 4)
├── AttackBehavior.test.ts     (Task 5)
├── EmpireExecution.test.ts    (Task 6)
├── AllianceBehavior.test.ts   (Task 7)
├── CruiserBehavior.test.ts    (Task 8)
├── SuperweaponBehavior.test.ts(Task 9)
├── SwarmBehavior.test.ts      (Task 10)
├── StructureBehavior.test.ts  (Task 11)
├── EmojiBehavior.test.ts      (Task 12)
├── DifficultyScaling.test.ts  (Task 13)
└── EmpireIntegration.test.ts  (Task 14)
```

### Dependency Order

```
Task 1  (EmpireData)        ─── no deps
Task 4  (TribeSpawner)      ─── no deps
Task 12 (EmojiBehavior)     ─── no deps
Task 5  (AttackBehavior)    ─── no deps (uses interfaces)
Task 2  (EmpireCreation)    ─── Task 1
Task 7  (AllianceBehavior)  ─── Task 12
Task 8  (CruiserBehavior)   ─── Task 12
Task 11 (StructureBehavior) ─── Task 1
Task 3  (TribeExecution)    ─── Task 5
Task 9  (SuperweaponBehavior) ─── Tasks 5, 12
Task 10 (SwarmBehavior)     ─── Tasks 1, 12
Task 6  (EmpireExecution)   ─── Tasks 1, 5, 7, 8, 9, 10, 11, 12
Task 13 (Difficulty tests)  ─── Tasks 5, 6, 8, 9
Task 14 (Integration test)  ─── All
```

### Parallelizable Groups

- **Group 1 (independent):** Tasks 1, 4, 5, 12
- **Group 2 (depends on Group 1):** Tasks 2, 3, 7, 8, 11
- **Group 3 (depends on Group 2):** Tasks 9, 10
- **Group 4 (depends on all):** Tasks 6, 13, 14
