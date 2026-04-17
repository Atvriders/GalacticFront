import { describe, it, expect } from "vitest";
import {
  IntentType,
  IntentSchema,
  StampedIntentSchema,
  GameConfigSchema,
  ServerMessageType,
  ClientMessageType,
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
} from "@core/Schemas";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function passes<T>(schema: { safeParse: (v: unknown) => { success: boolean } }, value: T) {
  const result = schema.safeParse(value);
  expect(result.success).toBe(true);
}

function fails(schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) {
  const result = schema.safeParse(value);
  expect(result.success).toBe(false);
}

// ---------------------------------------------------------------------------
// IntentType enum — verify all 23 variants exist
// ---------------------------------------------------------------------------

describe("IntentType enum", () => {
  it("has exactly 23 types", () => {
    const types = Object.values(IntentType);
    expect(types).toHaveLength(23);
  });

  it("contains all expected string values", () => {
    expect(IntentType.Spawn).toBe("spawn");
    expect(IntentType.Attack).toBe("attack");
    expect(IntentType.CancelAttack).toBe("cancel_attack");
    expect(IntentType.Retreat).toBe("retreat");
    expect(IntentType.SetTargetTroopRatio).toBe("set_target_troop_ratio");
    expect(IntentType.SendEmoji).toBe("send_emoji");
    expect(IntentType.SendAllianceRequest).toBe("send_alliance_request");
    expect(IntentType.AcceptAllianceRequest).toBe("accept_alliance_request");
    expect(IntentType.RejectAllianceRequest).toBe("reject_alliance_request");
    expect(IntentType.BreakAlliance).toBe("break_alliance");
    expect(IntentType.SetAllianceDuration).toBe("set_alliance_duration");
    expect(IntentType.Donate).toBe("donate");
    expect(IntentType.SetEmbargo).toBe("set_embargo");
    expect(IntentType.ClearEmbargo).toBe("clear_embargo");
    expect(IntentType.BuildUnit).toBe("build_unit");
    expect(IntentType.UpgradeUnit).toBe("upgrade_unit");
    expect(IntentType.ActivateUnit).toBe("activate_unit");
    expect(IntentType.DeactivateUnit).toBe("deactivate_unit");
    expect(IntentType.DestroyUnit).toBe("destroy_unit");
    expect(IntentType.SetName).toBe("set_name");
    expect(IntentType.Chat).toBe("chat");
    expect(IntentType.Surrender).toBe("surrender");
    expect(IntentType.Ping).toBe("ping");
  });
});

// ---------------------------------------------------------------------------
// Individual intent schemas
// ---------------------------------------------------------------------------

describe("SpawnIntentSchema", () => {
  it("parses valid spawn intent", () => {
    passes(SpawnIntentSchema, { type: "spawn", tile: 42, name: "Player1" });
  });
  it("rejects missing tile", () => {
    fails(SpawnIntentSchema, { type: "spawn", name: "Player1" });
  });
  it("rejects empty name", () => {
    fails(SpawnIntentSchema, { type: "spawn", tile: 0, name: "" });
  });
  it("rejects name longer than 32 chars", () => {
    fails(SpawnIntentSchema, { type: "spawn", tile: 0, name: "a".repeat(33) });
  });
  it("rejects negative tile", () => {
    fails(SpawnIntentSchema, { type: "spawn", tile: -1, name: "Player1" });
  });
  it("rejects float tile", () => {
    fails(SpawnIntentSchema, { type: "spawn", tile: 1.5, name: "Player1" });
  });
});

