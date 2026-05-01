# API Reference

The library exports the following from its top-level entry point:

```javascript
const {
  NotionClient,
  NotionPublisher,
  GitHubIssueBridge,
  blocks,
  schemas,
  validateConfig,
  assertConfig,
  runWizard,
  logger,
  errors
} = require('bumba-notion-pm');
```

---

## NotionClient

Rate-limited HTTP client wrapping `@notionhq/client`. Every call goes through a token-bucket-style limiter (default ~3 req/s) and is retried on `429` / `5xx` with exponential backoff and jitter.

### Constructor

```javascript
new NotionClient({
  apiKey,           // required, defaults to env.NOTION_API_KEY
  notionVersion,    // optional, default '2022-06-28'
  minIntervalMs,    // optional, default 350
  maxRetries,       // optional, default 4
  baseDelayMs,      // optional, default 500
  maxDelayMs        // optional, default 8000
})
```

### Methods

The client exposes the same shape as `@notionhq/client`:

```javascript
client.pages.create(args)
client.pages.retrieve(args)
client.pages.update(args)

client.databases.create(args)
client.databases.retrieve(args)
client.databases.query(args)
client.databases.update(args)

client.blocks.retrieve(args)
client.blocks.update(args)
client.blocks.delete(args)
client.blocks.children.list(args)
client.blocks.children.append(args)

client.users.list(args?)
client.users.me(args?)
client.users.retrieve(args)

client.search(args)
```

Plus:

```javascript
client.verifyConnection()  // returns user object on success, throws AuthError on failure
client.raw                 // the underlying @notionhq/client instance
```

### Error normalization

Raw SDK errors are translated into typed errors before they bubble up:

| HTTP / SDK code | Thrown |
|---|---|
| `401`, `unauthorized` | `errors.AuthError` |
| `404`, `object_not_found` | `errors.NotFoundError` |
| `429`, `rate_limited` | `errors.RateLimitError` (with `retryAfterMs` if available) |
| `400`, `validation_error` | `errors.ValidationError` |
| any other | `errors.NotionError` |

All extend `errors.NotionError`, so a single `instanceof errors.NotionError` check covers them all.

---

## NotionPublisher

High-level page and database publishing.

### Constructor

```javascript
new NotionPublisher({
  apiKey,          // optional if NOTION_API_KEY is set
  notionVersion,   // optional
  parentPageId,    // optional, defaults to env.NOTION_PARENT_PAGE_ID
  client           // optional, override the underlying NotionClient
})
```

### Methods

```javascript
publisher.publishPage({
  title,             // required
  blocks,            // optional Notion API block array
  parentPageId,      // overrides default
  parentDatabaseId,  // create as a row in this database instead
  properties,        // required when parentDatabaseId is set
  icon,              // optional
  cover              // optional
}) → Promise<page>

publisher.appendBlocks(pageId, children) → Promise

publisher.createDatabase({
  title,
  properties,        // Notion `properties` object
  parentPageId,      // overrides default
  icon
}) → Promise<database>

publisher.createPMDatabase(kind, title, overrides?) → Promise<database>
// kind: 'tasks' | 'sprints' | 'epics' | 'projects'
```

### Built-in schemas

```javascript
publisher.schemas.TASKS
publisher.schemas.SPRINTS
publisher.schemas.EPICS
publisher.schemas.PROJECTS
```

Each is a `properties` object compatible with `databases.create`. Spread to extend:

```javascript
const customTasks = { ...publisher.schemas.TASKS, Difficulty: { number: { format: 'number' } } };
await publisher.createDatabase({ title: 'Tasks', properties: customTasks });
```

### Block factory

`publisher.blocks` (also exported as the top-level `blocks` module):

| Helper | Returns |
|---|---|
| `richText(content)` | `[{ type: 'text', text: { content } }]` |
| `paragraph(text)` | `paragraph` block |
| `heading(text, level)` | `heading_1` / `heading_2` / `heading_3` |
| `bulletList(items)` | array of `bulleted_list_item` blocks |
| `numberList(items)` | array of `numbered_list_item` blocks |
| `todoList(items)` | array of `to_do` blocks (items can be `string` or `{text, checked}`) |
| `divider()` | `divider` block |
| `code(text, language)` | `code` block |
| `callout(text, emoji)` | `callout` block |
| `quote(text)` | `quote` block |

---

## GitHubIssueBridge

Bidirectional sync between GitHub Issues and a Notion database.

### Constructor

```javascript
new GitHubIssueBridge({
  repo,             // required, "owner/name"
  databaseId,       // required, target Notion database
  githubToken,      // optional if GITHUB_TOKEN is set
  notionApiKey,     // optional if NOTION_API_KEY is set
  notionClient,     // optional, override
  octokit,          // optional, override
  direction,        // 'github-to-notion' | 'notion-to-github' | 'bidirectional' (default)
  statusField,      // default 'Status'
  statusOpenName,   // default 'Todo'
  statusClosedName  // default 'Done'
})
```

### Methods

```javascript
bridge.syncFromGitHub({ state? = 'all', perPage? = 100 })
  → { created, updated, skipped, errors }

bridge.syncToGitHub({ pageSize? = 100 })
  → { created, updated, skipped, errors }

bridge.syncAll(options?)
  → { fromGitHub, toGitHub }
```

### Required Notion database properties

| Property | Type | Purpose |
|---|---|---|
| (any) | `title` | Issue title |
| `GitHub Issue` | `url` | Link back to the issue |
| `GitHub Number` | `number` | Stable identity for sync |
| `Status` | `select` | Maps open/closed (configurable) |
| `Last Synced` | `date` | Set on every sync |
| `Labels` | `multi_select` | Optional, mirrors GitHub labels |

The `TASKS` schema satisfies all of these.

---

## Configuration helpers

```javascript
const result = validateConfig();
// { valid, errors, warnings, config }

const config = assertConfig();  // throws ConfigError if invalid
```

`config` has camelCase properties:

```javascript
{
  notionApiKey,
  notionParentPageId,
  notionDatabaseId,
  notionWorkspaceId,
  notionApiVersion,
  githubToken,
  githubRepo,
  notionTasksDatabaseId,
  debug
}
```

---

## Setup wizard

```javascript
const { runWizard } = require('bumba-notion-pm');
await runWizard({ envPath: '.env' });
```

Interactive prompts for `NOTION_API_KEY` and `NOTION_PARENT_PAGE_ID`, optional connection verification, writes the result to `.env` (mode `0600`).

---

## Errors

All custom errors extend `errors.NotionError`:

```javascript
errors.NotionError      // base
errors.ConfigError      // bad/missing config
errors.AuthError        // 401, missing key
errors.RateLimitError   // 429, includes retryAfterMs
errors.NotFoundError    // 404
errors.ValidationError  // 400, includes fields[]
errors.SyncError        // sync-specific failures
```

Each carries:
- `name` (constructor name)
- `code` (machine-readable string)
- `status` (HTTP status when applicable)
- `cause` (original error when wrapped)
