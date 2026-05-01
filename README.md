```
██████╗ ██╗   ██╗███╗   ███╗██████╗  █████╗     ███╗   ██╗ ██████╗ ████████╗██╗ ██████╗ ███╗   ██╗    ██████╗ ███╗   ███╗
██╔══██╗██║   ██║████╗ ████║██╔══██╗██╔══██╗    ████╗  ██║██╔═══██╗╚══██╔══╝██║██╔═══██╗████╗  ██║    ██╔══██╗████╗ ████║
██████╔╝██║   ██║██╔████╔██║██████╔╝███████║    ██╔██╗ ██║██║   ██║   ██║   ██║██║   ██║██╔██╗ ██║    ██████╔╝██╔████╔██║
██╔══██╗██║   ██║██║╚██╔╝██║██╔══██╗██╔══██║    ██║╚██╗██║██║   ██║   ██║   ██║██║   ██║██║╚██╗██║    ██╔═══╝ ██║╚██╔╝██║
██████╔╝╚██████╔╝██║ ╚═╝ ██║██████╔╝██║  ██║    ██║ ╚████║╚██████╔╝   ██║   ██║╚██████╔╝██║ ╚████║    ██║     ██║ ╚═╝ ██║
╚═════╝  ╚═════╝ ╚═╝     ╚═╝╚═════╝ ╚═╝  ╚═╝    ╚═╝  ╚═══╝ ╚═════╝    ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝    ╚═╝     ╚═╝     ╚═╝
```

