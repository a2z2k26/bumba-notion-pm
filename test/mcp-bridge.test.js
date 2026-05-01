'use strict';

const { NotionMCPBridge } = require('../src/mcp/bridge');
const { NotionError } = require('../src/utils/errors');

function makeFakeApi() {
  return {
    pages: {
      create: jest.fn().mockResolvedValue({ id: 'api-page' }),
      retrieve: jest.fn().mockResolvedValue({ id: 'api-page' }),
      update: jest.fn().mockResolvedValue({ id: 'api-page' })
    },
    databases: {
      create: jest.fn().mockResolvedValue({ id: 'api-db' }),
      retrieve: jest.fn().mockResolvedValue({ id: 'api-db' }),
      query: jest.fn().mockResolvedValue({ results: [] }),
      update: jest.fn().mockResolvedValue({ id: 'api-db' })
    },
    blocks: {
      retrieve: jest.fn().mockResolvedValue({ id: 'api-block' }),
      update: jest.fn().mockResolvedValue({ id: 'api-block' }),
      delete: jest.fn().mockResolvedValue({ id: 'api-block' }),
      children: {
        list: jest.fn().mockResolvedValue({ results: [] }),
        append: jest.fn().mockResolvedValue({ results: [] })
      }
    },
    users: {
      list: jest.fn().mockResolvedValue({ results: [] }),
      me: jest.fn().mockResolvedValue({ id: 'api-user' }),
      retrieve: jest.fn().mockResolvedValue({ id: 'api-user' })
    },
    search: jest.fn().mockResolvedValue({ results: [] })
  };
}

function makeDetector(result) {
  return {
    detect: jest.fn().mockResolvedValue(result),
    clearCache: jest.fn()
  };
}

describe('NotionMCPBridge construction', () => {
  test('throws without an apiClient', () => {
    expect(() => new NotionMCPBridge({})).toThrow(NotionError);
  });
});

describe('NotionMCPBridge — api-only mode', () => {
  test('routes through API client without touching detector', async () => {
    const api = makeFakeApi();
    const detector = makeDetector({ available: true, method: 'http' });
    const bridge = new NotionMCPBridge({ apiClient: api, mode: 'api-only', detector });
    await bridge.initialize();
    const result = await bridge.pages.create({ parent: { page_id: 'p' } });
    expect(result.id).toBe('api-page');
    expect(api.pages.create).toHaveBeenCalled();
    expect(detector.detect).not.toHaveBeenCalled();
    expect(bridge.status().activeRoute).toBe('api');
  });
});

describe('NotionMCPBridge — auto mode (no MCP)', () => {
  test('falls back to API when detector says unavailable', async () => {
    const api = makeFakeApi();
    const detector = makeDetector({ available: false, method: 'none' });
    const bridge = new NotionMCPBridge({ apiClient: api, detector });
    await bridge.initialize();
    expect(bridge.status().activeRoute).toBe('api');
    await bridge.databases.query({ database_id: 'db' });
    expect(api.databases.query).toHaveBeenCalled();
  });
});

describe('NotionMCPBridge — auto mode (MCP available)', () => {
  test('routes through MCP transport when detected', async () => {
    const api = makeFakeApi();
    const detector = makeDetector({ available: true, method: 'http', url: 'http://x' });
    const transport = {
      invoke: jest.fn().mockResolvedValue({ id: 'mcp-page' }),
      close: jest.fn()
    };
    const bridge = new NotionMCPBridge({ apiClient: api, detector, transport });
    await bridge.initialize();
    expect(bridge.status().activeRoute).toBe('mcp');
    const result = await bridge.pages.create({ parent: { page_id: 'p' } });
    expect(result.id).toBe('mcp-page');
    expect(transport.invoke).toHaveBeenCalledWith('pages.create', expect.any(Object));
    expect(api.pages.create).not.toHaveBeenCalled();
  });

  test('falls back to API when MCP transport throws', async () => {
    const api = makeFakeApi();
    const detector = makeDetector({ available: true, method: 'http', url: 'http://x' });
    const transport = {
      invoke: jest.fn().mockRejectedValue(new Error('mcp boom')),
      close: jest.fn()
    };
    const bridge = new NotionMCPBridge({ apiClient: api, detector, transport });
    await bridge.initialize();
    const fallbackEvents = [];
    bridge.on('fallback', (e) => fallbackEvents.push(e));
    const result = await bridge.pages.create({ parent: { page_id: 'p' } });
    expect(result.id).toBe('api-page');
    expect(api.pages.create).toHaveBeenCalled();
    expect(fallbackEvents).toHaveLength(1);
    expect(fallbackEvents[0].operation).toBe('pages.create');
  });
});

describe('NotionMCPBridge — mcp-only mode', () => {
  test('throws when MCP is unavailable', async () => {
    const api = makeFakeApi();
    const detector = makeDetector({ available: false, method: 'none' });
    const bridge = new NotionMCPBridge({ apiClient: api, mode: 'mcp-only', detector });
    await expect(bridge.initialize()).rejects.toThrow(/no MCP server detected/);
  });

  test('does NOT fall back to API on transport error', async () => {
    const api = makeFakeApi();
    const detector = makeDetector({ available: true, method: 'http', url: 'http://x' });
    const transport = {
      invoke: jest.fn().mockRejectedValue(new Error('mcp boom')),
      close: jest.fn()
    };
    const bridge = new NotionMCPBridge({ apiClient: api, mode: 'mcp-only', detector, transport });
    await bridge.initialize();
    await expect(bridge.pages.create({})).rejects.toThrow('mcp boom');
    expect(api.pages.create).not.toHaveBeenCalled();
  });
});

describe('NotionMCPBridge — operation routing', () => {
  test('nested operations (blocks.children.append) reach correct API target', async () => {
    const api = makeFakeApi();
    const detector = makeDetector({ available: false, method: 'none' });
    const bridge = new NotionMCPBridge({ apiClient: api, detector });
    await bridge.initialize();
    await bridge.blocks.children.append({ block_id: 'p', children: [] });
    expect(api.blocks.children.append).toHaveBeenCalled();
  });

  test('search routes correctly', async () => {
    const api = makeFakeApi();
    const detector = makeDetector({ available: false, method: 'none' });
    const bridge = new NotionMCPBridge({ apiClient: api, detector });
    await bridge.initialize();
    await bridge.search({ query: 'x' });
    expect(api.search).toHaveBeenCalledWith({ query: 'x' });
  });
});

describe('NotionMCPBridge — refresh', () => {
  test('refresh re-runs detection', async () => {
    const api = makeFakeApi();
    const detector = makeDetector({ available: false, method: 'none' });
    const bridge = new NotionMCPBridge({ apiClient: api, detector });
    await bridge.initialize();
    await bridge.refresh();
    expect(detector.clearCache).toHaveBeenCalled();
    expect(detector.detect).toHaveBeenCalledTimes(2);
  });
});
