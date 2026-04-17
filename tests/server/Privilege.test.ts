import { describe, it, expect } from "vitest";
import {
  validateCosmetics,
  censorProfanity,
  detectSlur,
} from "../../src/server/Privilege";

describe("validateCosmetics", () => {
  it("returns valid when all refs are owned", () => {
    const owned = new Set(["skin_1", "flag_2"]);
    const result = validateCosmetics(["skin_1", "flag_2"], owned);
    expect(result.valid).toBe(true);
    expect(result.invalid).toHaveLength(0);
  });

  it("returns invalid refs that are not owned", () => {
    const owned = new Set(["skin_1"]);
    const result = validateCosmetics(["skin_1", "flag_2", "hat_3"], owned);
    expect(result.valid).toBe(false);
    expect(result.invalid).toEqual(["flag_2", "hat_3"]);
  });

  it("handles empty refs", () => {
    const result = validateCosmetics([], new Set());
    expect(result.valid).toBe(true);
  });
});

describe("censorProfanity", () => {
  it("replaces banned words with asterisks", () => {
    expect(censorProfanity("what the fuck")).toBe("what the ****");
  });

  it("is case-insensitive", () => {
    expect(censorProfanity("SHIT happens")).toBe("**** happens");
  });

  it("replaces multiple occurrences", () => {
    expect(censorProfanity("damn this damn thing")).toBe("**** this **** thing");
  });

  it("leaves clean text unchanged", () => {
    expect(censorProfanity("hello world")).toBe("hello world");
  });
});

describe("detectSlur", () => {
  it("detects slur in username", () => {
    const result = detectSlur("badniggerword", null);
    expect(result.detected).toBe(true);
  });

  it("detects slur spanning username and clan tag", () => {
    // "fag" spans across "...f" + "ag..."
    const result = detectSlur("xf", "agx");
    expect(result.detected).toBe(true);
    expect(result.match).toBe("fag");
  });

  it("returns false for clean input", () => {
    const result = detectSlur("GoodPlayer", "CLAN");
    expect(result.detected).toBe(false);
  });

  it("handles null clan tag", () => {
    const result = detectSlur("CleanName", null);
    expect(result.detected).toBe(false);
  });

  it("is case-insensitive", () => {
    const result = detectSlur("FAGgot", null);
    expect(result.detected).toBe(true);
  });
});
