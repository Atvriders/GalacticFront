import { describe, it, expect, beforeEach } from "vitest";
import { StatsImpl, StatType } from "../../../src/core/game/StatsImpl";

describe("StatsImpl", () => {
  let stats: StatsImpl;

  beforeEach(() => {
    stats = new StatsImpl(10);
  });

  it("initializes with all stat types", () => {
    for (const stat of Object.values(StatType)) {
      expect(stats.getPlayersForStat(stat as StatType)).toEqual([]);
    }
    expect(stats.getSnapshotIndex()).toBe(0);
  });

  it("record and getCurrent", () => {
    stats.record(StatType.Troops, 1, 500n);
    expect(stats.getCurrent(StatType.Troops, 1)).toBe(500n);
  });

  it("returns 0n for unrecorded stats", () => {
    expect(stats.getCurrent(StatType.Credits, 99)).toBe(0n);
    expect(stats.getCurrent(StatType.Territory, 1)).toBe(0n);
  });

  it("increment accumulates delta", () => {
    stats.increment(StatType.UnitsBuilt, 1, 5n);
    stats.increment(StatType.UnitsBuilt, 1, 3n);
    expect(stats.getCurrent(StatType.UnitsBuilt, 1)).toBe(8n);
  });

  it("increment uses default delta of 1n", () => {
    stats.increment(StatType.AttacksLaunched, 2);
    stats.increment(StatType.AttacksLaunched, 2);
    expect(stats.getCurrent(StatType.AttacksLaunched, 2)).toBe(2n);
  });

  it("time series tracks values across snapshots", () => {
    stats.record(StatType.Territory, 1, 100n);
    stats.advanceSnapshot();
    stats.record(StatType.Territory, 1, 200n);
    stats.advanceSnapshot();
    stats.record(StatType.Territory, 1, 300n);

    const series = stats.getTimeSeries(StatType.Territory, 1);
    expect(series[0]).toBe(100n);
    expect(series[1]).toBe(200n);
    expect(series[2]).toBe(300n);
    expect(stats.getCurrent(StatType.Territory, 1)).toBe(300n);
  });

  it("advanceSnapshot increments snapshotIndex", () => {
    expect(stats.getSnapshotIndex()).toBe(0);
    stats.advanceSnapshot();
    expect(stats.getSnapshotIndex()).toBe(1);
    stats.advanceSnapshot();
    expect(stats.getSnapshotIndex()).toBe(2);
  });

  it("leaderboard sorts descending by current value", () => {
    stats.record(StatType.Credits, 1, 100n);
    stats.record(StatType.Credits, 2, 500n);
    stats.record(StatType.Credits, 3, 250n);

    const board = stats.getLeaderboard(StatType.Credits);
    expect(board[0]).toEqual({ playerID: 2, value: 500n });
    expect(board[1]).toEqual({ playerID: 3, value: 250n });
    expect(board[2]).toEqual({ playerID: 1, value: 100n });
  });

  it("getPlayersForStat returns correct IDs", () => {
    stats.record(StatType.TilesConquered, 10, 1n);
    stats.record(StatType.TilesConquered, 20, 2n);
    stats.record(StatType.TilesConquered, 30, 3n);

    const players = stats.getPlayersForStat(StatType.TilesConquered);
    expect(players.sort()).toEqual([10, 20, 30]);
  });

  it("clear resets everything", () => {
    stats.record(StatType.Troops, 1, 999n);
    stats.advanceSnapshot();
    stats.record(StatType.Credits, 2, 50n);

    stats.clear();

    expect(stats.getSnapshotIndex()).toBe(0);
    expect(stats.getCurrent(StatType.Troops, 1)).toBe(0n);
    expect(stats.getCurrent(StatType.Credits, 2)).toBe(0n);
    expect(stats.getPlayersForStat(StatType.Troops)).toEqual([]);
    // All stat types still present after clear
    for (const stat of Object.values(StatType)) {
      expect(stats.getPlayersForStat(stat as StatType)).toEqual([]);
    }
  });

  it("multiple players tracked independently", () => {
    stats.record(StatType.UnitsLost, 1, 10n);
    stats.record(StatType.UnitsLost, 2, 20n);
    stats.record(StatType.UnitsLost, 3, 30n);

    expect(stats.getCurrent(StatType.UnitsLost, 1)).toBe(10n);
    expect(stats.getCurrent(StatType.UnitsLost, 2)).toBe(20n);
    expect(stats.getCurrent(StatType.UnitsLost, 3)).toBe(30n);

    stats.increment(StatType.UnitsLost, 1, 5n);
    expect(stats.getCurrent(StatType.UnitsLost, 1)).toBe(15n);
    expect(stats.getCurrent(StatType.UnitsLost, 2)).toBe(20n);
  });

  it("getCurrent returns latest value when snapshots have gaps", () => {
    stats.record(StatType.AlliancesFormed, 1, 7n);
    stats.advanceSnapshot();
    // No record at index 1
    stats.advanceSnapshot();
    // Still at index 2, no new record — getCurrent should return last known
    expect(stats.getCurrent(StatType.AlliancesFormed, 1)).toBe(7n);
  });

  it("getTimeSeries returns empty array for unknown player", () => {
    const series = stats.getTimeSeries(StatType.TilesLost, 999);
    expect(series).toEqual([]);
  });
});