describe("AttackIntentSchema", () => {
  it("parses valid attack intent", () => {
    passes(AttackIntentSchema, { type: "attack", targetPlayerID: 2, sourceTile: 10, troopRatio: 0.5 });
  });
  it("accepts troopRatio of 0 and 1", () => {
    passes(AttackIntentSchema, { type: "attack", targetPlayerID: 2, sourceTile: 10, troopRatio: 0 });
    passes(AttackIntentSchema, { type: "attack", targetPlayerID: 2, sourceTile: 10, troopRatio: 1 });
  });
  it("rejects troopRatio > 1", () => {
    fails(AttackIntentSchema, { type: "attack", targetPlayerID: 2, sourceTile: 10, troopRatio: 1.1 });
  });
  it("rejects troopRatio < 0", () => {
    fails(AttackIntentSchema, { type: "attack", targetPlayerID: 2, sourceTile: 10, troopRatio: -0.1 });
  });
  it("rejects missing fields", () => {
    fails(AttackIntentSchema, { type: "attack", targetPlayerID: 2 });
  });
});

describe("CancelAttackIntentSchema", () => {
  it("parses valid", () => {
    passes(CancelAttackIntentSchema, { type: "cancel_attack", targetPlayerID: 3 });
  });
  it("rejects missing targetPlayerID", () => {
    fails(CancelAttackIntentSchema, { type: "cancel_attack" });
  });
});

describe("RetreatIntentSchema", () => {
  it("parses valid", () => {
    passes(RetreatIntentSchema, { type: "retreat", unitTile: 5 });
  });
  it("rejects missing unitTile", () => {
    fails(RetreatIntentSchema, { type: "retreat" });
  });
});

describe("SetTargetTroopRatioIntentSchema", () => {
  it("parses valid", () => {
    passes(SetTargetTroopRatioIntentSchema, { type: "set_target_troop_ratio", ratio: 0.75 });
  });
  it("rejects ratio > 1", () => {
    fails(SetTargetTroopRatioIntentSchema, { type: "set_target_troop_ratio", ratio: 2 });
  });
  it("rejects ratio < 0", () => {
    fails(SetTargetTroopRatioIntentSchema, { type: "set_target_troop_ratio", ratio: -1 });
  });
});

describe("SendEmojiIntentSchema", () => {
  it("parses valid", () => {
    passes(SendEmojiIntentSchema, { type: "send_emoji", targetPlayerID: 1, emoji: "😀" });
  });
  it("rejects empty emoji", () => {
    fails(SendEmojiIntentSchema, { type: "send_emoji", targetPlayerID: 1, emoji: "" });
  });
});

describe("SendAllianceRequestIntentSchema", () => {
  it("parses valid", () => {
    passes(SendAllianceRequestIntentSchema, { type: "send_alliance_request", targetPlayerID: 4 });
  });
  it("rejects missing targetPlayerID", () => {
    fails(SendAllianceRequestIntentSchema, { type: "send_alliance_request" });
  });
});

describe("AcceptAllianceRequestIntentSchema", () => {
  it("parses valid", () => {
    passes(AcceptAllianceRequestIntentSchema, { type: "accept_alliance_request", requestorID: 4 });
  });
  it("rejects negative requestorID", () => {
    fails(AcceptAllianceRequestIntentSchema, { type: "accept_alliance_request", requestorID: -1 });
  });
});

describe("RejectAllianceRequestIntentSchema", () => {
  it("parses valid", () => {
    passes(RejectAllianceRequestIntentSchema, { type: "reject_alliance_request", requestorID: 4 });
  });
  it("rejects missing requestorID", () => {
    fails(RejectAllianceRequestIntentSchema, { type: "reject_alliance_request" });
  });
});

describe("BreakAllianceIntentSchema", () => {
  it("parses valid", () => {
    passes(BreakAllianceIntentSchema, { type: "break_alliance", allyID: 2 });
  });
  it("rejects missing allyID", () => {
    fails(BreakAllianceIntentSchema, { type: "break_alliance" });
  });
});

describe("SetAllianceDurationIntentSchema", () => {
  it("parses valid", () => {
    passes(SetAllianceDurationIntentSchema, { type: "set_alliance_duration", turns: 10 });
  });
  it("rejects negative turns", () => {
    fails(SetAllianceDurationIntentSchema, { type: "set_alliance_duration", turns: -1 });
  });
  it("rejects float turns", () => {
    fails(SetAllianceDurationIntentSchema, { type: "set_alliance_duration", turns: 1.5 });
  });
});

