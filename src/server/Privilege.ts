// ---------------------------------------------------------------------------
// Privilege – cosmetic ownership, profanity, and slur detection
// ---------------------------------------------------------------------------

const BANNED_WORDS: string[] = [
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "dick",
  "cunt",
  "damn",
  "bastard",
  "piss",
  "crap",
];

const SLURS: string[] = [
  "nigger",
  "nigga",
  "faggot",
  "fag",
  "retard",
  "spic",
  "chink",
  "kike",
  "tranny",
  "dyke",
];

/** Check that all cosmetic references are owned by the player. */
export function validateCosmetics(
  refs: string[],
  owned: Set<string>,
): { valid: boolean; invalid: string[] } {
  const invalid = refs.filter((r) => !owned.has(r));
  return { valid: invalid.length === 0, invalid };
}

/** Replace banned words with asterisks, case-insensitive. */
export function censorProfanity(text: string): string {
  let result = text;
  for (const word of BANNED_WORDS) {
    const regex = new RegExp(word, "gi");
    result = result.replace(regex, "*".repeat(word.length));
  }
  return result;
}

/**
 * Detect slurs that may span across username and clan tag boundary.
 * Concatenates username + clanTag (if present) and checks for slurs.
 */
export function detectSlur(
  username: string,
  clanTag: string | null,
): { detected: boolean; match?: string } {
  const combined = (username + (clanTag ?? "")).toLowerCase();
  // Also check tag + username order
  const reversed = ((clanTag ?? "") + username).toLowerCase();

  for (const slur of SLURS) {
    if (combined.includes(slur) || reversed.includes(slur)) {
      return { detected: true, match: slur };
    }
  }
  return { detected: false };
}
