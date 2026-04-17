// ---------------------------------------------------------------------------
// Username & clan-tag validation
// ---------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const USERNAME_REGEX = /^[a-zA-Z0-9 _]+$/;
const CLAN_TAG_REGEX = /^[a-zA-Z0-9]+$/;

export function validateUsername(name: string): ValidationResult {
  if (name.length < 3) {
    return { valid: false, error: "Username must be at least 3 characters" };
  }
  if (name.length > 27) {
    return { valid: false, error: "Username must be at most 27 characters" };
  }
  if (!USERNAME_REGEX.test(name)) {
    return {
      valid: false,
      error: "Username may only contain letters, numbers, spaces, and underscores",
    };
  }
  return { valid: true };
}

export function validateClanTag(tag: string | null): ValidationResult {
  if (tag === null) {
    return { valid: true };
  }
  if (tag.length < 2) {
    return { valid: false, error: "Clan tag must be at least 2 characters" };
  }
  if (tag.length > 5) {
    return { valid: false, error: "Clan tag must be at most 5 characters" };
  }
  if (!CLAN_TAG_REGEX.test(tag)) {
    return {
      valid: false,
      error: "Clan tag may only contain letters and numbers",
    };
  }
  return { valid: true };
}
