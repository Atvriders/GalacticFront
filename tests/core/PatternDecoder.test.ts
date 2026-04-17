import { describe, it, expect } from "vitest";
import { PatternDecoder } from "@core/PatternDecoder";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal 3-byte header + payload. */
function makePattern(
  version: number,
  scale: number,
  width: number,
  height: number,
  payloadBits: number[],
): Uint8Array {
  const byte1 = (scale & 0b111) | (((width >> 2) & 0b11111) << 3);
  const byte2 = (width & 0b11) | ((height & 0b111111) << 2);
  const totalPixels = width * height;
  const payloadBytes = Math.ceil(totalPixels / 8);
  const payload = new Uint8Array(payloadBytes);

  for (let i = 0; i < payloadBits.length && i < totalPixels; i++) {
    if (payloadBits[i] === 1) {
      const byteIdx = i >> 3;
      const bitOff = 7 - (i & 7);
      payload[byteIdx] |= 1 << bitOff;
    }
  }

  const result = new Uint8Array(3 + payloadBytes);
  result[0] = version;
  result[1] = byte1;
  result[2] = byte2;
  result.set(payload, 3);
  return result;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PatternDecoder", () => {
  it("decodes header fields correctly", () => {
    // width=5, height=4, scale=2
    const data = makePattern(0, 2, 5, 4, new Array(20).fill(0));
    const dec = new PatternDecoder(data);
    expect(dec.version).toBe(0);
    expect(dec.scale).toBe(2);
    expect(dec.width).toBe(5);
    expect(dec.height).toBe(4);
  });

  it("computes scaledWidth and scaledHeight via bit-shift", () => {
    const data = makePattern(0, 3, 4, 6, new Array(24).fill(0));
    const dec = new PatternDecoder(data);
    expect(dec.scaledWidth).toBe(4 << 3);
    expect(dec.scaledHeight).toBe(6 << 3);
  });

  it("isPrimary returns true for 0-bits and false for 1-bits", () => {
    // 2x2 pattern: [0, 1, 1, 0]
    const data = makePattern(0, 0, 2, 2, [0, 1, 1, 0]);
    const dec = new PatternDecoder(data);

    expect(dec.isPrimary(0, 0)).toBe(true); // 0 = primary
    expect(dec.isPrimary(1, 0)).toBe(false); // 1 = secondary
    expect(dec.isPrimary(0, 1)).toBe(false); // 1 = secondary
    expect(dec.isPrimary(1, 1)).toBe(true); // 0 = primary
  });

  it("throws on unsupported version", () => {
    const data = makePattern(1, 0, 2, 2, [0, 0, 0, 0]);
    data[0] = 1;
    expect(() => new PatternDecoder(data)).toThrow("unsupported version");
  });

  it("throws on data too short for header", () => {
    expect(() => new PatternDecoder(new Uint8Array([0, 0]))).toThrow(
      "data too short",
    );
  });

  it("throws on data too short for payload", () => {
    // header says 4x4 = 16 bits = 2 payload bytes, but we only give 1
    const data = new Uint8Array(4); // 3 header + 1 payload (need 2)
    data[0] = 0;
    // width=4, height=4, scale=0
    data[1] = ((4 >> 2) & 0b11111) << 3;
    data[2] = (4 & 0b11) | ((4 & 0b111111) << 2);
    expect(() => new PatternDecoder(data)).toThrow("expected");
  });

  it("throws on out-of-bounds access", () => {
    const data = makePattern(0, 0, 3, 3, new Array(9).fill(0));
    const dec = new PatternDecoder(data);
    expect(() => dec.isPrimary(3, 0)).toThrow("out of bounds");
    expect(() => dec.isPrimary(0, 3)).toThrow("out of bounds");
    expect(() => dec.isPrimary(-1, 0)).toThrow("out of bounds");
  });

  it("handles scale=0 (no shift)", () => {
    const data = makePattern(0, 0, 8, 8, new Array(64).fill(0));
    const dec = new PatternDecoder(data);
    expect(dec.scaledWidth).toBe(8);
    expect(dec.scaledHeight).toBe(8);
  });

  it("handles max width/height values", () => {
    // width max = 7 bits = 127, height max = 6 bits = 63
    const w = 127;
    const h = 63;
    const bits = new Array(w * h).fill(0);
    const data = makePattern(0, 0, w, h, bits);
    const dec = new PatternDecoder(data);
    expect(dec.width).toBe(w);
    expect(dec.height).toBe(h);
  });
});
