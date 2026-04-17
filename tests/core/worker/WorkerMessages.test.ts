import { describe, it, expect } from "vitest";
import {
  isInitMessage,
  isTurnMessage,
  isGameUpdateMessage,
  isGameUpdateBatchMessage,
  isWorkerReadyMessage,
  isWorkerErrorMessage,
} from "@core/worker/WorkerMessages";

describe("WorkerMessages type guards", () => {
  it("isInitMessage", () => {
    expect(isInitMessage({ type: "init", config: {} })).toBe(true);
    expect(isInitMessage({ type: "turn" })).toBe(false);
    expect(isInitMessage(null)).toBe(false);
    expect(isInitMessage(undefined)).toBe(false);
    expect(isInitMessage("init")).toBe(false);
  });

  it("isTurnMessage", () => {
    expect(isTurnMessage({ type: "turn", turn: 1, intents: [] })).toBe(true);
    expect(isTurnMessage({ type: "init" })).toBe(false);
    expect(isTurnMessage(null)).toBe(false);
  });

  it("isGameUpdateMessage", () => {
    expect(
      isGameUpdateMessage({
        type: "game_update",
        turn: 1,
        updates: [],
        tileChanges: [],
      }),
    ).toBe(true);
    expect(isGameUpdateMessage({ type: "turn" })).toBe(false);
  });

  it("isGameUpdateBatchMessage", () => {
    expect(
      isGameUpdateBatchMessage({
        type: "game_update_batch",
        batch: [],
      }),
    ).toBe(true);
    expect(isGameUpdateBatchMessage({ type: "game_update" })).toBe(false);
  });

  it("isWorkerReadyMessage", () => {
    expect(isWorkerReadyMessage({ type: "worker_ready" })).toBe(true);
    expect(isWorkerReadyMessage({ type: "init" })).toBe(false);
  });

  it("isWorkerErrorMessage", () => {
    expect(
      isWorkerErrorMessage({ type: "worker_error", error: "fail" }),
    ).toBe(true);
    expect(isWorkerErrorMessage({ type: "worker_ready" })).toBe(false);
  });
});
