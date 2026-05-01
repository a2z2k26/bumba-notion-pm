'use strict';

const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const { NotionClient } = require('../client/notion-client');
const { validateConfig } = require('../client/config');
const { logger } = require('../utils/logger');

/**
 * Interactive setup wizard. Guides a user through obtaining a Notion API key,
 * setting NOTION_PARENT_PAGE_ID, and verifying the connection. Writes results
 * to a `.env` file at the project root (creating one if missing).
 */
async function runWizard({ envPath = path.resolve(process.cwd(), '.env') } = {}) {
  console.log('\n📓  Bumba Notion PM — Setup Wizard\n');
  console.log('1. Visit https://www.notion.so/my-integrations and create an integration.');
  console.log('2. Copy the integration token (starts with "secret_" or "ntn_").');
  console.log('3. Create or pick a parent page in Notion and share it with the integration.\n');

  const existing = readEnv(envPath);

  const answers = await inquirer.prompt([
    {
      type: 'password',
      name: 'NOTION_API_KEY',
      message: 'Notion API key:',
      mask: '*',
      default: existing.NOTION_API_KEY,
      validate: (v) =>
        /^(secret_|ntn_)[A-Za-z0-9_-]{20,}$/.test(v) ||
        'Token should start with "secret_" or "ntn_" and be at least 20 chars long'
    },
    {
      type: 'input',
      name: 'NOTION_PARENT_PAGE_ID',
      message: 'Parent page ID (32-char hex):',
      default: existing.NOTION_PARENT_PAGE_ID,
      validate: (v) =>
        /^[a-f0-9-]{32,36}$/i.test(v) || 'Expected a 32-character hex ID (with or without dashes)'
    },
    {
      type: 'confirm',
      name: 'verify',
      message: 'Verify connection now?',
      default: true
    }
  ]);

  if (answers.verify) {
    const ok = await verify(answers.NOTION_API_KEY);
    if (!ok) {
      console.error('\n❌  Verification failed. Settings will still be written.');
    } else {
      console.log('\n✅  Verified.');
    }
  }

  const merged = { ...existing, ...answers };
  delete merged.verify;
  writeEnv(envPath, merged);
  console.log(`\n📝  Wrote ${envPath}`);

  const result = validateConfig(merged);
  if (result.warnings.length) {
    console.log('\n⚠️   Warnings:');
    result.warnings.forEach((w) => console.log(`   - ${w}`));
  }
}

async function verify(apiKey) {
  try {
    const client = new NotionClient({ apiKey });
    const me = await client.verifyConnection();
    console.log(`   Connected as: ${me?.name || me?.bot?.owner?.user?.name || 'integration'}`);
    return true;
  } catch (err) {
    logger.error('Verification failed:', err.message);
    return false;
  }
}

function readEnv(envPath) {
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const out = {};
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line
      .slice(idx + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    out[key] = value;
  }
  return out;
}

function writeEnv(envPath, values) {
  const order = [
    'NOTION_API_KEY',
    'NOTION_PARENT_PAGE_ID',
    'NOTION_DATABASE_ID',
    'NOTION_WORKSPACE_ID',
    'NOTION_API_VERSION',
    'GITHUB_TOKEN',
    'GITHUB_REPO',
    'NOTION_TASKS_DATABASE_ID'
  ];
  const seen = new Set(order);
  const lines = order
    .filter((k) => values[k] !== undefined && values[k] !== '')
    .map((k) => `${k}=${shellQuote(values[k])}`);
  for (const [k, v] of Object.entries(values)) {
    if (!seen.has(k) && v) {
      lines.push(`${k}=${shellQuote(v)}`);
    }
  }
  fs.writeFileSync(envPath, lines.join('\n') + '\n', { mode: 0o600 });
}

function shellQuote(value) {
  const str = String(value);
  if (/[\s"'`$\\]/.test(str)) return `"${str.replace(/(["\\$`])/g, '\\$1')}"`;
  return str;
}

module.exports = { runWizard };
