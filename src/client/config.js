'use strict';

const { ConfigError } = require('../utils/errors');

/**
 * Validate environment variables for Bumba Notion PM.
 * Returns { valid, errors, warnings, config } — does not throw.
 * Use assertConfig() if you want a throw-on-invalid variant.
 */
function validateConfig(env = process.env) {
  const errors = [];
  const warnings = [];
  const config = {
    notionApiKey: env.NOTION_API_KEY || '',
    notionParentPageId: env.NOTION_PARENT_PAGE_ID || '',
    notionDatabaseId: env.NOTION_DATABASE_ID || '',
    notionWorkspaceId: env.NOTION_WORKSPACE_ID || '',
    notionApiVersion: env.NOTION_API_VERSION || '2022-06-28',
    githubToken: env.GITHUB_TOKEN || '',
    githubRepo: env.GITHUB_REPO || '',
    notionTasksDatabaseId: env.NOTION_TASKS_DATABASE_ID || '',
    debug: parseBool(env.NOTION_DEBUG)
  };

  if (!config.notionApiKey) {
    errors.push('NOTION_API_KEY is required');
  } else if (!/^(secret_|ntn_)[A-Za-z0-9_-]{20,}$/.test(config.notionApiKey)) {
    errors.push('NOTION_API_KEY format looks invalid (expected to start with "secret_" or "ntn_")');
  }

  if (!config.notionParentPageId) {
    warnings.push(
      'NOTION_PARENT_PAGE_ID is not set; publisher operations that omit a parent will fail'
    );
  } else if (!isLikelyNotionId(config.notionParentPageId)) {
    warnings.push('NOTION_PARENT_PAGE_ID does not look like a Notion ID');
  }

  if (config.notionDatabaseId && !isLikelyNotionId(config.notionDatabaseId)) {
    warnings.push('NOTION_DATABASE_ID does not look like a Notion ID');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    config
  };
}

function assertConfig(env) {
  const result = validateConfig(env);
  if (!result.valid) {
    const msg = `Invalid configuration:\n  - ${result.errors.join('\n  - ')}`;
    throw new ConfigError(msg, { fields: result.errors });
  }
  return result.config;
}

function isLikelyNotionId(value) {
  if (typeof value !== 'string') return false;
  const stripped = value.replace(/-/g, '');
  return /^[a-f0-9]{32}$/i.test(stripped);
}

function parseBool(value) {
  if (typeof value !== 'string') return false;
  return /^(1|true|yes|on)$/i.test(value);
}

module.exports = { validateConfig, assertConfig, isLikelyNotionId };
