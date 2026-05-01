'use strict';

const { logger } = require('../utils/logger');
const { NotionError, AuthError, NotFoundError, RateLimitError } = require('../utils/errors');

/**
 * MCP transport adapters. Each transport implements:
 *   async invoke(operation, params) → Promise<result>
 *   async close()
 *
 * Operations follow the Notion API namespace (e.g. 'pages.create', 'databases.query').
 * Transports are responsible for translating those into transport-specific calls.
 */

/**
 * HttpTransport — talks JSON over HTTP to a Notion MCP server.
 *
 * Wire protocol (request/response):
 *   POST {baseUrl}/invoke
 *   { "operation": "pages.create", "params": { ... } }
 *   → { "ok": true, "result": ... }    on success
 *   → { "ok": false, "error": { "code": "...", "message": "..." } }  on failure
 *
 * Servers that don't conform to this contract should be wrapped with a custom transport.
 */
class HttpTransport {
  constructor({ baseUrl, fetchImpl, timeoutMs = 15000, headers = {} } = {}) {
    if (!baseUrl) throw new NotionError('HttpTransport requires baseUrl');
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.fetchImpl = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
    if (!this.fetchImpl) {
      throw new NotionError(
        'HttpTransport requires global fetch (Node 18+) or a fetchImpl override'
      );
    }
    this.timeoutMs = timeoutMs;
    this.headers = { 'content-type': 'application/json', ...headers };
  }

  async invoke(operation, params = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/invoke`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ operation, params }),
        signal: controller.signal
      });
      const data = await safeJson(response);
      if (!response.ok || (data && data.ok === false)) {
        throw mapMcpError(response.status, data, operation);
      }
      return data?.result ?? data;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new NotionError(`MCP HTTP timeout after ${this.timeoutMs}ms (${operation})`, {
          cause: err
        });
      }
      if (err instanceof NotionError) throw err;
      throw new NotionError(`MCP HTTP error: ${err.message}`, { cause: err });
    } finally {
      clearTimeout(timer);
    }
  }

  async close() {
    // HTTP is connectionless; nothing to close
  }
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch (_err) {
    return null;
  }
}

function mapMcpError(httpStatus, body, operation) {
  const code = body?.error?.code || body?.code || '';
  const message = body?.error?.message || body?.message || `MCP call failed: ${operation}`;
  if (httpStatus === 401 || code === 'unauthorized') {
    return new AuthError(message, { status: 401 });
  }
  if (httpStatus === 404 || code === 'not_found') {
    return new NotFoundError(message, { status: 404 });
  }
  if (httpStatus === 429 || code === 'rate_limited') {
    return new RateLimitError(message, { status: 429 });
  }
  return new NotionError(message, { status: httpStatus });
}

/**
 * NoopTransport — used when MCP is disabled. Always throws so the bridge falls back.
 */
class NoopTransport {
  async invoke(operation) {
    throw new NotionError(`MCP transport not configured (operation: ${operation})`);
  }
  async close() {}
}

module.exports = { HttpTransport, NoopTransport };
