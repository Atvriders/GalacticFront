// Unit types available in the game
export enum UnitType {
  Colony = "Colony",
  Starport = "Starport",
  OrbitalForge = "OrbitalForge",
  PlanetaryShield = "PlanetaryShield",
  SuperweaponFacility = "SuperweaponFacility",
  InterceptorArray = "InterceptorArray",
  WormholeGenerator = "WormholeGenerator",
  HyperloopStation = "HyperloopStation",
}

export const BUILDABLE_UNITS: readonly UnitType[] = [
  UnitType.Colony,
  UnitType.Starport,
  UnitType.OrbitalForge,
  UnitType.PlanetaryShield,
  UnitType.SuperweaponFacility,
  UnitType.InterceptorArray,
  UnitType.WormholeGenerator,
  UnitType.HyperloopStation,
];

export const UPGRADEABLE_UNITS: readonly UnitType[] = [
  UnitType.Starport,
  UnitType.OrbitalForge,
  UnitType.PlanetaryShield,
  UnitType.SuperweaponFacility,
  UnitType.InterceptorArray,
];

// Player types
export enum PlayerType {
  Human = "human",
  Bot = "bot",
  FakeHuman = "fake_human",
}

// Game difficulty levels
export enum Difficulty {
  Easy = "Easy",
  Medium = "Medium",
  Hard = "Hard",
  Impossible = "Impossible",
}

// Game map types
export enum GameMapType {
  Standard = "Standard",
  Archipelago = "Archipelago",
  Pangaea = "Pangaea",
  Nebula = "Nebula",
  Spiral = "Spiral",
}

// Terrain types (numeric for tile encoding)
export enum TerrainType {
  Space = 0,
  Asteroid = 1,
  Nebula = 2,
  Planet = 3,
}

// Planet types (numeric, 0-7 fits in 3 bits)
export enum PlanetType {
  Barren = 0,
  Terran = 1,
  Oceanic = 2,
  Volcanic = 3,
  GasGiant = 4,
  Ice = 5,
  Desert = 6,
  Nebula = 7,
}

export const PLANET_TYPE_NAMES: Record<PlanetType, string> = {
  [PlanetType.Barren]: "barren",
  [PlanetType.Terran]: "terran",
  [PlanetType.Oceanic]: "oceanic",
  [PlanetType.Volcanic]: "volcanic",
  [PlanetType.GasGiant]: "gasgiant",
  [PlanetType.Ice]: "ice",
  [PlanetType.Desert]: "desert",
  [PlanetType.Nebula]: "nebula",
};

// Diplomatic relations between players
export enum Relation {
  Hostile = "Hostile",
  Neutral = "Neutral",
  Friendly = "Friendly",
  Allied = "Allied",
}

// Message types for in-game communication
export enum MessageType {
  Chat = "Chat",
  Emoji = "Emoji",
  System = "System",
  Alliance = "Alliance",
  Attack = "Attack",
  Surrender = "Surrender",
}

// Game update event types (22 values)
export enum GameUpdateType {
  TileOwnerChange = "TileOwnerChange",
  TroopChange = "TroopChange",
  PlayerSpawned = "PlayerSpawned",
  PlayerEliminated = "PlayerEliminated",
  PlayerSurrendered = "PlayerSurrendered",
  AttackStarted = "AttackStarted",
  AttackEnded = "AttackEnded",
  RetreatStarted = "RetreatStarted",
  RetreatEnded = "RetreatEnded",
  UnitBuilt = "UnitBuilt",
  UnitUpgraded = "UnitUpgraded",
  UnitDestroyed = "UnitDestroyed",
  UnitActivated = "UnitActivated",
  UnitDeactivated = "UnitDeactivated",
  AllianceRequested = "AllianceRequested",
  AllianceFormed = "AllianceFormed",
  AllianceBroken = "AllianceBroken",
  AllianceRequestRejected = "AllianceRequestRejected",
  DonationCompleted = "DonationCompleted",
  EmbargoSet = "EmbargoSet",
  EmbargoClear = "EmbargoClear",
  GameWon = "GameWon",
}
