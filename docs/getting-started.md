# Getting Started

A 5-minute walkthrough.

## 1. Install

```bash
git clone https://github.com/a2z2k26/bumba-notion-pm.git
cd bumba-notion-pm
npm install
```

Or as a dependency in your own project:

```bash
npm install bumba-notion-pm
```

## 2. Create a Notion integration

1. Visit https://www.notion.so/my-integrations
2. Click **+ New integration**
3. Name it (e.g. "Bumba")
4. Select your workspace
5. Click **Submit**, then copy the **Internal Integration Token** (starts with `secret_` or `ntn_`)

## 3. Share a page with the integration

The integration cannot access any pages until you explicitly share them.

1. Open or create a page in Notion (e.g. "Bumba Projects")
2. Click **Share** in the top-right
3. Search for your integration name and click **Invite**
4. Copy the page ID from the URL — it's the 32-character hex string after the page slug

Full walkthrough with screenshots: [`notion-setup.md`](./notion-setup.md).

## 4. Configure

```bash
cp .env.example .env
```

Edit `.env`:

```
NOTION_API_KEY=secret_…
NOTION_PARENT_PAGE_ID=…
```

## 5. Verify

```bash
npx bumba-notion-pm verify
```

Expected:

```
✅  Connected as: <integration name>
✅  Parent page is accessible
```

If you see `❌  Verification failed`, the most common causes are:

- API key is wrong or revoked → regenerate it
- Page wasn't shared with the integration → re-share it
- Page ID is malformed → 32 hex chars (with or without dashes)

## 6. First page

```bash
node examples/02-create-page.js
```

This creates a page in your Notion workspace using a mix of block types — heading, paragraph, divider, bullet list, callout. Open the URL in the script's output to see the result.

## 7. First database

```bash
node examples/03-create-database.js
```

This creates a "My Tasks" database with the built-in `TASKS` schema, including columns for Status, Priority, Assignee, Due Date, GitHub Issue link, and Last Synced.

The script prints the database ID — add it to your `.env` as `NOTION_TASKS_DATABASE_ID` to enable GitHub sync.

## 8. GitHub sync

Add a GitHub PAT (with `repo` scope) and a target repo to your `.env`:

```
GITHUB_TOKEN=ghp_…
GITHUB_REPO=owner/name
NOTION_TASKS_DATABASE_ID=…
```

Then:

```bash
node examples/04-github-sync.js
```

Or via the CLI:

```bash
npx bumba-notion-pm sync -r owner/name -d <database-id>
```

This pulls all open and recently-closed issues from the repo into your Notion database, creating new pages or updating existing ones based on `GitHub Number`.

## Where to next

- [`api.md`](./api.md) — Full API reference
- [`../examples/`](../examples/) — More worked examples
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — Contribute back
