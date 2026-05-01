'use strict';

const { sleep } = require('./rate-limiter');

/**
 * Retry an async function with exponential backoff + jitter.
 * Honors `Retry-After`-style hints via err.retryAfterMs.
 */
async function withRetry(fn, opts = {}) {
  const {
    maxAttempts = 4,
    baseDelayMs = 500,
    maxDelayMs = 8000,
    shouldRetry = defaultShouldRetry,
    onRetry = () => {}
  } = opts;

  let attempt = 0;
  let lastErr;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (!shouldRetry(err) || attempt >= maxAttempts) throw err;
      const hinted = typeof err?.retryAfterMs === 'number' ? err.retryAfterMs : null;
      const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      const jitter = Math.floor(Math.random() * (exp / 2));
      const delay = hinted != null ? hinted : exp + jitter;
      onRetry({ attempt, err, delay });
      await sleep(delay);
    }
  }
  throw lastErr;
}

function defaultShouldRetry(err) {
  if (!err) return false;
  if (err.code === 'RATE_LIMIT') return true;
  const status = err.status;
  if (status === 408 || status === 425 || status === 429) return true;
  if (status >= 500 && status < 600) return true;
  return false;
}

module.exports = { withRetry };
