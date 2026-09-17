import { MinIntervalThrottle } from '@/lib/throttle';

describe('MinIntervalThrottle', () => {
  it('does not delay the first call', async () => {
    const throttle = new MinIntervalThrottle(100);
    const start = Date.now();
    await throttle.throttle();
    expect(Date.now() - start).toBeLessThan(50);
  });

  it('delays a second call to respect the minimum interval', async () => {
    const throttle = new MinIntervalThrottle(100);
    const start = Date.now();
    await throttle.throttle();
    await throttle.throttle();
    expect(Date.now() - start).toBeGreaterThanOrEqual(90); // small tolerance for timer jitter
  });

  it('does not delay a call that naturally arrives after the interval has already elapsed', async () => {
    const throttle = new MinIntervalThrottle(50);
    await throttle.throttle();
    await new Promise((resolve) => setTimeout(resolve, 60));
    const start = Date.now();
    await throttle.throttle();
    expect(Date.now() - start).toBeLessThan(30);
  });

  it('serializes concurrent callers so total elapsed time reflects the full sequence', async () => {
    const throttle = new MinIntervalThrottle(50);
    const start = Date.now();
    await Promise.all([throttle.throttle(), throttle.throttle(), throttle.throttle()]);
    // 3 calls at a 50ms minimum interval each: at least ~100ms total
    // (1st immediate, 2nd waits ~50ms, 3rd waits ~50ms more).
    expect(Date.now() - start).toBeGreaterThanOrEqual(90);
  }, 10000);
});
