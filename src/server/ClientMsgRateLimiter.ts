const MAX_PER_SECOND = 10;
const MAX_PER_MINUTE = 150;
const MAX_MSG_BYTES = 500;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024; // 2MB

export class ClientMsgRateLimiter {
  private secondTimestamps: number[] = [];
  private minuteTimestamps: number[] = [];
  private totalBytes = 0;

  /** Returns true if the message is allowed, false if rate-limited. */
  allow(raw: string, now: number = Date.now()): boolean {
    const msgBytes = Buffer.byteLength(raw, "utf-8");

    // Per-message size cap
    if (msgBytes > MAX_MSG_BYTES) {
      return false;
    }

    // Total bytes cap
    if (this.totalBytes + msgBytes > MAX_TOTAL_BYTES) {
      return false;
    }

    // Prune old timestamps
    this.secondTimestamps = this.secondTimestamps.filter(
      (t) => now - t < 1000,
    );
    this.minuteTimestamps = this.minuteTimestamps.filter(
      (t) => now - t < 60_000,
    );

    // Per-second limit
    if (this.secondTimestamps.length >= MAX_PER_SECOND) {
      return false;
    }

    // Per-minute limit
    if (this.minuteTimestamps.length >= MAX_PER_MINUTE) {
      return false;
    }

    // Accept
    this.secondTimestamps.push(now);
    this.minuteTimestamps.push(now);
    this.totalBytes += msgBytes;

    return true;
  }

  /** Reset all counters */
  reset(): void {
    this.secondTimestamps = [];
    this.minuteTimestamps = [];
    this.totalBytes = 0;
  }

  getTotalBytes(): number {
    return this.totalBytes;
  }
}
