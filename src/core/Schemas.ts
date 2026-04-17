import { z } from "zod";

// ---------------------------------------------------------------------------
// Branded / primitive types
// ---------------------------------------------------------------------------

export type GameID = string & { readonly __brand: "GameID" };
export type ClientID = string & { readonly __brand: "ClientID" };

export const GameIDSchema = z.string().brand<"GameID">();
export const ClientIDSchema = z.string().brand<"ClientID">();

/** Non-negative integer */
export const PlayerIDSchema = z.number().int().nonnegative();
export type PlayerID = z.infer<typeof PlayerIDSchema>;

/** Non-negative integer tile index */
export const TileSchema = z.number().int().nonnegative();
export type Tile = z.infer<typeof TileSchema>;

// ---------------------------------------------------------------------------
// IntentType enum
// ---------------------------------------------------------------------------

export enum IntentType {
  Spawn = "spawn",
  Attack = "attack",
  CancelAttack = "cancel_attack",
  Retreat = "retreat",
  SetTargetTroopRatio = "set_target_troop_ratio",
  SendEmoji = "send_emoji",
  SendAllianceRequest = "send_alliance_request",
  AcceptAllianceRequest = "accept_alliance_request",
  RejectAllianceRequest = "reject_alliance_request",
  BreakAlliance = "break_alliance",
  SetAllianceDuration = "set_alliance_duration",
  Donate = "donate",
  SetEmbargo = "set_embargo",
  ClearEmbargo = "clear_embargo",
  BuildUnit = "build_unit",
  UpgradeUnit = "upgrade_unit",
  ActivateUnit = "activate_unit",
  DeactivateUnit = "deactivate_unit",
  DestroyUnit = "destroy_unit",
  SetName = "set_name",
  Chat = "chat",
  Surrender = "surrender",
  Ping = "ping",
}

// ---------------------------------------------------------------------------
// Individual Intent Schemas
// ---------------------------------------------------------------------------

export const SpawnIntentSchema = z.object({
  type: z.literal(IntentType.Spawn),
  tile: TileSchema,
  name: z.string().min(1).max(32),
});

export const AttackIntentSchema = z.object({
  type: z.literal(IntentType.Attack),
  targetPlayerID: PlayerIDSchema,
  sourceTile: TileSchema,
  troopRatio: z.number().min(0).max(1),
});

export const CancelAttackIntentSchema = z.object({
  type: z.literal(IntentType.CancelAttack),
  targetPlayerID: PlayerIDSchema,
});

export const RetreatIntentSchema = z.object({
  type: z.literal(IntentType.Retreat),
  unitTile: TileSchema,
});

export const SetTargetTroopRatioIntentSchema = z.object({
  type: z.literal(IntentType.SetTargetTroopRatio),
  ratio: z.number().min(0).max(1),
});

export const SendEmojiIntentSchema = z.object({
  type: z.literal(IntentType.SendEmoji),
  targetPlayerID: PlayerIDSchema,
  emoji: z.string().min(1).max(8),
});

export const SendAllianceRequestIntentSchema = z.object({
  type: z.literal(IntentType.SendAllianceRequest),
  targetPlayerID: PlayerIDSchema,
});

export const AcceptAllianceRequestIntentSchema = z.object({
  type: z.literal(IntentType.AcceptAllianceRequest),
  requestorID: PlayerIDSchema,
});

export const RejectAllianceRequestIntentSchema = z.object({
  type: z.literal(IntentType.RejectAllianceRequest),
  requestorID: PlayerIDSchema,
});

export const BreakAllianceIntentSchema = z.object({
  type: z.literal(IntentType.BreakAlliance),
  allyID: PlayerIDSchema,
});

export const SetAllianceDurationIntentSchema = z.object({
  type: z.literal(IntentType.SetAllianceDuration),
  turns: z.number().int().nonnegative(),
});

export const DonateIntentSchema = z.object({
  type: z.literal(IntentType.Donate),
  targetPlayerID: PlayerIDSchema,
  amount: z.number().int().nonnegative(),
});