describe("DonateIntentSchema", () => {
  it("parses valid", () => {
    passes(DonateIntentSchema, { type: "donate", targetPlayerID: 2, amount: 100 });
  });
  it("rejects negative amount", () => {
    fails(DonateIntentSchema, { type: "donate", targetPlayerID: 2, amount: -10 });
  });
  it("rejects missing amount", () => {
    fails(DonateIntentSchema, { type: "donate", targetPlayerID: 2 });
  });
});

describe("SetEmbargoIntentSchema", () => {
  it("parses valid", () => {
    passes(SetEmbargoIntentSchema, { type: "set_embargo", targetPlayerID: 3 });
  });
  it("rejects missing targetPlayerID", () => {
    fails(SetEmbargoIntentSchema, { type: "set_embargo" });
  });
});

describe("ClearEmbargoIntentSchema", () => {
  it("parses valid", () => {
    passes(ClearEmbargoIntentSchema, { type: "clear_embargo", targetPlayerID: 3 });
  });
  it("rejects missing targetPlayerID", () => {
    fails(ClearEmbargoIntentSchema, { type: "clear_embargo" });
  });
});

describe("BuildUnitIntentSchema", () => {
  it("parses valid", () => {
    passes(BuildUnitIntentSchema, { type: "build_unit", unitType: "artillery", tile: 7 });
  });
  it("rejects missing unitType", () => {
    fails(BuildUnitIntentSchema, { type: "build_unit", tile: 7 });
  });
  it("rejects missing tile", () => {
    fails(BuildUnitIntentSchema, { type: "build_unit", unitType: "artillery" });
  });
});

describe("UpgradeUnitIntentSchema", () => {
  it("parses valid", () => {
    passes(UpgradeUnitIntentSchema, { type: "upgrade_unit", unitTile: 9 });
  });
  it("rejects missing unitTile", () => {
    fails(UpgradeUnitIntentSchema, { type: "upgrade_unit" });
  });
});

describe("ActivateUnitIntentSchema", () => {
  it("parses valid", () => {
    passes(ActivateUnitIntentSchema, { type: "activate_unit", unitTile: 9 });
  });
  it("rejects float unitTile", () => {
    fails(ActivateUnitIntentSchema, { type: "activate_unit", unitTile: 1.2 });
  });
});

describe("DeactivateUnitIntentSchema", () => {
  it("parses valid", () => {
    passes(DeactivateUnitIntentSchema, { type: "deactivate_unit", unitTile: 9 });
  });
  it("rejects missing unitTile", () => {
    fails(DeactivateUnitIntentSchema, { type: "deactivate_unit" });
  });
});

describe("DestroyUnitIntentSchema", () => {
  it("parses valid", () => {
    passes(DestroyUnitIntentSchema, { type: "destroy_unit", unitTile: 9 });
  });
  it("rejects negative unitTile", () => {
    fails(DestroyUnitIntentSchema, { type: "destroy_unit", unitTile: -5 });
  });
});

describe("SetNameIntentSchema", () => {
  it("parses valid", () => {
    passes(SetNameIntentSchema, { type: "set_name", name: "GalacticKing" });
  });
  it("rejects empty name", () => {
    fails(SetNameIntentSchema, { type: "set_name", name: "" });
  });
  it("rejects name > 32 chars", () => {
    fails(SetNameIntentSchema, { type: "set_name", name: "x".repeat(33) });
  });
});

