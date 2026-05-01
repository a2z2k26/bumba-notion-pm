# Examples

Each example is a runnable Node script. Copy `.env.example` to `.env` and fill in your values first.

| Example | What it does |
|---|---|
| [`01-verify-connection.js`](./01-verify-connection.js) | Verify your `NOTION_API_KEY` is working |
| [`02-create-page.js`](./02-create-page.js) | Create a page with mixed block types |
| [`03-create-database.js`](./03-create-database.js) | Create a built-in PM database (Tasks/Sprints/Epics/Projects) |
| [`04-github-sync.js`](./04-github-sync.js) | Pull GitHub issues into a Notion tasks database |

Run any of them:

```bash
node examples/01-verify-connection.js
```