export const SetEmbargoIntentSchema = z.object({
  type: z.literal(IntentType.SetEmbargo),
  targetPlayerID: PlayerIDSchema,
});

export const ClearEmbargoIntentSchema = z.object({
  type: z.literal(IntentType.ClearEmbargo),
  targetPlayerID: PlayerIDSchema,
});

export const BuildUnitIntentSchema = z.object({
  type: z.literal(IntentType.BuildUnit),
  unitType: z.string(),
  tile: TileSchema,
});

export const UpgradeUnitIntentSchema = z.object({
  type: z.literal(IntentType.UpgradeUnit),
  unitTile: TileSchema,
});

export const ActivateUnitIntentSchema = z.object({
  type: z.literal(IntentType.ActivateUnit),
  unitTile: TileSchema,
});

export const DeactivateUnitIntentSchema = z.object({
  type: z.literal(IntentType.DeactivateUnit),
  unitTile: TileSchema,
});

export const DestroyUnitIntentSchema = z.object({
  type: z.literal(IntentType.DestroyUnit),
  unitTile: TileSchema,
});

export const SetNameIntentSchema = z.object({
  type: z.literal(IntentType.SetName),
  name: z.string().min(1).max(32),
});

export const ChatIntentSchema = z.object({
  type: z.literal(IntentType.Chat),
  message: z.string().min(1).max(256),
});

export const SurrenderIntentSchema = z.object({
  type: z.literal(IntentType.Surrender),
});

export const PingIntentSchema = z.object({
  type: z.literal(IntentType.Ping),
  tile: TileSchema,
});

// ---------------------------------------------------------------------------
// Combined discriminated union
// ---------------------------------------------------------------------------

export const IntentSchema = z.discriminatedUnion("type", [
  SpawnIntentSchema,
  AttackIntentSchema,
  CancelAttackIntentSchema,
  RetreatIntentSchema,
  SetTargetTroopRatioIntentSchema,
  SendEmojiIntentSchema,
  SendAllianceRequestIntentSchema,
  AcceptAllianceRequestIntentSchema,
  RejectAllianceRequestIntentSchema,
  BreakAllianceIntentSchema,
  SetAllianceDurationIntentSchema,
  DonateIntentSchema,
  SetEmbargoIntentSchema,
  ClearEmbargoIntentSchema,
  BuildUnitIntentSchema,
  UpgradeUnitIntentSchema,
  ActivateUnitIntentSchema,
  DeactivateUnitIntentSchema,
  DestroyUnitIntentSchema,
  SetNameIntentSchema,
  ChatIntentSchema,
  SurrenderIntentSchema,
  PingIntentSchema,
]);

export type Intent = z.infer<typeof IntentSchema>;

// ---------------------------------------------------------------------------
// StampedIntent
// ---------------------------------------------------------------------------

export const StampedIntentSchema = z.object({
  clientID: ClientIDSchema,
  playerID: PlayerIDSchema,
  turn: z.number().int().nonnegative(),
  intent: IntentSchema,
});

export type StampedIntent = z.infer<typeof StampedIntentSchema>;

// ---------------------------------------------------------------------------
// GameConfig
// ---------------------------------------------------------------------------

export const GameConfigSchema = z.object({
  gameID: GameIDSchema,
  mapWidth: z.number().int().positive(),
  mapHeight: z.number().int().positive(),
  maxPlayers: z.number().int().positive(),
  seed: z.string(),
  ticksPerTurn: z.number().int().positive(),
  turnIntervalMs: z.number().int().positive(),
  gameMapType: z.string(),
  difficulty: z.string(),
});

export type GameConfig = z.infer<typeof GameConfigSchema>;

// ---------------------------------------------------------------------------
// Message type enums
// ---------------------------------------------------------------------------

export enum ServerMessageType {
  GameState = "game_state",
  TurnResult = "turn_result",
  PlayerJoined = "player_joined",
  PlayerLeft = "player_left",
  GameOver = "game_over",
  Error = "error",
}

export enum ClientMessageType {
  JoinGame = "join_game",
  SubmitIntent = "submit_intent",
  LeaveGame = "leave_game",
}
