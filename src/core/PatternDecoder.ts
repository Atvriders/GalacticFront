// ---------------------------------------------------------------------------
// PatternDecoder – decode bitpacked territory patterns
// ---------------------------------------------------------------------------
//
// 3-byte header:
//   byte 0: version (must be 0)
//   byte 1: scale (bits 0-2) | width_hi (bits 3-7)
//   byte 2: width_lo (bits 0-1) | height (bits 2-7)
//
// Payload: 1 bit per pixel, 0 = primary, 1 = secondary.

export class PatternDecoder {
  readonly version: number;
  readonly scale: number;
  readonly width: number;
  readonly height: number;
  readonly scaledWidth: number;
  readonly scaledHeight: number;

  private readonly payload: Uint8Array;

  constructor(data: Uint8Array) {
    if (data.length < 3) {
      throw new Error("PatternDecoder: data too short, need at least 3 bytes");
    }

    this.version = data[0];
    if (this.version !== 0) {
      throw new Error(`PatternDecoder: unsupported version ${this.version}`);
    }

    this.scale = data[1] & 0b00000111;
    const widthHi = (data[1] >> 3) & 0b11111;
    const widthLo = data[2] & 0b00000011;
    this.width = (widthHi << 2) | widthLo;
    this.height = (data[2] >> 2) & 0b111111;

    this.scaledWidth = this.width << this.scale;
    this.scaledHeight = this.height << this.scale;

    const totalPixels = this.width * this.height;
    const payloadBytes = Math.ceil(totalPixels / 8);
    const expectedLength = 3 + payloadBytes;
    if (data.length < expectedLength) {
      throw new Error(
        `PatternDecoder: expected ${expectedLength} bytes, got ${data.length}`,
      );
    }

    this.payload = data.slice(3, 3 + payloadBytes);
  }

  /** Returns true if the pixel at (x, y) is primary colour. */
  isPrimary(x: number, y: number): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      throw new RangeError(
        `PatternDecoder: (${x}, ${y}) out of bounds (${this.width}x${this.height})`,
      );
    }
    const bitIndex = y * this.width + x;
    const byteIndex = bitIndex >> 3;
    const bitOffset = 7 - (bitIndex & 7);
    return ((this.payload[byteIndex] >> bitOffset) & 1) === 0;
  }
}
