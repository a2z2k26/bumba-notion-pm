'use strict';

/**
 * Token-bucket-ish rate limiter sized to Notion's 3 requests/second budget.
 * Each call to acquire() resolves no sooner than `minIntervalMs` after the
 * previous call. Concurrent callers are queued in arrival order.
 */

class RateLimiter {
  constructor({ minIntervalMs = 350 } = {}) {
    this.minIntervalMs = minIntervalMs;
    this._lastReleaseAt = 0;
    this._chain = Promise.resolve();
  }

  acquire() {
    const next = this._chain.then(async () => {
      const now = Date.now();
      const wait = Math.max(0, this._lastReleaseAt + this.minIntervalMs - now);
      if (wait > 0) await sleep(wait);
      this._lastReleaseAt = Date.now();
    });
    this._chain = next.catch(() => {});
    return next;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { RateLimiter, sleep };
