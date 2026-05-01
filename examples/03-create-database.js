/**
 * Create one of the built-in PM databases (Tasks, Sprints, Epics, or Projects).
 *
 *   node examples/03-create-database.js
 *
 * Requires NOTION_API_KEY and NOTION_PARENT_PAGE_ID.
 */

require('dotenv').config();
const { NotionPublisher } = require('..');

(async () => {
  const publisher = new NotionPublisher();

  const db = await publisher.createPMDatabase('tasks', 'My Tasks');
  console.log('✅  Created tasks database:', db.url || db.id);
  console.log('\n   Add NOTION_TASKS_DATABASE_ID to your .env to use the GitHub sync example:');
  console.log(`   NOTION_TASKS_DATABASE_ID=${db.id}`);
})();
