/**
 * Sync GitHub Issues into a Notion tasks database.
 *
 *   node examples/04-github-sync.js
 *
 * Required env vars:
 *   - NOTION_API_KEY
 *   - GITHUB_TOKEN  (PAT with `repo` scope)
 *   - GITHUB_REPO   (e.g. "owner/name")
 *   - NOTION_TASKS_DATABASE_ID
 */

require('dotenv').config();
const { GitHubIssueBridge } = require('..');

(async () => {
  const repo = process.env.GITHUB_REPO;
  const databaseId = process.env.NOTION_TASKS_DATABASE_ID;
  if (!repo || !databaseId) {
    console.error('Set GITHUB_REPO and NOTION_TASKS_DATABASE_ID in your .env');
    process.exit(1);
  }

  const bridge = new GitHubIssueBridge({
    repo,
    databaseId,
    direction: 'github-to-notion'
  });

  console.log(`Syncing issues from ${repo} → Notion database ${databaseId.slice(0, 8)}…`);
  const result = await bridge.syncFromGitHub();
  console.log('Done:', result);
})();
