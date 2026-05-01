'use strict';

const { Octokit } = require('@octokit/rest');
const { NotionClient } = require('../client/notion-client');
const { TASKS } = require('../publisher/schemas');
const { logger } = require('../utils/logger');
const { ConfigError, ValidationError, SyncError } = require('../utils/errors');

/**
 * GitHubIssueBridge — bidirectional sync between GitHub Issues and a Notion database.
 *
 * Conventions for the Notion database:
 *   - Title property: any property of type `title` (whatever it's called)
 *   - "GitHub Issue": url
 *   - "GitHub Number": number
 *   - "Status": select with options that map to GitHub state (open/closed)
 *   - "Last Synced": date
 *
 * The default schema (publisher/schemas.TASKS) satisfies these conventions.
 */
class GitHubIssueBridge {
  constructor(options = {}) {
    if (!options.databaseId) {
      throw new ConfigError('GitHubIssueBridge requires `databaseId`');
    }
    if (!options.repo || !/^[^/]+\/[^/]+$/.test(options.repo)) {
      throw new ConfigError('GitHubIssueBridge requires `repo` in "owner/name" format');
    }

    this.databaseId = options.databaseId;
    [this.owner, this.repoName] = options.repo.split('/');
    this.repo = options.repo;
    this.direction = options.direction || 'bidirectional';

    if (!['github-to-notion', 'notion-to-github', 'bidirectional'].includes(this.direction)) {
      throw new ValidationError(`Invalid direction: ${this.direction}`);
    }

    this.notion =
      options.notionClient ||
      new NotionClient({
        apiKey: options.notionApiKey,
        notionVersion: options.notionVersion
      });

    const githubToken = options.githubToken || process.env.GITHUB_TOKEN;
    if (!githubToken) {
      throw new ConfigError('GitHubIssueBridge requires `githubToken` (or env GITHUB_TOKEN)');
    }
    this.octokit = options.octokit || new Octokit({ auth: githubToken });

    this.statusFieldName = options.statusField || 'Status';
    this.statusOpen = options.statusOpenName || 'Todo';
    this.statusClosed = options.statusClosedName || 'Done';
  }

  /**
   * Sync all open + recently-closed issues from GitHub into Notion.
   * Returns { created, updated, skipped, errors }.
   */
  async syncFromGitHub({ state = 'all', perPage = 100 } = {}) {
    if (this.direction === 'notion-to-github') {
      throw new SyncError('Direction is notion-to-github; cannot syncFromGitHub');
    }
    const counters = { created: 0, updated: 0, skipped: 0, errors: 0 };
    const issues = await this._listAllIssues({ state, perPage });

    for (const issue of issues) {
      if (issue.pull_request) {
        counters.skipped += 1;
        continue;
      }
      try {
        const existing = await this._findNotionPageForIssue(issue.number);
        if (existing) {
          await this._updateNotionPageFromIssue(existing.id, issue);
          counters.updated += 1;
        } else {
          await this._createNotionPageFromIssue(issue);
          counters.created += 1;
        }
      } catch (err) {
        logger.error(`Failed to sync issue #${issue.number}:`, err.message);
        counters.errors += 1;
      }
    }

    return counters;
  }

  /**
   * Push all Notion pages into GitHub Issues.
   * Pages with a "GitHub Number" already set are updated; others are created.
   */
  async syncToGitHub({ pageSize = 100 } = {}) {
    if (this.direction === 'github-to-notion') {
      throw new SyncError('Direction is github-to-notion; cannot syncToGitHub');
    }
    const counters = { created: 0, updated: 0, skipped: 0, errors: 0 };
    let cursor = undefined;

    do {
      const result = await this.notion.databases.query({
        database_id: this.databaseId,
        page_size: pageSize,
        start_cursor: cursor
      });

      for (const page of result.results) {
        try {
          const githubNumber = readNumber(page.properties['GitHub Number']);
          if (githubNumber) {
            await this._updateIssueFromNotionPage(githubNumber, page);
            counters.updated += 1;
          } else {
            const created = await this._createIssueFromNotionPage(page);
            await this._linkPageToIssue(page.id, created);
            counters.created += 1;
          }
        } catch (err) {
          logger.error(`Failed to push page ${page.id}:`, err.message);
          counters.errors += 1;
        }
      }

      cursor = result.has_more ? result.next_cursor : undefined;
    } while (cursor);

    return counters;
  }

