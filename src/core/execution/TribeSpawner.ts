// ---------------------------------------------------------------------------
// TribeSpawner — Name generation for AI tribe players
// ---------------------------------------------------------------------------

import type { PseudoRandom } from "../PseudoRandom.js";

const PREFIXES: readonly string[] = [
  "Star",
  "Void",
  "Nova",
  "Nebula",
  "Pulsar",
  "Quasar",
  "Astro",
  "Cosmo",
  "Lunar",
  "Solar",
  "Stellar",
  "Orbital",
  "Photon",
  "Plasma",
  "Quantum",
];

const SUFFIXES: readonly string[] = [
  "hold",
  "reach",
  "gate",
  "forge",
  "keep",
  "port",
  "fall",
  "rise",
  "ward",
  "mark",
  "veil",
  "drift",
  "span",
  "core",
  "haven",
];

/**
 * Generate a unique tribe name by combining a random prefix and suffix.
 */
export function generateTribeName(rng: PseudoRandom): string {
  const prefix = rng.pick([...PREFIXES]);
  const suffix = rng.pick([...SUFFIXES]);
  return `${prefix}${suffix}`;
}

/**
 * Generate a list of unique tribe names.
 * If more names are needed than unique combos, a numeric suffix is appended.
 */
export function generateTribeNames(
  count: number,
  rng: PseudoRandom,
): string[] {
  const used = new Set<string>();
  const names: string[] = [];
  const maxUnique = PREFIXES.length * SUFFIXES.length;
  let attempts = 0;

  while (names.length < count && attempts < count * 10) {
    attempts++;
    let name = generateTribeName(rng);

    if (used.has(name)) {
      // If we've exhausted unique combos, append a number
      if (used.size >= maxUnique) {
        name = `${name}${names.length + 1}`;
      } else {
        continue;
      }
    }

    used.add(name);
    names.push(name);
  }

  return names;
}

/**
 * Find a valid spawn tile for a tribe on the map.
 * Tries random positions until it finds a traversable, unowned tile.
 */
export function findSpawnTile(
  mapWidth: number,
  mapHeight: number,
  isValid: (tile: number) => boolean,
  rng: PseudoRandom,
  maxAttempts: number = 200,
): number {
  const totalTiles = mapWidth * mapHeight;
  for (let i = 0; i < maxAttempts; i++) {
    const tile = rng.nextInt(0, totalTiles - 1);
    if (isValid(tile)) return tile;
  }
  // Fallback: linear scan
  for (let tile = 0; tile < totalTiles; tile++) {
    if (isValid(tile)) return tile;
  }
  return -1;
}

export { PREFIXES, SUFFIXES };
