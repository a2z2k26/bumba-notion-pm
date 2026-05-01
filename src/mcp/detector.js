'use strict';

const fs = require('fs').promises;
const net = require('net');
const os = require('os');
const path = require('path');
const { logger } = require('../utils/logger');

/**
 * MCPDetector — discovers a Notion MCP server by trying multiple transports.
 *
 * Detection methods, in order:
 *   1. HTTP server (env NOTION_MCP_SERVER_URL or http://localhost:3000)
 *   2. IPC socket (env NOTION_MCP_SOCKET, /tmp/notion-mcp.sock, ~/.notion-mcp/socket)
 *   3. Claude Desktop config (~/Library/Application Support/Claude/mcp.json etc.)
 *   4. Explicit env config (NOTION_MCP_ENABLED=true with NOTION_MCP_COMMAND/URL)
 *
 * Results are cached for `cacheTtlMs` (default 30s).
 */
class MCPDetector {
  constructor(options = {}) {
    this.cacheTtlMs = options.cacheTtlMs ?? 30000;
    this.httpTimeoutMs = options.httpTimeoutMs ?? 2000;
    this.ipcTimeoutMs = options.ipcTimeoutMs ?? 1000;
    this._cache = { lastCheck: 0, result: null };
  }

  async detect({ force = false } = {}) {
    if (!force && this._cache.result && Date.now() - this._cache.lastCheck < this.cacheTtlMs) {
      return this._cache.result;
    }

    const methods = [
      () => this._checkHttp(),
      () => this._checkIpc(),
      () => this._checkClaudeDesktop(),
      () => this._checkEnv()
    ];

    for (const method of methods) {
      try {
        const result = await method();
        if (result.available) {
          logger.info(`MCP detected via ${result.method}`);
          this._cache = { lastCheck: Date.now(), result };
          return result;
        }
      } catch (err) {
        logger.debug(`MCP detection step failed: ${err.message}`);
      }
    }

    const miss = { available: false, method: 'none', message: 'No Notion MCP server detected' };
    this._cache = { lastCheck: Date.now(), result: miss };
    return miss;
  }

  clearCache() {
    this._cache = { lastCheck: 0, result: null };
  }

  async _checkHttp() {
    const url = process.env.NOTION_MCP_SERVER_URL || 'http://localhost:3000';
    const fetchImpl = typeof fetch !== 'undefined' ? fetch : null;
    if (!fetchImpl) {
      return { available: false, method: 'http', reason: 'fetch unavailable' };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.httpTimeoutMs);
    try {
      const response = await fetchImpl(`${url}/health`, { signal: controller.signal });
      if (!response.ok) return { available: false, method: 'http' };
      const data = await response.json().catch(() => null);
      const looksLikeNotionMcp =
        data &&
        data.status === 'ready' &&
        Array.isArray(data.capabilities) &&
        data.capabilities.includes('notion');
      if (looksLikeNotionMcp) {
        return {
          available: true,
          method: 'http',
          url,
          capabilities: data.capabilities,
          version: data.version
        };
      }
      return { available: false, method: 'http' };
    } catch (_err) {
      return { available: false, method: 'http' };
    } finally {
      clearTimeout(timer);
    }
  }

  async _checkIpc() {
    const candidates = [
      process.env.NOTION_MCP_SOCKET,
      '/tmp/notion-mcp.sock',
      path.join(os.homedir(), '.notion-mcp', 'socket'),
      process.platform === 'win32' ? '\\\\.\\pipe\\notion-mcp' : null
    ].filter(Boolean);

    for (const socketPath of candidates) {
      const ok = await new Promise((resolve) => {
        const client = net.createConnection(socketPath);
        const timer = setTimeout(() => {
          client.destroy();
          resolve(false);
        }, this.ipcTimeoutMs);
        client.on('connect', () => {
          clearTimeout(timer);
          client.end();
          resolve(true);
        });
        client.on('error', () => {
          clearTimeout(timer);
          resolve(false);
        });
      });
      if (ok) {
        return { available: true, method: 'ipc', socketPath };
      }
    }
    return { available: false, method: 'ipc' };
  }

  async _checkClaudeDesktop() {
    const home = os.homedir();
    const configPaths = [
      path.join(home, 'Library', 'Application Support', 'Claude', 'mcp.json'),
      path.join(home, '.config', 'claude', 'mcp.json'),
      path.join(home, 'AppData', 'Roaming', 'Claude', 'mcp.json')
    ];
    for (const configPath of configPaths) {
      try {
        const raw = await fs.readFile(configPath, 'utf8');
        const config = JSON.parse(raw);
        const notion = config?.mcpServers?.notion;
        if (notion?.command) {
          return {
            available: true,
            method: 'claude-desktop-config',
            configPath,
            config: notion
          };
        }
      } catch (_err) {
        continue;
      }
    }
    return { available: false, method: 'claude-desktop-config' };
  }

  async _checkEnv() {
    if (process.env.NOTION_MCP_ENABLED !== 'true') {
      return { available: false, method: 'env' };
    }
    const command = process.env.NOTION_MCP_COMMAND;
    const url = process.env.NOTION_MCP_SERVER_URL;
    if (!command && !url) {
      return { available: false, method: 'env' };
    }
    return {
      available: true,
      method: 'env',
      config: { enabled: true, command, url }
    };
  }
}

let _instance = null;
function getDetector() {
  if (!_instance) _instance = new MCPDetector();
  return _instance;
}

module.exports = { MCPDetector, getDetector };
