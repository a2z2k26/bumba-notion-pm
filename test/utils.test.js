'use strict';

const { RateLimiter, sleep } = require('../src/utils/rate-limiter');
const { withRetry } = require('../src/utils/retry');
const errors = require('../src/utils/errors');

describe('RateLimiter', () => {
  test('spaces consecutive acquires by at least minIntervalMs', async () => {
    const limiter = new RateLimiter({ minIntervalMs: 100 });
    const t0 = Date.now();
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeGreaterThanOrEqual(180);
  });

  test('does not delay the first acquire', async () => {
    const limiter = new RateLimiter({ minIntervalMs: 200 });
    const t0 = Date.now();
    await limiter.acquire();
    expect(Date.now() - t0).toBeLessThan(50);
  });
});

describe('withRetry', () => {
  test('returns the result of fn on success', async () => {
    const result = await withRetry(async () => 42);
    expect(result).toBe(42);
  });

  test('retries retriable errors and eventually succeeds', async () => {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts += 1;
        if (attempts < 3) {
          const err = new Error('rate limited');
          err.status = 429;
          throw err;
        }
        return 'ok';
      },
      { baseDelayMs: 1, maxDelayMs: 5 }
    );
    expect(result).toBe('ok');
    expect(attempts).toBe(3);
  });

  test('does not retry non-retriable errors', async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts += 1;
          const err = new Error('bad request');
          err.status = 400;
          throw err;
        },
        { baseDelayMs: 1 }
      )
    ).rejects.toThrow('bad request');
    expect(attempts).toBe(1);
  });

  test('gives up after maxAttempts', async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts += 1;
          const err = new Error('flaky');
          err.status = 500;
          throw err;
        },
        { maxAttempts: 3, baseDelayMs: 1 }
      )
    ).rejects.toThrow('flaky');
    expect(attempts).toBe(3);
  });
});

describe('errors', () => {
  test('all custom errors extend NotionError', () => {
    expect(new errors.AuthError('x')).toBeInstanceOf(errors.NotionError);
    expect(new errors.RateLimitError('x')).toBeInstanceOf(errors.NotionError);
    expect(new errors.ValidationError('x')).toBeInstanceOf(errors.NotionError);
    expect(new errors.NotFoundError('x')).toBeInstanceOf(errors.NotionError);
    expect(new errors.SyncError('x')).toBeInstanceOf(errors.NotionError);
    expect(new errors.ConfigError('x')).toBeInstanceOf(errors.NotionError);
  });

  test('errors carry their codes and statuses', () => {
    expect(new errors.AuthError('x').code).toBe('AUTH_ERROR');
    expect(new errors.AuthError('x').status).toBe(401);
    expect(new errors.RateLimitError('x', { retryAfterMs: 5000 }).retryAfterMs).toBe(5000);
  });
});

describe('sleep', () => {
  test('resolves after at least the specified duration', async () => {
    const t0 = Date.now();
    await sleep(50);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(45);
  });
});
