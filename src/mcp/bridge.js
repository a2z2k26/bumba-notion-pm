'use strict';

const { EventEmitter } = require('events');
const { logger } = require('../utils/logger');
const { NotionError } = require('../utils/errors');
const { getDetector } = require('./detector');
const { HttpTransport } = require('./transports');

/**
 * NotionMCPBridge — routes Notion operations through an MCP server when one is
 * available, otherwise falls back to a direct Notion API client.
 *
 * Usage:
 *
 *   const { NotionClient, NotionMCPBridge } = require('bumba-notion-pm');
 *   const apiClient = new NotionClient();
 *   const bridge = new NotionMCPBridge({ apiClient });
 *   await bridge.initialize();
 *
 *   // Same shape as NotionClient — bridge picks the route
 *   const page = await bridge.pages.create({ ... });
 *
 *   bridge.mode  // 'mcp' or 'api'
 *
 * Modes:
 *   - 'auto' (default): detect MCP, fall back to API on failure
 *   - 'mcp-only':       require MCP, throw if unavailable
 *   - 'api-only':       skip detection, always use API
 */
class NotionMCPBridge extends EventEmitter {
  constructor(options = {}) {
    super();
    if (!options.apiClient) {
      throw new NotionError('NotionMCPBridge requires `apiClient` (a NotionClient instance)');
    }
    this.apiClient = options.apiClient;
    this.mode = options.mode || 'auto';
    this.detector = options.detector || getDetector();
    this._transport = options.transport || null;
    this._initialized = false;
    this._activeRoute = 'api'; // 'api' | 'mcp'

    // Mirror the @notionhq/client surface, routed through this.invoke()
    this.pages = {
      create: (args) => this.invoke('pages.create', args),
      retrieve: (args) => this.invoke('pages.retrieve', args),
      update: (args) => this.invoke('pages.update', args)
    };
    this.databases = {
      create: (args) => this.invoke('databases.create', args),
      retrieve: (args) => this.invoke('databases.retrieve', args),
      query: (args) => this.invoke('databases.query', args),
      update: (args) => this.invoke('databases.update', args)
    };
    this.blocks = {
      retrieve: (args) => this.invoke('blocks.retrieve', args),
      update: (args) => this.invoke('blocks.update', args),
      delete: (args) => this.invoke('blocks.delete', args),
      children: {
        list: (args) => this.invoke('blocks.children.list', args),
        append: (args) => this.invoke('blocks.children.append', args)
      }
    };
    this.users = {
      list: (args) => this.invoke('users.list', args),
      me: (args) => this.invoke('users.me', args),
      retrieve: (args) => this.invoke('users.retrieve', args)
    };
    this.search = (args) => this.invoke('search', args);
  }

  /**
   * Detect MCP availability and prepare the active transport.
   * Idempotent — calling again re-runs detection (forced).
   */
  async initialize({ force = false } = {}) {
    if (this.mode === 'api-only') {
      this._activeRoute = 'api';
      this._initialized = true;
      logger.info('MCP bridge: api-only mode (MCP detection skipped)');
      this.emit('ready', this.status());
      return this.status();
    }

    const detection = await this.detector.detect({ force });

    if (detection.available) {
      try {
        if (!this._transport) {
          this._transport = this._buildTransport(detection);
        }
        this._activeRoute = 'mcp';
        logger.info(`MCP bridge: routing via ${detection.method}`);
      } catch (err) {
        logger.warn(`MCP bridge: failed to build transport — ${err.message}`);
        if (this.mode === 'mcp-only') throw err;
        this._activeRoute = 'api';
      }
    } else {
      if (this.mode === 'mcp-only') {
        throw new NotionError('MCP bridge: mcp-only mode but no MCP server detected');
      }
      this._activeRoute = 'api';
      logger.info('MCP bridge: no MCP detected, using direct API');
    }

    this._initialized = true;
    this.emit('ready', this.status());
    return this.status();
  }

  /**
   * Invoke a Notion operation. Routes via MCP if active, otherwise direct API.
   * On MCP transport failure (auto mode), falls back to API and emits 'fallback'.
   */
  async invoke(operation, params) {
    if (!this._initialized) await this.initialize();

    if (this._activeRoute === 'mcp' && this._transport) {
      try {
        return await this._transport.invoke(operation, params);
      } catch (err) {
        if (this.mode === 'mcp-only') throw err;
        logger.warn(`MCP call failed (${operation}): ${err.message} — falling back to API`);
        this.emit('fallback', { operation, error: err });
        this._activeRoute = 'api';
        return this._invokeApi(operation, params);
      }
    }

    return this._invokeApi(operation, params);
  }

  /**
   * Force re-detection. Useful after starting/stopping an MCP server.
   */
  async refresh() {
    this.detector.clearCache();
    return this.initialize({ force: true });
  }

  status() {
    return {
      mode: this.mode,
      activeRoute: this._activeRoute,
      mcpAvailable: this._activeRoute === 'mcp',
      initialized: this._initialized
    };
  }

  async close() {
    if (this._transport && typeof this._transport.close === 'function') {
      await this._transport.close();
    }
    this._transport = null;
    this._initialized = false;
  }

  _buildTransport(detection) {
    if (detection.method === 'http') {
      return new HttpTransport({ baseUrl: detection.url });
    }
    if (detection.method === 'env' && detection.config?.url) {
      return new HttpTransport({ baseUrl: detection.config.url });
    }
    // IPC and Claude Desktop config detection are signals — we don't ship
    // transports for them yet. Provide a clear message.
    throw new NotionError(
      `MCP transport for method "${detection.method}" is not yet implemented. ` +
        `Use NOTION_MCP_SERVER_URL with an HTTP-based MCP server, or set mode: 'api-only'.`
    );
  }

  async _invokeApi(operation, params) {
    const target = resolveApiTarget(this.apiClient, operation);
    if (!target) {
      throw new NotionError(`Unknown operation: ${operation}`);
    }
    return target(params);
  }
}

function resolveApiTarget(apiClient, operation) {
  const segments = operation.split('.');
  let cursor = apiClient;
  for (const seg of segments) {
    if (cursor == null) return null;
    cursor = cursor[seg];
  }
  return typeof cursor === 'function' ? cursor.bind(walkParent(apiClient, operation)) : null;
}

function walkParent(apiClient, operation) {
  const segments = operation.split('.');
  let cursor = apiClient;
  for (let i = 0; i < segments.length - 1; i++) {
    cursor = cursor[segments[i]];
  }
  return cursor;
}

module.exports = { NotionMCPBridge };
