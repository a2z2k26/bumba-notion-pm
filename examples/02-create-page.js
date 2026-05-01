/**
 * Create a Notion page with a few blocks.
 *
 *   node examples/02-create-page.js
 *
 * Requires NOTION_API_KEY and NOTION_PARENT_PAGE_ID in your .env.
 */

require('dotenv').config();
const { NotionPublisher } = require('..');

(async () => {
  const publisher = new NotionPublisher();
  const { blocks } = publisher;

  const page = await publisher.publishPage({
    title: 'Hello from bumba-notion-pm',
    blocks: [
      blocks.heading('What is this?', 1),
      blocks.paragraph('This page was created by the bumba-notion-pm example script.'),
      blocks.divider(),
      blocks.heading('Next steps', 2),
      blocks.bulletList([
        'Try the create-database example',
        'Try the github-sync example',
        'Read the docs'
      ]),
      blocks.callout('Tip: every helper here returns a plain Notion API block object.', '💡')
    ]
  });

  console.log('✅  Created:', page.url || page.id);
})();
