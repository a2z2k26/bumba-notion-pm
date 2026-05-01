'use strict';

const { NotionPublisher } = require('../src/publisher/notion-publisher');
const { ConfigError, ValidationError } = require('../src/utils/errors');

function makeFakeClient() {
  return {
    pages: {
      create: jest.fn().mockResolvedValue({ id: 'page-1', url: 'https://notion.so/p' })
    },
    databases: {
      create: jest.fn().mockResolvedValue({ id: 'db-1', url: 'https://notion.so/d' })
    },
    blocks: {
      children: {
        append: jest.fn().mockResolvedValue({ results: [] })
      }
    }
  };
}

describe('NotionPublisher.publishPage', () => {
  test('throws ValidationError without title', async () => {
    const publisher = new NotionPublisher({
      client: makeFakeClient(),
      parentPageId: 'p'.repeat(32)
    });
    await expect(publisher.publishPage({})).rejects.toThrow(ValidationError);
  });

  test('throws ConfigError when no parent provided', async () => {
    const publisher = new NotionPublisher({ client: makeFakeClient() });
    await expect(publisher.publishPage({ title: 'x' })).rejects.toThrow(ConfigError);
  });

  test('publishes a page under the default parent page', async () => {
    const client = makeFakeClient();
    const publisher = new NotionPublisher({ client, parentPageId: 'a'.repeat(32) });
    const page = await publisher.publishPage({
      title: 'Hello',
      blocks: [publisher.blocks.heading('Welcome')]
    });
    expect(page.id).toBe('page-1');
    const arg = client.pages.create.mock.calls[0][0];
    expect(arg.parent.type).toBe('page_id');
    expect(arg.parent.page_id).toBe('a'.repeat(32));
    expect(arg.children).toHaveLength(1);
  });

  test('publishes into a database when parentDatabaseId is given', async () => {
    const client = makeFakeClient();
    const publisher = new NotionPublisher({ client });
    await publisher.publishPage({
      title: 'Row',
      parentDatabaseId: 'd'.repeat(32),
      properties: { Status: { select: { name: 'Todo' } } }
    });
    const arg = client.pages.create.mock.calls[0][0];
    expect(arg.parent.type).toBe('database_id');
    expect(arg.properties.Name.title).toBeDefined();
    expect(arg.properties.Status).toBeDefined();
  });
});

describe('NotionPublisher.createDatabase', () => {
  test('requires title and properties', async () => {
    const publisher = new NotionPublisher({
      client: makeFakeClient(),
      parentPageId: 'p'.repeat(32)
    });
    await expect(publisher.createDatabase({})).rejects.toThrow(ValidationError);
  });

  test('creates a database under the configured parent', async () => {
    const client = makeFakeClient();
    const publisher = new NotionPublisher({ client, parentPageId: 'a'.repeat(32) });
    await publisher.createDatabase({
      title: 'Tasks',
      properties: publisher.schemas.TASKS
    });
    expect(client.databases.create).toHaveBeenCalled();
  });

  test('createPMDatabase rejects unknown kinds', async () => {
    const publisher = new NotionPublisher({
      client: makeFakeClient(),
      parentPageId: 'a'.repeat(32)
    });
    await expect(publisher.createPMDatabase('nonsense', 'X')).rejects.toThrow(ValidationError);
  });

  test('createPMDatabase creates a tasks database with default schema', async () => {
    const client = makeFakeClient();
    const publisher = new NotionPublisher({ client, parentPageId: 'a'.repeat(32) });
    await publisher.createPMDatabase('tasks', 'My Tasks');
    const payload = client.databases.create.mock.calls[0][0];
    expect(payload.properties.Name.title).toBeDefined();
    expect(payload.properties.Status.select.options.length).toBeGreaterThan(1);
  });
});

describe('NotionPublisher.appendBlocks', () => {
  test('rejects empty children', async () => {
    const publisher = new NotionPublisher({
      client: makeFakeClient(),
      parentPageId: 'a'.repeat(32)
    });
    await expect(publisher.appendBlocks('page-1', [])).rejects.toThrow(ValidationError);
  });

  test('appends to the SDK', async () => {
    const client = makeFakeClient();
    const publisher = new NotionPublisher({ client });
    await publisher.appendBlocks('page-1', [publisher.blocks.paragraph('hi')]);
    expect(client.blocks.children.append).toHaveBeenCalled();
  });
});
