import { describe, it, expect, beforeEach } from 'vitest';
import { AttackImpl } from '../../../src/core/game/AttackImpl';

describe('AttackImpl', () => {
  let attack: AttackImpl;

  beforeEach(() => {
    attack = new AttackImpl('atk-1', 1, 2, 100, 0.5, 10);
  });

  describe('initialization', () => {
    it('sets correct properties', () => {
      expect(attack.id).toBe('atk-1');
      expect(attack.attackerID).toBe(1);
      expect(attack.defenderID).toBe(2);
      expect(attack.sourceTile).toBe(100);
      expect(attack.troopRatio).toBe(0.5);
      expect(attack.startTick).toBe(10);
      expect(attack.lastExpansionTick).toBe(10);
    });

    it('initializes troops to 0n', () => {
      expect(attack.troops).toBe(0n);
    });

    it('starts with empty border and conquered sets', () => {
      expect(attack.borderTiles.size).toBe(0);
      expect(attack.conqueredTiles.size).toBe(0);
      expect(attack.borderCount).toBe(0);
      expect(attack.conqueredCount).toBe(0);
    });

    it('starts not retreating', () => {
      expect(attack.isRetreating).toBe(false);
    });

    it('starts with empty clusterPositions', () => {
      expect(attack.clusterPositions).toEqual([]);
    });
  });

  describe('border tiles', () => {
    it('adds a border tile', () => {
      attack.addBorderTile(5);
      expect(attack.borderTiles.has(5)).toBe(true);
      expect(attack.borderCount).toBe(1);
    });

    it('removes a border tile', () => {
      attack.addBorderTile(5);
      attack.removeBorderTile(5);
      expect(attack.borderTiles.has(5)).toBe(false);
      expect(attack.borderCount).toBe(0);
    });

    it('tracks multiple border tiles', () => {
      attack.addBorderTile(1);
      attack.addBorderTile(2);
      attack.addBorderTile(3);
      expect(attack.borderCount).toBe(3);
    });

    it('removing non-existent tile is a no-op', () => {
      attack.removeBorderTile(999);
      expect(attack.borderCount).toBe(0);
    });
  });

  describe('conquerTile', () => {
    it('moves tile from border to conquered', () => {
      attack.addBorderTile(10);
      attack.conquerTile(10);
      expect(attack.borderTiles.has(10)).toBe(false);
      expect(attack.conqueredTiles.has(10)).toBe(true);
      expect(attack.borderCount).toBe(0);
      expect(attack.conqueredCount).toBe(1);
    });

    it('adds to conquered even if not in border', () => {
      attack.conquerTile(20);
      expect(attack.conqueredTiles.has(20)).toBe(true);
      expect(attack.conqueredCount).toBe(1);
    });
  });

  describe('loseTile', () => {
    it('removes tile from conquered', () => {
      attack.conquerTile(15);
      attack.loseTile(15);
      expect(attack.conqueredTiles.has(15)).toBe(false);
      expect(attack.conqueredCount).toBe(0);
    });

    it('is a no-op for tile not in conquered', () => {
      attack.loseTile(999);
      expect(attack.conqueredCount).toBe(0);
    });
  });

  describe('retreat', () => {
    it('startRetreat sets isRetreating to true', () => {
      attack.startRetreat();
      expect(attack.isRetreating).toBe(true);
    });
  });

  describe('isExhausted', () => {
    it('returns true when both sets are empty', () => {
      expect(attack.isExhausted()).toBe(true);
    });

    it('returns false when border has tiles', () => {
      attack.addBorderTile(1);
      expect(attack.isExhausted()).toBe(false);
    });

    it('returns false when conquered has tiles', () => {
      attack.conquerTile(1);
      expect(attack.isExhausted()).toBe(false);
    });

    it('returns false when both sets have tiles', () => {
      attack.addBorderTile(1);
      attack.conquerTile(2);
      expect(attack.isExhausted()).toBe(false);
    });

    it('returns true after all tiles removed', () => {
      attack.addBorderTile(1);
      attack.conquerTile(2);
      attack.removeBorderTile(1);
      attack.loseTile(2);
      expect(attack.isExhausted()).toBe(true);
    });
  });

  describe('timeout', () => {
    it('is not timed out when currentTick - lastExpansionTick < timeoutTicks', () => {
      expect(attack.isTimedOut(15, 10)).toBe(false);
    });

    it('is timed out when currentTick - lastExpansionTick >= timeoutTicks', () => {
      expect(attack.isTimedOut(20, 10)).toBe(true);
    });

    it('is timed out at exact timeout boundary', () => {
      expect(attack.isTimedOut(20, 10)).toBe(true);
    });

    it('recordExpansion updates lastExpansionTick', () => {
      attack.recordExpansion(18);
      expect(attack.lastExpansionTick).toBe(18);
    });

    it('recordExpansion resets timeout', () => {
      // At tick 20, would be timed out from startTick 10 with timeout 10
      expect(attack.isTimedOut(20, 10)).toBe(true);
      // Record expansion at tick 15, now timeout resets
      attack.recordExpansion(15);
      expect(attack.isTimedOut(20, 10)).toBe(false);
    });
  });

  describe('conqueredCount and borderCount getters', () => {
    it('conqueredCount reflects conqueredTiles.size', () => {
      expect(attack.conqueredCount).toBe(0);
      attack.conquerTile(1);
      attack.conquerTile(2);
      expect(attack.conqueredCount).toBe(2);
      attack.loseTile(1);
      expect(attack.conqueredCount).toBe(1);
    });

    it('borderCount reflects borderTiles.size', () => {
      expect(attack.borderCount).toBe(0);
      attack.addBorderTile(1);
      attack.addBorderTile(2);
      expect(attack.borderCount).toBe(2);
      attack.removeBorderTile(1);
      expect(attack.borderCount).toBe(1);
    });
  });
});