[![CI](https://github.com/a2z2k26/bumba-notion-pm/actions/workflows/ci.yml/badge.svg)](https://github.com/a2z2k26/bumba-notion-pm/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%E2%89%A514-brightgreen.svg)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

<br>

### Sync issues both ways. GitHub ↔ Notion. Bumba Notion PM is a Node.js library that makes a Notion database the project management surface for any GitHub repository — with real bidirectional sync, rate-limited Notion API plumbing, and a CLI to wire it up in minutes. Issues created in GitHub appear in Notion. Tasks created in Notion appear in GitHub. Status, labels, assignees, links — all synchronized. ###

---

### 🔴 Bidirectional sync, no compromises ###

- **GitHub → Notion**: Open and recently-closed issues become Notion pages with status, labels, and a back-link to the issue.
- **Notion → GitHub**: Tasks created in Notion get filed as GitHub issues. The Notion page is updated with the new issue number and URL.
- **Round-trip safe**: Once linked, a row's `GitHub Number` is the stable identity. Edit on either side; sync reconciles.
- **Three modes**: `bidirectional` (default), `github-to-notion`, `notion-to-github` — switch per-run.

---

### 🟡 Built for the Notion API, not against it ###

- **Rate-limited HTTP client** sized to Notion's 3 req/s budget — never get 429'd in a hot loop again.
- **Exponential backoff with jitter** on transient errors. Honors `Retry-After` when present.
- **Typed errors**: `AuthError`, `RateLimitError`, `NotFoundError`, `ValidationError` — `instanceof` your way out of guesswork.
- **Drop-in @notionhq/client shape** — every method the official SDK exposes, but rate-limited.

---

### 🟢 Zero-friction onboarding ###

- **Interactive setup wizard**: `npx bumba-notion-pm init` walks new users through token, parent page, and connection verification in under 2 minutes.
- **Built-in PM schemas**: Tasks, Sprints, Epics, and Projects databases ready to spin up — no Notion-side hand-crafting.
- **Block factory**: `heading`, `paragraph`, `bulletList`, `todoList`, `callout`, `code` — readable, composable, no manual JSON.
- **Single-command database creation**: `bumba-notion-pm create-db -k tasks -t "My Tasks"`.

<br>

### 🏁 What's in the box ###

| Module | What it does |
|---|---|
| **`NotionClient`** | Rate-limited HTTP client with retry and typed errors |
| **`NotionPublisher`** | Page + database publisher with block factory and PM schemas |
| **`GitHubIssueBridge`** | Bidirectional GitHub Issues ↔ Notion sync |
| **`runWizard`** | Interactive setup wizard |
| **CLI** | `init`, `verify`, `create-db`, `sync`, `config` |

<br>

### 🏁 Installation ###

(requires Node ≥ 14; tested on 18, 20, 22)

```bash
# Install from npm (recommended)
npm install bumba-notion-pm

# Or clone for local development
git clone https://github.com/a2z2k26/bumba-notion-pm
cd bumba-notion-pm
npm install
```

<br>

### 🏁 Setup ###

```bash
# 1. Configure your Notion integration
cp .env.example .env
# Add NOTION_API_KEY and NOTION_PARENT_PAGE_ID

# 2. Verify the connection
npx bumba-notion-pm verify

# 3. Or run the interactive wizard
npx bumba-notion-pm init
```

You'll need a [Notion integration token](https://www.notion.so/my-integrations) and a parent page in your workspace shared with the integration. Full walkthrough: [`docs/notion-setup.md`](docs/notion-setup.md).

<br>

### 🏁 Environment ###

Create `.env` in your project root:

```bash
# Required
NOTION_API_KEY=secret_...                     # or ntn_...
NOTION_PARENT_PAGE_ID=<32-char-hex>

# For GitHub sync
GITHUB_TOKEN=ghp_...                          # PAT with `repo` scope
GITHUB_REPO=owner/name
NOTION_TASKS_DATABASE_ID=<32-char-hex>

# Optional
NOTION_DEBUG=true                             # verbose logging
NOTION_API_VERSION=2022-06-28                 # default Notion API version
```

<br>

---

<br>

### 🏁 Sync GitHub Issues into Notion ###

```javascript
const { GitHubIssueBridge } = require('bumba-notion-pm');

const bridge = new GitHubIssueBridge({
  repo: 'owner/name',
  databaseId: process.env.NOTION_TASKS_DATABASE_ID,
  direction: 'bidirectional'
});

const result = await bridge.syncAll();
// {
//   fromGitHub: { created: 12, updated: 3, skipped: 0, errors: 0 },
//   toGitHub:   { created: 2,  updated: 5, skipped: 0, errors: 0 }
// }
```

<br>

### 🏁 Or just from the CLI ###

```bash
npx bumba-notion-pm sync -r owner/name -d <database-id>
```

<br>

### 🏁 Create a tasks database in one call ###

```bash
npx bumba-notion-pm create-db -k tasks -t "Engineering Tasks"
```

The database ships with `Status`, `Priority`, `Assignee`, `Due Date`, `GitHub Issue`, `GitHub Number`, `Labels`, and `Last Synced` — all the columns the bridge needs, no manual configuration.

<br>

### 🏁 Build pages programmatically ###

```javascript
const { NotionPublisher } = require('bumba-notion-pm');

const publisher = new NotionPublisher();
const { blocks } = publisher;

const page = await publisher.publishPage({
  title: 'Q1 Roadmap',
  blocks: [
    blocks.heading('Goals', 1),
    blocks.bulletList(['Ship v1', 'Onboard 10 customers', 'Launch docs']),
    blocks.callout('Target: end of March', '🎯'),
    blocks.divider(),
    blocks.heading('Risks', 2),
    blocks.todoList([
      { text: 'API rate limits', checked: true },
      { text: 'Notion permissions', checked: false }
    ])
  ]
});

console.log(page.url);
```

<br>

---

<br>

### 🟡 Rate-limited Notion calls (handled for you) ###

```javascript
const { NotionClient } = require('bumba-notion-pm');

const client = new NotionClient();  // reads NOTION_API_KEY

// Drop-in replacement for @notionhq/client. Every call goes through the limiter.
await client.databases.query({ database_id: '...' });
await client.pages.create({ parent: { page_id: '...' }, properties: { ... } });
await client.blocks.children.append({ block_id: '...', children: [...] });
```

The client retries `429` and `5xx` automatically with exponential backoff and jitter. When it gives up, you get a typed error with a `code` and `status`:

```javascript
const { errors } = require('bumba-notion-pm');

try {
  await publisher.publishPage({ ... });
} catch (err) {
  if (err instanceof errors.AuthError)        return rotateToken();
  if (err instanceof errors.RateLimitError)   return queueForLater(err.retryAfterMs);
  if (err instanceof errors.NotFoundError)    return reportMissing();
  throw err;
}
```

<br>

### 🟢 Validate config at startup ###

```javascript
const { assertConfig } = require('bumba-notion-pm');
const config = assertConfig();  // throws ConfigError on bad/missing env vars
```

<br>

---

<br>

### 🏁 CLI reference ###

```
$ npx bumba-notion-pm --help

Commands:
  init                 Run interactive setup wizard
  verify               Verify Notion API key and parent page access
  create-db [options]  Create a built-in PM database (tasks/sprints/epics/projects)
  sync [options]       Run GitHub↔Notion issue sync
  config               Show current configuration (API key masked)
```

<br>

### 🏁 Examples ###

Runnable scripts in [`examples/`](./examples):

```bash
node examples/01-verify-connection.js   # verify NOTION_API_KEY
node examples/02-create-page.js         # create a page with mixed blocks
node examples/03-create-database.js     # create a Tasks database
node examples/04-github-sync.js         # pull GitHub issues into Notion
```

<br>

---

<br>

### 🏁 Architecture ###

```
┌────────────────────────────────────────────┐
│              Your code / CLI               │
└────────────────────────────────────────────┘
              │                  │
              ▼                  ▼
   ┌──────────────────┐  ┌──────────────────┐
   │ NotionPublisher  │  │ GitHubIssueBridge│
   └──────────────────┘  └──────────────────┘
              │                  │
              └─────────┬────────┘
                        ▼
              ┌──────────────────┐
              │  NotionClient    │
              │ rate-limit + retry│
              │  + typed errors  │
              └──────────────────┘
                        │
                        ▼
              ┌──────────────────┐
              │ @notionhq/client │
              └──────────────────┘
```

<br>

### 🏁 Performance ###

| Operation | Behavior |
|---|---|
| **Burst calls** | Auto-throttled to ~3 req/s — well inside Notion's limit |
| **Transient failure** | Retried with exp. backoff (default 4 attempts, 500ms→8s) |
| **Rate limit** | Honors `Retry-After` header if present, jittered fallback otherwise |
| **Typed errors** | Surface `AuthError`/`RateLimitError`/`NotFoundError` instead of raw `Error` |

<br>

---

<br>

### 🏁 Notion-side requirements ###

For the GitHub sync, your Notion database needs these properties (the built-in `tasks` schema includes them all):

| Property | Type | Purpose |
|---|---|---|
| `Name` (or any title) | `title` | Issue title |
| `GitHub Issue` | `url` | Link back to the issue |
| `GitHub Number` | `number` | Stable sync identity |
| `Status` | `select` | Maps to GitHub state |
| `Last Synced` | `date` | Set on every sync |
| `Labels` | `multi_select` | Mirrors GitHub labels |

Generate a compatible database in one command:

```bash
npx bumba-notion-pm create-db -k tasks -t "Tasks"
```

<br>

---

<br>

### 🏁 Documentation ###

- **[Getting Started](docs/getting-started.md)** — 5-minute walkthrough
- **[API Reference](docs/api.md)** — Module-by-module API reference
- **[Notion Setup](docs/notion-setup.md)** — Notion-side integration walkthrough
- **[Contributing](docs/CONTRIBUTING.md)** — How to contribute
- **[Security](docs/SECURITY.md)** — How to report vulnerabilities
- **[Changelog](docs/CHANGELOG.md)** — Release notes

<br>

### 🏁 License ###

MIT License — see [LICENSE](LICENSE) for details.

<br>

### 🏁 Acknowledgement ###

Built on [`@notionhq/client`](https://github.com/makenotion/notion-sdk-js) and [`@octokit/rest`](https://github.com/octokit/rest.js).

<br>

---

<div align="center">

### 🏁 BUMBA Multi-Agent Orchestration Framework 🏁 ###

</div>
