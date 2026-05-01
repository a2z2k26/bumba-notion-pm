'use strict';

const { Client } = require('@notionhq/client');
const { RateLimiter } = require('../utils/rate-limiter');
const { withRetry } = require('../utils/retry');
const { logger } = require('../utils/logger');
const {
  AuthError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  NotionError
} = require('../utils/errors');

const DEFAULT_NOTION_VERSION = '2022-06-28';

/**
 * NotionClient wraps the official @notionhq/client with rate limiting and retry.
 *
 * Public methods follow the official SDK shape (pages.create, databases.query,
 * blocks.children.append, etc.), but every call goes through the limiter.
 */
class NotionClient {
  constructor(options = {}) {
    const apiKey = options.apiKey || process.env.NOTION_API_KEY;
    if (!apiKey) {
      throw new AuthError('NOTION_API_KEY is required');
    }
    this.notionVersion = options.notionVersion || DEFAULT_NOTION_VERSION;
    this._raw = new Client({
      auth: apiKey,
      notionVersion: this.notionVersion
    });
    this._limiter = new RateLimiter({
      minIntervalMs: options.minIntervalMs ?? 350
    });
    this._retryOpts = {
      maxAttempts: options.maxRetries ?? 4,
      baseDelayMs: options.baseDelayMs ?? 500,
      maxDelayMs: options.maxDelayMs ?? 8000,
      onRetry: ({ attempt, err, delay }) => {
        logger.debug(
          `notion retry attempt=${attempt} delay=${delay}ms reason=${err?.code || err?.message}`
        );
      }
    };
  }

  get raw() {
    return this._raw;
  }

  pages = {
    create: (args) => this._call('pages.create', () => this._raw.pages.create(args)),
    retrieve: (args) => this._call('pages.retrieve', () => this._raw.pages.retrieve(args)),
    update: (args) => this._call('pages.update', () => this._raw.pages.update(args))
  };

  databases = {
    create: (args) => this._call('databases.create', () => this._raw.databases.create(args)),
    retrieve: (args) => this._call('databases.retrieve', () => this._raw.databases.retrieve(args)),
    query: (args) => this._call('databases.query', () => this._raw.databases.query(args)),
    update: (args) => this._call('databases.update', () => this._raw.databases.update(args))
  };

  blocks = {
    retrieve: (args) => this._call('blocks.retrieve', () => this._raw.blocks.retrieve(args)),
    update: (args) => this._call('blocks.update', () => this._raw.blocks.update(args)),
    delete: (args) => this._call('blocks.delete', () => this._raw.blocks.delete(args)),
    children: {
      list: (args) =>
        this._call('blocks.children.list', () => this._raw.blocks.children.list(args)),
      append: (args) =>
        this._call('blocks.children.append', () => this._raw.blocks.children.append(args))
    }
  };

  users = {
    list: (args) => this._call('users.list', () => this._raw.users.list(args ?? {})),
    me: (args) => this._call('users.me', () => this._raw.users.me(args ?? {})),
    retrieve: (args) => this._call('users.retrieve', () => this._raw.users.retrieve(args))
  };

  search = (args) => this._call('search', () => this._raw.search(args));

  /**
   * Verify the API key by issuing a users.me request.
   * Returns the user object on success, throws AuthError on failure.
   */
  async verifyConnection() {
    try {
      return await this.users.me();
    } catch (err) {
      if (err instanceof AuthError) throw err;
      throw new AuthError('Failed to verify Notion API key', { cause: err });
    }
  }

  async _call(label, fn) {
    return withRetry(async () => {
      await this._limiter.acquire();
      try {
        return await fn();
      } catch (rawErr) {
        throw normalizeNotionError(rawErr, label);
      }
    }, this._retryOpts);
  }
}

function normalizeNotionError(err, label) {
  if (err instanceof NotionError) return err;
  const status = err?.status ?? err?.statusCode;
  const code = err?.code || '';
  const message = err?.message || `Notion call failed: ${label}`;

  if (status === 401 || code === 'unauthorized') {
    return new AuthError(message, { cause: err, status });
  }
  if (status === 404 || code === 'object_not_found') {
    return new NotFoundError(message, { cause: err, status });
  }
  if (status === 429 || code === 'rate_limited') {
    const retryAfter = parseRetryAfter(err);
    return new RateLimitError(message, { cause: err, retryAfterMs: retryAfter });
  }
  if (status === 400 || code === 'validation_error') {
    return new ValidationError(message, { cause: err, status });
  }
  return new NotionError(message, { cause: err, status });
}

function parseRetryAfter(err) {
  const headerVal = err?.headers?.['retry-after'] ?? err?.headers?.get?.('retry-after');
  if (!headerVal) return null;
  const seconds = Number(headerVal);
  if (!Number.isFinite(seconds)) return null;
  return seconds * 1000;
}

module.exports = { NotionClient };
