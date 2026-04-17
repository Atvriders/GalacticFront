// ---------------------------------------------------------------------------
// Empire Data Definitions
// ---------------------------------------------------------------------------

/**
 * Personality flags that drive AI behavior weighting.
 */
export type PersonalityFlag =
  | "aggressive"
  | "defensive"
  | "naval"
  | "balanced"
  | "berserker"
  | "raider";

/**
 * Behavior weights control how the AI allocates its decision budget.
 * Values are relative and normalized at runtime.
 */
export interface BehaviorWeights {
  attack: number;
  defend: number;
  expand: number;
  diplomacy: number;
  build: number;
  superweapon: number;
}

/**
 * Flag colors used for map rendering.
 */
export interface FlagColors {
  primary: string;
  secondary: string;
}

/**
 * Full empire template definition.
 */
export interface EmpireDefinition {
  id: string;
  name: string;
  region: string;
  personality: PersonalityFlag[];
  flagColors: FlagColors;
  weights: BehaviorWeights;
}

// ---------------------------------------------------------------------------
// Alien Species (6)
// ---------------------------------------------------------------------------

export const ALIEN_EMPIRES: readonly EmpireDefinition[] = [
  {
    id: "zyrkathi_hive",
    name: "Zyr'kathi Hive",
    region: "Hive Nebula",
    personality: ["aggressive", "berserker"],
    flagColors: { primary: "#8B0000", secondary: "#FF4500" },
    weights: {
      attack: 0.35,
      defend: 0.1,
      expand: 0.25,
      diplomacy: 0.05,
      build: 0.1,
      superweapon: 0.15,
    },
  },
  {
    id: "crystalline_concord",
    name: "Crystalline Concord",
    region: "Crystal Expanse",
    personality: ["defensive", "balanced"],
    flagColors: { primary: "#00CED1", secondary: "#E0FFFF" },
    weights: {
      attack: 0.1,
      defend: 0.35,
      expand: 0.15,
      diplomacy: 0.2,
      build: 0.15,
      superweapon: 0.05,
    },
  },
  {
    id: "vortani_dominion",
    name: "Vortani Dominion",
    region: "Vortex Reach",
    personality: ["aggressive", "naval"],
    flagColors: { primary: "#4B0082", secondary: "#9370DB" },
    weights: {
      attack: 0.3,
      defend: 0.15,
      expand: 0.2,
      diplomacy: 0.05,
      build: 0.15,
      superweapon: 0.15,
    },
  },
  {
    id: "synth_collective",
    name: "Synth Collective",
    region: "Digital Void",
    personality: ["balanced", "defensive"],
    flagColors: { primary: "#00FF00", secondary: "#003300" },
    weights: {
      attack: 0.15,
      defend: 0.2,
      expand: 0.2,
      diplomacy: 0.15,
      build: 0.25,
      superweapon: 0.05,
    },
  },
  {
    id: "pyrathi_warclans",
    name: "Pyrathi Warclans",
    region: "Ember Fields",
    personality: ["berserker", "raider"],
    flagColors: { primary: "#FF6600", secondary: "#FFD700" },
    weights: {
      attack: 0.4,
      defend: 0.05,
      expand: 0.2,
      diplomacy: 0.05,
      build: 0.1,
      superweapon: 0.2,
    },
  },
  {
    id: "aetheri_nomads",
    name: "Aetheri Nomads",
    region: "Drift Lanes",
    personality: ["raider", "naval"],
    flagColors: { primary: "#1E90FF", secondary: "#87CEEB" },
    weights: {
      attack: 0.2,
      defend: 0.1,
      expand: 0.3,
      diplomacy: 0.15,
      build: 0.1,
      superweapon: 0.15,
    },
  },
] as const;

// ---------------------------------------------------------------------------
// Human Factions (5)
// ---------------------------------------------------------------------------

export const HUMAN_EMPIRES: readonly EmpireDefinition[] = [
  {
    id: "solar_federation",
    name: "Solar Federation",
    region: "Sol System",
    personality: ["balanced", "defensive"],
    flagColors: { primary: "#003366", secondary: "#FFFFFF" },
    weights: {
      attack: 0.2,
      defend: 0.25,
      expand: 0.2,
      diplomacy: 0.15,
      build: 0.15,
      superweapon: 0.05,
    },
  },
  {
    id: "martian_collective",
    name: "Martian Collective",
    region: "Mars Sector",
    personality: ["aggressive", "balanced"],
    flagColors: { primary: "#B22222", secondary: "#CD853F" },
    weights: {
      attack: 0.25,
      defend: 0.2,
      expand: 0.2,
      diplomacy: 0.1,
      build: 0.15,
      superweapon: 0.1,
    },
  },
  {
    id: "outer_rim_alliance",
    name: "Outer Rim Alliance",
    region: "Kuiper Belt",
    personality: ["raider", "naval"],
    flagColors: { primary: "#556B2F", secondary: "#8FBC8F" },
    weights: {
      attack: 0.2,
      defend: 0.1,
      expand: 0.3,
      diplomacy: 0.15,
      build: 0.1,
      superweapon: 0.15,
    },
  },
  {
    id: "centauri_republic",
    name: "Centauri Republic",
    region: "Alpha Centauri",
    personality: ["defensive", "balanced"],
    flagColors: { primary: "#DAA520", secondary: "#FFFFF0" },
    weights: {
      attack: 0.15,
      defend: 0.3,
      expand: 0.15,
      diplomacy: 0.2,
      build: 0.15,
      superweapon: 0.05,
    },
  },
  {
    id: "europa_technocracy",
    name: "Europa Technocracy",
    region: "Jovian Moons",
    personality: ["balanced", "naval"],
    flagColors: { primary: "#4682B4", secondary: "#B0E0E6" },
    weights: {
      attack: 0.15,
      defend: 0.15,
      expand: 0.2,
      diplomacy: 0.1,
      build: 0.3,
      superweapon: 0.1,
    },
  },
] as const;

// ---------------------------------------------------------------------------
// Combined registry
// ---------------------------------------------------------------------------

export const ALL_EMPIRES: readonly EmpireDefinition[] = [
  ...ALIEN_EMPIRES,
  ...HUMAN_EMPIRES,
];

/**
 * Look up an empire definition by id.
 */
export function getEmpireById(id: string): EmpireDefinition | undefined {
  return ALL_EMPIRES.find((e) => e.id === id);
}

/**
 * Check if a personality set includes a given flag.
 */
export function hasPersonality(
  empire: EmpireDefinition,
  flag: PersonalityFlag,
): boolean {
  return empire.personality.includes(flag);
}
