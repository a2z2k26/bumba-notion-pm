'use strict';

jest.mock('@notionhq/client');

const { Client } = require('@notionhq/client');
const { NotionClient } = require('../src/client/notion-client');
const errors = require('../src/utils/errors');

beforeEach(() => {
  Client.mockClear();
});

describe('NotionClient construction', () => {
  test('throws AuthError when no API key is available', () => {
    const original = process.env.NOTION_API_KEY;
    delete process.env.NOTION_API_KEY;
    try {
      expect(() => new NotionClient()).toThrow(errors.AuthError);
    } finally {
      if (original) process.env.NOTION_API_KEY = original;
    }
  });

  test('uses provided apiKey', () => {
    new NotionClient({ apiKey: 'secret_test_token_xxxxxxxxxxxxxxxxxxxxxx' });
    expect(Client).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: 'secret_test_token_xxxxxxxxxxxxxxxxxxxxxx'
      })
    );
  });
});

describe('NotionClient method delegation', () => {
  let mockSDK;
  let client;

  beforeEach(() => {
    mockSDK = {
      pages: {
        create: jest.fn().mockResolvedValue({ id: 'page-1' }),
        retrieve: jest.fn().mockResolvedValue({ id: 'page-1' }),
        update: jest.fn().mockResolvedValue({ id: 'page-1' })
      },
      databases: {
        create: jest.fn().mockResolvedValue({ id: 'db-1' }),
        query: jest.fn().mockResolvedValue({ results: [], has_more: false }),
        retrieve: jest.fn().mockResolvedValue({ id: 'db-1' }),
        update: jest.fn().mockResolvedValue({ id: 'db-1' })
      },
      blocks: {
        retrieve: jest.fn().mockResolvedValue({ id: 'b-1' }),
        update: jest.fn().mockResolvedValue({ id: 'b-1' }),
        delete: jest.fn().mockResolvedValue({ id: 'b-1' }),
        children: {
          list: jest.fn().mockResolvedValue({ results: [] }),
          append: jest.fn().mockResolvedValue({ results: [] })
        }
      },
      users: {
        list: jest.fn().mockResolvedValue({ results: [] }),
        me: jest.fn().mockResolvedValue({ id: 'user-1', name: 'Test User' }),
        retrieve: jest.fn().mockResolvedValue({ id: 'user-1' })
      },
      search: jest.fn().mockResolvedValue({ results: [] })
    };
    Client.mockImplementation(() => mockSDK);
    client = new NotionClient({
      apiKey: 'secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      minIntervalMs: 0,
      maxRetries: 1
    });
  });

  test('pages.create delegates to SDK', async () => {
    const result = await client.pages.create({ parent: { page_id: 'p' }, properties: {} });
    expect(mockSDK.pages.create).toHaveBeenCalledTimes(1);
    expect(result.id).toBe('page-1');
  });

  test('databases.query delegates to SDK', async () => {
    await client.databases.query({ database_id: 'db' });
    expect(mockSDK.databases.query).toHaveBeenCalledWith({ database_id: 'db' });
  });

  test('blocks.children.append delegates to SDK', async () => {
    await client.blocks.children.append({ block_id: 'p', children: [] });
    expect(mockSDK.blocks.children.append).toHaveBeenCalled();
  });

  test('verifyConnection returns user on success', async () => {
    const user = await client.verifyConnection();
    expect(user.id).toBe('user-1');
  });
});

describe('NotionClient error normalization', () => {
  test('401 from SDK becomes AuthError', async () => {
    Client.mockImplementation(() => ({
      pages: { create: jest.fn().mockRejectedValue({ status: 401, message: 'unauthorized' }) },
      databases: {},
      blocks: { children: {} },
      users: {},
      search: jest.fn()
    }));
    const client = new NotionClient({
      apiKey: 'secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      minIntervalMs: 0,
      maxRetries: 1
    });
    await expect(client.pages.create({})).rejects.toBeInstanceOf(errors.AuthError);
  });

  test('429 from SDK becomes RateLimitError (after retry exhaustion)', async () => {
    Client.mockImplementation(() => ({
      pages: { create: jest.fn().mockRejectedValue({ status: 429, message: 'rate limited' }) },
      databases: {},
      blocks: { children: {} },
      users: {},
      search: jest.fn()
    }));
    const client = new NotionClient({
      apiKey: 'secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      minIntervalMs: 0,
      maxRetries: 1,
      baseDelayMs: 1
    });
    await expect(client.pages.create({})).rejects.toBeInstanceOf(errors.RateLimitError);
  });

  test('404 from SDK becomes NotFoundError', async () => {
    Client.mockImplementation(() => ({
      pages: { retrieve: jest.fn().mockRejectedValue({ status: 404, code: 'object_not_found' }) },
      databases: {},
      blocks: { children: {} },
      users: {},
      search: jest.fn()
    }));
    const client = new NotionClient({
      apiKey: 'secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      minIntervalMs: 0,
      maxRetries: 1
    });
    await expect(client.pages.retrieve({ page_id: 'x' })).rejects.toBeInstanceOf(
      errors.NotFoundError
    );
  });
});
