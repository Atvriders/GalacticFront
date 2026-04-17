import { describe, it, expect } from "vitest";
import { validateUsername, validateClanTag } from "@core/validations/username";

describe("validateUsername", () => {
  it("accepts valid usernames", () => {
    expect(validateUsername("Player1").valid).toBe(true);
    expect(validateUsername("ab_c 123").valid).toBe(true);
    expect(validateUsername("abc").valid).toBe(true); // min length
    expect(validateUsername("a".repeat(27)).valid).toBe(true); // max length
  });

  it("rejects too short", () => {
    const r = validateUsername("ab");
    expect(r.valid).toBe(false);
    expect(r.error).toContain("at least 3");
  });

  it("rejects too long", () => {
    const r = validateUsername("a".repeat(28));
    expect(r.valid).toBe(false);
    expect(r.error).toContain("at most 27");
  });

  it("rejects special characters", () => {
    expect(validateUsername("player@1").valid).toBe(false);
    expect(validateUsername("play!er").valid).toBe(false);
    expect(validateUsername("pl-yer").valid).toBe(false);
  });

  it("allows spaces and underscores", () => {
    expect(validateUsername("my name").valid).toBe(true);
    expect(validateUsername("my_name").valid).toBe(true);
  });
});

describe("validateClanTag", () => {
  it("accepts null", () => {
    expect(validateClanTag(null).valid).toBe(true);
  });

  it("accepts valid tags", () => {
    expect(validateClanTag("AB").valid).toBe(true);
    expect(validateClanTag("ABCDE").valid).toBe(true);
    expect(validateClanTag("X1").valid).toBe(true);
  });

  it("rejects too short", () => {
    const r = validateClanTag("A");
    expect(r.valid).toBe(false);
    expect(r.error).toContain("at least 2");
  });

  it("rejects too long", () => {
    const r = validateClanTag("ABCDEF");
    expect(r.valid).toBe(false);
    expect(r.error).toContain("at most 5");
  });

  it("rejects special characters", () => {
    expect(validateClanTag("A B").valid).toBe(false);
    expect(validateClanTag("A_B").valid).toBe(false);
  });
});
