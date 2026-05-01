'use strict';

const { GitHubIssueBridge } = require('../src/sync/issue-bridge');
const { ConfigError, ValidationError } = require('../src/utils/errors');

function makeFakeNotion(overrides = {}) {
  return {
    pages: {
      create: jest.fn().mockResolvedValue({ id: 'np-new' }),
      update: jest.fn().mockResolvedValue({ id: 'np-update' })
    },
    databases: {
      query: jest.fn().mockResolvedValue({ results: [], has_more: false }),
      ...overrides.databases
    },
    ...overrides
  };
}

function makeFakeOctokit(overrides = {}) {
  return {
    issues: {
      listForRepo: jest.fn().mockResolvedValue({ data: [] }),
      create: jest.fn().mockResolvedValue({
        data: { number: 1, html_url: 'https://github.com/x/y/issues/1' }
      }),
      update: jest.fn().mockResolvedValue({ data: {} }),
      ...overrides.issues
    }
  };
}

describe('GitHubIssueBridge construction', () => {
  test('rejects missing databaseId', () => {
    expect(() => new GitHubIssueBridge({ repo: 'a/b', githubToken: 't' })).toThrow(ConfigError);
  });

  test('rejects malformed repo', () => {
    expect(
      () =>
        new GitHubIssueBridge({
          repo: 'no-slash',
          databaseId: 'd',
          githubToken: 't'
        })
    ).toThrow(ConfigError);
  });

  test('rejects missing github token', () => {
    const original = process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_TOKEN;
    try {
      expect(
        () =>
          new GitHubIssueBridge({
            repo: 'a/b',
            databaseId: 'd',
            notionClient: makeFakeNotion()
          })
      ).toThrow(ConfigError);
    } finally {
      if (original) process.env.GITHUB_TOKEN = original;
    }
  });

  test('rejects invalid direction', () => {
    expect(
      () =>
        new GitHubIssueBridge({
          repo: 'a/b',
          databaseId: 'd',
          githubToken: 't',
          direction: 'sideways',
          notionClient: makeFakeNotion()
        })
    ).toThrow(ValidationError);
  });
});

describe('GitHubIssueBridge.syncFromGitHub', () => {
  test('creates new Notion pages for new issues', async () => {
    const notion = makeFakeNotion();
    const octokit = makeFakeOctokit();
    octokit.issues.listForRepo = jest.fn().mockResolvedValue({
      data: [
        {
          number: 10,
          title: 'Bug',
          state: 'open',
          html_url: 'https://github.com/a/b/issues/10',
          labels: [{ name: 'bug' }]
        }
      ]
    });
    notion.databases.query = jest.fn().mockResolvedValue({ results: [], has_more: false });

    const bridge = new GitHubIssueBridge({
      repo: 'a/b',
      databaseId: 'd',
      githubToken: 't',
      notionClient: notion,
      octokit
    });

    const result = await bridge.syncFromGitHub();
    expect(result.created).toBe(1);
    expect(result.updated).toBe(0);
    expect(notion.pages.create).toHaveBeenCalledTimes(1);
  });

  test('updates existing Notion pages for known issues', async () => {
    const notion = makeFakeNotion();
    notion.databases.query = jest.fn().mockResolvedValue({
      results: [{ id: 'existing-page', properties: {} }],
      has_more: false
    });
    const octokit = makeFakeOctokit();
    octokit.issues.listForRepo = jest.fn().mockResolvedValue({
      data: [{ number: 7, title: 'Old', state: 'closed', html_url: '', labels: [] }]
    });

    const bridge = new GitHubIssueBridge({
      repo: 'a/b',
      databaseId: 'd',
      githubToken: 't',
      notionClient: notion,
      octokit
    });

    const result = await bridge.syncFromGitHub();
    expect(result.updated).toBe(1);
    expect(notion.pages.update).toHaveBeenCalled();
  });

  test('skips pull requests', async () => {
    const notion = makeFakeNotion();
    const octokit = makeFakeOctokit();
    octokit.issues.listForRepo = jest.fn().mockResolvedValue({
      data: [{ number: 1, title: 'PR', state: 'open', pull_request: {}, labels: [] }]
    });

    const bridge = new GitHubIssueBridge({
      repo: 'a/b',
      databaseId: 'd',
      githubToken: 't',
      notionClient: notion,
      octokit
    });

    const result = await bridge.syncFromGitHub();
    expect(result.skipped).toBe(1);
    expect(result.created).toBe(0);
  });

  test('refuses when direction is notion-to-github', async () => {
    const bridge = new GitHubIssueBridge({
      repo: 'a/b',
      databaseId: 'd',
      githubToken: 't',
      direction: 'notion-to-github',
      notionClient: makeFakeNotion(),
      octokit: makeFakeOctokit()
    });
    await expect(bridge.syncFromGitHub()).rejects.toThrow(/notion-to-github/);
  });
});

describe('GitHubIssueBridge.syncToGitHub', () => {
  test('creates GitHub issues for unlinked Notion pages', async () => {
    const notion = makeFakeNotion();
    notion.databases.query = jest.fn().mockResolvedValue({
      results: [
        {
          id: 'page-1',
          properties: {
            Name: { type: 'title', title: [{ plain_text: 'New task' }] },
            'GitHub Number': { type: 'number', number: null },
            Status: { type: 'select', select: { name: 'Todo' } },
            Labels: { type: 'multi_select', multi_select: [] }
          }
        }
      ],
      has_more: false
    });
    const octokit = makeFakeOctokit();

    const bridge = new GitHubIssueBridge({
      repo: 'a/b',
      databaseId: 'd',
      githubToken: 't',
      notionClient: notion,
      octokit
    });

    const result = await bridge.syncToGitHub();
    expect(result.created).toBe(1);
    expect(octokit.issues.create).toHaveBeenCalled();
    expect(notion.pages.update).toHaveBeenCalled();
  });

  test('updates existing issues for linked pages', async () => {
    const notion = makeFakeNotion();
    notion.databases.query = jest.fn().mockResolvedValue({
      results: [
        {
          id: 'page-1',
          properties: {
            Name: { type: 'title', title: [{ plain_text: 'Existing' }] },
            'GitHub Number': { type: 'number', number: 42 },
            Status: { type: 'select', select: { name: 'Done' } },
            Labels: { type: 'multi_select', multi_select: [{ name: 'bug' }] }
          }
        }
      ],
      has_more: false
    });
    const octokit = makeFakeOctokit();

    const bridge = new GitHubIssueBridge({
      repo: 'a/b',
      databaseId: 'd',
      githubToken: 't',
      notionClient: notion,
      octokit
    });

    const result = await bridge.syncToGitHub();
    expect(result.updated).toBe(1);
    expect(octokit.issues.update).toHaveBeenCalledWith(
      expect.objectContaining({
        issue_number: 42,
        state: 'closed'
      })
    );
  });
});
