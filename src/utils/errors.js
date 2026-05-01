'use strict';

/**
 * Typed errors for Bumba Notion PM.
 * All custom errors extend NotionError so callers can `instanceof` once.
 */

class NotionError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = options.code || 'NOTION_ERROR';
    if (options.cause) this.cause = options.cause;
    if (options.status) this.status = options.status;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

class ConfigError extends NotionError {
  constructor(message, options = {}) {
    super(message, { code: 'CONFIG_ERROR', ...options });
  }
}

class AuthError extends NotionError {
  constructor(message, options = {}) {
    super(message, { code: 'AUTH_ERROR', status: 401, ...options });
  }
}

class RateLimitError extends NotionError {
  constructor(message, options = {}) {
    super(message, { code: 'RATE_LIMIT', status: 429, ...options });
    this.retryAfterMs = options.retryAfterMs;
  }
}

class NotFoundError extends NotionError {
  constructor(message, options = {}) {
    super(message, { code: 'NOT_FOUND', status: 404, ...options });
  }
}

class ValidationError extends NotionError {
  constructor(message, options = {}) {
    super(message, { code: 'VALIDATION_ERROR', ...options });
    this.fields = options.fields;
  }
}

class SyncError extends NotionError {
  constructor(message, options = {}) {
    super(message, { code: 'SYNC_ERROR', ...options });
  }
}

module.exports = {
  NotionError,
  ConfigError,
  AuthError,
  RateLimitError,
  NotFoundError,
  ValidationError,
  SyncError
};
