/**
 * Color management with LAB color space and Delta-E 2000 distance.
 * Provides maximally distinct color allocation for empires.
 */

// ── sRGB <-> LAB conversion ───────────────────────────────────────────

export interface Lab {
  L: number;
  a: number;
  b: number;
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Parse a hex color string to RGB (0-255). */
export function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Convert RGB (0-255) to hex string. */
export function rgbToHex(rgb: Rgb): string {
  const r = Math.round(Math.max(0, Math.min(255, rgb.r)));
  const g = Math.round(Math.max(0, Math.min(255, rgb.g)));
  const b = Math.round(Math.max(0, Math.min(255, rgb.b)));
  return (
    "#" +
    r.toString(16).padStart(2, "0") +
    g.toString(16).padStart(2, "0") +
    b.toString(16).padStart(2, "0")
  );
}

/** sRGB gamma linearization. */
function srgbToLinear(c: number): number {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Convert RGB to CIELAB. */
export function rgbToLab(rgb: Rgb): Lab {
  // sRGB -> linear -> XYZ (D65)
  const rL = srgbToLinear(rgb.r);
  const gL = srgbToLinear(rgb.g);
  const bL = srgbToLinear(rgb.b);

  let x = (0.4124564 * rL + 0.3575761 * gL + 0.1804375 * bL) / 0.95047;
  let y = (0.2126729 * rL + 0.7151522 * gL + 0.0721750 * bL) / 1.0;
  let z = (0.0193339 * rL + 0.1191920 * gL + 0.9503041 * bL) / 1.08883;

  const epsilon = 0.008856;
  const kappa = 903.3;

  x = x > epsilon ? Math.cbrt(x) : (kappa * x + 16) / 116;
  y = y > epsilon ? Math.cbrt(y) : (kappa * y + 16) / 116;
  z = z > epsilon ? Math.cbrt(z) : (kappa * z + 16) / 116;

  return {
    L: 116 * y - 16,
    a: 500 * (x - y),
    b: 200 * (y - z),
  };
}

// ── Delta-E 2000 ──────────────────────────────────────────────────────

/**
 * Compute CIEDE2000 color difference between two LAB colors.
 * Higher values = more perceptually different.
 */
export function deltaE2000(lab1: Lab, lab2: Lab): number {
  const { L: L1, a: a1, b: b1 } = lab1;
  const { L: L2, a: a2, b: b2 } = lab2;

  const avgL = (L1 + L2) / 2;

  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const avgC = (C1 + C2) / 2;

  const avgC7 = Math.pow(avgC, 7);
  const G = 0.5 * (1 - Math.sqrt(avgC7 / (avgC7 + Math.pow(25, 7))));

  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);

  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);
  const avgCp = (C1p + C2p) / 2;

  let h1p = (Math.atan2(b1, a1p) * 180) / Math.PI;
  if (h1p < 0) h1p += 360;
  let h2p = (Math.atan2(b2, a2p) * 180) / Math.PI;
  if (h2p < 0) h2p += 360;

  let avgHp: number;
  if (Math.abs(h1p - h2p) > 180) {
    avgHp = (h1p + h2p + 360) / 2;
  } else {
    avgHp = (h1p + h2p) / 2;
  }

  const T =
    1 -
    0.17 * Math.cos(((avgHp - 30) * Math.PI) / 180) +
    0.24 * Math.cos(((2 * avgHp) * Math.PI) / 180) +
    0.32 * Math.cos(((3 * avgHp + 6) * Math.PI) / 180) -
    0.20 * Math.cos(((4 * avgHp - 63) * Math.PI) / 180);

  let dhp: number;
  if (Math.abs(h2p - h1p) <= 180) {
    dhp = h2p - h1p;
  } else if (h2p - h1p > 180) {
    dhp = h2p - h1p - 360;
  } else {
    dhp = h2p - h1p + 360;
  }

  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * Math.PI / 180);

  const SL = 1 + (0.015 * (avgL - 50) * (avgL - 50)) / Math.sqrt(20 + (avgL - 50) * (avgL - 50));
  const SC = 1 + 0.045 * avgCp;
  const SH = 1 + 0.015 * avgCp * T;

  const avgCp7 = Math.pow(avgCp, 7);
  const RT =
    -2 *
    Math.sqrt(avgCp7 / (avgCp7 + Math.pow(25, 7))) *
    Math.sin((60 * Math.exp(-Math.pow((avgHp - 275) / 25, 2)) * Math.PI) / 180);

  return Math.sqrt(
    (dLp / SL) ** 2 +
    (dCp / SC) ** 2 +
    (dHp / SH) ** 2 +
    RT * (dCp / SC) * (dHp / SH),
  );
}

// ── Color palettes ────────────────────────────────────────────────────

