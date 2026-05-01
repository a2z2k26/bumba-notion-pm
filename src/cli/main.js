'use strict';

const { Command } = require('commander');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

const { NotionClient } = require('../client/notion-client');
const { NotionPublisher } = require('../publisher/notion-publisher');
const { GitHubIssueBridge } = require('../sync/issue-bridge');
const { NotionMCPBridge } = require('../mcp/bridge');
const { getDetector } = require('../mcp/detector');
const { validateConfig } = require('../client/config');
const { runWizard } = require('../setup/wizard');
const { logger } = require('../utils/logger');
const pkg = require('../../package.json');

function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
}

function buildProgram() {
  const program = new Command();
  program
    .name('bumba-notion-pm')
    .description('Bumba Notion PM — GitHub↔Notion sync for project management')
    .version(pkg.version);

  program
    .command('init')
    .description('Run interactive setup wizard')
    .action(async () => {
      loadEnvFile();
      await runWizard();
    });

  program
    .command('verify')
    .description('Verify Notion API key and parent page access')
    .action(async () => {
      loadEnvFile();
      const result = validateConfig();
      if (!result.valid) {
        console.error('Config errors:');
        result.errors.forEach((e) => console.error(`  - ${e}`));
        process.exit(1);
      }
      try {
        const client = new NotionClient();
        const me = await client.verifyConnection();
        console.log(`✅  Connected as: ${me?.name || me?.bot?.owner?.user?.name || 'integration'}`);
        if (result.config.notionParentPageId) {
          await client.pages.retrieve({ page_id: result.config.notionParentPageId });
          console.log('✅  Parent page is accessible');
        }
      } catch (err) {
        console.error(`❌  Verification failed: ${err.message}`);
        process.exit(2);
      }
    });

  program
    .command('create-db')
    .description('Create one of the built-in PM databases')
    .requiredOption('-k, --kind <kind>', 'tasks | sprints | epics | projects')
    .requiredOption('-t, --title <title>', 'Database title')
    .option('-p, --parent <pageId>', 'Parent page ID (defaults to NOTION_PARENT_PAGE_ID)')
    .action(async (opts) => {
      loadEnvFile();
      const publisher = new NotionPublisher({ parentPageId: opts.parent });
      const db = await publisher.createPMDatabase(opts.kind, opts.title);
      console.log(`✅  Created database: ${db.url || db.id}`);
    });

  program
    .command('sync')
    .description('Run GitHub↔Notion issue sync')
    .requiredOption('-r, --repo <owner/name>', 'GitHub repository')
    .requiredOption('-d, --database <id>', 'Notion database ID for tasks')
    .option(
      '--direction <dir>',
      'github-to-notion | notion-to-github | bidirectional',
      'bidirectional'
    )
    .action(async (opts) => {
      loadEnvFile();
      const bridge = new GitHubIssueBridge({
        repo: opts.repo,
        databaseId: opts.database,
        direction: opts.direction
      });
      const result = await bridge.syncAll();
      console.log('Sync complete:');
      console.log(JSON.stringify(result, null, 2));
    });

  program
    .command('mcp-status')
    .description('Detect Notion MCP server availability and report routing')
    .option('--mode <mode>', 'auto | mcp-only | api-only', 'auto')
    .action(async (opts) => {
      loadEnvFile();
      const detector = getDetector();
      detector.clearCache();
      const detection = await detector.detect({ force: true });
      console.log('Detection:');
      console.log(JSON.stringify(detection, null, 2));

      if (!detection.available && opts.mode !== 'mcp-only') {
        console.log('\nBridge would route via: API (direct)');
        return;
      }

      try {
        const apiClient = new NotionClient();
        const bridge = new NotionMCPBridge({ apiClient, mode: opts.mode });
        await bridge.initialize({ force: true });
        console.log('\nBridge status:');
        console.log(JSON.stringify(bridge.status(), null, 2));
        await bridge.close();
      } catch (err) {
        console.error(`\n❌  Bridge initialization failed: ${err.message}`);
        process.exit(2);
      }
    });

  program
    .command('config')
    .description('Show current configuration (API key masked)')
    .action(() => {
      loadEnvFile();
      const { config, valid, errors, warnings } = validateConfig();
      const masked = {
        ...config,
        notionApiKey: config.notionApiKey
          ? config.notionApiKey.slice(0, 8) + '…' + config.notionApiKey.slice(-4)
          : '(not set)',
        githubToken: config.githubToken ? '(set)' : '(not set)'
      };
      console.log(JSON.stringify(masked, null, 2));
      if (!valid) {
        console.error('\nErrors:');
        errors.forEach((e) => console.error(`  - ${e}`));
        process.exit(1);
      }
      if (warnings.length) {
        console.warn('\nWarnings:');
        warnings.forEach((w) => console.warn(`  - ${w}`));
      }
    });

  return program;
}

async function run(argv = process.argv) {
  const program = buildProgram();
  try {
    await program.parseAsync(argv);
  } catch (err) {
    logger.error(err.stack || err.message);
    process.exit(1);
  }
}

module.exports = { buildProgram, run };
