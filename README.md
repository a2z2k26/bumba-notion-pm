# Bumba Notion PM

> Node.js primitives for project management integrations with Notion.

[![CI](https://github.com/a2z2k26/bumba-notion-pm/actions/workflows/ci.yml/badge.svg)](https://github.com/a2z2k26/bumba-notion-pm/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A514-brightgreen)](https://nodejs.org/)

A focused library for building project management workflows on top of Notion. Bidirectional GitHub Issues ↔ Notion sync, a rate-limited Notion API client with typed errors, a page/database publisher with a block factory, and a small CLI.

## Features

- **`NotionClient`** — Rate-limited HTTP client wrapping `@notionhq/client` with retry, exponential backoff, and typed errors (`AuthError`, `RateLimitError`, `NotFoundError`, …).
- **`NotionPublisher`** — Create pages and databases. Block factory helpers (`heading`, `paragraph`, `bulletList`, `todoList`, `callout`, `code`, …) and built-in PM database schemas (Tasks, Sprints, Epics, Projects).
- **`GitHubIssueBridge`** — Two-way sync between a GitHub repo's issues and a Notion database. Supports `github-to-notion`, `notion-to-github`, or `bidirectional`.
- **CLI** — `bumba-notion-pm init | verify | create-db | sync | config`
- **Setup wizard** — Interactive `init` command that guides credential setup and verifies connection.

## Install

```bash
npm install bumba-notion-pm
```

Or clone for local development:

```bash
git clone https://github.com/a2z2k26/bumba-notion-pm.git
cd bumba-notion-pm
npm install
```

## Quick start

```bash
cp .env.example .env
# Edit .env: set NOTION_API_KEY and NOTION_PARENT_PAGE_ID
npx bumba-notion-pm verify
```

If `verify` prints `✅  Connected as: <integration>` and `✅  Parent page is accessible`, you're set.

## Library usage

```javascript
const { NotionPublisher } = require('bumba-notion-pm');

const publisher = new NotionPublisher();
const { blocks } = publisher;

const page = await publisher.publishPage({
  title: 'Q1 Roadmap',
  blocks: [
    blocks.heading('Goals', 1),
    blocks.bulletList(['Ship v1', 'Onboard 10 customers']),
    blocks.callout('Target: end of March', '🎯')
  ]
});

console.log(page.url);
```

### GitHub ↔ Notion sync

```javascript
const { GitHubIssueBridge } = require('bumba-notion-pm');

const bridge = new GitHubIssueBridge({
  repo: 'owner/name',
  databaseId: process.env.NOTION_TASKS_DATABASE_ID,
  direction: 'bidirectional'
});

const result = await bridge.syncAll();
// { fromGitHub: { created, updated, skipped, errors },
//   toGitHub:   { created, updated, skipped, errors } }
```

The Notion database must include `GitHub Issue` (url), `GitHub Number` (number), `Status` (select), and `Last Synced` (date) properties. Use `publisher.createPMDatabase('tasks', 'My Tasks')` to get a compatible database in one call.

## CLI

```bash
$ npx bumba-notion-pm --help

Commands:
  init                 Run interactive setup wizard
  verify               Verify Notion API key and parent page access
  create-db            Create one of the built-in PM databases
  sync                 Run GitHub↔Notion issue sync
  config               Show current configuration (API key masked)
```

```bash
# Walk through setup interactively
npx bumba-notion-pm init

# Create a tasks database under NOTION_PARENT_PAGE_ID
npx bumba-notion-pm create-db -k tasks -t "Engineering Tasks"

# Sync issues bidirectionally
npx bumba-notion-pm sync -r owner/name -d <database-id>
```

## Examples

Runnable examples in [`examples/`](./examples):

| File | What it does |
|---|---|
| [`01-verify-connection.js`](./examples/01-verify-connection.js) | Verify your `NOTION_API_KEY` is working |
| [`02-create-page.js`](./examples/02-create-page.js) | Create a page with mixed block types |
| [`03-create-database.js`](./examples/03-create-database.js) | Create a built-in PM database |
| [`04-github-sync.js`](./examples/04-github-sync.js) | Pull GitHub issues into Notion |

## Configuration

| Variable | Required | Description |
|---|---|---|
| `NOTION_API_KEY` | yes | Notion integration token (`secret_…` or `ntn_…`) |
| `NOTION_PARENT_PAGE_ID` | for publisher | Parent page that the integration is shared with |
| `NOTION_DATABASE_ID` | optional | Default database for queries |
| `NOTION_API_VERSION` | optional | Defaults to `2022-06-28` |
| `GITHUB_TOKEN` | for sync | PAT with `repo` scope |
| `GITHUB_REPO` | for sync | `owner/name` |
| `NOTION_TASKS_DATABASE_ID` | for sync | The Notion database to sync into |
| `NOTION_DEBUG` | optional | Set to `true` for verbose logs |

See [`.env.example`](./.env.example) for the full list.

## Architecture

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
              │ (rate-limit +    │
              │   retry + typed  │
              │     errors)      │
              └──────────────────┘
                        │
                        ▼
              ┌──────────────────┐
              │ @notionhq/client │
              └──────────────────┘
```

## Documentation

- [`docs/getting-started.md`](./docs/getting-started.md) — Step-by-step setup
- [`docs/api.md`](./docs/api.md) — Module-by-module API reference
- [`docs/notion-setup.md`](./docs/notion-setup.md) — Notion-side setup walkthrough
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — How to contribute
- [`SECURITY.md`](./SECURITY.md) — How to report vulnerabilities
- [`CHANGELOG.md`](./CHANGELOG.md) — Release notes

## Requirements

- Node.js ≥ 14 (tested on 18, 20, 22)
- A Notion account and an [integration token](https://www.notion.so/my-integrations)
- A parent page in your workspace shared with the integration

## License

MIT — see [`LICENSE`](./LICENSE).
