/**
 * Enforces a minimum gap between successive calls to a rate-limited
 * external service — e.g. Nominatim's usage policy states an absolute
 * maximum of 1 request/second, self-enforced by the client, not
 * automatically rejected server-side beyond an eventual ban. Every call
 * to `throttle()` waits (if necessary) until at least `minIntervalMs`
 * has elapsed since the last call resolved, then "reserves" the current
 * time as the new last-call timestamp before returning — this holds
 * even under concurrent callers within one process, since each call
 * awaits the shared `queue` promise chain rather than reading/writing
 * `lastCallAt` independently (which would race).
 */
export class MinIntervalThrottle {
  private queue: Promise<void> = Promise.resolve();
  private lastCallAt = 0;

  constructor(private readonly minIntervalMs: number) {}

  async throttle(): Promise<void> {
    const runNext = this.queue.then(async () => {
      const now = Date.now();
      const elapsed = now - this.lastCallAt;
      if (elapsed < this.minIntervalMs) {
        await new Promise((resolve) => setTimeout(resolve, this.minIntervalMs - elapsed));
      }
      this.lastCallAt = Date.now();
    });
    this.queue = runNext;
    await runNext;
  }
}