describe("ChatIntentSchema", () => {
  it("parses valid chat", () => {
    passes(ChatIntentSchema, { type: "chat", message: "Hello world!" });
  });
  it("accepts message up to 256 chars", () => {
    passes(ChatIntentSchema, { type: "chat", message: "a".repeat(256) });
  });
  it("rejects empty message", () => {
    fails(ChatIntentSchema, { type: "chat", message: "" });
  });
  it("rejects message > 256 chars", () => {
    fails(ChatIntentSchema, { type: "chat", message: "a".repeat(257) });
  });
  it("rejects missing message", () => {
    fails(ChatIntentSchema, { type: "chat" });
  });
});

describe("SurrenderIntentSchema", () => {
  it("parses valid surrender", () => {
    passes(SurrenderIntentSchema, { type: "surrender" });
  });
  it("parses valid surrender ignoring extra fields (passthrough not set, strict by default)", () => {
    // Zod strips extra fields by default — this should still succeed
    const result = SurrenderIntentSchema.safeParse({ type: "surrender", extra: "field" });
    expect(result.success).toBe(true);
  });
});

describe("PingIntentSchema", () => {
  it("parses valid ping", () => {
    passes(PingIntentSchema, { type: "ping", tile: 100 });
  });
  it("rejects missing tile", () => {
    fails(PingIntentSchema, { type: "ping" });
  });
  it("rejects negative tile", () => {
    fails(PingIntentSchema, { type: "ping", tile: -1 });
  });
});

// ---------------------------------------------------------------------------
// Combined IntentSchema discriminated union
// ---------------------------------------------------------------------------

describe("IntentSchema (discriminated union)", () => {
  it("routes to correct schema based on type", () => {
    passes(IntentSchema, { type: "spawn", tile: 0, name: "Hero" });
    passes(IntentSchema, { type: "attack", targetPlayerID: 1, sourceTile: 2, troopRatio: 0.5 });
    passes(IntentSchema, { type: "cancel_attack", targetPlayerID: 1 });
    passes(IntentSchema, { type: "retreat", unitTile: 3 });
    passes(IntentSchema, { type: "set_target_troop_ratio", ratio: 0.5 });
    passes(IntentSchema, { type: "send_emoji", targetPlayerID: 1, emoji: "👍" });
    passes(IntentSchema, { type: "send_alliance_request", targetPlayerID: 1 });
    passes(IntentSchema, { type: "accept_alliance_request", requestorID: 1 });
    passes(IntentSchema, { type: "reject_alliance_request", requestorID: 1 });
    passes(IntentSchema, { type: "break_alliance", allyID: 1 });
    passes(IntentSchema, { type: "set_alliance_duration", turns: 5 });
    passes(IntentSchema, { type: "donate", targetPlayerID: 1, amount: 50 });
    passes(IntentSchema, { type: "set_embargo", targetPlayerID: 1 });
    passes(IntentSchema, { type: "clear_embargo", targetPlayerID: 1 });
    passes(IntentSchema, { type: "build_unit", unitType: "tank", tile: 10 });
    passes(IntentSchema, { type: "upgrade_unit", unitTile: 10 });
    passes(IntentSchema, { type: "activate_unit", unitTile: 10 });
    passes(IntentSchema, { type: "deactivate_unit", unitTile: 10 });
    passes(IntentSchema, { type: "destroy_unit", unitTile: 10 });
    passes(IntentSchema, { type: "set_name", name: "NewName" });
    passes(IntentSchema, { type: "chat", message: "Hi there" });
    passes(IntentSchema, { type: "surrender" });
    passes(IntentSchema, { type: "ping", tile: 42 });
  });

  it("rejects unknown intent type", () => {
    fails(IntentSchema, { type: "unknown_type" });
  });

  it("rejects missing type field", () => {
    fails(IntentSchema, { tile: 0, name: "Hero" });
  });
});

// ---------------------------------------------------------------------------
// StampedIntent
// ---------------------------------------------------------------------------

