/**
 * Verify your Notion API key is working.
 *
 *   node examples/01-verify-connection.js
 */

require('dotenv').config();
const { NotionClient, validateConfig } = require('..');

(async () => {
  const result = validateConfig();
  if (!result.valid) {
    console.error('❌  Config errors:');
    result.errors.forEach((e) => console.error('   -', e));
    process.exit(1);
  }

  const client = new NotionClient();
  try {
    const me = await client.verifyConnection();
    console.log('✅  Connected to Notion');
    console.log('   Integration:', me?.name || me?.bot?.owner?.user?.name || '(unknown)');
    console.log('   Workspace ID:', me?.bot?.workspace_name || '(not exposed)');
  } catch (err) {
    console.error('❌  Failed:', err.message);
    process.exit(2);
  }
})();
