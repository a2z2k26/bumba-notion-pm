'use strict';

/**
 * Bumba Notion PM — Node.js primitives for project management
 * integrations with Notion.
 */

const { NotionClient } = require('./client/notion-client');
const { validateConfig, assertConfig } = require('./client/config');
const { NotionPublisher } = require('./publisher/notion-publisher');
const blocks = require('./publisher/blocks');
const schemas = require('./publisher/schemas');
const { GitHubIssueBridge } = require('./sync/issue-bridge');
const { NotionMCPBridge } = require('./mcp/bridge');
const { MCPDetector, getDetector } = require('./mcp/detector');
const { HttpTransport, NoopTransport } = require('./mcp/transports');
const { runWizard } = require('./setup/wizard');
const errors = require('./utils/errors');
const { logger } = require('./utils/logger');

module.exports = {
  NotionClient,
  NotionPublisher,
  GitHubIssueBridge,
  NotionMCPBridge,
  MCPDetector,
  getDetector,
  HttpTransport,
  NoopTransport,
  blocks,
  schemas,
  validateConfig,
  assertConfig,
  runWizard,
  logger,
  errors
};