describe("StampedIntentSchema", () => {
  const validStamped = {
    clientID: "client-abc-123",
    playerID: 7,
    turn: 42,
    intent: { type: "chat", message: "Hello!" },
  };

  it("parses valid StampedIntent", () => {
    passes(StampedIntentSchema, validStamped);
  });

  it("rejects missing clientID", () => {
    fails(StampedIntentSchema, { ...validStamped, clientID: undefined });
  });

  it("rejects negative playerID", () => {
    fails(StampedIntentSchema, { ...validStamped, playerID: -1 });
  });

  it("rejects float playerID", () => {
    fails(StampedIntentSchema, { ...validStamped, playerID: 1.5 });
  });

  it("rejects negative turn", () => {
    fails(StampedIntentSchema, { ...validStamped, turn: -1 });
  });

  it("rejects invalid nested intent", () => {
    fails(StampedIntentSchema, { ...validStamped, intent: { type: "chat", message: "" } });
  });

  it("works with all intent types as inner intent", () => {
    passes(StampedIntentSchema, { ...validStamped, intent: { type: "surrender" } });
    passes(StampedIntentSchema, { ...validStamped, intent: { type: "spawn", tile: 0, name: "X" } });
  });
});

// ---------------------------------------------------------------------------
// GameConfig
// ---------------------------------------------------------------------------

describe("GameConfigSchema", () => {
  const validConfig = {
    gameID: "game-001",
    mapWidth: 512,
    mapHeight: 512,
    maxPlayers: 64,
    seed: "abc123",
    ticksPerTurn: 10,
    turnIntervalMs: 200,
    gameMapType: "earth",
    difficulty: "normal",
  };

  it("parses a valid GameConfig", () => {
    passes(GameConfigSchema, validConfig);
  });

  it("rejects missing gameID", () => {
    const { gameID: _, ...rest } = validConfig;
    fails(GameConfigSchema, rest);
  });

  it("rejects non-positive mapWidth", () => {
    fails(GameConfigSchema, { ...validConfig, mapWidth: 0 });
    fails(GameConfigSchema, { ...validConfig, mapWidth: -1 });
  });

  it("rejects non-positive mapHeight", () => {
    fails(GameConfigSchema, { ...validConfig, mapHeight: 0 });
  });

  it("rejects non-positive maxPlayers", () => {
    fails(GameConfigSchema, { ...validConfig, maxPlayers: 0 });
  });

  it("rejects float ticksPerTurn", () => {
    fails(GameConfigSchema, { ...validConfig, ticksPerTurn: 1.5 });
  });

  it("rejects non-positive turnIntervalMs", () => {
    fails(GameConfigSchema, { ...validConfig, turnIntervalMs: 0 });
  });

  it("rejects missing seed", () => {
    const { seed: _, ...rest } = validConfig;
    fails(GameConfigSchema, rest);
  });

  it("rejects missing gameMapType", () => {
    const { gameMapType: _, ...rest } = validConfig;
    fails(GameConfigSchema, rest);
  });

  it("rejects missing difficulty", () => {
    const { difficulty: _, ...rest } = validConfig;
    fails(GameConfigSchema, rest);
  });
});

// ---------------------------------------------------------------------------
// Message type enums
// ---------------------------------------------------------------------------

describe("ServerMessageType", () => {
  it("has all 6 server message types", () => {
    expect(ServerMessageType.GameState).toBe("game_state");
    expect(ServerMessageType.TurnResult).toBe("turn_result");
    expect(ServerMessageType.PlayerJoined).toBe("player_joined");
    expect(ServerMessageType.PlayerLeft).toBe("player_left");
    expect(ServerMessageType.GameOver).toBe("game_over");
    expect(ServerMessageType.Error).toBe("error");
    expect(Object.values(ServerMessageType)).toHaveLength(6);
  });
});

describe("ClientMessageType", () => {
  it("has all 3 client message types", () => {
    expect(ClientMessageType.JoinGame).toBe("join_game");
    expect(ClientMessageType.SubmitIntent).toBe("submit_intent");
    expect(ClientMessageType.LeaveGame).toBe("leave_game");
    expect(Object.values(ClientMessageType)).toHaveLength(3);
  });
});
