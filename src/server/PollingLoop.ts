/**
 * Async polling utility with sequential execution guarantee.
 * Ensures the previous invocation completes before scheduling the next.
 */
export class PollingLoop {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  constructor(
    private readonly fn: () => Promise<void>,
    private readonly intervalMs: number,
  ) {}

  /** Start the polling loop. No-op if already running. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.schedule();
  }

  /** Stop the polling loop. The current execution (if any) will finish. */
  stop(): void {
    this.running = false;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private schedule(): void {
    if (!this.running) return;

    this.timer = setTimeout(async () => {
      if (!this.running) return;
      try {
        await this.fn();
      } catch {
        // Errors are swallowed to keep the loop alive.
        // Callers should handle errors inside their fn.
      }
      this.schedule();
    }, this.intervalMs);
  }
}
