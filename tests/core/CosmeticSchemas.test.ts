import { describe, it, expect } from "vitest";
import {
  RaritySchema,
  ColorPaletteSchema,
  PatternSchema,
  FlagSchema,
  CurrencyPackSchema,
  CosmeticsSchema,
} from "@core/CosmeticSchemas";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function passes(schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) {
  expect(schema.safeParse(value).success).toBe(true);
}

function fails(schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) {
  expect(schema.safeParse(value).success).toBe(false);
}

// ---------------------------------------------------------------------------
// Rarity
// ---------------------------------------------------------------------------

describe("RaritySchema", () => {
  it.each(["common", "uncommon", "rare", "epic", "legendary"])("accepts %s", (r) => {
    passes(RaritySchema, r);
  });

  it("rejects invalid rarity", () => {
    fails(RaritySchema, "mythic");
  });
});

// ---------------------------------------------------------------------------
// ColorPalette
// ---------------------------------------------------------------------------

describe("ColorPaletteSchema", () => {
  it("accepts valid palette", () => {
    passes(ColorPaletteSchema, {
      name: "Sunset",
      primaryColor: "#ff5500",
      secondaryColor: "#001122",
    });
  });

  it("rejects invalid hex color", () => {
    fails(ColorPaletteSchema, {
      name: "Bad",
      primaryColor: "red",
      secondaryColor: "#001122",
    });
  });
});

// ---------------------------------------------------------------------------
// Pattern
// ---------------------------------------------------------------------------

describe("PatternSchema", () => {
  const validPattern = {
    name: "Checkerboard",
    rarity: "rare",
    patternData: "AAAA",
    colorPalettes: [
      { name: "Default", primaryColor: "#000000", secondaryColor: "#ffffff" },
    ],
  };

  it("accepts valid pattern", () => {
    passes(PatternSchema, validPattern);
  });

  it("rejects empty colorPalettes", () => {
    fails(PatternSchema, { ...validPattern, colorPalettes: [] });
  });

  it("rejects empty patternData", () => {
    fails(PatternSchema, { ...validPattern, patternData: "" });
  });
});

// ---------------------------------------------------------------------------
// Flag
// ---------------------------------------------------------------------------

describe("FlagSchema", () => {
  it("accepts valid flag", () => {
    passes(FlagSchema, {
      name: "Pirate",
      url: "https://example.com/pirate.png",
      rarity: "epic",
    });
  });

  it("rejects invalid url", () => {
    fails(FlagSchema, { name: "Bad", url: "not-a-url", rarity: "common" });
  });
});

// ---------------------------------------------------------------------------
// CurrencyPack
// ---------------------------------------------------------------------------

describe("CurrencyPackSchema", () => {
  it("accepts valid pack", () => {
    passes(CurrencyPackSchema, { name: "Starter", currency: "soft", amount: 100 });
  });

  it("rejects non-positive amount", () => {
    fails(CurrencyPackSchema, { name: "Free", currency: "hard", amount: 0 });
  });

  it("rejects invalid currency type", () => {
    fails(CurrencyPackSchema, { name: "X", currency: "premium", amount: 50 });
  });
});

// ---------------------------------------------------------------------------
// Cosmetics root
// ---------------------------------------------------------------------------

describe("CosmeticsSchema", () => {
  it("accepts valid cosmetics object", () => {
    const cosmetics = {
      patterns: new Map([
        [
          "checker",
          {
            name: "Checkerboard",
            rarity: "common" as const,
            patternData: "AAAA",
            colorPalettes: [
              { name: "Default", primaryColor: "#000000", secondaryColor: "#ffffff" },
            ],
          },
        ],
      ]),
      flags: new Map([
        [
          "pirate",
          {
            name: "Pirate",
            url: "https://example.com/pirate.png",
            rarity: "rare" as const,
          },
        ],
      ]),
      currencyPacks: new Map([
        ["starter", { name: "Starter", currency: "soft" as const, amount: 100 }],
      ]),
    };
    passes(CosmeticsSchema, cosmetics);
  });

  it("accepts empty maps", () => {
    passes(CosmeticsSchema, {
      patterns: new Map(),
      flags: new Map(),
      currencyPacks: new Map(),
    });
  });
});
