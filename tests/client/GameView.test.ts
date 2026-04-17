import { describe, it, expect } from "vitest";
import { GameView, PlayerView, UnitView } from "@client/GameView";
import { GameUpdateType, UnitType } from "@core/game/Types";
import type { GameUpdate } from "@core/game/GameImpl";

function makeUpdate(
  type: GameUpdateType,
  tick: number,
  payload: unknown,
): GameUpdate {
  return { type, tick, payload };
}

describe("GameView", () => {
  it("should track player spawns", () => {
    const view = new GameView();
    view.applyUpdate(
      makeUpdate(GameUpdateType.PlayerSpawned, 1, {
        playerID: 1,
        name: "Alice",
      }),
    );

    expect(view.players()).toHaveLength(1);
    expect(view.getPlayer(1)?.name).toBe("Alice");
    expect(view.getPlayer(1)?.isAlive).toBe(true);
  });

  it("should track player elimination", () => {
    const view = new GameView();
    view.applyUpdate(
      makeUpdate(GameUpdateType.PlayerSpawned, 1, {
        playerID: 1,
        name: "Alice",
      }),
    );
    view.applyUpdate(
      makeUpdate(GameUpdateType.PlayerEliminated, 10, {
        playerID: 1,
      }),
    );

    expect(view.getPlayer(1)?.isAlive).toBe(false);
  });

  it("should set and return myPlayer", () => {
    const view = new GameView();
    expect(view.myPlayer()).toBeNull();

    view.applyUpdate(
      makeUpdate(GameUpdateType.PlayerSpawned, 1, {
        playerID: 5,
        name: "Me",
      }),
    );
    view.setMyPlayerID(5);

    expect(view.myPlayer()?.name).toBe("Me");
  });

  it("should track tile ownership changes", () => {
    const view = new GameView();
    view.applyUpdate(
      makeUpdate(GameUpdateType.PlayerSpawned, 1, {
        playerID: 1,
        name: "Alice",
      }),
    );

    view.applyUpdate(
      makeUpdate(GameUpdateType.TileOwnerChange, 2, {
        tile: 42,
        newOwner: 1,
      }),
    );

    expect(view.owner(42)).toBe(1);
    expect(view.getPlayer(1)?.territoryCount).toBe(1);
  });

  it("should track unit lifecycle", () => {
    const view = new GameView();

    view.applyUpdate(
      makeUpdate(GameUpdateType.UnitBuilt, 1, {
        unitID: "u1",
        type: UnitType.Colony,
        ownerID: 1,
        tile: 10,
      }),
    );

    expect(view.units()).toHaveLength(1);
    expect(view.getUnit("u1")?.type).toBe(UnitType.Colony);

    view.applyUpdate(
      makeUpdate(GameUpdateType.UnitUpgraded, 2, { unitID: "u1" }),
    );
    expect(view.getUnit("u1")?.level).toBe(2);

    view.applyUpdate(
      makeUpdate(GameUpdateType.UnitDeactivated, 3, { unitID: "u1" }),
    );
    expect(view.getUnit("u1")?.active).toBe(false);

    view.applyUpdate(
      makeUpdate(GameUpdateType.UnitActivated, 4, { unitID: "u1" }),
    );
    expect(view.getUnit("u1")?.active).toBe(true);

    view.applyUpdate(
      makeUpdate(GameUpdateType.UnitDestroyed, 5, { unitID: "u1" }),
    );
    expect(view.units()).toHaveLength(0);
  });

  it("should track ticks", () => {
    const view = new GameView();
    expect(view.ticks()).toBe(0);

    view.applyUpdate(
      makeUpdate(GameUpdateType.PlayerSpawned, 10, {
        playerID: 1,
        name: "A",
      }),
    );
    expect(view.ticks()).toBe(10);
  });

  it("UnitView tracks position history", () => {
    const unit = new UnitView("u1", UnitType.Starport, 1, 10);
    expect(unit.positionHistory).toHaveLength(1);

    unit.recordPosition(20, 5);
    expect(unit.tile).toBe(20);
    expect(unit.positionHistory).toHaveLength(2);

    // Same position should not add entry
    unit.recordPosition(20, 6);
    expect(unit.positionHistory).toHaveLength(2);
  });

  it("should apply update messages with tile changes", () => {
    const view = new GameView();
    view.applyUpdateMessage({
      type: "game_update",
      turn: 1,
      updates: [
        makeUpdate(GameUpdateType.PlayerSpawned, 1, {
          playerID: 1,
          name: "Bob",
        }),
      ],
      tileChanges: [
        { tile: 0, packed: 100 },
        { tile: 1, packed: 200 },
      ],
    });

    expect(view.players()).toHaveLength(1);
    // Tile changes are recorded
    expect(view.owner(0)).toBe(100);
    expect(view.owner(1)).toBe(200);
  });
});
