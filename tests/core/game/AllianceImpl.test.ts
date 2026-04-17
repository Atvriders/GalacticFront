import { describe, it, expect } from "vitest";
import { AllianceImpl, AllianceRequestImpl } from "../../../src/core/game/AllianceImpl";

describe("AllianceRequestImpl", () => {
  it("initializes correctly", () => {
    const req = new AllianceRequestImpl("req-1", 1, 2, 500, 100, 50);
    expect(req.id).toBe("req-1");
    expect(req.requestorID).toBe(1);
    expect(req.recipientID).toBe(2);
    expect(req.duration).toBe(500);
    expect(req.createdTick).toBe(100);
    expect(req.expiryTick).toBe(150);
    expect(req.counterProposedDuration).toBeNull();
  });

  it("expires at correct tick (149=false, 150=true)", () => {
    const req = new AllianceRequestImpl("req-1", 1, 2, 500, 100, 50);
    expect(req.isExpired(149)).toBe(false);
    expect(req.isExpired(150)).toBe(true);
  });

  it("counter-proposal overrides agreed duration", () => {
    const req = new AllianceRequestImpl("req-1", 1, 2, 500, 100, 50);
    req.setCounterProposal(300);
    expect(req.counterProposedDuration).toBe(300);
    expect(req.getAgreedDuration()).toBe(300);
  });

  it("default agreed duration is original", () => {
    const req = new AllianceRequestImpl("req-1", 1, 2, 500, 100, 50);
    expect(req.getAgreedDuration()).toBe(500);
  });
});

describe("AllianceImpl", () => {
  it("initializes with correct expiration", () => {
    const alliance = new AllianceImpl("al-1", 10, 20, 0, 1000);
    expect(alliance.id).toBe("al-1");
    expect(alliance.player1ID).toBe(10);
    expect(alliance.player2ID).toBe(20);
    expect(alliance.formedTick).toBe(0);
    expect(alliance.duration).toBe(1000);
    expect(alliance.expirationTick).toBe(1000);
    expect(alliance.extensionRequested).toBe(false);
    expect(alliance.extensionRequestedBy).toBeNull();
    expect(alliance.proposedExtensionDuration).toBe(0);
  });

  it("expires at correct tick", () => {
    const alliance = new AllianceImpl("al-1", 10, 20, 0, 1000);
    expect(alliance.isExpired(999)).toBe(false);
    expect(alliance.isExpired(1000)).toBe(true);
  });

  it("involves() returns correct results", () => {
    const alliance = new AllianceImpl("al-1", 10, 20, 0, 1000);
    expect(alliance.involves(10)).toBe(true);
    expect(alliance.involves(20)).toBe(true);
    expect(alliance.involves(99)).toBe(false);
  });

  it("getOtherPlayer returns other player and throws for non-participant", () => {
    const alliance = new AllianceImpl("al-1", 10, 20, 0, 1000);
    expect(alliance.getOtherPlayer(10)).toBe(20);
    expect(alliance.getOtherPlayer(20)).toBe(10);
    expect(() => alliance.getOtherPlayer(99)).toThrow();
  });

  it("ticksRemaining and progress calculations", () => {
    const alliance = new AllianceImpl("al-1", 10, 20, 0, 1000);
    expect(alliance.ticksRemaining(0)).toBe(1000);
    expect(alliance.ticksRemaining(500)).toBe(500);
    expect(alliance.ticksRemaining(1000)).toBe(0);
    expect(alliance.ticksRemaining(1100)).toBe(0);

    expect(alliance.progress(0)).toBe(0);
    expect(alliance.progress(500)).toBe(0.5);
    expect(alliance.progress(1000)).toBe(1);
    expect(alliance.progress(1500)).toBe(1);
  });

  it("extension request sets all fields", () => {
    const alliance = new AllianceImpl("al-1", 10, 20, 0, 1000);
    alliance.requestExtension(10, 500);
    expect(alliance.extensionRequested).toBe(true);
    expect(alliance.extensionRequestedBy).toBe(10);
    expect(alliance.proposedExtensionDuration).toBe(500);
  });
});