  /**
   * Run sync in both directions. GitHub-to-Notion runs first so the database
   * has fresh content before pushing back.
   */
  async syncAll(options = {}) {
    const result = { fromGitHub: null, toGitHub: null };
    if (this.direction !== 'notion-to-github') {
      result.fromGitHub = await this.syncFromGitHub(options);
    }
    if (this.direction !== 'github-to-notion') {
      result.toGitHub = await this.syncToGitHub(options);
    }
    return result;
  }

  async _listAllIssues({ state, perPage }) {
    const issues = [];
    let page = 1;
    while (true) {
      const { data } = await this.octokit.issues.listForRepo({
        owner: this.owner,
        repo: this.repoName,
        state,
        per_page: perPage,
        page
      });
      issues.push(...data);
      if (data.length < perPage) break;
      page += 1;
    }
    return issues;
  }

  async _findNotionPageForIssue(issueNumber) {
    const result = await this.notion.databases.query({
      database_id: this.databaseId,
      filter: {
        property: 'GitHub Number',
        number: { equals: issueNumber }
      },
      page_size: 1
    });
    return result.results[0] || null;
  }

  async _createNotionPageFromIssue(issue) {
    const properties = this._propertiesFromIssue(issue);
    return this.notion.pages.create({
      parent: { database_id: this.databaseId },
      properties
    });
  }

  async _updateNotionPageFromIssue(pageId, issue) {
    const properties = this._propertiesFromIssue(issue);
    return this.notion.pages.update({
      page_id: pageId,
      properties
    });
  }

  _propertiesFromIssue(issue) {
    return {
      Name: { title: [{ type: 'text', text: { content: issue.title || '(untitled)' } }] },
      'GitHub Issue': { url: issue.html_url },
      'GitHub Number': { number: issue.number },
      [this.statusFieldName]: {
        select: { name: issue.state === 'closed' ? this.statusClosed : this.statusOpen }
      },
      'Last Synced': { date: { start: new Date().toISOString() } },
      Labels: {
        multi_select: (issue.labels || [])
          .map((l) => ({
            name: typeof l === 'string' ? l : l.name
          }))
          .filter((l) => l.name)
      }
    };
  }

  async _createIssueFromNotionPage(page) {
    const title = readTitle(page) || '(untitled)';
    const { data } = await this.octokit.issues.create({
      owner: this.owner,
      repo: this.repoName,
      title,
      body: this._issueBodyFromPage(page),
      labels: readMultiSelect(page.properties.Labels)
    });
    return data;
  }

  async _updateIssueFromNotionPage(issueNumber, page) {
    const title = readTitle(page);
    const status = readSelect(page.properties[this.statusFieldName]);
    const state = status === this.statusClosed ? 'closed' : 'open';
    return this.octokit.issues.update({
      owner: this.owner,
      repo: this.repoName,
      issue_number: issueNumber,
      title,
      state,
      labels: readMultiSelect(page.properties.Labels)
    });
  }

  async _linkPageToIssue(pageId, issue) {
    return this.notion.pages.update({
      page_id: pageId,
      properties: {
        'GitHub Issue': { url: issue.html_url },
        'GitHub Number': { number: issue.number },
        'Last Synced': { date: { start: new Date().toISOString() } }
      }
    });
  }

  _issueBodyFromPage(page) {
    const url = page.url ? `\n\n_Synced from Notion: ${page.url}_` : '';
    return `Created from Notion via bumba-notion-pm.${url}`;
  }
}

function readTitle(page) {
  for (const prop of Object.values(page.properties || {})) {
    if (prop.type === 'title') {
      return prop.title.map((t) => t.plain_text || t.text?.content || '').join('');
    }
  }
  return '';
}

function readSelect(prop) {
  return prop?.select?.name || null;
}

function readMultiSelect(prop) {
  if (!prop || prop.type !== 'multi_select') return [];
  return (prop.multi_select || []).map((opt) => opt.name).filter(Boolean);
}

function readNumber(prop) {
  if (!prop || prop.type !== 'number') return null;
  return typeof prop.number === 'number' ? prop.number : null;
}

GitHubIssueBridge.defaultSchema = TASKS;

module.exports = { GitHubIssueBridge };