/** 64 vibrant colors for player empires. */
export const playerColors: readonly string[] = [
  "#e63946", "#f4a261", "#e9c46a", "#2a9d8f", "#264653",
  "#d62828", "#f77f00", "#fcbf49", "#eae2b7", "#003049",
  "#06d6a0", "#118ab2", "#073b4c", "#ef476f", "#ffd166",
  "#8338ec", "#3a86ff", "#ff006e", "#fb5607", "#ffbe0b",
  "#e71d36", "#2ec4b6", "#cbf3f0", "#ff9f1c", "#011627",
  "#5f0f40", "#9a031e", "#fb8b24", "#e36414", "#0f4c5c",
  "#606c38", "#283618", "#dda15e", "#bc6c25", "#540b0e",
  "#9b2226", "#ae2012", "#bb3e03", "#ca6702", "#ee9b00",
  "#94d2bd", "#0a9396", "#005f73", "#001219", "#e9d8a6",
  "#b5838d", "#6d6875", "#e5989b", "#ffb4a2", "#ffcdb2",
  "#3d405b", "#81b29a", "#f2cc8f", "#e07a5f", "#f4f1de",
  "#7209b7", "#560bad", "#480ca8", "#3f37c9", "#4361ee",
  "#4895ef", "#4cc9f0", "#f72585", "#b5179e", "#7400b8",
];

/** Exotic colors for alien factions. */
export const alienColors: readonly string[] = [
  "#39ff14", "#ff073a", "#00fff7", "#ff00ff", "#b300ff",
  "#ff6600", "#ccff00", "#00ffcc", "#ff3399", "#6600ff",
  "#00ff66", "#ff9900", "#0066ff", "#ff0066", "#33ff99",
  "#cc00ff", "#00ccff", "#ffcc00", "#9900ff", "#00ff99",
  "#ff3300", "#0099ff", "#ff00cc", "#66ff00", "#0033ff",
  "#ff6633", "#3300ff", "#00ff33", "#ff0099", "#9933ff",
  "#33ffcc", "#ff3366", "#6633ff", "#00ffff", "#ff33cc",
  "#33ff33", "#cc33ff", "#33ccff", "#ffff33", "#ff33ff",
];

/** Military-themed colors for human factions. */
export const humanColors: readonly string[] = [
  "#2b5329", "#4a7c59", "#8b4513", "#556b2f", "#6b8e23",
  "#3c6e71", "#284b63", "#353535", "#5c677d", "#7d8597",
  "#4a4e69", "#22223b", "#9a8c98", "#c9ada7", "#f2e9e4",
  "#6c584c", "#a98467", "#adc178", "#dde5b6", "#f0ead2",
  "#582f0e", "#7f4f24", "#936639", "#a68a64", "#b6ad90",
  "#414535", "#718355", "#87986a", "#97a97c", "#b5c99a",
  "#344e41", "#3a5a40", "#588157", "#a3b18a", "#dad7cd",
];

/** Muted colors for bot players. */
export const botColors: readonly string[] = [
  "#6b705c", "#a5a58d", "#b7b7a4", "#ddbea9", "#ffe8d6",
  "#8e9aaf", "#cbc0d3", "#dee2ff", "#feeafa", "#efd3d7",
  "#797d62", "#9b9b7a", "#bab86c", "#d9ae94", "#e8d5b7",
  "#565264", "#706677", "#a6808c", "#ccb7ae", "#d6cfcb",
  "#606c38", "#283618", "#fefae0", "#dda15e", "#bc6c25",
  "#585123", "#eec170", "#f2a65a", "#f58549", "#772f1a",
  "#595959", "#7f7f7f", "#a5a5a5", "#cccccc", "#e5e5e5",
];

// ── Color allocation ──────────────────────────────────────────────────

/**
 * Pick a color from the given palette that is maximally distinct
 * from all colors already in use.
 *
 * @param existingColors Array of hex colors already assigned.
 * @param palette The palette to pick from. Defaults to playerColors.
 * @returns The most distinct hex color from the palette.
 */
export function allocateColor(
  existingColors: string[],
  palette: readonly string[] = playerColors,
): string {
  if (existingColors.length === 0) {
    return palette[0]!;
  }

  const existingLabs = existingColors.map((c) => rgbToLab(hexToRgb(c)));

  let bestColor = palette[0]!;
  let bestMinDist = -1;

  for (const candidate of palette) {
    // Skip colors already in use
    if (existingColors.includes(candidate)) continue;

    const candLab = rgbToLab(hexToRgb(candidate));
    let minDist = Infinity;

    for (const eLab of existingLabs) {
      const d = deltaE2000(candLab, eLab);
      if (d < minDist) minDist = d;
    }

    if (minDist > bestMinDist) {
      bestMinDist = minDist;
      bestColor = candidate;
    }
  }

  return bestColor;
}
