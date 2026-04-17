import { describe, it, expect, beforeEach } from "vitest";
import { FlatBinaryHeap } from "../../../src/core/execution/FlatBinaryHeap";
import { SpawnExecution } from "../../../src/core/execution/SpawnExecution";
import {
  SetNameExecution,
  SurrenderExecution,
  DonateExecution,
  SetEmbargoExecution,
  ClearEmbargoExecution,
} from "../../../src/core/execution/PlayerExecution";
import {
  AttackExecution,
  CancelAttackExecution,
  SetTargetTroopRatioExecution,
} from "../../../src/core/execution/AttackExecution";
import { RetreatExecution } from "../../../src/core/execution/RetreatExecution";
import { GameImpl } from "../../../src/core/game/GameImpl";
import { IntentType } from "../../../src/core/Schemas";
import { PlayerType, TerrainType } from "../../../src/core/game/Types";
import type { GameConfig } from "../../../src/core/Schemas";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_CONFIG: GameConfig = {
  gameID: "exec-test",
  mapWidth: 20,
  mapHeight: 20,
  maxPlayers: 8,
  seed: "exec-seed",
  ticksPerTurn: 1,
  turnIntervalMs: 100,
  gameMapType: "Standard",
  difficulty: "Medium",
};

function makeGame(): GameImpl {
  return new GameImpl(TEST_CONFIG);
}

/** Find a traversable, unowned tile. */
function findFreeTile(game: GameImpl, start = 0): number {
  for (let i = start; i < game.map.width * game.map.height; i++) {
    if (game.map.isTraversable(i) && !game.map.isOwned(i)) return i;
  }
  throw new Error("No free traversable tile found");
}

/** Find an asteroid tile. */
function findAsteroidTile(game: GameImpl): number {
  for (let i = 0; i < game.map.width * game.map.height; i++) {
    if (game.map.getTerrainType(i) === TerrainType.Asteroid) return i;
  }
  throw new Error("No asteroid tile found");
}

/** Spawn a player via game.spawnPlayer (legacy API) on a free tile. */
function spawnAt(game: GameImpl, name: string, tile: number): number {
  return game.spawnPlayer(name, tile) as unknown as number;
}

// ---------------------------------------------------------------------------
// FlatBinaryHeap
// ---------------------------------------------------------------------------

