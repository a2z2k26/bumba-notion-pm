/**
 * Use the optional MCP bridge to route Notion calls through a Notion MCP
 * server when one is available — falling back to the direct API otherwise.
 *
 *   node examples/05-mcp-bridge.js
 *
 * Required env vars:
 *   - NOTION_API_KEY   (always — the bridge uses this for the API fallback)
 *
 * Optional env vars:
 *   - NOTION_MCP_ENABLED=true
 *   - NOTION_MCP_SERVER_URL=http://localhost:3000
 *
 * If no MCP server is detected, the bridge transparently uses the API.
 */

require('dotenv').config();
const { NotionClient, NotionMCPBridge } = require('..');

(async () => {
  const apiClient = new NotionClient();
  const bridge = new NotionMCPBridge({ apiClient, mode: 'auto' });

  bridge.on('fallback', ({ operation, error }) => {
    console.warn(`⚠️  MCP failed for ${operation} → API fallback (${error.message})`);
  });

  const status = await bridge.initialize();
  console.log('Bridge status:', status);
  console.log(
    status.activeRoute === 'mcp'
      ? '➡️  Routing through MCP transport'
      : '➡️  Routing through direct Notion API'
  );

  // Same shape as NotionClient — call a low-cost operation
  const me = await bridge.users.me({});
  console.log('users.me:', me?.name || me?.id || me);

  await bridge.close();
})();
