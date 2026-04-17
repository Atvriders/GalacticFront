import { describe, it, expect } from "vitest";
import {
  hexToRgb,
  rgbToHex,
  rgbToLab,
  deltaE2000,
  allocateColor,
  playerColors,
  alienColors,
} from "../../../src/client/graphics/ColorSystem.js";

describe("ColorSystem", () => {
  describe("hexToRgb / rgbToHex", () => {
    it("round-trips correctly", () => {
      const hex = "#3a86ff";
      const rgb = hexToRgb(hex);
      expect(rgbToHex(rgb)).toBe(hex);
    });

    it("parses black", () => {
      const rgb = hexToRgb("#000000");
      expect(rgb).toEqual({ r: 0, g: 0, b: 0 });
    });

    it("parses white", () => {
      const rgb = hexToRgb("#ffffff");
      expect(rgb).toEqual({ r: 255, g: 255, b: 255 });
    });
  });

  describe("rgbToLab", () => {
    it("black maps to L=0", () => {
      const lab = rgbToLab({ r: 0, g: 0, b: 0 });
      expect(lab.L).toBeCloseTo(0, 1);
    });

    it("white maps to L~100", () => {
      const lab = rgbToLab({ r: 255, g: 255, b: 255 });
      expect(lab.L).toBeCloseTo(100, 0);
    });
  });

  describe("deltaE2000", () => {
    it("identical colors have distance 0", () => {
      const lab = rgbToLab(hexToRgb("#ff0000"));
      expect(deltaE2000(lab, lab)).toBeCloseTo(0, 5);
    });

    it("very different colors have large distance", () => {
      const red = rgbToLab(hexToRgb("#ff0000"));
      const cyan = rgbToLab(hexToRgb("#00ffff"));
      expect(deltaE2000(red, cyan)).toBeGreaterThan(30);
    });

    it("similar colors have small distance", () => {
      const a = rgbToLab(hexToRgb("#ff0000"));
      const b = rgbToLab(hexToRgb("#ee1111"));
      expect(deltaE2000(a, b)).toBeLessThan(10);
    });
  });

  describe("allocateColor", () => {
    it("returns first palette color when no existing colors", () => {
      const color = allocateColor([]);
      expect(color).toBe(playerColors[0]);
    });

    it("returns a color not in the existing set", () => {
      const existing = [playerColors[0]!];
      const color = allocateColor(existing);
      expect(existing).not.toContain(color);
    });

    it("returns maximally distinct color", () => {
      const existing = ["#ff0000", "#00ff00"];
      const color = allocateColor(existing);
      // The chosen color should be far from both red and green
      const chosenLab = rgbToLab(hexToRgb(color));
      const redLab = rgbToLab(hexToRgb("#ff0000"));
      const greenLab = rgbToLab(hexToRgb("#00ff00"));
      const distRed = deltaE2000(chosenLab, redLab);
      const distGreen = deltaE2000(chosenLab, greenLab);
      expect(Math.min(distRed, distGreen)).toBeGreaterThan(10);
    });

    it("works with alien palette", () => {
      const color = allocateColor([], alienColors);
      expect(alienColors).toContain(color);
    });

    it("allocates multiple distinct colors", () => {
      const colors: string[] = [];
      for (let i = 0; i < 10; i++) {
        const c = allocateColor(colors);
        colors.push(c);
      }
      // All should be unique
      const unique = new Set(colors);
      expect(unique.size).toBe(10);
    });
  });
});
