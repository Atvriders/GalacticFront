import { z } from "zod";

// ---------------------------------------------------------------------------
// Rarity
// ---------------------------------------------------------------------------

export const RaritySchema = z.enum([
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
]);
export type Rarity = z.infer<typeof RaritySchema>;

// ---------------------------------------------------------------------------
// ColorPalette
// ---------------------------------------------------------------------------

export const ColorPaletteSchema = z.object({
  name: z.string().min(1),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export type ColorPalette = z.infer<typeof ColorPaletteSchema>;

// ---------------------------------------------------------------------------
// Pattern
// ---------------------------------------------------------------------------

export const PatternSchema = z.object({
  name: z.string().min(1),
  rarity: RaritySchema,
  patternData: z.string().min(1), // base64url encoded
  colorPalettes: z.array(ColorPaletteSchema).min(1),
});
export type Pattern = z.infer<typeof PatternSchema>;

// ---------------------------------------------------------------------------
// Flag
// ---------------------------------------------------------------------------

export const FlagSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  rarity: RaritySchema,
});
export type Flag = z.infer<typeof FlagSchema>;

// ---------------------------------------------------------------------------
// CurrencyPack
// ---------------------------------------------------------------------------

export const CurrencyPackSchema = z.object({
  name: z.string().min(1),
  currency: z.enum(["soft", "hard"]),
  amount: z.number().int().positive(),
});
export type CurrencyPack = z.infer<typeof CurrencyPackSchema>;

// ---------------------------------------------------------------------------
// Cosmetics (root)
// ---------------------------------------------------------------------------

export const CosmeticsSchema = z.object({
  patterns: z.map(z.string(), PatternSchema),
  flags: z.map(z.string(), FlagSchema),
  currencyPacks: z.map(z.string(), CurrencyPackSchema),
});
export type Cosmetics = z.infer<typeof CosmeticsSchema>;
