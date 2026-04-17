// ---------------------------------------------------------------------------
// MultiTabDetector – localStorage-based lock to prevent multi-tab play
// ---------------------------------------------------------------------------

const LOCK_KEY = "gf_tab_lock";
const HEARTBEAT_INTERVAL_MS = 1000;
const STALE_THRESHOLD_MS = 3000;
export const PUNISHMENT_DURATION_MS = 10000;

export class MultiTabDetector {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private blockedUntil: number = 0;
  private tabId: string;
  private storage: Storage;

  constructor(storage: Storage) {
    this.storage = storage;
    this.tabId = Math.random().toString(36).slice(2);
  }

  start(): void {
    if (this.intervalId !== null) return;

    const existing = this.readLock();
    if (existing && !this.isStale(existing.timestamp)) {
      // Another tab holds the lock – punish this tab
      this.blockedUntil = Date.now() + PUNISHMENT_DURATION_MS;
    }

    this.writeLock();
    this.intervalId = setInterval(() => this.heartbeat(), HEARTBEAT_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    // Only clear lock if we own it
    const existing = this.readLock();
    if (existing && existing.tabId === this.tabId) {
      this.storage.removeItem(LOCK_KEY);
    }
  }

  isBlocked(): boolean {
    return Date.now() < this.blockedUntil;
  }

  private heartbeat(): void {
    const existing = this.readLock();
    if (!existing || existing.tabId === this.tabId || this.isStale(existing.timestamp)) {
      this.writeLock();
    } else {
      // Another tab is active – punish
      this.blockedUntil = Date.now() + PUNISHMENT_DURATION_MS;
    }
  }

  private writeLock(): void {
    this.storage.setItem(
      LOCK_KEY,
      JSON.stringify({ tabId: this.tabId, timestamp: Date.now() }),
    );
  }

  private readLock(): { tabId: string; timestamp: number } | null {
    const raw = this.storage.getItem(LOCK_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private isStale(timestamp: number): boolean {
    return Date.now() - timestamp > STALE_THRESHOLD_MS;
  }
}