describe("FlatBinaryHeap", () => {
  it("is empty initially", () => {
    const heap = new FlatBinaryHeap<string>();
    expect(heap.isEmpty()).toBe(true);
    expect(heap.length).toBe(0);
  });

  it("pop on empty heap returns undefined", () => {
    const heap = new FlatBinaryHeap<string>();
    expect(heap.pop()).toBeUndefined();
  });

  it("peek on empty heap returns undefined", () => {
    const heap = new FlatBinaryHeap<string>();
    expect(heap.peek()).toBeUndefined();
  });

  it("single element: push/peek/pop", () => {
    const heap = new FlatBinaryHeap<string>();
    heap.push(5, "hello");
    expect(heap.length).toBe(1);
    expect(heap.isEmpty()).toBe(false);
    expect(heap.peek()).toEqual({ key: 5, value: "hello" });
    const result = heap.pop();
    expect(result).toEqual({ key: 5, value: "hello" });
    expect(heap.isEmpty()).toBe(true);
  });

  it("pops in ascending key order (min-heap)", () => {
    const heap = new FlatBinaryHeap<string>();
    heap.push(10, "ten");
    heap.push(3, "three");
    heap.push(7, "seven");
    heap.push(1, "one");
    heap.push(5, "five");

    const order: number[] = [];
    while (!heap.isEmpty()) {
      order.push(heap.pop()!.key);
    }
    expect(order).toEqual([1, 3, 5, 7, 10]);
  });

  it("peek does not remove the element", () => {
    const heap = new FlatBinaryHeap<number>();
    heap.push(2, 100);
    heap.push(1, 200);
    heap.peek();
    heap.peek();
    expect(heap.length).toBe(2);
    expect(heap.pop()?.key).toBe(1);
  });

  it("large N: pops in sorted order", () => {
    const heap = new FlatBinaryHeap<number>();
    const N = 500;
    const keys: number[] = [];
    for (let i = 0; i < N; i++) {
      const k = Math.floor(Math.random() * 10000);
      keys.push(k);
      heap.push(k, k);
    }
    keys.sort((a, b) => a - b);

    const popped: number[] = [];
    while (!heap.isEmpty()) {
      popped.push(heap.pop()!.key);
    }
    expect(popped).toEqual(keys);
  });

  it("clear empties the heap", () => {
    const heap = new FlatBinaryHeap<string>();
    heap.push(1, "a");
    heap.push(2, "b");
    heap.clear();
    expect(heap.isEmpty()).toBe(true);
    expect(heap.length).toBe(0);
    expect(heap.pop()).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// SpawnExecution
// ---------------------------------------------------------------------------

describe("SpawnExecution", () => {
  let game: GameImpl;
  const handler = new SpawnExecution();

  beforeEach(() => {
    game = makeGame();
  });

  it("has type 'spawn'", () => {
    expect(handler.type).toBe(IntentType.Spawn);
  });

  it("spawns a player at a valid free tile", () => {
    const tile = findFreeTile(game);
    const intent = { type: IntentType.Spawn as const, tile, name: "Alice" };
    const err = handler.validate!(game, 99, intent);
    expect(err).toBeNull();
    const ok = handler.execute(game, 99, intent);
    expect(ok).toBe(true);
    expect(game.getAlivePlayers().length).toBe(1);
  });

  it("rejects spawn on an asteroid tile", () => {
    const tile = findAsteroidTile(game);
    const intent = { type: IntentType.Spawn as const, tile, name: "Bob" };
    const err = handler.validate!(game, 1, intent);
    expect(err).not.toBeNull();
  });

  it("rejects spawn when tile is already owned", () => {
    const tile = findFreeTile(game);
    // Spawn one player to claim the tile
    spawnAt(game, "First", tile);
    // tile is now owned — find what was claimed
    const ownedTile = game.getAlivePlayers()[0]!.territory.values().next().value!;
    const intent = {
      type: IntentType.Spawn as const,
      tile: ownedTile,
      name: "Second",
    };
    const err = handler.validate!(game, 2, intent);
    expect(err).not.toBeNull();
  });

  it("rejects invalid intent type in execute", () => {
    const intent = { type: IntentType.Surrender as const };
    const ok = handler.execute(game, 1, intent);
    expect(ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SetNameExecution
// ---------------------------------------------------------------------------

describe("SetNameExecution", () => {
  let game: GameImpl;
  const handler = new SetNameExecution();

  beforeEach(() => {
    game = makeGame();
    const tile = findFreeTile(game);
    game.spawnPlayer("OldName", tile);
  });

  it("has type 'set_name'", () => {
    expect(handler.type).toBe(IntentType.SetName);
  });

  it("changes player name", () => {
    const playerID = game.getAlivePlayers()[0]!.id;
    const intent = { type: IntentType.SetName as const, name: "NewName" };
    const ok = handler.execute(game, playerID, intent);
    expect(ok).toBe(true);
    expect(game.getPlayer(playerID)!.name).toBe("NewName");
  });

  it("returns false for non-existent player", () => {
    const intent = { type: IntentType.SetName as const, name: "Ghost" };
    const ok = handler.execute(game, 9999, intent);
    expect(ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SurrenderExecution
// ---------------------------------------------------------------------------

describe("SurrenderExecution", () => {
  let game: GameImpl;
  const handler = new SurrenderExecution();

  beforeEach(() => {
    game = makeGame();
    const tile = findFreeTile(game);
    game.spawnPlayer("Victim", tile);
  });

  it("has type 'surrender'", () => {
    expect(handler.type).toBe(IntentType.Surrender);
  });

  it("kills the player on surrender", () => {
    const player = game.getAlivePlayers()[0]!;
    const intent = { type: IntentType.Surrender as const };
    const ok = handler.execute(game, player.id, intent);
    expect(ok).toBe(true);
    expect(player.isAlive).toBe(false);
    expect(player.hasSurrendered).toBe(true);
  });

  it("returns false when player is not alive", () => {
    const intent = { type: IntentType.Surrender as const };
    // Call twice — second should fail
    const player = game.getAlivePlayers()[0]!;
    handler.execute(game, player.id, intent);
    const ok = handler.execute(game, player.id, intent);
    expect(ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AttackExecution
// ---------------------------------------------------------------------------

describe("AttackExecution", () => {
  let game: GameImpl;
  const handler = new AttackExecution();

  function spawnTwo(): [number, number, number] {
    const t1 = findFreeTile(game, 0);
    const id1 = game.spawnPlayer("Attacker", t1) as unknown as number;
    const t2 = findFreeTile(game, t1 + 50);
    const id2 = game.spawnPlayer("Defender", t2) as unknown as number;
    return [id1, id2, t1];
  }

  beforeEach(() => {
    game = makeGame();
  });

  it("has type 'attack'", () => {
    expect(handler.type).toBe(IntentType.Attack);
  });

  it("starts an attack between two alive players", () => {
    const [id1, id2, t1] = spawnTwo();
    const intent = {
      type: IntentType.Attack as const,
      targetPlayerID: id2,
      sourceTile: t1,
      troopRatio: 0.5,
    };
    const err = handler.validate!(game, id1, intent);
    expect(err).toBeNull();
    const ok = handler.execute(game, id1, intent);
    expect(ok).toBe(true);
    expect(game.getAttacks().size).toBe(1);
  });

  it("rejects self-attack", () => {
    const t1 = findFreeTile(game);
    const id1 = game.spawnPlayer("Player", t1) as unknown as number;
    const intent = {
      type: IntentType.Attack as const,
      targetPlayerID: id1,
      sourceTile: t1,
      troopRatio: 0.5,
    };
    const err = handler.validate!(game, id1, intent);
    expect(err).not.toBeNull();
  });

  it("rejects ally attack", () => {
    const [id1, id2, t1] = spawnTwo();
    // Make them allies
    const p1 = game.getPlayer(id1)!;
    p1.addAlliance(id2, 9999);
    const intent = {
      type: IntentType.Attack as const,
      targetPlayerID: id2,
      sourceTile: t1,
      troopRatio: 0.5,
    };
    const err = handler.validate!(game, id1, intent);
    expect(err).not.toBeNull();
  });

  it("rejects attack when attacker not alive", () => {
    const [id1, id2, t1] = spawnTwo();
    game.getPlayer(id1)!.surrender(0);
    const intent = {
      type: IntentType.Attack as const,
      targetPlayerID: id2,
      sourceTile: t1,
      troopRatio: 0.5,
    };
    const err = handler.validate!(game, id1, intent);
    expect(err).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CancelAttackExecution
// ---------------------------------------------------------------------------

describe("CancelAttackExecution", () => {
  let game: GameImpl;
  const handler = new CancelAttackExecution();

  function setupAttack(): [number, number] {
    const t1 = findFreeTile(game, 0);
    const id1 = game.spawnPlayer("Attacker", t1) as unknown as number;
    const t2 = findFreeTile(game, t1 + 50);
    const id2 = game.spawnPlayer("Defender", t2) as unknown as number;
    game.startAttack(id1, id2, t1, 0.5);
    return [id1, id2];
  }

  beforeEach(() => {
    game = makeGame();
  });

  it("has type 'cancel_attack'", () => {
    expect(handler.type).toBe(IntentType.CancelAttack);
  });

  it("cancels an existing attack", () => {
    const [id1, id2] = setupAttack();
    expect(game.getAttacks().size).toBe(1);
    const intent = {
      type: IntentType.CancelAttack as const,
      targetPlayerID: id2,
    };
    const ok = handler.execute(game, id1, intent);
    expect(ok).toBe(true);
    expect(game.getAttacks().size).toBe(0);
  });

  it("returns false when no matching attack", () => {
    const t1 = findFreeTile(game);
    const id1 = game.spawnPlayer("Solo", t1) as unknown as number;
    const intent = {
      type: IntentType.CancelAttack as const,
      targetPlayerID: 9999,
    };
    const ok = handler.execute(game, id1, intent);
    expect(ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// RetreatExecution
// ---------------------------------------------------------------------------

describe("RetreatExecution", () => {
  let game: GameImpl;
  const handler = new RetreatExecution();

  function setupAttack(): [number, number] {
    const t1 = findFreeTile(game, 0);
    const id1 = game.spawnPlayer("Attacker", t1) as unknown as number;
    const t2 = findFreeTile(game, t1 + 50);
    const id2 = game.spawnPlayer("Defender", t2) as unknown as number;
    game.startAttack(id1, id2, t1, 0.5);
    return [id1, id2];
  }

  beforeEach(() => {
    game = makeGame();
  });

  it("has type 'retreat'", () => {
    expect(handler.type).toBe(IntentType.Retreat);
  });

  it("starts retreat on an active attack", () => {
    const [id1] = setupAttack();
    const attack = [...game.getAttacks().values()][0]!;
    const intent = { type: IntentType.Retreat as const, unitTile: 0 };
    const err = handler.validate!(game, id1, intent);
    expect(err).toBeNull();
    const ok = handler.execute(game, id1, intent);
    expect(ok).toBe(true);
    expect(attack.isRetreating).toBe(true);
  });

  it("rejects retreat when not attacking", () => {
    const t1 = findFreeTile(game);
    const id1 = game.spawnPlayer("Idle", t1) as unknown as number;
    const intent = { type: IntentType.Retreat as const, unitTile: 0 };
    const err = handler.validate!(game, id1, intent);
    expect(err).not.toBeNull();
    const ok = handler.execute(game, id1, intent);
    expect(ok).toBe(false);
  });

  it("rejects retreat when already retreating", () => {
    const [id1] = setupAttack();
    const attack = [...game.getAttacks().values()][0]!;
    attack.startRetreat();
    const intent = { type: IntentType.Retreat as const, unitTile: 0 };
    const err = handler.validate!(game, id1, intent);
    expect(err).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// SetEmbargoExecution / ClearEmbargoExecution
// ---------------------------------------------------------------------------

describe("SetEmbargoExecution", () => {
  let game: GameImpl;
  const handler = new SetEmbargoExecution();

  beforeEach(() => {
    game = makeGame();
    const tile = findFreeTile(game);
    game.spawnPlayer("Player1", tile);
  });

  it("has type 'set_embargo'", () => {
    expect(handler.type).toBe(IntentType.SetEmbargo);
  });

  it("sets an embargo on a target", () => {
    const player = game.getAlivePlayers()[0]!;
    const intent = { type: IntentType.SetEmbargo as const, targetPlayerID: 42 };
    const ok = handler.execute(game, player.id, intent);
    expect(ok).toBe(true);
    expect(player.hasEmbargo(42)).toBe(true);
  });

  it("returns false when player not alive", () => {
    const intent = { type: IntentType.SetEmbargo as const, targetPlayerID: 42 };
    const ok = handler.execute(game, 9999, intent);
    expect(ok).toBe(false);
  });
});

describe("ClearEmbargoExecution", () => {
  let game: GameImpl;
  const handler = new ClearEmbargoExecution();

  beforeEach(() => {
    game = makeGame();
    const tile = findFreeTile(game);
    game.spawnPlayer("Player1", tile);
  });

  it("has type 'clear_embargo'", () => {
    expect(handler.type).toBe(IntentType.ClearEmbargo);
  });

  it("clears an existing embargo", () => {
    const player = game.getAlivePlayers()[0]!;
    player.setEmbargo(42);
    expect(player.hasEmbargo(42)).toBe(true);
    const intent = {
      type: IntentType.ClearEmbargo as const,
      targetPlayerID: 42,
    };
    const ok = handler.execute(game, player.id, intent);
    expect(ok).toBe(true);
    expect(player.hasEmbargo(42)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SetTargetTroopRatioExecution
// ---------------------------------------------------------------------------

describe("SetTargetTroopRatioExecution", () => {
  let game: GameImpl;
  const handler = new SetTargetTroopRatioExecution();

  function setupAttack(): [number, number] {
    const t1 = findFreeTile(game, 0);
    const id1 = game.spawnPlayer("Attacker", t1) as unknown as number;
    const t2 = findFreeTile(game, t1 + 50);
    const id2 = game.spawnPlayer("Defender", t2) as unknown as number;
    game.startAttack(id1, id2, t1, 0.5);
    return [id1, id2];
  }

  beforeEach(() => {
    game = makeGame();
  });

  it("has type 'set_target_troop_ratio'", () => {
    expect(handler.type).toBe(IntentType.SetTargetTroopRatio);
  });

  it("updates troop ratio on an active attack", () => {
    const [id1] = setupAttack();
    const intent = {
      type: IntentType.SetTargetTroopRatio as const,
      ratio: 0.75,
    };
    const ok = handler.execute(game, id1, intent);
    expect(ok).toBe(true);
    const attack = [...game.getAttacks().values()][0]!;
    expect((attack as unknown as { troopRatio: number }).troopRatio).toBe(0.75);
  });

  it("returns false when no active attacks for player", () => {
    const tile = findFreeTile(game);
    const id = game.spawnPlayer("Idle", tile) as unknown as number;
    const intent = {
      type: IntentType.SetTargetTroopRatio as const,
      ratio: 0.5,
    };
    const ok = handler.execute(game, id, intent);
    expect(ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DonateExecution
// ---------------------------------------------------------------------------

describe("DonateExecution", () => {
  let game: GameImpl;
  const handler = new DonateExecution();

  beforeEach(() => {
    game = makeGame();
  });

  it("has type 'donate'", () => {
    expect(handler.type).toBe(IntentType.Donate);
  });

  it("transfers tiles from sender to recipient", () => {
    const t1 = findFreeTile(game, 0);
    const id1 = game.spawnPlayer("Sender", t1) as unknown as number;
    const t2 = findFreeTile(game, t1 + 50);
    const id2 = game.spawnPlayer("Recipient", t2) as unknown as number;

    const intent = {
      type: IntentType.Donate as const,
      targetPlayerID: id2,
      amount: 0,
    };

    const err = handler.validate!(game, id1, intent);
    expect(err).toBeNull();
    const ok = handler.execute(game, id1, intent);
    expect(ok).toBe(true);
  });

  it("rejects when sender has embargo on recipient", () => {
    const t1 = findFreeTile(game, 0);
    const id1 = game.spawnPlayer("Sender", t1) as unknown as number;
    const t2 = findFreeTile(game, t1 + 50);
    const id2 = game.spawnPlayer("Recipient", t2) as unknown as number;

    game.getPlayer(id1)!.setEmbargo(id2);

    const intent = {
      type: IntentType.Donate as const,
      targetPlayerID: id2,
      amount: 0,
    };
    const err = handler.validate!(game, id1, intent);
    expect(err).not.toBeNull();
  });

  it("rejects when recipient is not alive", () => {
    const t1 = findFreeTile(game, 0);
    const id1 = game.spawnPlayer("Sender", t1) as unknown as number;
    const intent = {
      type: IntentType.Donate as const,
      targetPlayerID: 9999,
      amount: 0,
    };
    const err = handler.validate!(game, id1, intent);
    expect(err).not.toBeNull();
  });
});
