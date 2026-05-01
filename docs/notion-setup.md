# Notion-side Setup

A walkthrough of setting up Notion to work with this library.

## 1. Create an integration

1. Visit https://www.notion.so/my-integrations
2. Click **+ New integration**
3. Fill in:
   - **Name**: anything (e.g. "Bumba")
   - **Associated workspace**: pick yours
   - **Logo**: optional
4. Click **Submit**
5. Copy the **Internal Integration Token** — starts with `secret_` or `ntn_`

Save the token to your `.env`:

```
NOTION_API_KEY=secret_…
```

> **Security note:** never commit `.env`. The included `.gitignore` already excludes it.

## 2. Configure capabilities

On the integration's settings page, leave these enabled (default):

- ✅ Read content
- ✅ Update content
- ✅ Insert content

You can disable comment-related capabilities — the library doesn't use them.

## 3. Share a parent page with your integration

The integration has zero access until you explicitly share pages with it.

### Recommended: dedicated parent page

1. In Notion, create a page (e.g. "Bumba Projects")
2. Click **Share** in the top-right corner
3. Click **Invite**
4. Search for your integration's name and select it
5. Click **Invite**

The integration can now read and write under this page.

### Alternative: per-page sharing

You can also share specific pages on a per-project basis. The dedicated parent approach is simpler.

## 4. Get the parent page ID

1. Open the parent page in Notion
2. Click the **…** menu → **Copy link**
3. The URL looks like `https://www.notion.so/My-Page-<32-char-hex-id>?v=…`
4. The ID is the 32-char hex (or hyphenated UUID) at the end

Add it to `.env`:

```
NOTION_PARENT_PAGE_ID=<your-id>
```

## 5. Verify

```bash
npx bumba-notion-pm verify
```

If you see `✅  Connected as: …` and `✅  Parent page is accessible`, you're done.

## Troubleshooting

### "Integration not authorized"

The page (or one of its ancestors) wasn't shared with the integration. Re-share via the **Share** menu.

### "Invalid API key"

The token is wrong, was revoked, or has whitespace around it. Regenerate at https://www.notion.so/my-integrations and update `.env`.

### "Cannot create database"

Either:
- The integration lacks the **Insert content** capability, or
- The parent page wasn't shared with it

### "Rate limit exceeded"

Notion's API caps you at ~3 requests/second. The library handles this automatically with retries. If you see this, you're probably making parallel calls outside `NotionClient` — route them through it.

## What the library creates

The publisher creates Notion pages and databases under your shared parent page. It will not modify pages outside that subtree. Each database created via `createPMDatabase()` uses one of these schemas:

- **Tasks**: Name, Status, Priority, Assignee, Due Date, GitHub Issue, GitHub Number, Labels, Last Synced
- **Sprints**: Name, Status, Start Date, End Date, Goal, Story Points
- **Epics**: Name, Status, Description, Owner, Target Date
- **Projects**: Name, Status, Description, Owner, Repository
